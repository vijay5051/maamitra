// API key is no longer used client-side — all calls go through the Cloudflare Worker proxy.
// Set EXPO_PUBLIC_CLAUDE_WORKER_URL in .env to your Worker URL.
import { auth } from './firebase';

const WORKER_URL = process.env.EXPO_PUBLIC_CLAUDE_WORKER_URL ?? '';

export const isAnthropicConfigured = (): boolean => !!WORKER_URL;

export type ParentGenderCtx = 'mother' | 'father' | 'other' | '';

export interface ChatContext {
  motherName: string;
  stage: string;
  state: string;
  diet: string;
  familyType?: string;       // nuclear/joint/in-laws/single-parent
  kidName?: string;
  kidAgeMonths?: number;
  kidDOB?: string;
  kidGender?: string;        // boy/girl/surprise
  isExpecting?: boolean;     // explicit expecting flag
  allergies?: string[] | null;
  healthConditions?: string[] | null;
  parentGender?: ParentGenderCtx;
}

// Role-aware labels so the AI can address fathers + other caregivers correctly.
type RoleLabels = {
  audience: string;     // "Indian mothers" / "Indian fathers" / "Indian parents"
  roleNoun: string;     // "a mother" / "a new dad" / "a parent"
  parentNoun: string;   // "mother" / "father" / "parent" — used in the talking-to header
  pronounSubj: string;  // "She" / "He" / "They"
  pronounPoss: string;  // "Her" / "His" / "Their"
};

function getRoleLabels(pg: ParentGenderCtx | undefined): RoleLabels {
  if (pg === 'father') {
    return {
      audience: 'Indian fathers',
      roleNoun: 'a new dad',
      parentNoun: 'father',
      pronounSubj: 'He',
      pronounPoss: 'His',
    };
  }
  if (pg === 'other') {
    return {
      audience: 'Indian parents and caregivers',
      roleNoun: 'a caregiver',
      parentNoun: 'parent',
      pronounSubj: 'They',
      pronounPoss: 'Their',
    };
  }
  // Default: mother (covers '' and 'mother')
  return {
    audience: 'Indian mothers',
    roleNoun: 'a mother',
    parentNoun: 'mother',
    pronounSubj: 'She',
    pronounPoss: 'Her',
  };
}

export function buildSystemPrompt(ctx: ChatContext): string {
  const labels = getRoleLabels(ctx.parentGender);

  const stageDesc = ctx.isExpecting
    ? (ctx.parentGender === 'father' ? 'expecting a baby' : 'currently pregnant')
    : ctx.stage === 'pregnant'
      ? (ctx.parentGender === 'father' ? 'expecting a baby' : 'currently pregnant')
      : ctx.stage === 'planning' ? 'planning to conceive'
      : ctx.kidAgeMonths !== undefined && ctx.kidAgeMonths < 6 ? 'in the newborn phase'
      : labels.roleNoun;

  const familyDesc = ctx.familyType === 'joint' ? 'a joint family'
    : ctx.familyType === 'in-laws' ? 'a home with in-laws'
    : ctx.familyType === 'single-parent' ? 'a single-parent household'
    : 'a nuclear family';

  const kidGenderWord = ctx.kidGender === 'boy' ? 'son' : ctx.kidGender === 'girl' ? 'daughter' : 'baby';

  const kidLine = ctx.kidName
    ? `${labels.pronounPoss} ${kidGenderWord} is ${ctx.kidName}${ctx.kidAgeMonths !== undefined ? `, who is ${ctx.kidAgeMonths} months old` : ctx.isExpecting ? ' (on the way)' : ''}.`
    : null;

  return `You are MaaMitra — a warm, knowledgeable companion for ${labels.audience}. Think of yourself as that one close friend who happens to know everything about babies, pregnancy, and health, and always responds with love and zero judgment.

WHO YOU'RE TALKING TO:
${ctx.motherName} is ${stageDesc}. ${labels.pronounSubj} ${labels.pronounSubj === 'They' ? 'live' : 'lives'} in ${ctx.state}, India, in ${familyDesc}. ${labels.pronounSubj} ${labels.pronounSubj === 'They' ? 'follow' : 'follows'} a ${ctx.diet} diet.${kidLine ? ` ${kidLine}` : ''}${ctx.allergies?.length ? ` Known allergies: ${ctx.allergies.join(', ')}.` : ''}${ctx.healthConditions?.length ? ` Health conditions: ${ctx.healthConditions.join(', ')}.` : ''}

This user is ${labels.parentNoun === 'mother' ? 'a mother' : labels.parentNoun === 'father' ? 'a father' : 'a parent/caregiver'} — address them accordingly. Never assume they are a mother if they are not. Do not use "mama" / "mother" language if the user is a father; use "papa" / "dad" / or simply their name. Use their name warmly and naturally.

HOW TO WRITE — READ THIS CAREFULLY:
Plain conversational text only. Write exactly like a caring friend sending a message — warm, natural sentences that flow together.

Never use any markdown formatting. This means:
- No **bold** or *italics* — ever
- No bullet points (no -, no •, no *)
- No numbered lists like 1. 2. 3.
- No headings or subheadings (no ##, no bold titles)
- No "Here are X tips:" followed by a list

Instead of listing, weave things naturally into sentences. Say "you could try ragi, banana, or sweet potato to start" not a bullet list. If you genuinely need to separate distinct things, use a new line between them — but write each as a complete sentence, not a fragment.

Keep it short and warm. 3 to 5 sentences is almost always enough. A shorter answer with heart beats a long answer that feels like a brochure.

Sound like a human who cares. Say things like "Oh that's actually really common" or "Don't worry, this happened to me too" or "Honestly, the easiest thing to try is..." Use her name sometimes — it makes her feel seen. End with warmth.

Be India-specific. Suggest local foods like dal, ragi, khichdi, moong, ghee. Reference Indian seasons and routines where relevant.

Medical guidance: Follow IAP 2024 and FOGSI guidelines. Never diagnose — always suggest seeing a doctor for anything that needs one. For emergencies (not breathing, unconscious, severe bleeding, seizures, fever above 104°F, difficulty breathing), start your response with "🚨 Please act right now —" and give clear steps while telling her to call 108.`;
}

