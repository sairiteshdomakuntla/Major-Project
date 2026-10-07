import type { Request, Response } from 'express';
import { TranslationAgent } from '../agents/translation/index.js';
import { config } from '../config/index.js';
import type { SupportedAssistantLanguage } from '../providers/aiProvider.js';
import {
  ProviderError,
  ProviderNotConfiguredError,
} from '../providers/aiProvider.js';
import { GeminiProvider } from '../providers/geminiProvider.js';
import type {
  FocusRegion,
  TranslateImageRequest,
  TranslateImageResponse,
  TranslateRequest,
  TranslateResponse,
} from '../types/index.js';

export const MAX_TRANSLATE_CHARS = 4000;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const SUPPORTED_LANGUAGES: SupportedAssistantLanguage[] = [
  'en', 'hi', 'te', 'ta', 'kn', 'ml', 'kok',
];

const SUPPORTED_NEEDS = ['visual', 'hearing', 'speech', 'general'] as const;
type ValidNeed = typeof SUPPORTED_NEEDS[number];

const SUPPORTED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
type SupportedMime = (typeof SUPPORTED_MIME)[number];

const geminiProvider = new GeminiProvider(
  config.geminiApiKey,
  config.geminiModel,
);

const translationAgent = new TranslationAgent(
  geminiProvider,
  geminiProvider,
);

function stripDataUrlPrefix(value: string): string {
  const match = value.match(/^data:image\/[a-zA-Z+]+;base64,(.*)$/s);
  return match ? (match[1] ?? value) : value;
}

function validationError(res: Response, message: string): void {
  res.status(400).json({ error: { message, statusCode: 400 } });
}

function parseBody(body: unknown): TranslateRequest | string {
  if (typeof body !== 'object' || body === null) {
    return 'Request body must be a JSON object.';
  }
  const { text, from, to } = body as Record<string, unknown>;

  if (typeof text !== 'string' || text.trim().length === 0) {
    return 'Field "text" is required and must be non-empty text.';
  }
  if (text.trim().length > MAX_TRANSLATE_CHARS) {
    return `Field "text" must be at most ${MAX_TRANSLATE_CHARS} characters.`;
  }

  if (typeof from !== 'string' || !SUPPORTED_LANGUAGES.includes(from as SupportedAssistantLanguage)) {
    return 'Field "from" is required and must be one of: en, hi, te, ta, kn, ml, kok.';
  }
  if (typeof to !== 'string' || !SUPPORTED_LANGUAGES.includes(to as SupportedAssistantLanguage)) {
    return 'Field "to" is required and must be one of: en, hi, te, ta, kn, ml, kok.';
  }

  // Validate optional needs[]
  const rawNeeds = (body as Record<string, unknown>).needs;
  let needs: ValidNeed[] | undefined;
  if (rawNeeds !== undefined) {
    if (!Array.isArray(rawNeeds))
      return 'Field "needs" must be an array of strings.';
    const invalid = rawNeeds.filter(
      (n) => !SUPPORTED_NEEDS.includes(n as ValidNeed),
    );
    if (invalid.length > 0)
      return `Field "needs" contains unknown values: ${invalid.join(', ')}.`;
    needs = rawNeeds as ValidNeed[];
  }

  return {
    text: text.trim(),
    from: from as TranslateRequest['from'],
    to: to as TranslateRequest['to'],
    needs,
  };
}

export async function postTranslate(req: Request, res: Response): Promise<void> {
  const parsed = parseBody(req.body);
  if (typeof parsed === 'string') {
    validationError(res, parsed);
    return;
  }

  // Safe log: sizes only, never message content.
  console.log(
    `[translate] chars=${parsed.text.length} from=${parsed.from} to=${parsed.to}`,
  );

  try {
    const result = await translationAgent.translate({
      text: parsed.text,
      from: parsed.from as SupportedAssistantLanguage,
      to: parsed.to as SupportedAssistantLanguage,
      needs: parsed.needs,
    });
    const body: TranslateResponse = {
      translatedText: result.translatedText,
      from: result.from,
      to: result.to,
      model: result.model,
    };
    res.status(200).json(body);
  } catch (err) {
    if (err instanceof ProviderNotConfiguredError) {
      res.status(503).json({ error: { message: err.message, statusCode: 503 } });
      return;
    }
    if (err instanceof ProviderError) {
      res
        .status(err.statusCode)
        .json({ error: { message: err.message, statusCode: err.statusCode } });
      return;
    }
    throw err;
  }
}

