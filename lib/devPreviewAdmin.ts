// Dev-only admin preview bypass.
//
// When an unauthenticated session needs to render the admin panel for local
// preview / screenshot work, this module injects a fake admin user into
// useAuthStore so the auth gate in app/admin/_layout.tsx lets us through.
//
// Strict guards — this code path is unreachable in production:
//   - `__DEV__ === true`  (Metro / web dev server only; stripped from prod)
//   - Web only            (no native bypass)
//   - Localhost only      (window.location.hostname check)
//   - Opt-in              (URL `?previewAdmin=1` or `localStorage.previewAdmin=true`)
//
// The injected email is `demo@maamitra.app`, which is in the founder allow-
// list — so isAdminEmail() returns true and useAdminRole() resolves 'super'
// without any Firestore round-trip. No real Firebase user is created.
//
// Usage in a local browser:
//   1. Visit http://localhost:8081/?previewAdmin=1 — once is enough; the
//      bypass remembers itself in localStorage so subsequent reloads stay
//      logged in as the demo admin.
//   2. To exit: visit http://localhost:8081/?previewAdmin=0 (or run
//      `localStorage.removeItem('previewAdmin')` and reload).

import { Platform } from 'react-native';

import { useAuthStore } from '../store/useAuthStore';

const DEMO_USER = {
  uid: 'preview-admin',
  name: 'Preview Admin',
  email: 'demo@maamitra.app',
  emailVerified: true,
  isGoogleSignIn: false,
} as const;

const STORAGE_KEY = 'previewAdmin';

function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local');
}

function readUrlIntent(): 'enable' | 'disable' | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const v = params.get('previewAdmin');
  if (v === '1' || v === 'true') return 'enable';
  if (v === '0' || v === 'false') return 'disable';
  return null;
}

function readPersistedFlag(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage?.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writePersistedFlag(on: boolean): void {
  try {
    if (typeof window === 'undefined') return;
    if (on) window.localStorage?.setItem(STORAGE_KEY, 'true');
    else window.localStorage?.removeItem(STORAGE_KEY);
  } catch { /* private mode etc — silently ignore */ }
}

/**
 * Inject the fake admin into the auth store. Safe to call multiple times.
 */
function activate(): void {
  // Avoid stomping a real signed-in user — only inject when nobody is logged in.
  const cur = useAuthStore.getState();
  if (cur.user && cur.user.uid !== DEMO_USER.uid) return;
  useAuthStore.setState({
    user: { ...DEMO_USER },
    isAuthenticated: true,
    isLoading: false,
  });
  // eslint-disable-next-line no-console
  console.info('[devPreviewAdmin] injected demo admin — strip this hook from prod via __DEV__ gate.');
}

function deactivate(): void {
  const cur = useAuthStore.getState();
  if (cur.user?.uid === DEMO_USER.uid) {
    useAuthStore.setState({ user: null, isAuthenticated: false });
  }
}

/**
 * Wire the bypass on app boot. Caller is the root layout; it should gate
 * the call on `__DEV__` (Metro strips the import branch in prod builds).
 *
 * Runs both at module-load time AND when invoked from a useEffect, so the
 * fake user is in place before any child layout's auth gate fires.
 */
export function maybeEnablePreviewAdmin(): void {
  if (Platform.OS !== 'web') return;
  if (!isLocalhost()) return;

  const intent = readUrlIntent();
  if (intent === 'enable') {
    writePersistedFlag(true);
    activate();
    return;
  }
  if (intent === 'disable') {
    writePersistedFlag(false);
    deactivate();
    return;
  }
  if (readPersistedFlag()) activate();
}

// Module-load activation. Critical: child layouts mount and run their auth
// gate BEFORE the root layout's useEffect fires, so calling this from
// useEffect alone is too late and the admin gate bounces us. Running at
// import time guarantees the user is in the store before any layout reads
// it. Production strips this whole module via the __DEV__ guard at the
// import site.
//
// We also subscribe to store changes so the real Firebase onAuthStateChanged
// listener doesn't immediately wipe the fake user back to null. While the
// preview flag is on, every transition to user=null is reverted.
if (typeof window !== 'undefined') {
  try { maybeEnablePreviewAdmin(); } catch { /* noop */ }
  let resubscribed = false;
  if (Platform.OS === 'web' && isLocalhost() && !resubscribed) {
    resubscribed = true;
    useAuthStore.subscribe((state) => {
      if (!readPersistedFlag()) return;
      if (state.user === null) activate();
    });
  }
}
