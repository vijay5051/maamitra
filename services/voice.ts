/**
 * Voice I/O for MaaMitra chat.
 *
 * Web: Uses the browser's Web Speech API —
 *   - SpeechRecognition (webkitSpeechRecognition on Safari/Chrome) for STT
 *   - SpeechSynthesis for TTS
 *
 * Native (iOS/Android via Expo): we gracefully fall back to "unsupported"
 * until we add expo-speech + expo-speech-recognition packages. Today's
 * product is web-first, so this is fine — the mic button hides on native.
 *
 * Regional language coverage — both STT and TTS use standard BCP-47
 * language tags. All 22 scheduled languages of India are listed. Actual
 * support depends on the user's browser + OS install — Chrome on Desktop
 * + Android is strongest, Safari on iOS is more limited.
 */
import { Platform } from 'react-native';

export interface LanguageOption {
  code: string;      // BCP-47 tag (e.g. 'hi-IN')
  label: string;     // English name
  native: string;    // Native-script name
}

// Indian languages (22 scheduled + English) with BCP-47 tags supported by
// the Web Speech API. Order: English, Hindi, then alphabetical by name.
export const INDIAN_LANGUAGES: LanguageOption[] = [
  { code: 'en-IN', label: 'English (India)', native: 'English' },
  { code: 'hi-IN', label: 'Hindi',           native: 'हिन्दी' },
  { code: 'as-IN', label: 'Assamese',        native: 'অসমীয়া' },
  { code: 'bn-IN', label: 'Bengali',         native: 'বাংলা' },
  { code: 'brx-IN', label: 'Bodo',           native: 'बर\'' },
  { code: 'doi-IN', label: 'Dogri',          native: 'डोगरी' },
  { code: 'gu-IN', label: 'Gujarati',        native: 'ગુજરાતી' },
  { code: 'kn-IN', label: 'Kannada',         native: 'ಕನ್ನಡ' },
  { code: 'ks-IN', label: 'Kashmiri',        native: 'کٲشُر' },
  { code: 'kok-IN', label: 'Konkani',        native: 'कोंकणी' },
  { code: 'mai-IN', label: 'Maithili',       native: 'मैथिली' },
  { code: 'ml-IN', label: 'Malayalam',       native: 'മലയാളം' },
  { code: 'mni-IN', label: 'Manipuri',       native: 'মৈতৈলোন্' },
  { code: 'mr-IN', label: 'Marathi',         native: 'मराठी' },
  { code: 'ne-IN', label: 'Nepali',          native: 'नेपाली' },
  { code: 'or-IN', label: 'Odia',            native: 'ଓଡ଼ିଆ' },
  { code: 'pa-IN', label: 'Punjabi',         native: 'ਪੰਜਾਬੀ' },
  { code: 'sa-IN', label: 'Sanskrit',        native: 'संस्कृतम्' },
  { code: 'sat-IN', label: 'Santali',        native: 'ᱥᱟᱱᱛᱟᱲᱤ' },
  { code: 'sd-IN', label: 'Sindhi',          native: 'सिन्धी' },
  { code: 'ta-IN', label: 'Tamil',           native: 'தமிழ்' },
  { code: 'te-IN', label: 'Telugu',          native: 'తెలుగు' },
  { code: 'ur-IN', label: 'Urdu',            native: 'اُردُو' },
];

// ─── Detection helpers ──────────────────────────────────────────────────────

function getSpeechRecognitionCtor(): any | null {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined') return null;
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
}

export const isSpeechRecognitionSupported = (): boolean =>
  !!getSpeechRecognitionCtor();

export const isSpeechSynthesisSupported = (): boolean => {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined') return false;
  return typeof (window as any).speechSynthesis !== 'undefined';
};

// ─── Speech-to-text ─────────────────────────────────────────────────────────
// Start a listening session. onInterim fires with partial transcripts as
// the user speaks; onFinal fires when speech has stopped. Returns a stop()
// function the caller can invoke to abort early.

export interface STTHandle {
  stop: () => void;
}

export interface STTOptions {
  languageCode: string;              // BCP-47 tag
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (message: string) => void;
}

