import { Platform } from 'react-native';
import { useEffect, useState } from 'react';
import type { UserCredential } from 'firebase/auth';
import {
  auth,
  buildGoogleProvider,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
} from '../services/firebase';

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

// Lazy-load the native module so the web bundle never reaches into it.
// `@react-native-google-signin/google-signin` requires Google Play Services
// at runtime, so it only ships in the Android/iOS native builds; the web
// build keeps using Firebase's signInWithPopup.
type NativeGoogleSignin = {
  configure: (opts: {
    webClientId?: string;
    iosClientId?: string;
    offlineAccess?: boolean;
    forceCodeForRefreshToken?: boolean;
  }) => void;
  hasPlayServices: (opts?: {
    showPlayServicesUpdateDialog?: boolean;
  }) => Promise<boolean>;
  signIn: () => Promise<{
    idToken: string | null;
    user: { id: string; email: string | null; name: string | null };
    serverAuthCode?: string | null;
  } | { type: string; data: { idToken: string | null } }>;
  signOut: () => Promise<void>;
};

let nativeGoogleSignin: NativeGoogleSignin | null = null;
let nativeStatusCodes: Record<string, string> | null = null;

if (Platform.OS !== 'web') {
  // require() so Metro can tree-shake on web; an `import` would force the
  // native module into the web bundle and crash at boot.
  const mod = require('@react-native-google-signin/google-signin');
  nativeGoogleSignin = mod.GoogleSignin;
  nativeStatusCodes = mod.statusCodes;
  // Configure once, lazily — webClientId is what Firebase needs as the
  // audience for the returned ID token.
  if (nativeGoogleSignin && WEB_CLIENT_ID) {
    nativeGoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      offlineAccess: false,
    });
  }
}

export function useGoogleSignIn() {
  const [ready, setReady] = useState(Platform.OS === 'web');

  useEffect(() => {
    if (Platform.OS === 'web' || !nativeGoogleSignin) return;
    let cancelled = false;
    // hasPlayServices is async; we treat the button as "not ready" until
    // we've confirmed Play Services is available on the device. If it
    // isn't, signIn() will surface a clear error to the user instead of
    // silently failing.
    nativeGoogleSignin
      .hasPlayServices({ showPlayServicesUpdateDialog: true })
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true); // still allow the click; signIn() will throw
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function signIn(): Promise<UserCredential> {
    if (!auth) {
      const err: any = new Error('Authentication is not configured.');
      err.code = 'auth/not-configured';
      throw err;
    }

    if (Platform.OS === 'web') {
      const provider = buildGoogleProvider();
      return signInWithPopup(auth, provider);
    }

    if (!nativeGoogleSignin) {
      const err: any = new Error('Google sign-in is not available in this build.');
      err.code = 'auth/not-configured';
      throw err;
    }

    try {
      await nativeGoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await nativeGoogleSignin.signIn();
      // Library v13+ returns { type: 'success', data: {...} }; older
      // versions return the user object directly. Normalise both.
      const data: any = (result as any).data ?? result;
      const idToken: string | null = data?.idToken ?? null;
      if (!idToken) {
        const err: any = new Error('Google did not return an ID token.');
        err.code = 'auth/missing-id-token';
        throw err;
      }
      const credential = GoogleAuthProvider.credential(idToken);
      return signInWithCredential(auth, credential);
    } catch (e: any) {
      // Map the library's status codes onto Firebase-style codes so
      // existing per-error UI in sign-in.tsx / sign-up.tsx keeps working.
      if (nativeStatusCodes) {
        if (e?.code === nativeStatusCodes.SIGN_IN_CANCELLED) {
          e.code = 'auth/popup-closed-by-user';
        } else if (e?.code === nativeStatusCodes.IN_PROGRESS) {
          e.code = 'auth/cancelled-popup-request';
        } else if (e?.code === nativeStatusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          e.code = 'auth/play-services-unavailable';
          e.message = 'Google Play Services is unavailable or out of date.';
        }
      }
      throw e;
    }
  }

  return { signIn, ready };
}
