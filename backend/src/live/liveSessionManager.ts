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
import sharp from 'sharp';
import { config } from '../config/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LiveSessionCallbacks {
  /** Called when a narration arrives from Gemini. `urgent` marks a safety hazard. */
  onNarration: (text: string, turnComplete: boolean, urgent: boolean) => void;
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
// Scene-change detection (perceptual difference hash)
// ---------------------------------------------------------------------------

/** Hamming distance (of 64) at or below which the scene is considered static. */
const STATIC_DISTANCE = 8;
/** Hamming distance at or above which the scene has clearly changed. */
const CHANGED_DISTANCE = 14;
/** Even a static scene is re-checked this often, so slow-building hazards are caught (ms). */
const STATIC_RECHECK_MS = 6000;
/** Longest edge of the image sent to Gemini — fewer image tokens, faster replies. */
const GEMINI_MAX_EDGE = 768;
/** How many recent narrations the model remembers. */
const MEMORY_SIZE = 5;

/**
 * 64-bit difference hash: shrink to 9×8 greyscale, then one bit per
 * horizontal neighbour pair (left brighter than right). Robust to
 * exposure changes and compression noise; costs well under a millisecond
 * once decoded.
 */
async function dHash(img: Buffer): Promise<bigint> {
  const px = await sharp(img).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
  let hash = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      hash = (hash << 1n) | (px[y * 9 + x] > px[y * 9 + x + 1] ? 1n : 0n);
    }
  }
  return hash;
}

