/**
 * Structured observability for auth state transitions.
 *
 * Why: when admins report "user X couldn't sign in", these logs let us
 * trace the exact transition path without guessing. Every gate, every
 * router decision, every sign-out, every method success/failure is logged
 * with a stable event type that grep / log search can pivot on.
 *
 * Stays on console.warn for now (no external analytics yet). Can be
 * upgraded to a real analytics pipe (Mixpanel / Amplitude / Sentry) by
 * swapping the emit() implementation — every call site already passes
 * structured data.
 */

export type AuthState = 'SPLASH' | 'UNAUTHED' | 'PHONE_GATE' | 'ONBOARDING' | 'APP';

export type AuthEvent =
  | { type: 'auth:gate-pending'; reason: 'auth-loading' | 'profile-hydrating' | 'firestore-fetching'; uid?: string }
  | { type: 'auth:transition'; from: AuthState; to: AuthState; uid?: string }
  | { type: 'auth:signout-started'; uid?: string }
  | { type: 'auth:signout-completed'; uid?: string }
  | { type: 'auth:signout-failed'; uid?: string; error: string }
  | { type: 'auth:phone-otp-sent'; e164Masked: string }
  | { type: 'auth:phone-otp-verified'; uid: string }
  | { type: 'auth:phone-otp-failed'; reason: string }
  | { type: 'auth:google-success'; uid: string; email?: string }
  | { type: 'auth:apple-success'; uid: string; email?: string }
  | { type: 'auth:method-cancelled'; method: 'google' | 'apple' | 'phone' }
  | { type: 'auth:web-persistence-failed'; error: string }
  | { type: 'auth:cache-escape-hatch-triggered' }
  | { type: 'auth:delete-started'; uid?: string }
  | { type: 'auth:delete-completed'; uid?: string }
  | { type: 'auth:delete-failed'; uid?: string; error: string; reason?: 'stale-session' | 'network' | 'unknown' };

function maskEmail(email?: string): string | undefined {
  if (!email) return undefined;
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  if (local.length <= 1) return `*@${domain}`;
  return `${local[0]}***@${domain}`;
}

/**
 * Emit a structured auth event.
 *
 * PII-handling contract:
 * - `email` fields on any event are auto-masked here (e.g. `priya@example.com` → `p***@example.com`).
 * - Phone numbers are NOT auto-masked. Callers must pre-mask before constructing the
 *   event payload — that's why the field is named `e164Masked`, not `e164`. The naming
 *   is intentional: it forces the caller to think about masking at the call site.
 * - All other fields (`uid`, `reason`, `error`, etc.) are emitted as-is. Do NOT add
 *   raw PII (full name, address, etc.) to any AuthEvent variant.
 *
 * Output format: `console.warn(`[${type}]`, { ...payload, ts })`. The two-argument
 * form is chosen for grep-friendliness in dev; structured aggregators may need to
 * be wired via a future emit() abstraction.
 */
export function logAuthEvent(event: AuthEvent): void {
  const payload: Record<string, unknown> = { ...event, ts: Date.now() };
  // Mask any PII fields before emit
  if ('email' in payload && typeof payload.email === 'string') {
    payload.email = maskEmail(payload.email as string);
  }
  const { type, ...rest } = payload as { type: string; [k: string]: unknown };
  // eslint-disable-next-line no-console
  console.warn(`[${type}]`, rest);
}
