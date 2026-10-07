export interface HealthResponse {
  status: 'ok';
  service: 'agentbridge-api';
}

export interface ApiInfoResponse {
  name: string;
  version: string;
  status: string;
  endpoints: string[];
}

export interface ErrorResponse {
  error: {
    message: string;
    statusCode: number;
  };
}

export type AssistantRole = 'user' | 'model' | 'assistant';

export interface AssistantHistoryTurn {
  role: AssistantRole;
  text: string;
}

export type AssistantLanguage = 'en' | 'hi' | 'te' | 'ta' | 'kn' | 'ml' | 'kok';

export type AccessibilityNeed = 'visual' | 'hearing' | 'speech' | 'general';

export interface AssistantMessageRequest {
  message: string;
  history?: AssistantHistoryTurn[];
  language?: AssistantLanguage;
  /** Optional: user's accessibility needs for personalised prompting. */
  needs?: AccessibilityNeed[];
}

export interface AssistantMessageResponse {
  reply: string;
  intent: string;
  capability: string;
  model: string;
  language: string;
  availability: Record<string, boolean>;
}

export type VisionMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface VisionHistoryTurn {
  role: 'user' | 'model' | 'assistant';
  text: string;
}

export interface VisionAnalyzeRequest {
  /** Base64 image data (data-URL prefix optional). Never stored. */
  image: string;
  mimeType: VisionMimeType;
  message: string;
  history?: VisionHistoryTurn[];
  language?: AssistantLanguage;
  /** Optional: user's accessibility needs for personalised prompting. */
  needs?: AccessibilityNeed[];
}

export interface VisionAnalyzeResponse {
  reply: string;
  intent: string;
  capability: string;
  model: string;
  language: string;
  availability: Record<string, boolean>;
}

export interface TranslateRequest {
  /** The text to translate. */
  text: string;
  /** Source language code. */
  from: AssistantLanguage;
  /** Target language code. */
  to: AssistantLanguage;
  /** Optional: user's accessibility needs for personalised prompting. */
  needs?: AccessibilityNeed[];
}

export interface TranslateResponse {
  translatedText: string;
  from: string;
  to: string;
  model: string;
}

export interface FocusRegion {
  /** 0 to 1 normalized horizontal start (left) */
  x: number;
  /** 0 to 1 normalized vertical start (top) */
  y: number;
  /** 0 to 1 normalized width */
  width: number;
  /** 0 to 1 normalized height */
  height: number;
}

export interface TranslateImageRequest {
  /** Base64 image data (data-URL prefix optional). Never stored. */
  image: string;
  mimeType?: VisionMimeType;
  /** Target language code to translate into. */
  targetLanguage: AssistantLanguage;
  /** Optional source language code (if already known; otherwise auto-detected). */
  sourceLanguage?: AssistantLanguage;
  /** Optional: user's accessibility needs for personalised prompting. */
  needs?: AccessibilityNeed[];
  /** Optional: user-selected focus bounding box to zero-in on specific text. */
  focusRegion?: FocusRegion;
}

export interface TranslateImageResponse {
  /** Original text extracted verbatim from the image. */
  extractedText: string;
  /** The translated text in the target language. */
  translatedText: string;
  /** Concise 1-2 sentence context note in target language (e.g. medicine dosage, bus route, notice). */
  itemSummary: string;
  /** Detected source language (e.g. "English", "Hindi"). */
  detectedLanguage?: string;
  /** Target language code. */
  targetLanguage: string;
  /** AI model used. */
  model: string;
}

