// User-generated content (M6).
//
// Submission flow (user-facing): the in-app screen calls submitUgc() with
// a photo + story + display name. We upload the photo to Storage, write
// a row to ugc_submissions/{id} with status='pending_review', and append
// a consent row to consent_ledger so the DPDP trail is intact.
//
// Review flow (admin-facing): subscribeUgcQueue() drives the admin queue;
// approveUgc() and rejectUgc() update status; renderUgcAsDraft() is the
// callable that turns an approved submission into a marketing_draft so it
// can ride the existing approve/schedule/publish path.

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';

import { UgcStatus, UgcSubmission } from '../lib/marketingTypes';
import { logAdminAction } from './audit';
import { app, db, storage } from './firebase';

const UGC_COL = 'ugc_submissions';

// ── User-facing submission ─────────────────────────────────────────────────

export interface SubmitUgcInput {
  uid: string;
  displayName: string;
  story: string;
  childAge?: string;
  /** Photo bytes — already a Blob/File from the picker. Optional. */
  photo: Blob | null;
  consent: boolean;
}

export async function submitUgc(input: SubmitUgcInput): Promise<string> {
  if (!db || !storage) throw new Error('Firebase not configured');
  if (!input.consent) throw new Error('Consent is required.');
  const story = input.story.trim();
  if (story.length < 50) throw new Error('Please share a bit more — at least 50 characters.');
  if (story.length > 800) throw new Error('Please keep it under 800 characters.');

  const submissionRef = doc(collection(db, UGC_COL));

  // Upload photo (if any) so the rendered draft has a real asset.
  let photoUrl: string | null = null;
  let photoStoragePath: string | null = null;
  if (input.photo && input.photo.size > 0) {
    if (input.photo.size > 8 * 1024 * 1024) throw new Error('Photo must be under 8 MB.');
    photoStoragePath = `ugc/${submissionRef.id}/photo.jpg`;
    const ref = storageRef(storage, photoStoragePath);
    await uploadBytes(ref, input.photo, { contentType: input.photo.type || 'image/jpeg' });
    photoUrl = await getDownloadURL(ref);
  }

  await setDoc(submissionRef, {
    uid: input.uid,
    displayName: String(input.displayName).trim().slice(0, 60) || 'Anonymous',
    story,
    photoUrl,
    photoStoragePath,
    childAge: input.childAge ? String(input.childAge).trim().slice(0, 20) : null,
    pillarId: null,
    status: 'pending_review' as UgcStatus,
    rejectReason: null,
    renderedDraftId: null,
    createdAt: serverTimestamp(),
    reviewedAt: null,
    reviewedBy: null,
  });

  // Append a consent row — Wave 7's DPDP ledger. Append-only by rules.
  await addDoc(collection(db, 'consent_ledger'), {
    uid: input.uid,
    type: 'ugc_share',
    grantedAt: serverTimestamp(),
    detail: { submissionId: submissionRef.id, story: story.slice(0, 200), photoIncluded: !!input.photo },
  });

  return submissionRef.id;
}

// ── Admin reads ────────────────────────────────────────────────────────────

export interface ListUgcOpts {
  status?: UgcStatus | 'all';
  limitN?: number;
}

export function subscribeUgcQueue(opts: ListUgcOpts, cb: (rows: UgcSubmission[]) => void): Unsubscribe {
  if (!db) {
    cb([]);
    return () => {};
  }
  const { status = 'all', limitN = 100 } = opts;
  const constraints: any[] = [orderBy('createdAt', 'desc'), limit(Math.min(limitN, 200))];
  if (status !== 'all') constraints.unshift(where('status', '==', status));
  const q = query(collection(db, UGC_COL), ...constraints);
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map(rowToSubmission)),
    () => cb([]),
  );
}

export async function fetchSubmission(id: string): Promise<UgcSubmission | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, UGC_COL, id));
    if (!snap.exists()) return null;
    return rowToSubmission(snap as any);
  } catch {
    return null;
  }
}

// ── Admin actions ──────────────────────────────────────────────────────────

