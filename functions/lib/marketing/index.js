"use strict";
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
exports.buildProbeMarketingHealthNow = exports.buildProbeMarketingHealth = exports.buildComposeStudioLogo = exports.buildUploadStudioImage = exports.buildEditStudioImage = exports.buildCreateStudioDraft = exports.buildGenerateStudioVariants = exports.buildBoostMarketingDraft = exports.buildRenderUgcAsDraft = exports.buildGenerateWeeklyInsightDigest = exports.buildPollMarketingAccountInsights = exports.buildPollMarketingInsights = exports.buildPublishMarketingDraftNow = exports.buildScheduledMarketingPublisher = exports.buildMetaInboxReplyPublisher = exports.buildClassifyInboxThread = exports.buildGenerateInboxReplies = exports.buildMetaWebhookReceiver = exports.buildGenerateAheadDrafts = exports.buildDailyMarketingDraftCron = exports.buildGenerateMarketingDraft = exports.buildScoreMarketingDraft = void 0;
exports.buildRenderMarketingTemplate = buildRenderMarketingTemplate;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const imageSources_1 = require("./imageSources");
const renderer_1 = require("./renderer");
const templates_1 = require("./templates");
var scoring_1 = require("./scoring");
Object.defineProperty(exports, "buildScoreMarketingDraft", { enumerable: true, get: function () { return scoring_1.buildScoreMarketingDraft; } });
var generator_1 = require("./generator");
Object.defineProperty(exports, "buildGenerateMarketingDraft", { enumerable: true, get: function () { return generator_1.buildGenerateMarketingDraft; } });
Object.defineProperty(exports, "buildDailyMarketingDraftCron", { enumerable: true, get: function () { return generator_1.buildDailyMarketingDraftCron; } });
Object.defineProperty(exports, "buildGenerateAheadDrafts", { enumerable: true, get: function () { return generator_1.buildGenerateAheadDrafts; } });
var inbox_1 = require("./inbox");
Object.defineProperty(exports, "buildMetaWebhookReceiver", { enumerable: true, get: function () { return inbox_1.buildMetaWebhookReceiver; } });
Object.defineProperty(exports, "buildGenerateInboxReplies", { enumerable: true, get: function () { return inbox_1.buildGenerateInboxReplies; } });
Object.defineProperty(exports, "buildClassifyInboxThread", { enumerable: true, get: function () { return inbox_1.buildClassifyInboxThread; } });
var publisher_1 = require("./publisher");
Object.defineProperty(exports, "buildMetaInboxReplyPublisher", { enumerable: true, get: function () { return publisher_1.buildMetaInboxReplyPublisher; } });
Object.defineProperty(exports, "buildScheduledMarketingPublisher", { enumerable: true, get: function () { return publisher_1.buildScheduledMarketingPublisher; } });
Object.defineProperty(exports, "buildPublishMarketingDraftNow", { enumerable: true, get: function () { return publisher_1.buildPublishMarketingDraftNow; } });
var insights_1 = require("./insights");
Object.defineProperty(exports, "buildPollMarketingInsights", { enumerable: true, get: function () { return insights_1.buildPollMarketingInsights; } });
Object.defineProperty(exports, "buildPollMarketingAccountInsights", { enumerable: true, get: function () { return insights_1.buildPollMarketingAccountInsights; } });
Object.defineProperty(exports, "buildGenerateWeeklyInsightDigest", { enumerable: true, get: function () { return insights_1.buildGenerateWeeklyInsightDigest; } });
var ugc_1 = require("./ugc");
Object.defineProperty(exports, "buildRenderUgcAsDraft", { enumerable: true, get: function () { return ugc_1.buildRenderUgcAsDraft; } });
var boost_1 = require("./boost");
Object.defineProperty(exports, "buildBoostMarketingDraft", { enumerable: true, get: function () { return boost_1.buildBoostMarketingDraft; } });
var studio_1 = require("./studio");
Object.defineProperty(exports, "buildGenerateStudioVariants", { enumerable: true, get: function () { return studio_1.buildGenerateStudioVariants; } });
Object.defineProperty(exports, "buildCreateStudioDraft", { enumerable: true, get: function () { return studio_1.buildCreateStudioDraft; } });
Object.defineProperty(exports, "buildEditStudioImage", { enumerable: true, get: function () { return studio_1.buildEditStudioImage; } });
Object.defineProperty(exports, "buildUploadStudioImage", { enumerable: true, get: function () { return studio_1.buildUploadStudioImage; } });
Object.defineProperty(exports, "buildComposeStudioLogo", { enumerable: true, get: function () { return studio_1.buildComposeStudioLogo; } });
var health_1 = require("./health");
Object.defineProperty(exports, "buildProbeMarketingHealth", { enumerable: true, get: function () { return health_1.buildProbeMarketingHealth; } });
Object.defineProperty(exports, "buildProbeMarketingHealthNow", { enumerable: true, get: function () { return health_1.buildProbeMarketingHealthNow; } });
// firebase-admin is initialized in functions/src/index.ts before this module
// is imported; we just grab the existing instance.
// Capability check — Marketing renders are gated on the same admin signal
// the rules use. Mirrors isAdminTokenAsync from the parent index.ts but
// inlined to avoid a circular import.
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
/**
 * Admin-callable HTTPS function. Reads brand kit from Firestore, optionally
 * fetches a stock or AI background, renders via Satori, uploads PNG to
 * Storage at marketing/previews/{timestamp}-{template}.png, returns a
 * download URL the client can show or save into a draft.
 *
 * Deploy: firebase deploy --only functions:renderMarketingTemplate
 */
