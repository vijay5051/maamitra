import { Platform } from 'react-native';
import { saveUserProfile } from '../services/firebase';

/**
 * Cross-platform "ask for notification permission" helper. Called once
 * per user after they finish onboarding so we can fire vaccine reminders,
 * social notifications, and DM pings.
 *
 * - Web: delegates to the existing services/push.ts flow which also
 *   registers an FCM web-push token. That path is fully wired.
 * - Native (Android/iOS): asks the OS permission via expo-notifications.
 *   FCM token registration is not yet wired on native — once it is,
 *   plug it in here. For now we just record the permission status on
 *   the user profile so the dispatcher knows whether the user opted in.
 */

export type NotificationOptInResult =
  | { status: 'granted' | 'denied' | 'undetermined' | 'unsupported'; }
  | { status: 'error'; error: unknown };

export async function requestNotificationPermission(uid: string | null | undefined): Promise<NotificationOptInResult> {
  try {
    if (Platform.OS === 'web') {
      if (!uid) return { status: 'undetermined' };
      const { enablePushDetailed } = await import('../services/push');
      const result = await enablePushDetailed(uid);
      if (result.ok) return { status: 'granted' };
      if (result.reason === 'denied') return { status: 'denied' };
      return { status: 'unsupported' };
    }

    const Notifications = await import('expo-notifications');
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }

    if (uid) {
      try {
        await saveUserProfile(uid, {
          notificationPermission: status,
          notificationPermissionAskedAt: new Date().toISOString(),
        } as any);
      } catch {}
    }

    return { status: status as any };
  } catch (error) {
    return { status: 'error', error };
  }
}
