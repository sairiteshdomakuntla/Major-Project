import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../src/components/Icon';
import { languageLabel } from '../src/profile/options';
import type { VisionMessage } from '../src/vision/types';
import { useVisionSession } from '../src/vision/useVisionSession';

type CameraRef = React.ElementRef<typeof CameraView>;

const STATUS_TEXT: Record<string, string> = {
  idle: 'Ready.',
  listening: 'Listening… speak now.',
  capturing: 'Taking the photo… hold still.',
  analyzing: 'Analyzing the photo…',
  speaking: 'Speaking the result.',
  error: 'Something went wrong.',
};

function ResultBubble({ message }: { message: VisionMessage }) {
  if (message.role === 'user') {
    return (
      <View
        accessibilityLabel={`You asked: ${message.text}`}
        className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-[#0F766E] px-4 py-3"
      >
        <Text className="text-base leading-6 text-white">{message.text}</Text>
      </View>
    );
  }
  if (message.status === 'error') {
    return (
      <View
        accessibilityLabel={`Vision error: ${message.error ?? 'Request failed'}`}
        className="max-w-[85%] gap-1 self-start rounded-2xl rounded-bl-md border-2 border-[#DC2626] bg-white px-4 py-3"
      >
        <Text className="text-base font-semibold text-[#991B1B]">
          Couldn&apos;t analyze
        </Text>
        <Text className="text-sm leading-5 text-[#6B7280]">{message.error}</Text>
      </View>
    );
  }
  return (
    <View
      accessibilityLabel={`Vision assistant: ${message.text}`}
      className="max-w-[95%] self-start rounded-2xl rounded-bl-md border border-[#E5E7EB] bg-white px-4 py-3"
    >
      <Text className="text-base leading-6 text-[#111827]">{message.text}</Text>
    </View>
  );
}

export default function VisionScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraRef | null>(null);
  const [findTarget, setFindTarget] = useState('');
  const [followUp, setFollowUp] = useState('');
  const introSpoken = useRef(false);

  const session = useVisionSession();
  const {
    status,
    notice,
    listening,
    sttSupported,
    hasPhoto,
    isWorking,
    language,
  } = session;

  // Register the photo capturer once the camera ref exists.
  useEffect(() => {
    session.setCapturer(async () => {
      try {
        const photo = await cameraRef.current?.takePictureAsync({
          base64: true,
          quality: 0.6,
          imageType: 'jpg',
          exif: false,
        });
        const base64 = photo?.base64;
        return base64 && base64.length > 0 ? base64 : null;
      } catch {
        return null;
      }
    });
    return () => session.setCapturer(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Voice-first intro, spoken once when the screen opens.
  useEffect(() => {
    if (introSpoken.current) return;
    introSpoken.current = true;
    const timer = setTimeout(() => {
      void session.say(
        'Vision assistant. Aim your camera, then tap Listen and say describe, read, or find. Or use the buttons below.',
      );
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusText = notice ?? STATUS_TEXT[status] ?? 'Ready.';

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]">
      <StatusBar style="dark" />
      {/* Header */}
      <View className="flex-row items-center gap-2 border-b border-[#CCFBF1] bg-[#F0FDFA] px-4 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back to home"
          onPress={() => {
            session.stopAll();
            router.back();
          }}
          className="min-h-[48px] min-w-[48px] items-center justify-center rounded-xl active:opacity-80"
        >
          <Icon name="arrow-left" size={20} color="#111827" />
        </Pressable>
        <View className="flex-1 gap-0.5">
          <Text accessibilityRole="header" className="text-lg font-bold text-[#111827]">
            Vision assistant
          </Text>
          <Text className="text-xs text-[#6B7280]">
            {languageLabel(language)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Discard this photo and start a new one"
          onPress={session.newPhoto}
          className="min-h-[48px] items-center justify-center rounded-xl px-3 active:opacity-80"
        >
          <Text className="text-sm font-bold text-[#115E59]">New photo</Text>
        </Pressable>
      </View>

      {/* Spoken + visible status — every state change is announced */}
      <View
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Status: ${statusText}`}
        className="flex-row items-center gap-2 border-b border-[#CCFBF1] bg-[#F0FDFA] px-4 py-2.5"
      >
        {(isWorking || listening) && (
          <ActivityIndicator size="small" color="#0F766E" />
        )}
        <Text className="flex-1 text-sm font-medium text-[#111827]">
          {statusText}
        </Text>
      </View>

      <FlatList
        className="flex-1"
        contentContainerClassName="gap-3 p-4"
        keyboardShouldPersistTaps="handled"
        data={[{ key: 'body' }]}
        keyExtractor={(i) => i.key}
        renderItem={() => (
          <View className="gap-4">
            {/* Camera */}
            {cameraPermission?.granted ? (
              <View className="gap-2">
                <CameraView
                  ref={cameraRef}
                  facing="back"
                  style={{ height: 256, width: '100%' }}
                  accessibilityLabel="Camera preview. Aim at what you want understood."
                  className="overflow-hidden rounded-2xl bg-black"
                />
                {hasPhoto ? (
                  <View
                    accessibilityLabel="Photo captured. Ask a follow-up below, or take a new photo."
                    className="rounded-[14px] border border-[#CCFBF1] bg-[#F0FDFA] p-3"
                  >
                    <Text className="text-sm text-[#111827]">
                      Photo captured. Ask a follow-up below, or take a new
                      photo.
                    </Text>
                  </View>
                ) : null}
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
                  AgentBridge needs the camera to describe what is in front of
                  you. Photos are analyzed and never stored.
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

            {/* Primary voice + capture controls */}
            <View className="flex-row gap-3">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  listening
                    ? 'Listening for your voice command'
                    : 'Listen for a voice command. Say describe, read, find, repeat, or stop.'
                }
                accessibilityState={{ disabled: listening || isWorking }}
                disabled={listening || isWorking}
                onPress={() => void session.listenForCommand()}
                className={`min-h-[72px] flex-1 items-center justify-center rounded-2xl px-4 active:opacity-80 ${
                  listening ? 'bg-[#16A34A]' : 'bg-[#0F766E]'
                }`}
              >
                <Text className="text-base font-bold text-white">
                  {listening ? 'Listening…' : 'Listen'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Take a photo and describe it"
                accessibilityState={{ disabled: isWorking }}
                disabled={isWorking}
                onPress={() => void session.describeSurroundings()}
                className="min-h-[72px] flex-1 items-center justify-center rounded-2xl border border-[#D1D5DB] bg-white px-4 active:opacity-80"
              >
                <Text className="text-base font-bold text-[#111827]">
                  Describe
                </Text>
              </Pressable>
            </View>
            {sttSupported === false ? (
              <Text className="text-sm leading-5 text-[#6B7280]">
                Voice input needs the development build — the buttons on this
                screen do everything voice commands do.
              </Text>
            ) : null}

            {/* Touch alternatives */}
            <View className="flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Take a photo and read any text in it"
                accessibilityState={{ disabled: isWorking }}
                disabled={isWorking}
                onPress={() => void session.readText()}
                className="min-h-[52px] flex-1 items-center justify-center rounded-2xl border border-[#D1D5DB] bg-white px-3 active:opacity-80"
              >
                <Text className="text-sm font-bold text-[#111827]">Read text</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Repeat the last spoken result"
                onPress={session.repeatLast}
                className="min-h-[52px] flex-1 items-center justify-center rounded-2xl border border-[#D1D5DB] bg-white px-3 active:opacity-80"
              >
                <Text className="text-sm font-bold text-[#111827]">Repeat</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Stop speaking"
                onPress={session.stopAll}
                className="min-h-[52px] flex-1 items-center justify-center rounded-2xl border border-[#D1D5DB] bg-white px-3 active:opacity-80"
              >
                <Text className="text-sm font-bold text-[#111827]">Stop</Text>
              </Pressable>
            </View>

            {/* Find an object */}
            <View className="flex-row items-end gap-2">
              <View className="flex-1 gap-1">
                <Text className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
                  Find something
                </Text>
                <TextInput
                  accessibilityLabel="Name the object to find"
                  value={findTarget}
                  onChangeText={setFindTarget}
                  placeholder="e.g. water bottle"
                  placeholderTextColor="#9CA3AF"
                  returnKeyType="search"
                  onSubmitEditing={() => {
                    if (findTarget.trim()) {
                      void session.findObject(findTarget.trim());
                      setFindTarget('');
                    }
                  }}
                  className="min-h-[52px] rounded-[12px] border border-[#D1D5DB] bg-[#F8FAFC] px-4 text-base text-[#111827]"
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Take a photo and look for the named object"
                accessibilityState={{
                  disabled: isWorking || findTarget.trim().length === 0,
                }}
                disabled={isWorking || findTarget.trim().length === 0}
                onPress={() => {
                  void session.findObject(findTarget.trim());
                  setFindTarget('');
                }}
                className="min-h-[52px] items-center justify-center rounded-[12px] bg-[#0F766E] px-5 active:opacity-80"
              >
                <Text className="text-base font-bold text-white">Find</Text>
              </Pressable>
            </View>

            {/* Results */}
            <View className="gap-3">
              {session.messages.map((m) => (
                <ResultBubble key={m.id} message={m} />
              ))}
              {session.messages.some((m) => m.status === 'error') ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retry the last vision request"
                  onPress={session.retry}
                  className="min-h-[52px] items-center justify-center rounded-[12px] bg-[#0F766E] px-4 active:opacity-80"
                >
                  <Text className="text-base font-bold text-white">
                    Retry
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {/* Follow-up about the same photo */}
            <View className="gap-1">
              <Text className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
                Ask about this photo
              </Text>
              <View className="flex-row items-end gap-2">
                <TextInput
                  accessibilityLabel="Ask a follow-up question about the current photo"
                  accessibilityHint={
                    hasPhoto
                      ? 'Uses the same photo, no need to capture again'
                      : 'Take a photo first'
                  }
                  value={followUp}
                  onChangeText={setFollowUp}
                  placeholder={
                    hasPhoto ? 'e.g. Is there a chair nearby?' : 'Take a photo first…'
                  }
                  placeholderTextColor="#9CA3AF"
                  multiline
                  returnKeyType="send"
                  onSubmitEditing={() => {
                    session.askFollowUp(followUp);
                    setFollowUp('');
                  }}
                  blurOnSubmit={false}
                  editable={!isWorking}
                  className="max-h-32 min-h-[52px] flex-1 rounded-[12px] border border-[#D1D5DB] bg-[#F8FAFC] px-4 py-3 text-base text-[#111827]"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send follow-up question"
                  accessibilityState={{
                    disabled: isWorking || followUp.trim().length === 0,
                  }}
                  disabled={isWorking || followUp.trim().length === 0}
                  onPress={() => {
                    session.askFollowUp(followUp);
                    setFollowUp('');
                  }}
                  className="min-h-[52px] min-w-[52px] items-center justify-center rounded-[12px] bg-[#0F766E] px-4 active:opacity-80"
                >
                  <Icon name="arrow-up" size={20} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>

            <Text className="text-xs leading-4 text-[#6B7280]">
              Descriptions may not be fully accurate — verify important details
              another way. Photos are analyzed in memory and never stored.
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
