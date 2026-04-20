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

// Pick the most natural-sounding voice available on this device for the
// requested language. Browser default voices are robotic; we score the
// installed voices by signals that correlate with neural / premium
// quality so we pick the best one the user has on hand.
function pickBestVoice(
  voices: any[],
  languageCode: string,
): any | null {
  if (!voices || voices.length === 0) return null;
  const base = languageCode.split('-')[0].toLowerCase();
  const full = languageCode.toLowerCase();

  // Keywords in voice.name / voice.voiceURI that indicate a higher-quality
  // engine. Order roughly: newer/fancier first. Platforms where these show
  // up: macOS "Premium"/"Enhanced" (System Settings → Spoken Content →
  // System Voice → …), Chrome "Google … (natural)", Edge "Online (Natural)",
  // iOS 16+ "Enhanced" voices, Android "Network".
  const NEURAL_HINTS = [
    'neural',
    'natural',
    'premium',
    'enhanced',
    'wavenet',
    'online',
    'studio',
    'novo',
    'polyglot',
  ];

  const scored = voices
    // Language filter — exact match scores higher than base match.
    .map((v) => {
      const vLang = (v.lang || '').toLowerCase();
      let langScore = 0;
      if (vLang === full) langScore = 100;
      else if (vLang.startsWith(base + '-')) langScore = 60;
      else if (vLang.startsWith(base)) langScore = 40;
      else return null;

      const name = `${v.name || ''} ${v.voiceURI || ''}`.toLowerCase();
      let qualityScore = 0;
      for (const hint of NEURAL_HINTS) {
        if (name.includes(hint)) qualityScore += 25;
      }
      // Google voices on Chrome desktop are generally much better than
      // Apple's defaults when no explicit hint is present.
      if (name.includes('google')) qualityScore += 15;
      // Microsoft "Online" voices on Edge are neural.
      if (name.includes('microsoft') && name.includes('online')) qualityScore += 20;
      // Samantha (macOS), Ava (macOS), Karen (iOS) are the nicer defaults.
      if (/\b(samantha|ava|karen|serena|allison|fiona|tessa)\b/.test(name)) qualityScore += 10;
      // Penalise compact / "Lite" / "novelty" voices.
      if (/\b(compact|lite|novelty|whisper|cellos|bells|junior|bad|hysterical|organ|pipe|trinoids|zarvox)\b/.test(name)) qualityScore -= 40;
      // Default voices (default:true) are often the robotic baseline —
      // slight penalty unless their name already scored well.
      if (v.default) qualityScore -= 5;

      return { v, score: langScore + qualityScore };
    })
    .filter(Boolean) as Array<{ v: any; score: number }>;

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  return scored[0].v;
}

/**
 * Some browsers (Chrome, Safari) populate the voice list asynchronously
 * on first call. This helper waits (up to timeoutMs) until voices become
 * available so pickBestVoice has something to choose from.
 */
async function waitForVoices(timeoutMs: number = 1500): Promise<any[]> {
  const synth: any = (typeof window !== 'undefined') ? (window as any).speechSynthesis : null;
  if (!synth) return [];
  const immediate = synth.getVoices();
  if (immediate && immediate.length > 0) return immediate;
  return new Promise((resolve) => {
    let done = false;
    const finish = (list: any[]) => { if (done) return; done = true; resolve(list); };
    try {
      synth.addEventListener?.('voiceschanged', () => {
        finish(synth.getVoices() || []);
      }, { once: true });
    } catch { /* no-op */ }
    setTimeout(() => finish(synth.getVoices() || []), timeoutMs);
  });
}

export function speak(text: string, languageCode: string): TTSHandle | null {
  if (!isSpeechSynthesisSupported()) return null;
  const synth: any = (window as any).speechSynthesis;
  // Cancel any in-flight utterance so taps don't queue up.
  try { synth.cancel(); } catch { /* no-op */ }

  const utter = new (window as any).SpeechSynthesisUtterance(text);
  utter.lang = languageCode;

  // Natural-feeling defaults. Rate slightly under 1 reads as considered
  // rather than monotone; pitch slightly over 1 adds warmth without
  // sounding chipmunky. Volume left at 1.
  utter.rate = 0.96;
  utter.pitch = 1.05;

  let cancelled = false;

  // Kick off voice selection. If voices aren't ready yet, start speaking
  // with the default voice so the user isn't waiting silently, then swap
  // to the better voice as soon as it's available — too late to apply to
  // the current utterance, but right in time for the next one.
  const applyVoice = async () => {
    const voices = await waitForVoices();
    if (cancelled) return;
    const best = pickBestVoice(voices, languageCode);
    if (best && !utter.voice) {
      // Only assign if speaking hasn't started — some browsers ignore
      // voice reassignment mid-utterance.
      try { utter.voice = best; } catch { /* no-op */ }
    }
  };
  applyVoice().catch(() => {});

  try { synth.speak(utter); } catch { return null; }

  return {
    stop: () => {
      cancelled = true;
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
