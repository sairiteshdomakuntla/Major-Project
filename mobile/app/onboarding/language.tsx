import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { OnboardingShell } from '../../src/components/OnboardingShell';
import { SelectionCard } from '../../src/components/SelectionCard';
import type { LanguageOption } from '../../src/profile/options';
import { LANGUAGE_OPTIONS } from '../../src/profile/options';
import type { SupportedLanguage } from '../../src/profile/types';
import { useProfileStore } from '../../src/profile/store';

type SupportedOption = LanguageOption & { value: SupportedLanguage };

const supported: SupportedOption[] = LANGUAGE_OPTIONS.filter(
  (o): o is SupportedOption => o.supported,
);
const upcoming: LanguageOption[] = LANGUAGE_OPTIONS.filter((o) => !o.supported);

export default function LanguageScreen() {
  const language = useProfileStore((s) => s.language);
  const setLanguage = useProfileStore((s) => s.setLanguage);

  return (
    <OnboardingShell
      step={3}
      totalSteps={5}
      title="Which language do you prefer?"
      subtitle="Pick one. More Indian languages are on the way."
      onBack={() => router.back()}
      onContinue={() => router.push('/onboarding/interaction')}
      continueLabel="Continue"
    >
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={`Preferred language, currently ${language}`}
        className="gap-3"
      >
        {supported.map((option) => (
          <SelectionCard
            key={option.value}
            testID={`language-${option.value}`}
            role="radio"
            title={option.label}
            badge={option.nativeLabel}
            selected={language === option.value}
            onPress={() => setLanguage(option.value)}
          />
        ))}
      </View>

      <View className="gap-3">
        <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Coming soon
        </Text>
        <View
          accessibilityLabel="Planned future languages, not yet available"
          className="gap-3"
        >
          {upcoming.map((option) => (
            <SelectionCard
              key={option.value}
              testID={`language-${option.value}`}
              role="radio"
              title={option.label}
              badge={option.nativeLabel}
              selected={false}
              disabled
              onPress={() => undefined}
            />
          ))}
        </View>
        <Text className="text-sm leading-5 text-slate-500">
          Tamil, Kannada, Malayalam, and Konkani are planned — shown here so
          you know what&apos;s ahead, not as working options.
        </Text>
      </View>
    </OnboardingShell>
  );
}
