import { create } from 'zustand';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  isFirebaseConfigured,
  auth,
  saveUserProfile,
  getUserProfile,
} from '../services/firebase';

interface AuthUser {
  uid: string;
  name: string;
  email: string;
}

const MOCK_USER: AuthUser = {
  uid: 'demo-user',
  name: 'Demo Mom',
  email: 'demo@maamitra.app',
};

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  initAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  signIn: async (email: string, password: string) => {
    if (!isFirebaseConfigured() || !auth) {
      // Mock auth — demo mode
      set({ user: MOCK_USER, isAuthenticated: true, isLoading: false });
      return;
    }
    set({ isLoading: true });
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const profile = await getUserProfile(credential.user.uid);
      const authUser: AuthUser = {
        uid: credential.user.uid,
        name: profile?.name ?? credential.user.displayName ?? 'Mom',
        email: credential.user.email ?? email,
      };
      set({ user: authUser, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signUp: async (email: string, password: string, name: string) => {
    if (!isFirebaseConfigured() || !auth) {
      set({ user: MOCK_USER, isAuthenticated: true, isLoading: false });
      return;
    }
    set({ isLoading: true });
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const authUser: AuthUser = {
        uid: credential.user.uid,
        name,
        email: credential.user.email ?? email,
      };
      await saveUserProfile(credential.user.uid, { name, email, createdAt: new Date().toISOString() });
      set({ user: authUser, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signOut: async () => {
    if (!isFirebaseConfigured() || !auth) {
      set({ user: null, isAuthenticated: false });
      return;
    }
    try {
      await firebaseSignOut(auth);
      set({ user: null, isAuthenticated: false });
    } catch (error) {
      console.error('signOut error:', error);
      throw error;
    }
  },

  initAuth: () => {
    if (!isFirebaseConfigured() || !auth) {
      // No Firebase — use demo user so the app can be previewed
      set({ user: MOCK_USER, isAuthenticated: true, isLoading: false });
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await getUserProfile(firebaseUser.uid);
          const authUser: AuthUser = {
            uid: firebaseUser.uid,
            name: profile?.name ?? firebaseUser.displayName ?? 'Mom',
            email: firebaseUser.email ?? '',
          };
          set({ user: authUser, isAuthenticated: true, isLoading: false });
        } catch {
          set({
            user: {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName ?? 'Mom',
              email: firebaseUser.email ?? '',
            },
            isAuthenticated: true,
            isLoading: false,
          });
        }
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    });

    // Return unsubscribe — callers can store this if needed
    return unsubscribe;
  },
}));
