import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AssistantLanguage, FocusRegion } from '../src/api/client';
import { Icon } from '../src/components/Icon';
import { LANGUAGE_OPTIONS } from '../src/profile/options';
import type { TtsLanguage } from '../src/speech/tts';
import { speakText, stopSpeaking } from '../src/speech/tts';
import type { Rect } from '../src/translation/LensSelectionBox';
import { LensSelectionBox } from '../src/translation/LensSelectionBox';
import { useTranslation } from '../src/translation/useTranslation';

type CameraRef = React.ElementRef<typeof CameraView>;
type TranslateMode = 'camera' | 'text';

const MAX_INPUT_CHARS = 4000;

export default function TranslateScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<TranslateMode>('camera');
  const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back');
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [showOriginalText, setShowOriginalText] = useState(false);
  const [draft, setDraft] = useState('');
  const [activeSpeakingText, setActiveSpeakingText] = useState<string | null>(null);

  // Google Lens adjustable selection box state
  const [viewfinderSize, setViewfinderSize] = useState({ width: 0, height: 0 });
  const [cropBox, setCropBox] = useState<Rect>({
    x: 24,
    y: 50,
    width: 280,
    height: 180,
  });

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraRef | null>(null);

  const {
    sourceLang,
    targetLang,
    setSourceLang,
    setTargetLang,
    swapLanguages,
    // Text mode
    textResult,
    textError,
    isTranslatingText,
    translateText,
    clearTextResult,
    // Image mode
    imageResult,
    imageError,
    isTranslatingImage,
    translateImage,
    clearImageResult,
  } = useTranslation();

  const targetLangOption =
    LANGUAGE_OPTIONS.find((o) => o.value === targetLang) ?? LANGUAGE_OPTIONS[0];
  const sourceLangOption =
    LANGUAGE_OPTIONS.find((o) => o.value === sourceLang) ?? LANGUAGE_OPTIONS[0];

  // ── Audio TTS Playback ──
  const handleSpeak = async (text: string, lang: AssistantLanguage) => {
    if (activeSpeakingText === text) {
      await stopSpeaking();
      setActiveSpeakingText(null);
      return;
    }

    setActiveSpeakingText(text);
    await speakText(text, lang as TtsLanguage, {
      onDone: () => setActiveSpeakingText(null),
      onStopped: () => setActiveSpeakingText(null),
      onError: () => setActiveSpeakingText(null),
    });
  };

  const handleResetCropBox = () => {
    if (viewfinderSize.width > 0 && viewfinderSize.height > 0) {
      const w = Math.round(viewfinderSize.width * 0.8);
      const h = Math.round(viewfinderSize.height * 0.55);
      setCropBox({
        x: Math.round((viewfinderSize.width - w) / 2),
        y: Math.round((viewfinderSize.height - h) / 2),
        width: w,
        height: h,
      });
    }
  };

  // ── Camera Capture & Translate ──
  const handleCapturePhoto = async () => {
    if (isTranslatingImage) return;

    try {
      const photo = await cameraRef.current?.takePictureAsync({
        base64: true,
        quality: 0.5,
        imageType: 'jpg',
        exif: false,
      });

      if (!photo?.base64) return;

      setCapturedPhotoUri(photo.uri ?? null);
      setShowOriginalText(false);

      // Compute normalized focus region (0 to 1 relative coordinates)
      const focusRegion: FocusRegion | undefined =
        viewfinderSize.width > 0 && viewfinderSize.height > 0
          ? {
              x: Math.max(0, Math.min(1, cropBox.x / viewfinderSize.width)),
              y: Math.max(0, Math.min(1, cropBox.y / viewfinderSize.height)),
              width: Math.max(
                0.05,
                Math.min(1, cropBox.width / viewfinderSize.width),
              ),
              height: Math.max(
                0.05,
                Math.min(1, cropBox.height / viewfinderSize.height),
              ),
            }
          : undefined;

      translateImage(photo.base64, 'image/jpeg', focusRegion);
    } catch (err) {
      console.error('[translate] photo capture error:', err);
    }
  };

  const handleRetakePhoto = () => {
    setCapturedPhotoUri(null);
    clearImageResult();
    setShowOriginalText(false);
  };

  const handleClearText = () => {
    setDraft('');
    clearTextResult();
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]">
      <StatusBar style="dark" />

      {/* Top Header */}
      <View className="flex-row items-center justify-between bg-[#F0FDFA] border-b border-[#CCFBF1] px-4 py-2.5">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back to home"
          onPress={async () => {
            await stopSpeaking();
            router.back();
          }}
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-white border border-[#E5E7EB] active:opacity-75"
        >
          <Icon name="arrow-left" size={20} color="#111827" />
        </Pressable>

        <View className="items-center">
          <Text accessibilityRole="header" className="text-base font-bold text-[#111827]">
            Translate
          </Text>
          <Text className="text-[11px] font-medium text-[#6B7280]">
            Signs, Medicines & Documents
          </Text>
        </View>

        <View className="w-11" />
      </View>

      {/* Mode Switcher Tabs */}
      {/* NOTE: both branches below must include a shadow-* utility (shadow-none
          counts). shadow-* sets a CSS variable, and if a component gains it
          only after first render, NativeWind's dev-only upgrade warning
          serializes props and crashes with a misleading
          "Couldn't find a navigation context" red screen
          (nativewind/nativewind#1812). Keeping a shadow class in both branches
          creates the variable context on mount so no upgrade ever fires. */}
      <View className="px-4 pt-3 pb-2">
        <View className="flex-row rounded-[14px] bg-[#F8FAFC] p-1 border border-[#E5E7EB]">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Camera Scan Mode"
            onPress={() => setMode('camera')}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-2.5 ${
              mode === 'camera'
                ? 'bg-white border border-[#E5E7EB] shadow-sm'
                : 'shadow-none'
            }`}
          >
            <Icon
              name="camera"
              size={18}
              color={mode === 'camera' ? '#0F766E' : '#6B7280'}
            />
            <Text
              className={`text-sm font-semibold ${
                mode === 'camera' ? 'text-[#0F766E]' : 'text-[#6B7280]'
              }`}
            >
              Camera Scan
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Text Translation Mode"
            onPress={() => setMode('text')}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-2.5 ${
              mode === 'text'
                ? 'bg-white border border-[#E5E7EB] shadow-sm'
                : 'shadow-none'
            }`}
          >
            <Icon
              name="keyboard"
              size={18}
              color={mode === 'text' ? '#0F766E' : '#6B7280'}
            />
            <Text
              className={`text-sm font-semibold ${
                mode === 'text' ? 'text-[#0F766E]' : 'text-[#6B7280]'
              }`}
            >
              Type Text
            </Text>
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4 gap-4"
          keyboardShouldPersistTaps="handled"
        >
          {/* ============================================================ */}
          {/* CAMERA SCAN MODE                                             */}
          {/* ============================================================ */}
          {mode === 'camera' && (
            <View className="gap-4">
              {/* Target Language Selection Pill Bar */}
              <View className="gap-2">
                <Text className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                  Translate into:
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {LANGUAGE_OPTIONS.map((opt) => {
                    const isSelected = opt.value === targetLang;
                    return (
                      <Pressable
                        key={opt.value}
                        accessibilityRole="button"
                        accessibilityLabel={`Target language: ${opt.label}`}
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => setTargetLang(opt.value as AssistantLanguage)}
                        className={`min-h-[44px] items-center justify-center rounded-2xl px-4 py-2 border ${
                          isSelected
                            ? 'bg-[#0F766E] border-[#0F766E]'
                            : 'bg-white border-[#E5E7EB]'
                        }`}
                      >
                        <Text
                          className={`text-sm font-bold ${
                            isSelected ? 'text-white' : 'text-[#111827]'
                          }`}
                        >
                          {opt.nativeLabel}
                        </Text>
                        <Text
                          className={`text-[11px] ${
                            isSelected ? 'text-white/80' : 'text-[#6B7280]'
                          }`}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Camera Viewfinder / Preview */}
              {!cameraPermission?.granted ? (
                <View className="items-center justify-center rounded-[14px] border border-[#E5E7EB] bg-white p-6 text-center gap-4">
                  <View className="h-16 w-16 items-center justify-center rounded-2xl bg-[#F0FDFA] border border-[#CCFBF1]">
                    <Icon name="camera" size={28} color="#0F766E" />
                  </View>
                  <View className="gap-1 items-center text-center">
                    <Text className="text-lg font-bold text-[#111827]">
                      Camera Access Needed
                    </Text>
                    <Text className="text-center text-sm leading-5 text-[#6B7280] max-w-[280px]">
                      Point your camera at medicine boxes, bus destination boards, government notices, or bills to translate them instantly.
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Grant camera permission"
                    onPress={requestCameraPermission}
                    className="min-h-[48px] items-center justify-center rounded-xl bg-[#0F766E] px-6 active:opacity-80"
                  >
                    <Text className="text-sm font-bold text-white">
                      Enable Camera Access
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View className="overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-black">
                  <View
                    className="relative h-[360px] w-full"
                    onLayout={(e) => {
                      const { width, height } = e.nativeEvent.layout;
                      if (width > 0 && height > 0) {
                        setViewfinderSize({ width, height });
                        setCropBox((prev) => {
                          if (prev.width === 280 && prev.x === 24) {
                            const w = Math.round(width * 0.78);
                            const h = Math.round(height * 0.52);
                            return {
                              x: Math.round((width - w) / 2),
                              y: Math.round((height - h) / 2),
                              width: w,
                              height: h,
                            };
                          }
                          return prev;
                        });
                      }
                    }}
                  >
                    {capturedPhotoUri ? (
                      <Image
                        source={{ uri: capturedPhotoUri }}
                        className="h-full w-full"
                        resizeMode="cover"
                        accessibilityLabel="Captured photo ready for translation"
                      />
                    ) : (
                      <CameraView
                        ref={cameraRef}
                        facing={cameraFacing}
                        style={{ height: '100%', width: '100%' }}
                        accessibilityLabel="Camera viewfinder. Frame text, signs, or medicine labels in center."
                      />
                    )}

                    {/* Google Lens Resizable Selection Box (Draggable with fingers) */}
                    {!capturedPhotoUri && viewfinderSize.width > 0 && (
                      <LensSelectionBox
                        containerWidth={viewfinderSize.width}
                        containerHeight={viewfinderSize.height}
                        box={cropBox}
                        onBoxChange={setCropBox}
                        onReset={handleResetCropBox}
                        disabled={isTranslatingImage}
                      />
                    )}

                    {/* Top Guidance Banner */}
                    <View
                      pointerEvents="none"
                      className="absolute top-3 inset-x-3 items-center"
                    >
                      <View className="flex-row items-center gap-1.5 rounded-full bg-slate-950/80 px-3.5 py-1.5 border border-white/10 backdrop-blur-md">
                        <Icon name="info" size={14} color="#E2E8F0" />
                        <Text className="text-xs font-semibold text-slate-200">
                          {capturedPhotoUri
                            ? 'Analyzing image text…'
                            : 'Aim at medicine strips, boards, or notices'}
                        </Text>
                      </View>
                    </View>

                    {/* Camera Flip Button */}
                    {!capturedPhotoUri && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Flip camera"
                        onPress={() =>
                          setCameraFacing((f) => (f === 'back' ? 'front' : 'back'))
                        }
                        className="absolute bottom-3 right-3 h-11 w-11 items-center justify-center rounded-full bg-slate-900/80 border border-white/10 active:opacity-75"
                      >
                        <Icon name="camera-flip" size={18} color="#FFFFFF" />
                      </Pressable>
                    )}

                    {/* Translating Spinner Overlay */}
                    {isTranslatingImage && (
                      <View className="absolute inset-0 bg-slate-950/85 items-center justify-center gap-3">
                        <ActivityIndicator size="large" color="#0F766E" />
                        <Text className="text-base font-bold text-white">
                          Reading & Translating…
                        </Text>
                        <Text className="text-xs text-slate-300">
                          Extracting text into {targetLangOption.nativeLabel}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Shutter / Action Bar */}
                  <View className="flex-row items-center justify-center border-t border-[#E5E7EB] bg-white p-4">
                    {imageResult || capturedPhotoUri ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Scan another photo"
                        onPress={handleRetakePhoto}
                        className="min-h-[50px] flex-row items-center justify-center gap-2 rounded-2xl bg-white border border-[#D1D5DB] px-6 active:opacity-80"
                      >
                        <Icon name="camera" size={18} color="#0F766E" />
                        <Text className="text-sm font-bold text-[#111827]">
                          Scan Another Photo
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Take photo and translate"
                        accessibilityHint="Captures photo and reads text aloud in selected language"
                        disabled={isTranslatingImage}
                        onPress={handleCapturePhoto}
                        className="h-20 w-20 items-center justify-center rounded-full border-4 border-[#D1D5DB] bg-white active:scale-95"
                      >
                        <View className="h-14 w-14 items-center justify-center rounded-full bg-[#0F766E] shadow-lg">
                          <Icon name="camera" size={22} color="#FFFFFF" />
                        </View>
                      </Pressable>
                    )}
                  </View>
                </View>
              )}

              {/* Error Box */}
              {imageError && (
                <View
                  accessibilityLiveRegion="polite"
                  className="rounded-2xl border-2 border-[#DC2626] bg-[#FEF2F2] p-4 gap-2"
                >
                  <View className="flex-row items-center gap-2">
                    <Icon name="warning" size={18} color="#DC2626" />
                    <Text className="text-sm font-bold text-[#991B1B]">
                      Could not translate image
                    </Text>
                  </View>
                  <Text className="text-xs leading-5 text-[#991B1B]">
                    {imageError}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Try scanning again"
                    onPress={handleRetakePhoto}
                    className="self-start rounded-xl bg-[#DC2626]/10 px-4 py-2 border border-[#DC2626]/30 mt-1 active:opacity-80"
                  >
                    <Text className="text-xs font-bold text-[#991B1B]">
                      Try Again
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Translation Result Card */}
              {imageResult && (
                <View className="gap-3 rounded-[14px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
                  {/* Header / Summary Tag */}
                  <View className="flex-row flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EB] pb-3">
                    <View className="flex-row items-center gap-1.5 rounded-full bg-[#F0FDFA] border border-[#CCFBF1] px-3 py-1">
                      <Icon name="check" size={14} color="#0F766E" />
                      <Text className="text-xs font-bold text-[#0F766E]">
                        {imageResult.detectedLanguage ?? 'Detected'} → {targetLangOption.nativeLabel}
                      </Text>
                    </View>

                    <Text className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
                      Visual Translation
                    </Text>
                  </View>

                  {/* Context Note / Item Summary (Crucial for medicine dosage, notices, signs) */}
                  {imageResult.itemSummary ? (
                    <View className="rounded-2xl bg-[#F0FDFA] border border-[#CCFBF1] p-3.5 gap-1">
                      <View className="flex-row items-center gap-1.5">
                        <Icon name="info" size={14} color="#0F766E" />
                        <Text className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                          Key Item Summary
                        </Text>
                      </View>
                      <Text className="text-sm leading-5 font-semibold text-[#111827]">
                        {imageResult.itemSummary}
                      </Text>
                    </View>
                  ) : null}

                  {/* Primary Translated Output */}
                  <View className="gap-1.5 pt-1">
                    <Text className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                      Translated Meaning:
                    </Text>
                    <Text
                      selectable
                      className="text-lg leading-7 font-bold text-[#111827]"
                    >
                      {imageResult.translatedText}
                    </Text>
                  </View>

                  {/* Audio Readout Button (Vital for illiteracy & visual impairment) */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      activeSpeakingText === imageResult.translatedText
                        ? 'Stop speaking translation'
                        : 'Listen to translation spoken aloud'
                    }
                    onPress={() =>
                      handleSpeak(imageResult.translatedText, targetLang)
                    }
                    className={`min-h-[52px] flex-row items-center justify-center gap-2.5 rounded-2xl px-4 mt-2 active:opacity-85 ${
                      activeSpeakingText === imageResult.translatedText
                        ? 'bg-[#D97706]'
                        : 'bg-[#0F766E]'
                    }`}
                  >
                    {activeSpeakingText === imageResult.translatedText ? (
                      <>
                        <Icon name="stop" size={16} color="#FFFFFF" />
                        <Text className="text-base font-bold text-white">
                          Stop
                        </Text>
                      </>
                    ) : (
                      <>
                        <Icon name="speaker" size={18} color="#FFFFFF" />
                        <Text className="text-base font-bold text-white">
                          Listen Aloud
                        </Text>
                      </>
                    )}
                  </Pressable>

                  {/* Original Text Accordion */}
                  {imageResult.extractedText ? (
                    <View className="pt-2 border-t border-[#E5E7EB]">
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Toggle original text read from image"
                        onPress={() => setShowOriginalText((s) => !s)}
                        className="flex-row items-center justify-between py-1"
                      >
                        <Text className="text-xs font-semibold text-[#6B7280]">
                          Original text from photo
                        </Text>
                        <View className="flex-row items-center gap-1">
                          <Text className="text-xs font-bold text-[#0F766E]">
                            {showOriginalText ? 'Hide' : 'Show'}
                          </Text>
                          <Icon
                            name={showOriginalText ? 'chevron-up' : 'chevron-down'}
                            size={14}
                            color="#0F766E"
                          />
                        </View>
                      </Pressable>

                      {showOriginalText && (
                        <View className="mt-2 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] p-3 gap-2">
                          <Text
                            selectable
                            className="text-xs leading-5 text-[#111827] font-mono"
                          >
                            {imageResult.extractedText}
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          )}

          {/* ============================================================ */}
          {/* TYPE TEXT MODE                                               */}
          {/* ============================================================ */}
          {mode === 'text' && (
            <View className="gap-4">
              {/* Language Selection Row */}
              <View className="flex-row items-center justify-between gap-2 rounded-2xl bg-white border border-[#E5E7EB] p-3">
                {/* Source Picker */}
                <View className="flex-1 gap-1">
                  <Text className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">
                    From
                  </Text>
                  <Text className="text-sm font-bold text-[#111827]">
                    {sourceLangOption.nativeLabel}
                  </Text>
                </View>

                {/* Swap Button */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Swap languages"
                  onPress={swapLanguages}
                  className="h-10 w-10 items-center justify-center rounded-full bg-[#F8FAFC] border border-[#E5E7EB] active:opacity-75"
                >
                  <Icon name="swap" size={18} color="#0F766E" />
                </Pressable>

                {/* Target Picker */}
                <View className="flex-1 items-end gap-1">
                  <Text className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">
                    To
                  </Text>
                  <Text className="text-sm font-bold text-[#0F766E]">
                    {targetLangOption.nativeLabel}
                  </Text>
                </View>
              </View>

              {/* Target Language Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {LANGUAGE_OPTIONS.filter((o) => o.value !== sourceLang).map((opt) => {
                  const isSelected = opt.value === targetLang;
                  return (
                    <Pressable
                      key={opt.value}
                      accessibilityRole="button"
                      accessibilityLabel={`Translate to: ${opt.label}`}
                      onPress={() => setTargetLang(opt.value as AssistantLanguage)}
                      className={`min-h-[40px] items-center justify-center rounded-xl px-3 py-1.5 border ${
                        isSelected
                          ? 'bg-[#0F766E] border-[#0F766E]'
                          : 'bg-white border-[#E5E7EB]'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          isSelected ? 'text-white' : 'text-[#111827]'
                        }`}
                      >
                        {opt.nativeLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Text Input Card */}
              <View className="gap-2 rounded-2xl bg-white border border-[#E5E7EB] p-3.5">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                    Enter Text
                  </Text>
                  {draft.length > 0 && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Clear text"
                      onPress={handleClearText}
                      className="px-2 py-1 active:opacity-75"
                    >
                      <Text className="text-xs font-bold text-[#0F766E]">
                        Clear
                      </Text>
                    </Pressable>
                  )}
                </View>

                <TextInput
                  accessibilityLabel="Text to translate"
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Type or paste sentences here (e.g. medical directions, notices, messages)…"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  maxLength={MAX_INPUT_CHARS}
                  editable={!isTranslatingText}
                  className="min-h-[130px] text-base leading-6 text-[#111827]"
                  textAlignVertical="top"
                />

                <View className="flex-row items-center justify-between border-t border-[#E5E7EB] pt-2">
                  {draft.trim().length > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Listen to entered text"
                      onPress={() => handleSpeak(draft, sourceLang)}
                      className={`flex-row items-center gap-1.5 rounded-lg px-2.5 py-1.5 border active:opacity-75 ${
                        activeSpeakingText === draft
                          ? 'bg-[#D97706] border-[#D97706]'
                          : 'bg-[#F8FAFC] border-[#E5E7EB]'
                      }`}
                    >
                      {activeSpeakingText === draft ? (
                        <>
                          <Icon name="stop" size={14} color="#FFFFFF" />
                          <Text className="text-xs font-semibold text-white">
                            Stop
                          </Text>
                        </>
                      ) : (
                        <>
                          <Icon name="speaker" size={14} color="#0F766E" />
                          <Text className="text-xs font-semibold text-[#111827]">
                            Listen
                          </Text>
                        </>
                      )}
                    </Pressable>
                  ) : <View />}

                  <Text className="text-xs text-[#6B7280] font-mono">
                    {draft.trim().length}/{MAX_INPUT_CHARS}
                  </Text>
                </View>
              </View>

              {/* Primary Translate Action Button */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Translate text now"
                disabled={draft.trim().length === 0 || isTranslatingText}
                onPress={() => translateText(draft)}
                className={`min-h-[54px] items-center justify-center rounded-2xl active:opacity-85 ${
                  draft.trim().length > 0 && !isTranslatingText
                    ? 'bg-[#0F766E]'
                    : 'bg-[#E5E7EB]'
                }`}
              >
                {isTranslatingText ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text className="text-base font-bold text-white">
                      Translating…
                    </Text>
                  </View>
                ) : (
                  <Text
                    className={`text-base font-bold ${
                      draft.trim().length > 0 ? 'text-white' : 'text-[#6B7280]'
                    }`}
                  >
                    Translate
                  </Text>
                )}
              </Pressable>

              {/* Error State */}
              {textError && (
                <View
                  accessibilityLiveRegion="polite"
                  className="rounded-2xl border-2 border-[#DC2626] bg-[#FEF2F2] p-4 gap-2"
                >
                  <View className="flex-row items-center gap-2">
                    <Icon name="warning" size={18} color="#DC2626" />
                    <Text className="text-sm font-bold text-[#991B1B]">
                      Translation error
                    </Text>
                  </View>
                  <Text className="text-xs leading-5 text-[#991B1B]">
                    {textError}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Retry translating text"
                    onPress={() => translateText(draft)}
                    className="self-start rounded-xl bg-[#DC2626]/10 px-4 py-2 border border-[#DC2626]/30 mt-1 active:opacity-80"
                  >
                    <Text className="text-xs font-bold text-[#991B1B]">
                      Retry
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Text Translation Output */}
              {textResult && (
                <View className="gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-4">
                  <View className="flex-row items-center justify-between border-b border-[#E5E7EB] pb-2">
                    <Text className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                      Translation ({targetLangOption.nativeLabel})
                    </Text>
                  </View>

                  <Text
                    selectable
                    className="text-base leading-7 font-bold text-[#111827]"
                  >
                    {textResult}
                  </Text>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      activeSpeakingText === textResult
                        ? 'Stop audio'
                        : 'Listen to translated text aloud'
                    }
                    onPress={() => handleSpeak(textResult, targetLang)}
                    className={`min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl px-4 mt-1 active:opacity-85 ${
                      activeSpeakingText === textResult
                        ? 'bg-[#D97706]'
                        : 'bg-[#0F766E]'
                    }`}
                  >
                    {activeSpeakingText === textResult ? (
                      <>
                        <Icon name="stop" size={16} color="#FFFFFF" />
                        <Text className="text-sm font-bold text-white">
                          Stop
                        </Text>
                      </>
                    ) : (
                      <>
                        <Icon name="speaker" size={18} color="#FFFFFF" />
                        <Text className="text-sm font-bold text-white">
                          Listen Aloud
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
