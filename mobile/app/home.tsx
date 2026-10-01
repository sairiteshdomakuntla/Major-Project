import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConnectivityCard } from '../src/components/ConnectivityCard';
import { languageLabel, needTitle } from '../src/profile/options';
import type { SupportedLanguage } from '../src/profile/types';
import { useProfileStore } from '../src/profile/store';

const GREETINGS: Record<SupportedLanguage, { title: string; subtitle: string }> = {
  // Short greetings only — full in-app translation arrives with later features.
  en: { title: 'Welcome', subtitle: 'Your accessible AI companion.' },
  hi: { title: 'नमस्ते', subtitle: 'आपका सुलभ AI साथी।' },
  te: { title: 'నమస్కారం', subtitle: 'మీ సులభ AI తోడు.' },
};

function Chip({ label }: { label: string }) {
  return (
    <View
      accessibilityLabel={label}
      className="rounded-full bg-slate-700 px-3 py-1.5"
    >
      <Text className="text-xs font-semibold text-slate-100">{label}</Text>
    </View>
  );
}

const COMING_NEXT = [
  {
    title: 'Understand images',
    description: 'Camera help with reading text and describing scenes.',
  },
  {
    title: 'Translate',
    description: 'Move between Indian languages with ease.',
  },
];

export default function HomeScreen() {
  const needs = useProfileStore((s) => s.needs);
  const language = useProfileStore((s) => s.language);
  const inputModes = useProfileStore((s) => s.inputModes);
  const outputModes = useProfileStore((s) => s.outputModes);
  const resetOnboarding = useProfileStore((s) => s.resetOnboarding);

  const greeting = GREETINGS[language] ?? GREETINGS.en;
  const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

  return (
    <SafeAreaView className="flex-1 bg-slate-900">
      <StatusBar style="light" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 p-6"
      >
        {/* Personalized header */}
        <View className="mt-2 gap-1">
          <Text className="text-sm font-medium text-sky-400">AgentBridge</Text>
          <Text accessibilityRole="header" className="text-3xl font-bold text-slate-50">
            {greeting.title}
          </Text>
          <Text className="text-base text-slate-400">{greeting.subtitle}</Text>
        </View>

        {/* Profile summary */}
        <View className="gap-3 rounded-2xl bg-slate-800 p-4">
          <View className="flex-row items-center justify-between">
            <Text
              accessibilityRole="header"
              className="text-base font-semibold text-slate-100"
            >
              Your preferences
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit your accessibility preferences"
              onPress={() => router.push('/onboarding/needs')}
              className="min-h-[44px] min-w-[44px] items-center justify-center rounded-xl px-3 active:opacity-80"
            >
              <Text className="text-sm font-bold text-sky-400">Edit</Text>
            </Pressable>
          </View>

          <View className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Language
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <Chip label={languageLabel(language)} />
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Adapted for
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {needs.length > 0 ? (
                needs.map((n) => <Chip key={n} label={needTitle(n)} />)
              ) : (
                <Chip label="General mode" />
              )}
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Interaction
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {inputModes.map((m) => (
                <Chip key={`in-${m}`} label={`In: ${cap(m)}`} />
              ))}
              {outputModes.map((m) => (
                <Chip key={`out-${m}`} label={`Out: ${cap(m)}`} />
              ))}
            </View>
          </View>
        </View>

        {/* Live assistant entry */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open the assistant. Ask anything in your preferred language."
          accessibilityHint="Starts a text conversation with the AI assistant"
          onPress={() => router.push('/assistant')}
          className="flex-row items-center gap-3 rounded-2xl bg-sky-400 p-4 active:opacity-80"
        >
          <View className="flex-1 gap-0.5">
            <Text className="text-base font-bold text-slate-900">
              Ask anything
            </Text>
            <Text className="text-sm leading-5 text-slate-800">
              Chat with your assistant in {languageLabel(language)}.
            </Text>
          </View>
          <Text
            importantForAccessibility="no"
            className="text-2xl font-bold text-slate-900"
          >
            ›
          </Text>
        </Pressable>

        {/* Future foundation — clearly non-interactive previews */}
        <View className="gap-3 rounded-2xl bg-slate-800 p-4">
          <Text
            accessibilityRole="header"
            className="text-base font-semibold text-slate-100"
          >
            Coming next
          </Text>
          <View className="gap-3">
            {COMING_NEXT.map((item) => (
              <View
                key={item.title}
                accessibilityLabel={`${item.title}. ${item.description} Coming soon, not available yet.`}
                className="flex-row items-center gap-3 rounded-xl bg-slate-800/60"
              >
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-semibold text-slate-200">
                    {item.title}
                  </Text>
                  <Text className="text-xs leading-4 text-slate-500">
                    {item.description}
                  </Text>
                </View>
                <View
                  importantForAccessibility="no"
                  className="rounded-full border border-slate-600 px-2.5 py-1"
                >
                  <Text className="text-[11px] font-semibold text-slate-400">
                    Soon
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Existing backend connectivity — preserved */}
        <ConnectivityCard />

        {/* Development-only reset */}
        {__DEV__ ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset onboarding, development only"
            onPress={() => {
              resetOnboarding();
              router.replace('/onboarding/welcome');
            }}
            className="min-h-[48px] items-center justify-center rounded-2xl border border-slate-700 px-4 active:opacity-80"
          >
            <Text className="text-sm font-semibold text-slate-400">
              Reset onboarding (dev)
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
