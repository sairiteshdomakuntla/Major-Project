import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../src/components/Icon';
import { languageLabel } from '../src/profile/options';
import type { LiveNarration, LiveStatus } from '../src/vision/useLiveSession';
import { useLiveSession } from '../src/vision/useLiveSession';

type CameraRef = React.ElementRef<typeof CameraView>;

// Human-readable status text for the status bar.
const STATUS_LABELS: Record<LiveStatus, string> = {
  idle: 'Tap Start to begin live narration.',
  connecting: 'Connecting to server…',
  running: 'Watching…',
  capturing: 'Capturing frame…',
  analyzing: 'Analyzing what I see…',
  speaking: 'Speaking…',
  paused: 'Paused.',
  reconnecting: 'Reconnecting…',
  error: 'Error — will retry.',
};

function NarrationBubble({ item }: { item: LiveNarration }) {
  const time = new Date(item.timestamp);
  const ts = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return (
    <View
      accessibilityLabel={`Narration: ${item.text}`}
      className="gap-1 rounded-[14px] border border-[#E5E7EB] bg-white px-4 py-3"
    >
      <View className="flex-row items-center gap-2">
        <Text className="text-xs font-medium text-[#0F766E]">{ts}</Text>
        {item.latencyMs !== undefined && (
          <Text className="text-xs text-[#6B7280]">{item.latencyMs}ms</Text>
        )}
      </View>
      <Text className="text-base leading-6 text-[#111827]">{item.text}</Text>
    </View>
  );
}

