import type {
  AccessibilityNeed,
  AppLanguage,
  InputMode,
  OutputMode,
  SupportedLanguage,
} from './types';

export interface NeedOption {
  value: AccessibilityNeed;
  title: string;
  description: string;
}

export const NEED_OPTIONS: NeedOption[] = [
  {
    value: 'visual',
    title: 'Seeing the screen',
    description: 'Blindness or low vision — spoken feedback and clear layouts',
  },
  {
    value: 'hearing',
    title: 'Hearing audio',
    description: 'Deaf or hard of hearing — visual feedback and captions',
  },
  {
    value: 'speech',
    title: 'Speaking or voice input',
    description: 'Difficulty speaking — typing and camera-first options',
  },
  {
    value: 'general',
    title: 'General ease of use',
    description: 'Larger touch targets, simpler layouts, less clutter',
  },
];

export interface LanguageOption {
  value: AppLanguage;
  label: string;
  nativeLabel: string;
  supported: boolean;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: 'en',  label: 'English',   nativeLabel: 'English',    supported: true },
  { value: 'hi',  label: 'Hindi',     nativeLabel: 'हिन्दी',      supported: true },
  { value: 'te',  label: 'Telugu',    nativeLabel: 'తెలుగు',     supported: true },
  { value: 'ta',  label: 'Tamil',     nativeLabel: 'தமிழ்',      supported: true },
  { value: 'kn',  label: 'Kannada',   nativeLabel: 'ಕನ್ನಡ',     supported: true },
  { value: 'ml',  label: 'Malayalam', nativeLabel: 'മലയാളം',  supported: true },
  { value: 'kok', label: 'Konkani',   nativeLabel: 'कोंकणी',     supported: true },
];

export function isSupportedLanguage(
  value: AppLanguage,
): value is SupportedLanguage {
  return LANGUAGE_OPTIONS.some((o) => o.value === value && o.supported);
}

export function futureLanguages(): LanguageOption[] {
  // All languages are now supported; this returns empty.
  return [];
}

export function languageLabel(value: SupportedLanguage): string {
  const found = LANGUAGE_OPTIONS.find((o) => o.value === value);
  return found ? `${found.label} · ${found.nativeLabel}` : value;
}

export interface ModeOption<T extends string> {
  value: T;
  title: string;
  description: string;
}

export const INPUT_MODE_OPTIONS: ModeOption<InputMode>[] = [
  { value: 'voice', title: 'Voice', description: 'Speak to the assistant' },
  { value: 'text', title: 'Text', description: 'Type to the assistant' },
  { value: 'camera', title: 'Camera', description: 'Point at things to understand them' },
];

export const OUTPUT_MODE_OPTIONS: ModeOption<OutputMode>[] = [
  { value: 'speech', title: 'Speech', description: 'Hear responses read aloud' },
  { value: 'text', title: 'Text', description: 'Read responses on screen' },
];

export function needTitle(value: AccessibilityNeed): string {
  return NEED_OPTIONS.find((o) => o.value === value)?.title ?? value;
}
