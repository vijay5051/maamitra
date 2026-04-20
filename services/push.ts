import { Platform } from 'react-native';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, getDoc, setDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { app, db } from './firebase';

/**
 * Per-topic push preferences stored on the user's profile doc. The
 * dispatcher Cloud Function reads these before firing each push — if
 * the relevant flag is `false`, the send is skipped silently.
 *
 * New users default to "everything on" so the experience out of the
 * box matches the in-app notification feed exactly.
 */
export interface NotifPrefs {
  reactions: boolean;
  comments: boolean;
  dms: boolean;
  follows: boolean;
  announcements: boolean;
}

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  reactions: true,
  comments: true,
  dms: true,
  follows: true,
  announcements: true,
};

/** Read the user's current prefs, defaulting missing fields to true. */
export async function loadNotifPrefs(uid: string): Promise<NotifPrefs> {
  if (!db) return { ...DEFAULT_NOTIF_PREFS };
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const stored = (snap.exists() ? snap.data()?.notifPrefs : null) as Partial<NotifPrefs> | null;
    return { ...DEFAULT_NOTIF_PREFS, ...(stored || {}) };
  } catch (_) {
    return { ...DEFAULT_NOTIF_PREFS };
  }
}

export async function updateNotifPref(
  uid: string,
  key: keyof NotifPrefs,
  value: boolean,
): Promise<void> {
  if (!db) return;
  try {
    await setDoc(
      doc(db, 'users', uid),
      {
        notifPrefs: { [key]: value },
        pushUpdatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (err) {
    console.error('updateNotifPref failed:', err);
  }
}

/**
 * MaaMitra — Web Push client
 *
 * Handles Firebase Cloud Messaging on the web: permission prompt, SW
 * registration, token grab, and persisting the token to the user's
 * profile so the dispatcher can target them.
 *
 * Native (iOS/Android apps) would need a different code path via
 * Expo Notifications — not implemented here because the app is
 * web-first today.
 */

// The VAPID public key from Firebase Console → Project Settings → Cloud
// Messaging → Web configuration → Web Push certificates. Browser-visible,
// not a secret. If this env var is missing the push flow is disabled
// gracefully — nothing explodes.
const VAPID_KEY = process.env.EXPO_PUBLIC_FCM_VAPID_KEY;

export interface PushState {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  token: string | null;
}

export async function checkPushSupport(): Promise<boolean> {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) return false;
  if (!('serviceWorker' in navigator)) return false;
  try {
    return await isSupported();
  } catch (_) {
    return false;
  }
}

export function currentPushPermission(): NotificationPermission | 'unsupported' {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Request notification permission and retrieve an FCM token. Persists
 * the token to `users/{uid}.fcmTokens` (arrayUnion) and flips
 * `pushEnabled: true` so the dispatcher knows to target this user.
 *
 * Returns null if the user denies, or if anything in the chain fails.
 * Caller can treat null as "not subscribed".
 */
export async function enablePush(uid: string): Promise<string | null> {
  if (!(await checkPushSupport())) return null;
  if (!app || !db) return null;
  if (!VAPID_KEY) {
    console.warn('[push] EXPO_PUBLIC_FCM_VAPID_KEY missing — set it in .env to enable push.');
    return null;
  }

  try {
    // Request permission. Safari/Firefox will show the browser prompt.
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return null;

    // Ensure our SW is registered. Firebase's getToken() does this
    // implicitly but we do it explicitly so we get a handle we can log.
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return null;

    // Persist. arrayUnion dedupes if the user re-enables on the same
    // browser. We'll prune stale tokens server-side when sends fail.
    await setDoc(
      doc(db, 'users', uid),
      {
        fcmTokens: arrayUnion(token),
        pushEnabled: true,
        pushUpdatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return token;
  } catch (err) {
    console.error('[push] enablePush failed:', err);
    return null;
  }
}

/**
 * Remove the current browser's token from the user's profile so future
 * sends skip this device. Actual OS-level permission revocation is a
 * browser-settings action the user must take themselves.
 */
export async function disablePush(uid: string, token: string | null): Promise<void> {
  if (!db) return;
  try {
    if (token) {
      await setDoc(
        doc(db, 'users', uid),
        {
          fcmTokens: arrayRemove(token),
          pushUpdatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }
    // Leave pushEnabled alone — the user may still have other devices.
  } catch (err) {
    console.error('[push] disablePush failed:', err);
  }
}

/**
 * Wire an in-page listener so pushes arriving while the tab is open
 * surface as a toast / in-app banner instead of being swallowed. Caller
 * provides the presenter (e.g. a simple setState to render a toast).
 *
 * Returns an unsubscribe function.
 */
export async function onForegroundMessage(
  handler: (args: { title: string; body: string; data?: Record<string, string> }) => void,
): Promise<(() => void) | null> {
  if (!(await checkPushSupport()) || !app) return null;
  try {
    const messaging = getMessaging(app);
    return onMessage(messaging, (payload) => {
      const title = payload.notification?.title || payload.data?.title || 'MaaMitra';
      const body = payload.notification?.body || payload.data?.body || '';
      handler({ title, body, data: payload.data as Record<string, string> | undefined });
    });
  } catch (err) {
    console.error('[push] onForegroundMessage failed:', err);
    return null;
  }
}
