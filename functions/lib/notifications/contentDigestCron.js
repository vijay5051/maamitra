"use strict";
// Sundays 10:00 IST: one "New on MaaMitra" push when articles or travel recipes
// were published in the last 7 days. Broadcast gated by the `content` pref.
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
exports.buildContentDigestCron = buildContentDigestCron;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const WEEK_MS = 7 * 86400 * 1000;
function millis(v) {
    return v instanceof admin.firestore.Timestamp ? v.toMillis() : null;
}
const plural = (n, one, many) => `${n} new ${n === 1 ? one : many}`;
function buildContentDigestCron() {
    return functions
        .runWith({ memory: '256MB', timeoutSeconds: 120 })
        .pubsub.schedule('30 4 * * 0') // Sunday 10:00 IST
        .timeZone('UTC')
        .onRun(async () => {
        const db = admin.firestore();
        const cutoff = Date.now() - WEEK_MS;
        // Single-field range query (no composite index needed); status filtered in memory.
        const articleSnap = await db
            .collection('articles')
            .where('createdAt', '>=', admin.firestore.Timestamp.fromMillis(cutoff))
            .get();
        const articles = articleSnap.docs.filter((d) => d.data().status === 'published');
        const travelSnap = await db.collection('travel_recipes').where('status', '==', 'published').get();
        const recipes = travelSnap.docs.filter((d) => {
            const t = millis(d.data().publishedAt) ?? millis(d.data().createdAt);
            return t !== null && t >= cutoff;
        });
        if (articles.length === 0 && recipes.length === 0) {
            console.log('[contentDigestCron] nothing new this week');
            return null;
        }
        const parts = [
            articles.length ? plural(articles.length, 'article', 'articles') : null,
            recipes.length ? plural(recipes.length, 'travel recipe', 'travel recipes') : null,
        ].filter(Boolean);
        const lead = articles[0]?.data().title;
        const body = lead
            ? `“${lead}”${parts.length ? ` and more: ${parts.join(' and ')}.` : ''}`
            : `${parts.join(' and ')} for you this week.`;
        await db.collection('push_queue').add({
            kind: 'broadcast',
            audience: 'all',
            prefKey: 'content',
            title: 'New on MaaMitra this week',
            body,
            pushType: 'content',
            data: { url: articles.length ? '/(tabs)/library' : '/(tabs)/health?tab=travel' },
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[contentDigestCron] queued digest: ${parts.join(', ')}`);
        return null;
    });
}
