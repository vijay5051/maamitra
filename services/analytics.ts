// Admin analytics — computes aggregate snapshots of the user base from
// Firestore for the admin dashboard. Everything here is read-only and safe
// to run from the client under the admin security rule.
//
// We intentionally derive metrics from the same `users/{uid}` docs the app
// already writes to (via saveFullProfile) rather than maintaining a parallel
// analytics collection. That keeps the data fresh and avoids double-writes,
// at the cost of a full-users read each time the dashboard loads. With an
// admin allow-list of a handful of people this is fine; if the user base
// crosses ~10k we should move to scheduled summary docs.

import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FeatureAdoption {
  /** Display name for the feature (e.g. "Growth tracking"). */
  label: string;
  /** Count of users who have used it at least once. */
  users: number;
  /** Percentage of the active user base (0-100). */
  pct: number;
  /** Icon name for the row. */
  icon: string;
  /** The tab / section this rolls up to — handy for grouping in the UI. */
  group: 'health' | 'community' | 'wellness' | 'chat' | 'library';
}

export interface SignupTrendPoint {
  /** ISO YYYY-MM-DD — the day bucket. */
  day: string;
  /** Number of accounts created on that day (users.createdAt). */
  count: number;
}

export interface VigilanceSummary {
  /** Community posts not yet approved. */
  pendingPosts: number;
  /** Community posts reported by users (if reports exist on doc). */
  reportedPosts: number;
  /** Users with at least one block against them. */
  reportedUsers: number;
  /** Support tickets with status === 'open'. */
  openTickets: number;
}

export interface AnalyticsSnapshot {
  totalUsers: number;
  onboardingComplete: number;
  newSignups7d: number;
  newSignups30d: number;
  /** Distinct users who opened the app in the last 24h — approximated by
   *  `updatedAt` on the users doc, since we write it on every profile
   *  hydrate and most interactions. */
  activeToday: number;
  /** Same measure, 7-day window. */
  activeThisWeek: number;
  /** Newest accounts first — capped at 8. */
  recentSignups: Array<{
    uid: string;
    name: string;
    email: string;
    createdAt: string | null;
    state?: string;
    parentGender?: string;
  }>;
  /** Percentage of users with a photoUrl set — rough proxy for profile depth. */
  photoSetPct: number;
  featureAdoption: FeatureAdoption[];
  signupTrend: SignupTrendPoint[];
  vigilance: VigilanceSummary;
  /** Top 5 kid-state distribution (for a crude geo view). */
  topStates: Array<{ state: string; count: number }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function asMillis(v: any): number | null {
  if (!v) return null;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return isNaN(t) ? null : t;
  }
  if (v instanceof Date) return v.getTime();
  if (typeof v?.toDate === 'function') return v.toDate().getTime();
  if (v?.seconds) return v.seconds * 1000;
  return null;
}

function dayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isNonEmpty(v: unknown): boolean {
  if (!v) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v as object).length > 0;
  return true;
}

