// All Claude API calls are proxied through the Cloudflare Worker. The
// system prompt is now constructed SERVER-SIDE inside the worker —
// client just sends { mode, context, messages, latestUserMessage }.
// Closes /cso Finding #1 + Codex G1/G2/G3 (worker no longer trusts
// caller-supplied systemPrompt).
//
// The prompt builder lives in lib/promptBuilder.ts so the worker bundle
// can import it directly via esbuild. Client callers (chat.tsx,
// ChatBubble.tsx, etc.) keep using the re-exports below.
import { auth } from './firebase';
import {
  buildSystemPrompt,
  sanitizeForPrompt,
  sanitizeStringArray,
  detectBypassAttempt,
  type ChatContext,
  type ParentGenderCtx,
} from '../lib/promptBuilder';

export { buildSystemPrompt, sanitizeForPrompt, sanitizeStringArray, detectBypassAttempt };
export type { ChatContext, ParentGenderCtx };

const WORKER_URL = process.env.EXPO_PUBLIC_CLAUDE_WORKER_URL ?? '';

export const isAnthropicConfigured = (): boolean => !!WORKER_URL;

// ─── Outgoing-message shape ─────────────────────────────────────────────────
export interface OutgoingMessage {
  role: 'user' | 'assistant';
  content: string;
  /** data URL (data:image/jpeg;base64,…) for a user-attached image. Only
      meaningful on user messages — Claude replies are always text-only. */
  imageDataUrl?: string;
  imageMimeType?: string;
}

function toAnthropicMessage(m: OutgoingMessage): { role: 'user' | 'assistant'; content: any } {
  if (m.imageDataUrl && m.imageMimeType && m.role === 'user') {
    const base64 = m.imageDataUrl.includes(',') ? m.imageDataUrl.split(',', 2)[1] : m.imageDataUrl;
    const parts: any[] = [
      { type: 'image', source: { type: 'base64', media_type: m.imageMimeType, data: base64 } },
    ];
    if (m.content && m.content.trim()) {
      parts.push({ type: 'text', text: m.content });
    } else {
      parts.push({ type: 'text', text: '(image attached)' });
    }
    return { role: m.role, content: parts };
  }
  return { role: m.role, content: m.content };
}

export async function sendMessage(
  messages: Array<OutgoingMessage>,
  context: ChatContext,
): Promise<string> {
  if (!WORKER_URL) {
    return "⚙️ AI chat isn't configured yet. Set EXPO_PUBLIC_CLAUDE_WORKER_URL in .env.";
  }
  const user = auth?.currentUser;
  if (!user) {
    return "Please sign in to chat with MaaMitra. 💙";
  }

  try {
    const idToken = await user.getIdToken();
    const latestUserMsg = [...messages].reverse().find((m) => m.role === 'user');

    // Auto-compact long threads — the worker also enforces this but the
    // client trims first so we don't pay the network round trip on payloads
    // that would have been rejected.
    const MAX_HISTORY = 30;
    let trimmed = messages;
    if (messages.length > MAX_HISTORY) {
      const tail = messages.slice(-MAX_HISTORY);
      const firstUserIdx = tail.findIndex((m) => m.role === 'user');
      trimmed = firstUserIdx >= 0 ? tail.slice(firstUserIdx) : tail;
    }

    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      // New contract: { mode, context, latestUserMessage, messages }.
      // Worker builds the system prompt from context + mode. Caller-
      // supplied `systemPrompt` is rejected. Closes /cso Finding #1.
      body: JSON.stringify({
        mode: 'chat',
        context,
        latestUserMessage: latestUserMsg?.content ?? '',
        messages: trimmed.map(toAnthropicMessage),
      }),
    });

    if (!res.ok) {
      const status = res.status;
      if (status === 429) return "I'm getting a lot of requests right now. Please try again in a moment. 😊";
      if (status === 401) return "⚠️ Your session expired — please sign out and sign in again.";
      if (status === 413) return "That message is too large — please shorten it or try a smaller image.";
      if (status === 426) return "MaaMitra was updated — please refresh the page to get the latest version. 💙";
      throw new Error(`Worker returned ${status}`);
    }

    const data = await res.json();
    const content = data?.content?.[0];
    if (content?.type === 'text') return stripMarkdown(content.text);
    return 'I had trouble understanding that. Could you try again?';
  } catch (error: any) {
    console.error('Claude proxy error:', error);
    return "I'm having a little trouble right now. Please try again in a moment. 💙";
  }
}

