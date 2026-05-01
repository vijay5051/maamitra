/**
 * Google Cloud Text-to-Speech wrapper.
 *
 * Calls the `synthesizeSpeech` Cloud Function — which delegates to
 * Google Cloud TTS (Neural2 voices for Hindi + Indian English,
 * Standard for the rest of the major Indic locales) — and returns
 * a base64 MP3 the caller can hand to expo-audio.
 *
 * The chat thread already keeps a `voiceLanguage` per user via
 * `useChatStore`; pass that through here.
 */
import { app } from './firebase';

export interface SynthesisResult {
  base64: string;
  mimeType: string;
  voice: string;
  bytes: number;
}

export async function synthesizeSpeech(
  text: string,
  lang: string,
): Promise<SynthesisResult> {
  if (!app) throw new Error('Firebase app not configured');
  if (!text || !text.trim()) throw new Error('No text to speak');

  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions(app);
  const call = httpsCallable<
    { text: string; lang: string },
    { ok: boolean; mimeType: string; base64: string; voice: string; bytes: number }
  >(functions, 'synthesizeSpeech');
  const result = await call({ text: text.trim(), lang });
  return {
    base64: result.data.base64,
    mimeType: result.data.mimeType,
    voice: result.data.voice,
    bytes: result.data.bytes,
  };
}

/**
 * Build a `data:` URL the audio player can consume directly.
 * expo-audio's createAudioPlayer happily takes a data URL on web +
 * native, so we don't have to write the file to disk first.
 */
export function synthesisToDataUrl(result: SynthesisResult): string {
  return `data:${result.mimeType};base64,${result.base64}`;
}
