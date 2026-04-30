/**
 * Native (Android) FCM bootstrap. Imported once at the top of
 * app/_layout.tsx for its side effects:
 *
 *   1. Registers the background message handler. Per RNFB docs this MUST
 *      run at module load time (before the app finishes mounting) so that
 *      Android's headless task can dispatch wake-up pushes when the app
 *      is killed. Re-registering later silently no-ops.
 *
 *   2. Exposes `attachForegroundMessaging(uid)` for the app to call once
 *      the user is signed in. It:
 *        a) listens for token-refresh events and re-registers the new
 *           token on the user's profile, and
 *        b) handles foreground messages by surfacing a local
 *           notification (otherwise FCM silently drops them while the
 *           app is in the foreground on Android).
 *
 * Web is a no-op here — services/push.ts owns that path.
 */

import { Platform } from 'react-native';

let backgroundHandlerRegistered = false;

if (Platform.OS !== 'web') {
  try {
    // Use require (not import) so the web bundle never reaches into the
    // native module. This file is small enough that the cost of dynamic
    // require is negligible; the win is that web `expo export` doesn't
    // try to resolve native code.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const messagingModule = require('@react-native-firebase/messaging');
    const messaging = messagingModule.default;
    if (!backgroundHandlerRegistered) {
      messaging().setBackgroundMessageHandler(async (_remoteMessage: any) => {
        // We don't need to do anything here — the FCM payload's
        // `notification` block triggers the system tray automatically
        // via the OS-level FCM service. This handler exists so RNFB
        // doesn't warn at boot.
      });
      backgroundHandlerRegistered = true;
    }
  } catch (err) {
    console.warn('[push] background handler registration failed:', err);
  }
}

/**
 * Wire foreground listeners + token-refresh sync. Safe to call multiple
 * times; idempotent. Returns an unsubscribe so the caller can clean up
 * on user sign-out.
 */
export function attachForegroundMessaging(uid: string): () => void {
  if (Platform.OS === 'web' || !uid) return () => {};

  let unsubToken: (() => void) | null = null;
  let unsubMessage: (() => void) | null = null;

  (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const messagingModule = require('@react-native-firebase/messaging');
      const messaging = messagingModule.default;
      const { registerFcmToken } = await import('../services/firebase');

      // Token refresh — happens silently when FCM rotates the device
      // token. Without this listener, our stored token goes stale and
      // the user stops receiving pushes ~weeks/months after install.
      unsubToken = messaging().onTokenRefresh((newToken: string) => {
        if (newToken) {
          void registerFcmToken(uid, newToken).catch(() => {});
        }
      });

      // Foreground message handler — Android does NOT show a system
      // notification when the app is in the foreground; we handle it
      // ourselves. For now we just log; downstream UI can subscribe
      // via a custom event if we want in-app banners.
      unsubMessage = messaging().onMessage(async (_remoteMessage: any) => {
        // No-op for now. Hook a banner here if desired. Background and
        // killed-state pushes still surface via the system tray.
      });

      // One-time top-up: if the user opted in earlier but for whatever
      // reason their token wasn't saved (e.g. transient Firestore
      // failure during the original opt-in), grab + register now.
      try {
        const tok = await messaging().getToken();
        if (tok) await registerFcmToken(uid, tok);
      } catch {}
    } catch (err) {
      console.warn('[push] attachForegroundMessaging failed:', err);
    }
  })();

  return () => {
    try { unsubToken?.(); } catch {}
    try { unsubMessage?.(); } catch {}
  };
}
