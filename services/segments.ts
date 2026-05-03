// Audience segments — saved filter sets used to target pushes / lifecycle
// flows / banners.
//
// Stored at admin_segments/{id}. Resolved client-side against the existing
// getUsers() snapshot — we don't paginate yet because the user base is in
// the low thousands. Once that grows past 50k, swap in a Cloud Function
// that materialises segment membership into Firestore for fast push fan-out.
//
// Filter shape (all optional, ANDed together):
//   - states         : keep users whose profile.state matches any of these
//   - parentGenders  : 'mother' | 'father' | 'other'
//   - audienceBuckets: 'pregnant' | 'newborn' | 'toddler' (etc.)
//   - kidsCountMin   : minimum kids registered
//   - kidsCountMax   : maximum
//   - daysSinceActiveMin / Max : recency band, computed from updatedAt
//   - requirePushToken : drop users without a registered FCM token
//   - includeUids    : whitelist that bypasses every other filter
//   - excludeUids    : blocklist that wins over every other filter
//
// Audit-logged on create/update/delete via the same logAdminAction
// pipeline as everything else.

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import { db } from './firebase';
import { AdminUser, getUsers } from './firebase';
import { logAdminAction } from './audit';

export interface SegmentFilters {
  states?: string[];
  parentGenders?: Array<'mother' | 'father' | 'other'>;
  audienceBuckets?: string[];
  kidsCountMin?: number;
  kidsCountMax?: number;
  daysSinceActiveMin?: number;
  daysSinceActiveMax?: number;
  requirePushToken?: boolean;
  includeUids?: string[];
  excludeUids?: string[];
}

export interface AudienceSegment {
  id: string;
  name: string;
  description?: string;
  filters: SegmentFilters;
  /** Admin uid who created the segment. */
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

const COL = 'admin_segments';

export async function listSegments(): Promise<AudienceSegment[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(query(collection(db, COL), orderBy('createdAt', 'desc')));
    return snap.docs.map(toSegment);
  } catch (e) {
    console.warn('listSegments failed:', e);
    return [];
  }
}

export async function getSegment(id: string): Promise<AudienceSegment | null> {
  if (!db) return null;
  try {
    const ref = doc(db, COL, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return toSegment({ id: snap.id, data: () => snap.data() });
  } catch {
    return null;
  }
}

export async function createSegment(
  actor: { uid: string; email: string | null | undefined },
  payload: Omit<AudienceSegment, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
): Promise<string | null> {
  if (!db) return null;
  const ref = await addDoc(collection(db, COL), {
    name: payload.name.trim(),
    description: payload.description?.trim() ?? '',
    filters: sanitiseFilters(payload.filters),
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAdminAction(actor, 'settings.update', { docId: ref.id, label: `segment:${payload.name}` }, { area: 'segment.create' });
  return ref.id;
}

export async function updateSegment(
  actor: { uid: string; email: string | null | undefined },
  id: string,
  patch: Partial<Omit<AudienceSegment, 'id' | 'createdAt' | 'createdBy'>>,
): Promise<void> {
  if (!db) return;
  const next: any = { updatedAt: serverTimestamp() };
  if (typeof patch.name === 'string') next.name = patch.name.trim();
  if (typeof patch.description === 'string') next.description = patch.description.trim();
  if (patch.filters) next.filters = sanitiseFilters(patch.filters);
  await updateDoc(doc(db, COL, id), next);
  await logAdminAction(actor, 'settings.update', { docId: id, label: `segment:${patch.name ?? '?'}` }, { area: 'segment.update' });
}

export async function deleteSegment(
  actor: { uid: string; email: string | null | undefined },
  id: string,
): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, COL, id));
  await logAdminAction(actor, 'settings.update', { docId: id }, { area: 'segment.delete' });
}

// ─── Resolution / matching ────────────────────────────────────────────────
export interface AudiencePreview {
  total: number;
  withPushToken: number;
  matchedUids: string[];
  /** Top 5 names for a sanity-check confirmation card. */
  sample: Array<{ uid: string; name: string }>;
}

