// Marketing module Cloud Function exports.
//
// Phase 2:
//   renderMarketingTemplate(callable) — admin-only. Renders a named template
//     with caller-supplied props + brand kit, optionally fetches a stock
//     photo or AI background, uploads the resulting PNG to Storage, returns
//     a public download URL the admin UI can preview / save into a draft.
//
// Phase 1 (M1):
//   scoreMarketingDraft(callable) — see ./scoring.ts. Compliance regex screen
//     against the rules in marketing_brand/main; runs on every caption draft.
//
// Future phases will add:
//   generateDailyMarketingDrafts (M2) — pubsub cron
//   publishMarketingDraft        (M3)
//   metaWebhookReceiver          (M4)
//   replyToInboxMessage          (M4)

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

import { fluxSchnell, imagenGenerate, openaiImage, pexelsSearch } from './imageSources';
import { renderTemplate } from './renderer';
import { BrandSnapshot, TEMPLATE_NAMES } from './templates';
import { getIntegrationConfig } from '../lib/integrationConfig';

export { buildScoreMarketingDraft } from './scoring';
export { buildGenerateMarketingDraft, buildDailyMarketingDraftCron, buildGenerateAheadDrafts } from './generator';
export { buildMetaWebhookReceiver, buildGenerateInboxReplies, buildClassifyInboxThread } from './inbox';
export {
  buildMetaInboxReplyPublisher,
  buildScheduledMarketingPublisher,
  buildPublishMarketingDraftNow,
} from './publisher';
export {
  buildPollMarketingInsights,
  buildPollMarketingAccountInsights,
  buildGenerateWeeklyInsightDigest,
} from './insights';
export { buildRenderUgcAsDraft } from './ugc';
export { buildBoostMarketingDraft } from './boost';
export {
  buildGenerateStudioVariants,
  buildCreateStudioDraft,
  buildEditStudioImage,
  buildUploadStudioImage,
  buildComposeStudioLogo,
} from './studio';
export { buildProbeMarketingHealth, buildProbeMarketingHealthNow } from './health';

// firebase-admin is initialized in functions/src/index.ts before this module
// is imported; we just grab the existing instance.

