// Provider abstraction. All AI text generation goes through this interface
// so the model vendor can be swapped without touching routes/controllers.

export type SupportedAssistantLanguage = 'en' | 'hi' | 'te';

export interface ConversationTurn {
  role: 'user' | 'model';
  text: string;
}

export interface TextGenerationRequest {
  message: string;
  history: ConversationTurn[];
  language: SupportedAssistantLanguage;
  timeoutMs: number;
}

export interface TextGenerationResult {
  text: string;
  model: string;
}

export interface AITextProvider {
  readonly name: string;
  isConfigured(): boolean;
  generateText(req: TextGenerationRequest): Promise<TextGenerationResult>;
}

/** Server is missing credentials or they were rejected — maps to HTTP 503. */
export class ProviderNotConfiguredError extends Error {
  readonly statusCode = 503;
  constructor(message = 'Assistant is not configured on the server.') {
    super(message);
    this.name = 'ProviderNotConfiguredError';
  }
}

/** Provider call failed — maps to 429 (rate limit) or 502 (bad gateway). */
export class ProviderError extends Error {
  readonly statusCode: number;
  readonly retryable: boolean;
  constructor(message: string, statusCode = 502, retryable = true) {
    super(message);
    this.name = 'ProviderError';
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}
