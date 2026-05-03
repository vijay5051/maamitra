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

/**
 * Detailed reason a browser can or cannot do web push. Surfaces the
 * exact missing capability so the toggle UI can explain itself — iOS
 * PWA is especially finicky (home-screen launch required, FCM's own
 * isSupported() is unreliable on iOS even when push works).
 */
export type PushSupportStatus =
  | { ok: true }
  | { ok: false; reason: 'platform-native' | 'ssr' | 'no-notification-api' | 'no-service-worker' | 'no-push-manager' | 'no-indexed-db' | 'ios-not-standalone' | 'fcm-unsupported'; hint?: string };

export async function checkPushSupportDetailed(): Promise<PushSupportStatus> {
  if (Platform.OS !== 'web') return { ok: false, reason: 'platform-native' };
  if (typeof window === 'undefined') return { ok: false, reason: 'ssr' };

  // Check iOS *before* the generic API probes — iOS Safari in a regular
  // tab fails the PushManager / serviceWorker checks no matter the Safari
  // version, and the actionable fix is always "add to Home Screen", not
  // "your browser doesn't support push". Returning the generic reason
  // here was confusing every iOS user.
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const nav = (typeof navigator !== 'undefined' ? navigator : {}) as any;
  const isStandalone =
    nav.standalone === true ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches);
  if (isIos && !isStandalone) {
    return {
      ok: false,
      reason: 'ios-not-standalone',
      hint:
        'On iPhone, push notifications work only when MaaMitra is added to your Home Screen.\n\n' +
        '1. Tap the Share icon (square with an arrow) at the bottom of Safari\n' +
        '2. Scroll and tap "Add to Home Screen"\n' +
        '3. Open MaaMitra from the new Home Screen icon and try again.\n\n' +
        '(Requires iOS 16.4 or newer.)',
    };
  }

  if (!('Notification' in window)) return { ok: false, reason: 'no-notification-api' };
  if (!('serviceWorker' in navigator)) return { ok: false, reason: 'no-service-worker' };
  if (!('PushManager' in window)) return { ok: false, reason: 'no-push-manager' };
  if (!('indexedDB' in window)) return { ok: false, reason: 'no-indexed-db' };

  // Finally, ask FCM's own check — but treat a `false` here on iOS as
  // informational rather than a hard block. FCM's isSupported() checks
  // for features we've already validated above; when it still returns
  // false on iOS PWA it's usually because the SDK hasn't been updated
  // with iOS-awareness. We still let the user try.
  try {
    const fcmOk = await isSupported();
    if (!fcmOk && !isIos) {
      return { ok: false, reason: 'fcm-unsupported' };
    }
  } catch (_) {
    if (!isIos) return { ok: false, reason: 'fcm-unsupported' };
  }
  return { ok: true };
}

/** Back-compat boolean helper. Prefer checkPushSupportDetailed(). */
export async function checkPushSupport(): Promise<boolean> {
  const s = await checkPushSupportDetailed();
  return s.ok;
}

export function currentPushPermission(): NotificationPermission | 'unsupported' {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/** Richer result so the UI can render a specific error if something fails. */
export type EnablePushResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'unsupported' | 'not-configured' | 'no-vapid-key' | 'denied' | 'sw-registration-failed' | 'token-failed' | 'firestore-failed'; detail?: string };

/**
 * Request notification permission and retrieve an FCM token. Persists
 * the token to `users/{uid}.fcmTokens` (arrayUnion) and flips
 * `pushEnabled: true` so the dispatcher knows to target this user.
 *
 * Returns a discriminated result so the caller can show a specific
 * error (iOS PWA paths surface distinct failures).
 */
export async function enablePushDetailed(uid: string): Promise<EnablePushResult> {
  const support = await checkPushSupportDetailed();
  if (!support.ok) return { ok: false, reason: 'unsupported', detail: (support as any).hint };
  if (!app || !db) return { ok: false, reason: 'not-configured' };
  if (!VAPID_KEY) {
    console.warn('[push] EXPO_PUBLIC_FCM_VAPID_KEY missing — set it in .env to enable push.');
    return { ok: false, reason: 'no-vapid-key' };
  }

  // 1. Permission — must be triggered by a direct user gesture.
  let perm: NotificationPermission;
  try {
    perm = await Notification.requestPermission();
  } catch (err: any) {
    return { ok: false, reason: 'denied', detail: err?.message };
  }
  if (perm !== 'granted') {
    return { ok: false, reason: 'denied' };
  }

  // 2. Service worker. Use getRegistration first — iOS tends to already
  // have one active after page load, and registering a second time
  // confuses the FCM SDK.
  let registration: ServiceWorkerRegistration | undefined;
  try {
    registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    if (!registration) {
      registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    }
    // On iOS, the SW can be in 'installing' state when getToken fires —
    // wait for `ready` so the push subscription endpoint is available.
    await navigator.serviceWorker.ready;
  } catch (err: any) {
    console.error('[push] SW register failed:', err);
    return { ok: false, reason: 'sw-registration-failed', detail: err?.message };
  }

  // 3. Token.
  let token: string | null = null;
  try {
    const messaging = getMessaging(app);
    token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
  } catch (err: any) {
    console.error('[push] getToken failed:', err);
    return { ok: false, reason: 'token-failed', detail: err?.message };
  }
  if (!token) return { ok: false, reason: 'token-failed', detail: 'Firebase returned an empty token.' };

  // 4. Persist.
  try {
    await setDoc(
      doc(db, 'users', uid),
      {
        fcmTokens: arrayUnion(token),
        pushEnabled: true,
        pushUpdatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (err: any) {
    console.error('[push] save token failed:', err);
    return { ok: false, reason: 'firestore-failed', detail: err?.message };
  }

  return { ok: true, token };
}

/** Back-compat wrapper for call sites that only want the token-or-null shape. */
export async function enablePush(uid: string): Promise<string | null> {
  const r = await enablePushDetailed(uid);
  return r.ok ? r.token : null;
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
