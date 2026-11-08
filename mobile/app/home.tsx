import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConnectivityCard } from '../src/components/ConnectivityCard';
import { Icon } from '../src/components/Icon';
import type { IconName } from '../src/components/Icon';
import { languageLabel, needTitle } from '../src/profile/options';
import type { SupportedLanguage } from '../src/profile/types';
import { useProfileStore } from '../src/profile/store';

const GREETINGS: Record<SupportedLanguage, { title: string; subtitle: string }> = {
  en:  { title: 'Welcome',    subtitle: 'Your accessible AI companion.' },
  hi:  { title: 'नमस्ते',     subtitle: 'आपका सुलभ AI साथी।' },
  te:  { title: 'నమస్కారం', subtitle: 'మీ సులభ AI తోడు.' },
  ta:  { title: 'வணக்கம்',   subtitle: 'உங்கள் அணுகல் AI தோழர்.' },
  kn:  { title: 'ನಮಸ್ಕಾರ',  subtitle: 'ನಿಮ್ಮ ಸುಲಭ AI ಸಂಗಾತಿ.' },
  ml:  { title: 'നമസ്കാരം', subtitle: 'നിങ്ങളുടെ AI കൂട്ടാളി.' },
  kok: { title: 'नमस्कार',   subtitle: 'तुमचो सुलभ AI सोबतो.' },
};

/* ── Reusable sub-components ─────────────────────────────────────────── */

function Avatar({ initials }: { initials: string }) {
  return (
    <View
      accessibilityLabel={`Profile: ${initials}`}
      className="h-11 w-11 items-center justify-center rounded-full bg-[#0F766E]"
    >
      <Text className="text-base font-semibold text-white">{initials}</Text>
    </View>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View
      accessibilityLabel={label}
      className="rounded-full bg-[#F0FDFA] border border-[#CCFBF1] px-3 py-1.5"
    >
      <Text className="text-xs font-semibold text-[#0F766E]">{label}</Text>
    </View>
  );
}

/** Feature tile for the 2x2 grid. */
function FeatureTile({
  icon,
  title,
  subtitle,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  accent = false,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  accent?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      className={`flex-1 gap-3 rounded-[14px] p-4 active:opacity-80 ${
        accent
          ? 'bg-[#0F766E]'
          : 'bg-white border border-[#E5E7EB]'
      }`}
    >
      <View
        className={`h-10 w-10 items-center justify-center rounded-[12px] ${
          accent
            ? 'bg-white/20'
            : 'bg-[#F0FDFA] border border-[#CCFBF1]'
        }`}
      >
        <Icon name={icon} size={20} color={accent ? '#FFFFFF' : '#0F766E'} />
      </View>
      <View className="gap-0.5">
        <Text
          className={`text-[14px] font-semibold ${
            accent ? 'text-white' : 'text-[#111827]'
          }`}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          className={`text-[12px] leading-4 ${
            accent ? 'text-white/70' : 'text-[#6B7280]'
          }`}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

/** A single row inside the profile summary. */
function ProfileRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">
        {label}
      </Text>
      <View className="flex-row flex-wrap gap-1.5">{children}</View>
    </View>
  );
}

const COMING_NEXT: { title: string; description: string }[] = [];

/* ── Screen ──────────────────────────────────────────────────────────── */

