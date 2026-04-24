import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import type { UserCredential } from 'firebase/auth';
import {
  auth,
  buildGoogleProvider,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
} from '../services/firebase';

// Finishes the auth session redirect on web — no-op on native but recommended.
WebBrowser.maybeCompleteAuthSession();

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export function useGoogleSignIn() {
  // Expo's Google provider requires this hook to be called on every render.
  // On web it initialises a redirect-based request; on native it wires up a
  // system-browser OAuth flow that returns via the app's scheme.
  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: WEB_CLIENT_ID,
    androidClientId: WEB_CLIENT_ID,
    iosClientId: WEB_CLIENT_ID,
  });

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

    const result = await promptAsync();
    if (result.type === 'cancel' || result.type === 'dismiss') {
      const err: any = new Error('Sign-in cancelled.');
      err.code = 'auth/popup-closed-by-user';
      throw err;
    }
    if (result.type !== 'success') {
      const err: any = new Error('Google sign-in failed.');
      err.code = 'auth/google-signin-failed';
      throw err;
    }
    const idToken = (result.params as Record<string, string | undefined>).id_token;
    if (!idToken) {
      const err: any = new Error('Google did not return an ID token.');
      err.code = 'auth/missing-id-token';
      throw err;
    }
    const credential = GoogleAuthProvider.credential(idToken);
    return signInWithCredential(auth, credential);
  }

  return { signIn, ready: Platform.OS === 'web' || !!request };
}
