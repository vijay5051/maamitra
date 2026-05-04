// Insights polling + weekly digest (M5).
//
// pollMarketingInsights        — pubsub every 6h. For each posted draft
//                                in the last 30d, hits IG Insights API and
//                                stores a snapshot in marketing_drafts/{id}/
//                                insights/{ts}, denormalising the latest
//                                values to the parent draft for fast queries.
//
// pollMarketingAccountInsights — daily at 03:00 IST (= 21:30 UTC). Pulls
//                                follower count + reach for the IG account.
//
// generateWeeklyInsightDigest  — pubsub every Monday 08:00 IST (= 02:30
//                                UTC). LLM commentary on the past week +
//                                3 actionable recommendations stored at
//                                marketing_insights/{weekId}.

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

const META_IG_USER_ID = process.env.META_IG_USER_ID ?? '';
const META_IG_ACCESS_TOKEN = process.env.META_IG_ACCESS_TOKEN ?? '';
const META_FB_PAGE_ACCESS_TOKEN = process.env.META_FB_PAGE_ACCESS_TOKEN ?? '';

// graph.facebook.com IG Insights endpoints need EAA-style tokens — see
// publisher.ts comment for context. Prefer Page token, fall back to IG.
const IG_GRAPH_TOKEN =
  (META_FB_PAGE_ACCESS_TOKEN && META_FB_PAGE_ACCESS_TOKEN.startsWith('EAA'))
    ? META_FB_PAGE_ACCESS_TOKEN
    : META_IG_ACCESS_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

interface PostInsightMetrics {
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  saved: number;
  shares: number;
  profileVisits: number;
}

const ZERO_METRICS: PostInsightMetrics = {
  reach: 0, impressions: 0, likes: 0, comments: 0, saved: 0, shares: 0, profileVisits: 0,
};

// ── Per-post Insights polling ──────────────────────────────────────────────

interface MetricBucket { name: string; values?: { value?: number }[] }

