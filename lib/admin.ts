// Centralised admin detection.
//
// Two sources of truth need to agree on "who's an admin":
//   1. Firestore security rules (firestore.rules → isAdmin() helper)
//   2. Client-side UI gates (app/admin/_layout.tsx + routing bypasses)
//
// The canonical allow-list lives here and is imported anywhere the client
// needs to make that decision. Rules still hard-code the list on the server
// because security rules cannot import TS, but the two must stay in sync.
//
// Preferred path long-term is the Firebase custom claim `admin: true` — set
// via scripts/set-admin.mjs. The email list remains as a bootstrap fallback
// so a freshly-added admin can get in before the claim propagates. Both
// rule and client code treat either signal as sufficient.

const BUILTIN_ADMIN_EMAILS = [
  'admin@maamitra.app',
  'vijay@maamitra.app',
  'demo@maamitra.app', // preview / demo mode
] as const;

export const ADMIN_EMAILS: ReadonlySet<string> = new Set(
  [
    process.env.EXPO_PUBLIC_ADMIN_EMAIL ?? '',
    ...BUILTIN_ADMIN_EMAILS,
  ].filter((e): e is string => !!e).map((e) => e.toLowerCase()),
);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.toLowerCase());
}
