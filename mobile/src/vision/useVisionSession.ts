import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssistantLanguage, VisionHistoryTurn } from '../api/client';
import { ApiError, analyzeVisionImage } from '../api/client';
import { useProfileStore } from '../profile/store';
import { speakText, stopSpeaking } from '../speech/tts';
import {
  SttError,
  ensureSttPermissions,
  isSttAvailable,
  listenOnce,
  sttMessage,
} from '../speech/stt';
import { MAX_VISION_CONTEXT_TURNS, type VisionMessage } from './types';
import { matchVoiceCommand } from './voiceCommands';

export const DESCRIBE_PROMPT =
  'Describe this image for a blind person: what is in front of the camera, key objects and their positions, any people, and quote any readable text exactly.';
export const READ_PROMPT =
  'Read all visible text in this image. Quote it exactly, top to bottom, then briefly say what kind of object the text is on.';
export const findPrompt = (target: string) =>
  `Is there "${target}" visible in this image? If yes, say exactly where it is (left, right, center, near, far). If no, say what similar objects you do see.`;

/** Captures a photo; provided by the screen once the camera is ready. */
export type Capturer = () => Promise<string | null>;

export type VisionStatus =
  | 'idle'
  | 'listening'
  | 'capturing'
  | 'analyzing'
  | 'speaking'
  | 'error';

function toHistory(messages: VisionMessage[]): VisionHistoryTurn[] {
  return messages
    .filter((m) => m.status === 'sent' && m.text.length > 0)
    .slice(-MAX_VISION_CONTEXT_TURNS)
    .map((m) => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      text: m.text,
    }));
}

export function friendlyVisionError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.statusCode === 429) {
      return 'The assistant is busy. Wait a moment, then try again.';
    }
    if (err.statusCode === 503) {
      return 'The assistant is not set up yet. Please try again later.';
    }
    if (err.message.toLowerCase().includes('timed out')) {
      return 'Analyzing took too long. Try a smaller photo or check your connection.';
    }
    return err.message;
  }
  return 'Something went wrong. Check your connection and try again.';
}

interface AnalyzeVars {
  image: string;
  prompt: string;
  context: VisionHistoryTurn[];
  /** Spoken + shown label of what was requested, e.g. "Describing surroundings". */
  requestLabel: string;
}

/**
 * Voice-first vision session. Owns the image (memory only), the
 * conversation, TTS narration, and voice-command handling. The screen owns
 * the CameraView and registers a capturer.
 */
