import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { OnboardingShell } from '../../src/components/OnboardingShell';
import {
  languageLabel,
  needTitle,
} from '../../src/profile/options';
import { useProfileStore } from '../../src/profile/store';

function modeLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function ReviewScreen() {
  const needs = useProfileStore((s) => s.needs);
  const language = useProfileStore((s) => s.language);
  const inputModes = useProfileStore((s) => s.inputModes);
  const outputModes = useProfileStore((s) => s.outputModes);
  const onboardingCompleted = useProfileStore((s) => s.onboardingCompleted);
  const completeOnboarding = useProfileStore((s) => s.completeOnboarding);

  const rows: { label: string; value: string }[] = [
    {
      label: 'Accessibility needs',
      value:
        needs.length > 0 ? needs.map(needTitle).join(', ') : 'None selected',
    },
    { label: 'Language', value: languageLabel(language) },
    { label: 'Input', value: inputModes.map(modeLabel).join(', ') },
    { label: 'Output', value: outputModes.map(modeLabel).join(', ') },
  ];

  return (
    <OnboardingShell
      step={5}
      totalSteps={5}
      title="Review your setup"
      subtitle="Everything stays on this device. You can change these anytime from Home."
      onBack={() => router.back()}
      onContinue={() => {
        completeOnboarding();
        router.replace('/home');
      }}
      continueLabel={onboardingCompleted ? 'Save & go home' : 'Finish setup'}
    >
      <View
        accessibilityRole="list"
        accessibilityLabel="Your accessibility profile summary"
        className="gap-px overflow-hidden rounded-2xl bg-slate-700"
      >
        {rows.map((row) => (
          <View
            key={row.label}
            accessibilityLabel={`${row.label}: ${row.value}`}
            className="gap-0.5 bg-slate-800 p-4"
          >
            <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              {row.label}
            </Text>
            <Text className="text-base font-medium text-slate-50">
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </OnboardingShell>
  );
}
