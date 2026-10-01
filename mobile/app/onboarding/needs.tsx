import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { OnboardingShell } from '../../src/components/OnboardingShell';
import { SelectionCard } from '../../src/components/SelectionCard';
import { NEED_OPTIONS } from '../../src/profile/options';
import { useProfileStore } from '../../src/profile/store';

export default function NeedsScreen() {
  const needs = useProfileStore((s) => s.needs);
  const toggleNeed = useProfileStore((s) => s.toggleNeed);

  return (
    <OnboardingShell
      step={2}
      totalSteps={5}
      title="What should we adapt for?"
      subtitle="Choose any that apply — or skip. Nothing here is required, and you can change it anytime."
      onBack={() => router.back()}
      onContinue={() => router.push('/onboarding/language')}
      continueLabel={needs.length > 0 ? 'Continue' : 'Skip for now'}
    >
      <View
        accessibilityRole="list"
        accessibilityLabel={`Accessibility needs, ${needs.length} selected`}
        className="gap-3"
      >
        {NEED_OPTIONS.map((option) => (
          <SelectionCard
            key={option.value}
            testID={`need-${option.value}`}
            title={option.title}
            description={option.description}
            selected={needs.includes(option.value)}
            onPress={() => toggleNeed(option.value)}
          />
        ))}
      </View>
      <Text className="text-sm leading-5 text-slate-500">
        Your choices stay on this device and only shape how the app presents
        information.
      </Text>
    </OnboardingShell>
  );
}
