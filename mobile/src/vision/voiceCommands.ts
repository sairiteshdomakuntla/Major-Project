// Multilingual voice command matcher. Pure function — no native imports,
// so it is unit-testable in plain Node.
// Supported: English, Hindi, Telugu (native script + common transliteration).

export type VoiceAction =
  | { kind: 'describe' }
  | { kind: 'read' }
  | { kind: 'open-camera' }
  | { kind: 'capture' }
  | { kind: 'find'; target: string }
  | { kind: 'repeat' }
  | { kind: 'stop' }
  | { kind: 'followup'; text: string };

function normalize(transcript: string): string {
  return transcript
    .normalize('NFC')
    .toLowerCase()
    .replace(/[?!.।,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP = [
  'stop',
  'cancel',
  'quiet',
  'shut up',
  'stop speaking',
  'stop reading',
  'बस',
  'रुको',
  'रुक जाओ',
  'चुप',
  'बंद करो',
  'bas',
  'ruko',
  'ruk jao',
  'band karo',
  'ఆపు',
  'ఆగండి',
  'ఆపండి',
  'aapu',
  'aagandi',
];

const REPEAT = [
  'repeat',
  'again',
  'once more',
  'say that again',
  'read it again',
  'फिर से',
  'दोहरा',
  'फिर से बोलो',
  'phir se',
  'dohrao',
  'మళ్లీ',
  'మళ్ళీ',
  'మరోసారి',
  'malli',
];

const READ = [
  'read',
  'ocr',
  'text in',
  'read this',
  'what is written',
  'what does it say',
  'पढ़',
  'पढ़ो',
  'लिखा',
  'पाठ',
  'अक्षर',
  'padh',
  'likha',
  'చదువు',
  'చదవండి',
  'అక్షరాలు',
  'రాత',
  'ఏమి రాసి',
  'chaduvu',
];

const OPEN_CAMERA = [
  'open camera',
  'start camera',
  'show camera',
  'कैमरा खोल',
  'कैमरा खालो',
  'कैमरा दिखा',
  'camera khol',
  'కెమెరా తెరువు',
  'కెమెరా చూపించు',
  'camera teruvu',
];

const CAPTURE = [
  'take a photo',
  'take photo',
  'take a picture',
  'capture',
  'click',
  'take picture',
  'photo lo',
  'फोटो',
  'तस्वीर',
  'फोटो लो',
  'फोटो खींचो',
  'तस्वीर लो',
  'फोटो क्लिक',
  'photo khicho',
  'ఫోటో',
  'ఫోటో తీయి',
  'ఫోటో తీయండి',
  'photo teeyi',
];

const FIND = [
  'find',
  'locate',
  'look for',
  'search for',
  'where is',
  "where's",
  'where are',
  'ढूंढ',
  'ढूंढो',
  'खोज',
  'तलाश',
  'कहाँ',
  'कहां है',
  'dhoondh',
  'dhoondo',
  'kahan',
  'వెతుకు',
  'వెదకు',
  'ఎక్కడ',
  'akkada',
  'vetuku',
];

const DESCRIBE = [
  'describe',
  'surrounding',
  'surroundings',
  'what do you see',
  "what's around",
  'what is around',
  "what's in front",
  'what is in front',
  'look like',
  'what is this',
  "what's this",
  'वर्णन',
  'विवरण',
  'बताओ',
  'दिख',
  'आसपास',
  'सामने क्या',
  'यह क्या',
  'ये क्या',
  'aaspas',
  'saamne kya',
  'వర్ణించు',
  'చుట్టూ',
  'ఏముంది',
  'ముందు',
  'ఏమిటి',
  'ఇది ఏమిటి',
  'cheppu',
];

function containsAny(text: string, phrases: string[]): boolean {
  const normalized = skeleton(text);
  return phrases.some((p) => normalized.includes(skeleton(p)));
}

/**
 * Consonant skeleton: strips combining marks (vowel signs, etc.) so
 * minor encoding differences between keyboards and STT engines still match.
 * Applied to both sides, so it only broadens equivalent forms.
 */
function skeleton(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[\u200C\u200D]/g, '')
    .replace(/\p{M}/gu, '');
}

/**
 * Anything that is not a control command becomes a follow-up question
 * about the current photo (or a plain question when no photo exists).
 */
export function matchVoiceCommand(transcript: string): VoiceAction {
  const text = normalize(transcript);
  if (text.length === 0) return { kind: 'stop' };

  if (containsAny(text, STOP)) return { kind: 'stop' };
  if (containsAny(text, REPEAT)) return { kind: 'repeat' };

  if (containsAny(text, FIND)) {
    let target = text;
    for (const p of FIND) target = target.replace(p, ' ');
    target = target
      .replace(/\b(my|the|a|an|मेरा|मेरी|నా)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60);
    if (target.length > 0) return { kind: 'find', target };
    return { kind: 'describe' };
  }

  if (containsAny(text, READ)) return { kind: 'read' };
  if (containsAny(text, OPEN_CAMERA)) return { kind: 'open-camera' };
  if (containsAny(text, CAPTURE)) return { kind: 'capture' };
  if (containsAny(text, DESCRIBE)) return { kind: 'describe' };

  return { kind: 'followup', text: transcript.trim().slice(0, 500) };
}
