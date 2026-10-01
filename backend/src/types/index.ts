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

export interface AssistantMessageRequest {
  message: string;
  history?: AssistantHistoryTurn[];
  language?: 'en' | 'hi' | 'te';
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
  language?: 'en' | 'hi' | 'te';
}

export interface VisionAnalyzeResponse {
  reply: string;
  intent: string;
  capability: string;
  model: string;
  language: string;
  availability: Record<string, boolean>;
}