export function startSpeechRecognition(opts: STTOptions): STTHandle | null {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    opts.onError?.('Speech recognition is not supported on this browser.');
    return null;
  }
  const rec = new Ctor();
  rec.lang = opts.languageCode;
  rec.interimResults = !!opts.onInterim;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  let finalText = '';

  rec.onresult = (event: any) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (interim && opts.onInterim) opts.onInterim(interim);
  };

  rec.onerror = (event: any) => {
    const code = event.error || 'unknown';
    // Common codes: 'no-speech', 'aborted', 'not-allowed', 'network'
    if (code === 'aborted') return; // silent
    if (code === 'not-allowed') {
      opts.onError?.('Microphone permission denied. Allow it in your browser settings.');
      return;
    }
    if (code === 'no-speech') {
      opts.onError?.("I didn't catch that — try again.");
      return;
    }
    opts.onError?.(`Voice error: ${code}`);
  };

  rec.onend = () => {
    if (finalText.trim()) opts.onFinal(finalText.trim());
  };

  try {
    rec.start();
  } catch (e: any) {
    opts.onError?.(e?.message ?? 'Could not start the microphone.');
    return null;
  }

  return {
    stop: () => {
      try { rec.stop(); } catch { /* no-op */ }
    },
  };
}

// ─── Text-to-speech ─────────────────────────────────────────────────────────
// Speak the given text. Picks the best available voice for the language.
// Returns a stop() function. Idempotent — stop() on an already-stopped
// utterance is a no-op.

export interface TTSHandle {
  stop: () => void;
}

export function speak(text: string, languageCode: string): TTSHandle | null {
  if (!isSpeechSynthesisSupported()) return null;
  const synth = (window as any).speechSynthesis;
  // Cancel any in-flight utterance so taps don't queue up.
  try { synth.cancel(); } catch { /* no-op */ }

  const utter = new (window as any).SpeechSynthesisUtterance(text);
  utter.lang = languageCode;

  // Try to pick a voice that matches the language. If the exact tag isn't
  // installed, fall back to any voice whose lang starts with the base
  // language code (e.g. 'hi' for 'hi-IN').
  try {
    const voices: any[] = synth.getVoices();
    const base = languageCode.split('-')[0];
    const match =
      voices.find((v) => v.lang?.toLowerCase() === languageCode.toLowerCase()) ??
      voices.find((v) => v.lang?.toLowerCase().startsWith(base));
    if (match) utter.voice = match;
  } catch { /* no-op — not all browsers expose voices */ }

  utter.rate = 1;
  utter.pitch = 1;

  try { synth.speak(utter); } catch { return null; }

  return {
    stop: () => {
      try { synth.cancel(); } catch { /* no-op */ }
    },
  };
}

// ─── Language auto-detect ───────────────────────────────────────────────────
// Very cheap Unicode-range heuristic. Returns the best-guess BCP-47 code
// or null. Used to pre-select a TTS voice for replies — the LLM itself
// mirrors the user's script regardless.

export function detectLanguage(text: string): string | null {
  if (!text) return null;
  const ranges: Array<{ re: RegExp; code: string }> = [
    { re: /[\u0900-\u097F]/, code: 'hi-IN' },   // Devanagari (Hindi, Marathi, Sanskrit, Konkani, Maithili, Nepali)
    { re: /[\u0980-\u09FF]/, code: 'bn-IN' },   // Bengali / Assamese
    { re: /[\u0A00-\u0A7F]/, code: 'pa-IN' },   // Gurmukhi (Punjabi)
    { re: /[\u0A80-\u0AFF]/, code: 'gu-IN' },   // Gujarati
    { re: /[\u0B00-\u0B7F]/, code: 'or-IN' },   // Odia
    { re: /[\u0B80-\u0BFF]/, code: 'ta-IN' },   // Tamil
    { re: /[\u0C00-\u0C7F]/, code: 'te-IN' },   // Telugu
    { re: /[\u0C80-\u0CFF]/, code: 'kn-IN' },   // Kannada
    { re: /[\u0D00-\u0D7F]/, code: 'ml-IN' },   // Malayalam
    { re: /[\u0600-\u06FF]/, code: 'ur-IN' },   // Arabic/Persian (Urdu, Kashmiri, Sindhi)
  ];
  for (const { re, code } of ranges) {
    if (re.test(text)) return code;
  }
  // Default: if it's mostly ASCII, treat as English.
  return /^[\x00-\x7F\s]*$/.test(text) ? 'en-IN' : null;
}
