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

  /** Timestamp of the last emitted narration (ms). */
  private lastNarrationTime = 0;
  /** Consecutive frames where the scene was unchanged. */
  private consecutiveNoChange = 0;

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
   * Applies adaptive cooldown when scene is static, then concurrency = 1
   * with only the freshest pending frame kept.
   */
  sendFrame(base64: string): void {
    if (!this._connected || this._closed) return;

    // Adaptive cooldown: when the scene hasn't changed, skip frames to
    // avoid repeated API calls and duplicate narrations.
    if (this.lastNarrationTime > 0) {
      const elapsed = Date.now() - this.lastNarrationTime;
      const cooldown = this.getAdaptiveCooldown();
      if (elapsed < cooldown) {
        this.framesDropped++;
        return;
      }
    }

    if (this.isProcessing) {
      // Buffer only the most recent frame, drop older intermediate frames
      this.latestPendingFrame = base64;
      this.framesDropped++;
      return;
    }

    void this.processFrame(base64);
  }

  /**
   * Cooldown scales with how many consecutive frames showed the same scene.
   * Starts at 3 s, grows by 1.5 s per repeat, caps at 10 s.
   * Resets to 3 s when the scene actually changes.
   */
  private getAdaptiveCooldown(): number {
    const BASE_MS = 3000;
    const STEP_MS = 1500;
    const MAX_MS = 10000;
    const scale = Math.min(this.consecutiveNoChange, 5);
    return Math.min(BASE_MS + scale * STEP_MS, MAX_MS);
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
      // Context-aware: tell Gemini what it already said so it can detect no-change
      this.lastNarration
        ? `Your previous description was: "${this.lastNarration}". If the scene is essentially the same, respond with exactly: [no change]. Only narrate what is NEW or DIFFERENT.`
        : '',
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
      this.lastNarrationTime = Date.now();

      const noChange = this.isNoChangeResponse(generatedText);
      const similar = this.isSimilarNarration(generatedText, this.lastNarration);

      if (noChange || similar) {
        this.consecutiveNoChange++;
        console.log(
          `[live] Scene unchanged (×${this.consecutiveNoChange}), next cooldown ${this.getAdaptiveCooldown()}ms`,
        );
      } else {
        // Genuinely new scene — emit and reset cooldown
        this.consecutiveNoChange = 0;
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
    this.consecutiveNoChange = 0;
    console.log(
      `[live] Session closed. Frames forwarded: ${this.framesForwarded}, dropped: ${this.framesDropped}`,
    );
  }

  // -------------------------------------------------------------------------
  // Duplicate / no-change detection helpers
  // -------------------------------------------------------------------------

  /** Detect "[no change]" and common variations in Gemini's response. */
  private isNoChangeResponse(text: string): boolean {
    const lower = text.toLowerCase().trim();
    return (
      lower.includes('[no change]') ||
      lower === 'no change' ||
      lower === 'no change.' ||
      lower.startsWith('no significant change') ||
      lower.startsWith('the scene remains') ||
      lower.startsWith('the scene has not changed') ||
      lower.startsWith('same as before') ||
      lower.startsWith('nothing has changed') ||
      lower.startsWith('no new') ||
      lower.startsWith('same scene')
    );
  }

  /**
   * Fuzzy similarity using Jaccard index on meaningful words.
   * Returns true if >70 % of words overlap — i.e. Gemini just reworded
   * the same description.
   */
  private isSimilarNarration(a: string, b: string): boolean {
    if (!a || !b) return false;
    const normalize = (s: string) =>
      s.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    const na = normalize(a);
    const nb = normalize(b);
    if (na === nb) return true;

    // Keep only words longer than 2 chars (ignore "a", "is", "in", …)
    const meaningful = (w: string) => w.length > 2;
    const wordsA = new Set(na.split(' ').filter(meaningful));
    const wordsB = new Set(nb.split(' ').filter(meaningful));
    if (wordsA.size === 0 || wordsB.size === 0) return na === nb;

    let overlap = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) overlap++;
    }
    const unionSize = new Set([...wordsA, ...wordsB]).size;
    return overlap / unionSize > 0.7;
  }
}
