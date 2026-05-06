"use strict";
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
exports.buildSyncArticleSocialDraft = buildSyncArticleSocialDraft;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
function asString(v) {
    return typeof v === 'string' ? v.trim() : '';
}
function isPublishedArticle(data) {
    return !!data && asString(data.status) === 'published';
}
function becamePublished(before, after) {
    return isPublishedArticle(after) && (!before || asString(before.status) !== 'published');
}
function buildArticleLink(articleId, article) {
    const external = asString(article.url);
    if (/^https?:\/\//i.test(external))
        return external;
    const sp = new URLSearchParams({ tab: 'read', articleId });
    return `https://maamitra.co.in/library?${sp.toString()}`;
}
function buildSummary(article) {
    const preview = asString(article.preview);
    if (preview)
        return preview.slice(0, 260);
    const body = asString(article.body)
        .replace(/\s+/g, ' ')
        .replace(/\s*\n\s*/g, ' ')
        .trim();
    if (!body)
        return '';
    return body.slice(0, 240).replace(/\s+\S*$/, '').trim() + '…';
}
function extractHashtags(topic) {
    const cleaned = topic
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .slice(0, 3)
        .map((part) => `#${part.charAt(0).toUpperCase()}${part.slice(1)}`);
    const seed = ['#MaaMitra', '#ParentingTips', '#IndianMoms'];
    return Array.from(new Set([...cleaned, ...seed])).slice(0, 6);
}
async function loadBrandHashtags() {
    try {
        const snap = await admin.firestore().doc('marketing_brand/main').get();
        const raw = snap.exists ? snap.data()?.hashtags : [];
        return Array.isArray(raw)
            ? raw.filter((v) => typeof v === 'string' && v.trim().length > 0).slice(0, 6)
            : [];
    }
    catch (e) {
        console.warn('[library/socialDrafts] brand hashtag load failed', e);
        return [];
    }
}
async function upsertMarketingDraft(articleId, article) {
    const title = asString(article.title);
    const imageUrl = asString(article.imageUrl);
    if (!title || !imageUrl) {
        console.warn(`[library/socialDrafts] skip ${articleId}: missing title or image`);
        return;
    }
    const topic = asString(article.topic);
    const link = buildArticleLink(articleId, article);
    const summary = buildSummary(article);
    const brandTags = await loadBrandHashtags();
    const hashtags = brandTags.length ? brandTags : extractHashtags(topic || title);
    const captionParts = [
        title,
        summary,
        `Read the full article: ${link}`,
        hashtags.join(' '),
    ].filter(Boolean);
    const caption = captionParts.join('\n\n').slice(0, 2200);
    const draftId = `library-article-${articleId}`;
    await admin.firestore().collection('marketing_drafts').doc(draftId).set({
        status: 'pending_review',
        kind: 'image',
        themeKey: 'studio',
        themeLabel: 'Library Article',
        caption,
        headline: title.slice(0, 80),
        assets: [{
                url: imageUrl,
                index: 0,
                template: 'libraryArticle',
                storagePath: '',
            }],
        platforms: ['instagram', 'facebook'],
        scheduledAt: null,
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
        locale: 'english_only',
        imagePrompt: `Library article promo for: ${title}`,
        imageSource: 'library-article',
        costInr: 0,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        generatedBy: 'library-article-sync',
        approvedAt: null,
        approvedBy: null,
        rejectedAt: null,
        rejectedBy: null,
        rejectReason: null,
        schemaVersion: 2,
        sourceTool: 'library-article-sync',
        sourceArticleId: articleId,
        sourceArticleTitle: title,
        linkUrl: link,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await admin.firestore().doc(`articles/${articleId}`).set({
        socialDraftId: draftId,
        socialDraftUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}
function buildSyncArticleSocialDraft() {
    return functions
        .runWith({ memory: '256MB', timeoutSeconds: 60 })
        .firestore.document('articles/{articleId}')
        .onWrite(async (change, context) => {
        const before = change.before.exists ? change.before.data() : null;
        const after = change.after.exists ? change.after.data() : null;
        if (!after || !isPublishedArticle(after))
            return;
        if (!becamePublished(before, after))
            return;
        try {
            await upsertMarketingDraft(context.params.articleId, after);
        }
        catch (e) {
            console.error('[library/socialDrafts] sync failed', context.params.articleId, e);
        }
    });
}
