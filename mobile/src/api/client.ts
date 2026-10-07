// Centralized API client. All backend calls must go through API_BASE_URL.
// Never hardcode localhost throughout the app — import from here instead.
//
// Configure via EXPO_PUBLIC_API_URL:
// - Android emulator: http://10.0.2.2:4000 (emulator localhost != PC localhost)
// - Physical Android device (same Wi-Fi): http://<PC-LAN-IP>:4000 e.g. http://192.168.1.50:4000
// - iOS simulator / web: http://localhost:4000
// - Production: https://<deployed-api-host>

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000';

export interface HealthResponse {
  status: string;
  service: string;
}

export interface ApiInfoResponse {
  name: string;
  version: string;
  status: string;
  endpoints: string[];
}

export class ApiError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

async function fetchJson<T>(
  path: string,
  timeoutMs = 8000,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: init?.method ?? 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init?.body !== undefined
          ? { 'Content-Type': 'application/json' }
          : null),
      },
      ...(init?.body !== undefined
        ? { body: JSON.stringify(init.body) }
        : null),
    });
    if (!res.ok) {
      // Prefer the server's safe error message when available.
      let message = `Request failed with status ${res.status}`;
      try {
        const errBody = (await res.json()) as {
          error?: { message?: unknown };
        };
        if (typeof errBody?.error?.message === 'string') {
          message = errBody.error.message;
        }
      } catch {
        // Fall through to the generic message.
      }
      throw new ApiError(message, res.status);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(`Request timed out after ${timeoutMs}ms`);
    }
    throw new ApiError(
      err instanceof Error ? err.message : 'Network request failed',
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function getHealth(timeoutMs?: number): Promise<HealthResponse> {
  return fetchJson<HealthResponse>('/health', timeoutMs);
}

export function getApiInfo(timeoutMs?: number): Promise<ApiInfoResponse> {
  return fetchJson<ApiInfoResponse>('/api/v1', timeoutMs);
}

export type AssistantLanguage = 'en' | 'hi' | 'te' | 'ta' | 'kn' | 'ml' | 'kok';
export type AccessibilityNeed = 'visual' | 'hearing' | 'speech' | 'general';

export interface AssistantHistoryTurn {
  role: 'user' | 'model';
  text: string;
}

export interface AssistantMessageRequest {
  message: string;
  history: AssistantHistoryTurn[];
  language: AssistantLanguage;
  /** User's accessibility needs — forwarded to backend for prompt tuning. */
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

/** Provider calls can take a while — default timeout is 30s. */
export function sendAssistantMessage(
  req: AssistantMessageRequest,
  timeoutMs = 30000,
): Promise<AssistantMessageResponse> {
  return fetchJson<AssistantMessageResponse>(
    '/api/v1/assistant/message',
    timeoutMs,
    { method: 'POST', body: req },
  );
}

export type VisionMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface VisionHistoryTurn {
  role: 'user' | 'model';
  text: string;
}

export interface VisionAnalyzeRequest {
  /** Raw base64 (data-URL prefix optional). Images are analyzed, never stored. */
  image: string;
  mimeType: VisionMimeType;
  message?: string;
  history?: VisionHistoryTurn[];
  language: AssistantLanguage;
  /** User's accessibility needs — forwarded to backend for prompt tuning. */
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

/** Vision analysis moves more bytes — default timeout is 75s. */
export function analyzeVisionImage(
  req: VisionAnalyzeRequest,
  timeoutMs = 75000,
): Promise<VisionAnalyzeResponse> {
  return fetchJson<VisionAnalyzeResponse>('/api/v1/vision/analyze', timeoutMs, {
    method: 'POST',
    body: req,
  });
}

// ── Translation ──

export interface TranslateRequest {
  /** The text to translate. */
  text: string;
  /** Source language code. */
  from: AssistantLanguage;
  /** Target language code. */
  to: AssistantLanguage;
  /** User's accessibility needs — forwarded to backend for prompt tuning. */
  needs?: AccessibilityNeed[];
}

export interface TranslateResponse {
  translatedText: string;
  from: string;
  to: string;
  model: string;
}

/** Translation calls — default timeout is 30s. */
export function sendTranslateRequest(
  req: TranslateRequest,
  timeoutMs = 30000,
): Promise<TranslateResponse> {
  return fetchJson<TranslateResponse>('/api/v1/translate', timeoutMs, {
    method: 'POST',
    body: req,
  });
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
  /** Base64 image data (data-URL prefix optional). */
  image: string;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Target language code to translate into. */
  targetLanguage: AssistantLanguage;
  /** Optional source language code if known. */
  sourceLanguage?: AssistantLanguage;
  /** User's accessibility needs — forwarded for prompt tuning. */
  needs?: AccessibilityNeed[];
  /** Optional: user-selected focus bounding box to zero-in on specific text. */
  focusRegion?: FocusRegion;
}

export interface TranslateImageResponse {
  extractedText: string;
  translatedText: string;
  itemSummary: string;
  detectedLanguage?: string;
  targetLanguage: string;
  model: string;
}

/** Image translation calls (vision OCR + translation) — default timeout is 60s. */
export function sendTranslateImageRequest(
  req: TranslateImageRequest,
  timeoutMs = 60000,
): Promise<TranslateImageResponse> {
  return fetchJson<TranslateImageResponse>('/api/v1/translate/image', timeoutMs, {
    method: 'POST',
    body: req,
  });
}


