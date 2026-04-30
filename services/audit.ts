// Admin audit log.
//
// Every write-side admin action goes through `logAdminAction`. The doc shape
// is intentionally generic — { actorUid, actorEmail, action, target, meta,
// createdAt } — so we can add new action codes over time without schema
// migrations. Read access lives at /admin (view_audit_log capability) and
// surfaces as the "Recent admin activity" feed on the dashboard.
//
// Failures are swallowed: an audit-log miss must never block the user-facing
// admin action. We log to console so it's still observable in dev.

import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export type AdminAction =
  | 'user.create'
  | 'user.delete'
  | 'user.role.change'
  | 'user.adminRole.change'
  | 'user.export'
  | 'post.approve'
  | 'post.hide'
  | 'post.unhide'
  | 'post.delete'
  | 'comment.delete'
  | 'support.reply'
  | 'support.close'
  | 'support.reopen'
  | 'push.personal'
  | 'push.broadcast'
  | 'push.schedule'
  | 'push.cancel'
  | 'banner.publish'
  | 'banner.clear'
  | 'content.create'
  | 'content.update'
  | 'content.delete'
  | 'content.publish'
  | 'vaccine.update'
  | 'settings.update'
  | 'flag.update';

export interface AuditTarget {
  /** Most actions target a user (uid). May be empty for global actions. */
  uid?: string;
  /** For post/comment/content actions, the relevant doc id. */
  docId?: string;
  /** Optional human-readable label for the audit log UI. */
  label?: string;
}

export interface AuditEntry {
  id: string;
  actorUid: string;
  actorEmail: string;
  action: AdminAction;
  target: AuditTarget;
  meta?: Record<string, any>;
  createdAt: string; // ISO
}

/**
 * Append an audit-log entry. Best-effort — never throws.
 */
export async function logAdminAction(
  actor: { uid: string; email: string | null | undefined },
  action: AdminAction,
  target: AuditTarget,
  meta?: Record<string, any>,
): Promise<void> {
  if (!db || !actor?.uid) return;
  try {
    await addDoc(collection(db, 'admin_audit'), {
      actorUid: actor.uid,
      actorEmail: (actor.email ?? '').toLowerCase(),
      action,
      target: {
        uid: target.uid ?? '',
        docId: target.docId ?? '',
        label: target.label ?? '',
      },
      meta: meta ?? {},
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('logAdminAction failed:', err);
  }
}

export async function getRecentAuditEntries(limitN = 50): Promise<AuditEntry[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(
      query(collection(db, 'admin_audit'), orderBy('createdAt', 'desc'), limit(limitN)),
    );
    return snap.docs.map((d) => {
      const data = d.data() as any;
      const ts = data.createdAt;
      const iso = ts?.toDate ? ts.toDate().toISOString() : (ts ?? '');
      return {
        id: d.id,
        actorUid: data.actorUid ?? '',
        actorEmail: data.actorEmail ?? '',
        action: data.action,
        target: data.target ?? {},
        meta: data.meta ?? {},
        createdAt: iso,
      } as AuditEntry;
    });
  } catch (err) {
    console.warn('getRecentAuditEntries failed:', err);
    return [];
  }
}
