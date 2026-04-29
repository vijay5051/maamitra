/**
 * Voice I/O for MaaMitra chat.
 *
 * Web: Uses the browser's Web Speech API —
 *   - SpeechRecognition (webkitSpeechRecognition on Safari/Chrome) for STT
 *   - SpeechSynthesis for TTS
 *
 * Native (iOS/Android): Uses
 *   - expo-speech-recognition for STT (jamsch/expo-speech-recognition)
 *   - expo-speech for TTS
 *
 * Regional language coverage — both STT and TTS use standard BCP-47
 * language tags. All 22 scheduled languages of India are listed. Actual
 * support depends on the device's installed speech engines (Android: Google
 * speech services; iOS: on-device Siri voices) and Google Chrome on web.
 */
import { Platform } from 'react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import * as Speech from 'expo-speech';

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

function getWebSpeechRecognitionCtor(): any | null {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined') return null;
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
}

export const isSpeechRecognitionSupported = (): boolean => {
  if (Platform.OS === 'web') return !!getWebSpeechRecognitionCtor();
  // Native: expo-speech-recognition is bundled. Whether the device actually
  // has a recognizer installed is checked at start() time and surfaced via
  // an error event if missing.
  return true;
};

export const isSpeechSynthesisSupported = (): boolean => {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return false;
    return typeof (window as any).speechSynthesis !== 'undefined';
  }
  // Native: expo-speech is always available.
  return true;
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
  if (Platform.OS === 'web') return startWebSpeechRecognition(opts);
  return startNativeSpeechRecognition(opts);
}

