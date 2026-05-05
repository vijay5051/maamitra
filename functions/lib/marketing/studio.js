"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGenerateStudioVariants = buildGenerateStudioVariants;
exports.buildCreateStudioDraft = buildCreateStudioDraft;
exports.buildEditStudioImage = buildEditStudioImage;
exports.buildComposeStudioLogo = buildComposeStudioLogo;
exports.buildUploadStudioImage = buildUploadStudioImage;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const imageSources_1 = require("./imageSources");
const resvg_js_1 = require("@resvg/resvg-js");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const satori_1 = __importDefault(require("satori"));
const h_1 = require("./templates/h");
const integrationConfig_1 = require("../lib/integrationConfig");
// ── Caller auth ─────────────────────────────────────────────────────────────
async function callerIsMarketingAdmin(token, allowList) {
    if (!token)
        return false;
    if (token.admin === true)
        return true;
    if (token.email_verified === true && token.email && allowList.has(token.email.toLowerCase()))
        return true;
    if (!token.uid)
        return false;
    try {
        const snap = await admin.firestore().doc(`users/${token.uid}`).get();
        const role = snap.exists ? snap.data()?.adminRole : null;
        return role === 'super' || role === 'content';
    }
    catch {
        return false;
    }
}
// Keep in sync with functions/src/marketing/generator.ts (STYLE_DEFAULT_*)
// and lib/marketingTypes.ts (DEFAULT_STYLE_PROFILE).
const DEFAULT_STYLE_ONE_LINER = 'Soft painterly storybook illustration with subtle watercolor texture. Lavender + sage + dusty-pink + cream palette. Indian women (warm brown skin, dark messy-bun hair) in white-chikankari-embroidered lavender kurtas. Single calm scene, generous negative space, warm cream background.';
const DEFAULT_STYLE_DESCRIPTION = 'A soft, painterly storybook illustration in the spirit of a children\'s-book spread — NOT flat vector. Characters and fabric carry subtle volume, gentle gradients, and a faint watercolor / paper-grain texture. No hard black outlines. Light is warm, ambient and dappled — never harsh shadows. Disciplined pastel palette: warm cream / ivory background, signature soft lavender on hero garments and props, dusty / baby pink, sage / mint green, with golden-honey + peach used sparingly. Characters are Indian women — moms, grandmothers (dadis), with babies and toddlers — warm brown skin, dark messy-bun hair (or long braid / soft waves); grandmothers wear silver-grey hair and a small bindi. Faces are soft and rounded with peaceful or gently-closed eyes, calm half-smile, soft rosy cheeks. Wardrobe: lavender kurta with delicate WHITE CHIKANKARI floral embroidery at neckline and cuffs, white salwar, soft dupatta; grandmothers in pastel sarees; subtle gold jewelry only. Composition is always a SINGLE calm scene; for wide hero formats character sits on the right with generous empty cream space on the left for caption overlay. Recurring motifs: lotus blossoms, marigolds, drifting leaves, potted plants in pastel ceramic pots, round dusty-pink rugs with tasseled fringe, sage-green yoga mats. Never more than 3-4 characters in one frame.';
const DEFAULT_STYLE_KEYWORDS = 'painterly 2D illustration, watercolor texture, storybook spread, soft pastel palette, lavender + sage + dusty pink + cream, Indian woman, warm brown skin, messy bun, white chikankari embroidery on lavender kurta, soft dupatta, peaceful closed eyes, gentle smile, generous negative space, warm dappled light, lotus, marigold';
async function loadStudioBrand() {
    const snap = await admin.firestore().doc('marketing_brand/main').get();
    const d = snap.exists ? snap.data() : {};
    const arr = (v) => (Array.isArray(v) ? v : []);
    return {
        brandName: typeof d?.brandName === 'string' ? d.brandName : 'MaaMitra',
        voice: {
            attributes: arr(d?.voice?.attributes),
            avoid: arr(d?.voice?.avoid),
            bilingual: typeof d?.voice?.bilingual === 'string' ? d.voice.bilingual : 'hinglish',
        },
        hashtags: arr(d?.hashtags),
        styleProfile: d?.styleProfile ? {
            oneLiner: typeof d.styleProfile.oneLiner === 'string' && d.styleProfile.oneLiner ? d.styleProfile.oneLiner : DEFAULT_STYLE_ONE_LINER,
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
async function checkDailyCostCap(brand, plannedSpend) {
    const cap = brand.costCaps.dailyInr;
    if (cap <= 0)
        return { ok: true };
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const snap = await admin.firestore()
        .collection('marketing_cost_log')
        .where('ts', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
        .get();
    const spentToday = snap.docs.reduce((acc, d) => acc + (Number(d.data()?.costInr) || 0), 0);
    if (spentToday + plannedSpend > cap) {
        return { ok: false, spent: spentToday, cap };
    }
    return { ok: true };
}
async function logCost(opts) {
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
    }
    catch (e) {
        console.warn('[studio] cost log write failed (non-fatal)', e);
    }
}
// ── Style-locked prompt builder ─────────────────────────────────────────────
function buildStudioPrompt(userPrompt, brand) {
    const profile = brand.styleProfile;
    // Imagen 3 caps prompts ~480 tokens. Use the punchy oneLiner as the
    // visual-style line; description stays in Firestore for admin reference
    // but isn't piped into the model.
    const styleLine = profile?.oneLiner?.trim()
        || profile?.description?.slice(0, 320).trim()
        || DEFAULT_STYLE_ONE_LINER;
    const keywords = profile?.artKeywords ?? DEFAULT_STYLE_KEYWORDS;
    const negative = (profile?.prohibited ?? []).join(', ');
    // Imagen / FLUX prompt structure: positive description first, then
    // the subject, then the negative-style guard. Keeping the positive
    // style block at the front gives the model the strongest steer.
    const parts = [];
    parts.push(`Visual style: ${styleLine}`);
    parts.push(`Art direction keywords: ${keywords}.`);
    parts.push(`Subject: ${userPrompt.trim()}`);
    if (negative)
        parts.push(`Do NOT include: ${negative}.`);
    parts.push('Single coherent illustration. No text, no logos, no watermarks.');
    return parts.join('\n');
}
// ── Storage upload ──────────────────────────────────────────────────────────
async function uploadToStorage(dataUrlOrHttp, storagePath) {
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    let buf;
    let contentType = 'image/png';
    if (dataUrlOrHttp.startsWith('data:')) {
        const match = dataUrlOrHttp.match(/^data:([^;]+);base64,(.+)$/);
        if (!match)
            throw new Error('invalid-data-url');
        contentType = match[1];
        buf = Buffer.from(match[2], 'base64');
    }
    else {
        // http(s) URL — fetch, store as binary
        const r = await fetch(dataUrlOrHttp);
        if (!r.ok)
            throw new Error(`fetch-failed-${r.status}`);
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
const COST_PER_IMAGE = {
    imagen: 3.30,
    dalle: 3.50,
    flux: 0.25,
};
function buildGenerateStudioVariants(allowList) {
    return functions
        .runWith({ memory: '1GB', timeoutSeconds: 180 })
        .https.onCall(async (data, context) => {
        if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
            throw new functions.https.HttpsError('permission-denied', 'Admin only.');
        }
        const prompt = typeof data?.prompt === 'string' ? data.prompt.trim() : '';
        if (!prompt)
            return { ok: false, code: 'no-prompt', message: 'Tell me what to make first.' };
        if (prompt.length > 500)
            return { ok: false, code: 'prompt-too-long', message: 'Keep your idea under 500 characters.' };
        const mode = data?.mode === 'carousel' ? 'carousel' : 'single';
        // Carousels need 3–5 slides; singles allow 1–4 picker variants.
        const requested = Number(data?.variantCount);
        const variantCount = mode === 'carousel'
            ? Math.max(3, Math.min(5, Number.isFinite(requested) ? requested : 3))
            : Math.max(1, Math.min(4, Number.isFinite(requested) ? requested : 4));
        // Default = gpt-image-1 (dalle) — strongest prompt adherence for our
        // chikankari + composition + palette specifics. Caller can pass
        // 'imagen' or 'flux' to override.
        const model = data?.model === 'imagen' ? 'imagen'
            : data?.model === 'flux' ? 'flux'
                : 'dalle';
        const aspectRatio = (data?.aspectRatio === '9:16' ? '9:16' :
            data?.aspectRatio === '16:9' ? '16:9' :
                '1:1');
        let brand;
        try {
            brand = await loadStudioBrand();
        }
        catch {
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
        // Pre-flight: verify the chosen provider has a key configured so we can
        // return an actionable error immediately rather than failing all variants
        // with a generic message.
        {
            const cfg = await (0, integrationConfig_1.getIntegrationConfig)();
            if (model === 'dalle' && !cfg.openai.apiKey) {
                return { ok: false, code: 'missing-api-key', message: 'OpenAI API key is not set. Add it in Admin → Integrations → OpenAI.' };
            }
            if (model === 'imagen' && !cfg.gemini.apiKey) {
                return { ok: false, code: 'missing-api-key', message: 'Gemini API key is not set. Add it in Admin → Integrations → Google Gemini.' };
            }
            if (model === 'flux' && !cfg.replicate.apiToken) {
                return { ok: false, code: 'missing-api-key', message: 'Replicate API token is not set. Add it in Admin → Integrations → Replicate.' };
            }
        }
        // Fire all variants in parallel. Each provider returns a data: URL or
        // http URL; we upload to Storage and return the public Storage URL so
        // the URL doesn't expire when the API session ends.
        const tasks = [];
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
                let imageUrl = null;
                let hint = '';
                try {
                    if (model === 'imagen') {
                        imageUrl = await (0, imageSources_1.imagenGenerate)(styledPrompt, { aspectRatio: aspectRatio === '16:9' ? '16:9' : aspectRatio });
                        if (!imageUrl)
                            hint = 'Imagen returned no image. The model endpoint may have changed — check your Gemini API key in Integrations.';
                    }
                    else if (model === 'dalle') {
                        // gpt-image-1 only supports a fixed set of square / portrait /
                        // landscape sizes — pick the closest to the requested aspect.
                        const size = aspectRatio === '9:16' ? '1024x1536'
                            : aspectRatio === '16:9' ? '1536x1024'
                                : '1024x1024';
                        imageUrl = await (0, imageSources_1.openaiImage)(styledPrompt, { quality: 'medium', size });
                        if (!imageUrl)
                            hint = 'gpt-image-1 returned no image. Check your OpenAI API key in Integrations and ensure your organisation is verified at platform.openai.com.';
                    }
                    else {
                        imageUrl = await (0, imageSources_1.fluxSchnell)(styledPrompt, { aspectRatio: aspectRatio === '16:9' ? '16:9' : aspectRatio });
                        if (!imageUrl)
                            hint = 'FLUX returned no image. Check your Replicate API token in Integrations.';
                    }
                }
                catch (e) {
                    console.warn(`[studio] variant ${i} provider threw`, e);
                    hint = e?.message ?? 'Provider error.';
                }
                if (!imageUrl)
                    return { variant: null, hint };
                const variantId = mode === 'carousel' ? `${ts}-slide${i}` : `${ts}-${i}`;
                const storagePath = `marketing/studio/${variantId}.png`;
                try {
                    const { url, bytes } = await uploadToStorage(imageUrl, storagePath);
                    await logCost({ source: model, costInr: perImage, bytes, actor: actor, meta: { variantId, mode } });
                    return { variant: { variantId, url, storagePath }, hint: '' };
                }
                catch (e) {
                    console.warn(`[studio] variant ${i} upload failed`, e);
                    return { variant: null, hint: 'Upload to Storage failed.' };
                }
            })());
        }
        const settled = await Promise.all(tasks);
        const variants = settled.map((s) => s.variant).filter((v) => v !== null);
        const failedCount = settled.length - variants.length;
        if (variants.length === 0) {
            const firstHint = settled.find((s) => s.hint)?.hint ?? '';
            const msg = firstHint
                ? `Couldn't generate any images. ${firstHint}`
                : "Couldn't generate any images. Try a different prompt or wait a moment.";
            return { ok: false, code: 'all-variants-failed', message: msg };
        }
        return {
            ok: true,
            variants,
            costInr: perImage * variants.length,
            failedCount,
        };
    });
}
async function generateStudioCaption(prompt, brand) {
    const cfg = await (0, integrationConfig_1.getIntegrationConfig)();
    if (!cfg.openai.apiKey) {
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
            headers: { Authorization: `Bearer ${cfg.openai.apiKey}`, 'Content-Type': 'application/json' },
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
        if (!res.ok)
            throw new Error(`openai-${res.status}`);
        const out = (await res.json());
        const caption = out?.choices?.[0]?.message?.content?.trim();
        if (!caption)
            throw new Error('empty-caption');
        return caption;
    }
    catch (e) {
        console.warn('[studio] caption gen failed, using fallback', e);
        return `${prompt}\n\n${brand.hashtags.slice(0, 5).join(' ')}`;
    }
}
function buildCreateStudioDraft(allowList) {
    return functions
        .runWith({ memory: '512MB', timeoutSeconds: 60 })
        .https.onCall(async (data, context) => {
        if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
            throw new functions.https.HttpsError('permission-denied', 'Admin only.');
        }
        const prompt = typeof data?.prompt === 'string' ? data.prompt.trim() : '';
        const imageUrl = typeof data?.imageUrl === 'string' ? data.imageUrl : '';
        const imageStoragePath = typeof data?.imageStoragePath === 'string' ? data.imageStoragePath : '';
        let caption = typeof data?.caption === 'string' ? data.caption.trim() : '';
        const scheduledAt = typeof data?.scheduledAt === 'string' && data.scheduledAt ? data.scheduledAt : null;
        let assets = [];
        if (Array.isArray(data?.assets)) {
            for (const raw of data.assets) {
                if (!raw || typeof raw !== 'object')
                    continue;
                const u = typeof raw.url === 'string' ? raw.url : '';
                const sp = typeof raw.storagePath === 'string' ? raw.storagePath : '';
                if (u && sp)
                    assets.push({ url: u, storagePath: sp });
                if (assets.length >= 10)
                    break; // IG caps carousels at 10.
            }
        }
        if (assets.length === 0 && imageUrl) {
            assets = [{ url: imageUrl, storagePath: imageStoragePath }];
        }
        if (!prompt)
            return { ok: false, code: 'no-prompt', message: 'Original prompt is required.' };
        if (assets.length === 0)
            return { ok: false, code: 'no-image', message: 'Pick an image first.' };
        let brand;
        try {
            brand = await loadStudioBrand();
        }
        catch {
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
        }
        catch {
            return { ok: false, code: 'write-failed', message: "Couldn't save the draft. Try again." };
        }
        return { ok: true, draftId: draftRef.id, caption };
    });
}
const EDIT_COST_INR = {
    medium: 3.50,
    high: 14.50,
};
function buildEditStudioImage(allowList) {
    return functions
        .runWith({ memory: '1GB', timeoutSeconds: 120 })
        .https.onCall(async (data, context) => {
        if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
            throw new functions.https.HttpsError('permission-denied', 'Admin only.');
        }
        const imageStoragePath = typeof data?.imageStoragePath === 'string' ? data.imageStoragePath : '';
        const prompt = typeof data?.prompt === 'string' ? data.prompt.trim() : '';
        const quality = data?.quality === 'high' ? 'high' : 'medium';
        const maskDataUrl = typeof data?.maskDataUrl === 'string' ? data.maskDataUrl : '';
        if (!imageStoragePath)
            return { ok: false, code: 'no-image', message: 'No image to edit.' };
        if (!prompt)
            return { ok: false, code: 'no-prompt', message: 'Tell me what to change.' };
        if (prompt.length > 500)
            return { ok: false, code: 'prompt-too-long', message: 'Keep your edit under 500 characters.' };
        if (!imageStoragePath.startsWith('marketing/studio/')) {
            return { ok: false, code: 'bad-image-path', message: "Can only edit images you generated in the studio." };
        }
        // Decode the optional brush mask. The client builds it as a PNG with
        // transparent pixels where the edit should land — same shape OpenAI's
        // /v1/images/edits API expects.
        let maskBuf;
        if (maskDataUrl) {
            const m = maskDataUrl.match(/^data:image\/png;base64,(.+)$/);
            if (!m) {
                return { ok: false, code: 'bad-mask', message: 'Mask must be a base64 PNG.' };
            }
            try {
                maskBuf = Buffer.from(m[1], 'base64');
            }
            catch {
                return { ok: false, code: 'bad-mask-base64', message: "Couldn't decode the mask." };
            }
            if (maskBuf.length === 0)
                maskBuf = undefined;
            else if (maskBuf.length > 4 * 1024 * 1024) {
                return { ok: false, code: 'mask-too-large', message: 'Mask is over 4 MB.' };
            }
        }
        let brand;
        try {
            brand = await loadStudioBrand();
        }
        catch {
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
        let inputBuf;
        try {
            const bucket = admin.storage().bucket();
            const [buf] = await bucket.file(imageStoragePath).download();
            inputBuf = buf;
        }
        catch (e) {
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
        const result = await (0, imageSources_1.openaiImageEdit)(inputBuf, editPrompt, { quality, size: '1024x1024', maskBuf });
        if (!result) {
            return { ok: false, code: 'edit-failed', message: "Image edit didn't work. Try a different instruction or wait a moment." };
        }
        // Upload as a new Storage object.
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const variantId = `${ts}-${maskBuf ? 'masked' : 'edit'}`;
        const storagePath = `marketing/studio/${variantId}.png`;
        let url;
        let bytes;
        try {
            const up = await uploadToStorage(result, storagePath);
            url = up.url;
            bytes = up.bytes;
        }
        catch (e) {
            console.warn('[studio:edit] upload failed', e);
            return { ok: false, code: 'upload-failed', message: "Couldn't save the edited image. Try again." };
        }
        const actor = context.auth?.token?.email ?? context.auth?.uid ?? null;
        await logCost({
            source: maskBuf ? 'openai-edit-masked' : 'openai-edit',
            costInr: cost,
            bytes,
            actor: actor,
            meta: { variantId, parent: imageStoragePath, prompt: prompt.slice(0, 120), masked: !!maskBuf },
        });
        return { ok: true, variantId, url, storagePath, costInr: cost };
    });
}
const LOGO_PADDING = 56;
const FRAME_WIDTH = 1080;
const FRAME_HEIGHT = 1080;
// Lazily load the bundled fonts once per cold start. Satori needs at least
// one font even when the tree contains no text — pick the lightest body
// font from the templates fonts directory.
let fontsCache = null;
function loadStudioFonts() {
    if (fontsCache)
        return fontsCache;
    const fontsDir = path.join(__dirname, 'fonts');
    const candidates = [
        { file: 'DMSans-Regular.ttf', name: 'DM Sans', weight: 400, style: 'normal' },
    ];
    fontsCache = candidates
        .map((c) => {
        const filePath = path.join(fontsDir, c.file);
        if (!fs.existsSync(filePath))
            return null;
        return { ...c, data: fs.readFileSync(filePath) };
    })
        .filter((f) => f !== null);
    return fontsCache;
}
function logoCornerStyle(position, sz) {
    const base = { position: 'absolute', width: `${sz}px`, height: `${sz}px`, objectFit: 'contain' };
    switch (position) {
        case 'top-left': return { ...base, top: `${LOGO_PADDING}px`, left: `${LOGO_PADDING}px` };
        case 'top-right': return { ...base, top: `${LOGO_PADDING}px`, right: `${LOGO_PADDING}px` };
        case 'bottom-left': return { ...base, bottom: `${LOGO_PADDING}px`, left: `${LOGO_PADDING}px` };
        case 'bottom-right': return { ...base, bottom: `${LOGO_PADDING}px`, right: `${LOGO_PADDING}px` };
    }
}
function buildComposeStudioLogo(allowList) {
    return functions
        .runWith({ memory: '1GB', timeoutSeconds: 60 })
        .https.onCall(async (data, context) => {
        if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
            throw new functions.https.HttpsError('permission-denied', 'Admin only.');
        }
        const imageStoragePath = typeof data?.imageStoragePath === 'string' ? data.imageStoragePath : '';
        const positionRaw = typeof data?.position === 'string' ? data.position : 'bottom-right';
        const position = ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(positionRaw) ? positionRaw : 'bottom-right';
        const sizeRaw = Number(data?.logoSize);
        const logoSize = Number.isFinite(sizeRaw) ? Math.max(80, Math.min(280, sizeRaw)) : 140;
        if (!imageStoragePath)
            return { ok: false, code: 'no-image', message: 'No image to overlay.' };
        if (!imageStoragePath.startsWith('marketing/studio/')) {
            return { ok: false, code: 'bad-image-path', message: 'Can only overlay logos on Studio images.' };
        }
        let brand;
        try {
            brand = await loadStudioBrand();
        }
        catch {
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
        const tree = (0, h_1.h)('div', {
            style: {
                display: 'flex',
                position: 'relative',
                width: `${FRAME_WIDTH}px`,
                height: `${FRAME_HEIGHT}px`,
                backgroundColor: '#000',
            },
        }, (0, h_1.h)('img', {
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
        }), (0, h_1.h)('img', {
            src: brand.logoUrl,
            width: logoSize,
            height: logoSize,
            style: logoCornerStyle(position, logoSize),
        }));
        let png;
        try {
            const svg = await (0, satori_1.default)(tree, {
                width: FRAME_WIDTH,
                height: FRAME_HEIGHT,
                fonts: loadStudioFonts(),
            });
            const resvg = new resvg_js_1.Resvg(svg, {
                fitTo: { mode: 'width', value: FRAME_WIDTH },
                background: 'transparent',
                font: { loadSystemFonts: false },
            });
            png = Buffer.from(resvg.render().asPng());
        }
        catch (e) {
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
        }
        catch (e) {
            console.warn('[studio:logo] upload failed', e);
            return { ok: false, code: 'upload-failed', message: "Couldn't save the new image. Try again." };
        }
        const actor = context.auth?.token?.email ?? context.auth?.uid ?? null;
        await logCost({ source: 'logo-overlay', costInr: 0, bytes: png.length, actor: actor, meta: { variantId, parent: imageStoragePath, position } });
        const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
        return { ok: true, variantId, url, storagePath };
    });
}
const UPLOAD_MAX_BYTES = 8 * 1024 * 1024; // 8 MB — IG accepts up to ~8MB anyway
const UPLOAD_ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
function buildUploadStudioImage(allowList) {
    return functions
        .runWith({ memory: '512MB', timeoutSeconds: 60 })
        .https.onCall(async (data, context) => {
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
        let buf;
        try {
            buf = Buffer.from(match[2], 'base64');
        }
        catch {
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
        }
        catch (e) {
            console.warn('[studio:upload] save failed', e);
            return { ok: false, code: 'upload-failed', message: "Couldn't save the image. Try again." };
        }
        const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
        const actor = context.auth?.token?.email ?? context.auth?.uid ?? null;
        await logCost({
            source: 'upload',
            costInr: 0,
            bytes: buf.length,
            actor: actor,
            meta: { variantId, mime },
        });
        return { ok: true, variantId, url, storagePath };
    });
}
