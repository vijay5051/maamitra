// API key is no longer used client-side — all calls go through the Cloudflare Worker proxy.
// Set EXPO_PUBLIC_CLAUDE_WORKER_URL in .env to your Worker URL.
import { auth } from './firebase';
import { ARTICLES, type Article } from '../data/articles';
import { GOVERNMENT_SCHEMES, type GovernmentScheme } from '../data/schemes';
import { MILESTONES, type Milestone } from '../data/milestones';
import { TEETH } from '../data/teeth';
import { YOGA_SESSIONS } from '../data/yogaSessions';

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
  kidDOB?: string;           // ISO date — used to compute trimester / week
  kidGender?: string;        // boy/girl/surprise
  isExpecting?: boolean;     // explicit expecting flag
  allergies?: string[] | null;
  healthConditions?: string[] | null;
  parentGender?: ParentGenderCtx;

  // Pass 2 — richer personalization signals the AI can use to tailor
  // its answer. All optional; buildSystemPrompt renders only what's set.
  completedVaccinesCount?: number;
  nextVaccineName?: string;
  nextVaccineDueInDays?: number;
  teethErupted?: number;
  teethTotal?: number;
  nextToothName?: string;
  recentMoodAvg?: number;          // 1-5, last 3-7 days
  recentMoodTrend?: 'low' | 'ok' | 'good';
  savedAnswerTopics?: string[];    // e.g. ["Weaning", "Sleep"] — interests
  currentSeason?: string;          // "monsoon", "summer", etc. (India)
  pregnancyWeek?: number;          // calculated from due date

  // Explicit language preference (BCP-47, e.g. "hi-IN") set by the user
  // via the Chat → language picker. When provided AND non-English, the
  // AI replies in that language regardless of what the user typed.
  // English / unset → auto-detect from the user's text (legacy behaviour).
  preferredLanguageCode?: string;
  preferredLanguageLabel?: string;  // English name, e.g. "Hindi"
  preferredLanguageNative?: string; // Native script name, e.g. "हिन्दी"
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

// ─── Retrieval (keyword-based grounding) ─────────────────────────────────────
// When the user's query overlaps with topics we have structured data for,
// we inject a compact "Relevant MaaMitra content" block into the system
// prompt. This grounds Claude's answer in the app's own curated guidance
// (articles / schemes / milestones / teeth / yoga) instead of generic
// parenting clichés. Keeps Claude specific and on-message.
//
// Keyword match is intentionally cheap — no embeddings, no vector DB. For
// ~60 articles + 7 schemes + 30 milestones it's plenty.

function scoreByKeyword(text: string, corpus: string, weight = 1): number {
  if (!text || !corpus) return 0;
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4); // ignore tiny stopwords
  if (tokens.length === 0) return 0;
  const lower = corpus.toLowerCase();
  let hits = 0;
  for (const t of tokens) {
    if (lower.includes(t)) hits += 1;
  }
  return hits * weight;
}

interface RetrievalResult {
  articles: Article[];
  schemes: GovernmentScheme[];
  milestones: Milestone[];
  teethNote: string | null;
  yogaPick: string | null;
}

