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
    <SafeAreaView className="flex-1 bg-slate-950">
      <StatusBar style="light" />

      {/* Top Header */}
      <View className="flex-row items-center justify-between border-b border-slate-800/80 px-4 py-2.5">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back to home"
          onPress={async () => {
            await stopSpeaking();
            router.back();
          }}
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-slate-900 border border-slate-800 active:opacity-75"
        >
          <Text className="text-xl font-bold text-slate-200">‹</Text>
        </Pressable>

        <View className="items-center">
          <Text accessibilityRole="header" className="text-base font-bold text-slate-50">
            Translate
          </Text>
          <Text className="text-[11px] font-medium text-slate-400">
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
        <View className="flex-row rounded-2xl bg-slate-900 p-1 border border-slate-800">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Camera Scan Mode"
            onPress={() => setMode('camera')}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-2.5 ${
              mode === 'camera'
                ? 'bg-slate-800 border border-slate-700/60 shadow-sm'
                : 'opacity-70 shadow-none'
            }`}
          >
            <Text className="text-sm">📷</Text>
            <Text
              className={`text-sm font-semibold ${
                mode === 'camera' ? 'text-sky-300' : 'text-slate-400'
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
                ? 'bg-slate-800 border border-slate-700/60 shadow-sm'
                : 'opacity-70 shadow-none'
            }`}
          >
            <Text className="text-sm">✍️</Text>
            <Text
              className={`text-sm font-semibold ${
                mode === 'text' ? 'text-sky-300' : 'text-slate-400'
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
                <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400">
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
                            ? 'bg-sky-400 border-sky-300'
                            : 'bg-slate-900 border-slate-800'
                        }`}
                      >
                        <Text
                          className={`text-sm font-bold ${
                            isSelected ? 'text-slate-950' : 'text-slate-200'
                          }`}
                        >
                          {opt.nativeLabel}
                        </Text>
                        <Text
                          className={`text-[11px] ${
                            isSelected ? 'text-slate-800' : 'text-slate-400'
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
                <View className="items-center justify-center rounded-3xl border border-slate-800 bg-slate-900 p-6 text-center gap-4">
                  <View className="h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/10 border border-sky-400/20">
                    <Text className="text-3xl">📷</Text>
                  </View>
                  <View className="gap-1 items-center text-center">
                    <Text className="text-lg font-bold text-slate-100">
                      Camera Access Needed
                    </Text>
                    <Text className="text-center text-sm leading-5 text-slate-400 max-w-[280px]">
                      Point your camera at medicine boxes, bus destination boards, government notices, or bills to translate them instantly.
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Grant camera permission"
                    onPress={requestCameraPermission}
                    className="min-h-[48px] items-center justify-center rounded-xl bg-sky-400 px-6 active:opacity-80"
                  >
                    <Text className="text-sm font-bold text-slate-950">
                      Enable Camera Access
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View className="overflow-hidden rounded-3xl border border-slate-800 bg-black">
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
                        <Text className="text-xs">💡</Text>
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
                        <Text className="text-lg text-white">🔄</Text>
                      </Pressable>
                    )}

                    {/* Translating Spinner Overlay */}
                    {isTranslatingImage && (
                      <View className="absolute inset-0 bg-slate-950/85 items-center justify-center gap-3">
                        <ActivityIndicator size="large" color="#38BDF8" />
                        <Text className="text-base font-bold text-white">
                          Reading & Translating…
                        </Text>
                        <Text className="text-xs text-slate-400">
                          Extracting text into {targetLangOption.nativeLabel}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Shutter / Action Bar */}
                  <View className="flex-row items-center justify-center border-t border-slate-800 bg-slate-900/90 p-4">
                    {imageResult || capturedPhotoUri ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Scan another photo"
                        onPress={handleRetakePhoto}
                        className="min-h-[50px] flex-row items-center justify-center gap-2 rounded-2xl bg-slate-800 border border-slate-700 px-6 active:opacity-80"
                      >
                        <Text className="text-base">📸</Text>
                        <Text className="text-sm font-bold text-slate-100">
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
                        className="h-20 w-20 items-center justify-center rounded-full border-4 border-slate-700 bg-slate-950 active:scale-95"
                      >
                        <View className="h-14 w-14 items-center justify-center rounded-full bg-sky-400 shadow-lg">
                          <Text className="text-xl">📷</Text>
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
                  className="rounded-2xl border-2 border-red-500/80 bg-red-950/30 p-4 gap-2"
                >
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base font-bold text-red-400">⚠️</Text>
                    <Text className="text-sm font-bold text-red-200">
                      Could not translate image
                    </Text>
                  </View>
                  <Text className="text-xs leading-5 text-red-300">
                    {imageError}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Try scanning again"
                    onPress={handleRetakePhoto}
                    className="self-start rounded-xl bg-red-500/20 px-4 py-2 border border-red-500/40 mt-1 active:opacity-80"
                  >
                    <Text className="text-xs font-bold text-red-200">
                      Try Again
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Translation Result Card */}
              {imageResult && (
                <View className="gap-3 rounded-3xl border border-emerald-500/30 bg-slate-900 p-5 shadow-xl">
                  {/* Header / Summary Tag */}
                  <View className="flex-row flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <View className="flex-row items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1">
                      <Text className="text-xs text-emerald-400">✓</Text>
                      <Text className="text-xs font-bold text-emerald-300">
                        {imageResult.detectedLanguage ?? 'Detected'} → {targetLangOption.nativeLabel}
                      </Text>
                    </View>

                    <Text className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Visual Translation
                    </Text>
                  </View>

                  {/* Context Note / Item Summary (Crucial for medicine dosage, notices, signs) */}
                  {imageResult.itemSummary ? (
                    <View className="rounded-2xl bg-violet-950/40 border border-violet-500/30 p-3.5 gap-1">
                      <View className="flex-row items-center gap-1.5">
                        <Text className="text-xs">📋</Text>
                        <Text className="text-xs font-bold text-violet-300 uppercase tracking-wider">
                          Key Item Summary
                        </Text>
                      </View>
                      <Text className="text-sm leading-5 font-semibold text-violet-100">
                        {imageResult.itemSummary}
                      </Text>
                    </View>
                  ) : null}

                  {/* Primary Translated Output */}
                  <View className="gap-1.5 pt-1">
                    <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Translated Meaning:
                    </Text>
                    <Text
                      selectable
                      className="text-lg leading-7 font-bold text-slate-50"
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
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-sky-400 text-slate-950'
                    }`}
                  >
                    <Text className="text-base font-bold text-slate-950">
                      {activeSpeakingText === imageResult.translatedText
                        ? '◼ Stop Speaking'
                        : '🔊 Listen Aloud'}
                    </Text>
                  </Pressable>

                  {/* Original Text Accordion */}
                  {imageResult.extractedText ? (
                    <View className="pt-2 border-t border-slate-800">
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Toggle original text read from image"
                        onPress={() => setShowOriginalText((s) => !s)}
                        className="flex-row items-center justify-between py-1"
                      >
                        <Text className="text-xs font-semibold text-slate-400">
                          Original text from photo
                        </Text>
                        <Text className="text-xs font-bold text-sky-400">
                          {showOriginalText ? 'Hide ▲' : 'Show ▼'}
                        </Text>
                      </Pressable>

                      {showOriginalText && (
                        <View className="mt-2 rounded-xl bg-slate-950 border border-slate-800 p-3 gap-2">
                          <Text
                            selectable
                            className="text-xs leading-5 text-slate-300 font-mono"
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
              <View className="flex-row items-center justify-between gap-2 rounded-2xl bg-slate-900 border border-slate-800 p-3">
                {/* Source Picker */}
                <View className="flex-1 gap-1">
                  <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    From
                  </Text>
                  <Text className="text-sm font-bold text-slate-100">
                    {sourceLangOption.nativeLabel}
                  </Text>
                </View>

                {/* Swap Button */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Swap languages"
                  onPress={swapLanguages}
                  className="h-10 w-10 items-center justify-center rounded-full bg-slate-800 border border-slate-700 active:opacity-75"
                >
                  <Text className="text-base text-sky-400 font-bold">⇄</Text>
                </Pressable>

                {/* Target Picker */}
                <View className="flex-1 items-end gap-1">
                  <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    To
                  </Text>
                  <Text className="text-sm font-bold text-sky-400">
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
                          ? 'bg-sky-400 border-sky-300'
                          : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          isSelected ? 'text-slate-950' : 'text-slate-300'
                        }`}
                      >
                        {opt.nativeLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Text Input Card */}
              <View className="gap-2 rounded-2xl bg-slate-900 border border-slate-800 p-3.5">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Enter Text
                  </Text>
                  {draft.length > 0 && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Clear text"
                      onPress={handleClearText}
                      className="px-2 py-1 active:opacity-75"
                    >
                      <Text className="text-xs font-bold text-sky-400">
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
                  placeholderTextColor="#64748B"
                  multiline
                  maxLength={MAX_INPUT_CHARS}
                  editable={!isTranslatingText}
                  className="min-h-[130px] text-base leading-6 text-slate-50"
                  textAlignVertical="top"
                />

                <View className="flex-row items-center justify-between border-t border-slate-800/80 pt-2">
                  {draft.trim().length > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Listen to entered text"
                      onPress={() => handleSpeak(draft, sourceLang)}
                      className="flex-row items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 border border-slate-700 active:opacity-75"
                    >
                      <Text className="text-xs font-semibold text-slate-300">
                        {activeSpeakingText === draft ? '◼ Stop' : '🔊 Listen'}
                      </Text>
                    </Pressable>
                  ) : <View />}

                  <Text className="text-xs text-slate-600 font-mono">
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
                    ? 'bg-sky-400'
                    : 'bg-slate-800 opacity-60'
                }`}
              >
                {isTranslatingText ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator size="small" color="#0F172A" />
                    <Text className="text-base font-bold text-slate-950">
                      Translating…
                    </Text>
                  </View>
                ) : (
                  <Text
                    className={`text-base font-bold ${
                      draft.trim().length > 0 ? 'text-slate-950' : 'text-slate-500'
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
                  className="rounded-2xl border-2 border-red-500/80 bg-red-950/30 p-4 gap-2"
                >
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base font-bold text-red-400">⚠️</Text>
                    <Text className="text-sm font-bold text-red-200">
                      Translation error
                    </Text>
                  </View>
                  <Text className="text-xs leading-5 text-red-300">
                    {textError}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Retry translating text"
                    onPress={() => translateText(draft)}
                    className="self-start rounded-xl bg-red-500/20 px-4 py-2 border border-red-500/40 mt-1 active:opacity-80"
                  >
                    <Text className="text-xs font-bold text-red-200">
                      Retry
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Text Translation Output */}
              {textResult && (
                <View className="gap-3 rounded-2xl border border-emerald-500/30 bg-slate-900 p-4">
                  <View className="flex-row items-center justify-between border-b border-slate-800 pb-2">
                    <Text className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      Translation ({targetLangOption.nativeLabel})
                    </Text>
                  </View>

                  <Text
                    selectable
                    className="text-base leading-7 font-bold text-slate-50"
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
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-emerald-500 text-slate-950'
                    }`}
                  >
                    <Text className="text-sm font-bold text-slate-950">
                      {activeSpeakingText === textResult
                        ? '◼ Stop Audio'
                        : '🔊 Listen Aloud'}
                    </Text>
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
