import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { OnboardingShell } from '../../src/components/OnboardingShell';
import { SelectionCard } from '../../src/components/SelectionCard';
import {
  INPUT_MODE_OPTIONS,
  OUTPUT_MODE_OPTIONS,
} from '../../src/profile/options';
import { useProfileStore } from '../../src/profile/store';

export default function InteractionScreen() {
  const inputModes = useProfileStore((s) => s.inputModes);
  const outputModes = useProfileStore((s) => s.outputModes);
  const toggleInputMode = useProfileStore((s) => s.toggleInputMode);
  const toggleOutputMode = useProfileStore((s) => s.toggleOutputMode);

  const valid = inputModes.length > 0 && outputModes.length > 0;

  return (
    <OnboardingShell
      step={4}
      totalSteps={5}
      title="How do you want to interact?"
      subtitle="These are preferences, not restrictions — you can always switch later."
      onBack={() => router.back()}
      onContinue={() => router.push('/onboarding/review')}
      continueLabel="Review my setup"
      continueDisabled={!valid}
      continueHint={
        valid
          ? undefined
          : 'Select at least one input mode and one output mode'
      }
    >
      <View className="gap-3">
        <Text
          accessibilityRole="header"
          className="text-sm font-semibold uppercase tracking-widest text-slate-400"
        >
          I want to use
        </Text>
        <View
          accessibilityLabel={`Input modes, ${inputModes.length} selected`}
          className="gap-3"
        >
          {INPUT_MODE_OPTIONS.map((option) => (
            <SelectionCard
              key={option.value}
              testID={`input-${option.value}`}
              title={option.title}
              description={option.description}
              selected={inputModes.includes(option.value)}
              onPress={() => toggleInputMode(option.value)}
            />
          ))}
        </View>
      </View>

      <View className="gap-3">
        <Text
          accessibilityRole="header"
          className="text-sm font-semibold uppercase tracking-widest text-slate-400"
        >
          I want responses as
        </Text>
        <View
          accessibilityLabel={`Output modes, ${outputModes.length} selected`}
          className="gap-3"
        >
          {OUTPUT_MODE_OPTIONS.map((option) => (
            <SelectionCard
              key={option.value}
              testID={`output-${option.value}`}
              title={option.title}
              description={option.description}
              selected={outputModes.includes(option.value)}
              onPress={() => toggleOutputMode(option.value)}
            />
          ))}
        </View>
      </View>
    </OnboardingShell>
  );
}
