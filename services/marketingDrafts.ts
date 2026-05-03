// Marketing drafts queue (M2).
//
// Drafts are produced by the daily cron OR a manual "Generate now" trigger.
// Each draft is one rendered IG-square image + a caption + structured tags
// (persona, pillar, event). Admin reviews in the queue, edits caption,
// approves / rejects / regenerates.
//
// All write paths log through services/audit.ts.

import {
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import { DraftStatus, MarketingDraft, MarketingPlatform } from '../lib/marketingTypes';
import { logAdminAction } from './audit';
import { app, db } from './firebase';

const DRAFTS_COL = 'marketing_drafts';

// ── Reads ───────────────────────────────────────────────────────────────────

export interface ListDraftsOpts {
  /** Filter by status. Omit for all. */
  status?: DraftStatus | 'all';
  /** Soft cap. Default 50. */
  limitN?: number;
}

export async function listDrafts(opts: ListDraftsOpts = {}): Promise<MarketingDraft[]> {
  if (!db) return [];
  try {
    const { status = 'all', limitN = 50 } = opts;
    const constraints: any[] = [orderBy('generatedAt', 'desc'), limit(Math.min(limitN, 200))];
    if (status !== 'all') constraints.unshift(where('status', '==', status));
    const q = query(collection(db, DRAFTS_COL), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map(rowToDraft);
  } catch {
    return [];
  }
}

export function subscribeDrafts(opts: ListDraftsOpts, cb: (rows: MarketingDraft[]) => void) {
  if (!db) {
    cb([]);
    return () => {};
  }
  const { status = 'all', limitN = 50 } = opts;
  const constraints: any[] = [orderBy('generatedAt', 'desc'), limit(Math.min(limitN, 200))];
  if (status !== 'all') constraints.unshift(where('status', '==', status));
  const q = query(collection(db, DRAFTS_COL), ...constraints);
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map(rowToDraft)),
    () => cb([]),
  );
}

export async function fetchDraft(id: string): Promise<MarketingDraft | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, DRAFTS_COL, id));
    if (!snap.exists()) return null;
    return rowToDraft(snap as any);
  } catch {
    return null;
  }
}

export async function countDraftsByStatus(): Promise<Record<DraftStatus, number>> {
  const empty: Record<DraftStatus, number> = {
    pending_review: 0, approved: 0, scheduled: 0, posted: 0, rejected: 0, failed: 0,
  };
  if (!db) return empty;
  try {
    // Pull recent 200; for accurate counts beyond that, we'd add a counter
    // doc — fine for now.
    const snap = await getDocs(query(collection(db, DRAFTS_COL), orderBy('generatedAt', 'desc'), limit(200)));
    const out = { ...empty };
    snap.forEach((d) => {
      const s = (d.data() as any)?.status as DraftStatus | undefined;
      if (s && s in out) out[s] += 1;
    });
    return out;
  } catch {
    return empty;
  }
}

// ── Writes ──────────────────────────────────────────────────────────────────

export async function approveDraft(
  actor: { uid: string; email: string | null | undefined },
  id: string,
  patch?: { caption?: string; platforms?: MarketingPlatform[]; scheduledAt?: string | null },
): Promise<void> {
  if (!db) throw new Error('Firestore not ready');
  const update: Record<string, unknown> = {
    status: 'approved',
    approvedAt: serverTimestamp(),
    approvedBy: actor.email ?? actor.uid,
  };
  if (patch?.caption !== undefined) update.caption = String(patch.caption).slice(0, 2200);
  if (patch?.platforms) update.platforms = patch.platforms.slice(0, 4);
  if (patch?.scheduledAt !== undefined) update.scheduledAt = patch.scheduledAt;
  await updateDoc(doc(db, DRAFTS_COL, id), update);
  await logAdminAction(actor, 'marketing.draft.approve', { docId: id });
}