async function fetchPostMetrics(igMediaId: string): Promise<PostInsightMetrics | null> {
  if (!IG_GRAPH_TOKEN) return null;
  const metrics = ['reach', 'impressions', 'likes', 'comments', 'saved', 'shares', 'profile_visits'];
  const url = `${GRAPH_BASE}/${igMediaId}/insights?metric=${metrics.join(',')}&access_token=${encodeURIComponent(IG_GRAPH_TOKEN)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      console.warn(`[pollMarketingInsights] ${igMediaId} ${res.status}:`, body.slice(0, 200));
      return null;
    }
    const data = (await res.json()) as { data?: MetricBucket[] };
    const out = { ...ZERO_METRICS };
    for (const m of data.data ?? []) {
      const v = m.values?.[0]?.value ?? 0;
      switch (m.name) {
        case 'reach':           out.reach = v; break;
        case 'impressions':     out.impressions = v; break;
        case 'likes':           out.likes = v; break;
        case 'comments':        out.comments = v; break;
        case 'saved':           out.saved = v; break;
        case 'shares':          out.shares = v; break;
        case 'profile_visits':  out.profileVisits = v; break;
      }
    }
    return out;
  } catch (e) {
    console.warn(`[pollMarketingInsights] ${igMediaId} fetch threw`, e);
    return null;
  }
}

export function buildPollMarketingInsights() {
  return functions
    .runWith({ memory: '512MB', timeoutSeconds: 540 })
    .pubsub.schedule('every 6 hours')
    .onRun(async () => {
      if (!META_IG_USER_ID || !IG_GRAPH_TOKEN) {
        console.log('[pollMarketingInsights] IG creds missing — skipping cycle');
        return null;
      }
      const db = admin.firestore();
      const cutoffMs = Date.now() - 30 * 24 * 3600 * 1000;
      const cutoffIso = new Date(cutoffMs).toISOString();
      const due = await db
        .collection('marketing_drafts')
        .where('status', '==', 'posted')
        .where('postedAt', '>=', cutoffIso)
        .limit(50)
        .get();
      if (due.empty) {
        console.log('[pollMarketingInsights] no posts in last 30d');
        return null;
      }
      console.log(`[pollMarketingInsights] polling ${due.size} posts`);
      for (const docSnap of due.docs) {
        const data = docSnap.data() as Record<string, any>;
        if (data?.isSynthetic === true) continue;
        // We need the IG media id. After M3b's publish, postPermalinks contains
        // the permalink, but we need the underlying media id. We store it in
        // postIgMediaId after publish; if missing, parse from permalink.
        const mediaId = typeof data?.postIgMediaId === 'string'
          ? data.postIgMediaId
          : extractMediaIdFromPermalink(data?.postPermalinks?.instagram);
        if (!mediaId) continue;

        const metrics = await fetchPostMetrics(mediaId);
        if (!metrics) continue;

        const postedIso = tsAsIso(data?.postedAt) ?? new Date().toISOString();
        const hoursSincePost = Math.max(0, (Date.now() - new Date(postedIso).getTime()) / 3_600_000);

        const snapshotRef = docSnap.ref.collection('insights').doc();
        await snapshotRef.set({
          ...metrics,
          fetchedAt: admin.firestore.FieldValue.serverTimestamp(),
          hoursSincePost: Math.round(hoursSincePost * 10) / 10,
        });
        await docSnap.ref.update({
          latestInsights: metrics,
          latestInsightsAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      return null;
    });
}

function extractMediaIdFromPermalink(permalink: unknown): string | null {
  // IG permalinks look like https://www.instagram.com/p/<shortcode>/
  // We can't derive media id from shortcode without a second API call, so
  // this returns null — the publisher SHOULD store postIgMediaId at publish
  // time. Until that's added, posts published before this runs won't have
  // insights; we'll backfill from the next M3b publish onwards.
  void permalink;
  return null;
}

function tsAsIso(ts: unknown): string | null {
  if (!ts) return null;
  if (typeof (ts as any)?.toDate === 'function') {
    try { return (ts as any).toDate().toISOString(); } catch { return null; }
  }
  if (typeof ts === 'string') return ts;
  return null;
}

// ── Account-level Insights ─────────────────────────────────────────────────

interface AccountMetrics {
  followerCount: number;
  reach: number;
  impressions: number;
}

async function fetchAccountSnapshot(): Promise<AccountMetrics | null> {
  if (!META_IG_USER_ID || !IG_GRAPH_TOKEN) return null;
  try {
    // Follower count is on the user node directly.
    const userRes = await fetch(
      `${GRAPH_BASE}/${META_IG_USER_ID}?fields=followers_count&access_token=${encodeURIComponent(IG_GRAPH_TOKEN)}`,
    );
    if (!userRes.ok) {
      console.warn('[pollMarketingAccountInsights] user node failed', await userRes.text());
      return null;
    }
    const user = (await userRes.json()) as { followers_count?: number };

    // Daily reach + impressions for yesterday.
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
    const insRes = await fetch(
      `${GRAPH_BASE}/${META_IG_USER_ID}/insights?metric=reach,impressions&period=day&since=${yesterday}&until=${yesterday}&access_token=${encodeURIComponent(IG_GRAPH_TOKEN)}`,
    );
    let reach = 0;
    let impressions = 0;
    if (insRes.ok) {
      const ins = (await insRes.json()) as { data?: MetricBucket[] };
      for (const m of ins.data ?? []) {
        const v = m.values?.[0]?.value ?? 0;
        if (m.name === 'reach') reach = v;
        if (m.name === 'impressions') impressions = v;
      }
    }
    return {
      followerCount: user.followers_count ?? 0,
      reach,
      impressions,
    };
  } catch (e) {
    console.warn('[pollMarketingAccountInsights] threw', e);
    return null;
  }
}

export function buildPollMarketingAccountInsights() {
  return functions
    .runWith({ memory: '256MB', timeoutSeconds: 60 })
    .pubsub.schedule('30 21 * * *')
    .timeZone('UTC')
    .onRun(async () => {
      const snap = await fetchAccountSnapshot();
      if (!snap) {
        console.log('[pollMarketingAccountInsights] no snapshot');
        return null;
      }
      const db = admin.firestore();
      const today = new Date().toISOString().slice(0, 10);
      const docRef = db.doc(`marketing_account_insights/${today}`);

      // Compute daily delta vs yesterday.
      const yesterdayId = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
      const yesterdayDoc = await db.doc(`marketing_account_insights/${yesterdayId}`).get();
      const yesterdayFollowers = yesterdayDoc.exists ? (yesterdayDoc.data() as any)?.followerCount ?? 0 : snap.followerCount;
      const followersDelta = snap.followerCount - yesterdayFollowers;

      await docRef.set({
        date: today,
        followerCount: snap.followerCount,
        reach: snap.reach,
        impressions: snap.impressions,
        followersDelta,
        fetchedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`[pollMarketingAccountInsights] ${today} followers=${snap.followerCount} reach=${snap.reach}`);
      return null;
    });
}

// ── Weekly insight digest ──────────────────────────────────────────────────

interface DigestPostRow {
  draftId: string;
  headline: string;
  pillarLabel: string;
  personaLabel: string;
  reach: number;
  engagement: number;
  engagementRate: number;
}

export function buildGenerateWeeklyInsightDigest() {
  return functions
    .runWith({ memory: '512MB', timeoutSeconds: 120 })
    .pubsub.schedule('30 2 * * 1')   // Mondays 02:30 UTC = 08:00 IST
    .timeZone('UTC')
    .onRun(async () => {
      if (!OPENAI_API_KEY) {
        console.warn('[generateWeeklyInsightDigest] OPENAI_API_KEY not set');
        return null;
      }
      const db = admin.firestore();
      const now = new Date();
      const startMs = Date.now() - 7 * 24 * 3600 * 1000;
      const startIso = new Date(startMs).toISOString();
      const endIso = now.toISOString();

      const snap = await db
        .collection('marketing_drafts')
        .where('status', '==', 'posted')
        .where('postedAt', '>=', startIso)
        .where('postedAt', '<=', endIso)
        .get();

      if (snap.empty) {
        console.log('[generateWeeklyInsightDigest] no posts in window');
        return null;
      }

      const rows: DigestPostRow[] = [];
      for (const d of snap.docs) {
        const data = d.data() as any;
        if (data?.isSynthetic === true) continue;
        const m = data?.latestInsights ?? {};
        const reach = m?.reach ?? 0;
        const engagement = (m?.likes ?? 0) + (m?.comments ?? 0) + (m?.shares ?? 0) + (m?.saved ?? 0);
        rows.push({
          draftId: d.id,
          headline: typeof data?.headline === 'string' ? data.headline : '',
          pillarLabel: typeof data?.pillarLabel === 'string' ? data.pillarLabel : '',
          personaLabel: typeof data?.personaLabel === 'string' ? data.personaLabel : '',
          reach,
          engagement,
          engagementRate: reach > 0 ? engagement / reach : 0,
        });
      }
      if (rows.length === 0) {
        console.log('[generateWeeklyInsightDigest] no non-synthetic posts');
        return null;
      }

      const totalReach = rows.reduce((a, r) => a + r.reach, 0);
      const totalImpressions = totalReach; // approx; impressions denormalised similarly
      const avgEngagementRate = rows.reduce((a, r) => a + r.engagementRate, 0) / rows.length;
      const top = [...rows].sort((a, b) => b.engagementRate - a.engagementRate).slice(0, 3);
      const bot = [...rows].sort((a, b) => a.engagementRate - b.engagementRate).slice(0, 3);

      // LLM commentary
      const prompt = [
        'You are an analyst for an Indian motherhood platform\'s social media.',
        'Generate a short, candid weekly recap.',
        '',
        `Posts published this week: ${rows.length}.`,
        `Total reach: ${totalReach}. Avg engagement rate: ${(avgEngagementRate * 100).toFixed(2)}%.`,
        '',
        'Top performers:',
        ...top.map((r) => `- "${r.headline}" [${r.pillarLabel} / ${r.personaLabel}]: reach ${r.reach}, ER ${(r.engagementRate * 100).toFixed(1)}%`),
        '',
        'Bottom performers:',
        ...bot.map((r) => `- "${r.headline}" [${r.pillarLabel} / ${r.personaLabel}]: reach ${r.reach}, ER ${(r.engagementRate * 100).toFixed(1)}%`),
        '',
        'Output STRICT JSON only:',
        '{',
        '  "commentary": "2-3 paragraph weekly recap — what worked, what didn\'t, why",',
        '  "recommendations": ["3 specific actionable changes for next week"]',
        '}',
      ].join('\n');

      let commentary = '';
      let recommendations: string[] = [];
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.5,
            max_tokens: 800,
          }),
        });
        if (res.ok) {
          const out = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          const parsed = JSON.parse(out?.choices?.[0]?.message?.content ?? '{}');
          commentary = typeof parsed?.commentary === 'string' ? parsed.commentary : '';
          recommendations = Array.isArray(parsed?.recommendations)
            ? parsed.recommendations.filter((r: unknown): r is string => typeof r === 'string').slice(0, 5)
            : [];
        }
      } catch (e) {
        console.warn('[generateWeeklyInsightDigest] LLM threw', e);
      }

      const weekId = isoWeekId(now);
      const weekStart = new Date(startMs).toISOString().slice(0, 10);
      const weekEnd = now.toISOString().slice(0, 10);

      await db.doc(`marketing_insights/${weekId}`).set({
        weekId,
        weekStart,
        weekEnd,
        postsPublished: rows.length,
        totalReach,
        totalImpressions,
        avgEngagementRate,
        commentary,
        topPosts: top.map((r) => ({ draftId: r.draftId, headline: r.headline, engagementRate: r.engagementRate })),
        recommendations,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`[generateWeeklyInsightDigest] ${weekId} written, ${rows.length} posts analysed`);
      return null;
    });
}

function isoWeekId(d: Date): string {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