function retrieveGrounding(
  query: string,
  ctx: ChatContext,
): RetrievalResult {
  const q = query || '';
  if (!q.trim()) {
    return { articles: [], schemes: [], milestones: [], teethNote: null, yogaPick: null };
  }

  // ── Articles: age-gated + topic/title/tag keyword match, top 3 ──
  const age = ctx.kidAgeMonths ?? 0;
  const eligibleArticles = ARTICLES.filter(
    (a) => age >= a.ageMin && age <= a.ageMax,
  );
  const scoredArticles = eligibleArticles.map((a) => ({
    a,
    score:
      scoreByKeyword(q, a.title, 3) +
      scoreByKeyword(q, a.topic, 2) +
      scoreByKeyword(q, a.tag, 2) +
      scoreByKeyword(q, a.preview, 1),
  }));
  const articles = scoredArticles
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.a);

  // ── Schemes: state × stage × girl-child; narrow by query keywords ──
  const stageTag = ctx.isExpecting ? 'pregnant' : 'newborn';
  const relevantByStage = GOVERNMENT_SCHEMES.filter(
    (s) =>
      s.tags.includes(stageTag) ||
      s.tags.includes('all') ||
      (ctx.kidGender === 'girl' && s.tags.includes('girl')),
  );
  const scoredSchemes = relevantByStage.map((s) => ({
    s,
    score:
      scoreByKeyword(q, s.name, 3) +
      scoreByKeyword(q, s.shortDesc, 2) +
      scoreByKeyword(q, s.benefit, 1) +
      (/(scheme|benefit|subsidy|yojana|government|money|cash|maternity|sukanya)/i.test(q) ? 5 : 0),
  }));
  const schemes = scoredSchemes
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((x) => x.s);

  // ── Milestones: within kid's current age ±3 months, query-filtered ──
  const milestonesInWindow = MILESTONES.filter(
    (m) => Math.abs(m.ageMonths - age) <= 3,
  );
  const scoredMilestones = milestonesInWindow.map((m) => ({
    m,
    score:
      scoreByKeyword(q, m.title, 3) +
      scoreByKeyword(q, m.category, 2) +
      scoreByKeyword(q, m.description, 1) +
      (/(milestone|develop|normal|grow|should)/i.test(q) ? 3 : 0),
  }));
  const milestones = scoredMilestones
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.m);

  // ── Teeth note: if user asks about teething ──
  let teethNote: string | null = null;
  if (/(teeth|teething|tooth|gums|drool|biting)/i.test(q) && age >= 3) {
    const nextTooth = TEETH.find((t) => age <= t.eruptMinMo);
    teethNote = nextTooth
      ? `Typical next tooth for a ${age}-month-old: ${nextTooth.shortName} (usually ${nextTooth.eruptMinMo}-${nextTooth.eruptMaxMo} months). The app's Teeth tracker can log eruption dates.`
      : `At ${age} months most primary teeth are in. The app's Teeth tracker can log progress.`;
  }

  // ── Yoga pick: if user asks about stress/sleep/exercise ──
  let yogaPick: string | null = null;
  if (/(yoga|exercise|stress|anxious|overwhelm|sleep|tired|relax)/i.test(q)) {
    const id = /stress|anxious|overwhelm/i.test(q)
      ? 'y04'
      : /sleep|tired/i.test(q)
      ? 'y05'
      : ctx.isExpecting
      ? 'y01'
      : age < 12
      ? 'y03'
      : 'y05';
    const session = YOGA_SESSIONS.find((s) => s.id === id);
    if (session) {
      yogaPick = `The app has a ${session.duration}-minute ${session.level} session called "${session.name}" under Wellness.`;
    }
  }

  return { articles, schemes, milestones, teethNote, yogaPick };
}

function renderGroundingBlock(r: RetrievalResult): string {
  const sections: string[] = [];

  if (r.articles.length) {
    const lines = r.articles
      .map((a) => `- ${a.title} (${a.readTime} · ${a.topic}): ${a.preview.slice(0, 180)}`)
      .join('\n');
    sections.push(`Articles in MaaMitra's Library that match:\n${lines}`);
  }
  if (r.schemes.length) {
    const lines = r.schemes
      .map((s) => `- ${s.name}: ${s.shortDesc}. ${s.benefit.slice(0, 160)}`)
      .join('\n');
    sections.push(`Relevant Indian government schemes:\n${lines}`);
  }
  if (r.milestones.length) {
    const lines = r.milestones
      .map((m) => `- ${m.ageLabel} — ${m.title} (${m.category}): ${m.description.slice(0, 160)}`)
      .join('\n');
    sections.push(`Age-appropriate milestones:\n${lines}`);
  }
  if (r.teethNote) sections.push(`Teething context: ${r.teethNote}`);
  if (r.yogaPick) sections.push(`Wellness: ${r.yogaPick}`);

  if (sections.length === 0) return '';
  return `\n\nRELEVANT MAAMITRA CONTENT (use this first when answering — it's what the user already trusts):\n${sections.join('\n\n')}\n\nWhen you reference one of the items above, weave the title into the sentence naturally (e.g. "there's a guide in your Library called 'Starting Solid Foods' that walks through this"). Don't list them all — pick one or two that directly answer the question.`;
}