/** Apply filters to a single user. Pure function. */
export function userMatchesFilters(user: AdminUser, profile: any | null, filters: SegmentFilters): boolean {
  // Excludes win.
  if (filters.excludeUids?.includes(user.uid)) return false;
  // Includes bypass everything else.
  if (filters.includeUids?.includes(user.uid)) return true;

  if (filters.states?.length) {
    if (!user.state || !filters.states.includes(user.state)) return false;
  }
  if (filters.parentGenders?.length) {
    const pg = (user.parentGender ?? profile?.parentGender ?? '') as any;
    if (!filters.parentGenders.includes(pg)) return false;
  }
  if (filters.audienceBuckets?.length) {
    const buckets = user.audienceBuckets ?? [];
    if (!filters.audienceBuckets.some((b) => buckets.includes(b))) return false;
  }
  if (typeof filters.kidsCountMin === 'number' && user.kidsCount < filters.kidsCountMin) return false;
  if (typeof filters.kidsCountMax === 'number' && user.kidsCount > filters.kidsCountMax) return false;

  if (typeof filters.daysSinceActiveMin === 'number' || typeof filters.daysSinceActiveMax === 'number') {
    const updatedAt = profile?.updatedAt ?? profile?.lastActiveAt ?? null;
    const ts = parseTimestamp(updatedAt);
    if (ts == null) {
      // No activity timestamp — treat as infinity ago. Pass min, fail max.
      if (typeof filters.daysSinceActiveMax === 'number') return false;
    } else {
      const days = (Date.now() - ts) / 86_400_000;
      if (typeof filters.daysSinceActiveMin === 'number' && days < filters.daysSinceActiveMin) return false;
      if (typeof filters.daysSinceActiveMax === 'number' && days > filters.daysSinceActiveMax) return false;
    }
  }
  if (filters.requirePushToken && !user.hasPushToken) return false;
  return true;
}

function parseTimestamp(v: any): number | null {
  if (!v) return null;
  if (typeof v === 'string') { const t = Date.parse(v); return isNaN(t) ? null : t; }
  if (typeof v?.toDate === 'function') return v.toDate().getTime();
  if (typeof v?.seconds === 'number') return v.seconds * 1000;
  if (v instanceof Date) return v.getTime();
  return null;
}

/** Fetch users + count matches. For now the only data source is getUsers() —
 *  we don't have profile docs cached, so daysSinceActive uses AdminUser fields
 *  only and may under-count active users until we widen the snapshot. */
export async function previewSegment(filters: SegmentFilters): Promise<AudiencePreview> {
  const users = await getUsers();
  const matched: AdminUser[] = [];
  for (const u of users) {
    if (userMatchesFilters(u, null, filters)) matched.push(u);
  }
  return {
    total: matched.length,
    withPushToken: matched.filter((u) => u.hasPushToken).length,
    matchedUids: matched.map((u) => u.uid),
    sample: matched.slice(0, 5).map((u) => ({ uid: u.uid, name: u.name })),
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────
function toSegment(d: { id: string; data: () => any }): AudienceSegment {
  const data = d.data() ?? {};
  return {
    id: d.id,
    name: data.name ?? '(unnamed)',
    description: data.description ?? '',
    filters: data.filters ?? {},
    createdBy: data.createdBy ?? '',
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
  };
}

function tsToIso(v: any): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v?.toDate === 'function') return v.toDate().toISOString();
  if (typeof v?.seconds === 'number') return new Date(v.seconds * 1000).toISOString();
  return '';
}

function sanitiseFilters(f: SegmentFilters): SegmentFilters {
  // Drop empty arrays so Firestore doesn't store noise.
  const out: SegmentFilters = {};
  if (f.states?.length) out.states = f.states.slice(0, 50).map((s) => s.trim()).filter(Boolean);
  if (f.parentGenders?.length) out.parentGenders = f.parentGenders.filter((g) => g === 'mother' || g === 'father' || g === 'other');
  if (f.audienceBuckets?.length) out.audienceBuckets = f.audienceBuckets.slice(0, 20);
  if (typeof f.kidsCountMin === 'number') out.kidsCountMin = Math.max(0, Math.floor(f.kidsCountMin));
  if (typeof f.kidsCountMax === 'number') out.kidsCountMax = Math.max(0, Math.floor(f.kidsCountMax));
  if (typeof f.daysSinceActiveMin === 'number') out.daysSinceActiveMin = Math.max(0, Math.floor(f.daysSinceActiveMin));
  if (typeof f.daysSinceActiveMax === 'number') out.daysSinceActiveMax = Math.max(0, Math.floor(f.daysSinceActiveMax));
  if (f.requirePushToken) out.requirePushToken = true;
  if (f.includeUids?.length) out.includeUids = f.includeUids.slice(0, 1000);
  if (f.excludeUids?.length) out.excludeUids = f.excludeUids.slice(0, 1000);
  return out;
}
