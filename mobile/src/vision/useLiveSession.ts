// ---------------------------------------------------------------------------
// Production-grade real-time live session via WebSocket + Gemini Live API.
//
// Architecture:
//   Mobile (this hook) ──WebSocket──▶ Backend ──Live API──▶ Gemini
//                      ◀─text narrations─  ◀─text─
//
// Key improvements over the polling-based approach:
//   1. TRUE REAL-TIME: Frames stream continuously over a persistent WebSocket.
//      No HTTP request/response overhead per frame.
//   2. SUB-SECOND LATENCY: Gemini Live API processes frames incrementally.
//      Narrations arrive as they're generated, not after a full round-trip.
//   3. NON-BLOCKING TTS: Speech is fire-and-forget — we never block capture.
//   4. ADAPTIVE FRAME RATE: Captures at ~500ms baseline. Backend throttles
//      to prevent overload. "[no change]" responses are suppressed.
//   5. AUTO-RECONNECT: WebSocket reconnects with exponential backoff.
//   6. FALLBACK: If WebSocket fails to connect, falls back to REST polling.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { AssistantLanguage } from '../api/client';
import { API_BASE_URL, analyzeVisionImage } from '../api/client';
import { useProfileStore } from '../profile/store';
import { speakText, stopSpeaking } from '../speech/tts';
import type { AccessibilityNeed } from '../profile/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LiveStatus =
  | 'idle'
  | 'connecting'
  | 'running'
  | 'capturing'
  | 'analyzing'
  | 'speaking'
  | 'paused'
  | 'reconnecting'
  | 'error';

export interface LiveNarration {
  id: string;
  text: string;
  timestamp: number;
  /** Round-trip latency in ms (frame sent → narration received). */
  latencyMs?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Frame capture interval (ms). */
const CAPTURE_INTERVAL_MS = 500;
/** JPEG quality for captured frames. Lower = smaller payload = faster. */
const FRAME_QUALITY = 0.2;
/** Max narrations kept in the UI log. */
const MAX_NARRATIONS = 50;
/** WebSocket ping interval (ms). */
const WS_PING_INTERVAL_MS = 25_000;
/** Max reconnect attempts before giving up. */
const MAX_RECONNECT_ATTEMPTS = 8;
/** Initial backoff for reconnects (ms). */
const INITIAL_BACKOFF_MS = 500;
/**
 * Max base64 frame size to send (chars). Frames larger than this are silently
 * dropped client-side to prevent WebSocket "Max payload size exceeded" errors.
 * This must be less than the backend's maxPayload (5 MB) minus JSON overhead.
 */
const MAX_WS_FRAME_SIZE = 4 * 1024 * 1024; // 4 MB

// Fallback REST polling constants
const FALLBACK_FAST_INTERVAL_MS = 2000;
const FALLBACK_SLOW_INTERVAL_MS = 5000;
const FALLBACK_NO_CHANGE_THRESHOLD = 2;
const FALLBACK_API_TIMEOUT_MS = 15000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export type FrameCapturer = () => Promise<string | null>;

function wsUrl(): string {
  // Convert http(s):// to ws(s)://
  const base = API_BASE_URL.replace(/^http/, 'ws');
  return `${base}/api/v1/live`;
}

function isNoChange(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    lower.includes('[no change]') ||
    lower === 'no change' ||
    lower === 'no change.'
  );
}

// Fallback prompts for REST mode
const INITIAL_PROMPT = [
  'Live camera narration for a blind person.',
  'Describe scene in 2 short sentences.',
  'Objects, people, obstacles, text — with positions (left/right/ahead).',
].join(' ');

