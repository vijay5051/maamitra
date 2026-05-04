// Analytics queries for the M5 dashboard.
//
// All reads come from Firestore — the actual fetch from IG Insights
// happens server-side in pollMarketingInsights. This service just
// projects + summarises what's already in marketing_drafts +
// marketing_account_insights + marketing_insights for the dashboard.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';

import {
  AccountInsightDay,
  PostInsightMetrics,
  PostInsightSnapshot,
  WeeklyDigest,
} from '../lib/marketingTypes';
import { db } from './firebase';

// ── Per-post insights ──────────────────────────────────────────────────────

export interface PostWithMetrics {
  draftId: string;
  headline: string | null;
  thumbnail: string | null;
  pillarId: string | null;
  pillarLabel: string | null;
  personaId: string | null;
  personaLabel: string | null;
  postedAt: string | null;
  permalink: string | null;
  /** Combined IG + FB metrics (sum). Null if neither platform has data yet. */
  metrics: PostInsightMetrics | null;
  /** Per-platform breakdown. Either may be null if that platform wasn't published or hasn't polled yet. */
  igMetrics: PostInsightMetrics | null;
  fbMetrics: PostInsightMetrics | null;
  /** likes + comments + shares + saved, divided by reach. 0 if no metrics yet. */
  engagementRate: number;
  costInr: number;
}

export async function fetchPostsWithMetrics(opts: { withinDays?: number; limitN?: number } = {}): Promise<PostWithMetrics[]> {
  if (!db) return [];
  const { withinDays = 30, limitN = 100 } = opts;
  const cutoff = new Date(Date.now() - withinDays * 24 * 3600 * 1000).toISOString();
  try {
    const q = query(
      collection(db, 'marketing_drafts'),
      where('status', '==', 'posted'),
      orderBy('postedAt', 'desc'),
      limit(Math.min(limitN, 200)),
    );
    const snap = await getDocs(q);
    const rows: PostWithMetrics[] = [];
    for (const d of snap.docs) {
      const data = d.data() as any;
      const postedIso = tsToIso(data?.postedAt);
      if (postedIso && postedIso < cutoff) continue;
      const ig = normaliseMetrics(data?.latestInsights);
      const fb = normaliseMetrics(data?.latestFbInsights);
      const combined = combineMetrics(ig, fb);
      const reach = combined?.reach ?? 0;
      const engagement = combined ? (combined.likes + combined.comments + combined.shares + combined.saved) : 0;
      const engagementRate = reach > 0 ? engagement / reach : 0;
      rows.push({
        draftId: d.id,
        headline: typeof data?.headline === 'string' ? data.headline : null,
        thumbnail: data?.assets?.[0]?.url ?? null,
        pillarId: typeof data?.pillarId === 'string' ? data.pillarId : null,
        pillarLabel: typeof data?.pillarLabel === 'string' ? data.pillarLabel : null,
        personaId: typeof data?.personaId === 'string' ? data.personaId : null,
        personaLabel: typeof data?.personaLabel === 'string' ? data.personaLabel : null,
        postedAt: postedIso,
        permalink: data?.postPermalinks?.instagram ?? data?.postPermalinks?.facebook ?? null,
        metrics: combined,
        igMetrics: ig,
        fbMetrics: fb,
        engagementRate,
        costInr: typeof data?.costInr === 'number' ? data.costInr : 0,
      });
    }
    return rows;
  } catch {
    return [];
  }
}

export async function fetchPostInsightTimeline(draftId: string): Promise<PostInsightSnapshot[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(
      query(
        collection(db, 'marketing_drafts', draftId, 'insights'),
        orderBy('fetchedAt', 'asc'),
        limit(40),
      ),
    );
    return snap.docs.map((d) => {
      const x = d.data() as any;
      return {
        reach: x?.reach ?? 0,
        impressions: x?.impressions ?? 0,
        likes: x?.likes ?? 0,
        comments: x?.comments ?? 0,
        saved: x?.saved ?? 0,
        shares: x?.shares ?? 0,
        profileVisits: x?.profileVisits ?? 0,
        fetchedAt: tsToIso(x?.fetchedAt) ?? new Date().toISOString(),
        hoursSincePost: typeof x?.hoursSincePost === 'number' ? x.hoursSincePost : 0,
      };
    });
  } catch {
    return [];
  }
}

// ── Account-level (followers, reach) ───────────────────────────────────────

