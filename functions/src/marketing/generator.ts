// Marketing draft generator (M2).
//
// Same internal flow used by:
//   - generateMarketingDraft (admin-callable, "Generate now" button)
//   - dailyMarketingDraftCron (pubsub schedule, 6am IST)
//
// Flow:
//   1. Read brand kit (palette, voice, personas, pillars, calendar, compliance).
//   2. Pick today's slot — caller-supplied persona/pillar/event override; else
//      auto-select from weekday theme + active cultural events.
//   3. Ask OpenAI gpt-4o-mini for {headline, body, hashtags, template,
//      imagePrompt} as JSON. System prompt embeds brand voice + persona +
//      pillar + event hint + compliance "do not say" list.
//   4. Run the rendered template (Imagen by default for cultural fidelity).
//   5. Run compliance scorer (regex against the brand's own ComplianceRules).
//   6. Auto-attach matched disclaimers to the caption tail.
//   7. Write marketing_drafts/{id} with status='pending_review'.

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

import { fluxSchnell, imagenGenerate, openaiImage, pexelsSearch } from './imageSources';
import { renderTemplate } from './renderer';
import { BrandSnapshot } from './templates';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';

interface GenerateInput {
  personaId?: unknown;
  pillarId?: unknown;
  eventId?: unknown;
  template?: unknown;
  imageModel?: unknown;
}

interface GenerateOk {
  ok: true;
  draftId: string;
  caption: string;
  imageUrl: string;
  imageSource: string;
  template: string;
  costInr: number;
  flags: { type: string; phrase: string }[];
  requiredDisclaimers: string[];
}

interface GenerateErr {
  ok: false;
  code: string;
  message: string;
}

type GenerateResult = GenerateOk | GenerateErr;

type AiImageModel = 'imagen' | 'dalle' | 'flux';
type TemplateName = 'tipCard' | 'quoteCard' | 'milestoneCard';

// ── Caller auth ────────────────────────────────────────────────────────────

async function callerIsMarketingAdmin(
  token: admin.auth.DecodedIdToken | undefined,
  allowList: ReadonlySet<string>,
): Promise<boolean> {
  if (!token) return false;
  if (token.admin === true) return true;
  if (token.email_verified === true && token.email && allowList.has(token.email.toLowerCase())) return true;
  if (!token.uid) return false;
  try {
    const snap = await admin.firestore().doc(`users/${token.uid}`).get();
    const role = snap.exists ? (snap.data() as any)?.adminRole : null;
    return role === 'super' || role === 'content';
  } catch {
    return false;
  }
}

// ── Brand kit shape (server-side mirror) ────────────────────────────────────

interface Persona { id: string; label: string; description: string; enabled: boolean }
interface Pillar  { id: string; label: string; description: string; emoji?: string; enabled: boolean }
interface CalEvent { id: string; label: string; date: string; pillarHint?: string; promptHint?: string }

interface BrandKitData {
  brandName: string;
  voice: { attributes: string[]; avoid: string[]; bilingual: string };
  personas: Persona[];
  pillars: Pillar[];
  culturalCalendar: CalEvent[];
  hashtags: string[];
  themeCalendar: Record<string, { label: string; prompt: string; enabled: boolean }>;
  compliance: {
    medicalForbiddenWords: string[];
    requiredDisclaimers: { trigger: string; text: string }[];
    blockedTopics: string[];
  };
  costCaps: { dailyInr: number; monthlyInr: number; alertAtPct: number };
  palette: { primary: string; background: string; text: string; accent: string };
  logoUrl: string | null;
}