const DIFF_PROMPT = [
  'Live camera, blind user. Say ONLY what changed since last frame.',
  'If nothing changed reply exactly: [no change]',
  'Max 1-2 sentences. Obstacles, people, signs, movement. Positions.',
].join(' ');

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useLiveSession() {
  const language = useProfileStore((s) => s.language) as AssistantLanguage;
  const needs = useProfileStore((s) => s.needs) as AccessibilityNeed[];

  const [status, setStatus] = useState<LiveStatus>('idle');
  const [narrations, setNarrations] = useState<LiveNarration[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const [mode, setMode] = useState<'websocket' | 'fallback'>('websocket');

  // Refs — mutable state that doesn't trigger re-renders.
  const capturerRef = useRef<FrameCapturer | null>(null);
  const mountedRef = useRef(true);
  const runningRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const captureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const idCounter = useRef(0);
  const frameIndexRef = useRef(0);
  const lastFrameSentRef = useRef(0);

  // Fallback-mode refs
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackAbortRef = useRef<AbortController | null>(null);
  const fallbackHistoryRef = useRef<Array<{ role: 'user' | 'model'; text: string }>>([]);
  const fallbackNoChangeStreakRef = useRef(0);
  const fallbackLastReplyRef = useRef('');
  const useFallbackRef = useRef(false);

  const nextId = useCallback(() => {
    idCounter.current += 1;
    return `live-${Date.now().toString(36)}-${idCounter.current}`;
  }, []);

  // -----------------------------------------------------------------------
  // Cleanup on unmount
  // -----------------------------------------------------------------------
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runningRef.current = false;
      cleanupAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------------------------
  // App state — pause when app goes to background
  // -----------------------------------------------------------------------
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' && runningRef.current) {
        stopCapturing();
      } else if (nextState === 'active' && runningRef.current) {
        if (useFallbackRef.current) {
          startFallbackCapturing();
        } else {
          startCapturing();
        }
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------------------------
  // Cleanup helpers
  // -----------------------------------------------------------------------

  function cleanupAll() {
    stopCapturing();
    stopFallbackCapturing();
    closeWebSocket();
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    void stopSpeaking();
  }

  function closeWebSocket() {
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
    const ws = wsRef.current;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try { ws.close(); } catch { /* ignore */ }
      wsRef.current = null;
    }
  }

  // -----------------------------------------------------------------------
  // WebSocket connection
  // -----------------------------------------------------------------------

  function connectWebSocket() {
    if (!mountedRef.current || !runningRef.current) return;
    setStatus('connecting');

    const url = wsUrl();
    console.log(`[live] Connecting to ${url}`);

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      console.error('[live] WebSocket constructor failed:', err);
      switchToFallback();
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current || !runningRef.current) {
        ws.close();
        return;
      }
      console.log('[live] WebSocket connected');
      reconnectAttempts.current = 0;

      // Send start message with user's language and needs
      ws.send(JSON.stringify({
        type: 'start',
        language,
        needs,
      }));

      // Start ping/pong keepalive
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, WS_PING_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(typeof event.data === 'string' ? event.data : '{}');
      } catch {
        return;
      }

      switch (msg.type) {
        case 'ready':
          console.log('[live] Session ready — starting frame capture');
          setStatus('running');
          setError(null);
          startCapturing();
          break;

        case 'narration': {
          const text = String(msg.text ?? '').trim();
          if (!text || isNoChange(text)) break;

          const narration: LiveNarration = {
            id: nextId(),
            text,
            timestamp: typeof msg.ts === 'number' ? msg.ts : Date.now(),
            latencyMs: typeof msg.ts === 'number' ? Date.now() - msg.ts : undefined,
          };

          setNarrations((prev) => [narration, ...prev].slice(0, MAX_NARRATIONS));
          setError(null);
          setStatus('speaking');

          // Fire-and-forget TTS
          void stopSpeaking().then(() => {
            if (mountedRef.current) {
              void speakText(text, language);
            }
          });
          break;
        }

        case 'error':
          setError(String(msg.message ?? 'Unknown error'));
          break;

        case 'closed':
          console.log('[live] Server closed session:', msg.reason);
          break;

        case 'pong':
          // Keepalive response — ignore
          break;
      }
    };

    ws.onerror = () => {
      console.error('[live] WebSocket error');
      // onclose will fire next — handle reconnect there
    };

    ws.onclose = () => {
      console.log('[live] WebSocket closed');
      closeWebSocket();
      if (mountedRef.current && runningRef.current) {
        attemptReconnect();
      }
    };
  }

  function attemptReconnect() {
    reconnectAttempts.current++;
    if (reconnectAttempts.current > MAX_RECONNECT_ATTEMPTS) {
      console.warn('[live] Max reconnect attempts — switching to fallback');
      switchToFallback();
      return;
    }

    const backoff = Math.min(
      INITIAL_BACKOFF_MS * Math.pow(2, reconnectAttempts.current - 1),
      16000,
    );

    setStatus('reconnecting');
    setError(`Reconnecting (${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})…`);

    stopCapturing();
    reconnectTimerRef.current = setTimeout(() => {
      if (mountedRef.current && runningRef.current) {
        connectWebSocket();
      }
    }, backoff);
  }

  // -----------------------------------------------------------------------
  // Frame capture (WebSocket mode)
  // -----------------------------------------------------------------------

  function startCapturing() {
    stopCapturing();
    if (!mountedRef.current || !runningRef.current) return;

    captureTimerRef.current = setInterval(async () => {
      if (!mountedRef.current || !runningRef.current) return;
      if (!capturerRef.current) return;

      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      try {
        const base64 = await capturerRef.current();
        if (!base64 || !mountedRef.current || !runningRef.current) return;

        // Guard: drop frames that would exceed the backend's WebSocket maxPayload.
        // This prevents the "Max payload size exceeded" error on Samsung / high-res phones.
        if (base64.length > MAX_WS_FRAME_SIZE) {
          console.warn(`[live] Dropping oversized frame: ${(base64.length / 1024).toFixed(0)} KB`);
          return;
        }

        frameIndexRef.current++;
        setFrameCount(frameIndexRef.current);
        lastFrameSentRef.current = Date.now();

        ws.send(JSON.stringify({
          type: 'frame',
          data: base64,
        }));
      } catch {
        // Camera hiccup — skip this frame
      }
    }, CAPTURE_INTERVAL_MS);
  }

  function stopCapturing() {
    if (captureTimerRef.current) {
      clearInterval(captureTimerRef.current);
      captureTimerRef.current = null;
    }
  }

  // -----------------------------------------------------------------------
  // Fallback mode (REST polling — same as original implementation)
  // -----------------------------------------------------------------------

  function switchToFallback() {
    console.log('[live] Switching to REST fallback mode');
    useFallbackRef.current = true;
    setMode('fallback');
    closeWebSocket();
    setError(null);
    setStatus('running');
    fallbackHistoryRef.current = [];
    fallbackNoChangeStreakRef.current = 0;
    fallbackLastReplyRef.current = '';
    startFallbackCapturing();
  }

  function startFallbackCapturing() {
    stopFallbackCapturing();
    if (!mountedRef.current || !runningRef.current) return;
    void fallbackTick().then(() => scheduleFallbackNext());
  }

  function stopFallbackCapturing() {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    fallbackAbortRef.current?.abort();
  }

  async function fallbackTick() {
    if (!mountedRef.current || !runningRef.current) return;
    if (!capturerRef.current) return;

    setStatus('capturing');
    let base64: string | null = null;
    try {
      base64 = await capturerRef.current();
    } catch {
      // Skip frame
    }
    if (!base64 || !mountedRef.current || !runningRef.current) {
      if (mountedRef.current && runningRef.current) setStatus('running');
      return;
    }

    setStatus('analyzing');
    frameIndexRef.current++;
    setFrameCount(frameIndexRef.current);

    const isFirst = fallbackHistoryRef.current.length === 0;
    const prompt = isFirst ? INITIAL_PROMPT : DIFF_PROMPT;

    fallbackAbortRef.current?.abort();
    const controller = new AbortController();
    fallbackAbortRef.current = controller;

    try {
      const result = await analyzeVisionImage(
        {
          image: base64,
          mimeType: 'image/jpeg',
          message: prompt,
          history: fallbackHistoryRef.current.slice(-2),
          language,
          needs: needs.length > 0 ? needs : undefined,
        },
        FALLBACK_API_TIMEOUT_MS,
      );

      if (!mountedRef.current || !runningRef.current) return;
      const reply = result.reply.trim();

      if (isNoChange(reply) || reply === fallbackLastReplyRef.current) {
        fallbackNoChangeStreakRef.current++;
        if (mountedRef.current && runningRef.current) setStatus('running');
      } else {
        fallbackNoChangeStreakRef.current = 0;
        fallbackLastReplyRef.current = reply;
        fallbackHistoryRef.current = [
          { role: 'user' as const, text: prompt },
          { role: 'model' as const, text: reply },
        ];

        const narration: LiveNarration = {
          id: nextId(),
          text: reply,
          timestamp: Date.now(),
        };
        setNarrations((prev) => [narration, ...prev].slice(0, MAX_NARRATIONS));
        setError(null);
        setStatus('speaking');

        void stopSpeaking().then(() => {
          if (mountedRef.current) {
            void speakText(reply, language);
          }
        });
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      if (mountedRef.current) {
        setError('Error — retrying.');
        setStatus('error');
      }
    }
  }

  function scheduleFallbackNext() {
    if (!runningRef.current || !mountedRef.current) return;
    const interval =
      fallbackNoChangeStreakRef.current >= FALLBACK_NO_CHANGE_THRESHOLD
        ? FALLBACK_SLOW_INTERVAL_MS
        : FALLBACK_FAST_INTERVAL_MS;
    fallbackTimerRef.current = setTimeout(() => {
      if (!runningRef.current || !mountedRef.current) return;
      void fallbackTick().then(() => scheduleFallbackNext());
    }, interval);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  const setCapturer = useCallback((fn: FrameCapturer | null) => {
    capturerRef.current = fn;
  }, []);

  const say = useCallback(
    async (text: string) => {
      if (!mountedRef.current) return;
      await speakText(text, language);
    },
    [language],
  );

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    useFallbackRef.current = false;
    frameIndexRef.current = 0;
    reconnectAttempts.current = 0;
    setStatus('connecting');
    setError(null);
    setNarrations([]);
    setFrameCount(0);
    setMode('websocket');

    connectWebSocket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, needs]);

  const pause = useCallback(() => {
    runningRef.current = false;
    stopCapturing();
    stopFallbackCapturing();
    void stopSpeaking();
    setStatus('paused');
  }, []);

  const resume = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    setStatus('running');
    setError(null);

    if (useFallbackRef.current) {
      startFallbackCapturing();
    } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      startCapturing();
    } else {
      connectWebSocket();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, needs]);

  const stop = useCallback(() => {
    runningRef.current = false;
    cleanupAll();
    frameIndexRef.current = 0;
    fallbackHistoryRef.current = [];
    fallbackNoChangeStreakRef.current = 0;
    fallbackLastReplyRef.current = '';
    setStatus('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status,
    narrations,
    error,
    frameCount,
    language,
    mode,
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