export async function fetchAccountInsights(daysBack = 30): Promise<AccountInsightDay[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(
      query(
        collection(db, 'marketing_account_insights'),
        orderBy('date', 'desc'),
        limit(Math.min(daysBack, 90)),
      ),
    );
    return snap.docs.map((d) => {
      const x = d.data() as any;
      return {
        date: typeof x?.date === 'string' ? x.date : d.id,
        followerCount: x?.followerCount ?? 0,
        reach: x?.reach ?? 0,
        impressions: x?.impressions ?? 0,
        followersDelta: x?.followersDelta ?? 0,
        // M4c — present when FB Page configured. Spread so older docs without
        // these fields stay undefined (the dashboard renders "—" for undefined).
        ...(typeof x?.fbFanCount === 'number' ? { fbFanCount: x.fbFanCount } : {}),
        ...(typeof x?.fbReach === 'number' ? { fbReach: x.fbReach } : {}),
        ...(typeof x?.fbImpressions === 'number' ? { fbImpressions: x.fbImpressions } : {}),
        ...(typeof x?.fbFansDelta === 'number' ? { fbFansDelta: x.fbFansDelta } : {}),
      };
    }).reverse(); // oldest first for charting
  } catch {
    return [];
  }
}

// ── Weekly digest ──────────────────────────────────────────────────────────

