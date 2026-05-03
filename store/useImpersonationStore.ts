// User impersonation ("view as user").
//
// Wave 8. The simplest viable shape: an admin opens a user 360 and clicks
// "View as user". We record the target uid + the admin's uid in this store
// + audit-log impersonate.start. The app surfaces a sticky banner at the
// top reminding the admin they're impersonating, and components that need
// to fetch user-scoped data read the impersonated uid from this store
// instead of useAuthStore.
//
// IMPORTANT — this is NOT a full session swap. We do not exchange a custom
// auth token. The admin's actual Firebase identity stays the same, which
// means write paths still go out as the admin (audit-correct). What
// changes is which user's data the admin's screens *display*. Treat this
// as a read-only view-as that surfaces the user's app exactly as they see
// it — for support debugging, NOT for acting on their behalf.
//
// A future iteration could mint a Firebase custom token + sign in as the
// target user inside an iframe sandbox. That work is out of scope here
// because it requires Cloud Functions. The current shape gives us 80% of
// the value with zero server changes.

import { create } from 'zustand';
import { logAdminAction } from '../services/audit';

interface ImpersonationState {
  /** uid of the user being impersonated; null when not active. */
  targetUid: string | null;
  /** Display name of the target — for the banner. */
  targetName: string | null;
  /** When impersonation started, ISO timestamp. */
  startedAt: string | null;

  start: (
    actor: { uid: string; email: string | null | undefined },
    target: { uid: string; name: string },
  ) => Promise<void>;

  end: (
    actor: { uid: string; email: string | null | undefined },
  ) => Promise<void>;
}

export const useImpersonationStore = create<ImpersonationState>((set, get) => ({
  targetUid: null,
  targetName: null,
  startedAt: null,

  start: async (actor, target) => {
    if (!actor?.uid || !target.uid) return;
    if (actor.uid === target.uid) return; // can't impersonate yourself
    set({
      targetUid: target.uid,
      targetName: target.name,
      startedAt: new Date().toISOString(),
    });
    try {
      await logAdminAction(
        actor,
        'user.impersonate.start',
        { uid: target.uid, label: target.name },
        { startedAt: new Date().toISOString() },
      );
    } catch {
      // Audit failure must not block the view. Already set in the store.
    }
  },

  end: async (actor) => {
    const { targetUid, startedAt } = get();
    if (!targetUid) return;
    set({ targetUid: null, targetName: null, startedAt: null });
    try {
      await logAdminAction(
        actor,
        'user.impersonate.end',
        { uid: targetUid },
        { startedAt, endedAt: new Date().toISOString() },
      );
    } catch { /* swallow */ }
  },
}));