// ─── Output text utilities ──────────────────────────────────────────────────
/**
 * Strip [GO:Label|/path] navigation tokens (and aliases) from text. Use this
 * for surfaces where the chip can't render — saved-answer text in the
 * Library, copy-to-clipboard, share sheets, voice TTS, etc. The chat bubble
 * itself parses chips into buttons via parseActionChips, so don't apply this
 * before the bubble renders.
 */
export function stripActionChips(text: string): string {
  return text
    .replace(/\[(?:GO|NAV|LINK|OPEN)\s*:\s*[^|→\]\n]+?\s*(?:\||→)\s*[^\]\n]+?\s*\]/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Strips markdown formatting from AI responses so text renders as natural
 * conversational language in the chat bubble (which uses plain <Text>).
 * NOTE: [GO:Label|/path] action tokens are NOT stripped here — they survive
 * to ChatBubble.parseActionChips so the chip can render. Use stripActionChips
 * separately for places that need them removed (TTS, saved answers, share).
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/(?<!\*)\*(?!\*)([^*\n]+)(?<!\*)\*(?!\*)/g, '$1')
    .replace(/(?<!_)_(?!_)([^_\n]+)(?<!_)_(?!_)/g, '$1')
    .replace(/^#{1,6}\s+(.+)$/gm, '$1')
    .replace(/^\s*[-*•]\s+/gm, '— ')
    .replace(/^\s*\d+\.\s+/gm, '— ')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── Topic intent detectors (used by the chat suggestion / allergy gate) ────
export function detectIsEmergency(text: string): boolean {
  const keywords = [
    'not breathing', 'unconscious', 'severe bleeding', 'seizure', 'fits',
    'convulsion', 'not responding', 'blue lips', '104', '105', '106',
    'high fever', 'difficulty breathing', 'stopped breathing', 'choking',
  ];
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

export function detectIsFood(text: string): boolean {
  const lower = text.toLowerCase();
  const emergencyKeywords = [
    'breathing', 'not breathing', 'unconscious', 'seizure', 'fever',
    'emergency', 'hospital', 'scared', 'help', 'ambulance', 'moving', 'blue',
    'choking', 'choke', 'convulsion', 'unresponsive', '104', '105',
  ];
  if (emergencyKeywords.some(k => lower.includes(k))) return false;
  const foodKeywords = [
    'food', 'eat', 'meal', 'diet', 'recipe', 'nutrition', 'solid', 'fruit',
    'vegetable', 'cereal', 'porridge', 'khichdi', 'ragi', 'dal', 'introduce',
    'weaning', 'breastfeed', 'formula', 'snack', 'cook',
  ];
  return foodKeywords.some(k => lower.includes(k));
}

export function detectIsYoga(text: string): boolean {
  const keywords = ['yoga', 'exercise', 'workout', 'stretch', 'fitness', 'pose', 'asana'];
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

// ─── Topic tagging (used by the saved-answer Library) ───────────────────────
/**
 * Word-boundary keyword scorer. Each topic has a list of keywords; each
 * match in user-message + bot-response contributes to a score. Highest
 * scoring topic wins, ties go to whichever appears first. All-zeros →
 * 💬 General. User message gets x2 weight (the question intent),
 * bot response x1 (corroboration).
 */
const TAG_RULES: Array<{ tag: string; color: string; keywords: string[] }> = [
  { tag: '💉 Vaccines', color: '#3b82f6',
    keywords: ['vaccine', 'vaccination', 'vaccinate', 'immuni[sz]ation', 'shot', 'jab', 'iap', 'mmr', 'bcg', 'opv', 'dtp', 'dtap', 'hepatitis', 'rotavirus'] },
  { tag: '🥗 Nutrition', color: '#22c55e',
    keywords: ['nutrition', 'nutrient', 'meal', 'meals', 'diet', 'breastfeed', 'breastfeeding', 'breast milk', 'formula', 'weaning', 'solids', 'rice', 'dal', 'khichdi', 'porridge', 'fruit', 'fruits', 'vegetable', 'vegetables', 'snack', 'snacks', 'recipe', 'recipes', 'food allergy', 'food'] },
  { tag: '😴 Sleep', color: '#8b5cf6',
    keywords: ['sleep', 'sleeping', 'nap', 'napping', 'bedtime', 'wake', 'night feeding', 'night waking', 'lullaby', 'cosleep', 'co-sleep'] },
  { tag: '🧘 Wellness', color: '#f59e0b',
    keywords: ['yoga', 'exercise', 'workout', 'meditation', 'breathing', 'pranayama', 'asana', 'stretch', 'fitness', 'kegels'] },
  { tag: '🏥 Health', color: '#ef4444',
    keywords: ['fever', 'cough', 'cold', 'flu', 'sick', 'illness', 'doctor', 'paediatrician', 'pediatrician', 'rash', 'allergy', 'allergic', 'infection', 'antibiotic', 'medicine', 'medication', 'symptom', 'temperature', 'vomit', 'diarrhea', 'diarrhoea', 'teeth', 'teething', 'colic', 'eczema', 'reflux'] },
  { tag: '🌱 Development', color: '#10b981',
    keywords: ['milestone', 'milestones', 'development', 'developmental', 'developing', 'growth chart', 'crawl', 'crawling', 'walk', 'walking', 'talk', 'talking', 'speech', 'speak', 'speaking', 'sit up', 'rolling over', 'cognitive', 'motor skill', 'motor skills', 'fine motor', 'gross motor', 'language', 'babble', 'babbling', 'first word', 'first words', 'play', 'playing', 'tummy time', 'social', 'emotional development'] },
  { tag: '💙 Mental Health', color: '#6366f1',
    keywords: ['anxious', 'anxiety', 'depressed', 'depression', 'postpartum', 'baby blues', 'overwhelm', 'overwhelmed', 'lonely', 'loneliness', 'crying', 'mood', 'stress', 'stressed', 'burnout', 'mental health', 'self-care', 'therapy', 'counsel', 'counselling'] },
];

function buildKeywordRegex(keywords: string[]): RegExp {
  const escaped = keywords.map((k) =>
    k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'),
  );
  return new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'gi');
}
const TAG_REGEX_CACHE: RegExp[] = TAG_RULES.map((r) => buildKeywordRegex(r.keywords));

function scoreTextAgainstRules(text: string): number[] {
  return TAG_REGEX_CACHE.map((re) => {
    re.lastIndex = 0;
    const matches = text.match(re);
    return matches ? matches.length : 0;
  });
}

export function getTopicTag(userMessage: string, botResponse: string): { tag: string; color: string } {
  const userHits = scoreTextAgainstRules((userMessage || '').toLowerCase());
  const botHits = scoreTextAgainstRules((botResponse || '').toLowerCase());
  const scores = TAG_RULES.map((_, i) => userHits[i] * 2 + botHits[i]);
  let bestIdx = -1;
  let bestScore = 0;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] > bestScore) {
      bestScore = scores[i];
      bestIdx = i;
    }
  }
  if (bestIdx < 0) return { tag: '💬 General', color: '#9ca3af' };
  return { tag: TAG_RULES[bestIdx].tag, color: TAG_RULES[bestIdx].color };
}
