/**
 * Marketing Studio (Phase 2) — image-gen canvas backend.
 *
 * Two callables:
 *   1. generateStudioVariants — given a user prompt + brand style profile,
 *      generates N (1–4) variant images in parallel, all locked to the
 *      MaaMitra style via prompt prefix + reference. Uploads each to
 *      Storage and returns the public URLs.
 *
 *   2. createStudioDraft — given a chosen variant + caption, creates a
 *      `marketing_drafts/{id}` row with status=pending_review (or
 *      'scheduled' if scheduledAt set). The downstream M3/M4/M5/M6
 *      pipeline (publish, inbox, insights, boost) consumes it like any
 *      other draft.
 *
 * If the admin doesn't supply a caption, we synthesize one via gpt-4o-mini
 * using the brand voice — same path as the M2 generator.
 *
 * Cost: each Imagen call is ~₹3.30; FLUX ~₹0.25. 4 variants ~₹13 (Imagen)
 * or ₹1 (FLUX). Caption call ~₹0.05. All logged to marketing_cost_log.
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

import { fluxSchnell, imagenGenerate, openaiImageEdit } from './imageSources';
import { Resvg } from '@resvg/resvg-js';
import * as fs from 'fs';
import * as path from 'path';
import satori from 'satori';

import { h } from './templates/h';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';

// ── Caller auth ─────────────────────────────────────────────────────────────
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

// ── Brand kit slim view (reads styleProfile this time) ─────────────────────
interface StudioBrand {
  brandName: string;
  voice: { attributes: string[]; avoid: string[]; bilingual: string };
  hashtags: string[];
  styleProfile: {
    oneLiner: string;
    description: string;
    prohibited: string[];
    artKeywords: string;
  } | null;
  costCaps: { dailyInr: number; monthlyInr: number; alertAtPct: number };
  /** Brand logo URL — composited as an overlay when the admin enables
   *  "Add brand logo" on Step 3. */
  logoUrl: string | null;
}

const DEFAULT_STYLE_DESCRIPTION = 'A warm hand-drawn 2D illustration. Flat colours with subtle gradients, no photorealism. Indian characters (brown skin, dark hair). Soft pastels. Rounded organic shapes. Generous negative space. Single-scene composition.';
const DEFAULT_STYLE_KEYWORDS = 'flat illustration, pastel, Indian, motherhood, gentle, hand-drawn, soft gradient, organic shapes';

async function loadStudioBrand(): Promise<StudioBrand> {
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
    hashtags: arr(d?.hashtags),
    styleProfile: d?.styleProfile ? {
      oneLiner: typeof d.styleProfile.oneLiner === 'string' ? d.styleProfile.oneLiner : '',
      description: typeof d.styleProfile.description === 'string' ? d.styleProfile.description : DEFAULT_STYLE_DESCRIPTION,
      prohibited: arr(d.styleProfile.prohibited),
      artKeywords: typeof d.styleProfile.artKeywords === 'string' ? d.styleProfile.artKeywords : DEFAULT_STYLE_KEYWORDS,
    } : null,
    costCaps: {
      dailyInr: typeof d?.costCaps?.dailyInr === 'number' ? d.costCaps.dailyInr : 200,
      monthlyInr: typeof d?.costCaps?.monthlyInr === 'number' ? d.costCaps.monthlyInr : 3000,
      alertAtPct: typeof d?.costCaps?.alertAtPct === 'number' ? d.costCaps.alertAtPct : 80,
    },
    logoUrl: typeof d?.logoUrl === 'string' && d.logoUrl ? d.logoUrl : null,
  };
}

// ── Cost cap enforcement ────────────────────────────────────────────────────