export async function approveUgc(
  actor: { uid: string; email: string | null | undefined },
  submissionId: string,
  pillarId?: string,
): Promise<void> {
  if (!db) throw new Error('Firestore not ready');
  await updateDoc(doc(db, UGC_COL, submissionId), {
    status: 'approved',
    pillarId: pillarId ?? 'real_stories',
    reviewedAt: serverTimestamp(),
    reviewedBy: actor.email ?? actor.uid,
  });
  await logAdminAction(actor, 'marketing.draft.approve', { docId: submissionId }, { kind: 'ugc' });
}

export async function rejectUgc(
  actor: { uid: string; email: string | null | undefined },
  submissionId: string,
  reason: string,
): Promise<void> {
  if (!db) throw new Error('Firestore not ready');
  await updateDoc(doc(db, UGC_COL, submissionId), {
    status: 'rejected',
    rejectReason: String(reason).slice(0, 240),
    reviewedAt: serverTimestamp(),
    reviewedBy: actor.email ?? actor.uid,
  });
  await logAdminAction(actor, 'marketing.draft.reject', { docId: submissionId }, { kind: 'ugc', reason });
}

export async function deleteUgcSubmission(
  actor: { uid: string; email: string | null | undefined },
  submissionId: string,
  photoStoragePath: string | null,
): Promise<void> {
  if (!db) throw new Error('Firestore not ready');
  // Delete the photo first if any — best effort.
  if (photoStoragePath && storage) {
    try { await deleteObject(storageRef(storage, photoStoragePath)); } catch { /* may already be gone */ }
  }
  await deleteDoc(doc(db, UGC_COL, submissionId));
  await logAdminAction(actor, 'marketing.draft.delete', { docId: submissionId }, { kind: 'ugc' });
}

// ── Cloud Function wrapper: render UGC as draft ────────────────────────────

export interface RenderUgcAsDraftInput { submissionId: string }
export interface RenderUgcAsDraftResult {
  ok: true;
  draftId: string;
  imageUrl: string;
  caption: string;
}
export interface RenderUgcAsDraftError { ok: false; code: string; message: string }

export async function renderUgcAsDraft(
  input: RenderUgcAsDraftInput,
): Promise<RenderUgcAsDraftResult | RenderUgcAsDraftError> {
  if (!app) throw new Error('Firebase app not configured');
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions(app);
  const call = httpsCallable<RenderUgcAsDraftInput, RenderUgcAsDraftResult | RenderUgcAsDraftError>(
    functions,
    'renderUgcAsDraft',
  );
  const result = await call(input);
  return result.data;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function tsToIso(ts: unknown): string {
  if (!ts) return '';
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  if (typeof (ts as any)?.toDate === 'function') {
    try { return (ts as any).toDate().toISOString(); } catch { return ''; }
  }
  if (typeof ts === 'string') return ts;
  return '';
}

function rowToSubmission(snap: { id: string; data: () => any }): UgcSubmission {
  const d = snap.data() as Record<string, any>;
  return {
    id: snap.id,
    uid: typeof d.uid === 'string' ? d.uid : '',
    displayName: typeof d.displayName === 'string' ? d.displayName : 'Anonymous',
    story: typeof d.story === 'string' ? d.story : '',
    photoUrl: typeof d.photoUrl === 'string' ? d.photoUrl : null,
    photoStoragePath: typeof d.photoStoragePath === 'string' ? d.photoStoragePath : null,
    childAge: typeof d.childAge === 'string' ? d.childAge : null,
    pillarId: typeof d.pillarId === 'string' ? d.pillarId : null,
    status: (d.status ?? 'pending_review') as UgcStatus,
    rejectReason: typeof d.rejectReason === 'string' ? d.rejectReason : null,
    renderedDraftId: typeof d.renderedDraftId === 'string' ? d.renderedDraftId : null,
    createdAt: tsToIso(d.createdAt),
    reviewedAt: tsToIso(d.reviewedAt),
    reviewedBy: typeof d.reviewedBy === 'string' ? d.reviewedBy : null,
  };
}
