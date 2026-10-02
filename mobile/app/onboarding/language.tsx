import { router } from 'expo-router';
import { View } from 'react-native';
import { OnboardingShell } from '../../src/components/OnboardingShell';
import { SelectionCard } from '../../src/components/SelectionCard';
import { LANGUAGE_OPTIONS } from '../../src/profile/options';
import type { SupportedLanguage } from '../../src/profile/types';
import { useProfileStore } from '../../src/profile/store';

export default function LanguageScreen() {
  const language = useProfileStore((s) => s.language);
  const setLanguage = useProfileStore((s) => s.setLanguage);

  return (
    <OnboardingShell
      step={3}
      totalSteps={5}
      title="Which language do you prefer?"
      subtitle="English, Hindi, Telugu, Tamil, Kannada, Malayalam, and Konkani are all supported."
      onBack={() => router.back()}
      onContinue={() => router.push('/onboarding/interaction')}
      continueLabel="Continue"
    >
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={`Preferred language, currently ${language}`}
        className="gap-3"
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <SelectionCard
            key={option.value}
            testID={`language-${option.value}`}
            role="radio"
            title={option.label}
            badge={option.nativeLabel}
            selected={language === option.value}
            onPress={() => setLanguage(option.value as SupportedLanguage)}
          />
        ))}
      </View>
    </OnboardingShell>
  );
}
