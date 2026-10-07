import { GoogleGenAI } from '@google/genai';
import type {
  AITextProvider,
  AIVisionProvider,
  AccessibilityNeed,
  SupportedAssistantLanguage,
  TextGenerationRequest,
  TextGenerationResult,
  VisionGenerationRequest,
  VisionGenerationResult,
} from './aiProvider.js';
import {
  ProviderError,
  ProviderNotConfiguredError,
} from './aiProvider.js';

const LANGUAGE_NAMES: Record<SupportedAssistantLanguage, string> = {
  en: 'English',
  hi: 'Hindi (हिन्दी)',
  te: 'Telugu (తెలుగు)',
  ta: 'Tamil (தமிழ்)',
  kn: 'Kannada (ಕನ್ನಡ)',
  ml: 'Malayalam (മലയാളം)',
  kok: 'Konkani (कोंकणी)',
};

function needsContext(needs: AccessibilityNeed[] | undefined): string {
  if (!needs || needs.length === 0) return '';
  const hints: string[] = [];
  if (needs.includes('visual'))
    hints.push(
      'The user is blind or has low vision — use spatial language (left, right, near, far) and always read any on-screen text aloud.',
    );
  if (needs.includes('hearing'))
    hints.push(
      'The user is deaf or hard of hearing — express everything in text; never refer to audio or sound cues.',
    );
  if (needs.includes('speech'))
    hints.push(
      'The user cannot speak easily — they may type or use a camera; keep responses concise enough to re-read quickly.',
    );
  if (needs.includes('general'))
    hints.push(
      'The user prefers simple, clutter-free layouts and language — use short sentences and avoid jargon.',
    );
  return hints.length > 0 ? ' ' + hints.join(' ') : '';
}

function buildSystemInstruction(
  language: SupportedAssistantLanguage,
  needs?: AccessibilityNeed[],
): string {
  return [
    'You are AgentBridge, an accessibility-first AI companion for people',
    'with visual, hearing, or speech difficulties.',
    `Respond in ${LANGUAGE_NAMES[language]}.`,
    'Keep answers clear and concise: short paragraphs and simple lists.',
    'Use plain text only — no tables, no heavy markdown formatting.',
    'If asked to see images, hear audio, or do anything beyond text,',
    'say so briefly and offer what you can do instead.',
    'Do not claim guaranteed accuracy for translations or factual answers.',
  ].join(' ') + needsContext(needs);
}

/**
 * Gemini implementation of AITextProvider.
 * Credentials come only from backend env (GEMINI_API_KEY) — never the client.
 */
export class GeminiProvider implements AITextProvider, AIVisionProvider {
  readonly name = 'gemini';
  private client: GoogleGenAI | null = null;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  private getClient(): GoogleGenAI {
    if (!this.isConfigured()) {
      throw new ProviderNotConfiguredError();
    }
    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey: this.apiKey });
    }
    return this.client;
  }

  async generateText(req: TextGenerationRequest): Promise<TextGenerationResult> {
    const client = this.getClient();

    const contents = [
      ...req.history.map((t) => ({
        role: t.role,
        parts: [{ text: t.text }],
      })),
      { role: 'user', parts: [{ text: req.message }] },
    ];

    const attempt = client.models.generateContent({
      model: this.model,
      contents,
      config: { systemInstruction: buildSystemInstruction(req.language, req.needs) },
    });

    let response;
    try {
      response = await withTimeout(attempt, req.timeoutMs);
    } catch (err) {
      throw mapError(err, this.model);
    }

    const text = response.text?.trim() ?? '';
    if (!text) {
      throw new ProviderError(
        'The AI returned an empty response. Please try again.',
        502,
        true,
      );
    }
    return { text, model: this.model };
  }

  async generateVisionText(req: VisionGenerationRequest): Promise<VisionGenerationResult> {
    const client = this.getClient();

    const contents = [
      ...req.history.map((t) => ({
        role: t.role,
        parts: [{ text: t.text }],
      })),
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: req.mimeType, data: req.imageBase64 } },
          { text: req.message },
        ],
      },
    ];

    const attempt = client.models.generateContent({
      model: this.model,
      contents,
      config: {
        systemInstruction:
          req.systemInstruction ?? buildVisionInstruction(req.language, req.needs),
      },
    });

    let response;
    try {
      response = await withTimeout(attempt, req.timeoutMs);
    } catch (err) {
      throw mapError(err, this.model);
    }

    const text = response.text?.trim() ?? '';
    if (!text) {
      throw new ProviderError(
        'The AI could not describe this image. Try a clearer photo and ask again.',
        502,
        true,
      );
    }
    return { text, model: this.model };
  }
}

/**
 * Vision prompt tuned for blind users: concrete spatial description plus
 * verbatim OCR. Plain text only — the result is read aloud by TTS.
 */
function buildVisionInstruction(
  language: SupportedAssistantLanguage,
  needs?: AccessibilityNeed[],
): string {
  return [
    'You are AgentBridge vision assistant. A blind person points their',
    'camera at something and needs to understand it.',
    `Respond in ${LANGUAGE_NAMES[language]}.`,
    'Describe the scene concretely: main subject first, then key objects',
    'with their positions (left, right, center, near, far) and any people.',
    'If there is readable text, quote it exactly under "Text in the image:".',
    'If the photo is dark, blurry, or unclear, say so first, then describe',
    'whatever you can make out.',
    'Never invent details you cannot see; state uncertainty plainly.',
    'Use plain text only — no tables, no heavy markdown.',
    'Do not claim your interpretation is guaranteed accurate.',
  ].join(' ') + needsContext(needs);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Provider timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function mapError(err: unknown, model: string): ProviderError | ProviderNotConfiguredError {
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status: unknown }).status)
      : NaN;
  // Safe server-side log: status + model + provider's own error text only.
  // Provider error strings are generic (no user content, no keys).
  const providerMessage =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: unknown }).message).slice(0, 200)
      : 'n/a';
  console.error(
    `[gemini] request failed (model=${model} status=${Number.isFinite(status) ? status : 'n/a'} detail=${providerMessage})`,
  );

  if (err instanceof Error && err.message.includes('timed out')) {
    return new ProviderError(
      'The AI took too long to respond. Please try again.',
      502,
      true,
    );
  }
  if (status === 429) {
    return new ProviderError(
      'The assistant is busy right now. Please wait a moment and try again.',
      429,
      true,
    );
  }
  if (status === 503) {
    return new ProviderError(
      'The AI is experiencing high demand right now. Please try again in a moment.',
      502,
      true,
    );
  }
  if (status === 401 || status === 403) {
    return new ProviderNotConfiguredError(
      'Assistant is unavailable — the server AI credentials were rejected.',
    );
  }
  return new ProviderError(
    'The assistant failed to respond. Please try again.',
    502,
    true,
  );
}