export async function rejectDraft(
  actor: { uid: string; email: string | null | undefined },
  id: string,
  reason: string,
): Promise<void> {
  if (!db) throw new Error('Firestore not ready');
  await updateDoc(doc(db, DRAFTS_COL, id), {
    status: 'rejected',
    rejectReason: String(reason).slice(0, 240),
    rejectedAt: serverTimestamp(),
    rejectedBy: actor.email ?? actor.uid,
  });
  await logAdminAction(actor, 'marketing.draft.reject', { docId: id }, { reason });
}

export async function updateDraftCaption(
  actor: { uid: string; email: string | null | undefined },
  id: string,
  caption: string,
): Promise<void> {
  if (!db) throw new Error('Firestore not ready');
  await updateDoc(doc(db, DRAFTS_COL, id), { caption: String(caption).slice(0, 2200) });
  await logAdminAction(actor, 'marketing.draft.edit_caption', { docId: id });
}

export async function deleteDraft(
  actor: { uid: string; email: string | null | undefined },
  id: string,
): Promise<void> {
  if (!db) throw new Error('Firestore not ready');
  await deleteDoc(doc(db, DRAFTS_COL, id));
  await logAdminAction(actor, 'marketing.draft.delete', { docId: id });
}

/** Schedule a draft for a specific time. ISO string in any TZ; admin enters
 *  IST via the picker, the input arrives normalised. Sets status='scheduled'
 *  so the calendar view renders it on its day. */
export async function scheduleDraft(
  actor: { uid: string; email: string | null | undefined },
  id: string,
  scheduledAtIso: string,
  platforms?: MarketingPlatform[],
): Promise<void> {
  if (!db) throw new Error('Firestore not ready');
  const update: Record<string, unknown> = {
    status: 'scheduled',
    scheduledAt: scheduledAtIso,
    approvedAt: serverTimestamp(),
    approvedBy: actor.email ?? actor.uid,
  };
  if (platforms?.length) update.platforms = platforms.slice(0, 6);
  await updateDoc(doc(db, DRAFTS_COL, id), update);
  await logAdminAction(actor, 'marketing.draft.schedule', { docId: id }, { scheduledAt: scheduledAtIso });
}

export async function unscheduleDraft(
  actor: { uid: string; email: string | null | undefined },
  id: string,
): Promise<void> {
  if (!db) throw new Error('Firestore not ready');
  await updateDoc(doc(db, DRAFTS_COL, id), {
    status: 'approved',
    scheduledAt: null,
  });
  await logAdminAction(actor, 'marketing.draft.unschedule', { docId: id });
}

/** Manual-publish mode marker — admin posted to the channels themselves and
 *  is recording the receipt. Stores the platform → permalink map. */
export async function markDraftPosted(
  actor: { uid: string; email: string | null | undefined },
  id: string,
  permalinks: Partial<Record<MarketingPlatform, string>>,
): Promise<void> {
  if (!db) throw new Error('Firestore not ready');
  await updateDoc(doc(db, DRAFTS_COL, id), {
    status: 'posted',
    postedAt: serverTimestamp(),
    postPermalinks: permalinks,
  });
  await logAdminAction(actor, 'marketing.draft.publish', { docId: id });
}

// ── Generator (server-side) wrapper ─────────────────────────────────────────
// Calls generateMarketingDraft Cloud Function. Used by "Generate now" button
// + the daily cron internally (cron calls the same internal function with
// service-account auth).

export interface GenerateDraftInput {
  /** Optional overrides. If omitted, the server picks based on today's
   *  weekday + cultural calendar. */
  personaId?: string;
  pillarId?: string;
  eventId?: string;
  /** Force a specific template; otherwise model picks. */
  template?: 'tipCard' | 'quoteCard' | 'milestoneCard';
  /** Image generation model. Default 'imagen' for Indian-context fidelity. */
  imageModel?: 'imagen' | 'dalle' | 'flux';
}

