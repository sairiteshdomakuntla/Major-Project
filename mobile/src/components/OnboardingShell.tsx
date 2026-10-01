import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface OnboardingShellProps {
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  continueHint?: string;
}

/**
 * Shared onboarding frame: progress indication, heading, scrollable
 * content, and Back / Continue navigation with accessible touch targets.
 */
export function OnboardingShell({
  step,
  totalSteps,
  title,
  subtitle,
  children,
  onBack,
  onContinue,
  continueLabel = 'Continue',
  continueDisabled = false,
  continueHint,
}: OnboardingShellProps) {
  const progress = Math.min(1, Math.max(0, step / totalSteps));

  return (
    <SafeAreaView className="flex-1 bg-slate-900">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 p-6 pb-10"
        keyboardShouldPersistTaps="handled"
      >
        {/* Progress indication */}
        <View className="gap-2">
          <Text
            accessibilityRole="text"
            className="text-xs font-medium uppercase tracking-widest text-slate-400"
          >
            Step {step} of {totalSteps}
          </Text>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={`Setup progress: step ${step} of ${totalSteps}`}
            accessibilityValue={{ min: 0, max: totalSteps, now: step }}
            className="h-2 w-full overflow-hidden rounded-full bg-slate-700"
          >
            <View
              importantForAccessibility="no"
              className="h-full rounded-full bg-sky-400"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </View>
        </View>

        {/* Heading */}
        <View className="gap-1.5">
          <Text
            accessibilityRole="header"
            className="text-2xl font-bold text-slate-50"
          >
            {title}
          </Text>
          {subtitle ? (
            <Text className="text-base leading-6 text-slate-400">{subtitle}</Text>
          ) : null}
        </View>

        {/* Step content */}
        <View className="gap-3">{children}</View>

        {/* Navigation */}
        <View className="mt-2 gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={continueLabel}
            accessibilityHint={continueHint}
            accessibilityState={{ disabled: continueDisabled }}
            disabled={continueDisabled}
            onPress={onContinue}
            className={`min-h-[52px] items-center justify-center rounded-2xl px-4 active:opacity-80 ${
              continueDisabled ? 'bg-slate-700 opacity-60' : 'bg-sky-400'
            }`}
          >
            <Text
              className={`text-base font-bold ${continueDisabled ? 'text-slate-400' : 'text-slate-900'}`}
            >
              {continueLabel}
            </Text>
          </Pressable>

          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back to previous step"
              onPress={onBack}
              className="min-h-[48px] items-center justify-center rounded-2xl border border-slate-600 px-4 active:opacity-80"
            >
              <Text className="text-base font-semibold text-slate-200">Back</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
