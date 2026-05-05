"use strict";
// Library AI — unified daily cron + stale-content expiry.
//
// One pubsub schedule fires every day at 06:30 IST. It checks per-kind
// settings: if today is a fire-day for that kind, it kicks off `perRun`
// generations. Failures are logged but never re-thrown so one failed
// kind doesn't poison the others.
//
// A second pubsub schedule runs at 03:00 IST: walks every AI-generated
// item in articles/books/products whose expiresAt is past, and flips
// status to 'archived' so the Library hides it without losing history.
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
exports.buildDailyLibraryAiCron = buildDailyLibraryAiCron;
exports.buildExpireStaleLibrary = buildExpireStaleLibrary;
exports.buildArchiveLibraryItem = buildArchiveLibraryItem;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const articles_1 = require("./articles");
const books_1 = require("./books");
const products_1 = require("./products");
const settings_1 = require("./settings");
// ── Daily generation cron ───────────────────────────────────────────────────
// 06:30 IST = 01:00 UTC
function buildDailyLibraryAiCron() {
    return functions
        .runWith({ memory: '1GB', timeoutSeconds: 540 })
        .pubsub.schedule('0 1 * * *')
        .timeZone('UTC')
        .onRun(async () => {
        const settings = await (0, settings_1.loadLibraryAiSettings)();
        if (settings.paused) {
            console.log('[libraryAi.cron] globally paused — skipping');
            return null;
        }
        const today = (0, settings_1.nowInIst)();
        const summary = { weekday: today.weekday, isoDate: today.isoDate };
        // Articles
        if (settings.articles.enabled && (0, settings_1.shouldFireToday)(settings.articles.frequency, today)) {
            const n = settings.articles.perRun;
            summary.articles = { attempted: n, ok: 0, errors: [] };
            for (let i = 0; i < n; i++) {
                try {
                    const r = await (0, articles_1.runArticleGenerator)({}, null);
                    if (r.ok)
                        summary.articles.ok += 1;
                    else
                        summary.articles.errors.push(`${r.code}: ${r.message}`);
                }
                catch (e) {
                    summary.articles.errors.push(e?.message ?? String(e));
                }
            }
        }
        else {
            summary.articles = 'skipped';
        }
        // Books
        if (settings.books.enabled && (0, settings_1.shouldFireToday)(settings.books.frequency, today)) {
            summary.books = { attempted: 1, ok: 0, errors: [] };
            try {
                const r = await (0, books_1.runBookGenerator)({}, null);
                if (r.ok)
                    summary.books.ok = r.inserted.length;
                else
                    summary.books.errors.push(`${r.code}: ${r.message}`);
            }
            catch (e) {
                summary.books.errors.push(e?.message ?? String(e));
            }
        }
        else {
            summary.books = 'skipped';
        }
        // Products
        if (settings.products.enabled && (0, settings_1.shouldFireToday)(settings.products.frequency, today)) {
            summary.products = { attempted: 1, ok: 0, errors: [] };
            try {
                const r = await (0, products_1.runProductGenerator)({}, null);
                if (r.ok)
                    summary.products.ok = r.inserted.length;
                else
                    summary.products.errors.push(`${r.code}: ${r.message}`);
            }
            catch (e) {
                summary.products.errors.push(e?.message ?? String(e));
            }
        }
        else {
            summary.products = 'skipped';
        }
        try {
            await admin.firestore().collection('library_ai_runs').add({
                ...summary,
                ts: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        catch (e) {
            console.warn('[libraryAi.cron] runs log write failed', e);
        }
        console.log('[libraryAi.cron] done', JSON.stringify(summary));
        return null;
    });
}
// ── Stale-content expiry ────────────────────────────────────────────────────
// 03:00 IST = 21:30 UTC previous day
function buildExpireStaleLibrary() {
    return functions
        .runWith({ memory: '512MB', timeoutSeconds: 540 })
        .pubsub.schedule('30 21 * * *')
        .timeZone('UTC')
        .onRun(async () => {
        const db = admin.firestore();
        const now = admin.firestore.Timestamp.now();
        const collections = ['articles', 'books', 'products'];
        const out = {};
        for (const col of collections) {
            let archived = 0;
            try {
                const snap = await db.collection(col)
                    .where('source', '==', 'ai')
                    .where('status', '==', 'published')
                    .where('expiresAt', '<=', now)
                    .limit(200)
                    .get();
                if (!snap.empty) {
                    const batch = db.batch();
                    snap.docs.forEach((d) => {
                        batch.update(d.ref, {
                            status: 'archived',
                            archivedAt: admin.firestore.FieldValue.serverTimestamp(),
                            archivedReason: 'stale-ai-content',
                        });
                        archived += 1;
                    });
                    await batch.commit();
                }
            }
            catch (e) {
                console.warn(`[libraryAi.expire] ${col} sweep failed`, e);
            }
            out[col] = archived;
        }
        try {
            await db.collection('library_ai_runs').add({
                kind: 'expire',
                summary: out,
                ts: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        catch { /* non-fatal */ }
        console.log('[libraryAi.expire] archived', JSON.stringify(out));
        return null;
    });
}
// ── Admin-callable: archive a single AI item on demand ──────────────────────
// Used by the admin page's "Remove" button on a generation row. We don't
// hard-delete so admin can audit history.
function buildArchiveLibraryItem(allowList) {
    return functions
        .runWith({ memory: '256MB', timeoutSeconds: 30 })
        .https.onCall(async (data, context) => {
        const token = context.auth?.token;
        const isAdmin = !!token?.admin
            || (token?.email_verified && token.email && allowList.has(token.email.toLowerCase()))
            || await (async () => {
                if (!token?.uid)
                    return false;
                try {
                    const snap = await admin.firestore().doc(`users/${token.uid}`).get();
                    const role = snap.exists ? snap.data()?.adminRole : null;
                    return role === 'super' || role === 'content';
                }
                catch {
                    return false;
                }
            })();
        if (!isAdmin) {
            throw new functions.https.HttpsError('permission-denied', 'Only content admins can archive library items.');
        }
        const kind = String(data?.kind ?? '');
        const id = String(data?.id ?? '');
        if (!['articles', 'books', 'products'].includes(kind) || !id) {
            throw new functions.https.HttpsError('invalid-argument', 'Provide kind in {articles,books,products} and an id.');
        }
        await admin.firestore().doc(`${kind}/${id}`).update({
            status: 'archived',
            archivedAt: admin.firestore.FieldValue.serverTimestamp(),
            archivedReason: 'admin-manual',
            archivedBy: token?.email ?? token?.uid ?? null,
        });
        return { ok: true };
    });
}
