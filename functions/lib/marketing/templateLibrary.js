"use strict";
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
exports.buildGetTemplateImage = buildGetTemplateImage;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
async function callerIsAdmin(token, allowList) {
    if (!token)
        return false;
    if (token.admin === true)
        return true;
    if (token.email_verified === true && typeof token.email === 'string' && allowList.has(token.email)) {
        return true;
    }
    // Mirror the rules' adminRoleField check via Firestore.
    const uid = token.uid;
    if (!uid)
        return false;
    try {
        const userSnap = await admin.firestore().collection('users').doc(uid).get();
        const role = userSnap.data()?.adminRole;
        return role === 'super' || role === 'moderator' || role === 'support' || role === 'content';
    }
    catch {
        return false;
    }
}
function buildGetTemplateImage(allowList) {
    return functions
        .runWith({ memory: '256MB', timeoutSeconds: 30 })
        .https.onCall(async (data, context) => {
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
            const path = snap.data()?.storagePath ?? '';
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
            const contentType = meta.contentType || 'image/png';
            const base64 = buffer.toString('base64');
            return {
                ok: true,
                dataUrl: `data:${contentType};base64,${base64}`,
                bytes: buffer.length,
                contentType,
            };
        }
        catch (e) {
            console.error('[getTemplateImage] failed', e);
            return { ok: false, code: 'internal', message: "Couldn't read the template — try again." };
        }
    });
}
