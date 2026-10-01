// Master Agent — orchestration layer.
// Accepts normalized requests, labels intent, routes to the live capability
// (text-chat via the AI provider), and returns a consistent response.
// Vision / speech / translation report honest unavailability until those
// agents are actually integrated — nothing here pretends to work.

import type {
  AITextProvider,
  AIVisionProvider,
  ConversationTurn,
  SupportedAssistantLanguage,
} from '../../providers/aiProvider.js';

export type AssistantCapability =
  | 'text-chat'
  | 'vision'
  | 'speech'
  | 'translation';

export type AssistantIntent =
  | 'question'
  | 'help'
  | 'translation-request'
  | 'vision-describe'
  | 'vision-read'
  | 'vision-followup'
  | 'chat';

/** Which capabilities are actually live. Mobile can use this for honest UI. */
export const CAPABILITY_AVAILABILITY: Record<AssistantCapability, boolean> = {
  'text-chat': true,
  vision: true,
  speech: false,
  translation: false,
};

export interface MasterAgentRequest {
  message: string;
  history: ConversationTurn[];
  language: SupportedAssistantLanguage;
  timeoutMs: number;
}

export interface MasterAgentVisionRequest extends MasterAgentRequest {
  imageBase64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  /** True when the image was already described and this is a follow-up. */
  hasImageContext: boolean;
}

export interface MasterAgentResponse {
  reply: string;
  intent: AssistantIntent;
  capability: AssistantCapability;
  model: string;
  language: SupportedAssistantLanguage;
  availability: Record<AssistantCapability, boolean>;
}

/** Lightweight intent label for metadata/routing — not a restriction. */
export function detectIntent(message: string): AssistantIntent {
  const text = message.trim().toLowerCase();
  if (
    /^(translate|translation|how do you say|what does .* mean in)\b/.test(text) ||
    /\btranslate\b.*\b(to|into|in)\b/.test(text)
  ) {
    return 'translation-request';
  }
  if (
    text.endsWith('?') ||
    /^(who|what|when|where|why|how|which|can you|could you|please explain)\b/.test(text)
  ) {
    return 'question';
  }
  if (/\b(help|how do i|how to|assist|support)\b/.test(text)) {
    return 'help';
  }
  return 'chat';
}

/** Standard message for modalities that are not built yet. */
export function capabilityUnavailable(capability: AssistantCapability): string {
  const names: Record<AssistantCapability, string> = {
    'text-chat': 'text chat',
    vision: 'image understanding',
    speech: 'speech input/output',
    translation: 'dedicated translation',
  };
  return (
    `${names[capability]} is not available yet — it is on the AgentBridge ` +
    `roadmap. I can still help with text questions in the meantime.`
  );
}

export class MasterAgent {
  constructor(private readonly textProvider: AITextProvider & AIVisionProvider) {}

  async handle(req: MasterAgentRequest): Promise<MasterAgentResponse> {
    const intent = detectIntent(req.message);
    // Single live capability in this iteration; the registry above makes
    // future routing (vision/speech/translation) a localized change.
    const capability: AssistantCapability = 'text-chat';

    const result = await this.textProvider.generateText({
      message: req.message,
      history: req.history,
      language: req.language,
      timeoutMs: req.timeoutMs,
    });

    return {
      reply: result.text,
      intent,
      capability,
      model: result.model,
      language: req.language,
      availability: { ...CAPABILITY_AVAILABILITY },
    };
  }

  async handleVision(req: MasterAgentVisionRequest): Promise<MasterAgentResponse> {
    const text = req.message.toLowerCase();
    const intent: AssistantIntent = req.hasImageContext
      ? 'vision-followup'
      : /\b(read|text|letter|sign|label|menu)\b/.test(text)
        ? 'vision-read'
        : 'vision-describe';

    const result = await this.textProvider.generateVisionText({
      imageBase64: req.imageBase64,
      mimeType: req.mimeType,
      message: req.message,
      history: req.history,
      language: req.language,
      timeoutMs: req.timeoutMs,
    });

    return {
      reply: result.text,
      intent,
      capability: 'vision',
      model: result.model,
      language: req.language,
      availability: { ...CAPABILITY_AVAILABILITY },
    };
  }
}
