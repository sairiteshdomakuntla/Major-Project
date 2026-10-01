import { GoogleGenAI } from '@google/genai';
import type {
  AITextProvider,
  SupportedAssistantLanguage,
  TextGenerationRequest,
  TextGenerationResult,
} from './aiProvider.js';
import {
  ProviderError,
  ProviderNotConfiguredError,
} from './aiProvider.js';

const LANGUAGE_NAMES: Record<SupportedAssistantLanguage, string> = {
  en: 'English',
  hi: 'Hindi (हिन्दी)',
  te: 'Telugu (తెలుగు)',
};

function buildSystemInstruction(language: SupportedAssistantLanguage): string {
  return [
    'You are AgentBridge, an accessibility-first AI companion for people',
    'with visual, hearing, or speech difficulties.',
    `Respond in ${LANGUAGE_NAMES[language]}.`,
    'Keep answers clear and concise: short paragraphs and simple lists.',
    'Use plain text only — no tables, no heavy markdown formatting.',
    'If asked to see images, hear audio, or do anything beyond text,',
    'say so briefly and offer what you can do instead.',
    'Do not claim guaranteed accuracy for translations or factual answers.',
  ].join(' ');
}

/**
 * Gemini implementation of AITextProvider.
 * Credentials come only from backend env (GEMINI_API_KEY) — never the client.
 */
export class GeminiProvider implements AITextProvider {
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
      config: { systemInstruction: buildSystemInstruction(req.language) },
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