// Capability check — Marketing renders are gated on the same admin signal
// the rules use. Mirrors isAdminTokenAsync from the parent index.ts but
// inlined to avoid a circular import.
async function callerIsMarketingAdmin(token: admin.auth.DecodedIdToken | undefined, allowList: ReadonlySet<string>): Promise<boolean> {
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

/** Discriminated union — explicit about provider so we can extend without
 *  breaking callers. The Phase-3 cron will produce the same shape. */
type BackgroundSpec =
  | { type: 'url'; url: string }
  | { type: 'stock'; provider: 'pexels'; query: string }
  | { type: 'ai'; model: 'flux' | 'imagen' | 'dalle'; prompt: string };

type ImageSourceTag = 'pexels' | 'flux' | 'imagen' | 'dalle' | 'caller-supplied' | 'none';

interface RenderPayload {
  template: string;
  props: Record<string, any>;
  /** Background image source. Omit for templates that don't use one (Tip Card). */
  background?: BackgroundSpec;
  /** Optional explicit dimensions (default 1080×1080). */
  width?: number;
  height?: number;
}

interface RenderResponseOk {
  ok: true;
  url: string;
  storagePath: string;
  width: number;
  height: number;
  imageSource: ImageSourceTag;
  imageAttribution: string | null;
  bytes: number;
}
interface RenderResponseErr {
  ok: false;
  code: string;
  message: string;
}
type RenderResponse = RenderResponseOk | RenderResponseErr;

interface TemplatePrefillPayload {
  template?: unknown;
  context?: unknown;
  current?: unknown;
}

interface TemplatePrefillOk {
  ok: true;
  template: string;
  props: Record<string, any>;
  backgroundPrompt: string;
}

interface TemplatePrefillErr {
  ok: false;
  code: string;
  message: string;
}

type TemplatePrefillResponse = TemplatePrefillOk | TemplatePrefillErr;

/**
 * Admin-callable HTTPS function. Reads brand kit from Firestore, optionally
 * fetches a stock or AI background, renders via Satori, uploads PNG to
 * Storage at marketing/previews/{timestamp}-{template}.png, returns a
 * download URL the client can show or save into a draft.
 *
 * Deploy: firebase deploy --only functions:renderMarketingTemplate
 */
export function buildRenderMarketingTemplate(allowList: ReadonlySet<string>) {
  return functions
    // Once PEXELS_API_KEY / REPLICATE_API_TOKEN are set in Secret Manager,
    // add them here:  secrets: ['PEXELS_API_KEY', 'REPLICATE_API_TOKEN']
    // Until then the function gracefully degrades — stock + AI sources
    // return null with a console warning, and tip-card style renders
    // (no background) work fine.
    .runWith({ memory: '1GB', timeoutSeconds: 60 })
    .https.onCall(async (data: RenderPayload, context): Promise<RenderResponse> => {
      if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins with marketing access can render templates.');
      }

      const templateName = String(data?.template ?? '');
      if (!TEMPLATE_NAMES.includes(templateName as any)) {
        return { ok: false, code: 'invalid-template', message: `Unknown template "${templateName}". Known: ${TEMPLATE_NAMES.join(', ')}` };
      }
      const props = (data?.props ?? {}) as Record<string, any>;

      // ── Resolve background image (if any) ─────────────────────────────
      // Each provider returns a string (URL or data: URL) on success or null
      // on any failure — no provider throws. Caller picks one provider per
      // render; we don't auto-fallback because the cost/style profile
      // differs significantly between FLUX, Imagen, and gpt-image-1.
      let imageSource: ImageSourceTag = 'none';
      let imageAttribution: string | null = null;
      let backgroundUrl: string | undefined;

      const bg = data?.background;
      if (bg?.type === 'url' && typeof bg.url === 'string' && bg.url) {
        backgroundUrl = bg.url;
        imageSource = 'caller-supplied';
      } else if (bg?.type === 'stock' && bg.provider === 'pexels' && typeof bg.query === 'string' && bg.query.trim()) {
        const stock = await pexelsSearch(bg.query.trim());
        if (stock) {
          backgroundUrl = stock.url;
          imageAttribution = stock.attribution;
          imageSource = 'pexels';
        }
      } else if (bg?.type === 'ai' && typeof bg.prompt === 'string' && bg.prompt.trim()) {
        const prompt = bg.prompt.trim();
        let url: string | null = null;
        if (bg.model === 'imagen') {
          url = await imagenGenerate(prompt, { aspectRatio: '1:1' });
          if (url) imageSource = 'imagen';
        } else if (bg.model === 'dalle') {
          url = await openaiImage(prompt, { quality: 'medium', size: '1024x1024' });
          if (url) imageSource = 'dalle';
        } else {
          url = await fluxSchnell(prompt, { aspectRatio: '1:1' });
          if (url) imageSource = 'flux';
        }
        if (url) backgroundUrl = url;
      }

      // Templates that take a backgroundUrl key it explicitly.
      if (backgroundUrl && (templateName === 'quoteCard' || templateName === 'milestoneCard' || templateName === 'realStoryCard')) {
        if (templateName === 'quoteCard') props.backgroundUrl = backgroundUrl;
        if (templateName === 'milestoneCard') props.photoUrl = backgroundUrl;
        if (templateName === 'realStoryCard') props.photoUrl = backgroundUrl;
      }

      // ── Fetch brand kit ───────────────────────────────────────────────
      const brandSnap = await admin.firestore().doc('marketing_brand/main').get();
      const bd: any = brandSnap.exists ? brandSnap.data() : {};
      const brand: BrandSnapshot = {
        brandName: typeof bd?.brandName === 'string' ? bd.brandName : 'MaaMitra',
        logoUrl: typeof bd?.logoUrl === 'string' ? bd.logoUrl : null,
        palette: {
          primary:    typeof bd?.palette?.primary    === 'string' ? bd.palette.primary    : '#7C3AED',
          background: typeof bd?.palette?.background === 'string' ? bd.palette.background : '#FFF8F2',
          text:       typeof bd?.palette?.text       === 'string' ? bd.palette.text       : '#1F1F2C',
          accent:     typeof bd?.palette?.accent     === 'string' ? bd.palette.accent     : '#F8C8DC',
        },
      };

      // ── Render ─────────────────────────────────────────────────────────
      let result;
      try {
        result = await renderTemplate(templateName, props, brand, {
          width: typeof data?.width === 'number' ? data.width : 1080,
          height: typeof data?.height === 'number' ? data.height : 1080,
        });
      } catch (e: any) {
        console.error('[renderMarketingTemplate] render failed', e);
        return { ok: false, code: 'render-failed', message: e?.message ?? String(e) };
      }

      // ── Upload to Storage ─────────────────────────────────────────────
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const storagePath = `marketing/previews/${timestamp}-${templateName}.png`;
      const bucket = admin.storage().bucket();
      const file = bucket.file(storagePath);
      try {
        await file.save(result.png, {
          contentType: 'image/png',
          metadata: { metadata: { template: templateName, source: imageSource } },
        });
        await file.makePublic();
      } catch (e: any) {
        console.error('[renderMarketingTemplate] upload failed', e);
        return { ok: false, code: 'upload-failed', message: e?.message ?? String(e) };
      }
      const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

      // Cost log — written best-effort. Daily/monthly dashboard tile reads
      // from this collection. Numbers are May-2026 INR estimates per
      // imageSources.ts; revise when provider pricing moves.
      try {
        const costInr = imageSourceCostInr(imageSource);
        await admin.firestore().collection('marketing_cost_log').add({
          ts: admin.firestore.FieldValue.serverTimestamp(),
          template: templateName,
          imageSource,
          costInr,
          bytes: result.png.length,
          actor: context.auth?.token?.email ?? context.auth?.uid ?? null,
        });
      } catch (e) {
        console.warn('[renderMarketingTemplate] cost log write failed (non-fatal)', e);
      }

      return {
        ok: true,
        url,
        storagePath,
        width: result.width,
        height: result.height,
        imageSource,
        imageAttribution,
        bytes: result.png.length,
      };
    });
}

