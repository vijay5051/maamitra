// What's-new publisher.
//
// Single Firestore doc at app_config/whatsnew. Each new entry bumps the
// `version` field; clients store the last-seen version in AsyncStorage and
// open a modal on the next app launch when the server version is higher.
//
// Schema:
//   version: number          monotonically increasing, never decreases
//   title: string            modal headline
//   body: string             ≤ 280 chars, plain text
//   ctaLabel?: string        optional CTA button label
//   ctaHref?: string         optional CTA destination (route or URL)
//   publishedAt: ISO string
//   publishedBy: email
//
// Admin writes go through this service so the audit log fires consistently.

import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import { logAdminAction } from './audit';

export interface WhatsNewEntry {
  version: number;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  publishedAt: string | null;
  publishedBy: string | null;
}

const PATH = 'app_config/whatsnew';

export async function fetchWhatsNew(): Promise<WhatsNewEntry | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, PATH));
    if (!snap.exists()) return null;
    return normalise(snap.data());
  } catch { return null; }
}

export function subscribeWhatsNew(cb: (entry: WhatsNewEntry | null) => void): Unsubscribe {
  if (!db) { cb(null); return () => {}; }
  return onSnapshot(
    doc(db, PATH),
    (snap) => cb(snap.exists() ? normalise(snap.data()) : null),
    () => cb(null),
  );
}

export async function publishWhatsNew(
  actor: { uid: string; email: string | null | undefined },
  patch: Omit<WhatsNewEntry, 'publishedAt' | 'publishedBy' | 'version'> & { version: number },
): Promise<void> {
  if (!db) throw new Error('Firestore not ready');
  await setDoc(
    doc(db, PATH),
    {
      version: Math.max(1, Math.floor(patch.version)),
      title: patch.title.trim(),
      body: patch.body.trim(),
      ctaLabel: patch.ctaLabel?.trim() || null,
      ctaHref: patch.ctaHref?.trim() || null,
      publishedAt: serverTimestamp(),
      publishedBy: actor.email ?? actor.uid,
    },
    { merge: true },
  );
  await logAdminAction(actor, 'settings.update', { docId: 'whatsnew', label: `v${patch.version}` }, { area: 'whatsnew', title: patch.title });
}

function normalise(data: any): WhatsNewEntry {
  const ts = data?.publishedAt;
  const iso = ts?.toDate ? ts.toDate().toISOString() : (typeof ts === 'string' ? ts : null);
  return {
    version: typeof data?.version === 'number' ? data.version : 1,
    title: typeof data?.title === 'string' ? data.title : '',
    body: typeof data?.body === 'string' ? data.body : '',
    ctaLabel: typeof data?.ctaLabel === 'string' ? data.ctaLabel : undefined,
    ctaHref: typeof data?.ctaHref === 'string' ? data.ctaHref : undefined,
    publishedAt: iso,
    publishedBy: typeof data?.publishedBy === 'string' ? data.publishedBy : null,
  };
}