export async function fetchLatestWeeklyDigest(): Promise<WeeklyDigest | null> {
  if (!db) return null;
  try {
    const snap = await getDocs(
      query(collection(db, 'marketing_insights'), orderBy('weekId', 'desc'), limit(1)),
    );
    if (snap.empty) return null;
    const d = snap.docs[0];
    const x = d.data() as any;
    return {
      weekId: typeof x?.weekId === 'string' ? x.weekId : d.id,
      weekStart: typeof x?.weekStart === 'string' ? x.weekStart : '',
      weekEnd: typeof x?.weekEnd === 'string' ? x.weekEnd : '',
      postsPublished: x?.postsPublished ?? 0,
      totalReach: x?.totalReach ?? 0,
      totalImpressions: x?.totalImpressions ?? 0,
      avgEngagementRate: x?.avgEngagementRate ?? 0,
      commentary: typeof x?.commentary === 'string' ? x.commentary : '',
      topPosts: Array.isArray(x?.topPosts) ? x.topPosts : [],
      recommendations: Array.isArray(x?.recommendations) ? x.recommendations : [],
      generatedAt: tsToIso(x?.generatedAt) ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function fetchDigest(weekId: string): Promise<WeeklyDigest | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'marketing_insights', weekId));
    if (!snap.exists()) return null;
    const x = snap.data() as any;
    return {
      weekId: typeof x?.weekId === 'string' ? x.weekId : weekId,
      weekStart: typeof x?.weekStart === 'string' ? x.weekStart : '',
      weekEnd: typeof x?.weekEnd === 'string' ? x.weekEnd : '',
      postsPublished: x?.postsPublished ?? 0,
      totalReach: x?.totalReach ?? 0,
      totalImpressions: x?.totalImpressions ?? 0,
      avgEngagementRate: x?.avgEngagementRate ?? 0,
      commentary: typeof x?.commentary === 'string' ? x.commentary : '',
      topPosts: Array.isArray(x?.topPosts) ? x.topPosts : [],
      recommendations: Array.isArray(x?.recommendations) ? x.recommendations : [],
      generatedAt: tsToIso(x?.generatedAt) ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// ── Aggregations for dashboard tiles ───────────────────────────────────────

export interface AggregateBucket {
  key: string;
  label: string;
  posts: number;
  totalReach: number;
  avgEngagementRate: number;
  totalCostInr: number;
}

export function aggregateByPillar(posts: PostWithMetrics[]): AggregateBucket[] {
  return aggregateBy(posts, (p) => ({ key: p.pillarId ?? 'unknown', label: p.pillarLabel ?? '—' }));
}

export function aggregateByPersona(posts: PostWithMetrics[]): AggregateBucket[] {
  return aggregateBy(posts, (p) => ({ key: p.personaId ?? 'unknown', label: p.personaLabel ?? '—' }));
}

function aggregateBy(
  posts: PostWithMetrics[],
  pick: (p: PostWithMetrics) => { key: string; label: string },
): AggregateBucket[] {
  const map = new Map<string, AggregateBucket>();
  for (const p of posts) {
    const { key, label } = pick(p);
    const b = map.get(key) ?? { key, label, posts: 0, totalReach: 0, avgEngagementRate: 0, totalCostInr: 0 };
    b.posts += 1;
    b.totalReach += p.metrics?.reach ?? 0;
    b.avgEngagementRate += p.engagementRate;
    b.totalCostInr += p.costInr;
    map.set(key, b);
  }
  return Array.from(map.values())
    .map((b) => ({ ...b, avgEngagementRate: b.posts ? b.avgEngagementRate / b.posts : 0 }))
    .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate);
}

export interface AnalyticsTopline {
  postsPublished7d: number;
  postsPublished30d: number;
  /** Combined IG + FB reach. */
  totalReach7d: number;
  totalReach30d: number;
  avgEngagementRate7d: number;
  avgEngagementRate30d: number;
  totalCostInr30d: number;
  costPerEngagement: number;
  /** IG followers. */
  followerCount: number | null;
  followerDelta7d: number | null;
  /** FB Page fans (M4c). null when FB unconfigured / no snapshot yet. */
  fbFanCount: number | null;
  fbFanDelta7d: number | null;
}

export function buildTopline(posts: PostWithMetrics[], account: AccountInsightDay[]): AnalyticsTopline {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const recent = posts.filter((p) => p.postedAt && p.postedAt >= sevenDaysAgo);
  const totalEngagements30d = posts.reduce((acc, p) => {
    const m = p.metrics;
    return acc + (m ? (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saved ?? 0) : 0);
  }, 0);
  const totalReach30d = posts.reduce((acc, p) => acc + (p.metrics?.reach ?? 0), 0);
  const totalReach7d = recent.reduce((acc, p) => acc + (p.metrics?.reach ?? 0), 0);
  const totalCost30d = posts.reduce((acc, p) => acc + p.costInr, 0);
  const avgRate30 = posts.length ? posts.reduce((a, p) => a + p.engagementRate, 0) / posts.length : 0;
  const avgRate7 = recent.length ? recent.reduce((a, p) => a + p.engagementRate, 0) / recent.length : 0;
  const latest = account[account.length - 1] ?? null;
  const oneWeekAgo = account[Math.max(0, account.length - 8)] ?? null;
  const fbLatest = latest?.fbFanCount;
  const fbWeekAgo = oneWeekAgo?.fbFanCount;
  return {
    postsPublished7d: recent.length,
    postsPublished30d: posts.length,
    totalReach7d,
    totalReach30d,
    avgEngagementRate7d: avgRate7,
    avgEngagementRate30d: avgRate30,
    totalCostInr30d: totalCost30d,
    costPerEngagement: totalEngagements30d > 0 ? totalCost30d / totalEngagements30d : 0,
    followerCount: latest?.followerCount ?? null,
    followerDelta7d: latest && oneWeekAgo ? latest.followerCount - oneWeekAgo.followerCount : null,
    fbFanCount: typeof fbLatest === 'number' ? fbLatest : null,
    fbFanDelta7d: typeof fbLatest === 'number' && typeof fbWeekAgo === 'number' ? fbLatest - fbWeekAgo : null,
  };
}

// ── Per-platform metric helpers (M4c) ──────────────────────────────────────

function normaliseMetrics(raw: any): PostInsightMetrics | null {
  if (!raw || typeof raw !== 'object') return null;
  const present =
    typeof raw.reach === 'number' ||
    typeof raw.impressions === 'number' ||
    typeof raw.likes === 'number' ||
    typeof raw.comments === 'number';
  if (!present) return null;
  return {
    reach: raw.reach ?? 0,
    impressions: raw.impressions ?? 0,
    likes: raw.likes ?? 0,
    comments: raw.comments ?? 0,
    saved: raw.saved ?? 0,
    shares: raw.shares ?? 0,
    profileVisits: raw.profileVisits ?? 0,
  };
}

function combineMetrics(a: PostInsightMetrics | null, b: PostInsightMetrics | null): PostInsightMetrics | null {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  return {
    reach: a.reach + b.reach,
    impressions: a.impressions + b.impressions,
    likes: a.likes + b.likes,
    comments: a.comments + b.comments,
    saved: a.saved + b.saved,
    shares: a.shares + b.shares,
    profileVisits: a.profileVisits + b.profileVisits,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function tsToIso(ts: unknown): string | null {
  if (!ts) return null;
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  if (typeof (ts as any)?.toDate === 'function') {
    try { return (ts as any).toDate().toISOString(); } catch { return null; }
  }
  if (typeof ts === 'string') return ts;
  return null;
}
