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
// Fall back to the web client ID if a platform-specific one isn't configured.
// Google will accept an id_token whose audience is any OAuth client tied to
// this Firebase project, but the OAuth *request* on Android/iOS is more
// reliable when it uses a same-type client with the right package/SHA-1.
const ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || WEB_CLIENT_ID;
const IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || WEB_CLIENT_ID;

export function useGoogleSignIn() {
  // Authorization-code flow with PKCE. Android/iOS OAuth clients only
  // support `response_type=code` — they reject the implicit `id_token`
  // flow with `invalid_request 400`. Asking for the `openid` scope
  // makes Google return an `idToken` field on the resulting
  // `authentication` object, which is what Firebase needs for
  // `signInWithCredential`.
  const [request, , promptAsync] = Google.useAuthRequest({
    webClientId: WEB_CLIENT_ID,
    androidClientId: ANDROID_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
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
    // Authorization-code flow exposes tokens on `authentication`. Fall
    // back to `params.id_token` for older runtimes that still surface
    // it there.
    const idToken =
      result.authentication?.idToken ??
      (result.params as Record<string, string | undefined>).id_token;
    const accessToken = result.authentication?.accessToken;
    if (!idToken) {
      const err: any = new Error('Google did not return an ID token.');
      err.code = 'auth/missing-id-token';
      throw err;
    }
    const credential = GoogleAuthProvider.credential(idToken, accessToken);
    return signInWithCredential(auth, credential);
  }

  return { signIn, ready: Platform.OS === 'web' || !!request };
}
