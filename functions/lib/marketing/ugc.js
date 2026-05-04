"use strict";
// UGC pipeline (M6).
//
// renderUgcAsDraft (admin callable). Reads an approved ugc_submissions/{id},
// renders the realStoryCard template with the submitted photo + story,
// uploads the PNG, writes a marketing_drafts/{newId} with status='approved'
// (skips pending_review since the admin already vetted the source UGC), and
// flips the submission status to 'rendered' so it leaves the queue.
//
// The created draft rides the existing M3 publish pipeline — admin can
// schedule, publish-now, or hit boost.
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
exports.buildRenderUgcAsDraft = buildRenderUgcAsDraft;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const renderer_1 = require("./renderer");
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
async function loadBrandSnapshot() {
    const snap = await admin.firestore().doc('marketing_brand/main').get();
    const d = snap.exists ? snap.data() : {};
    return {
        brandName: typeof d?.brandName === 'string' ? d.brandName : 'MaaMitra',
        logoUrl: typeof d?.logoUrl === 'string' ? d.logoUrl : null,
        palette: {
            primary: typeof d?.palette?.primary === 'string' ? d.palette.primary : '#E91E63',
            background: typeof d?.palette?.background === 'string' ? d.palette.background : '#FFF8F2',
            text: typeof d?.palette?.text === 'string' ? d.palette.text : '#1F1F2C',
            accent: typeof d?.palette?.accent === 'string' ? d.palette.accent : '#F8C8DC',
        },
    };
}
function buildRenderUgcAsDraft(allowList) {
    return functions
        .runWith({ memory: '1GB', timeoutSeconds: 120 })
        .https.onCall(async (data, context) => {
        if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
            throw new functions.https.HttpsError('permission-denied', 'Admin only.');
        }
        const submissionId = typeof data?.submissionId === 'string' ? data.submissionId : '';
        if (!submissionId)
            return { ok: false, code: 'missing-id', message: 'submissionId required.' };
        const db = admin.firestore();
        const subRef = db.doc(`ugc_submissions/${submissionId}`);
        const subSnap = await subRef.get();
        if (!subSnap.exists)
            return { ok: false, code: 'no-submission', message: 'Submission not found.' };
        const sub = subSnap.data();
        if (sub?.status !== 'approved') {
            return { ok: false, code: 'not-approved', message: `Submission status is ${sub?.status} — approve it first.` };
        }
        if (sub?.renderedDraftId) {
            return { ok: false, code: 'already-rendered', message: 'This submission already produced a draft.' };
        }
        // Sanitise + cap inputs.
        const story = String(sub?.story ?? '').trim().slice(0, 240);
        const displayName = String(sub?.displayName ?? 'A MaaMitra mom').trim().slice(0, 40) || 'A MaaMitra mom';
        const childAge = sub?.childAge ? String(sub.childAge).trim().slice(0, 20) : '';
        const eyebrow = childAge ? `${displayName.split(' ')[0]}, ${childAge}` : displayName.split(' ')[0];
        const brand = await loadBrandSnapshot();
        // Render via Satori
        let png;
        try {
            const result = await (0, renderer_1.renderTemplate)('realStoryCard', { eyebrow, story, attribution: displayName, photoUrl: sub?.photoUrl ?? undefined }, brand, { width: 1080, height: 1080 });
            png = result.png;
        }
        catch (e) {
            return { ok: false, code: 'render-failed', message: e?.message ?? String(e) };
        }
        // Upload PNG to Storage
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const storagePath = `marketing/drafts/${timestamp}-realStoryCard-${submissionId}.png`;
        const bucket = admin.storage().bucket();
        const file = bucket.file(storagePath);
        try {
            await file.save(png, {
                contentType: 'image/png',
                metadata: { metadata: { template: 'realStoryCard', source: 'ugc', ugcSubmissionId: submissionId } },
            });
            await file.makePublic();
        }
        catch (e) {
            return { ok: false, code: 'upload-failed', message: e?.message ?? String(e) };
        }
        const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
        // Build caption — body = the story; tail with attribution + brand hashtags.
        const brandHashtags = await loadBrandHashtags();
        const caption = [
            `"${story}"`,
            '',
            `— ${displayName}, MaaMitra community`,
            '',
            brandHashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' '),
        ]
            .join('\n')
            .slice(0, 2200);
        // Write draft — status='approved' so admin can publish without
        // re-reviewing (they reviewed the source UGC).
        const draftRef = db.collection('marketing_drafts').doc();
        const today = new Date(Date.now() + 5.5 * 3600 * 1000);
        const weekdayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][today.getUTCDay()];
        await draftRef.set({
            status: 'approved',
            kind: 'image',
            themeKey: weekdayKey,
            themeLabel: 'Real Story (UGC)',
            caption,
            headline: `Real story · ${eyebrow}`,
            assets: [{ url, index: 0, template: 'realStoryCard', storagePath }],
            platforms: ['instagram', 'facebook'],
            scheduledAt: null,
            postedAt: null,
            postPermalinks: {},
            publishError: null,
            safetyFlags: [],
            personaId: null,
            personaLabel: null,
            pillarId: typeof sub?.pillarId === 'string' ? sub.pillarId : 'real_stories',
            pillarLabel: 'Real Stories',
            eventId: null,
            eventLabel: null,
            locale: null,
            imagePrompt: null,
            imageSource: 'ugc',
            costInr: 0,
            boost: null,
            ugcSubmissionId: submissionId,
            generatedAt: admin.firestore.FieldValue.serverTimestamp(),
            generatedBy: context.auth?.token?.email ?? null,
            approvedAt: admin.firestore.FieldValue.serverTimestamp(),
            approvedBy: context.auth?.token?.email ?? null,
            rejectedAt: null,
            rejectedBy: null,
            rejectReason: null,
        });
        // Flip submission status.
        await subRef.update({
            status: 'rendered',
            renderedDraftId: draftRef.id,
        });
        return { ok: true, draftId: draftRef.id, imageUrl: url, caption };
    });
}
async function loadBrandHashtags() {
    try {
        const snap = await admin.firestore().doc('marketing_brand/main').get();
        const d = snap.exists ? snap.data() : {};
        if (Array.isArray(d?.hashtags)) {
            return d.hashtags.filter((h) => typeof h === 'string').slice(0, 8);
        }
    }
    catch { /* fall through */ }
    return ['MaaMitra', 'IndianMoms', 'RealStories'];
}
