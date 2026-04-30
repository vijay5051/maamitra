import { Platform } from 'react-native';
import { registerFcmToken, saveUserProfile } from '../services/firebase';

/**
 * Cross-platform "ask for notification permission" helper. Called once
 * per user after they finish onboarding so we can fire vaccine reminders,
 * social notifications, and DM pings.
 *
 * Both paths register an FCM token with `users/{uid}.fcmTokens` so the
 * admin dispatcher (`sendPushToUidList`) can deliver to this device.
 *
 * - Web: delegates to services/push.ts which handles SW registration +
 *   `getToken` against the JS Firebase Messaging SDK.
 * - Native (Android): uses `@react-native-firebase/messaging`. Calls
 *   requestPermission (Android 13+ POST_NOTIFICATIONS) then `getToken()`.
 */

export type NotificationOptInResult =
  | { status: 'granted' | 'denied' | 'undetermined' | 'unsupported'; tokenRegistered?: boolean; }
  | { status: 'error'; error: unknown };

export async function requestNotificationPermission(uid: string | null | undefined): Promise<NotificationOptInResult> {
  try {
    if (Platform.OS === 'web') {
      if (!uid) return { status: 'undetermined' };
      const { enablePushDetailed } = await import('../services/push');
      const result = await enablePushDetailed(uid);
      if (result.ok) return { status: 'granted', tokenRegistered: true };
      if (result.reason === 'denied') return { status: 'denied' };
      return { status: 'unsupported' };
    }

    // ─── Native (Android) ────────────────────────────────────────────────
    // Use @react-native-firebase/messaging directly. We tried
    // expo-notifications first but it doesn't expose a stable FCM token
    // on bare React Native Firebase apps — the messaging() singleton is
    // the source of truth and matches our Cloud Function dispatcher.
    const messagingModule = await import('@react-native-firebase/messaging');
    const messaging = messagingModule.default;

    // requestPermission returns AuthorizationStatus on iOS; Android returns
    // AUTHORIZED unless the user explicitly denied. On Android 13+ this
    // also surfaces the POST_NOTIFICATIONS runtime permission dialog.
    const authStatus = await messaging().requestPermission();
    const { AuthorizationStatus } = messagingModule;
    const enabled =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      if (uid) {
        try {
          await saveUserProfile(uid, {
            notificationPermission: 'denied',
            notificationPermissionAskedAt: new Date().toISOString(),
          } as any);
        } catch {}
      }
      return { status: 'denied' };
    }

    // Permission granted — get the FCM device token and register it.
    let token: string | null = null;
    try {
      token = await messaging().getToken();
    } catch (err) {
      console.warn('[push] getToken failed:', err);
    }

    if (uid && token) {
      try {
        await registerFcmToken(uid, token);
        await saveUserProfile(uid, {
          notificationPermission: 'granted',
          notificationPermissionAskedAt: new Date().toISOString(),
        } as any);
      } catch (err) {
        console.warn('[push] registerFcmToken failed:', err);
      }
    } else if (uid) {
      // Permission granted but token fetch failed — still record the opt-in
      // so we can retry later (token-refresh listener at app boot will
      // attempt again).
      try {
        await saveUserProfile(uid, {
          notificationPermission: 'granted',
          notificationPermissionAskedAt: new Date().toISOString(),
        } as any);
      } catch {}
    }

    return { status: 'granted', tokenRegistered: !!token };
  } catch (error) {
    console.error('[push] requestNotificationPermission error:', error);
    return { status: 'error', error };
  }
}