export function buildSystemPrompt(
  ctx: ChatContext,
  userQuery?: string,
): string {
  const labels = getRoleLabels(ctx.parentGender);

  // Pregnancy week from due date, if available and user is expecting.
  // Standard pregnancy is 40 weeks; we compute week = 40 - weeks_until_due.
  let pregnancyWeekLine = '';
  if ((ctx.isExpecting || ctx.stage === 'pregnant') && ctx.kidDOB) {
    const dueDate = new Date(ctx.kidDOB);
    const weeksUntilDue = Math.round((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7));
    const week = Math.max(1, Math.min(42, 40 - weeksUntilDue));
    const trimester = week <= 13 ? 'first' : week <= 27 ? 'second' : 'third';
    pregnancyWeekLine = ` Currently around week ${week} (${trimester} trimester).`;
  } else if (ctx.pregnancyWeek) {
    const w = ctx.pregnancyWeek;
    const trimester = w <= 13 ? 'first' : w <= 27 ? 'second' : 'third';
    pregnancyWeekLine = ` Currently around week ${w} (${trimester} trimester).`;
  }

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

  // Extra personalization lines — only include signals that are present.
  const extraLines: string[] = [];
  if (ctx.completedVaccinesCount !== undefined && ctx.completedVaccinesCount > 0) {
    extraLines.push(`Vaccines completed so far: ${ctx.completedVaccinesCount}.`);
  }
  if (ctx.nextVaccineName) {
    const dueDesc =
      ctx.nextVaccineDueInDays !== undefined
        ? ctx.nextVaccineDueInDays < 0
          ? `overdue by ${Math.abs(ctx.nextVaccineDueInDays)} days`
          : ctx.nextVaccineDueInDays === 0
          ? 'due today'
          : `due in ${ctx.nextVaccineDueInDays} days`
        : 'upcoming';
    extraLines.push(`Next vaccine: ${ctx.nextVaccineName} (${dueDesc}).`);
  }
  if (ctx.teethErupted !== undefined && ctx.teethTotal) {
    extraLines.push(
      `Teeth: ${ctx.teethErupted}/${ctx.teethTotal} erupted${ctx.nextToothName ? `; next typically ${ctx.nextToothName}` : ''}.`,
    );
  }
  if (ctx.recentMoodAvg !== undefined) {
    const tone =
      ctx.recentMoodTrend ??
      (ctx.recentMoodAvg <= 2.5 ? 'low' : ctx.recentMoodAvg >= 4 ? 'good' : 'ok');
    extraLines.push(
      `Recent mood average (past few days): ${ctx.recentMoodAvg.toFixed(1)}/5 — trending ${tone}.`,
    );
  }
  if (ctx.savedAnswerTopics && ctx.savedAnswerTopics.length > 0) {
    extraLines.push(
      `Topics they've saved before: ${ctx.savedAnswerTopics.slice(0, 5).join(', ')}.`,
    );
  }
  const now = new Date();
  const seasonLabel = ctx.currentSeason ?? indianSeason(now);
  extraLines.push(`Today is ${now.toDateString()}; India is in ${seasonLabel} season.`);

  const extraBlock = extraLines.length > 0
    ? `\n\nCURRENT SIGNALS (use these when relevant — don't recite them):\n${extraLines.map((l) => `- ${l}`).join('\n')}`
    : '';

  // ── Grounding block — retrieved from app's own data ──
  const retrieved = retrieveGrounding(userQuery ?? '', ctx);
  const groundingBlock = renderGroundingBlock(retrieved);

  const moodToneLine =
    ctx.recentMoodAvg !== undefined && ctx.recentMoodAvg <= 2.5
      ? `\n\nTONE NOTE: ${ctx.motherName}'s recent mood has been low. Lead with empathy — a gentle acknowledgement before any advice. Keep it light, not preachy.`
      : '';

  return `You are MaaMitra — a warm, knowledgeable companion for ${labels.audience}. Think of yourself as that one close friend who happens to know everything about babies, pregnancy, and health, and always responds with love and zero judgment.

WHO YOU'RE TALKING TO:
${ctx.motherName} is ${stageDesc}.${pregnancyWeekLine} ${labels.pronounSubj} ${labels.pronounSubj === 'They' ? 'live' : 'lives'} in ${ctx.state}, India, in ${familyDesc}. ${labels.pronounSubj} ${labels.pronounSubj === 'They' ? 'follow' : 'follows'} a ${ctx.diet} diet.${kidLine ? ` ${kidLine}` : ''}${ctx.allergies?.length ? ` Known allergies: ${ctx.allergies.join(', ')}.` : ''}${ctx.healthConditions?.length ? ` Health conditions: ${ctx.healthConditions.join(', ')}.` : ''}${extraBlock}${groundingBlock}${moodToneLine}

This user is ${labels.parentNoun === 'mother' ? 'a mother' : labels.parentNoun === 'father' ? 'a father' : 'a parent/caregiver'} — address them accordingly. Never assume they are a mother if they are not. Do not use "mama" / "mother" language if the user is a father; use "papa" / "dad" / or simply their name. Use their name warmly and naturally.

LANGUAGE: ${
  ctx.preferredLanguageCode &&
  ctx.preferredLanguageCode !== 'en-IN' &&
  ctx.preferredLanguageLabel
    ? `The user has explicitly set their preferred language to ${ctx.preferredLanguageLabel}${ctx.preferredLanguageNative ? ` (${ctx.preferredLanguageNative})` : ''}. Always reply in ${ctx.preferredLanguageLabel}, using the standard ${ctx.preferredLanguageNative ? `${ctx.preferredLanguageNative} script` : 'script for that language'}, even if their message is in English or mixes languages. Keep the same warm, conversational tone — translate the meaning, don't transliterate. Only fall back to English for medical terms or names that have no natural translation.`
    : `If the user writes in Hindi, Hinglish, or any other Indian language (Tamil, Bengali, Marathi, Telugu, Gujarati, Punjabi, Kannada, Malayalam, Urdu, etc.) — reply in that same language, using the same script they used. If they mix languages casually, mirror that mix. Default to English only if the user writes in English.`
}

