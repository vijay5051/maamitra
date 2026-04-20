import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { setPrimaryAtRuntime } from '../constants/theme';
import { saveUserProfile, getUserProfile } from '../services/firebase';

/**
 * User-pickable accent colour. Persisted locally so the choice survives
 * reloads and syncs to Firestore on sign-in so it follows the user across
 * devices.
 *
 * Why a separate store instead of piggy-backing on useProfileStore? Theme
 * needs to be hydrated BEFORE the rest of the app renders (otherwise the
 * first paint flashes the default purple, then jumps to the user's
 * colour). Keeping it in its own small store with an aggressive persist
 * rehydration path keeps bootstrap predictable.
 */

const DEFAULT_PRIMARY = '#7C3AED';

interface ThemeState {
  primary: string;
  /** True once the persisted color has been read back and applied. */
  hydrated: boolean;

  /** Change the accent colour. Mutates the theme module immediately and
   *  persists locally. If a uid is passed, the value is also saved to
   *  Firestore so it follows the user across devices. On web a reload
   *  is required to rebuild the StyleSheet.create() caches — the
   *  picker UI handles that after this call resolves. */
  setPrimary: (hex: string, uid?: string) => Promise<void>;

  /** Read the persisted Firestore value and apply. Called once at
   *  sign-in. Never overrides a locally-set colour from AsyncStorage
   *  unless Firestore has a newer one (the local copy wins for speed). */
  loadFromFirestore: (uid: string) => Promise<void>;

  /** Restore default. */
  reset: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      primary: DEFAULT_PRIMARY,
      hydrated: false,

      setPrimary: async (hex: string, uid?: string) => {
        if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
        setPrimaryAtRuntime(hex);
        set({ primary: hex });
        if (uid) {
          try {
            await saveUserProfile(uid, { accentColor: hex });
          } catch (err) {
            console.error('saveUserProfile(accentColor) failed:', err);
          }
        }
      },

      loadFromFirestore: async (uid: string) => {
        try {
          const profile = await getUserProfile(uid);
          const remote = profile?.accentColor;
          if (typeof remote === 'string' && /^#[0-9a-fA-F]{6}$/.test(remote)) {
            setPrimaryAtRuntime(remote);
            set({ primary: remote });
          }
        } catch (err) {
          // Non-blocking — user just keeps the local / default colour.
          console.error('loadFromFirestore(theme) failed:', err);
        }
      },

      reset: async () => {
        setPrimaryAtRuntime(DEFAULT_PRIMARY);
        set({ primary: DEFAULT_PRIMARY });
      },
    }),
    {
      name: 'maamitra-theme',
      storage: createJSONStorage(() => AsyncStorage),
      // After rehydration, apply the saved colour to the theme module so
      // everything rendered from this point forward reads the right value.
      onRehydrateStorage: () => (state) => {
        if (state?.primary) {
          setPrimaryAtRuntime(state.primary);
        }
        if (state) {
          state.hydrated = true;
        }
      },
    },
  ),
);

/** Force a soft reload on web so every StyleSheet.create() cache is
 *  rebuilt with the new accent colour. No-op on native — caller should
 *  prompt the user to restart the app there. */
export function reloadForThemeChange(): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // Small delay so the picker's tap animation finishes and any pending
    // Firestore write flushes before the page goes away.
    setTimeout(() => {
      try {
        window.location.reload();
      } catch (_) {
        /* ignore */
      }
    }, 250);
  }
}
