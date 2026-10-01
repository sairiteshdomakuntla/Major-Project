import type { Request, Response } from 'express';
import { MasterAgent } from '../agents/master/index.js';
import { config } from '../config/index.js';
import type { SupportedAssistantLanguage } from '../providers/aiProvider.js';
import {
  ProviderError,
  ProviderNotConfiguredError,
} from '../providers/aiProvider.js';
import { GeminiProvider } from '../providers/geminiProvider.js';
import type { VisionAnalyzeRequest } from '../types/index.js';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_VISION_MESSAGE_CHARS = 4000;
export const MAX_VISION_HISTORY_TURNS = 20;
export const DEFAULT_VISION_PROMPT =
  'Describe this image for a blind person: what is in front of the camera, key objects and their positions, any people, and quote any readable text exactly.';

const SUPPORTED_LANGUAGES: SupportedAssistantLanguage[] = ['en', 'hi', 'te'];
const SUPPORTED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
type SupportedMime = (typeof SUPPORTED_MIME)[number];

const masterAgent = new MasterAgent(
  new GeminiProvider(config.geminiApiKey, config.geminiModel),
);

function stripDataUrlPrefix(value: string): string {
  const match = value.match(/^data:image\/[a-zA-Z+]+;base64,(.*)$/s);
  return match ? (match[1] ?? value) : value;
}

function parseBody(body: unknown): VisionAnalyzeRequest | string {
  if (typeof body !== 'object' || body === null) {
    return 'Request body must be a JSON object.';
  }
  const { image, mimeType, message, history, language } = body as Record<
    string,
    unknown
  >;

  if (typeof image !== 'string' || image.trim().length === 0) {
    return 'Field "image" is required and must be base64 image data.';
  }
  const imageBase64 = stripDataUrlPrefix(image.trim());
  // Validate base64 shape before measuring.
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(imageBase64)) {
    return 'Field "image" must be valid base64 image data.';
  }
  const approxBytes = Math.floor((imageBase64.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    return `Image is too large (max ${MAX_IMAGE_BYTES / 1024 / 1024}MB).`;
  }

  const mime: unknown = mimeType ?? 'image/jpeg';
  if (
    typeof mime !== 'string' ||
    !SUPPORTED_MIME.includes(mime as SupportedMime)
  ) {
    return 'Field "mimeType" must be one of: image/jpeg, image/png, image/webp.';
  }

  if (message !== undefined && typeof message !== 'string') {
    return 'Field "message" must be text.';
  }
  const prompt =
    typeof message === 'string' && message.trim().length > 0
      ? message.trim().slice(0, MAX_VISION_MESSAGE_CHARS)
      : DEFAULT_VISION_PROMPT;

  if (history !== undefined) {
    if (!Array.isArray(history)) {
      return 'Field "history" must be an array of { role, text }.';
    }
    if (history.length > MAX_VISION_HISTORY_TURNS) {
      return `Field "history" must contain at most ${MAX_VISION_HISTORY_TURNS} turns.`;
    }
    for (const turn of history) {
      if (typeof turn !== 'object' || turn === null) {
        return 'Each history turn must be an object with { role, text }.';
      }
      const { role, text } = turn as Record<string, unknown>;
      if (role !== 'user' && role !== 'model' && role !== 'assistant') {
        return 'Each history turn role must be "user" or "model".';
      }
      if (typeof text !== 'string' || text.trim().length === 0) {
        return 'Each history turn must have non-empty text.';
      }
      if (text.length > MAX_VISION_MESSAGE_CHARS) {
        return `History text must be at most ${MAX_VISION_MESSAGE_CHARS} characters per turn.`;
      }
    }
  }

  if (
    language !== undefined &&
    !SUPPORTED_LANGUAGES.includes(language as SupportedAssistantLanguage)
  ) {
    return 'Field "language" must be one of: en, hi, te.';
  }

  return {
    image: imageBase64,
    mimeType: mime as SupportedMime,
    message: prompt,
    history: (history ?? []) as VisionAnalyzeRequest['history'],
    language: (language as SupportedAssistantLanguage | undefined) ?? 'en',
  };
}

export async function postVisionAnalyze(req: Request, res: Response): Promise<void> {
  const parsed = parseBody(req.body);
  if (typeof parsed === 'string') {
    res.status(400).json({ error: { message: parsed, statusCode: 400 } });
    return;
  }

  const history = (parsed.history ?? []).map((t) => ({
    role: (t.role === 'assistant' ? 'model' : t.role) as 'user' | 'model',
    text: t.text,
  }));

  // Safe log: sizes only — image bytes and text lengths, never content.
  console.log(
    `[vision] imageBytes~${Math.floor((parsed.image.length * 3) / 4)} mime=${parsed.mimeType} msgChars=${parsed.message.length} history=${history.length} lang=${parsed.language}`,
  );

  // Images are analyzed in memory and never written to disk or stored.
  try {
    const result = await masterAgent.handleVision({
      imageBase64: parsed.image,
      mimeType: parsed.mimeType,
      message: parsed.message,
      history,
      language: parsed.language ?? 'en',
      timeoutMs: config.geminiVisionTimeoutMs,
      hasImageContext: history.length > 0,
    });
    res.status(200).json({
      reply: result.reply,
      intent: result.intent,
      capability: result.capability,
      model: result.model,
      language: result.language,
      availability: result.availability,
    });
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