export interface GenerateDraftResult {
  ok: true;
  draftId: string;
  caption: string;
  imageUrl: string;
  imageSource: string;
  template: string;
  costInr: number;
  flags: { type: string; phrase: string }[];
  requiredDisclaimers: string[];
}

export interface GenerateDraftError {
  ok: false;
  code: string;
  message: string;
}

export async function generateMarketingDraft(
  input: GenerateDraftInput,
): Promise<GenerateDraftResult | GenerateDraftError> {
  if (!app) throw new Error('Firebase app not configured');
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions(app);
  const call = httpsCallable<GenerateDraftInput, GenerateDraftResult | GenerateDraftError>(
    functions,
    'generateMarketingDraft',
  );
  const result = await call(input);
  return result.data;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function tsToIso(ts: unknown): string | null {
  if (!ts) return null;
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  if (typeof (ts as any)?.toDate === 'function') {
    try {
      return (ts as any).toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (typeof ts === 'string') return ts;
  return null;
}

function rowToDraft(snap: { id: string; data: () => DocumentData }): MarketingDraft {
  const d = snap.data() as Record<string, any>;
  const status = (typeof d.status === 'string' ? d.status : 'pending_review') as DraftStatus;
  const assets = Array.isArray(d.assets) ? d.assets : [];
  return {
    id: snap.id,
    status,
    kind: (typeof d.kind === 'string' ? d.kind : 'image') as MarketingDraft['kind'],
    themeKey: (typeof d.themeKey === 'string' ? d.themeKey : 'mon') as MarketingDraft['themeKey'],
    themeLabel: typeof d.themeLabel === 'string' ? d.themeLabel : '',
    caption: typeof d.caption === 'string' ? d.caption : '',
    assets: assets.map((a: any) => ({
      url: typeof a?.url === 'string' ? a.url : '',
      index: typeof a?.index === 'number' ? a.index : 0,
      template: typeof a?.template === 'string' ? a.template : '',
    })),
    platforms: Array.isArray(d.platforms) ? d.platforms : ['instagram', 'facebook'],
    scheduledAt: typeof d.scheduledAt === 'string' ? d.scheduledAt : tsToIso(d.scheduledAt),
    postedAt: tsToIso(d.postedAt),
    postPermalinks: typeof d.postPermalinks === 'object' && d.postPermalinks ? d.postPermalinks : {},
    publishError: typeof d.publishError === 'string' ? d.publishError : null,
    safetyFlags: Array.isArray(d.safetyFlags) ? d.safetyFlags : [],
    personaId: typeof d.personaId === 'string' ? d.personaId : null,
    personaLabel: typeof d.personaLabel === 'string' ? d.personaLabel : null,
    pillarId: typeof d.pillarId === 'string' ? d.pillarId : null,
    pillarLabel: typeof d.pillarLabel === 'string' ? d.pillarLabel : null,
    eventId: typeof d.eventId === 'string' ? d.eventId : null,
    eventLabel: typeof d.eventLabel === 'string' ? d.eventLabel : null,
    locale: typeof d.locale === 'string' ? d.locale : null,
    headline: typeof d.headline === 'string' ? d.headline : null,
    imagePrompt: typeof d.imagePrompt === 'string' ? d.imagePrompt : null,
    imageSource: typeof d.imageSource === 'string' ? d.imageSource : null,
    costInr: typeof d.costInr === 'number' ? d.costInr : 0,
    generatedAt: tsToIso(d.generatedAt),
    generatedBy: typeof d.generatedBy === 'string' ? d.generatedBy : null,
    approvedAt: tsToIso(d.approvedAt),
    approvedBy: typeof d.approvedBy === 'string' ? d.approvedBy : null,
    rejectedAt: tsToIso(d.rejectedAt),
    rejectedBy: typeof d.rejectedBy === 'string' ? d.rejectedBy : null,
    rejectReason: typeof d.rejectReason === 'string' ? d.rejectReason : null,
  };
}