function parseImageBody(body: unknown): TranslateImageRequest | string {
  if (typeof body !== 'object' || body === null) {
    return 'Request body must be a JSON object.';
  }
  const { image, mimeType, targetLanguage, sourceLanguage } = body as Record<
    string,
    unknown
  >;

  if (typeof image !== 'string' || image.trim().length === 0) {
    return 'Field "image" is required and must be base64 image data.';
  }
  const cleanImage = stripDataUrlPrefix(image.trim());
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleanImage)) {
    return 'Field "image" must be valid base64 image data.';
  }
  const approxBytes = Math.floor((cleanImage.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    return `Image is too large (max ${MAX_IMAGE_BYTES / 1024 / 1024}MB).`;
  }

  const mime = mimeType ?? 'image/jpeg';
  if (
    typeof mime !== 'string' ||
    !SUPPORTED_MIME.includes(mime as SupportedMime)
  ) {
    return 'Field "mimeType" must be one of: image/jpeg, image/png, image/webp.';
  }

  if (
    typeof targetLanguage !== 'string' ||
    !SUPPORTED_LANGUAGES.includes(targetLanguage as SupportedAssistantLanguage)
  ) {
    return 'Field "targetLanguage" is required and must be one of: en, hi, te, ta, kn, ml, kok.';
  }

  let srcLang: SupportedAssistantLanguage | undefined;
  if (sourceLanguage !== undefined) {
    if (
      typeof sourceLanguage !== 'string' ||
      !SUPPORTED_LANGUAGES.includes(sourceLanguage as SupportedAssistantLanguage)
    ) {
      return 'Field "sourceLanguage" must be one of: en, hi, te, ta, kn, ml, kok.';
    }
    srcLang = sourceLanguage as SupportedAssistantLanguage;
  }

  // Validate optional needs[]
  const rawNeeds = (body as Record<string, unknown>).needs;
  let needs: ValidNeed[] | undefined;
  if (rawNeeds !== undefined) {
    if (!Array.isArray(rawNeeds))
      return 'Field "needs" must be an array of strings.';
    const invalid = rawNeeds.filter(
      (n) => !SUPPORTED_NEEDS.includes(n as ValidNeed),
    );
    if (invalid.length > 0)
      return `Field "needs" contains unknown values: ${invalid.join(', ')}.`;
    needs = rawNeeds as ValidNeed[];
  }

  // Validate optional focusRegion
  const rawRegion = (body as Record<string, unknown>).focusRegion;
  let focusRegion: FocusRegion | undefined;
  if (rawRegion !== undefined) {
    if (typeof rawRegion !== 'object' || rawRegion === null) {
      return 'Field "focusRegion" must be an object with { x, y, width, height }.';
    }
    const { x, y, width, height } = rawRegion as Record<string, unknown>;
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof width !== 'number' ||
      typeof height !== 'number'
    ) {
      return 'Field "focusRegion" requires numbers for x, y, width, and height.';
    }
    focusRegion = {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      width: Math.max(0.01, Math.min(1, width)),
      height: Math.max(0.01, Math.min(1, height)),
    };
  }

  return {
    image: cleanImage,
    mimeType: mime as SupportedMime,
    targetLanguage: targetLanguage as SupportedAssistantLanguage,
    sourceLanguage: srcLang,
    needs,
    focusRegion,
  };
}

export async function postTranslateImage(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = parseImageBody(req.body);
  if (typeof parsed === 'string') {
    validationError(res, parsed);
    return;
  }

  console.log(
    `[translate-image] bytes=${Math.floor((parsed.image.length * 3) / 4)} target=${parsed.targetLanguage}${
      parsed.focusRegion ? ' withFocusRegion' : ''
    }`,
  );

  try {
    const result = await translationAgent.translateImage({
      imageBase64: parsed.image,
      mimeType: parsed.mimeType,
      targetLanguage: parsed.targetLanguage,
      sourceLanguage: parsed.sourceLanguage,
      needs: parsed.needs,
      focusRegion: parsed.focusRegion,
    });
    const body: TranslateImageResponse = {
      extractedText: result.extractedText,
      translatedText: result.translatedText,
      itemSummary: result.itemSummary,
      detectedLanguage: result.detectedLanguage,
      targetLanguage: result.targetLanguage,
      model: result.model,
    };
    res.status(200).json(body);
  } catch (err) {
    if (err instanceof ProviderNotConfiguredError) {
      res.status(503).json({ error: { message: err.message, statusCode: 503 } });
      return;
    }
    if (err instanceof ProviderError) {
      res
        .status(err.statusCode)
        .json({ error: { message: err.message, statusCode: err.statusCode } });
      return;
    }
    throw err;
  }
}

