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
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGenerateStudioVariants = buildGenerateStudioVariants;
exports.buildCreateStudioDraft = buildCreateStudioDraft;
exports.buildEditStudioImage = buildEditStudioImage;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const imageSources_1 = require("./imageSources");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
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
const DEFAULT_STYLE_DESCRIPTION = 'A warm hand-drawn 2D illustration. Flat colours with subtle gradients, no photorealism. Indian characters (brown skin, dark hair). Soft pastels. Rounded organic shapes. Generous negative space. Single-scene composition.';
const DEFAULT_STYLE_KEYWORDS = 'flat illustration, pastel, Indian, motherhood, gentle, hand-drawn, soft gradient, organic shapes';
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
    const styleDesc = profile?.description ?? DEFAULT_STYLE_DESCRIPTION;
    const keywords = profile?.artKeywords ?? DEFAULT_STYLE_KEYWORDS;
    const negative = (profile?.prohibited ?? []).join(', ');
    // Imagen / FLUX prompt structure: positive description first, then
    // the subject, then the negative-style guard. Keeping the positive
    // style block at the front gives the model the strongest steer.
    const parts = [];
    parts.push(`Visual style: ${styleDesc}`);
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
        const variantCount = Math.max(1, Math.min(4, Number(data?.variantCount) || 4));
        const model = data?.model === 'flux' ? 'flux' : 'imagen';
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
        const styledPrompt = buildStudioPrompt(prompt, brand);
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const actor = context.auth?.token?.email ?? context.auth?.uid ?? null;
        // Fire all variants in parallel. Each provider returns a data: URL or
        // http URL; we upload to Storage and return the public Storage URL so
        // the URL doesn't expire when the API session ends.
        const tasks = [];
        for (let i = 0; i < variantCount; i++) {
            tasks.push((async () => {
                let imageUrl = null;
                try {
                    if (model === 'imagen') {
                        imageUrl = await (0, imageSources_1.imagenGenerate)(styledPrompt, { aspectRatio: aspectRatio === '16:9' ? '16:9' : aspectRatio });
                    }
                    else {
                        imageUrl = await (0, imageSources_1.fluxSchnell)(styledPrompt, { aspectRatio: aspectRatio === '16:9' ? '16:9' : aspectRatio });
                    }
                }
                catch (e) {
                    console.warn(`[studio] variant ${i} provider threw`, e);
                }
                if (!imageUrl)
                    return null;
                const variantId = `${ts}-${i}`;
                const storagePath = `marketing/studio/${variantId}.png`;
                try {
                    const { url, bytes } = await uploadToStorage(imageUrl, storagePath);
                    await logCost({ source: model, costInr: perImage, bytes, actor: actor, meta: { variantId } });
                    return { variantId, url, storagePath };
                }
                catch (e) {
                    console.warn(`[studio] variant ${i} upload failed`, e);
                    return null;
                }
            })());
        }
        const settled = await Promise.all(tasks);
        const variants = settled.filter((v) => v !== null);
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
async function generateStudioCaption(prompt, brand) {
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
        if (!prompt)
            return { ok: false, code: 'no-prompt', message: 'Original prompt is required.' };
        if (!imageUrl)
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
        const draft = {
            status,
            kind: 'image',
            themeKey: 'studio',
            themeLabel: 'Studio',
            caption,
            headline: prompt.slice(0, 80),
            assets: [{ url: imageUrl, index: 0, template: 'studioImage', storagePath: imageStoragePath }],
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
        if (!imageStoragePath)
            return { ok: false, code: 'no-image', message: 'No image to edit.' };
        if (!prompt)
            return { ok: false, code: 'no-prompt', message: 'Tell me what to change.' };
        if (prompt.length > 500)
            return { ok: false, code: 'prompt-too-long', message: 'Keep your edit under 500 characters.' };
        if (!imageStoragePath.startsWith('marketing/studio/')) {
            return { ok: false, code: 'bad-image-path', message: "Can only edit images you generated in the studio." };
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
        // Call OpenAI Images edit.
        const result = await (0, imageSources_1.openaiImageEdit)(inputBuf, editPrompt, { quality, size: '1024x1024' });
        if (!result) {
            return { ok: false, code: 'edit-failed', message: "Image edit didn't work. Try a different instruction or wait a moment." };
        }
        // Upload as a new Storage object.
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const variantId = `${ts}-edit`;
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
            source: 'openai-edit',
            costInr: cost,
            bytes,
            actor: actor,
            meta: { variantId, parent: imageStoragePath, prompt: prompt.slice(0, 120) },
        });
        return { ok: true, variantId, url, storagePath, costInr: cost };
    });
}
