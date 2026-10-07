// Translation Agent — dedicated cross-language translation.
// Unlike the general assistant (which responds in the user's profile language),
// this agent explicitly translates text from one language into another,
// preserving meaning, tone, and cultural nuance.

import type {
  AITextProvider,
  AIVisionProvider,
  AccessibilityNeed,
  SupportedAssistantLanguage,
} from '../../providers/aiProvider.js';

export const TRANSLATION_AGENT_NAME = 'translation';

const LANGUAGE_NAMES: Record<SupportedAssistantLanguage, string> = {
  en: 'English',
  hi: 'Hindi (हिन्दी)',
  te: 'Telugu (తెలుగు)',
  ta: 'Tamil (தமிழ்)',
  kn: 'Kannada (ಕನ್ನಡ)',
  ml: 'Malayalam (മലയാളം)',
  kok: 'Konkani (कोंकणी)',
};

export interface TranslationRequest {
  /** The text to translate. */
  text: string;
  /** Source language code. */
  from: SupportedAssistantLanguage;
  /** Target language code. */
  to: SupportedAssistantLanguage;
  /** Optional: user's disability profile for prompt tuning. */
  needs?: AccessibilityNeed[];
}

export interface TranslationResult {
  /** The translated text. */
  translatedText: string;
  /** Source language code echoed back. */
  from: SupportedAssistantLanguage;
  /** Target language code echoed back. */
  to: SupportedAssistantLanguage;
  /** AI model used for the translation. */
  model: string;
}

