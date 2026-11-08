import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { OnboardingShell } from '../../src/components/OnboardingShell';
import { Icon } from '../../src/components/Icon';
import { useProfileStore } from '../../src/profile/store';

const HIGHLIGHTS = [
  {
    title: 'Understands your needs',
    description: 'Adapts for vision, hearing, speech, or general ease of use.',
  },
  {
    title: 'Speaks your language',
    description: 'Starting with English, Hindi, and Telugu.',
  },
  {
    title: 'Works your way',
    description: 'Use voice, text, or camera — hear back, or read.',
  },
];

export default function WelcomeScreen() {
  const completeOnboarding = useProfileStore((s) => s.completeOnboarding);

  return (
    <OnboardingShell
      step={1}
      totalSteps={5}
      title="Welcome to AgentBridge"
      subtitle="Your accessible AI companion. Let's set things up your way — it takes less than a minute."
      onContinue={() => router.push('/onboarding/needs')}
      continueLabel="Get started"
    >
      <View className="gap-3" accessibilityRole="list">
        {HIGHLIGHTS.map((h) => (
          <View
            key={h.title}
            accessibilityLabel={`${h.title}. ${h.description}`}
            className="flex-row items-start gap-3 rounded-[14px] border border-[#E5E7EB] bg-white p-4"
          >
            <View
              importantForAccessibility="no"
              className="mt-0.5 h-6 w-6 items-center justify-center rounded-full bg-[#0F766E]"
            >
              <Icon name="check" size={14} color="#FFFFFF" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-base font-semibold text-[#111827]">
                {h.title}
              </Text>
              <Text className="text-sm leading-5 text-[#6B7280]">
                {h.description}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Skip setup for now and explore with default settings"
        onPress={() => {
          completeOnboarding();
          router.replace('/home');
        }}
        className="min-h-[48px] items-center justify-center rounded-[12px] px-4 active:opacity-80"
      >
        <Text className="text-base font-semibold text-[#0F766E]">
          Skip for now
        </Text>
      </Pressable>
    </OnboardingShell>
  );
}