/**
 * Strips markdown formatting from AI responses so text renders as natural
 * conversational language in the chat bubble (which uses plain <Text>).
 */
export function stripMarkdown(text: string): string {
  return text
    // Remove bold (**text** and __text__)
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    // Remove italic (*text* and _text_) — careful not to eat emoji asterisks
    .replace(/(?<!\*)\*(?!\*)([^*\n]+)(?<!\*)\*(?!\*)/g, '$1')
    .replace(/(?<!_)_(?!_)([^_\n]+)(?<!_)_(?!_)/g, '$1')
    // Remove headings (##, ###, etc.) — replace with just the heading text
    .replace(/^#{1,6}\s+(.+)$/gm, '$1')
    // Replace markdown-style bullet lines (-, *, •) with a clean em-dash inline
    .replace(/^\s*[-*•]\s+/gm, '— ')
    // Replace numbered list items (1. 2. etc.) with em-dash
    .replace(/^\s*\d+\.\s+/gm, '— ')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Remove inline code backticks
    .replace(/`([^`]+)`/g, '$1')
    // Remove triple+ newlines → double
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function detectIsEmergency(text: string): boolean {
  const keywords = [
    'not breathing',
    'unconscious',
    'severe bleeding',
    'seizure',
    'fits',
    'convulsion',
    'not responding',
    'blue lips',
    '104',
    '105',
    '106',
    'high fever',
    'difficulty breathing',
    'stopped breathing',
    'choking',
  ];
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

export function detectIsFood(text: string): boolean {
  const lower = text.toLowerCase();

  // Never intercept emergency / medical queries — they must go straight to AI
  const emergencyKeywords = [
    'breathing', 'not breathing', 'unconscious', 'seizure', 'fever',
    'emergency', 'hospital', 'scared', 'help', 'ambulance', 'moving', 'blue',
    'choking', 'choke', 'convulsion', 'unresponsive', '104', '105',
  ];
  if (emergencyKeywords.some(k => lower.includes(k))) return false;

  const foodKeywords = [
    'food', 'eat', 'meal', 'diet', 'recipe', 'nutrition',
    'solid', 'fruit', 'vegetable', 'cereal', 'porridge',
    'khichdi', 'ragi', 'dal', 'introduce', 'weaning',
    'breastfeed', 'formula', 'snack', 'cook',
  ];
  return foodKeywords.some(k => lower.includes(k));
}

export function detectIsYoga(text: string): boolean {
  const keywords = ['yoga', 'exercise', 'workout', 'stretch', 'fitness', 'pose', 'asana'];
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

// All Claude API calls are proxied through the Cloudflare Worker so the API
// key is never exposed in the browser bundle.
export async function sendMessage(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: ChatContext
): Promise<string> {
  if (!WORKER_URL) {
    return "⚙️ AI chat isn't configured yet. Set EXPO_PUBLIC_CLAUDE_WORKER_URL in .env.";
  }

  // Worker requires a Firebase ID token on every request so unauthenticated
  // traffic can't drain our Anthropic budget.
  const user = auth?.currentUser;
  if (!user) {
    return "Please sign in to chat with MaaMitra. 💙";
  }

  try {
    const idToken = await user.getIdToken();
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        systemPrompt: buildSystemPrompt(context),
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) {
      const status = res.status;
      if (status === 429) return "I'm getting a lot of requests right now. Please try again in a moment. 😊";
      if (status === 401) return "⚠️ Your session expired — please sign out and sign in again.";
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

export function getTopicTag(
  userMessage: string,
  botResponse: string
): { tag: string; color: string } {
  const text = (userMessage + ' ' + botResponse).toLowerCase();
  if (text.includes('vaccine') || text.includes('vaccination'))
    return { tag: '💉 Vaccines', color: '#3b82f6' };
  if (text.includes('food') || text.includes('eat') || text.includes('feed'))
    return { tag: '🥗 Nutrition', color: '#22c55e' };
  if (text.includes('sleep')) return { tag: '😴 Sleep', color: '#8b5cf6' };
  if (text.includes('yoga') || text.includes('exercise'))
    return { tag: '🧘 Wellness', color: '#f59e0b' };
  if (text.includes('fever') || text.includes('sick') || text.includes('doctor'))
    return { tag: '🏥 Health', color: '#ef4444' };
  if (text.includes('milestone') || text.includes('develop'))
    return { tag: '🌱 Development', color: '#10b981' };
  if (text.includes('anxiet') || text.includes('depress') || text.includes('overwhelm'))
    return { tag: '💙 Mental Health', color: '#6366f1' };
  return { tag: '💬 General', color: '#9ca3af' };
}