export default function LiveScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraRef | null>(null);
  const introSpoken = useRef(false);

  const session = useLiveSession();
  const {
    status,
    narrations,
    error,
    frameCount,
    language,
    mode,
    isRunning,
    isPaused,
  } = session;

  // Register the frame capturer from the camera.
  useEffect(() => {
    session.setCapturer(async () => {
      try {
        const photo = await cameraRef.current?.takePictureAsync({
          base64: true,
          quality: 0.1,
          imageType: 'jpg',
          exif: false,
          skipProcessing: true,
          shutterSound: false,
        });
        const base64 = photo?.base64;
        if (!base64 || base64.length === 0) return null;

        // Guard: drop frames larger than ~4 MB base64 to stay within WS limits
        if (base64.length > 4 * 1024 * 1024) {
          console.warn(`[live] Frame too large (${(base64.length / 1024).toFixed(0)} KB), dropping`);
          return null;
        }

        return base64;
      } catch {
        return null;
      }
    });
    return () => session.setCapturer(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Intro speech on mount.
  useEffect(() => {
    if (introSpoken.current) return;
    introSpoken.current = true;
    const timer = setTimeout(() => {
      void session.say(
        'Live narration mode. Tap Start to begin. I will describe what your camera sees in real time.',
      );
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusText = error ?? STATUS_LABELS[status] ?? 'Ready.';

  // Derive which control buttons to show.
  const showStart = status === 'idle';
  const showPauseResume = isRunning || isPaused;

  // Connection mode indicator
  const modeLabel = mode === 'websocket' ? 'Real-time' : 'Polling';
  const modeColor = mode === 'websocket' ? 'text-[#16A34A]' : 'text-[#D97706]';

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]">
      <StatusBar style="dark" />

      {/* ─── Header ──────────────────────────────────────────────── */}
      <View className="flex-row items-center gap-2 border-b border-[#CCFBF1] bg-[#F0FDFA] px-4 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back to home"
          onPress={() => {
            session.stop();
            router.back();
          }}
          className="min-h-[48px] min-w-[48px] items-center justify-center rounded-xl active:opacity-80"
        >
          <Icon name="arrow-left" size={20} color="#111827" />
        </Pressable>
        <View className="flex-1 gap-0.5">
          <Text accessibilityRole="header" className="text-lg font-bold text-[#111827]">
            Live narration
          </Text>
          <View className="flex-row items-center gap-2">
            <Text className="text-xs text-[#6B7280]">
              {languageLabel(language)} · {frameCount} frames
            </Text>
            {isRunning && (
              <Text className={`text-xs font-medium ${modeColor}`}>
                {modeLabel}
              </Text>
            )}
          </View>
        </View>
        {(isRunning || isPaused) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stop live narration and reset"
            onPress={session.stop}
            className="min-h-[48px] items-center justify-center rounded-xl px-3 active:opacity-80"
          >
            <Text className="text-sm font-bold text-[#DC2626]">Stop</Text>
          </Pressable>
        )}
      </View>

      {/* ─── Status bar ──────────────────────────────────────────── */}
      <View
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Status: ${statusText}`}
        className="flex-row items-center gap-2 border-b border-[#CCFBF1] bg-[#F0FDFA] px-4 py-2.5"
      >
        {(isRunning || status === 'connecting' || status === 'reconnecting') && (
          <ActivityIndicator size="small" color="#0F766E" />
        )}
        {isRunning && (
          <View className="h-2.5 w-2.5 rounded-full bg-[#16A34A]" />
        )}
        {status === 'reconnecting' && (
          <View className="h-2.5 w-2.5 rounded-full bg-[#D97706]" />
        )}
        <Text className="flex-1 text-sm font-medium text-[#111827]">
          {statusText}
        </Text>
      </View>

      {/* ─── Camera + controls + narration log ──────────────────── */}
      <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4">
        {/* Camera view */}
        {cameraPermission?.granted ? (
          <View className="overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-black">
            <CameraView
              ref={cameraRef}
              facing="back"
              style={{ height: 288, width: '100%' }}
              accessibilityLabel="Live camera feed. Descriptions appear below."
              className="bg-black"
            />
            {/* Overlay showing latest narration text on top of camera */}
            {narrations.length > 0 && isRunning && (
              <View className="absolute bottom-0 left-0 right-0 bg-black/70 px-4 py-3">
                <Text
                  accessibilityLiveRegion="assertive"
                  className="text-sm leading-5 text-white"
                  numberOfLines={3}
                >
                  {narrations[0].text}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View
            accessibilityLabel="Camera permission needed"
            className="gap-3 rounded-[14px] border border-[#E5E7EB] bg-white p-4"
          >
            <Text className="text-base font-semibold text-[#111827]">
              Camera access is off
            </Text>
            <Text className="text-sm leading-5 text-[#6B7280]">
              AgentBridge needs the camera to narrate your surroundings in real
              time. Frames are analyzed in memory and never stored.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Allow camera access"
              onPress={() => void requestCameraPermission()}
              className="min-h-[52px] items-center justify-center rounded-[12px] bg-[#0F766E] px-4 active:opacity-80"
            >
              <Text className="text-base font-bold text-white">
                Allow camera
              </Text>
            </Pressable>
          </View>
        )}

        {/* ─── Controls ──────────────────────────────────────────── */}
        {showStart && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start live narration"
            onPress={session.start}
            className="min-h-[72px] flex-row items-center justify-center gap-3 rounded-[12px] bg-[#0F766E] px-6 active:opacity-80"
          >
            <Icon name="play" size={22} color="#FFFFFF" />
            <Text className="text-lg font-bold text-white">Start live narration</Text>
          </Pressable>
        )}

        {showPauseResume && (
          <View className="flex-row gap-3">
            {isRunning ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Pause narration"
                onPress={session.pause}
                className="min-h-[64px] flex-1 flex-row items-center justify-center gap-2 rounded-[12px] bg-[#D97706] px-4 active:opacity-80"
              >
                <Icon name="pause" size={20} color="#FFFFFF" />
                <Text className="text-base font-bold text-white">Pause</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Resume narration"
                onPress={session.resume}
                className="min-h-[64px] flex-1 flex-row items-center justify-center gap-2 rounded-[12px] bg-[#0F766E] px-4 active:opacity-80"
              >
                <Icon name="play" size={20} color="#FFFFFF" />
                <Text className="text-base font-bold text-white">Resume</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Stop live narration"
              onPress={session.stop}
              className="min-h-[64px] flex-1 flex-row items-center justify-center gap-2 rounded-[12px] bg-[#DC2626] px-4 active:opacity-80"
            >
              <Icon name="stop" size={20} color="#FFFFFF" />
              <Text className="text-base font-bold text-white">Stop</Text>
            </Pressable>
          </View>
        )}

        {/* ─── Narration log ─────────────────────────────────────── */}
        {narrations.length > 0 && (
          <View className="gap-3">
            <Text className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
              Narration history
            </Text>
            {narrations.map((n) => (
              <NarrationBubble key={n.id} item={n} />
            ))}
          </View>
        )}

        <Text className="text-xs leading-4 text-[#6B7280]">
          Live descriptions may not be fully accurate — verify important details
          another way. Frames are analyzed in memory and never stored.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
