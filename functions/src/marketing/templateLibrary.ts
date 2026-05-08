/**
 * Cloud Function callables backing the marketing template library.
 *
 * The picker on the admin side needs to fetch a template image as a Blob so
 * it can hand it off to the destination upload flow (article hero, studio
 * background). Direct browser fetches against firebasestorage.googleapis.com
 * are blocked by CORS — the bucket isn't configured to allow arbitrary
 * origins. Rather than configuring CORS at the bucket level (would require
 * gsutil/gcloud), we proxy the read through this admin-only callable: it
 * downloads the object server-side via the admin SDK and returns a base64
 * data URL the picker decodes back into a Blob.
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

interface GetTemplateImageInput {
  id?: unknown;
}

type GetTemplateImageResult =
  | { ok: true; dataUrl: string; bytes: number; contentType: string }
  | { ok: false; code: string; message: string };

async function callerIsAdmin(
  token: any,
  allowList: ReadonlySet<string>,
): Promise<boolean> {
  if (!token) return false;
  if (token.admin === true) return true;
  if (token.email_verified === true && typeof token.email === 'string' && allowList.has(token.email)) {
    return true;
  }
  // Mirror the rules' adminRoleField check via Firestore.
  const uid = token.uid as string | undefined;
  if (!uid) return false;
  try {
    const userSnap = await admin.firestore().collection('users').doc(uid).get();
    const role = userSnap.data()?.adminRole as string | undefined;
    return role === 'super' || role === 'moderator' || role === 'support' || role === 'content';
  } catch {
    return false;
  }
}

export function buildGetTemplateImage(allowList: ReadonlySet<string>) {
  return functions
    .runWith({ memory: '256MB', timeoutSeconds: 30 })
    .https.onCall(async (data: GetTemplateImageInput, context): Promise<GetTemplateImageResult> => {
      if (!(await callerIsAdmin(context.auth?.token, allowList))) {
        return { ok: false, code: 'unauthorized', message: 'Admin only.' };
      }
      const id = typeof data?.id === 'string' ? data.id.trim() : '';
      if (!id) {
        return { ok: false, code: 'bad-request', message: 'Missing template id.' };
      }
      try {
        const snap = await admin.firestore().collection('template_images').doc(id).get();
        if (!snap.exists) {
          return { ok: false, code: 'not-found', message: 'Template no longer exists.' };
        }
        const path = (snap.data()?.storagePath as string | undefined) ?? '';
        if (!path) {
          return { ok: false, code: 'bad-state', message: 'Template is missing its storage path.' };
        }
        const file = admin.storage().bucket().file(path);
        const [exists] = await file.exists();
        if (!exists) {
          return { ok: false, code: 'storage-missing', message: 'The image file is missing from Storage.' };
        }
        const [buffer] = await file.download();
        const [meta] = await file.getMetadata();
        const contentType = (meta.contentType as string | undefined) || 'image/png';
        const base64 = buffer.toString('base64');
        return {
          ok: true,
          dataUrl: `data:${contentType};base64,${base64}`,
          bytes: buffer.length,
          contentType,
        };
      } catch (e: any) {
        console.error('[getTemplateImage] failed', e);
        return { ok: false, code: 'internal', message: "Couldn't read the template — try again." };
      }
    });
}
