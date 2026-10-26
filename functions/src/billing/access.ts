// Server-side "does this user get paid features?" check. Mirrors the client
// rule in lib/plans.ts + hooks/usePlanAccess.ts:
//   - an active Plus/Family entitlement, or
//   - an early member: Firebase Auth account created before plans went live
//     (app_settings/billing.earlyAccess.start), for `days` (default 90) after it.

import * as admin from 'firebase-admin';

const DEFAULT_EARLY_ACCESS_DAYS = 90;
const DAY_MS = 86400 * 1000;

type BillingDoc = { earlyAccess?: { start?: admin.firestore.Timestamp; days?: number } } | undefined;

/** End of the early-member window for everyone (ms), or null if none is running. */
export function earlyAccessWindow(billing: BillingDoc, now = Date.now()): { start: number; until: number } | null {
  const start = billing?.earlyAccess?.start;
  if (!(start instanceof admin.firestore.Timestamp)) return null;
  const days = typeof billing?.earlyAccess?.days === 'number' ? billing.earlyAccess.days : DEFAULT_EARLY_ACCESS_DAYS;
  const until = start.toMillis() + days * DAY_MS;
  return until > now ? { start: start.toMillis(), until } : null;
}

/** End of this user's early-member free period (ms) if it is still running, else null. */
export async function userEarlyAccessUntil(uid: string, billing: BillingDoc): Promise<number | null> {
  const window = earlyAccessWindow(billing);
  if (!window) return null;
  try {
    const created = Date.parse((await admin.auth().getUser(uid)).metadata.creationTime);
    return !Number.isNaN(created) && created < window.start ? window.until : null;
  } catch {
    return null;
  }
}

export async function hasPaidEntitlement(uid: string): Promise<boolean> {
  const ent = (await admin.firestore().doc(`entitlements/${uid}`).get()).data();
  const until = ent?.activeUntil as admin.firestore.Timestamp | undefined;
  return (ent?.plan === 'plus' || ent?.plan === 'family') && !!until && until.toMillis() > Date.now();
}

/** Paid plan or early-member free period. */
export async function hasFullAccess(uid: string, billing: BillingDoc): Promise<boolean> {
  return (await hasPaidEntitlement(uid)) || (await userEarlyAccessUntil(uid, billing)) !== null;
}
