// Marketing module Cloud Function exports.
//
// Phase 2:
//   renderMarketingTemplate(callable) — admin-only. Renders a named template
//     with caller-supplied props + brand kit, optionally fetches a stock
//     photo or AI background, uploads the resulting PNG to Storage, returns
//     a public download URL the admin UI can preview / save into a draft.
//
// Future phases will add:
//   generateDailyMarketingDrafts (Phase 3) — pubsub cron
//   publishMarketingDraft        (Phase 4 manual / Phase 7 auto)
//   metaWebhookReceiver          (Phase 5)
//   replyToInboxMessage          (Phase 6)

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

import { fluxSchnell, pexelsSearch } from './imageSources';
import { renderTemplate } from './renderer';
import { BrandSnapshot, TEMPLATE_NAMES } from './templates';

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

interface RenderPayload {
  template: string;
  props: Record<string, any>;
  /** If set, render uses this as the background image URL. Mutually exclusive
   *  with stockQuery / aiPrompt. */
  backgroundUrl?: string;
  /** If set, fetches a Pexels photo with this query and injects as the
   *  background. */
  stockQuery?: string;
  /** If set, generates an AI image with this prompt via FLUX Schnell. Falls
   *  back to stockQuery if the AI call fails. */
  aiPrompt?: string;
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
  imageSource: 'pexels' | 'flux' | 'caller-supplied' | 'none';
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
      let imageSource: RenderResponseOk['imageSource'] = 'none';
      let imageAttribution: string | null = null;
      let backgroundUrl: string | undefined = data?.backgroundUrl;

      if (!backgroundUrl && data?.aiPrompt) {
        const ai = await fluxSchnell(data.aiPrompt, { aspectRatio: '1:1' });
        if (ai) {
          backgroundUrl = ai;
          imageSource = 'flux';
        }
      }
      if (!backgroundUrl && data?.stockQuery) {
        const stock = await pexelsSearch(data.stockQuery);
        if (stock) {
          backgroundUrl = stock.url;
          imageAttribution = stock.attribution;
          imageSource = 'pexels';
        }
      }
      if (!backgroundUrl && data?.backgroundUrl) {
        imageSource = 'caller-supplied';
      } else if (data?.backgroundUrl) {
        imageSource = 'caller-supplied';
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