async function loadBrandKit(): Promise<BrandKitData> {
  const snap = await admin.firestore().doc('marketing_brand/main').get();
  const d: any = snap.exists ? snap.data() : {};
  const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
  return {
    brandName: typeof d?.brandName === 'string' ? d.brandName : 'MaaMitra',
    voice: {
      attributes: arr(d?.voice?.attributes),
      avoid: arr(d?.voice?.avoid),
      bilingual: typeof d?.voice?.bilingual === 'string' ? d.voice.bilingual : 'hinglish',
    },
    personas: arr(d?.personas).filter((p: any) => p?.enabled !== false),
    pillars: arr(d?.pillars).filter((p: any) => p?.enabled !== false),
    culturalCalendar: arr(d?.culturalCalendar),
    hashtags: arr(d?.hashtags),
    themeCalendar: d?.themeCalendar ?? {},
    compliance: {
      medicalForbiddenWords: arr(d?.compliance?.medicalForbiddenWords),
      requiredDisclaimers: arr(d?.compliance?.requiredDisclaimers),
      blockedTopics: arr(d?.compliance?.blockedTopics),
    },
    costCaps: {
      dailyInr: typeof d?.costCaps?.dailyInr === 'number' ? d.costCaps.dailyInr : 200,
      monthlyInr: typeof d?.costCaps?.monthlyInr === 'number' ? d.costCaps.monthlyInr : 3000,
      alertAtPct: typeof d?.costCaps?.alertAtPct === 'number' ? d.costCaps.alertAtPct : 80,
    },
    palette: {
      primary:    typeof d?.palette?.primary    === 'string' ? d.palette.primary    : '#E91E63',
      background: typeof d?.palette?.background === 'string' ? d.palette.background : '#FFF8F2',
      text:       typeof d?.palette?.text       === 'string' ? d.palette.text       : '#1F1F2C',
      accent:     typeof d?.palette?.accent     === 'string' ? d.palette.accent     : '#F8C8DC',
    },
    logoUrl: typeof d?.logoUrl === 'string' ? d.logoUrl : null,
  };
}

// ── Slot picker ────────────────────────────────────────────────────────────

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function todayInIst(): { weekdayKey: string; isoDate: string } {
  const now = new Date();
  // Crude IST shift (no DST in India). Good enough for theme picking.
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  return {
    weekdayKey: WEEKDAY_KEYS[ist.getUTCDay()],
    isoDate: ist.toISOString().slice(0, 10),
  };
}

interface PickedSlot {
  persona: Persona | null;
  pillar: Pillar | null;
  event: CalEvent | null;
  themeLabel: string;
  themePrompt: string;
}

function pickSlot(brand: BrandKitData, override: GenerateInput, today: { weekdayKey: string; isoDate: string }): PickedSlot {
  // Cultural event matching today's date — checks YYYY-MM-DD or YYYY-MM-DD
  // suffix of an event date (handles yearly events stored with a year).
  const todayMd = today.isoDate.slice(5); // "MM-DD"
  let event = brand.culturalCalendar.find((e) => {
    const overrideId = typeof override.eventId === 'string' ? override.eventId : '';
    if (overrideId && e.id === overrideId) return true;
    if (overrideId) return false;
    return e.date.slice(5) === todayMd || e.date === today.isoDate;
  }) ?? null;

  // Pillar — explicit override, else event's pillarHint, else first enabled.
  let pillar: Pillar | null = null;
  const pillarOverride = typeof override.pillarId === 'string' ? override.pillarId : '';
  if (pillarOverride) pillar = brand.pillars.find((p) => p.id === pillarOverride) ?? null;
  if (!pillar && event?.pillarHint) pillar = brand.pillars.find((p) => p.id === event!.pillarHint) ?? null;
  if (!pillar) pillar = brand.pillars[0] ?? null;

  // Persona — explicit override, else round-robin by IST day-of-month over
  // enabled personas (so a 5-persona list rotates ~weekly).
  let persona: Persona | null = null;
  const personaOverride = typeof override.personaId === 'string' ? override.personaId : '';
  if (personaOverride) persona = brand.personas.find((p) => p.id === personaOverride) ?? null;
  if (!persona && brand.personas.length > 0) {
    const dayOfMonth = parseInt(today.isoDate.slice(8, 10), 10) || 1;
    persona = brand.personas[(dayOfMonth - 1) % brand.personas.length];
  }

  const theme = brand.themeCalendar[today.weekdayKey];
  return {
    persona,
    pillar,
    event,
    themeLabel: theme?.label ?? today.weekdayKey,
    themePrompt: theme?.prompt ?? '',
  };
}

