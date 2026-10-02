import * as Speech from 'expo-speech';

export type TtsLanguage = 'en' | 'hi' | 'te' | 'ta' | 'kn' | 'ml' | 'kok';

const VOICE_LANGUAGE: Record<TtsLanguage, string> = {
  en:  'en',
  hi:  'hi',
  te:  'te',
  ta:  'ta',
  kn:  'kn',
  ml:  'ml',
  // Konkani has no dedicated TTS voice on most platforms — use Hindi as the
  // closest Devanagari fallback until a Konkani voice is available.
  kok: 'hi',
};

export interface SpeakCallbacks {
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (message: string) => void;
}

/**
 * iOS silences expo-speech when the physical ringer switch is off.
 * Setting the audio mode once forces playback through the speaker.
 *
 * expo-av contains a native module that is NOT available in Expo Go,
 * so we dynamic-import it and swallow failures gracefully.
 */
let audioModeConfigured = false;
async function ensureAudioMode(): Promise<void> {
  if (audioModeConfigured) return;
  try {
    const { Audio } = await import('expo-av');
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
    audioModeConfigured = true;
  } catch {
    // expo-av not available (Expo Go) — speech still works when ringer is on.
    audioModeConfigured = true; // don't retry every call
  }
}

/** Speaks text aloud, stopping anything currently playing first. */
export async function speakText(
  text: string,
  language: TtsLanguage,
  callbacks?: SpeakCallbacks,
): Promise<void> {
  const trimmed = text.trim();
  if (trimmed.length === 0) return;

  // Ensure iOS audio session is configured for audible playback.
  await ensureAudioMode();

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
