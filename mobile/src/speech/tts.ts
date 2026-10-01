import * as Speech from 'expo-speech';

export type TtsLanguage = 'en' | 'hi' | 'te';

const VOICE_LANGUAGE: Record<TtsLanguage, string> = {
  en: 'en',
  hi: 'hi',
  te: 'te',
};

export interface SpeakCallbacks {
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (message: string) => void;
}

/** Speaks text aloud, stopping anything currently playing first. */
export async function speakText(
  text: string,
  language: TtsLanguage,
  callbacks?: SpeakCallbacks,
): Promise<void> {
  const trimmed = text.trim();
  if (trimmed.length === 0) return;
  try {
    await Speech.stop();
  } catch {
    // Ignore — nothing was playing.
  }
  return new Promise((resolve) => {
    Speech.speak(trimmed, {
      language: VOICE_LANGUAGE[language] ?? 'en',
      rate: 1.0,
      onDone: () => {
        callbacks?.onDone?.();
        resolve();
      },
      onStopped: () => {
        callbacks?.onStopped?.();
        resolve();
      },
      onError: (error) => {
        callbacks?.onError?.(
          error instanceof Error ? error.message : String(error),
        );
        resolve();
      },
    });
  });
}

export async function stopSpeaking(): Promise<void> {
  try {
    await Speech.stop();
  } catch {
    // Nothing to stop.
  }
}

export async function isSpeaking(): Promise<boolean> {
  try {
    return await Speech.isSpeakingAsync();
  } catch {
    return false;
  }
}
