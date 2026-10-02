import type { Request, Response } from 'express';
import { MasterAgent } from '../agents/master/index.js';
import { config } from '../config/index.js';
import type { SupportedAssistantLanguage } from '../providers/aiProvider.js';
import {
  ProviderError,
  ProviderNotConfiguredError,
} from '../providers/aiProvider.js';
import { GeminiProvider } from '../providers/geminiProvider.js';
import type {
  AssistantMessageRequest,
  AssistantMessageResponse,
} from '../types/index.js';

export const MAX_MESSAGE_CHARS = 4000;
export const MAX_HISTORY_TURNS = 20;

const SUPPORTED_LANGUAGES: SupportedAssistantLanguage[] = [
  'en', 'hi', 'te', 'ta', 'kn', 'ml', 'kok',
];

const SUPPORTED_NEEDS = ['visual', 'hearing', 'speech', 'general'] as const;
type ValidNeed = typeof SUPPORTED_NEEDS[number];

const masterAgent = new MasterAgent(
  new GeminiProvider(config.geminiApiKey, config.geminiModel),
);

function validationError(res: Response, message: string): void {
  res.status(400).json({ error: { message, statusCode: 400 } });
}

function parseBody(body: unknown): AssistantMessageRequest | string {
  if (typeof body !== 'object' || body === null) {
    return 'Request body must be a JSON object.';
  }
  const { message, history, language } = body as Record<string, unknown>;

  if (typeof message !== 'string' || message.trim().length === 0) {
    return 'Field "message" is required and must be non-empty text.';
  }
  if (message.trim().length > MAX_MESSAGE_CHARS) {
    return `Field "message" must be at most ${MAX_MESSAGE_CHARS} characters.`;
  }
  if (history !== undefined) {
    if (!Array.isArray(history)) {
      return 'Field "history" must be an array of { role, text }.';
    }
    if (history.length > MAX_HISTORY_TURNS) {
      return `Field "history" must contain at most ${MAX_HISTORY_TURNS} turns.`;
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
      if (text.length > MAX_MESSAGE_CHARS) {
        return `History text must be at most ${MAX_MESSAGE_CHARS} characters per turn.`;
      }
    }
  }
  if (
    language !== undefined &&
    !SUPPORTED_LANGUAGES.includes(language as SupportedAssistantLanguage)
  ) {
    return 'Field "language" must be one of: en, hi, te, ta, kn, ml, kok.';
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

  const lang = (language as SupportedAssistantLanguage | undefined) ?? 'en';
  return {
    message: message.trim(),
    history: (history ?? []) as AssistantMessageRequest['history'],
    language: lang,
    needs,
  };
}

export async function postAssistantMessage(req: Request, res: Response): Promise<void> {
  const parsed = parseBody(req.body);
  if (typeof parsed === 'string') {
    validationError(res, parsed);
    return;
  }

  // Normalize legacy 'assistant' role to the provider 'model' role.
  const history = (parsed.history ?? []).map((t) => ({
    role: (t.role === 'assistant' ? 'model' : t.role) as 'user' | 'model',
    text: t.text,
  }));

  // Safe log: sizes only, never message content.
  console.log(
    `[assistant] message chars=${parsed.message.length} history=${history.length} lang=${parsed.language}`,
  );

  try {
    const result = await masterAgent.handle({
      message: parsed.message,
      history,
      language: parsed.language ?? 'en',
      timeoutMs: config.geminiTimeoutMs,
      needs: parsed.needs,
    });
    const body: AssistantMessageResponse = {
      reply: result.reply,
      intent: result.intent,
      capability: result.capability,
      model: result.model,
      language: result.language,
      availability: result.availability,
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
