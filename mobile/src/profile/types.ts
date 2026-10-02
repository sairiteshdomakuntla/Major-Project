// Accessibility profile types. Pure data — no UI imports.
// Only stores what is needed to personalize the experience:
// functional needs, preferred language, and interaction preferences.

/** Functional accessibility needs. Multi-select, all optional. */
export type AccessibilityNeed =
  | 'visual'
  | 'hearing'
  | 'speech'
  | 'general';

/** Fully supported languages (v2). */
export type SupportedLanguage =
  | 'en'
  | 'hi'
  | 'te'
  | 'ta'
  | 'kn'
  | 'ml'
  | 'kok';

/** No more future languages — all are now supported. */
export type FutureLanguage = never;

export type AppLanguage = SupportedLanguage;

/** Preferred ways to give input. Multi-select preferences, not restrictions. */
export type InputMode = 'voice' | 'text' | 'camera';

/** Preferred ways to receive output. Multi-select preferences, not restrictions. */
export type OutputMode = 'speech' | 'text';

export interface AccessibilityProfile {
  needs: AccessibilityNeed[];
  language: SupportedLanguage;
  inputModes: InputMode[];
  outputModes: OutputMode[];
  onboardingCompleted: boolean;
}

export const DEFAULT_PROFILE: AccessibilityProfile = {
  needs: [],
  language: 'en',
  inputModes: ['text'],
  outputModes: ['text'],
  onboardingCompleted: false,
};
