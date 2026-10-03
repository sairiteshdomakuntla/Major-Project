// ---------------------------------------------------------------------------
// LiveSessionManager — manages a real-time live vision session for a client.
//
// Responsibilities:
//   1. Establish immediate session readiness (onReady)
//   2. Stream camera frames over WebSocket with concurrency control (concurrency = 1)
//   3. Queue ONLY the freshest incoming frame while Gemini processes (zero lag build-up)
//   4. Multi-model fallback cascade for high availability and low latency
//   5. Generate concise, accessibility-tuned descriptions in the user's language
//   6. Clean teardown and stats tracking
// ---------------------------------------------------------------------------

import { GoogleGenAI } from '@google/genai';
import { config } from '../config/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LiveSessionCallbacks {
  /** Called when a narration arrives from Gemini. */
  onNarration: (text: string, turnComplete: boolean) => void;
  /** Called when session is ready to accept frames. */
  onReady: () => void;
  /** Called on error. */
  onError: (message: string) => void;
  /** Called when session terminates. */
  onClose: (reason: string) => void;
}

export interface LiveSessionOptions {
  language: string;
  needs: string[];
}

// ---------------------------------------------------------------------------
// Language mapping
// ---------------------------------------------------------------------------

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  te: 'Telugu',
  ta: 'Tamil',
  kn: 'Kannada',
  ml: 'Malayalam',
  kok: 'Konkani',
};

// Candidate vision models in order of speed and stability
const VISION_MODELS = [
  'gemini-3.5-flash-lite',
  config.geminiModel || 'gemini-2.5-flash',
  'gemini-flash-latest',
];

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

export class LiveSessionManager {
  private ai: GoogleGenAI;
  private callbacks: LiveSessionCallbacks;
  private options: LiveSessionOptions;

  private _connected = false;
  private _closed = false;
  private isProcessing = false;
  private latestPendingFrame: string | null = null;
  private lastNarration = '';

  private framesForwarded = 0;
  private framesDropped = 0;

  constructor(callbacks: LiveSessionCallbacks, options: LiveSessionOptions) {
    this.callbacks = callbacks;
    this.options = options;

    if (!config.geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }
    this.ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }

  /** Connect to the session. Ready immediately for frame streaming. */
  async connect(): Promise<void> {
    if (this._closed) return;
    this._connected = true;
    console.log(
      `[live] Session started for lang=${this.options.language} (models: ${VISION_MODELS.join(', ')})`,
    );
    // Notify client that session is ready
    this.callbacks.onReady();
  }

  /**
   * Forward a camera frame to Gemini.
   * If a frame is already being processed, we update the pending frame buffer
   * so only the newest frame is analyzed next (zero queue lag).
   */
  sendFrame(base64: string): void {
    if (!this._connected || this._closed) return;

    if (this.isProcessing) {
      // Buffer only the most recent frame, drop older intermediate frames
      this.latestPendingFrame = base64;
      this.framesDropped++;
      return;
    }

    void this.processFrame(base64);
  }

  private async processFrame(base64: string): Promise<void> {
    if (this._closed) return;
    this.isProcessing = true;

    const langName = LANGUAGE_NAMES[this.options.language] ?? 'English';
    const isVisual = this.options.needs.includes('visual');

    const prompt = [
      'You are AgentBridge live camera assistant for a person with visual impairment.',
      `Describe what is directly in front of the camera in 1 to 2 short sentences (max 25 words).`,
      `Respond naturally in ${langName}.`,
      isVisual ? 'Mention relative spatial positions (left, right, center, ahead) and obstacles.' : '',
      'If readable text or signs are visible, quote them briefly.',
      'Never use markdown, lists, or asterisks. Plain text only.',
    ]
      .filter(Boolean)
      .join(' ');

    let generatedText = '';
    let successModel = '';

    for (const model of VISION_MODELS) {
      if (this._closed) break;
      try {
        const response = await this.ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { data: base64, mimeType: 'image/jpeg' } },
                { text: prompt },
              ],
            },
          ],
          config: {
            maxOutputTokens: 120,
            temperature: 0.25,
          },
        });

        const text = response.text?.trim() ?? '';
        if (text.length > 0) {
          generatedText = text;
          successModel = model;
          break;
        }
      } catch (err: any) {
        console.warn(`[live] Model ${model} failed: ${err?.message || err}`);
      }
    }

    this.isProcessing = false;

    if (this._closed) return;

    if (generatedText) {
      this.framesForwarded++;
      // If narration changed significantly or it has been a while, emit it
      if (generatedText !== this.lastNarration) {
        this.lastNarration = generatedText;
        console.log(`[live] Narration (${successModel}): "${generatedText}"`);
        this.callbacks.onNarration(generatedText, true);
      }
    }

    // If a newer frame arrived while we were processing, process it now
    if (this.latestPendingFrame && !this._closed) {
      const nextFrame = this.latestPendingFrame;
      this.latestPendingFrame = null;
      void this.processFrame(nextFrame);
    }
  }

  /** Get session stats. */
  getStats() {
    return {
      connected: this._connected,
      framesForwarded: this.framesForwarded,
      framesDropped: this.framesDropped,
    };
  }

  /** Gracefully close the session. */
  close(): void {
    if (this._closed) return;
    this._closed = true;
    this._connected = false;
    this.latestPendingFrame = null;
    console.log(
      `[live] Session closed. Frames forwarded: ${this.framesForwarded}, dropped: ${this.framesDropped}`,
    );
  }
}