function kidHasTracker(byKid: Record<string, any> | undefined, key: string): boolean {
  if (!byKid) return false;
  for (const kidId of Object.keys(byKid)) {
    const kidMap = byKid[kidId];
    if (!kidMap) continue;
    // Growth store keeps per-type arrays; teeth/food use per-item maps.
    if (Array.isArray(kidMap[key]) && kidMap[key].length > 0) return true;
    if (kidMap[key] && typeof kidMap[key] === 'object' && Object.keys(kidMap[key]).length > 0) {
      return true;
    }
  }
  return false;
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function getAnalyticsSnapshot(): Promise<AnalyticsSnapshot | null> {
  if (!db) return null;

  const now = Date.now();
  const dayMs = 864e5;
  const sevenDaysAgo = now - 7 * dayMs;
  const thirtyDaysAgo = now - 30 * dayMs;
  const oneDayAgo = now - dayMs;

  // ── Users sweep ───────────────────────────────────────────────────────────
  const usersSnap = await getDocs(collection(db, 'users'));
  const users = usersSnap.docs.map((d) => ({ id: d.id, data: d.data() }));

  let onboardingComplete = 0;
  let newSignups7d = 0;
  let newSignups30d = 0;
  let activeToday = 0;
  let activeThisWeek = 0;
  let photoSet = 0;

  // Feature adoption counters — one per tracker/section of interest.
  const counters = {
    vaccinesMarked: 0,
    teeth: 0,
    foods: 0,
    growthWeight: 0,
    growthHeight: 0,
    growthHead: 0,
    routineDiaper: 0,
    routineSleep: 0,
    myHealthChecklist: 0,
    moodLogged: 0,
    allergiesSet: 0,
    healthConditionsSet: 0,
    photoAvatar: 0,
  };

  const stateCounts = new Map<string, number>();
  const signupBuckets = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    signupBuckets.set(dayKey(now - i * dayMs), 0);
  }

  const recent: AnalyticsSnapshot['recentSignups'] = [];

  for (const { id, data } of users) {
    const createdMs = asMillis(data.createdAt);
    const updatedMs = asMillis(data.updatedAt);

    if (data.onboardingComplete === true) onboardingComplete++;
    if (createdMs !== null) {
      if (createdMs >= sevenDaysAgo) newSignups7d++;
      if (createdMs >= thirtyDaysAgo) newSignups30d++;
      const k = dayKey(createdMs);
      if (signupBuckets.has(k)) signupBuckets.set(k, (signupBuckets.get(k) ?? 0) + 1);
    }
    if (updatedMs !== null) {
      if (updatedMs >= oneDayAgo) activeToday++;
      if (updatedMs >= sevenDaysAgo) activeThisWeek++;
    }

    if (data.photoUrl) { photoSet++; counters.photoAvatar++; }

    // ── Health trackers ────────────────────────────────────────────
    if (isNonEmpty(data.completedVaccines)) counters.vaccinesMarked++;
    if (kidHasTracker(data.teethTracking, 'state') || isNonEmpty(data.teethTracking)) counters.teeth++;
    if (isNonEmpty(data.foodTracking))       counters.foods++;
    if (kidHasTracker(data.growthTracking, 'weight')) counters.growthWeight++;
    if (kidHasTracker(data.growthTracking, 'height')) counters.growthHeight++;
    if (kidHasTracker(data.growthTracking, 'head'))   counters.growthHead++;
    if (kidHasTracker(data.growthTracking, 'diaper')) counters.routineDiaper++;
    if (kidHasTracker(data.growthTracking, 'sleep'))  counters.routineSleep++;
    if (isNonEmpty(data.healthTracking)) counters.myHealthChecklist++;

    // ── Wellness + chat ───────────────────────────────────────────
    if (isNonEmpty(data.moodHistory)) counters.moodLogged++;
    if (isNonEmpty(data.allergies))   counters.allergiesSet++;
    if (isNonEmpty(data.healthConditions)) counters.healthConditionsSet++;

    // ── Geo ──────────────────────────────────────────────────────
    const state = (data.profile?.state ?? '').trim();
    if (state) stateCounts.set(state, (stateCounts.get(state) ?? 0) + 1);

    // ── Recent signups feed ──────────────────────────────────────
    recent.push({
      uid: id,
      name: data.name ?? data.motherName ?? 'Unnamed',
      email: data.email ?? '',
      createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
      state,
      parentGender: data.parentGender ?? '',
    });
  }

  const totalUsers = users.length;
  const base = Math.max(1, totalUsers); // avoid div-by-zero on empty projects
  const pct = (n: number) => Math.round((n / base) * 100);

  const featureAdoption = ([
    { label: 'Vaccine tracking',     icon: 'shield-checkmark-outline', users: counters.vaccinesMarked,     pct: pct(counters.vaccinesMarked),     group: 'health' },
    { label: 'Growth · weight',      icon: 'scale-outline',             users: counters.growthWeight,       pct: pct(counters.growthWeight),       group: 'health' },
    { label: 'Growth · height',      icon: 'resize-outline',            users: counters.growthHeight,       pct: pct(counters.growthHeight),       group: 'health' },
    { label: 'Growth · head',        icon: 'ellipse-outline',           users: counters.growthHead,         pct: pct(counters.growthHead),         group: 'health' },
    { label: 'Routine · diaper',     icon: 'sync-outline',              users: counters.routineDiaper,      pct: pct(counters.routineDiaper),      group: 'health' },
    { label: 'Routine · sleep',      icon: 'moon-outline',              users: counters.routineSleep,       pct: pct(counters.routineSleep),       group: 'health' },
    { label: 'Teeth tracker',        icon: 'happy-outline',             users: counters.teeth,              pct: pct(counters.teeth),              group: 'health' },
    { label: 'Food 3-day rule',      icon: 'restaurant-outline',        users: counters.foods,              pct: pct(counters.foods),              group: 'health' },
    { label: 'My Health checklist',  icon: 'heart-outline',             users: counters.myHealthChecklist,  pct: pct(counters.myHealthChecklist),  group: 'health' },
    { label: 'Mood logging',         icon: 'pulse-outline',             users: counters.moodLogged,         pct: pct(counters.moodLogged),         group: 'wellness' },
    { label: 'Allergies set',        icon: 'alert-circle-outline',      users: counters.allergiesSet,       pct: pct(counters.allergiesSet),       group: 'chat' },
    { label: 'Health conditions',    icon: 'medkit-outline',            users: counters.healthConditionsSet,pct: pct(counters.healthConditionsSet),group: 'wellness' },
    { label: 'Profile photo',        icon: 'person-circle-outline',     users: counters.photoAvatar,        pct: pct(counters.photoAvatar),        group: 'community' },
  ] as FeatureAdoption[]).sort((a, b) => b.users - a.users);

  const signupTrend: SignupTrendPoint[] = Array.from(signupBuckets.entries()).map(([day, count]) => ({ day, count }));

  const topStates = Array.from(stateCounts.entries())
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  recent.sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return tb - ta;
  });

  // ── Community vigilance ───────────────────────────────────────────────────
  let pendingPosts = 0;
  let reportedPosts = 0;
  try {
    const postsSnap = await getDocs(collection(db, 'community_posts'));
    for (const d of postsSnap.docs) {
      const data = d.data();
      if (!data.approved) pendingPosts++;
      const reports = Array.isArray(data.reports) ? data.reports.length : 0;
      if (reports > 0) reportedPosts++;
    }
  } catch {
    // no-op — community_posts may be locked down tighter than the admin read
  }

  let reportedUsers = 0;
  try {
    const blocksSnap = await getDocs(collection(db, 'blocks'));
    const blocked = new Set<string>();
    for (const d of blocksSnap.docs) {
      const data = d.data();
      if (typeof data.blockedUid === 'string') blocked.add(data.blockedUid);
    }
    reportedUsers = blocked.size;
  } catch {
    /* no-op */
  }

  let openTickets = 0;
  try {
    const q = query(collection(db, 'supportTickets'), where('status', '==', 'open'));
    const ts = await getDocs(q);
    openTickets = ts.size;
  } catch {
    /* no-op */
  }

  return {
    totalUsers,
    onboardingComplete,
    newSignups7d,
    newSignups30d,
    activeToday,
    activeThisWeek,
    recentSignups: recent.slice(0, 8),
    photoSetPct: pct(photoSet),
    featureAdoption,
    signupTrend,
    vigilance: { pendingPosts, reportedPosts, reportedUsers, openTickets },
    topStates,
  };
}