function hamming(a: bigint, b: bigint): number {
  let v = a ^ b;
  let count = 0;
  while (v) {
    v &= v - 1n;
    count++;
  }
  return count;
}

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
  /** Recent spoken narrations, oldest first — lets the model connect scenes. */
  private memory: Array<{ text: string; at: number }> = [];

  private framesForwarded = 0;
  private framesDropped = 0;

  /** Hash of the frame behind the last spoken narration. */
  private narratedHash: bigint | null = null;
  /** Hash of the last frame Gemini looked at (narrated or not). */
  private checkedHash: bigint | null = null;
  /** Timestamp of the last Gemini call (ms). */
  private lastCheckTime = 0;
  /** Consecutive Gemini checks that reported no change. */
  private consecutiveNoChange = 0;
  private framesSkippedStatic = 0;

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
   * Accept a camera frame. Concurrency = 1 with only the freshest pending
   * frame kept; whether Gemini is called is decided per frame by the
   * perceptual hash in processFrame (no blind time-based cooldown).
   */
  sendFrame(base64: string): void {
    if (!this._connected || this._closed) return;

    if (this.isProcessing) {
      // Buffer only the most recent frame, drop older intermediate frames
      if (this.latestPendingFrame) this.framesDropped++;
      this.latestPendingFrame = base64;
      return;
    }

    void this.processFrame(base64);
  }

  private async processFrame(base64: string): Promise<void> {
    if (this._closed) return;
    this.isProcessing = true;
    try {
      await this.analyzeFrame(base64);
    } catch (err: any) {
      console.warn(`[live] Frame processing failed: ${err?.message || err}`);
    }
    this.isProcessing = false;

    // If a newer frame arrived while we were processing, process it now
    if (this.latestPendingFrame && !this._closed) {
      const nextFrame = this.latestPendingFrame;
      this.latestPendingFrame = null;
      void this.processFrame(nextFrame);
    }
  }

  private async analyzeFrame(base64: string): Promise<void> {
    const raw = Buffer.from(base64, 'base64');

    // 1. Cheap local change detection — decides whether Gemini is needed at all.
    const hash = await dHash(raw);
    // vs. what was last *spoken*: decides whether the model must describe a new view.
    const distance = this.narratedHash === null ? 64 : hamming(hash, this.narratedHash);
    // vs. what was last *looked at*: decides whether calling Gemini is worth it.
    const checkedDistance = this.checkedHash === null ? 64 : hamming(hash, this.checkedHash);
    const sinceCheck = Date.now() - this.lastCheckTime;

    if (checkedDistance <= STATIC_DISTANCE && sinceCheck < STATIC_RECHECK_MS) {
      this.framesSkippedStatic++;
      return;
    }
    const sceneChanged = distance >= CHANGED_DISTANCE;

    // 2. Downscale (and auto-rotate) before upload — 12 MP phone photos are
    //    mostly wasted image tokens and latency.
    const small = await sharp(raw)
      .rotate()
      .resize(GEMINI_MAX_EDGE, GEMINI_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();

    const systemInstruction = this.buildPersona();
    const prompt = this.buildTurnPrompt(sceneChanged);

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
                { inlineData: { data: small.toString('base64'), mimeType: 'image/jpeg' } },
                { text: prompt },
              ],
            },
          ],
          config: {
            systemInstruction,
            // Indic scripts are token-heavy; 120 could cut a sentence mid-word.
            maxOutputTokens: 200,
            // A little variety keeps it sounding conversational, not templated.
            temperature: 0.6,
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

    if (this._closed || !generatedText) return;

    this.framesForwarded++;
    this.lastCheckTime = Date.now();
    this.checkedHash = hash;

    const urgent = /^\s*\[urgent\]/i.test(generatedText);
    if (urgent) {
      generatedText = generatedText.replace(/^\s*\[urgent\]\s*[:\-–—]?\s*/i, '').trim();
    }

    const noChange = !urgent && this.isNoChangeResponse(generatedText);
    const similar = !urgent && this.isSimilarNarration(generatedText, this.lastNarration);

    if (!generatedText || noChange || similar) {
      this.consecutiveNoChange++;
      const why = noChange ? 'model said no change' : similar ? 'similar to last' : 'empty';
      console.log(
        `[live] Unchanged (×${this.consecutiveNoChange}, ${why}, d=${distance}): "${generatedText}"`,
      );
      return;
    }

    // Genuinely new scene — remember what it looked like and emit.
    this.consecutiveNoChange = 0;
    this.lastNarration = generatedText;
    this.narratedHash = hash;
    this.memory = [...this.memory, { text: generatedText, at: Date.now() }].slice(-MEMORY_SIZE);
    console.log(
      `[live] ${urgent ? 'URGENT ' : ''}Narration (${successModel}, d=${distance}${sceneChanged ? ', changed' : ''}): "${generatedText}"`,
    );
    this.callbacks.onNarration(generatedText, true, urgent);
  }

  // -------------------------------------------------------------------------
  // Prompting
  // -------------------------------------------------------------------------

  /** Stable persona: a companion talking, not a camera listing objects. */
  private buildPersona(): string {
    const langName = LANGUAGE_NAMES[this.options.language] ?? 'English';
    const isVisual = this.options.needs.includes('visual');

    return [
      'You are AgentBridge, a warm, attentive companion walking alongside a blind person and telling them about their surroundings, live, through their phone camera.',
      `Always speak in ${langName}, the way a friend standing beside them would talk: natural, warm, present tense, addressing them as "you".`,
      '',
      'Style:',
      '- One or two short spoken sentences, at most 25 words. Your words are read aloud.',
      '- Lead with what matters most to them: people, things in their path, things they could reach or use; background last.',
      '- Connect to what you said before, like a running commentary: "Now you are facing…", "Someone just came in on your left…", "You are back at the desk…", "That person has left." Vary how you begin; never open two narrations the same way.',
      '- Give simple directions (to your left, straight ahead, just right of you) and rough distances (within arm\'s reach, a few steps away).',
      isVisual ? '- Always mention obstacles in their path and where they are.' : null,
      '- If short text or a sign is readable, read it out in quotes.',
      '- Never say "the image shows", "in this picture", "I can see" or "the camera". Speak as if you are both there.',
      '- Plain spoken text only: no markdown, lists, emoji or asterisks.',
      '',
      'SAFETY: if there is an immediate hazard close to them (moving vehicle, stairs or a drop, an obstacle within a few steps ahead, a person about to collide, fire, water on the floor), start your reply with exactly [URGENT] followed by a very short warning (max 10 words) that says where it is. Use [URGENT] only for real, nearby dangers.',
    ]
      .filter((line) => line !== null)
      .join('\n');
  }

  /** Per-frame instruction: recent memory plus what the pixels say happened. */
  private buildTurnPrompt(sceneChanged: boolean): string {
    if (this.memory.length === 0) {
      return 'This is your first look. Give them a short, friendly orientation of what is in front of them.';
    }

    const now = Date.now();
    const recent = this.memory
      .map((m) => `- ${Math.max(1, Math.round((now - m.at) / 1000))}s ago: ${m.text}`)
      .join('\n');

    const task = sceneChanged
      ? 'The view has just changed. Tell them what is in front of them now, linking it naturally to what came before (they turned, moved, came back somewhere, or someone arrived or left). Do not repeat earlier details unless they matter for the change.'
      : 'The view looks much the same. If nothing meaningful changed, reply exactly: [no change]. Otherwise mention only the new detail, briefly.';

    return `What you have told them so far (oldest first):\n${recent}\n\n${task}`;
  }

  /** Get session stats. */
  getStats() {
    return {
      connected: this._connected,
      framesForwarded: this.framesForwarded,
      framesDropped: this.framesDropped,
      framesSkippedStatic: this.framesSkippedStatic,
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
      `[live] Session closed. Gemini calls: ${this.framesForwarded}, skipped (static): ${this.framesSkippedStatic}, dropped (busy): ${this.framesDropped}`,
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
    // Unicode-aware: keep letters, combining marks (Indic vowel signs) and digits.
    // A plain \w would strip every Telugu/Hindi/Tamil character.
    const normalize = (s: string) =>
      s.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
    const na = normalize(a);
    const nb = normalize(b);
    if (!na || !nb) return false;
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