export function buildGenerateTemplatePrefill(allowList: ReadonlySet<string>) {
  return functions
    .runWith({ memory: '512MB', timeoutSeconds: 60 })
    .https.onCall(async (data: TemplatePrefillPayload, context): Promise<TemplatePrefillResponse> => {
      if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins with marketing access can prefill templates.');
      }

      const template = String(data?.template ?? '').trim();
      if (!TEMPLATE_NAMES.includes(template as any)) {
        return { ok: false, code: 'invalid-template', message: `Unknown template "${template}".` };
      }

      const cfg = await getIntegrationConfig();
      if (!cfg.openai.apiKey) {
        return { ok: false, code: 'missing-openai', message: 'OpenAI key is not configured.' };
      }

      const brandSnap = await admin.firestore().doc('marketing_brand/main').get();
      const bd: any = brandSnap.exists ? brandSnap.data() : {};
      const voiceAttrs = Array.isArray(bd?.voice?.attributes) ? bd.voice.attributes.join(', ') : 'warm, honest, judgement-free';
      const avoid = Array.isArray(bd?.voice?.avoid) ? bd.voice.avoid.join(', ') : '';
      const bilingual = typeof bd?.voice?.bilingual === 'string' ? bd.voice.bilingual : 'hinglish';
      const contextText = String(data?.context ?? '').trim();
      const hasCurrent = !!(data?.current && typeof data.current === 'object' && Object.keys(data.current).length > 0);
      const current = hasCurrent ? JSON.stringify(data.current).slice(0, 1200) : 'none';
      // Variation seed — when admin re-clicks "Regenerate with AI", the same
      // (template, context, current) tuple would otherwise re-prompt the
      // model and produce nearly-identical output. Seed forces a different
      // angle each click.
      const variationSeed = Math.random().toString(36).slice(2, 10);

      const system = [
        `You are MaaMitra's content planner for social post templates.`,
        `Brand voice: ${voiceAttrs}.`,
        avoid ? `Avoid these tones/words: ${avoid}.` : '',
        bilingual === 'hinglish'
          ? 'Write in natural Indian English; light Hinglish is welcome where natural.'
          : 'Write in clear English.',
        'Always write for an Indian motherhood audience — Indian names, Indian cities, Indian food, Indian family contexts.',
        'Return strict JSON only.',
      ].filter(Boolean).join('\n');

      const user = [
        `Prepare structured content for template "${template}".`,
        `Topic/context from admin: ${contextText || 'Use a sensible MaaMitra motherhood topic and make it specific.'}`,
        hasCurrent
          ? `Current values (admin clicked Regenerate — produce a NOTICEABLY DIFFERENT angle, story, or list. Different example, different opening, different attribution name. Do NOT just rephrase): ${current}`
          : `No current values yet — produce a fresh draft.`,
        `Variation seed (use to vary the angle, do not echo): ${variationSeed}`,
        '',
        'Return JSON with keys:',
        '{',
        '  "props": { /* exact template props */ },',
        '  "backgroundPrompt": "optional background prompt, empty for none"',
        '}',
        '',
        'Use these prop shapes exactly:',
        'tipCard: { "eyebrow": string<=30, "title": string<=80, "tips": string[3-4] }',
        'quoteCard: { "quote": string<=200, "attribution": string<=40 }',
        'milestoneCard: { "age": string<=20, "title": string<=60, "milestones": string[3-5] }',
        'realStoryCard: { "eyebrow": string<=30, "story": string<=240 chars (count carefully — must finish a sentence with a period inside the limit), "attribution": string<=40 (Indian first name + city or relation, e.g. "Priya, Pune · mom of Aanya") }',
        '',
        'Rules:',
        '- Keep it crisp and render-friendly.',
        '- For realStoryCard: write the story as ONE complete thought ending in a period inside 240 characters. Never leave a trailing comma or incomplete clause.',
        '- If the template benefits from a background image, include a backgroundPrompt that ALWAYS depicts an Indian mother / Indian family / Indian home in soft warm light. Specify ethnicity explicitly ("Indian woman", "Indian mom"). Add: "no text, no letters, no typography, no signage, no logos in image".',
        '- Never include markdown.',
      ].join('\n');

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.openai.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          temperature: 1.05,
          max_tokens: 700,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (!res.ok) {
        return { ok: false, code: 'openai-error', message: `${res.status}: ${await res.text()}` };
      }

      const out = await res.json() as { choices?: { message?: { content?: string } }[] };
      const raw = out?.choices?.[0]?.message?.content ?? '';
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return { ok: false, code: 'bad-json', message: 'AI returned invalid JSON.' };
      }

      return {
        ok: true,
        template,
        props: sanitizeTemplateProps(template, parsed?.props ?? {}),
        backgroundPrompt: trimText(parsed?.backgroundPrompt, 240),
      };
    });
}