HOW TO WRITE — READ THIS CAREFULLY:
Plain conversational text only. Write exactly like a caring friend sending a message — warm, natural sentences that flow together.

Never use any markdown formatting. This means:
- No **bold** or *italics* — ever
- No bullet points (no -, no •, no *)
- No numbered lists like 1. 2. 3.
- No headings or subheadings (no ##, no bold titles)
- No "Here are X tips:" followed by a list

Instead of listing, weave things naturally into sentences. Say "you could try ragi, banana, or sweet potato to start" not a bullet list. If you genuinely need to separate distinct things, use a new line between them — but write each as a complete sentence, not a fragment.

Keep it warm and specific. For simple questions 3-5 sentences is enough. For complex medical, nutritional, or developmental questions, be thorough — 6-10 sentences is fine if the extra detail is useful (specific foods, portion sizes, age windows, red flags to watch for, what the user's state/age means for the answer). A thoughtful answer that actually helps beats a short one that doesn't.

Sound like a human who cares. Say things like "Oh that's actually really common" or "Don't worry, this happened to me too" or "Honestly, the easiest thing to try is..." Use their name sometimes — it makes them feel seen. End with warmth.

Be India-specific. Suggest local foods like dal, ragi, khichdi, moong, ghee. Reference Indian seasons, climate, schemes, and routines where relevant. Use the current signals above — their kid's actual age, their state, their allergies, what vaccines they've done — instead of generic advice.

Medical guidance: Follow IAP ACVIP 2023 (Indian Pediatrics, Jan 2024) and FOGSI guidelines. Never diagnose — always suggest seeing a doctor for anything that needs one. For emergencies (not breathing, unconscious, severe bleeding, seizures, fever above 104°F, difficulty breathing), start your response with "🚨 Please act right now —" and give clear steps while telling them to call 108.`;
}

function indianSeason(d: Date): string {
  const m = d.getMonth(); // 0-11
  // India-approximate seasons
  if (m === 11 || m <= 1) return 'winter';
  if (m >= 2 && m <= 3) return 'spring';
  if (m >= 4 && m <= 5) return 'summer';
  if (m >= 6 && m <= 8) return 'monsoon';
  return 'autumn';
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
export interface OutgoingMessage {
  role: 'user' | 'assistant';
  content: string;
  /** data URL (data:image/jpeg;base64,…) for a user-attached image. Only
      meaningful on user messages — Claude replies are always text-only. */
  imageDataUrl?: string;
  imageMimeType?: string;
}

/**
 * Convert our internal OutgoingMessage shape into the Anthropic Messages
 * API content shape. Plain text stays a string; messages with an image
 * become a structured content array with an image source + text block.
 */
function toAnthropicMessage(m: OutgoingMessage): { role: 'user' | 'assistant'; content: any } {
  if (m.imageDataUrl && m.imageMimeType && m.role === 'user') {
    // data URLs look like "data:image/jpeg;base64,…" — strip the prefix so
    // we send just the base64 payload Anthropic expects.
    const base64 = m.imageDataUrl.includes(',')
      ? m.imageDataUrl.split(',', 2)[1]
      : m.imageDataUrl;
    const parts: any[] = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: m.imageMimeType,
          data: base64,
        },
      },
    ];
    // Only include the text part if the user actually typed something.
    // Anthropic tolerates empty text but rejects empty content arrays.
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
    // Use the latest user message as the retrieval query so we inject
    // app-specific articles / schemes / milestones that actually match
    // the question being asked.
    const latestUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        systemPrompt: buildSystemPrompt(context, latestUserMsg?.content),
        messages: messages.map(toAnthropicMessage),
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