async function checkDailyCostCap(brand: StudioBrand, plannedSpend: number): Promise<{ ok: true } | { ok: false; spent: number; cap: number }> {
  const cap = brand.costCaps.dailyInr;
  if (cap <= 0) return { ok: true };
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const snap = await admin.firestore()
    .collection('marketing_cost_log')
    .where('ts', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
    .get();
  const spentToday = snap.docs.reduce((acc, d) => acc + (Number((d.data() as any)?.costInr) || 0), 0);
  if (spentToday + plannedSpend > cap) {
    return { ok: false, spent: spentToday, cap };
  }
  return { ok: true };
}

async function logCost(opts: { source: string; costInr: number; bytes: number; actor: string | null; meta?: Record<string, any> }): Promise<void> {
  try {
    await admin.firestore().collection('marketing_cost_log').add({
      ts: admin.firestore.FieldValue.serverTimestamp(),
      template: 'studio',
      imageSource: opts.source,
      costInr: opts.costInr,
      bytes: opts.bytes,
      actor: opts.actor,
      ...(opts.meta ?? {}),
    });
  } catch (e) {
    console.warn('[studio] cost log write failed (non-fatal)', e);
  }
}

// ── Style-locked prompt builder ─────────────────────────────────────────────

function buildStudioPrompt(userPrompt: string, brand: StudioBrand): string {
  const profile = brand.styleProfile;
  const styleDesc = profile?.description ?? DEFAULT_STYLE_DESCRIPTION;
  const keywords = profile?.artKeywords ?? DEFAULT_STYLE_KEYWORDS;
  const negative = (profile?.prohibited ?? []).join(', ');

  // Imagen / FLUX prompt structure: positive description first, then
  // the subject, then the negative-style guard. Keeping the positive
  // style block at the front gives the model the strongest steer.
  const parts: string[] = [];
  parts.push(`Visual style: ${styleDesc}`);
  parts.push(`Art direction keywords: ${keywords}.`);
  parts.push(`Subject: ${userPrompt.trim()}`);
  if (negative) parts.push(`Do NOT include: ${negative}.`);
  parts.push('Single coherent illustration. No text, no logos, no watermarks.');
  return parts.join('\n');
}

// ── Storage upload ──────────────────────────────────────────────────────────

async function uploadToStorage(dataUrlOrHttp: string, storagePath: string): Promise<{ url: string; bytes: number }> {
  const bucket = admin.storage().bucket();
  const file = bucket.file(storagePath);

  let buf: Buffer;
  let contentType = 'image/png';
  if (dataUrlOrHttp.startsWith('data:')) {
    const match = dataUrlOrHttp.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error('invalid-data-url');
    contentType = match[1];
    buf = Buffer.from(match[2], 'base64');
  } else {
    // http(s) URL — fetch, store as binary
    const r = await fetch(dataUrlOrHttp);
    if (!r.ok) throw new Error(`fetch-failed-${r.status}`);
    contentType = r.headers.get('content-type') ?? 'image/png';
    const ab = await r.arrayBuffer();
    buf = Buffer.from(ab);
  }

  await file.save(buf, { contentType, metadata: { metadata: { source: 'studio' } } });
  await file.makePublic();
  return {
    url: `https://storage.googleapis.com/${bucket.name}/${storagePath}`,
    bytes: buf.length,
  };
}

// ── 1. generateStudioVariants ───────────────────────────────────────────────

interface GenerateVariantsInput {
  prompt?: unknown;
  variantCount?: unknown;
  model?: unknown;
  aspectRatio?: unknown;
  /** Phase 4 item 1 — when 'carousel', each prompt gets a "Slide N of M"
   *  prefix so the model nudges the composition toward a narrative
   *  sequence instead of N near-duplicates. The shared style preamble
   *  keeps visual coherence. */
  mode?: unknown;
}

interface VariantResult {
  variantId: string;
  url: string;
  storagePath: string;
}

interface GenerateVariantsOk {
  ok: true;
  variants: VariantResult[];
  costInr: number;
  failedCount: number;
}

interface GenerateVariantsErr {
  ok: false;
  code: string;
  message: string;
}

type GenerateVariantsResult = GenerateVariantsOk | GenerateVariantsErr;

const COST_PER_IMAGE: Record<string, number> = {
  imagen: 3.30,
  flux: 0.25,
};

export function buildGenerateStudioVariants(allowList: ReadonlySet<string>) {
  return functions
    .runWith({ memory: '1GB', timeoutSeconds: 180 })
    .https.onCall(async (data: GenerateVariantsInput, context): Promise<GenerateVariantsResult> => {
      if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
        throw new functions.https.HttpsError('permission-denied', 'Admin only.');
      }

      const prompt = typeof data?.prompt === 'string' ? data.prompt.trim() : '';
      if (!prompt) return { ok: false, code: 'no-prompt', message: 'Tell me what to make first.' };
      if (prompt.length > 500) return { ok: false, code: 'prompt-too-long', message: 'Keep your idea under 500 characters.' };

      const mode: 'single' | 'carousel' = data?.mode === 'carousel' ? 'carousel' : 'single';
      // Carousels need 3–5 slides; singles allow 1–4 picker variants.
      const requested = Number(data?.variantCount);
      const variantCount = mode === 'carousel'
        ? Math.max(3, Math.min(5, Number.isFinite(requested) ? requested : 3))
        : Math.max(1, Math.min(4, Number.isFinite(requested) ? requested : 4));
      const model: 'imagen' | 'flux' = data?.model === 'flux' ? 'flux' : 'imagen';
      const aspectRatio: '1:1' | '9:16' | '16:9' = (
        data?.aspectRatio === '9:16' ? '9:16' :
        data?.aspectRatio === '16:9' ? '16:9' :
        '1:1'
      );

      let brand: StudioBrand;
      try {
        brand = await loadStudioBrand();
      } catch {
        return { ok: false, code: 'brand-load-failed', message: "Couldn't load your brand. Try again." };
      }

      // Cost cap pre-check.
      const perImage = COST_PER_IMAGE[model] ?? 0;
      const plannedSpend = perImage * variantCount;
      const capCheck = await checkDailyCostCap(brand, plannedSpend);
      if (!capCheck.ok) {
        return {
          ok: false,
          code: 'cost-cap-reached',
          message: `Daily cost cap reached (₹${capCheck.spent.toFixed(0)} of ₹${capCheck.cap}). Bump it in Settings.`,
        };
      }

      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const actor = context.auth?.token?.email ?? context.auth?.uid ?? null;

      // Fire all variants in parallel. Each provider returns a data: URL or
      // http URL; we upload to Storage and return the public Storage URL so
      // the URL doesn't expire when the API session ends.
      const tasks: Promise<VariantResult | null>[] = [];
      for (let i = 0; i < variantCount; i++) {
        // For carousels, hint each slide's narrative position so the model
        // gives variation in composition (cover / detail / outro) rather than
        // N near-duplicates. Style preamble is unchanged so all slides share
        // the visual DNA.
        const subjectPrompt = mode === 'carousel'
          ? `${prompt} — slide ${i + 1} of ${variantCount}${i === 0 ? ' (cover image with strong focal point)' : i === variantCount - 1 ? ' (closing image)' : ' (supporting visual)'}`
          : prompt;
        const styledPrompt = buildStudioPrompt(subjectPrompt, brand);
        tasks.push((async () => {
          let imageUrl: string | null = null;
          try {
            if (model === 'imagen') {
              imageUrl = await imagenGenerate(styledPrompt, { aspectRatio: aspectRatio === '16:9' ? '16:9' : aspectRatio });
            } else {
              imageUrl = await fluxSchnell(styledPrompt, { aspectRatio: aspectRatio === '16:9' ? '16:9' : aspectRatio });
            }
          } catch (e) {
            console.warn(`[studio] variant ${i} provider threw`, e);
          }
          if (!imageUrl) return null;

          const variantId = mode === 'carousel' ? `${ts}-slide${i}` : `${ts}-${i}`;
          const storagePath = `marketing/studio/${variantId}.png`;
          try {
            const { url, bytes } = await uploadToStorage(imageUrl, storagePath);
            await logCost({ source: model, costInr: perImage, bytes, actor: actor as string | null, meta: { variantId, mode } });
            return { variantId, url, storagePath };
          } catch (e) {
            console.warn(`[studio] variant ${i} upload failed`, e);
            return null;
          }
        })());
      }

      const settled = await Promise.all(tasks);
      const variants = settled.filter((v): v is VariantResult => v !== null);
      const failedCount = settled.length - variants.length;

      if (variants.length === 0) {
        return { ok: false, code: 'all-variants-failed', message: "Couldn't generate any images. Try a different prompt or wait a moment." };
      }

      return {
        ok: true,
        variants,
        costInr: perImage * variants.length,
        failedCount,
      };
    });
}

