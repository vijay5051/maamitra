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

export { buildScoreMarketingDraft } from './scoring';
export { buildGenerateMarketingDraft, buildDailyMarketingDraftCron } from './generator';
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
export { buildGenerateStudioVariants, buildCreateStudioDraft, buildEditStudioImage } from './studio';
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
      if (backgroundUrl && (templateName === 'quoteCard' || templateName === 'milestoneCard')) {
        if (templateName === 'quoteCard') props.backgroundUrl = backgroundUrl;
        if (templateName === 'milestoneCard') props.photoUrl = backgroundUrl;
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