// ── Caption generation (OpenAI gpt-4o-mini) ────────────────────────────────

interface CaptionOutput {
  headline: string;
  body: string;
  hashtags: string[];
  template: TemplateName;
  imagePrompt: string;
  /** Template-specific structured fields. */
  templateProps: Record<string, any>;
}

async function generateCaption(brand: BrandKitData, slot: PickedSlot): Promise<CaptionOutput> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set in functions/.env');

  const localeInstruction =
    brand.voice.bilingual === 'english_only'
      ? 'Write in English only.'
      : brand.voice.bilingual === 'hinglish'
        ? 'Write in natural Hinglish — English with comfortable Hindi words mixed in (using Latin script). No literal translation.'
        : 'Write in English with occasional Devanagari accent words for emphasis.';

  const eventLine = slot.event
    ? `\nToday is ${slot.event.label}. Tone hint: ${slot.event.promptHint ?? 'respectful, on-theme'}.`
    : '';

  const personaLine = slot.persona
    ? `\nAudience persona: ${slot.persona.label} — ${slot.persona.description}`
    : '';

  const pillarLine = slot.pillar
    ? `\nContent pillar: ${slot.pillar.label} — ${slot.pillar.description}`
    : '';

  const themeLine = slot.themePrompt ? `\nWeekly theme (${slot.themeLabel}): ${slot.themePrompt}` : '';

  const forbidden = brand.compliance.medicalForbiddenWords.slice(0, 30).join(', ');
  const blockedTopics = brand.compliance.blockedTopics.slice(0, 20).join(', ');

  const system = [
    `You are the social-content writer for ${brand.brandName}, an Indian motherhood platform.`,
    `Brand voice: ${brand.voice.attributes.join(', ') || 'warm, honest, judgement-free'}.`,
    `Avoid these words/phrases entirely (medical / over-claim risk): ${forbidden || 'none'}.`,
    `Never write about: ${blockedTopics || 'none specified'}.`,
    localeInstruction,
    'Always respect Indian cultural context — clothing (sari/kurta), names, food, traditions. Default to inclusive / non-prescriptive language.',
    'Output STRICT JSON only. No prose outside the JSON object.',
  ].join('\n');

  const user = [
    `Generate ONE Instagram-square post.`,
    eventLine,
    personaLine,
    pillarLine,
    themeLine,
    '',
    'Pick the most appropriate template:',
    '- "tipCard" — a numbered list of 3 short practical tips (use for advice / safety / how-to)',
    '- "quoteCard" — a single short quote with attribution (use for inspiration / wisdom / cultural)',
    '- "milestoneCard" — an age + bulleted developmental milestones list (use for milestones / development)',
    '',
    'Return JSON with exactly these keys:',
    '{',
    '  "headline": "≤80 chars, the on-image headline",',
    '  "body": "the IG caption body (3–6 sentences, no headline duplication, no hashtags, no disclaimers)",',
    '  "hashtags": ["array", "of", "5-10", "hashtags", "without # prefix"],',
    '  "template": "tipCard" | "quoteCard" | "milestoneCard",',
    '  "imagePrompt": "specific prompt for an AI image generator — describe an Indian-context scene with lighting, mood, palette",',
    '  "templateProps": { /* per-template fields */ }',
    '}',
    '',
    'templateProps shape per template:',
    '  tipCard:        { eyebrow: string (≤30c), title: string (≤80c), tips: string[3-4] (each ≤120c) }',
    '  quoteCard:      { quote: string (≤200c), attribution: string (≤40c) }',
    '  milestoneCard:  { age: string (≤20c), title: string (≤60c), milestones: string[3-5] (each ≤120c) }',
  ].join('\n');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.85,
      max_tokens: 800,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI caption generation failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data?.choices?.[0]?.message?.content ?? '';
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`OpenAI returned non-JSON content: ${raw.slice(0, 200)}…`);
  }

  const template = (['tipCard', 'quoteCard', 'milestoneCard'] as TemplateName[]).includes(parsed?.template)
    ? (parsed.template as TemplateName)
    : 'tipCard';

  return {
    headline: trim(parsed?.headline, 80),
    body: trim(parsed?.body, 1800),
    hashtags: Array.isArray(parsed?.hashtags)
      ? parsed.hashtags
          .map((h: unknown) => (typeof h === 'string' ? h.trim().replace(/^#/, '') : ''))
          .filter(Boolean)
          .slice(0, 12)
      : [],
    template,
    imagePrompt: trim(parsed?.imagePrompt, 600),
    templateProps: typeof parsed?.templateProps === 'object' && parsed?.templateProps ? parsed.templateProps : {},
  };
}

function trim(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

// ── Compliance screen (regex, mirrors scoring.ts) ──────────────────────────

interface ComplianceFlag {
  type: 'forbidden_word' | 'blocked_topic';
  phrase: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findPhrase(haystack: string, phrase: string): boolean {
  if (!phrase) return false;
  const isWord = /^\w+$/.test(phrase);
  const re = isWord
    ? new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'i')
    : new RegExp(escapeRegex(phrase), 'i');
  return re.test(haystack);
}

function runCompliance(text: string, brand: BrandKitData): { flags: ComplianceFlag[]; disclaimers: string[] } {
  const flags: ComplianceFlag[] = [];
  for (const word of brand.compliance.medicalForbiddenWords) {
    if (findPhrase(text, word.toLowerCase())) flags.push({ type: 'forbidden_word', phrase: word });
  }
  for (const topic of brand.compliance.blockedTopics) {
    if (findPhrase(text, topic.toLowerCase())) flags.push({ type: 'blocked_topic', phrase: topic });
  }
  const disclaimers = Array.from(
    new Set(
      brand.compliance.requiredDisclaimers
        .filter((d) => d?.trigger && d?.text && findPhrase(text, String(d.trigger).toLowerCase()))
        .map((d) => String(d.text)),
    ),
  );
  return { flags, disclaimers };
}

// ── Image rendering ────────────────────────────────────────────────────────

async function renderDraftImage(
  template: TemplateName,
  templateProps: Record<string, any>,
  imagePrompt: string,
  imageModel: AiImageModel,
  brand: BrandKitData,
): Promise<{ url: string; storagePath: string; bytes: number; source: string; costInr: number }> {
  // Tip Card never takes a background; Quote / Milestone do.
  const bgUrl: string | null = template === 'tipCard'
    ? null
    : imageModel === 'imagen'
      ? await imagenGenerate(imagePrompt, { aspectRatio: '1:1' })
      : imageModel === 'dalle'
        ? await openaiImage(imagePrompt, { quality: 'medium', size: '1024x1024' })
        : await fluxSchnell(imagePrompt, { aspectRatio: '1:1' });

  // If AI failed, fall back to Pexels with the imagePrompt as a query.
  // This keeps the generator robust when a paid API hits a quota.
  let imageSource: string = template === 'tipCard' ? 'none' : imageModel;
  let imageAttribution: string | null = null;
  let resolvedBg = bgUrl;
  if (!resolvedBg && template !== 'tipCard') {
    const stock = await pexelsSearch(imagePrompt.slice(0, 100));
    if (stock) {
      resolvedBg = stock.url;
      imageAttribution = stock.attribution;
      imageSource = 'pexels';
    } else {
      imageSource = 'none';
    }
  }

  const propsForRender: Record<string, any> = { ...templateProps };
  if (resolvedBg) {
    if (template === 'quoteCard') propsForRender.backgroundUrl = resolvedBg;
    if (template === 'milestoneCard') propsForRender.photoUrl = resolvedBg;
  }

  const brandSnap: BrandSnapshot = {
    brandName: brand.brandName,
    logoUrl: brand.logoUrl,
    palette: brand.palette,
  };

  const result = await renderTemplate(template, propsForRender, brandSnap, { width: 1080, height: 1080 });

  // Upload to Storage at marketing/drafts/{ts}-{template}.png
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const storagePath = `marketing/drafts/${timestamp}-${template}.png`;
  const bucket = admin.storage().bucket();
  const file = bucket.file(storagePath);
  await file.save(result.png, {
    contentType: 'image/png',
    metadata: { metadata: { template, source: imageSource, attribution: imageAttribution ?? '' } },
  });
  await file.makePublic();
  const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

  // Cost log row — same shape as renderMarketingTemplate
  const costInr = imageSourceCostInr(imageSource);
  try {
    await admin.firestore().collection('marketing_cost_log').add({
      ts: admin.firestore.FieldValue.serverTimestamp(),
      template,
      imageSource,
      costInr,
      bytes: result.png.length,
      actor: 'generator',
    });
  } catch (e) {
    console.warn('[generator] cost log write failed (non-fatal)', e);
  }

  return { url, storagePath, bytes: result.png.length, source: imageSource, costInr };
}

function imageSourceCostInr(source: string): number {
  switch (source) {
    case 'imagen': return 3.30;
    case 'dalle':  return 3.50;
    case 'flux':   return 0.25;
    default:       return 0;
  }
}

// ── Caption assembly (body + hashtags + disclaimers) ───────────────────────

function assembleCaption(body: string, hashtags: string[], disclaimers: string[], extraHashtags: string[]): string {
  const allTags = Array.from(new Set([...hashtags, ...extraHashtags.map((h) => h.replace(/^#/, ''))])).slice(0, 15);
  const tagLine = allTags.length ? '\n\n' + allTags.map((h) => `#${h}`).join(' ') : '';
  const disclaimerBlock = disclaimers.length ? '\n\n' + disclaimers.join('\n') : '';
  return (body + disclaimerBlock + tagLine).slice(0, 2200);
}

// ── Public entry: draft generation ─────────────────────────────────────────

export async function runGenerator(
  input: GenerateInput,
  actorEmail: string | null,
): Promise<GenerateResult> {
  let brand: BrandKitData;
  try {
    brand = await loadBrandKit();
  } catch (e: any) {
    return { ok: false, code: 'brand-load-failed', message: e?.message ?? String(e) };
  }
  if (brand.personas.length === 0 || brand.pillars.length === 0) {
    return { ok: false, code: 'strategy-incomplete', message: 'Add at least one enabled persona and pillar in /admin/marketing/strategy first.' };
  }

  const today = todayInIst();
  const slot = pickSlot(brand, input, today);

  let captionOut: CaptionOutput;
  try {
    captionOut = await generateCaption(brand, slot);
  } catch (e: any) {
    return { ok: false, code: 'caption-failed', message: e?.message ?? String(e) };
  }

  const requestedTemplate = ['tipCard', 'quoteCard', 'milestoneCard'].includes(input.template as string)
    ? (input.template as TemplateName)
    : captionOut.template;
  const requestedModel: AiImageModel = (['imagen', 'dalle', 'flux'] as AiImageModel[]).includes(input.imageModel as AiImageModel)
    ? (input.imageModel as AiImageModel)
    : 'imagen';

  let render: { url: string; storagePath: string; bytes: number; source: string; costInr: number };
  try {
    render = await renderDraftImage(requestedTemplate, captionOut.templateProps, captionOut.imagePrompt, requestedModel, brand);
  } catch (e: any) {
    return { ok: false, code: 'render-failed', message: e?.message ?? String(e) };
  }

  // Compliance screen — run on body + headline (hashtags / disclaimers excluded
  // since we're about to add disclaimers ourselves).
  const screenText = `${captionOut.headline}\n${captionOut.body}`;
  const { flags, disclaimers } = runCompliance(screenText, brand);

  const caption = assembleCaption(captionOut.body, captionOut.hashtags, disclaimers, brand.hashtags);

  // Caption AI cost — gpt-4o-mini ~₹0.02/draft. Round-up generously.
  const captionCost = 0.05;
  const totalCost = render.costInr + captionCost;

  // Write the draft.
  const draftRef = admin.firestore().collection('marketing_drafts').doc();
  const draft = {
    status: 'pending_review',
    kind: 'image',
    themeKey: today.weekdayKey,
    themeLabel: slot.themeLabel,
    caption,
    headline: captionOut.headline,
    assets: [{ url: render.url, index: 0, template: requestedTemplate, storagePath: render.storagePath }],
    platforms: ['instagram', 'facebook'],
    scheduledAt: null,
    postedAt: null,
    postPermalinks: {},
    publishError: null,
    safetyFlags: flags.map((f) => `${f.type}:${f.phrase}`),
    personaId: slot.persona?.id ?? null,
    personaLabel: slot.persona?.label ?? null,
    pillarId: slot.pillar?.id ?? null,
    pillarLabel: slot.pillar?.label ?? null,
    eventId: slot.event?.id ?? null,
    eventLabel: slot.event?.label ?? null,
    locale: brand.voice.bilingual,
    imagePrompt: captionOut.imagePrompt,
    imageSource: render.source,
    costInr: totalCost,
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    generatedBy: actorEmail ?? 'cron',
    approvedAt: null,
    approvedBy: null,
    rejectedAt: null,
    rejectedBy: null,
    rejectReason: null,
  };
  try {
    await draftRef.set(draft);
  } catch (e: any) {
    return { ok: false, code: 'write-failed', message: e?.message ?? String(e) };
  }

  return {
    ok: true,
    draftId: draftRef.id,
    caption,
    imageUrl: render.url,
    imageSource: render.source,
    template: requestedTemplate,
    costInr: totalCost,
    flags: flags.map((f) => ({ type: f.type, phrase: f.phrase })),
    requiredDisclaimers: disclaimers,
  };
}

// ── HTTPS callable wrapper ─────────────────────────────────────────────────

export function buildGenerateMarketingDraft(allowList: ReadonlySet<string>) {
  return functions
    .runWith({ memory: '1GB', timeoutSeconds: 300 })
    .https.onCall(async (data: GenerateInput, context): Promise<GenerateResult> => {
      if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins with marketing access can generate drafts.');
      }
      const actorEmail = context.auth?.token?.email ?? null;
      return runGenerator(data ?? {}, actorEmail);
    });
}

// ── Pubsub cron (6am IST = 00:30 UTC) ──────────────────────────────────────
// Auto-disabled: bumps a counter in marketing_brand/main if `cronEnabled`
// is true; otherwise no-ops. Admin opts in by saving brand kit with
// `cronEnabled: true`. This keeps test deploys safe.

export function buildDailyMarketingDraftCron() {
  return functions
    .runWith({ memory: '1GB', timeoutSeconds: 540 })
    .pubsub.schedule('30 0 * * *')
    .timeZone('UTC')
    .onRun(async () => {
      const brandSnap = await admin.firestore().doc('marketing_brand/main').get();
      const data = (brandSnap.exists ? brandSnap.data() : {}) as any;
      if (data?.cronEnabled !== true) {
        console.log('[dailyMarketingDraftCron] disabled — set marketing_brand/main.cronEnabled=true to opt in');
        return null;
      }
      if (data?.crisisPaused === true) {
        console.log('[dailyMarketingDraftCron] crisis pause active — skipping today');
        return null;
      }
      const result = await runGenerator({}, null);
      if (result.ok) {
        console.log('[dailyMarketingDraftCron] generated draft', result.draftId);
      } else {
        console.error('[dailyMarketingDraftCron] failed', result);
      }
      return null;
    });
}