// ── 2. createStudioDraft ────────────────────────────────────────────────────

interface CreateDraftInput {
  prompt?: unknown;
  imageUrl?: unknown;
  imageStoragePath?: unknown;
  /** Phase 4 item 1 — when present and length > 1, the draft is created as
   *  a carousel with these slides in order. Mutually exclusive with the
   *  single-image fields (imageUrl / imageStoragePath are used as a
   *  back-compat fallback when assets is missing or has a single entry). */
  assets?: unknown;
  caption?: unknown;
  scheduledAt?: unknown;
}

interface CreateDraftOk {
  ok: true;
  draftId: string;
  caption: string;
}

interface CreateDraftErr {
  ok: false;
  code: string;
  message: string;
}

type CreateDraftResult = CreateDraftOk | CreateDraftErr;

async function generateStudioCaption(prompt: string, brand: StudioBrand): Promise<string> {
  if (!OPENAI_API_KEY) {
    // Fallback: a clean default. Better than failing the whole flow.
    return `${prompt}\n\n${brand.hashtags.slice(0, 5).join(' ')}`;
  }
  const voiceLine = brand.voice.attributes.length ? brand.voice.attributes.join(', ') : 'warm, gentle';
  const avoid = brand.voice.avoid.length ? `Avoid these words: ${brand.voice.avoid.join(', ')}.` : '';
  const bilingual = brand.voice.bilingual === 'hinglish'
    ? 'Mix Hindi and English naturally (Hinglish), as Indian moms speak.'
    : brand.voice.bilingual === 'devanagari_accents'
      ? 'Use occasional Hindi words in Devanagari script alongside English.'
      : 'Use English only.';

  const sys = `You are MaaMitra's social media writer. Brand voice: ${voiceLine}. ${bilingual} ${avoid}
Write a single Instagram + Facebook caption (≤ 2200 chars) for the post described by the admin. Use 2-4 short paragraphs. End with 5-8 hashtags relevant to Indian motherhood. No markdown, no emoji-spam.`;

  const userMsg = `Post topic / scene: ${prompt}\n\nWrite the caption now.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.7,
        max_tokens: 700,
      }),
    });
    if (!res.ok) throw new Error(`openai-${res.status}`);
    const out = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const caption = out?.choices?.[0]?.message?.content?.trim();
    if (!caption) throw new Error('empty-caption');
    return caption;
  } catch (e) {
    console.warn('[studio] caption gen failed, using fallback', e);
    return `${prompt}\n\n${brand.hashtags.slice(0, 5).join(' ')}`;
  }
}

export function buildCreateStudioDraft(allowList: ReadonlySet<string>) {
  return functions
    .runWith({ memory: '512MB', timeoutSeconds: 60 })
    .https.onCall(async (data: CreateDraftInput, context): Promise<CreateDraftResult> => {
      if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
        throw new functions.https.HttpsError('permission-denied', 'Admin only.');
      }

      const prompt = typeof data?.prompt === 'string' ? data.prompt.trim() : '';
      const imageUrl = typeof data?.imageUrl === 'string' ? data.imageUrl : '';
      const imageStoragePath = typeof data?.imageStoragePath === 'string' ? data.imageStoragePath : '';
      let caption = typeof data?.caption === 'string' ? data.caption.trim() : '';
      const scheduledAt = typeof data?.scheduledAt === 'string' && data.scheduledAt ? data.scheduledAt : null;

      // Carousel slides — when admin passes a multi-asset payload, prefer
      // it; otherwise fall back to the single-image fields for back-compat.
      interface IncomingAsset { url: string; storagePath: string }
      let assets: IncomingAsset[] = [];
      if (Array.isArray(data?.assets)) {
        for (const raw of data.assets as any[]) {
          if (!raw || typeof raw !== 'object') continue;
          const u = typeof raw.url === 'string' ? raw.url : '';
          const sp = typeof raw.storagePath === 'string' ? raw.storagePath : '';
          if (u && sp) assets.push({ url: u, storagePath: sp });
          if (assets.length >= 10) break; // IG caps carousels at 10.
        }
      }
      if (assets.length === 0 && imageUrl) {
        assets = [{ url: imageUrl, storagePath: imageStoragePath }];
      }

      if (!prompt) return { ok: false, code: 'no-prompt', message: 'Original prompt is required.' };
      if (assets.length === 0) return { ok: false, code: 'no-image', message: 'Pick an image first.' };

      let brand: StudioBrand;
      try {
        brand = await loadStudioBrand();
      } catch {
        return { ok: false, code: 'brand-load-failed', message: "Couldn't load your brand. Try again." };
      }

      // If admin didn't write a caption, synthesize one from the prompt.
      if (!caption) {
        caption = await generateStudioCaption(prompt, brand);
      }

      const draftRef = admin.firestore().collection('marketing_drafts').doc();
      const status = scheduledAt ? 'scheduled' : 'pending_review';
      const isCarousel = assets.length > 1;

      const draft = {
        status,
        kind: isCarousel ? 'carousel' : 'image',
        themeKey: 'studio',
        themeLabel: 'Studio',
        caption,
        headline: prompt.slice(0, 80),
        assets: assets.map((a, i) => ({
          url: a.url,
          index: i,
          template: isCarousel ? 'studioCarouselSlide' : 'studioImage',
          storagePath: a.storagePath,
        })),
        platforms: ['instagram', 'facebook'],
        scheduledAt,
        postedAt: null,
        postPermalinks: {},
        publishError: null,
        safetyFlags: [],
        personaId: null,
        personaLabel: null,
        pillarId: null,
        pillarLabel: null,
        eventId: null,
        eventLabel: null,
        locale: brand.voice.bilingual,
        imagePrompt: prompt,
        imageSource: 'studio',
        costInr: 0.05, // caption call only — variant cost was already logged
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        generatedBy: context.auth?.token?.email ?? 'studio',
        approvedAt: null,
        approvedBy: null,
        rejectedAt: null,
        rejectedBy: null,
        rejectReason: null,
        // Studio v2 marker so the Posts hub + analytics can identify these.
        schemaVersion: 2,
        sourceTool: 'studio',
      };

      try {
        await draftRef.set(draft);
      } catch {
        return { ok: false, code: 'write-failed', message: "Couldn't save the draft. Try again." };
      }

      return { ok: true, draftId: draftRef.id, caption };
    });
}

// ── 3. editStudioImage ──────────────────────────────────────────────────────
// gpt-image-1 edits API: download the picked variant from Storage, post to
// /v1/images/edits with the admin's text instruction, upload the result as
// a new Storage object, return the new URL. Caller (the canvas) replaces
// the picked variant with this new one.
//
// Cost ~₹3.50 per edit (medium quality 1024x1024). Same daily-cap check.

interface EditImageInput {
  imageStoragePath?: unknown;
  prompt?: unknown;
  quality?: unknown;
  /** Phase 4 item 5 — optional brush mask. data:image/png;base64,...
   *  Transparent pixels mark the region to edit; opaque pixels are kept.
   *  Same dimensions as the source image (gpt-image-1 requires this). */
  maskDataUrl?: unknown;
}

interface EditImageOk {
  ok: true;
  variantId: string;
  url: string;
  storagePath: string;
  costInr: number;
}

interface EditImageErr {
  ok: false;
  code: string;
  message: string;
}

type EditImageResult = EditImageOk | EditImageErr;

const EDIT_COST_INR: Record<'medium' | 'high', number> = {
  medium: 3.50,
  high:   14.50,
};

export function buildEditStudioImage(allowList: ReadonlySet<string>) {
  return functions
    .runWith({ memory: '1GB', timeoutSeconds: 120 })
    .https.onCall(async (data: EditImageInput, context): Promise<EditImageResult> => {
      if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
        throw new functions.https.HttpsError('permission-denied', 'Admin only.');
      }

      const imageStoragePath = typeof data?.imageStoragePath === 'string' ? data.imageStoragePath : '';
      const prompt = typeof data?.prompt === 'string' ? data.prompt.trim() : '';
      const quality: 'medium' | 'high' = data?.quality === 'high' ? 'high' : 'medium';
      const maskDataUrl = typeof data?.maskDataUrl === 'string' ? data.maskDataUrl : '';

      if (!imageStoragePath) return { ok: false, code: 'no-image', message: 'No image to edit.' };
      if (!prompt) return { ok: false, code: 'no-prompt', message: 'Tell me what to change.' };
      if (prompt.length > 500) return { ok: false, code: 'prompt-too-long', message: 'Keep your edit under 500 characters.' };
      if (!imageStoragePath.startsWith('marketing/studio/')) {
        return { ok: false, code: 'bad-image-path', message: "Can only edit images you generated in the studio." };
      }

      // Decode the optional brush mask. The client builds it as a PNG with
      // transparent pixels where the edit should land — same shape OpenAI's
      // /v1/images/edits API expects.
      let maskBuf: Buffer | undefined;
      if (maskDataUrl) {
        const m = maskDataUrl.match(/^data:image\/png;base64,(.+)$/);
        if (!m) {
          return { ok: false, code: 'bad-mask', message: 'Mask must be a base64 PNG.' };
        }
        try {
          maskBuf = Buffer.from(m[1], 'base64');
        } catch {
          return { ok: false, code: 'bad-mask-base64', message: "Couldn't decode the mask." };
        }
        if (maskBuf.length === 0) maskBuf = undefined;
        else if (maskBuf.length > 4 * 1024 * 1024) {
          return { ok: false, code: 'mask-too-large', message: 'Mask is over 4 MB.' };
        }
      }

      let brand: StudioBrand;
      try {
        brand = await loadStudioBrand();
      } catch {
        return { ok: false, code: 'brand-load-failed', message: "Couldn't load your brand. Try again." };
      }

      // Server-side daily cost cap pre-check.
      const cost = EDIT_COST_INR[quality];
      const capCheck = await checkDailyCostCap(brand, cost);
      if (!capCheck.ok) {
        return {
          ok: false,
          code: 'cost-cap-reached',
          message: `Daily cost cap reached (₹${capCheck.spent.toFixed(0)} of ₹${capCheck.cap}). Bump it in Settings.`,
        };
      }

      // Download the existing image from Storage.
      let inputBuf: Buffer;
      try {
        const bucket = admin.storage().bucket();
        const [buf] = await bucket.file(imageStoragePath).download();
        inputBuf = buf;
      } catch (e) {
        console.warn('[studio:edit] download failed', e);
        return { ok: false, code: 'download-failed', message: "Couldn't read the image. Try again." };
      }

      // Build the edit instruction with brand-style guard so the edit
      // doesn't drift away from the locked style.
      const profile = brand.styleProfile;
      const styleGuard = profile?.oneLiner ?? DEFAULT_STYLE_DESCRIPTION;
      const negative = profile?.prohibited?.length ? `Do NOT introduce: ${profile.prohibited.join(', ')}.` : '';
      const editPrompt = `Edit instruction: ${prompt}\n\nKeep this visual style intact: ${styleGuard}\n${negative}\nNo text, no logos, no watermarks.`;

      // Call OpenAI Images edit. With a mask the model only repaints the
      // transparent region; without it the whole frame is up for change.
      const result = await openaiImageEdit(inputBuf, editPrompt, { quality, size: '1024x1024', maskBuf });
      if (!result) {
        return { ok: false, code: 'edit-failed', message: "Image edit didn't work. Try a different instruction or wait a moment." };
      }

      // Upload as a new Storage object.
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const variantId = `${ts}-${maskBuf ? 'masked' : 'edit'}`;
      const storagePath = `marketing/studio/${variantId}.png`;
      let url: string;
      let bytes: number;
      try {
        const up = await uploadToStorage(result, storagePath);
        url = up.url;
        bytes = up.bytes;
      } catch (e) {
        console.warn('[studio:edit] upload failed', e);
        return { ok: false, code: 'upload-failed', message: "Couldn't save the edited image. Try again." };
      }

      const actor = context.auth?.token?.email ?? context.auth?.uid ?? null;
      await logCost({
        source: maskBuf ? 'openai-edit-masked' : 'openai-edit',
        costInr: cost,
        bytes,
        actor: actor as string | null,
        meta: { variantId, parent: imageStoragePath, prompt: prompt.slice(0, 120), masked: !!maskBuf },
      });

      return { ok: true, variantId, url, storagePath, costInr: cost };
    });
}

// ── Logo overlay (Phase 4 item 3) ──────────────────────────────────────────
// Renders a 1080×1080 frame with the picked image as background + the brand
// logo composited at the requested corner. No API cost — Satori + Resvg
// run in-process. The resulting PNG is stored under marketing/studio/
// {ts}-with-logo.png so the rest of the Studio flow treats it like any
// other variant.

type LogoPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface ComposeLogoInput {
  imageStoragePath?: unknown;
  position?: unknown;
  /** Optional override to resize the logo. Default 140px. */
  logoSize?: unknown;
}

interface ComposeLogoOk {
  ok: true;
  variantId: string;
  url: string;
  storagePath: string;
}

interface ComposeLogoErr {
  ok: false;
  code: string;
  message: string;
}

type ComposeLogoResult = ComposeLogoOk | ComposeLogoErr;

const LOGO_PADDING = 56;
const FRAME_WIDTH = 1080;
const FRAME_HEIGHT = 1080;

// Lazily load the bundled fonts once per cold start. Satori needs at least
// one font even when the tree contains no text — pick the lightest body
// font from the templates fonts directory.
let fontsCache: { name: string; data: Buffer; weight: number; style: string }[] | null = null;
function loadStudioFonts(): { name: string; data: Buffer; weight: number; style: string }[] {
  if (fontsCache) return fontsCache;
  const fontsDir = path.join(__dirname, 'fonts');
  const candidates = [
    { file: 'DMSans-Regular.ttf', name: 'DM Sans', weight: 400, style: 'normal' },
  ];
  fontsCache = candidates
    .map((c) => {
      const filePath = path.join(fontsDir, c.file);
      if (!fs.existsSync(filePath)) return null;
      return { ...c, data: fs.readFileSync(filePath) } as any;
    })
    .filter((f): f is { name: string; data: Buffer; weight: number; style: string } => f !== null);
  return fontsCache;
}

function logoCornerStyle(position: LogoPosition, sz: number): Record<string, any> {
  const base: Record<string, any> = { position: 'absolute', width: `${sz}px`, height: `${sz}px`, objectFit: 'contain' };
  switch (position) {
    case 'top-left':     return { ...base, top: `${LOGO_PADDING}px`, left: `${LOGO_PADDING}px` };
    case 'top-right':    return { ...base, top: `${LOGO_PADDING}px`, right: `${LOGO_PADDING}px` };
    case 'bottom-left':  return { ...base, bottom: `${LOGO_PADDING}px`, left: `${LOGO_PADDING}px` };
    case 'bottom-right': return { ...base, bottom: `${LOGO_PADDING}px`, right: `${LOGO_PADDING}px` };
  }
}

export function buildComposeStudioLogo(allowList: ReadonlySet<string>) {
  return functions
    .runWith({ memory: '1GB', timeoutSeconds: 60 })
    .https.onCall(async (data: ComposeLogoInput, context): Promise<ComposeLogoResult> => {
      if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
        throw new functions.https.HttpsError('permission-denied', 'Admin only.');
      }

      const imageStoragePath = typeof data?.imageStoragePath === 'string' ? data.imageStoragePath : '';
      const positionRaw = typeof data?.position === 'string' ? data.position : 'bottom-right';
      const position: LogoPosition = (
        ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const
      ).includes(positionRaw as any) ? (positionRaw as LogoPosition) : 'bottom-right';
      const sizeRaw = Number(data?.logoSize);
      const logoSize = Number.isFinite(sizeRaw) ? Math.max(80, Math.min(280, sizeRaw)) : 140;

      if (!imageStoragePath) return { ok: false, code: 'no-image', message: 'No image to overlay.' };
      if (!imageStoragePath.startsWith('marketing/studio/')) {
        return { ok: false, code: 'bad-image-path', message: 'Can only overlay logos on Studio images.' };
      }

      let brand: StudioBrand;
      try {
        brand = await loadStudioBrand();
      } catch {
        return { ok: false, code: 'brand-load-failed', message: "Couldn't load your brand. Try again." };
      }
      if (!brand.logoUrl) {
        return { ok: false, code: 'no-logo', message: 'Add a logo URL in your brand kit first.' };
      }

      // Resolve a public URL for the source image — Satori fetches it as
      // an <img>, so we need an absolute URL it can reach.
      const bucket = admin.storage().bucket();
      const srcFile = bucket.file(imageStoragePath);
      const [exists] = await srcFile.exists();
      if (!exists) {
        return { ok: false, code: 'image-missing', message: 'Source image is gone.' };
      }
      const sourceUrl = `https://storage.googleapis.com/${bucket.name}/${imageStoragePath}`;

      // Build the Satori tree: full-bleed picked image + corner logo.
      const tree = h(
        'div',
        {
          style: {
            display: 'flex',
            position: 'relative',
            width: `${FRAME_WIDTH}px`,
            height: `${FRAME_HEIGHT}px`,
            backgroundColor: '#000',
          },
        },
        h('img', {
          src: sourceUrl,
          width: FRAME_WIDTH,
          height: FRAME_HEIGHT,
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${FRAME_WIDTH}px`,
            height: `${FRAME_HEIGHT}px`,
            objectFit: 'cover',
          },
        }),
        h('img', {
          src: brand.logoUrl,
          width: logoSize,
          height: logoSize,
          style: logoCornerStyle(position, logoSize),
        }),
      );

      let png: Buffer;
      try {
        const svg = await satori(tree as any, {
          width: FRAME_WIDTH,
          height: FRAME_HEIGHT,
          fonts: loadStudioFonts() as any,
        });
        const resvg = new Resvg(svg, {
          fitTo: { mode: 'width', value: FRAME_WIDTH },
          background: 'transparent',
          font: { loadSystemFonts: false },
        });
        png = Buffer.from(resvg.render().asPng());
      } catch (e: any) {
        console.warn('[studio:logo] satori/resvg failed', e);
        return { ok: false, code: 'compose-failed', message: "Couldn't add the logo. Try again." };
      }

      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const variantId = `${ts}-with-logo`;
      const storagePath = `marketing/studio/${variantId}.png`;
      const outFile = bucket.file(storagePath);
      try {
        await outFile.save(png, { contentType: 'image/png', metadata: { metadata: { source: 'studio-logo-overlay', parent: imageStoragePath, position } } });
        await outFile.makePublic();
      } catch (e) {
        console.warn('[studio:logo] upload failed', e);
        return { ok: false, code: 'upload-failed', message: "Couldn't save the new image. Try again." };
      }

      const actor = context.auth?.token?.email ?? context.auth?.uid ?? null;
      await logCost({ source: 'logo-overlay', costInr: 0, bytes: png.length, actor: actor as string | null, meta: { variantId, parent: imageStoragePath, position } });

      const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
      return { ok: true, variantId, url, storagePath };
    });
}

// ── 4. uploadStudioImage (Phase 4 item 4 — Upload your own) ────────────────
// Admin uploads a webp/png/jpg from their device; we store it under
// marketing/studio/uploads/{ts}.{ext} and return the public URL so the rest
// of the Studio flow (caption gen, draft create, publish) treats it like
// any other variant. No AI cost.

interface UploadImageInput {
  dataUrl?: unknown;
  mimeType?: unknown;
}

interface UploadImageOk {
  ok: true;
  variantId: string;
  url: string;
  storagePath: string;
}

interface UploadImageErr {
  ok: false;
  code: string;
  message: string;
}

type UploadImageResult = UploadImageOk | UploadImageErr;

const UPLOAD_MAX_BYTES = 8 * 1024 * 1024; // 8 MB — IG accepts up to ~8MB anyway
const UPLOAD_ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function buildUploadStudioImage(allowList: ReadonlySet<string>) {
  return functions
    .runWith({ memory: '512MB', timeoutSeconds: 60 })
    .https.onCall(async (data: UploadImageInput, context): Promise<UploadImageResult> => {
      if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
        throw new functions.https.HttpsError('permission-denied', 'Admin only.');
      }

      const dataUrl = typeof data?.dataUrl === 'string' ? data.dataUrl : '';
      if (!dataUrl.startsWith('data:')) {
        return { ok: false, code: 'no-image', message: 'Pick a PNG, JPG, or WEBP file.' };
      }
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        return { ok: false, code: 'bad-data-url', message: "Couldn't read that file. Try a different one." };
      }
      const mime = match[1].toLowerCase();
      if (!UPLOAD_ALLOWED_MIME.has(mime)) {
        return { ok: false, code: 'bad-mime', message: 'Only PNG, JPG, and WEBP files are supported.' };
      }
      let buf: Buffer;
      try {
        buf = Buffer.from(match[2], 'base64');
      } catch {
        return { ok: false, code: 'bad-base64', message: "Couldn't decode the file. Try uploading again." };
      }
      if (buf.length === 0) {
        return { ok: false, code: 'empty-file', message: 'The file is empty.' };
      }
      if (buf.length > UPLOAD_MAX_BYTES) {
        return { ok: false, code: 'file-too-large', message: 'File is larger than 8 MB. Compress or resize and try again.' };
      }

      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';
      const variantId = `${ts}-upload`;
      const storagePath = `marketing/studio/uploads/${variantId}.${ext}`;
      const bucket = admin.storage().bucket();
      const file = bucket.file(storagePath);
      try {
        await file.save(buf, { contentType: mime, metadata: { metadata: { source: 'studio-upload' } } });
        await file.makePublic();
      } catch (e) {
        console.warn('[studio:upload] save failed', e);
        return { ok: false, code: 'upload-failed', message: "Couldn't save the image. Try again." };
      }
      const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

      const actor = context.auth?.token?.email ?? context.auth?.uid ?? null;
      await logCost({
        source: 'upload',
        costInr: 0,
        bytes: buf.length,
        actor: actor as string | null,
        meta: { variantId, mime },
      });

      return { ok: true, variantId, url, storagePath };
    });
}