export interface ImageTranslationRequest {
  /** Raw base64 image data. */
  imageBase64: string;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Target language code to translate into. */
  targetLanguage: SupportedAssistantLanguage;
  /** Optional source language code (if already known; otherwise auto-detected). */
  sourceLanguage?: SupportedAssistantLanguage;
  /** Optional: user's disability profile for prompt tuning. */
  needs?: AccessibilityNeed[];
  /** Optional: user-selected focus bounding box to zero-in on specific text. */
  focusRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ImageTranslationResult {
  /** Original text extracted verbatim from the image. */
  extractedText: string;
  /** The translated text in the target language. */
  translatedText: string;
  /** Concise 1-2 sentence context note (e.g. medicine dosage, bus route, notice). */
  itemSummary: string;
  /** Detected source language (e.g. "English", "Hindi"). */
  detectedLanguage?: string;
  /** Target language code. */
  targetLanguage: SupportedAssistantLanguage;
  /** AI model used. */
  model: string;
}

function needsContext(needs: AccessibilityNeed[] | undefined): string {
  if (!needs || needs.length === 0) return '';
  const hints: string[] = [];
  if (needs.includes('visual'))
    hints.push(
      'The user is blind or has low vision — the translation will be spoken aloud, so ensure natural, speakable phrasing.',
    );
  if (needs.includes('hearing'))
    hints.push(
      'The user is deaf or hard of hearing — the translation will be read on screen, so be precise and explicit.',
    );
  if (needs.includes('speech'))
    hints.push(
      'The user has difficulty speaking — keep the translation concise so it is easy to re-read or show to others.',
    );
  if (needs.includes('general'))
    hints.push(
      'The user prefers simple language — use short sentences and avoid complex vocabulary.',
    );
  return hints.length > 0 ? ' ' + hints.join(' ') : '';
}

function buildTranslationPrompt(
  text: string,
  from: SupportedAssistantLanguage,
  to: SupportedAssistantLanguage,
  needs?: AccessibilityNeed[],
): string {
  const instruction = [
    `You are a professional translator. Translate the following text from ${LANGUAGE_NAMES[from]} to ${LANGUAGE_NAMES[to]}.`,
    'Rules:',
    '1. Output ONLY the translated text — no explanations, no notes, no original text.',
    '2. Preserve the original meaning, tone, and intent as closely as possible.',
    '3. Use natural, idiomatic phrasing in the target language.',
    '4. If the text contains proper nouns, transliterate them appropriately for the target script.',
    '5. If the text is already in the target language, return it unchanged.',
    '6. Do not add quotation marks or any wrapper around the translation.',
  ].join(' ') + needsContext(needs);

  return `${instruction}\n\nText to translate:\n${text}`;
}

function buildImageTranslationInstruction(
  targetLanguage: SupportedAssistantLanguage,
  needs?: AccessibilityNeed[],
): string {
  const targetName = LANGUAGE_NAMES[targetLanguage];
  return [
    `You are an assistive vision and translation specialist dedicated to helping individuals in rural areas, individuals with disabilities (such as visual impairment, low literacy, or language barriers), and citizens understand real-world text captured from their camera.`,
    `The photo may be of medicine boxes/strips, pesticide or fertilizer bags, road or bus boards, government/panchayat notices, hospital signs, ration shop receipts, utility bills, or food packaging.`,
    `Rules:`,
    `1. Extract all legible text visible in the image verbatim into "extractedText".`,
    `2. Translate all extracted text accurately, naturally, and clearly into ${targetName} into "translatedText". Ensure the tone is clear and respectful.`,
    `3. In "itemSummary", provide a brief 1-2 sentence explanation in ${targetName} answering: What is this item, and what is its most critical info (e.g. medicine name & dosage warning, bus destination & route, or official deadline)?`,
    `4. In "detectedLanguage", name the primary language detected on the item (e.g. "English", "Hindi", "Telugu", etc.).`,
    `5. If no legible text is visible in the photo, set "extractedText" to "No readable text detected" and set "translatedText" and "itemSummary" to a helpful sentence in ${targetName} advising them to hold the camera steady, get closer, or ensure good lighting.`,
    `6. You MUST respond with ONLY valid JSON with no markdown formatting or backticks, with exactly this schema:`,
    `{"extractedText": "...", "translatedText": "...", "itemSummary": "...", "detectedLanguage": "..."}`,
  ].join('\n') + needsContext(needs);
}

function cleanJsonOutput(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

export class TranslationAgent {
  constructor(
    private readonly textProvider: AITextProvider,
    private readonly visionProvider?: AIVisionProvider,
  ) {}

  async translate(req: TranslationRequest): Promise<TranslationResult> {
    // Short-circuit: same language → echo input.
    if (req.from === req.to) {
      return {
        translatedText: req.text,
        from: req.from,
        to: req.to,
        model: 'passthrough',
      };
    }

    const prompt = buildTranslationPrompt(req.text, req.from, req.to, req.needs);

    const result = await this.textProvider.generateText({
      message: prompt,
      history: [],
      language: req.to,
      timeoutMs: 25_000,
      needs: req.needs,
    });

    return {
      translatedText: result.text,
      from: req.from,
      to: req.to,
      model: result.model,
    };
  }

  async translateImage(
    req: ImageTranslationRequest,
  ): Promise<ImageTranslationResult> {
    if (!this.visionProvider) {
      throw new Error('Vision provider is not configured for image translation.');
    }

    const instruction = buildImageTranslationInstruction(
      req.targetLanguage,
      req.needs,
    );

    const focusMessage = req.focusRegion
      ? `The user has highlighted a specific focus area with their fingers: roughly between ${(req.focusRegion.y * 100).toFixed(0)}% to ${((req.focusRegion.y + req.focusRegion.height) * 100).toFixed(0)}% from the top, and ${(req.focusRegion.x * 100).toFixed(0)}% to ${((req.focusRegion.x + req.focusRegion.width) * 100).toFixed(0)}% from the left. Extract and translate ONLY the text inside this highlighted box, ignoring extraneous text outside it.`
      : 'Extract and translate the text in this image.';

    const result = await this.visionProvider.generateVisionText({
      imageBase64: req.imageBase64,
      mimeType: req.mimeType ?? 'image/jpeg',
      message: focusMessage,
      history: [],
      language: req.targetLanguage,
      timeoutMs: 45_000,
      needs: req.needs,
      systemInstruction: instruction,
    });

    try {
      const parsed = JSON.parse(cleanJsonOutput(result.text));
      return {
        extractedText: String(parsed.extractedText ?? '').trim(),
        translatedText: String(parsed.translatedText ?? '').trim(),
        itemSummary: String(parsed.itemSummary ?? '').trim(),
        detectedLanguage: parsed.detectedLanguage ? String(parsed.detectedLanguage) : undefined,
        targetLanguage: req.targetLanguage,
        model: result.model,
      };
    } catch {
      // Fallback if model returned plain text rather than JSON
      return {
        extractedText: 'Extracted from image',
        translatedText: result.text,
        itemSummary: '',
        targetLanguage: req.targetLanguage,
        model: result.model,
      };
    }
  }
}

