// Caller-auth helper shared by every Library-AI callable.
// Mirrors the marketing generator's gate so the Library AI surface is
// admin-only end-to-end.

import * as admin from 'firebase-admin';

export async function callerIsContentAdmin(
  token: admin.auth.DecodedIdToken | undefined,
  allowList: ReadonlySet<string>,
): Promise<boolean> {
  if (!token) return false;
  if (token.admin === true) return true;
  if (token.email_verified === true && token.email && allowList.has(token.email.toLowerCase())) return true;
  if (!token.uid) return false;
  try {
    const snap = await admin.firestore().doc(`users/${token.uid}`).get();
    const role = snap.exists ? (snap.data() as any)?.adminRole : null;
    return role === 'super' || role === 'content';
  } catch {
    return false;
  }
}