export default function HomeScreen() {
  const needs = useProfileStore((s) => s.needs);
  const language = useProfileStore((s) => s.language);
  const inputModes = useProfileStore((s) => s.inputModes);
  const outputModes = useProfileStore((s) => s.outputModes);
  const resetOnboarding = useProfileStore((s) => s.resetOnboarding);

  const greeting = GREETINGS[language] ?? GREETINGS.en;
  const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

  // Derive initials from the greeting language for the avatar
  const langInitial = languageLabel(language).charAt(0).toUpperCase();

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]">
      <StatusBar style="dark" />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <View className="bg-[#F0FDFA] border-b border-[#CCFBF1] px-5 pt-5 pb-5">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 gap-0.5">
            <Text className="text-[13px] font-medium text-[#0F766E]">
              AgentBridge
            </Text>
            <Text
              accessibilityRole="header"
              className="text-[24px] font-semibold leading-[30px] text-[#111827]"
              style={{ letterSpacing: -0.3 }}
            >
              {greeting.title}
            </Text>
          </View>
          <Avatar initials={langInitial} />
        </View>
        <Text className="mt-1 text-[14px] leading-5 text-[#6B7280]">
          {greeting.subtitle}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8 pt-5 gap-5"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Feature grid (2x2) ───────────────────────────────────── */}
        <View className="gap-3">
          <View className="flex-row gap-3">
            <FeatureTile
              icon="message"
              title="Ask anything"
              subtitle={`Chat in ${languageLabel(language)}`}
              onPress={() => router.push('/assistant')}
              accessibilityLabel="Open the assistant. Ask anything in your preferred language."
              accessibilityHint="Starts a text conversation with the AI assistant"
              accent
            />
            <FeatureTile
              icon="eye"
              title="Vision"
              subtitle="Describe scenes and read text"
              onPress={() => router.push('/vision')}
              accessibilityLabel="Open the vision assistant. Describe scenes and read text with voice or touch."
              accessibilityHint="Opens the camera-based vision assistant"
            />
          </View>
          <View className="flex-row gap-3">
            <FeatureTile
              icon="zap"
              title="Live narration"
              subtitle="Real-time AI description"
              onPress={() => router.push('/live')}
              accessibilityLabel="Open live narration. Real-time AI description of your camera feed."
              accessibilityHint="Starts a continuous live camera narration"
            />
            <FeatureTile
              icon="globe"
              title="Translate"
              subtitle="Between Indian languages"
              onPress={() => router.push('/translate')}
              accessibilityLabel="Open translator. Translate between Indian languages."
              accessibilityHint="Opens the translation screen"
            />
          </View>
        </View>

        {/* ── Profile summary ──────────────────────────────────────── */}
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text
              accessibilityRole="header"
              className="text-[16px] font-semibold text-[#111827]"
            >
              Your profile
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit your accessibility preferences"
              onPress={() => router.push('/onboarding/needs')}
              className="min-h-[44px] min-w-[44px] flex-row items-center justify-center gap-1.5 rounded-[10px] active:opacity-80"
            >
              <Icon name="edit" size={14} color="#115E59" />
              <Text className="text-[13px] font-semibold text-[#115E59]">
                Edit
              </Text>
            </Pressable>
          </View>

          <View className="gap-3 rounded-[14px] bg-white border border-[#E5E7EB] p-4">
            <ProfileRow label="Language">
              <Chip label={languageLabel(language)} />
            </ProfileRow>

            <View className="h-px bg-[#F3F4F6]" />

            <ProfileRow label="Adapted for">
              {needs.length > 0 ? (
                needs.map((n) => <Chip key={n} label={needTitle(n)} />)
              ) : (
                <Chip label="General mode" />
              )}
            </ProfileRow>

            <View className="h-px bg-[#F3F4F6]" />

            <ProfileRow label="Interaction">
              {inputModes.map((m) => (
                <Chip key={`in-${m}`} label={`In: ${cap(m)}`} />
              ))}
              {outputModes.map((m) => (
                <Chip key={`out-${m}`} label={`Out: ${cap(m)}`} />
              ))}
            </ProfileRow>
          </View>
        </View>

        {/* ── Coming next (if any) ─────────────────────────────────── */}
        {COMING_NEXT.length > 0 && (
          <View className="gap-3">
            <Text
              accessibilityRole="header"
              className="text-[16px] font-semibold text-[#111827]"
            >
              Coming next
            </Text>
            <View className="gap-2 rounded-[14px] bg-white border border-[#E5E7EB] p-4">
              {COMING_NEXT.map((item, i) => (
                <View key={item.title}>
                  {i > 0 && <View className="my-2 h-px bg-[#F3F4F6]" />}
                  <View
                    accessibilityLabel={`${item.title}. ${item.description} Coming soon, not available yet.`}
                    className="flex-row items-center gap-3"
                  >
                    <View className="flex-1 gap-0.5">
                      <Text className="text-[14px] font-semibold text-[#111827]">
                        {item.title}
                      </Text>
                      <Text className="text-[12px] leading-4 text-[#6B7280]">
                        {item.description}
                      </Text>
                    </View>
                    <View
                      importantForAccessibility="no"
                      className="rounded-full border border-[#E5E7EB] px-2.5 py-1"
                    >
                      <Text className="text-[11px] font-semibold text-[#6B7280]">
                        Soon
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Connectivity ─────────────────────────────────────────── */}
        <View className="gap-3">
          <Text
            accessibilityRole="header"
            className="text-[16px] font-semibold text-[#111827]"
          >
            System
          </Text>
          <ConnectivityCard />
        </View>

        {/* ── Development-only reset ───────────────────────────────── */}
        {__DEV__ ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset onboarding, development only"
            onPress={() => {
              resetOnboarding();
              router.replace('/onboarding/welcome');
            }}
            className="min-h-[48px] items-center justify-center rounded-[12px] border border-[#D1D5DB] px-4 active:opacity-80"
          >
            <Text className="text-[13px] font-medium text-[#6B7280]">
              Reset onboarding (dev)
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
