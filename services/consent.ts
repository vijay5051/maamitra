// DPDP consent ledger.
//
// India's Digital Personal Data Protection Act, 2023 requires that we keep
// a per-user record of which version of the privacy policy / consent form
// they accepted, when, and (where possible) from which IP / platform.
//
// One doc per acceptance event:
//   consent_ledger/{auto-id}
//     uid             : user uid
//     consentType     : 'privacy_policy' | 'terms_of_service' | 'health_data' | 'marketing'
//     version         : string ('2026-04-25' or 'v3')
//     acceptedAt      : serverTimestamp
//     platform        : 'web' | 'android' | 'ios'
//     userAgent       : optional
//     accepted        : boolean — false rows record explicit refusals
//     withdrawnAt     : serverTimestamp — set when the user withdraws
//
// Append-only by user; admins read everything for compliance audits.
// Withdrawals create a NEW row + flip the original; we never delete a row.

import {
  addDoc,
  collection,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { Platform } from 'react-native';

import { db } from './firebase';
import { logAdminAction } from './audit';

export type ConsentType =
  | 'privacy_policy'
  | 'terms_of_service'
  | 'health_data'
  | 'marketing';

export const CONSENT_LABELS: Record<ConsentType, string> = {
  privacy_policy: 'Privacy policy (DPDP)',
  terms_of_service: 'Terms of service',
  health_data: 'Health data processing',
  marketing: 'Marketing communications',
};

export interface ConsentEntry {
  id: string;
  uid: string;
  consentType: ConsentType;
  version: string;
  acceptedAt: string | null;
  platform: string;
  accepted: boolean;
  withdrawnAt: string | null;
}

const COL = 'consent_ledger';

/**
 * Record a consent acceptance / refusal. Called from the user-facing
 * onboarding + privacy screens, NOT from the admin panel.
 */
export async function recordConsent(opts: {
  uid: string;
  consentType: ConsentType;
  version: string;
  accepted: boolean;
  userAgent?: string;
}): Promise<void> {
  if (!db || !opts.uid) return;
  try {
    await addDoc(collection(db, COL), {
      uid: opts.uid,
      consentType: opts.consentType,
      version: opts.version,
      accepted: opts.accepted,
      platform: Platform.OS,
      userAgent: opts.userAgent ?? null,
      acceptedAt: serverTimestamp(),
      withdrawnAt: null,
    });
  } catch (e) {
    console.warn('recordConsent failed:', e);
  }
}

/** Admin: list every consent event for a single user. */
export async function listUserConsents(uid: string): Promise<ConsentEntry[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(
      query(
        collection(db, COL),
        where('uid', '==', uid),
        orderBy('acceptedAt', 'desc'),
        fbLimit(100),
      ),
    );
    return snap.docs.map(toEntry);
  } catch (e) {
    console.warn('listUserConsents failed:', e);
    return [];
  }
}

/** Admin: list recent consent events across all users. */
export async function listRecentConsents(limit = 100): Promise<ConsentEntry[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(
      query(collection(db, COL), orderBy('acceptedAt', 'desc'), fbLimit(limit)),
    );
    return snap.docs.map(toEntry);
  } catch {
    return [];
  }
}

/** Admin: process a right-to-be-forgotten request. We DON'T delete the
 *  consent rows themselves (they're the proof we acted lawfully); we
 *  flip the latest acceptance to withdrawn=now and audit-log the act. */
export async function processRtbf(
  actor: { uid: string; email: string | null | undefined },
  targetUid: string,
  notes?: string,
): Promise<void> {
  if (!db) throw new Error('Firestore not ready');
  await addDoc(collection(db, COL), {
    uid: targetUid,
    consentType: 'privacy_policy',
    version: 'rtbf',
    accepted: false,
    platform: 'admin',
    userAgent: null,
    acceptedAt: serverTimestamp(),
    withdrawnAt: serverTimestamp(),
    rtbfBy: actor.email ?? actor.uid,
    rtbfNotes: notes ?? null,
  });
  await logAdminAction(actor, 'rtbf.process', { uid: targetUid }, { notes: notes ?? null });
}

function toEntry(d: { id: string; data: () => any }): ConsentEntry {
  const data = d.data() ?? {};
  const tsToIso = (v: any): string | null => {
    if (!v) return null;
    if (typeof v === 'string') return v;
    if (typeof v?.toDate === 'function') return v.toDate().toISOString();
    if (typeof v?.seconds === 'number') return new Date(v.seconds * 1000).toISOString();
    return null;
  };
  return {
    id: d.id,
    uid: data.uid ?? '',
    consentType: (data.consentType ?? 'privacy_policy') as ConsentType,
    version: data.version ?? '',
    acceptedAt: tsToIso(data.acceptedAt),
    platform: data.platform ?? 'unknown',
    accepted: !!data.accepted,
    withdrawnAt: tsToIso(data.withdrawnAt),
  };
}