function trimText(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/** Trim long body text at a sentence boundary inside `max` chars, falling
 *  back to a word boundary with an ellipsis. Avoids the mid-word slice that
 *  produced "...questioning my decisions about feeding and caring for my
 *  baby. Then, I found a community of moms who shared their experiences,
 *  fears" — i.e. a story cut off mid-sentence. */
function trimStory(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  const cleaned = v.trim().replace(/\s+/g, ' ');
  if (cleaned.length <= max) return cleaned;
  // Prefer the last sentence boundary (. ! ?) inside the budget.
  const window = cleaned.slice(0, max);
  const sentenceEnd = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '));
  if (sentenceEnd > Math.floor(max * 0.5)) {
    return cleaned.slice(0, sentenceEnd + 1).trim();
  }
  // Fall back: drop the trailing partial word and append an ellipsis.
  return window.replace(/[\s,;:]+\S*$/, '').trim() + '…';
}

function listText(v: unknown, maxItems: number, maxChars: number): string[] {
  return Array.isArray(v)
    ? v.map((x) => trimText(x, maxChars)).filter(Boolean).slice(0, maxItems)
    : [];
}

function sanitizeTemplateProps(template: string, props: Record<string, any>): Record<string, any> {
  if (template === 'tipCard') {
    return {
      eyebrow: trimText(props.eyebrow, 30),
      title: trimText(props.title, 80),
      tips: listText(props.tips, 4, 120),
    };
  }
  if (template === 'quoteCard') {
    return {
      quote: trimText(props.quote, 200),
      attribution: trimText(props.attribution, 40),
    };
  }
  if (template === 'milestoneCard') {
    return {
      age: trimText(props.age, 20),
      title: trimText(props.title, 60),
      milestones: listText(props.milestones, 5, 120),
    };
  }
  return {
    eyebrow: trimText(props.eyebrow, 30),
    story: trimStory(props.story, 240),
    attribution: trimText(props.attribution, 40),
  };
}

/** Estimated cost (₹) per render by image-source provider. May-2026 rates. */
function imageSourceCostInr(source: ImageSourceTag): number {
  switch (source) {
    case 'imagen': return 3.30;
    case 'dalle':  return 3.50;
    case 'flux':   return 0.25;
    case 'pexels': return 0;
    case 'caller-supplied': return 0;
    case 'none':   return 0;
    default:       return 0;
  }
}
