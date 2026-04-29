// Centralised admin detection + RBAC.
//
// Two sources of truth need to agree on "who's an admin":
//   1. Firestore security rules (firestore.rules → isAdmin())
//   2. Client-side UI gates (app/admin/_layout.tsx + routing)
//
// The canonical email allow-list lives here and is imported anywhere the
// client needs to make that decision. Rules still hard-code the list on the
// server because security rules cannot import TS, but the two must stay in
// sync.
//
// Preferred path long-term is the Firebase custom claim `admin: true` — set
// via scripts/set-admin.mjs. The email list remains as a bootstrap fallback
// so a freshly-added admin can get in before the claim propagates. Both
// rules and client code treat either signal as sufficient.
//
// Roles:
//   - 'super'     : everything. Email allow-list + super claim.
//   - 'moderator' : community + support + per-user push, no settings/RBAC.
//   - 'support'   : support inbox + read-only user view.
//   - 'content'   : content/vaccines/banner; no community moderation.
//
// Storage:
//   - users/{uid}.adminRole — string in {'super','moderator','support','content'}.
//   - Email allow-list below = implicit 'super' so the founder is never
//     locked out.

const BUILTIN_ADMIN_EMAILS = [
  'admin@maamitra.app',
  'vijay@maamitra.app',
  'rocking.vsr@gmail.com',
  'demo@maamitra.app', // preview / demo mode
] as const;

export const ADMIN_EMAILS: ReadonlySet<string> = new Set(
  [
    process.env.EXPO_PUBLIC_ADMIN_EMAIL ?? '',
    ...BUILTIN_ADMIN_EMAILS,
  ].filter((e): e is string => !!e).map((e) => e.toLowerCase()),
);

export type AdminRole = 'super' | 'moderator' | 'support' | 'content';

export const ADMIN_ROLES: AdminRole[] = ['super', 'moderator', 'support', 'content'];

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  super: 'Super admin',
  moderator: 'Moderator',
  support: 'Support',
  content: 'Content editor',
};

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.toLowerCase());
}

/**
 * Resolve a role for a (user, profileDoc) pair. The profileDoc is the
 * `users/{uid}` Firestore doc — pass it in at the call site rather than
 * re-reading on every check.
 */
export function resolveAdminRole(
  email: string | null | undefined,
  profileDoc: { adminRole?: string } | null | undefined,
): AdminRole | null {
  if (isAdminEmail(email)) return 'super';
  const r = profileDoc?.adminRole;
  if (r === 'super' || r === 'moderator' || r === 'support' || r === 'content') return r;
  return null;
}

// ─── Capability matrix ───────────────────────────────────────────────────────

export type AdminCapability =
  | 'view_dashboard'
  | 'view_users'
  | 'view_user_360'
  | 'view_audit_log'
  | 'delete_user'
  | 'change_user_role'
  | 'manage_admin_roles'
  | 'edit_settings'
  | 'manage_feature_flags'
  | 'moderate_posts'
  | 'moderate_comments'
  | 'block_user'
  | 'view_support'
  | 'reply_support'
  | 'close_ticket'
  | 'send_personal_push'
  | 'send_broadcast_push'
  | 'schedule_push'
  | 'manage_banner'
  | 'edit_content'
  | 'edit_vaccines'
  | 'publish_content'
  | 'export_user_data'
  | 'hard_delete_user';

const CAP_BY_ROLE: Record<AdminRole, ReadonlySet<AdminCapability>> = {
  super: new Set<AdminCapability>([
    'view_dashboard', 'view_users', 'view_user_360', 'view_audit_log',
    'delete_user', 'change_user_role', 'manage_admin_roles',
    'edit_settings', 'manage_feature_flags',
    'moderate_posts', 'moderate_comments', 'block_user',
    'view_support', 'reply_support', 'close_ticket',
    'send_personal_push', 'send_broadcast_push', 'schedule_push', 'manage_banner',
    'edit_content', 'edit_vaccines', 'publish_content',
    'export_user_data', 'hard_delete_user',
  ]),
  moderator: new Set<AdminCapability>([
    'view_dashboard', 'view_users', 'view_user_360',
    'moderate_posts', 'moderate_comments', 'block_user',
    'view_support', 'reply_support', 'close_ticket',
    'send_personal_push',
    'export_user_data',
  ]),
  support: new Set<AdminCapability>([
    'view_dashboard', 'view_users', 'view_user_360',
    'view_support', 'reply_support', 'close_ticket',
    'send_personal_push',
    'export_user_data',
  ]),
  content: new Set<AdminCapability>([
    'view_dashboard',
    'edit_content', 'edit_vaccines', 'publish_content',
    'manage_banner',
    'send_broadcast_push', 'schedule_push',
  ]),
};

export function can(role: AdminRole | null | undefined, cap: AdminCapability): boolean {
  if (!role) return false;
  return CAP_BY_ROLE[role].has(cap);
}