export function useVisionSession() {
  const language = useProfileStore((s) => s.language);
  const needs = useProfileStore((s) => s.needs);
  const outputModes = useProfileStore((s) => s.outputModes);
  const voiceOutput = outputModes.includes('speech');

  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [messages, setMessages] = useState<VisionMessage[]>([]);
  const [status, setStatus] = useState<VisionStatus>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [sttSupported, setSttSupported] = useState<boolean | null>(null);

  const idCounter = useRef(0);
  const capturerRef = useRef<Capturer | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    void isSttAvailable().then((v) => {
      if (mountedRef.current) setSttSupported(v);
    });
    return () => {
      mountedRef.current = false;
      void stopSpeaking();
    };
  }, []);

  const nextId = useCallback(() => {
    idCounter.current += 1;
    return `vmsg-${Date.now().toString(36)}-${idCounter.current}`;
  }, []);

  const say = useCallback(
    async (text: string) => {
      if (!voiceOutput) return;
      if (!mountedRef.current) return;
      setStatus('speaking');
      await speakText(text, language, {
        onDone: () => mountedRef.current && setStatus('idle'),
        onStopped: () => mountedRef.current && setStatus('idle'),
        onError: () => mountedRef.current && setStatus('idle'),
      });
    },
    [language, voiceOutput],
  );

  const setCapturer = useCallback((fn: Capturer | null) => {
    capturerRef.current = fn;
  }, []);

  const mutation = useMutation({
    mutationFn: (vars: AnalyzeVars) =>
      analyzeVisionImage({
        image: vars.image,
        mimeType: 'image/jpeg',
        message: vars.prompt,
        history: vars.context,
        language,
        needs: needs.length > 0 ? needs : undefined,
      }),
    onSuccess: (data, vars) => {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'assistant',
          text: data.reply,
          status: 'sent' as const,
        },
      ]);
      setStatus('idle');
      setNotice(null);
      void say(data.reply);
    },
    onError: (err, vars) => {
      const message = friendlyVisionError(err);
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'assistant',
          text: '',
          status: 'error' as const,
          error: message,
        },
      ]);
      setStatus('error');
      setNotice(message);
      void say(message);
    },
  });

  const analyzeWithImage = useCallback(
    (image: string, prompt: string, requestLabel: string) => {
      if (mutation.isPending) return;
      setImageBase64(image);
      const context = toHistory(messages);
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'user', text: requestLabel, status: 'sent' },
      ]);
      setStatus('analyzing');
      setNotice(null);
      void say(requestLabel);
      mutation.mutate({ image, prompt, context, requestLabel });
    },
    [messages, mutation, nextId, say],
  );

  const capturePhoto = useCallback(async (): Promise<string | null> => {
    const capturer = capturerRef.current;
    if (!capturer) {
      const message = 'The camera is not ready yet. Please wait a moment.';
      setNotice(message);
      void say(message);
      return null;
    }
    setStatus('capturing');
    try {
      const base64 = await capturer();
      if (!base64) {
        const message = 'Could not take the photo. Try again.';
        setStatus('error');
        setNotice(message);
        void say(message);
        return null;
      }
      return base64;
    } catch {
      const message = 'The camera failed. Check the lens and try again.';
      setStatus('error');
      setNotice(message);
      void say(message);
      return null;
    }
  }, [say]);

  const describeSurroundings = useCallback(async () => {
    const image = await capturePhoto();
    if (image) analyzeWithImage(image, DESCRIBE_PROMPT, 'Describing surroundings');
  }, [analyzeWithImage, capturePhoto]);

  const readText = useCallback(async () => {
    const image = await capturePhoto();
    if (image) analyzeWithImage(image, READ_PROMPT, 'Reading text in view');
  }, [analyzeWithImage, capturePhoto]);

  const findObject = useCallback(
    async (target: string) => {
      const image = await capturePhoto();
      if (image) {
        analyzeWithImage(image, findPrompt(target), `Looking for ${target}`);
      }
    },
    [analyzeWithImage, capturePhoto],
  );

  /** Ask about the current photo without capturing again. */
  const askFollowUp = useCallback(
    (rawText: string) => {
      const text = rawText.trim().slice(0, 4000);
      if (text.length === 0 || mutation.isPending) return;
      if (!imageBase64) {
        const message = 'Take a photo first, then ask about it.';
        setNotice(message);
        void say(message);
        return;
      }
      analyzeWithImage(imageBase64, text, text);
    },
    [analyzeWithImage, imageBase64, mutation.isPending, say],
  );

  const retry = useCallback(() => {
    if (mutation.isPending) return;
    const withoutErrors = messages.filter((m) => m.status !== 'error');
    const lastUser = [...withoutErrors].reverse().find((m) => m.role === 'user');
    if (!lastUser || !imageBase64) return;
    setMessages(withoutErrors);
    setStatus('analyzing');
    mutation.mutate({
      image: imageBase64,
      prompt: lastUser.text,
      context: toHistory(withoutErrors.slice(0, -1)),
      requestLabel: lastUser.text,
    });
  }, [imageBase64, messages, mutation]);

  const repeatLast = useCallback(() => {
    const last = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant' && m.status === 'sent' && m.text);
    if (last) {
      void say(last.text);
    } else {
      void say('There is nothing to repeat yet.');
    }
  }, [messages, say]);

  const stopAll = useCallback(() => {
    void stopSpeaking();
    setStatus('idle');
  }, []);

  const newPhoto = useCallback(() => {
    void stopSpeaking();
    mutation.reset();
    setImageBase64(null);
    setMessages([]);
    setNotice(null);
    setStatus('idle');
    void say('Ready for a new photo.');
  }, [mutation, say]);

  const listenForCommand = useCallback(async () => {
    if (listening || mutation.isPending) return;
    const available = await isSttAvailable();
    setSttSupported(available);
    if (!available) {
      const message =
        'Voice input needs the development build. Use the buttons below for now.';
      setNotice(message);
      void say(message);
      return;
    }
    const granted = await ensureSttPermissions();
    if (!granted) {
      const message =
        'Microphone permission was denied. Allow it in system settings, or use the buttons.';
      setNotice(message);
      void say(message);
      return;
    }
    setListening(true);
    setStatus('listening');
    setNotice('Listening… speak now.');
    try {
      const transcript = await listenOnce({ language });
      const action = matchVoiceCommand(transcript);
      setNotice(`Heard: “${transcript}”`);
      switch (action.kind) {
        case 'stop':
          stopAll();
          break;
        case 'repeat':
          repeatLast();
          break;
        case 'describe':
          await describeSurroundings();
          break;
        case 'read':
          await readText();
          break;
        case 'open-camera':
          await say('The camera is open. Aim and say take a photo.');
          setStatus('idle');
          break;
        case 'capture':
          await describeSurroundings();
          break;
        case 'find':
          await findObject(action.target);
          break;
        case 'followup':
          askFollowUp(action.text);
          break;
      }
    } catch (err) {
      const message =
        err instanceof SttError ? sttMessage(err.kind) : sttMessage('unknown');
      setNotice(message);
      setStatus('error');
      void say(message);
    } finally {
      if (mountedRef.current) {
        setListening(false);
        setStatus((s) => (s === 'listening' ? 'idle' : s));
      }
    }
  }, [
    askFollowUp,
    describeSurroundings,
    findObject,
    language,
    listening,
    mutation.isPending,
    readText,
    repeatLast,
    say,
    stopAll,
  ]);

  return {
    imageBase64,
    messages: messages.filter((m) => !(m.role === 'user' && m.status === 'sent' && m.text.length === 0)),
    status,    notice,
    listening,
    sttSupported,
    hasPhoto: imageBase64 !== null,
    isWorking: mutation.isPending || status === 'capturing',
    setCapturer,
    listenForCommand,
    describeSurroundings,
    readText,
    findObject,
    askFollowUp,
    retry,
    repeatLast,
    stopAll,
    newPhoto,
    language,
    voiceOutput,
    say,
  };
}
