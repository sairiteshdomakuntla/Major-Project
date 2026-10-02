import Constants from 'expo-constants';
import type { SupportedLanguage } from '../profile/types';

/** BCP-47 locales for on-device recognition. */
export const STT_LOCALES: Record<SupportedLanguage, string> = {
  en:  'en-US',
  hi:  'hi-IN',
  te:  'te-IN',
  ta:  'ta-IN',
  kn:  'kn-IN',
  ml:  'ml-IN',
  // No dedicated BCP-47 tag for Konkani — fall back to Marathi locale which
  // shares the Devanagari script and is the closest available option.
  kok: 'mr-IN',
};

export type SttFailure =
  | 'unavailable'
  | 'permission-denied'
  | 'no-speech'
  | 'network'
  | 'busy'
  | 'timeout'
  | 'unknown';

export class SttError extends Error {
  kind: SttFailure;
  constructor(kind: SttFailure, message: string) {
    super(message);
    this.name = 'SttError';
    this.kind = kind;
  }
}

type SttModule = typeof import('expo-speech-recognition');

let cachedModule: SttModule | null | undefined;

/**
 * Lazy-loads the native speech module on first use.
 * Inside Expo Go (`appOwnership === 'expo'`) the native side can never
 * exist, so we return null without even evaluating the package — Metro
 * never touches `requireNativeModule` and no redbox can occur. Outside
 * Expo Go (dev build / standalone) we load it, still guarded by try/catch.
 * A static top-level import would break the whole route in Expo Go.
 */
async function getModule(): Promise<SttModule | null> {
  if (cachedModule !== undefined) return cachedModule;
  try {
    if (Constants.appOwnership === 'expo') {
      cachedModule = null;
      return cachedModule;
    }
    cachedModule = await import('expo-speech-recognition');
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

/**
 * True when the native recognizer exists and can run.
 * In Expo Go the native module is absent — every path below treats that
 * as "unavailable" so the app degrades to touch controls instead of crashing.
 */
export async function isSttAvailable(): Promise<boolean> {
  try {
    const mod = await getModule();
    if (!mod) return false;
    return mod.ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export async function ensureSttPermissions(): Promise<boolean> {
  try {
    const mod = await getModule();
    if (!mod) return false;
    const current =
      await mod.ExpoSpeechRecognitionModule.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const requested =
      await mod.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

const ERROR_MESSAGE: Record<SttFailure, string> = {
  unavailable: 'Voice input is not available on this device or build.',
  'permission-denied':
    'Microphone permission was denied. Allow it in system settings to use voice commands.',
  'no-speech': 'I did not hear anything. Try again, speaking clearly.',
  network: 'Speech recognition needs an internet connection right now.',
  busy: 'The listener is busy. Wait a moment and try again.',
  timeout: 'Listening timed out. Try again.',
  unknown: 'Voice input failed. You can use the buttons instead.',
};

export function sttMessage(kind: SttFailure): string {
  return ERROR_MESSAGE[kind];
}

function mapErrorCode(code: string | undefined): SttFailure {
  switch (code) {
    case 'not-allowed':
      return 'permission-denied';
    case 'no-speech':
      return 'no-speech';
    case 'network':
      return 'network';
    case 'busy':
      return 'busy';
    default:
      return 'unknown';
  }
}

export interface ListenOnceOptions {
  language: SupportedLanguage;
  /** Safety net in ms; the recognizer usually ends on its own first. */
  timeoutMs?: number;
}

/**
 * Listens once and resolves with the final transcript.
 * Rejects with SttError on any failure — callers announce sttMessage(kind).
 */
export function listenOnce({
  language,
  timeoutMs = 15000,
}: ListenOnceOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const subscriptions: { remove: () => void }[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      subscriptions.forEach((s) => {
        try {
          s.remove();
        } catch {
          // Ignore teardown errors.
        }
      });
      if (timer) clearTimeout(timer);
      void getModule().then((mod) => {
        try {
          mod?.ExpoSpeechRecognitionModule.abort();
        } catch {
          // Already ended.
        }
      });
    };
    const settleResolve = (transcript: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(transcript);
    };
    const settleReject = (kind: SttFailure) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new SttError(kind, ERROR_MESSAGE[kind]));
    };

    const begin = async () => {
      const mod = await getModule();
      if (!mod) {
        settleReject('unavailable');
        return;
      }
      timer = setTimeout(() => settleReject('timeout'), timeoutMs);
      try {
        subscriptions.push(
          mod.ExpoSpeechRecognitionModule.addListener('result', (event) => {
            const transcript = event.results?.[0]?.transcript?.trim() ?? '';
            if (event.isFinal && transcript.length > 0) {
              settleResolve(transcript);
            }
          }),
          mod.ExpoSpeechRecognitionModule.addListener('error', (event) => {
            settleReject(mapErrorCode(event.error));
          }),
          mod.ExpoSpeechRecognitionModule.addListener('end', () => {
            settleReject('no-speech');
          }),
        );
        mod.ExpoSpeechRecognitionModule.start({
          lang: STT_LOCALES[language] ?? 'en-US',
          interimResults: false,
          continuous: false,
          maxAlternatives: 1,
        });
      } catch {
        settleReject('unavailable');
      }
    };

    void begin();
  });
}

export function stopListening(): void {
  void getModule().then((mod) => {
    try {
      mod?.ExpoSpeechRecognitionModule.stop();
    } catch {
      // Not listening.
    }
  });
}
