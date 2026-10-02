// Live video session hook. Captures frames at intervals from the camera,
// sends each to the vision API, and speaks the result via TTS. Only one
// request is in-flight at a time — new frames are skipped until the
// previous result arrives and finishes speaking. Scene-change detection
// prevents re-describing an identical static view.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssistantLanguage, VisionHistoryTurn } from '../api/client';
import { ApiError, analyzeVisionImage } from '../api/client';
import { useProfileStore } from '../profile/store';
import { speakText, stopSpeaking } from '../speech/tts';
import type { AccessibilityNeed } from '../profile/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LiveStatus =
  | 'idle'
  | 'running'
  | 'capturing'
  | 'analyzing'
  | 'speaking'
  | 'paused'
  | 'error';

export interface LiveNarration {
  id: string;
  text: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Seconds between frame captures while running. */
const CAPTURE_INTERVAL_MS = 4000;
/** Quality 0-1 for captured JPEG frames. Lower = faster network. */
const FRAME_QUALITY = 0.35;

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const LIVE_DESCRIBE_PROMPT = [
  'You are narrating a live camera feed for a blind user.',
  'Describe ONLY what is new or changed since your last description.',
  'If nothing changed, reply with exactly: "[no change]".',
  'Be very brief — one to two sentences maximum.',
  'Focus on: obstacles, people approaching, signs, traffic, doors, stairs.',
  'Use spatial terms: left, right, ahead, behind, above, below.',
  'Never apologize or add filler. Just describe.',
].join(' ');

const INITIAL_DESCRIBE_PROMPT = [
  'You are starting a live narration of a camera feed for a blind user.',
  'Describe the scene in 2-3 concise sentences.',
  'Focus on: what is directly ahead, key objects, people, obstacles, readable text.',
  'Use spatial terms: left, right, ahead, behind.',
].join(' ');

// ---------------------------------------------------------------------------
// Frame capturer type (provided by the screen)
// ---------------------------------------------------------------------------

export type FrameCapturer = () => Promise<string | null>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function friendlyError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.statusCode === 429) return 'Assistant is busy. Pausing briefly.';
    if (err.statusCode === 503) return 'Assistant is not set up yet.';
    if (err.message.toLowerCase().includes('timed out'))
      return 'Analysis took too long. Skipping this frame.';
    return err.message;
  }
  return 'Something went wrong. Will retry on next frame.';
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useLiveSession() {
  const language = useProfileStore((s) => s.language) as AssistantLanguage;
  const needs = useProfileStore((s) => s.needs) as AccessibilityNeed[];

  // Live narration is inherently voice-first — always speak output
  // regardless of the user's general output-mode preference.

  const [status, setStatus] = useState<LiveStatus>('idle');
  const [narrations, setNarrations] = useState<LiveNarration[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [frameCount, setFrameCount] = useState(0);

  const capturerRef = useRef<FrameCapturer | null>(null);
  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  const busyRef = useRef(false);
  const idCounter = useRef(0);
  const lastDescriptionRef = useRef('');
  // Keep a small rolling history so the AI can diff against its own last reply.
  const historyRef = useRef<VisionHistoryTurn[]>([]);

  const nextId = useCallback(() => {
    idCounter.current += 1;
    return `live-${Date.now().toString(36)}-${idCounter.current}`;
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runningRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      void stopSpeaking();
    };
  }, []);

  const setCapturer = useCallback((fn: FrameCapturer | null) => {
    capturerRef.current = fn;
  }, []);

  // ------- speak helper -------
  const say = useCallback(
    async (text: string) => {
      if (!mountedRef.current) return;
      setStatus('speaking');
      await speakText(text, language, {
        onDone: () => {
          if (mountedRef.current && runningRef.current) setStatus('running');
          else if (mountedRef.current) setStatus('paused');
        },
        onStopped: () => {
          if (mountedRef.current && runningRef.current) setStatus('running');
          else if (mountedRef.current) setStatus('paused');
        },
        onError: () => {
          if (mountedRef.current && runningRef.current) setStatus('running');
          else if (mountedRef.current) setStatus('paused');
        },
      });
    },
    [language],
  );

  // ------- single frame capture + analyze cycle -------
  const processFrame = useCallback(async () => {
    if (!mountedRef.current || !runningRef.current) return;
    if (busyRef.current) return; // previous frame still in flight
    if (!capturerRef.current) return;

    busyRef.current = true;
    setStatus('capturing');

    try {
      const base64 = await capturerRef.current();
      if (!base64 || !mountedRef.current || !runningRef.current) {
        busyRef.current = false;
        if (mountedRef.current) setStatus('running');
        return;
      }

      setStatus('analyzing');
      setFrameCount((c) => c + 1);

      const isFirst = historyRef.current.length === 0;
      const prompt = isFirst ? INITIAL_DESCRIBE_PROMPT : LIVE_DESCRIBE_PROMPT;

      const result = await analyzeVisionImage({
        image: base64,
        mimeType: 'image/jpeg',
        message: prompt,
        history: historyRef.current.slice(-4), // keep context small
        language,
        needs: needs.length > 0 ? needs : undefined,
      });

      if (!mountedRef.current || !runningRef.current) {
        busyRef.current = false;
        return;
      }

      const reply = result.reply.trim();

      // Skip speaking if the AI says nothing changed.
      const noChange =
        reply.toLowerCase().includes('[no change]') ||
        reply.toLowerCase() === 'no change' ||
        reply === lastDescriptionRef.current;

      if (!noChange) {
        lastDescriptionRef.current = reply;

        // Update rolling history (keep only last 4 turns).
        historyRef.current = [
          ...historyRef.current,
          { role: 'user' as const, text: prompt },
          { role: 'model' as const, text: reply },
        ].slice(-4);

        const narration: LiveNarration = {
          id: nextId(),
          text: reply,
          timestamp: Date.now(),
        };
        setNarrations((prev) => [narration, ...prev].slice(0, 20));
        setError(null);

        // Speak the new narration — interrupts any ongoing speech.
        await say(reply);
      } else {
        // Nothing changed — stay in running state.
        if (mountedRef.current && runningRef.current) setStatus('running');
      }
    } catch (err) {
      if (mountedRef.current) {
        const msg = friendlyError(err);
        setError(msg);
        setStatus('error');
        // Brief pause on error, then continue if still running.
        await new Promise((r) => setTimeout(r, 2000));
        if (mountedRef.current && runningRef.current) setStatus('running');
      }
    } finally {
      busyRef.current = false;
    }
  }, [language, needs, nextId, say]);

  // ------- interval loop -------
  const scheduleNext = useCallback(() => {
    if (!runningRef.current || !mountedRef.current) return;
    timerRef.current = setTimeout(() => {
      if (!runningRef.current || !mountedRef.current) return;
      void processFrame().then(() => {
        scheduleNext();
      });
    }, CAPTURE_INTERVAL_MS);
  }, [processFrame]);

  // ------- controls -------
  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    busyRef.current = false;
    historyRef.current = [];
    lastDescriptionRef.current = '';
    setStatus('running');
    setError(null);
    setNarrations([]);
    setFrameCount(0);

    // Kick off the first frame immediately, then schedule loop.
    void processFrame().then(() => {
      scheduleNext();
    });
  }, [processFrame, scheduleNext]);

  const pause = useCallback(() => {
    runningRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    void stopSpeaking();
    setStatus('paused');
  }, []);

  const resume = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    setStatus('running');
    setError(null);
    void processFrame().then(() => {
      scheduleNext();
    });
  }, [processFrame, scheduleNext]);

  const stop = useCallback(() => {
    runningRef.current = false;
    busyRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    void stopSpeaking();
    historyRef.current = [];
    lastDescriptionRef.current = '';
    setStatus('idle');
  }, []);

  return {
    status,
    narrations,
    error,
    frameCount,
    language,
    isRunning: status !== 'idle' && status !== 'paused',
    isPaused: status === 'paused',
    setCapturer,
    start,
    pause,
    resume,
    stop,
    say,
  };
}
