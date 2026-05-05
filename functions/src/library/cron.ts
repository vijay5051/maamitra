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

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

import { runArticleGenerator } from './articles';
import { runBookGenerator } from './books';
import { runProductGenerator } from './products';
import { loadLibraryAiSettings, nowInIst, shouldFireToday } from './settings';

// ── Daily generation cron ───────────────────────────────────────────────────
// 06:30 IST = 01:00 UTC
export function buildDailyLibraryAiCron() {
  return functions
    .runWith({ memory: '1GB', timeoutSeconds: 540 })
    .pubsub.schedule('0 1 * * *')
    .timeZone('UTC')
    .onRun(async () => {
      const settings = await loadLibraryAiSettings();
      if (settings.paused) {
        console.log('[libraryAi.cron] globally paused — skipping');
        return null;
      }
      const today = nowInIst();

      const summary: Record<string, any> = { weekday: today.weekday, isoDate: today.isoDate };

      // Articles
      if (settings.articles.enabled && shouldFireToday(settings.articles.frequency, today)) {
        const n = settings.articles.perRun;
        summary.articles = { attempted: n, ok: 0, errors: [] as string[] };
        for (let i = 0; i < n; i++) {
          try {
            const r = await runArticleGenerator({}, null);
            if (r.ok) summary.articles.ok += 1;
            else summary.articles.errors.push(`${r.code}: ${r.message}`);
          } catch (e: any) {
            summary.articles.errors.push(e?.message ?? String(e));
          }
        }
      } else {
        summary.articles = 'skipped';
      }

      // Books
      if (settings.books.enabled && shouldFireToday(settings.books.frequency, today)) {
        summary.books = { attempted: 1, ok: 0, errors: [] as string[] };
        try {
          const r = await runBookGenerator({}, null);
          if (r.ok) summary.books.ok = r.inserted.length;
          else summary.books.errors.push(`${r.code}: ${r.message}`);
        } catch (e: any) {
          summary.books.errors.push(e?.message ?? String(e));
        }
      } else {
        summary.books = 'skipped';
      }

      // Products
      if (settings.products.enabled && shouldFireToday(settings.products.frequency, today)) {
        summary.products = { attempted: 1, ok: 0, errors: [] as string[] };
        try {
          const r = await runProductGenerator({}, null);
          if (r.ok) summary.products.ok = r.inserted.length;
          else summary.products.errors.push(`${r.code}: ${r.message}`);
        } catch (e: any) {
          summary.products.errors.push(e?.message ?? String(e));
        }
      } else {
        summary.products = 'skipped';
      }

      try {
        await admin.firestore().collection('library_ai_runs').add({
          ...summary,
          ts: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (e) {
        console.warn('[libraryAi.cron] runs log write failed', e);
      }

      console.log('[libraryAi.cron] done', JSON.stringify(summary));
      return null;
    });
}

// ── Stale-content expiry ────────────────────────────────────────────────────
// 03:00 IST = 21:30 UTC previous day
export function buildExpireStaleLibrary() {
  return functions
    .runWith({ memory: '512MB', timeoutSeconds: 540 })
    .pubsub.schedule('30 21 * * *')
    .timeZone('UTC')
    .onRun(async () => {
      const db = admin.firestore();
      const now = admin.firestore.Timestamp.now();
      const collections = ['articles', 'books', 'products'];
      const out: Record<string, number> = {};
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
        } catch (e) {
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
      } catch { /* non-fatal */ }
      console.log('[libraryAi.expire] archived', JSON.stringify(out));
      return null;
    });
}

// ── Admin-callable: archive a single AI item on demand ──────────────────────
// Used by the admin page's "Remove" button on a generation row. We don't
// hard-delete so admin can audit history.
export function buildArchiveLibraryItem(allowList: ReadonlySet<string>) {
  return functions
    .runWith({ memory: '256MB', timeoutSeconds: 30 })
    .https.onCall(async (data: { kind?: string; id?: string }, context) => {
      const token = context.auth?.token;
      const isAdmin = !!token?.admin
        || (token?.email_verified && token.email && allowList.has(token.email.toLowerCase()))
        || await (async () => {
          if (!token?.uid) return false;
          try {
            const snap = await admin.firestore().doc(`users/${token.uid}`).get();
            const role = snap.exists ? (snap.data() as any)?.adminRole : null;
            return role === 'super' || role === 'content';
          } catch {
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