function buildRenderMarketingTemplate(allowList) {
    return functions
        // Once PEXELS_API_KEY / REPLICATE_API_TOKEN are set in Secret Manager,
        // add them here:  secrets: ['PEXELS_API_KEY', 'REPLICATE_API_TOKEN']
        // Until then the function gracefully degrades — stock + AI sources
        // return null with a console warning, and tip-card style renders
        // (no background) work fine.
        .runWith({ memory: '1GB', timeoutSeconds: 60 })
        .https.onCall(async (data, context) => {
        if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
            throw new functions.https.HttpsError('permission-denied', 'Only admins with marketing access can render templates.');
        }
        const templateName = String(data?.template ?? '');
        if (!templates_1.TEMPLATE_NAMES.includes(templateName)) {
            return { ok: false, code: 'invalid-template', message: `Unknown template "${templateName}". Known: ${templates_1.TEMPLATE_NAMES.join(', ')}` };
        }
        const props = (data?.props ?? {});
        // ── Resolve background image (if any) ─────────────────────────────
        // Each provider returns a string (URL or data: URL) on success or null
        // on any failure — no provider throws. Caller picks one provider per
        // render; we don't auto-fallback because the cost/style profile
        // differs significantly between FLUX, Imagen, and gpt-image-1.
        let imageSource = 'none';
        let imageAttribution = null;
        let backgroundUrl;
        const bg = data?.background;
        if (bg?.type === 'url' && typeof bg.url === 'string' && bg.url) {
            backgroundUrl = bg.url;
            imageSource = 'caller-supplied';
        }
        else if (bg?.type === 'stock' && bg.provider === 'pexels' && typeof bg.query === 'string' && bg.query.trim()) {
            const stock = await (0, imageSources_1.pexelsSearch)(bg.query.trim());
            if (stock) {
                backgroundUrl = stock.url;
                imageAttribution = stock.attribution;
                imageSource = 'pexels';
            }
        }
        else if (bg?.type === 'ai' && typeof bg.prompt === 'string' && bg.prompt.trim()) {
            const prompt = bg.prompt.trim();
            let url = null;
            if (bg.model === 'imagen') {
                url = await (0, imageSources_1.imagenGenerate)(prompt, { aspectRatio: '1:1' });
                if (url)
                    imageSource = 'imagen';
            }
            else if (bg.model === 'dalle') {
                url = await (0, imageSources_1.openaiImage)(prompt, { quality: 'medium', size: '1024x1024' });
                if (url)
                    imageSource = 'dalle';
            }
            else {
                url = await (0, imageSources_1.fluxSchnell)(prompt, { aspectRatio: '1:1' });
                if (url)
                    imageSource = 'flux';
            }
            if (url)
                backgroundUrl = url;
        }
        // Templates that take a backgroundUrl key it explicitly.
        if (backgroundUrl && (templateName === 'quoteCard' || templateName === 'milestoneCard')) {
            if (templateName === 'quoteCard')
                props.backgroundUrl = backgroundUrl;
            if (templateName === 'milestoneCard')
                props.photoUrl = backgroundUrl;
        }
        // ── Fetch brand kit ───────────────────────────────────────────────
        const brandSnap = await admin.firestore().doc('marketing_brand/main').get();
        const bd = brandSnap.exists ? brandSnap.data() : {};
        const brand = {
            brandName: typeof bd?.brandName === 'string' ? bd.brandName : 'MaaMitra',
            logoUrl: typeof bd?.logoUrl === 'string' ? bd.logoUrl : null,
            palette: {
                primary: typeof bd?.palette?.primary === 'string' ? bd.palette.primary : '#7C3AED',
                background: typeof bd?.palette?.background === 'string' ? bd.palette.background : '#FFF8F2',
                text: typeof bd?.palette?.text === 'string' ? bd.palette.text : '#1F1F2C',
                accent: typeof bd?.palette?.accent === 'string' ? bd.palette.accent : '#F8C8DC',
            },
        };
        // ── Render ─────────────────────────────────────────────────────────
        let result;
        try {
            result = await (0, renderer_1.renderTemplate)(templateName, props, brand, {
                width: typeof data?.width === 'number' ? data.width : 1080,
                height: typeof data?.height === 'number' ? data.height : 1080,
            });
        }
        catch (e) {
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
        }
        catch (e) {
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
        }
        catch (e) {
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
/** Estimated cost (₹) per render by image-source provider. May-2026 rates. */
function imageSourceCostInr(source) {
    switch (source) {
        case 'imagen': return 3.30;
        case 'dalle': return 3.50;
        case 'flux': return 0.25;
        case 'pexels': return 0;
        case 'caller-supplied': return 0;
        case 'none': return 0;
        default: return 0;
    }
}
