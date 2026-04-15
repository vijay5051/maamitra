// ─── App Identity ──────────────────────────────────────────────────────────────
export const APP_NAME = 'MaaMitra';
export const APP_TAGLINE =
  'Your trusted AI companion through pregnancy, birth & early childhood';

// ─── AI Model ──────────────────────────────────────────────────────────────────
export const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';

// ─── Chat Limits ───────────────────────────────────────────────────────────────
export const MAX_CHAT_HISTORY = 50;

// ─── Firebase Configuration ───────────────────────────────────────────────────
export const FIREBASE_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
} as const;

// ─── Guard Functions ───────────────────────────────────────────────────────────

/**
 * Returns true only when every required Firebase environment variable is set
 * (non-empty). Use this before initialising the Firebase SDK.
 */
export function isFirebaseConfigured(): boolean {
  return (
    Boolean(FIREBASE_CONFIG.apiKey) &&
    Boolean(FIREBASE_CONFIG.authDomain) &&
    Boolean(FIREBASE_CONFIG.projectId) &&
    Boolean(FIREBASE_CONFIG.storageBucket) &&
    Boolean(FIREBASE_CONFIG.messagingSenderId) &&
    Boolean(FIREBASE_CONFIG.appId)
  );
}

/**
 * Returns true only when the Anthropic API key environment variable is set
 * (non-empty). Use this before calling the Anthropic SDK.
 */
export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY);
}
