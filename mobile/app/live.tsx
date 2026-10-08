import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
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
import { languageLabel } from '../src/profile/options';
import type { LiveNarration, LiveStatus } from '../src/vision/useLiveSession';
import { useLiveSession } from '../src/vision/useLiveSession';

type CameraRef = React.ElementRef<typeof CameraView>;

// ---------------------------------------------------------------------------
// Frame compression constants
// ---------------------------------------------------------------------------

/**
 * Max dimension (width or height) for frames sent over WebSocket.
 * Samsung high-res cameras (12MP–200MP) produce enormous base64 even at low
 * JPEG quality. Resizing to 640px keeps payloads ≤80 KB on ALL devices.
 */
const FRAME_MAX_DIMENSION = 640;

/** JPEG quality for the resized frame (0–1). */
const FRAME_COMPRESS_QUALITY = 0.15;

/**
 * Safety limit: if the final base64 still exceeds this, skip the frame.
 * This should never trigger after resizing, but guards against edge cases.
 */
const FRAME_MAX_BASE64_LENGTH = 3 * 1024 * 1024; // 3 MB

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Downscale and re-compress a captured photo URI to a small base64 string.
 * This is the critical fix for Samsung / high-resolution phones where even
 * quality=0.2 at native resolution produces >1 MB base64.
 */
async function compressFrame(uri: string): Promise<string | null> {
  try {
    const result = await manipulateAsync(
      uri,
      [{ resize: { width: FRAME_MAX_DIMENSION } }],
      {
        compress: FRAME_COMPRESS_QUALITY,
        format: SaveFormat.JPEG,
        base64: true,
      },
    );
    const b64 = result.base64;
    if (!b64 || b64.length === 0) return null;
    // Safety: reject if still too large (shouldn't happen after resize)
    if (b64.length > FRAME_MAX_BASE64_LENGTH) {
      console.warn(`[live] Frame still too large after compression: ${(b64.length / 1024).toFixed(0)} KB — skipping`);
      return null;
    }
    return b64;
  } catch (err) {
    console.warn('[live] Frame compression failed:', err);
    return null;
  }
}

function NarrationBubble({ item }: { item: LiveNarration }) {
  const time = new Date(item.timestamp);
  const ts = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return (
    <View
      accessibilityLabel={`Narration: ${item.text}`}
      className="gap-1 rounded-2xl bg-slate-800/90 px-4 py-3"
    >
      <View className="flex-row items-center gap-2">
        <Text className="text-xs font-medium text-sky-400">{ts}</Text>
        {item.latencyMs !== undefined && (
          <Text className="text-xs text-slate-500">{item.latencyMs}ms</Text>
        )}
      </View>
      <Text className="text-base leading-6 text-slate-50">{item.text}</Text>
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
  // Captures a photo then RESIZES + RECOMPRESSES it to keep payload small
  // across all device cameras (Samsung, Pixel, iPhone, etc.).
  useEffect(() => {
    session.setCapturer(async () => {
      try {
        // Capture at low quality — but NOTE: this still uses native resolution
        // on Samsung phones, so the base64 can be huge. That's why we resize.
        const photo = await cameraRef.current?.takePictureAsync({
          base64: false, // Don't need base64 from capture — we'll get it after resize
          quality: 0.3,
          imageType: 'jpg',
          exif: false,
          skipProcessing: true,
        });
        if (!photo?.uri) return null;

        // Downscale to ≤640px and re-compress — this is what fixes Samsung
        return await compressFrame(photo.uri);
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
  const modeLabel = mode === 'websocket' ? '⚡ Real-time' : '🔄 Polling';
  const modeColor = mode === 'websocket' ? 'text-emerald-400' : 'text-amber-400';

  return (
    <SafeAreaView className="flex-1 bg-slate-900">
      <StatusBar style="light" />

      {/* ─── Header ──────────────────────────────────────────────── */}
      <View className="flex-row items-center gap-2 border-b border-slate-800 px-4 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back to home"
          onPress={() => {
            session.stop();
            router.back();
          }}
          className="min-h-[48px] min-w-[48px] items-center justify-center rounded-xl active:opacity-80"
        >
          <Text className="text-2xl font-bold text-slate-100">‹</Text>
        </Pressable>
        <View className="flex-1 gap-0.5">
          <Text accessibilityRole="header" className="text-lg font-bold text-slate-50">
            Live narration
          </Text>
          <View className="flex-row items-center gap-2">
            <Text className="text-xs text-slate-400">
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
            <Text className="text-sm font-bold text-red-400">Stop</Text>
          </Pressable>
        )}
      </View>

      {/* ─── Status bar ──────────────────────────────────────────── */}
      <View
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Status: ${statusText}`}
        className="flex-row items-center gap-2 bg-slate-800 px-4 py-2.5"
      >
        {(isRunning || status === 'connecting' || status === 'reconnecting') && (
          <ActivityIndicator size="small" color="#38BDF8" />
        )}
        {isRunning && (
          <View className="h-2.5 w-2.5 rounded-full bg-green-400" />
        )}
        {status === 'reconnecting' && (
          <View className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        )}
        <Text className="flex-1 text-sm font-medium text-slate-100">
          {statusText}
        </Text>
      </View>

      {/* ─── Camera + controls + narration log ──────────────────── */}
      <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4">
        {/* Camera view */}
        {cameraPermission?.granted ? (
          <View className="overflow-hidden rounded-2xl bg-black">
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
            className="gap-3 rounded-2xl bg-slate-800 p-4"
          >
            <Text className="text-base font-semibold text-slate-50">
              Camera access is off
            </Text>
            <Text className="text-sm leading-5 text-slate-400">
              AgentBridge needs the camera to narrate your surroundings in real
              time. Frames are analyzed in memory and never stored.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Allow camera access"
              onPress={() => void requestCameraPermission()}
              className="min-h-[52px] items-center justify-center rounded-2xl bg-sky-400 px-4 active:opacity-80"
            >
              <Text className="text-base font-bold text-slate-900">
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
            className="min-h-[72px] items-center justify-center rounded-2xl bg-green-500 px-6 active:opacity-80"
          >
            <Text className="text-lg font-bold text-white">▶  Start live narration</Text>
          </Pressable>
        )}

        {showPauseResume && (
          <View className="flex-row gap-3">
            {isRunning ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Pause narration"
                onPress={session.pause}
                className="min-h-[64px] flex-1 items-center justify-center rounded-2xl bg-amber-500 px-4 active:opacity-80"
              >
                <Text className="text-base font-bold text-white">⏸  Pause</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Resume narration"
                onPress={session.resume}
                className="min-h-[64px] flex-1 items-center justify-center rounded-2xl bg-green-500 px-4 active:opacity-80"
              >
                <Text className="text-base font-bold text-white">▶  Resume</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Stop live narration"
              onPress={session.stop}
              className="min-h-[64px] flex-1 items-center justify-center rounded-2xl bg-red-500 px-4 active:opacity-80"
            >
              <Text className="text-base font-bold text-white">◼  Stop</Text>
            </Pressable>
          </View>
        )}

        {/* ─── Narration log ─────────────────────────────────────── */}
        {narrations.length > 0 && (
          <View className="gap-3">
            <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Narration history
            </Text>
            {narrations.map((n) => (
              <NarrationBubble key={n.id} item={n} />
            ))}
          </View>
        )}

        <Text className="text-xs leading-4 text-slate-500">
          Live descriptions may not be fully accurate — verify important details
          another way. Frames are analyzed in memory and never stored.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
