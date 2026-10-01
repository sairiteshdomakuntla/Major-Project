import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  AccessibilityNeed,
  InputMode,
  OutputMode,
  SupportedLanguage,
} from './types';
import { DEFAULT_PROFILE } from './types';

const STORAGE_KEY = 'agentbridge-profile-v1';

interface ProfileActions {
  toggleNeed: (need: AccessibilityNeed) => void;
  setLanguage: (language: SupportedLanguage) => void;
  toggleInputMode: (mode: InputMode) => void;
  toggleOutputMode: (mode: OutputMode) => void;
  completeOnboarding: () => void;
  /** Development-only: clears the profile and shows onboarding again. */
  resetOnboarding: () => void;
  setHydrated: () => void;
}

type ProfileStore = typeof DEFAULT_PROFILE & {
  /** True once persisted state has been restored from storage. */
  hydrated: boolean;
} & ProfileActions;

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set) => ({
      ...DEFAULT_PROFILE,
      hydrated: false,

      toggleNeed: (need) =>
        set((s) => ({ needs: toggle(s.needs, need) })),
      setLanguage: (language) => set({ language }),
      toggleInputMode: (mode) =>
        set((s) => ({ inputModes: toggle(s.inputModes, mode) })),
      toggleOutputMode: (mode) =>
        set((s) => ({ outputModes: toggle(s.outputModes, mode) })),
      completeOnboarding: () => set({ onboardingCompleted: true }),
      resetOnboarding: () =>
        set({ ...DEFAULT_PROFILE, onboardingCompleted: false }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      // Never persist the transient hydration flag itself.
      partialize: (s) => ({
        needs: s.needs,
        language: s.language,
        inputModes: s.inputModes,
        outputModes: s.outputModes,
        onboardingCompleted: s.onboardingCompleted,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (!error) state?.setHydrated();
        else state?.setHydrated();
      },
    },
  ),
);

/** Convenience selector: has the user finished onboarding at least once? */
export function selectOnboardingCompleted(s: ProfileStore): boolean {
  return s.onboardingCompleted;
}