function startWebSpeechRecognition(opts: STTOptions): STTHandle | null {
  const Ctor = getWebSpeechRecognitionCtor();
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
    if (code === 'aborted') return;
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

function startNativeSpeechRecognition(opts: STTOptions): STTHandle | null {
  let finalText = '';
  let lastInterim = '';
  let stopped = false;
  const subs: { remove: () => void }[] = [];

  const cleanup = () => {
    for (const s of subs) {
      try { s.remove(); } catch { /* no-op */ }
    }
    subs.length = 0;
  };

  const safeStop = () => {
    if (stopped) return;
    stopped = true;
    try { ExpoSpeechRecognitionModule.stop(); } catch { /* no-op */ }
  };

  // Wire up event listeners before calling start().
  subs.push(
    ExpoSpeechRecognitionModule.addListener('result', (event: any) => {
      const transcript: string = event?.results?.[0]?.transcript ?? '';
      if (!transcript) return;
      if (event.isFinal) {
        finalText = transcript;
      } else {
        lastInterim = transcript;
        opts.onInterim?.(transcript);
      }
    }),
  );

  subs.push(
    ExpoSpeechRecognitionModule.addListener('error', (event: any) => {
      const code: string = event?.error || 'unknown';
      if (code === 'aborted') return;
      if (code === 'not-allowed' || code === 'permissions') {
        opts.onError?.('Microphone permission denied. Allow it in your phone settings.');
        return;
      }
      if (code === 'no-speech') {
        opts.onError?.("I didn't catch that — try again.");
        return;
      }
      if (code === 'language-not-supported') {
        opts.onError?.('That language isn\'t installed on your phone\'s speech engine yet.');
        return;
      }
      if (code === 'service-not-allowed' || code === 'recognizer-not-available') {
        opts.onError?.('Voice typing isn\'t available on this device. Install Google\'s speech services and try again.');
        return;
      }
      const msg = event?.message ? `Voice error: ${event.message}` : `Voice error: ${code}`;
      opts.onError?.(msg);
    }),
  );

  subs.push(
    ExpoSpeechRecognitionModule.addListener('end', () => {
      const text = (finalText || lastInterim).trim();
      if (text) opts.onFinal(text);
      cleanup();
    }),
  );

  // Request mic + recognizer permissions, then start.
  (async () => {
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm?.granted) {
        opts.onError?.('Microphone permission denied. Allow it in your phone settings.');
        cleanup();
        return;
      }
      if (stopped) { cleanup(); return; }
      ExpoSpeechRecognitionModule.start({
        lang: opts.languageCode,
        interimResults: !!opts.onInterim,
        maxAlternatives: 1,
        continuous: false,
        requiresOnDeviceRecognition: false,
        addsPunctuation: true,
      });
    } catch (e: any) {
      opts.onError?.(e?.message ?? 'Could not start the microphone.');
      cleanup();
    }
  })();

  return { stop: safeStop };
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
    .map((v) => {
      const vLang = (v.lang || v.language || '').toLowerCase();
      let langScore = 0;
      if (vLang === full) langScore = 100;
      else if (vLang.startsWith(base + '-')) langScore = 60;
      else if (vLang.startsWith(base)) langScore = 40;
      else return null;

      const name = `${v.name || ''} ${v.identifier || ''} ${v.voiceURI || ''}`.toLowerCase();
      let qualityScore = 0;
      for (const hint of NEURAL_HINTS) {
        if (name.includes(hint)) qualityScore += 25;
      }
      // expo-speech exposes a `quality` field — "Enhanced" is the premium
      // tier on iOS.
      const q = (v.quality || '').toLowerCase();
      if (q === 'enhanced') qualityScore += 30;
      if (name.includes('google')) qualityScore += 15;
      if (name.includes('microsoft') && name.includes('online')) qualityScore += 20;
      if (/\b(samantha|ava|karen|serena|allison|fiona|tessa)\b/.test(name)) qualityScore += 10;
      if (/\b(compact|lite|novelty|whisper|cellos|bells|junior|bad|hysterical|organ|pipe|trinoids|zarvox)\b/.test(name)) qualityScore -= 40;
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
async function waitForWebVoices(timeoutMs: number = 1500): Promise<any[]> {
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
  if (Platform.OS === 'web') return speakWeb(text, languageCode);
  return speakNative(text, languageCode);
}

function speakWeb(text: string, languageCode: string): TTSHandle | null {
  if (!isSpeechSynthesisSupported()) return null;
  const synth: any = (window as any).speechSynthesis;
  try { synth.cancel(); } catch { /* no-op */ }

  const utter = new (window as any).SpeechSynthesisUtterance(text);
  utter.lang = languageCode;
  utter.rate = 0.96;
  utter.pitch = 1.05;

  let cancelled = false;

  const applyVoice = async () => {
    const voices = await waitForWebVoices();
    if (cancelled) return;
    const best = pickBestVoice(voices, languageCode);
    if (best && !utter.voice) {
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

function speakNative(text: string, languageCode: string): TTSHandle | null {
  let cancelled = false;
  // Stop any in-flight utterance so taps don't queue up.
  Speech.stop().catch(() => {});

  // Try to pick the best installed voice for the language. expo-speech
  // accepts a voice identifier; if we don't pass one it uses the system
  // default for that language.
  Speech.getAvailableVoicesAsync()
    .then((voices) => {
      if (cancelled) return;
      const best = pickBestVoice(voices, languageCode);
      Speech.speak(text, {
        language: languageCode,
        voice: best?.identifier,
        rate: 0.96,
        pitch: 1.05,
      });
    })
    .catch(() => {
      if (cancelled) return;
      // Fall back to the default voice for the language.
      try {
        Speech.speak(text, {
          language: languageCode,
          rate: 0.96,
          pitch: 1.05,
        });
      } catch { /* no-op */ }
    });

  return {
    stop: () => {
      cancelled = true;
      Speech.stop().catch(() => {});
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
    { re: /[ऀ-ॿ]/, code: 'hi-IN' },   // Devanagari (Hindi, Marathi, Sanskrit, Konkani, Maithili, Nepali)
    { re: /[ঀ-৿]/, code: 'bn-IN' },   // Bengali / Assamese
    { re: /[਀-੿]/, code: 'pa-IN' },   // Gurmukhi (Punjabi)
    { re: /[઀-૿]/, code: 'gu-IN' },   // Gujarati
    { re: /[଀-୿]/, code: 'or-IN' },   // Odia
    { re: /[஀-௿]/, code: 'ta-IN' },   // Tamil
    { re: /[ఀ-౿]/, code: 'te-IN' },   // Telugu
    { re: /[ಀ-೿]/, code: 'kn-IN' },   // Kannada
    { re: /[ഀ-ൿ]/, code: 'ml-IN' },   // Malayalam
    { re: /[؀-ۿ]/, code: 'ur-IN' },   // Arabic/Persian (Urdu, Kashmiri, Sindhi)
  ];
  for (const { re, code } of ranges) {
    if (re.test(text)) return code;
  }
  // Default: if it's mostly ASCII, treat as English.
  return /^[\x00-\x7F\s]*$/.test(text) ? 'en-IN' : null;
}
