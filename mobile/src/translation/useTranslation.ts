import { useMutation } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import type {
  AssistantLanguage,
  FocusRegion,
  TranslateImageResponse,
} from '../api/client';
import {
  ApiError,
  sendTranslateImageRequest,
  sendTranslateRequest,
} from '../api/client';
import { useProfileStore } from '../profile/store';

/** Maps technical failures to short, actionable sentences. */
function friendlyErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.statusCode === 429) {
      return 'The translator is busy. Wait a moment, then try again.';
    }
    if (err.statusCode === 503) {
      return 'The translator is not set up yet. Please try again later.';
    }
    if (err.message.toLowerCase().includes('timed out')) {
      return 'The translation took too long. Check your connection and try again.';
    }
    return err.message;
  }
  return 'Something went wrong. Check your connection and try again.';
}

interface TranslateTextVariables {
  text: string;
  from: AssistantLanguage;
  to: AssistantLanguage;
}

interface TranslateImageVariables {
  image: string;
  targetLanguage: AssistantLanguage;
  sourceLanguage?: AssistantLanguage;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  focusRegion?: FocusRegion;
}

/**
 * Hook for the translation feature. Manages source/target language selection,
 * text translation, camera/image translation, and results state.
 */
export function useTranslation() {
  const profileLanguage = useProfileStore((s) => s.language) as AssistantLanguage;
  const needs = useProfileStore((s) => s.needs);

  const [sourceLang, setSourceLang] = useState<AssistantLanguage>(
    profileLanguage === 'en' ? 'en' : profileLanguage,
  );
  const [targetLang, setTargetLang] = useState<AssistantLanguage>(
    profileLanguage === 'en' ? 'hi' : profileLanguage,
  );

  const [textResult, setTextResult] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);

  const [imageResult, setImageResult] = useState<TranslateImageResponse | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  // ── Text Translation Mutation ──
  const textMutation = useMutation({
    mutationFn: (vars: TranslateTextVariables) =>
      sendTranslateRequest({
        text: vars.text,
        from: vars.from,
        to: vars.to,
        needs: needs.length > 0 ? needs : undefined,
      }),
    onSuccess: (data) => {
      setTextResult(data.translatedText);
      setTextError(null);
    },
    onError: (err) => {
      setTextResult(null);
      setTextError(friendlyErrorMessage(err));
    },
  });

  // ── Image Translation Mutation ──
  const imageMutation = useMutation({
    mutationFn: (vars: TranslateImageVariables) =>
      sendTranslateImageRequest({
        image: vars.image,
        targetLanguage: vars.targetLanguage,
        sourceLanguage: vars.sourceLanguage,
        mimeType: vars.mimeType,
        needs: needs.length > 0 ? needs : undefined,
        focusRegion: vars.focusRegion,
      }),
    onSuccess: (data) => {
      setImageResult(data);
      setImageError(null);
    },
    onError: (err) => {
      setImageResult(null);
      setImageError(friendlyErrorMessage(err));
    },
  });

  const translateText = useCallback(
    (text: string) => {
      const trimmed = text.trim().slice(0, 4000);
      if (trimmed.length === 0 || textMutation.isPending) return;
      setTextError(null);
      textMutation.mutate({ text: trimmed, from: sourceLang, to: targetLang });
    },
    [sourceLang, targetLang, textMutation],
  );

  const translateImage = useCallback(
    (
      base64Image: string,
      mimeType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
      focusRegion?: FocusRegion,
    ) => {
      if (imageMutation.isPending) return;
      setImageError(null);
      imageMutation.mutate({
        image: base64Image,
        targetLanguage: targetLang,
        sourceLanguage: sourceLang !== targetLang ? sourceLang : undefined,
        mimeType,
        focusRegion,
      });
    },
    [sourceLang, targetLang, imageMutation],
  );

  const swapLanguages = useCallback(() => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setTextResult(null);
    setTextError(null);
  }, [sourceLang, targetLang]);

  const clearTextResult = useCallback(() => {
    setTextResult(null);
    setTextError(null);
    textMutation.reset();
  }, [textMutation]);

  const clearImageResult = useCallback(() => {
    setImageResult(null);
    setImageError(null);
    imageMutation.reset();
  }, [imageMutation]);

  return {
    sourceLang,
    targetLang,
    setSourceLang,
    setTargetLang,
    swapLanguages,

    // Text mode
    textResult,
    textError,
    isTranslatingText: textMutation.isPending,
    translateText,
    clearTextResult,

    // Image mode
    imageResult,
    imageError,
    isTranslatingImage: imageMutation.isPending,
    translateImage,
    clearImageResult,

    // Compatibility aliases
    result: textResult,
    error: textError,
    isTranslating: textMutation.isPending,
    translate: translateText,
    clearResult: clearTextResult,
  };
}
