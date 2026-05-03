// Custom role registry.
//
// The four built-in roles (super / moderator / support / content) are
// defined statically in lib/admin.ts. This module lets a super-admin
// define ADDITIONAL roles backed by a Firestore collection — e.g. a
// "viewer" role with read-only capabilities, or "ops" with cron replay
// access.
//
// Stored at admin_roles/{key} where `key` matches AdminRole at the type
// level (we widen it to string at runtime). The capability matrix in
// lib/admin.ts CAP_BY_ROLE is the authoritative source for built-ins;
// this layer only adds rows on top.
//
// Note: actually USING a custom role for client-side gating requires
// extending lib/admin.ts can() to also consult this registry. That's
// a separate small change once the user has actually saved a role.
// For now this is a read/write surface for the data; wiring is Wave 8+.

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { db } from './firebase';
import { logAdminAction } from './audit';
import { AdminCapability } from '../lib/admin';

export interface CustomRole {
  key: string;          // unique slug, e.g. 'viewer', 'ops'
  label: string;        // human label
  description?: string;
  capabilities: AdminCapability[];
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

const COL = 'admin_roles';

export async function listCustomRoles(): Promise<CustomRole[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, COL));
    return snap.docs.map((d) => {
      const data = d.data() as any;
      const tsToIso = (v: any): string | undefined => {
        if (!v) return undefined;
        if (typeof v === 'string') return v;
        if (typeof v?.toDate === 'function') return v.toDate().toISOString();
        if (typeof v?.seconds === 'number') return new Date(v.seconds * 1000).toISOString();
        return undefined;
      };
      return {
        key: d.id,
        label: data.label ?? d.id,
        description: data.description ?? '',
        capabilities: Array.isArray(data.capabilities) ? data.capabilities : [],
        createdAt: tsToIso(data.createdAt),
        updatedAt: tsToIso(data.updatedAt),
        createdBy: data.createdBy ?? undefined,
      };
    });
  } catch (e) {
    console.warn('listCustomRoles failed:', e);
    return [];
  }
}

export async function upsertCustomRole(
  actor: { uid: string; email: string | null | undefined },
  role: Omit<CustomRole, 'createdAt' | 'updatedAt' | 'createdBy'>,
): Promise<void> {
  if (!db) throw new Error('Firestore not ready');
  const slug = role.key.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
  if (!slug) throw new Error('Role key required');
  if (['super', 'moderator', 'support', 'content'].includes(slug)) {
    throw new Error(`"${slug}" is a built-in role and cannot be redefined.`);
  }
  await setDoc(
    doc(db, COL, slug),
    {
      label: role.label.trim() || slug,
      description: role.description?.trim() ?? '',
      capabilities: Array.from(new Set(role.capabilities)),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      createdBy: actor.email ?? actor.uid,
    },
    { merge: true },
  );
  await logAdminAction(actor, 'role.update', { docId: slug, label: role.label }, { capabilities: role.capabilities });
}

export async function deleteCustomRole(
  actor: { uid: string; email: string | null | undefined },
  key: string,
): Promise<void> {
  if (!db) return;
  if (['super', 'moderator', 'support', 'content'].includes(key)) {
    throw new Error('Cannot delete a built-in role.');
  }
  await deleteDoc(doc(db, COL, key));
  await logAdminAction(actor, 'role.delete', { docId: key });
}
