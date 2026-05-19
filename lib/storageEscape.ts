/**
 * The "stuck cache" escape hatch.
 *
 * When a browser ends up in an unrecoverable state (private mode that
 * lost its in-memory persistence, corrupted localStorage, third-party
 * cookie blocks that broke Firebase reCAPTCHA), the welcome screen
 * surfaces a "Reset local storage" link after 5 seconds of loading.
 * Tapping it confirms with the user, then calls this function.
 *
 * On web: localStorage.clear() + sessionStorage.clear() + reload.
 * On native: AsyncStorage.clear() + Expo Updates.reloadAsync().
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { logAuthEvent } from './authObservability';

export async function wipeAllLocalStorage(): Promise<void> {
  logAuthEvent({ type: 'auth:cache-escape-hatch-triggered' });

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      window.localStorage?.clear();
    } catch {
      // localStorage may be disabled in private mode — ignore
    }
    try {
      window.sessionStorage?.clear();
    } catch {
      // same
    }
    try {
      // Reload to clear in-memory state
      window.location.reload();
    } catch {
      // ignore
    }
    return;
  }

  try {
    await AsyncStorage.clear();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('AsyncStorage clear failed:', err);
  }
  try {
    const Updates = await import('expo-updates');
    await Updates.reloadAsync();
  } catch {
    // If expo-updates isn't available (dev), the next app launch will pick
    // up the cleared storage anyway.
  }
}
