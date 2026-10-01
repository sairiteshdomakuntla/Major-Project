import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProfileStore } from '../src/profile/store';

/**
 * First-launch gate. Waits for the persisted profile to hydrate, then
 * routes first-time users to onboarding and returning users to home —
 * so onboarding never shows repeatedly.
 */
export default function GateScreen() {
  const hydrated = useProfileStore((s) => s.hydrated);
  const completed = useProfileStore((s) => s.onboardingCompleted);

  useEffect(() => {
    if (!hydrated) return;
    router.replace(completed ? '/home' : '/onboarding/welcome');
  }, [hydrated, completed]);

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-slate-900">
      <View className="items-center gap-3">
        <ActivityIndicator
          size="large"
          color="#38BDF8"
          accessibilityLabel="Loading your profile"
        />
        <Text className="text-base text-slate-400">AgentBridge</Text>
      </View>
    </SafeAreaView>
  );
}
