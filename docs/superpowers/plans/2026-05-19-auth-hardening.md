# Auth Hardening Implementation Plan (Plan A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the two historical production bugs (sign-in routing to signup form; sign-out flashing onboarding) and harden the auth module to military-grade reliability — without changing any user-visible UI or visual design.

**Architecture:** Pure hardening pass. We add a third gate to the cold-start router, unify all sign-out paths behind a single hook, codify atomic state transitions in the auth store, add observability, add a 5-second cache-stuck escape hatch, and extend the schema for Plan B. No new screens. No design changes. Ships independently.

**Tech Stack:** Expo Router · React Native · Zustand (with persist) · Firebase Auth · `bun:test` for tests.

**Source spec:** `docs/superpowers/specs/2026-05-19-streamlined-signup-design.md` — §5.8 (Sign-out flow), §10b (Auth hardening H1–H10).

**Out of scope for this plan (deferred to Plan B):**
- New welcome / auth entry screen UI
- Phone gate redesign (only behavioural strictness changes here)
- Onboarding form redesign
- Just-in-time prompts UI
- Apple Sign-In implementation
- Deleting `sign-up.tsx` / `sign-in.tsx` / `forgot-password.tsx` / `verify-email.tsx`

---

## File structure overview

**Files to create:**
- `lib/authObservability.ts` — Structured logging primitives for auth state transitions.
- `lib/storageEscape.ts` — Reset-local-storage escape hatch utility (web + native).
- `hooks/useSignOut.ts` — Unified sign-out hook (the only allowed sign-out path).
- `components/auth/SignOutConfirmModal.tsx` — Branded confirmation modal.
- `components/auth/SignOutOverlay.tsx` — Loading + success overlay used during sign-out.
- `tests/authObservability.test.ts`
- `tests/storageEscape.test.ts`
- `tests/gender-types.test.ts`
- `tests/dismissed-prompts.test.ts`
- `tests/grep-signout.test.ts` — Build-time check that no callsite uses raw `signOut()` outside the hook.

**Files to modify:**
- `store/useProfileStore.ts` — Add `'not-set'` to Gender; add `dismissedPrompts: Record<string,boolean>` map; add `cachedProfileUid` invalidation helper.
- `store/useAuthStore.ts` — Add `firestoreHydratedForUid: string | null` tracking; emit observability events on every transition.
- `lib/promptBuilder.ts` — Treat `'not-set'` identically to `'surprise'` for kid-gender word.
- `app/index.tsx` — Add the third gate (cache-trust) to the cold-start guard.
- `app/(auth)/welcome.tsx` — Add the 5-second cache-stuck escape link (purely additive; existing UI untouched).
- `app/admin/index.tsx` (line 109) — Replace raw `signOut()` with `useSignOut().confirm()`.
- `app/admin/settings.tsx` (line 367) — Same replacement.
- `components/ui/SettingsModal.tsx` (lines 1637–1654) — Refactor `handleSignOut` to use the unified hook.

---

## Phase 1 — Schema additions (foundation)

### Task 1: Add `'not-set'` to Gender type

**Files:**
- Modify: `store/useProfileStore.ts`
- Test: `tests/gender-types.test.ts`

- [ ] **Step 1.1: Write the failing test**

Create `tests/gender-types.test.ts`:

```ts
/**
 * Gender type now includes 'not-set' — distinct from 'surprise'.
 * 'surprise' = user chose "we don't want to know" (pregnant).
 * 'not-set' = user skipped the gender chip on newborn signup.
 *
 * Both render the same downstream (generic "your baby"), but
 * 'not-set' triggers a one-time soft re-prompt in Family tab.
 */
import { describe, expect, test } from 'bun:test';
import type { Kid } from '../store/useProfileStore';

describe('Gender type', () => {
  test("accepts 'boy' | 'girl' | 'surprise' | 'not-set'", () => {
    const a: Kid['gender'] = 'boy';
    const b: Kid['gender'] = 'girl';
    const c: Kid['gender'] = 'surprise';
    const d: Kid['gender'] = 'not-set';
    expect([a, b, c, d]).toEqual(['boy', 'girl', 'surprise', 'not-set']);
  });
});
```

- [ ] **Step 1.2: Run test, verify it fails**

```bash
bun test tests/gender-types.test.ts
```

Expected: type error — `Type '"not-set"' is not assignable to type 'Gender'`.

- [ ] **Step 1.3: Update the Gender union in `store/useProfileStore.ts`**

Find the line that defines the Gender type (search for `type Gender =` or `gender:` inside the Kid interface around line 15-25). It currently is:

```ts
gender: 'boy' | 'girl' | 'surprise';
```

Replace with:

```ts
gender: 'boy' | 'girl' | 'surprise' | 'not-set';
```

If the type is named (e.g. `export type Gender = ...`), update the named type definition.

- [ ] **Step 1.4: Run test, verify it passes**

```bash
bun test tests/gender-types.test.ts
```

Expected: PASS, 1 test.

- [ ] **Step 1.5: Run full project type-check**

```bash
bun run tsc --noEmit 2>&1 | head -40
```

Expected: zero new errors. If existing call sites (`app/(tabs)/family.tsx`, `app/(tabs)/health.tsx`, `lib/promptBuilder.ts`, `components/ui/SettingsModal.tsx`) error on exhaustive switches, those are caught here and fixed in Task 2.

- [ ] **Step 1.6: Commit**

```bash
git add store/useProfileStore.ts tests/gender-types.test.ts
git commit -m "feat(auth): add 'not-set' to Gender type for newborn-skip default"
```

---

### Task 2: Handle `'not-set'` everywhere Gender is consumed

**Files:**
- Modify: `lib/promptBuilder.ts`
- Modify: `app/(tabs)/family.tsx`
- Modify: `app/(tabs)/health.tsx`
- Modify: `components/ui/SettingsModal.tsx`
- Test: `tests/promptBuilder-not-set.test.ts`

- [ ] **Step 2.1: Write the failing test**

Create `tests/promptBuilder-not-set.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { buildSystemPrompt } from '../lib/promptBuilder';
import type { ChatContext } from '../lib/promptBuilder';

const base: ChatContext = {
  motherName: 'Priya',
  stage: 'newborn',
  state: 'Karnataka',
  diet: 'vegetarian',
  kidName: 'Aarav',
  kidAgeMonths: 3,
  kidDOB: '2026-02-19',
};

describe("promptBuilder treats 'not-set' like 'surprise'", () => {
  test("'not-set' renders as generic 'baby', not 'son' or 'daughter'", () => {
    const prompt = buildSystemPrompt({ ...base, kidGender: 'not-set' });
    expect(prompt).toContain('baby');
    expect(prompt).not.toContain('son Aarav');
    expect(prompt).not.toContain('daughter Aarav');
  });

  test("'surprise' still works (regression)", () => {
    const prompt = buildSystemPrompt({ ...base, kidGender: 'surprise' });
    expect(prompt).toContain('baby');
  });
});
```

- [ ] **Step 2.2: Run test, verify it fails**

```bash
bun test tests/promptBuilder-not-set.test.ts
```

Expected: FAIL or type error — `'not-set'` is currently treated as falsy by `kidGenderWord` ternary, but TypeScript may not narrow correctly.

- [ ] **Step 2.3: Update `lib/promptBuilder.ts`**

Find the `kidGenderWord` ternary (around line 268, currently):

```ts
const kidGenderWord = ctx.kidGender === 'boy' ? 'son' : ctx.kidGender === 'girl' ? 'daughter' : 'baby';
```

This already falls through to `'baby'` for any non-`'boy'`/`'girl'` value — no change strictly required, but add explicit handling for clarity:

```ts
const kidGenderWord =
  ctx.kidGender === 'boy' ? 'son'
  : ctx.kidGender === 'girl' ? 'daughter'
  : 'baby'; // covers 'surprise', 'not-set', undefined
```

- [ ] **Step 2.4: Audit family.tsx for exhaustive switch on gender**

Read `app/(tabs)/family.tsx` lines 80-95 (the gender-switch block). If it uses a `switch` with a `default` case, no change needed. If it uses sequential ternaries, ensure `'not-set'` falls through to the neutral icon path (same as `'surprise'`).

If a change is needed, modify to:

```tsx
{kid.gender === 'boy' ? <BoyIcon />
 : kid.gender === 'girl' ? <GirlIcon />
 : <NeutralIcon /> /* surprise, not-set, undefined */}
```

- [ ] **Step 2.5: Audit health.tsx for girl-only scheme eligibility**

Read `app/(tabs)/health.tsx` lines 885-895. The existing logic strictly checks `kid.gender === 'girl'` for girl-only scheme eligibility:

```ts
if (kid.gender === 'girl') return 'eligible';
if (kid.gender === 'boy') return 'ineligible';
```

This is already safe for `'not-set'` — it falls through to neither. Verify by reading; no change should be needed. If a `case` block exists with exhaustive checks, add a `'not-set'` case identical to the default/fallthrough.

- [ ] **Step 2.6: Audit SettingsModal.tsx gender editor**

Read `components/ui/SettingsModal.tsx` around line 928 (`useState<'boy' | 'girl' | 'surprise'>`). Widen the state type:

```ts
const [gender, setGender] = useState<'boy' | 'girl' | 'surprise' | 'not-set'>(kid.gender || 'surprise');
```

The chip group in the editor does NOT need to show "Not Set" — the user is editing intentionally, so the three real chips remain (Boy / Girl / Surprise). `'not-set'` is internal-only.

- [ ] **Step 2.7: Run test + type-check**

```bash
bun test tests/promptBuilder-not-set.test.ts
bun run tsc --noEmit 2>&1 | head -20
```

Expected: PASS on test; zero new type errors.

- [ ] **Step 2.8: Commit**

```bash
git add lib/promptBuilder.ts app/\(tabs\)/family.tsx app/\(tabs\)/health.tsx components/ui/SettingsModal.tsx tests/promptBuilder-not-set.test.ts
git commit -m "feat(auth): handle 'not-set' gender across prompt, family, health, settings"
```

---

### Task 3: Add `dismissedPrompts` map to profile store

**Files:**
- Modify: `store/useProfileStore.ts`
- Test: `tests/dismissed-prompts.test.ts`

- [ ] **Step 3.1: Write the failing test**

Create `tests/dismissed-prompts.test.ts`:

```ts
import { describe, expect, test, beforeEach } from 'bun:test';
import { useProfileStore } from '../store/useProfileStore';

describe('dismissedPrompts', () => {
  beforeEach(() => {
    useProfileStore.getState().resetProfile();
  });

  test('starts empty', () => {
    expect(useProfileStore.getState().dismissedPrompts).toEqual({});
  });

  test('dismissPrompt(key) sets the key to true', () => {
    useProfileStore.getState().dismissPrompt('diet');
    expect(useProfileStore.getState().dismissedPrompts.diet).toBe(true);
  });

  test('isPromptDismissed(key) reads the map', () => {
    useProfileStore.getState().dismissPrompt('state');
    expect(useProfileStore.getState().isPromptDismissed('state')).toBe(true);
    expect(useProfileStore.getState().isPromptDismissed('diet')).toBe(false);
  });

  test('resetProfile clears dismissedPrompts', () => {
    useProfileStore.getState().dismissPrompt('diet');
    useProfileStore.getState().resetProfile();
    expect(useProfileStore.getState().dismissedPrompts).toEqual({});
  });
});
```

- [ ] **Step 3.2: Run test, verify it fails**

```bash
bun test tests/dismissed-prompts.test.ts
```

Expected: FAIL — `dismissedPrompts is undefined`.

- [ ] **Step 3.3: Add `dismissedPrompts` to the store**

In `store/useProfileStore.ts`:

1. Add to the state interface (near `phoneVerified`):

```ts
dismissedPrompts: Record<string, boolean>;
```

2. Add to the actions interface:

```ts
dismissPrompt: (key: string) => void;
isPromptDismissed: (key: string) => boolean;
```

3. Add to the initial state object (where `phone: ''` and `phoneVerified: false` are):

```ts
dismissedPrompts: {},
```

4. Add the action implementations alongside `setPhone` and `setPhoneVerified`:

```ts
dismissPrompt: (key: string) => set((state) => ({
  dismissedPrompts: { ...state.dismissedPrompts, [key]: true },
})),
isPromptDismissed: (key: string) => !!get().dismissedPrompts[key],
```

5. In the `resetProfile` action, add `dismissedPrompts: {}` to the reset state.

6. In the persist `partialize` block (find the existing one — search for `partialize`), add `dismissedPrompts` to the list of persisted keys so it survives reload.

- [ ] **Step 3.4: Run test, verify it passes**

```bash
bun test tests/dismissed-prompts.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 3.5: Commit**

```bash
git add store/useProfileStore.ts tests/dismissed-prompts.test.ts
git commit -m "feat(auth): add dismissedPrompts map for just-in-time prompt tracking"
```

---

## Phase 2 — Observability primitives

### Task 4: Create auth observability module

**Files:**
- Create: `lib/authObservability.ts`
- Test: `tests/authObservability.test.ts`

- [ ] **Step 4.1: Write the failing test**

Create `tests/authObservability.test.ts`:

```ts
import { describe, expect, test, beforeEach, spyOn } from 'bun:test';
import { logAuthEvent, AuthEvent } from '../lib/authObservability';

describe('logAuthEvent', () => {
  let warnSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    warnSpy = spyOn(console, 'warn');
  });

  test('emits structured event with type prefix', () => {
    logAuthEvent({ type: 'auth:transition', from: 'UNAUTHED', to: 'PHONE_GATE' });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[auth:transition]'),
      expect.objectContaining({ from: 'UNAUTHED', to: 'PHONE_GATE' })
    );
  });

  test('includes timestamp in payload', () => {
    logAuthEvent({ type: 'auth:signout-started' });
    const call = warnSpy.mock.calls[0];
    expect(call[1]).toHaveProperty('ts');
    expect(typeof call[1].ts).toBe('number');
  });

  test('strips PII from email field', () => {
    logAuthEvent({ type: 'auth:google-success', email: 'priya@example.com' });
    const call = warnSpy.mock.calls[0];
    expect(call[1].email).toBe('p***@example.com');
  });
});
```

- [ ] **Step 4.2: Run test, verify it fails**

```bash
bun test tests/authObservability.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 4.3: Create `lib/authObservability.ts`**

```ts
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
  | { type: 'auth:cache-escape-hatch-triggered' };

export type AuthState = 'SPLASH' | 'UNAUTHED' | 'PHONE_GATE' | 'ONBOARDING' | 'APP';

function maskEmail(email?: string): string | undefined {
  if (!email) return undefined;
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  if (local.length <= 1) return `*@${domain}`;
  return `${local[0]}***@${domain}`;
}

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
```

- [ ] **Step 4.4: Run test, verify it passes**

```bash
bun test tests/authObservability.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 4.5: Commit**

```bash
git add lib/authObservability.ts tests/authObservability.test.ts
git commit -m "feat(auth): add structured observability for auth state transitions"
```

---

### Task 5: Emit observability events from `useAuthStore`

**Files:**
- Modify: `store/useAuthStore.ts`

- [ ] **Step 5.1: Import the logger**

At the top of `store/useAuthStore.ts`:

```ts
import { logAuthEvent } from '../lib/authObservability';
```

- [ ] **Step 5.2: Emit on onGoogleCredential**

In `onGoogleCredential` (around line 365), at the start:

```ts
logAuthEvent({ type: 'auth:google-success', uid: credential.user.uid, email: credential.user.email ?? undefined });
```

- [ ] **Step 5.3: Emit on signOut**

In the `signOut` action (line 410), wrap the flow:

```ts
signOut: async () => {
  const uid = get().user?.uid;
  logAuthEvent({ type: 'auth:signout-started', uid });
  set({ user: null, isAuthenticated: false });
  useProfileStore.getState().resetProfile();
  useWellnessStore.getState().resetWellness();
  useChatStore.getState().resetAll();
  useTeethStore.getState().resetTeeth();
  useFoodTrackerStore.getState().resetFoods();
  useGrowthStore.getState().resetGrowth();
  useDMStore.getState().reset();
  getSocialStore().getState().reset();
  getCommunityStore().getState().resetCommunity();
  if (!isFirebaseConfigured() || !auth) {
    logAuthEvent({ type: 'auth:signout-completed', uid });
    return;
  }
  try {
    await firebaseSignOut(auth);
    logAuthEvent({ type: 'auth:signout-completed', uid });
  } catch (error: any) {
    console.error('signOut error:', error);
    logAuthEvent({ type: 'auth:signout-failed', uid, error: String(error?.message ?? error) });
    throw error;
  }
},
```

- [ ] **Step 5.4: Emit on web persistence failure**

In `initAuth` (around line 488 — the `ensureWebAuthPersistence` block):

```ts
try {
  await ensureWebAuthPersistence();
} catch (err: any) {
  console.warn('ensureWebAuthPersistence failed:', err);
  logAuthEvent({ type: 'auth:web-persistence-failed', error: String(err?.message ?? err) });
}
```

- [ ] **Step 5.5: Verify TypeScript compiles**

```bash
bun run tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 5.6: Smoke run existing tests to catch regressions**

```bash
bun test
```

Expected: all existing tests pass.

- [ ] **Step 5.7: Commit**

```bash
git add store/useAuthStore.ts
git commit -m "feat(auth): emit structured events on every auth store transition"
```

---

## Phase 3 — Three-gate cold-start guard

### Task 6: Add `firestoreHydratedForUid` tracking to auth store

**Files:**
- Modify: `store/useAuthStore.ts`

- [ ] **Step 6.1: Add to state interface**

Find the AuthState interface in `store/useAuthStore.ts`. Add:

```ts
firestoreHydratedForUid: string | null;
```

- [ ] **Step 6.2: Initialize**

In the create() initial state, add:

```ts
firestoreHydratedForUid: null,
```

- [ ] **Step 6.3: Set after Firestore hydrate succeeds**

In `hydrateProfileFromFirestore`, at the end of the success path (after the profile is applied to the store), add:

```ts
useAuthStore.setState({ firestoreHydratedForUid: uid });
```

(If the function is in a file that imports useAuthStore — yes it does — this works. Otherwise, the auth store's onAuthStateChanged callback can set it after awaiting hydrate.)

- [ ] **Step 6.4: Reset on signOut**

In the `signOut` action, add to the `set` call:

```ts
set({ user: null, isAuthenticated: false, firestoreHydratedForUid: null });
```

- [ ] **Step 6.5: Type-check**

```bash
bun run tsc --noEmit 2>&1 | head -20
```

Expected: zero new errors.

- [ ] **Step 6.6: Commit**

```bash
git add store/useAuthStore.ts
git commit -m "feat(auth): track firestoreHydratedForUid for cache-trust gate"
```

---

### Task 7: Add `cachedProfileUid` to profile store + invalidation helper

**Files:**
- Modify: `store/useProfileStore.ts`

- [ ] **Step 7.1: Confirm `cachedProfileUid` is already tracked**

Search `store/useProfileStore.ts` for `cachedProfileUid`. It already exists (per code at `store/useAuthStore.ts:350` referencing it). Confirm it's persisted in `partialize`.

If it's not persisted, add to partialize.

- [ ] **Step 7.2: Add a helper to check cache trust**

In the state interface:

```ts
isCacheTrustedFor: (uid: string) => boolean;
```

In actions:

```ts
isCacheTrustedFor: (uid: string) => {
  const stored = get().cachedProfileUid;
  return !!stored && stored === uid;
},
```

- [ ] **Step 7.3: Commit**

```bash
git add store/useProfileStore.ts
git commit -m "feat(auth): expose isCacheTrustedFor helper on profile store"
```

---

### Task 8: Implement three-gate guard in `app/index.tsx`

**Files:**
- Modify: `app/index.tsx`

- [ ] **Step 8.1: Read current file fully**

Read `app/index.tsx` (currently ~30 lines). Note the existing two-gate logic.

- [ ] **Step 8.2: Replace with three-gate logic**

Replace the entire file with:

```tsx
import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { useProfileStore } from '../store/useProfileStore';
import { isAdminEmail } from '../lib/admin';
import { logAuthEvent, type AuthState } from '../lib/authObservability';

export default function Index() {
  const { isAuthenticated, isLoading, user, firestoreHydratedForUid } = useAuthStore();
  const onboardingComplete = useProfileStore((s) => s.onboardingComplete);
  const phoneVerified = useProfileStore((s) => s.phoneVerified);
  const profileHydrated = useProfileStore((s) => s._hasHydrated);
  const isCacheTrustedFor = useProfileStore((s) => s.isCacheTrustedFor);

  // ── Three-gate cold-start guard ────────────────────────────────────────
  // G1: Firebase auth resolved.
  if (isLoading) {
    logAuthEvent({ type: 'auth:gate-pending', reason: 'auth-loading' });
    return <View style={{ flex: 1, backgroundColor: '#fdf6ff' }} />;
  }
  // G2: zustand-persist finished reading local cache.
  if (!profileHydrated) {
    logAuthEvent({ type: 'auth:gate-pending', reason: 'profile-hydrating' });
    return <View style={{ flex: 1, backgroundColor: '#fdf6ff' }} />;
  }

  if (!isAuthenticated) {
    logAuthEvent({ type: 'auth:transition', from: 'SPLASH', to: 'UNAUTHED' });
    return <Redirect href="/(auth)/welcome" />;
  }

  // G3: Profile-cache-trust — the locally-cached profile actually belongs to
  // THIS user. If not, block until Firestore round-trip has resolved for
  // their uid. This is the gate that was missing; its absence sent returning
  // users to the signup form when their local cache was stale or from
  // another identity.
  const cacheTrusted = !!user && isCacheTrustedFor(user.uid);
  const firestoreReady = !!user && firestoreHydratedForUid === user.uid;
  if (!cacheTrusted && !firestoreReady) {
    logAuthEvent({ type: 'auth:gate-pending', reason: 'firestore-fetching', uid: user?.uid });
    return <View style={{ flex: 1, backgroundColor: '#fdf6ff' }} />;
  }

  // ── Five legal states from here on ─────────────────────────────────────
  if (isAdminEmail(user?.email)) {
    logAuthEvent({ type: 'auth:transition', from: 'SPLASH', to: 'APP', uid: user?.uid });
    return <Redirect href="/admin" />;
  }
  if (!phoneVerified) {
    logAuthEvent({ type: 'auth:transition', from: 'SPLASH', to: 'PHONE_GATE', uid: user?.uid });
    return <Redirect href="/(auth)/phone" />;
  }
  if (!onboardingComplete) {
    logAuthEvent({ type: 'auth:transition', from: 'SPLASH', to: 'ONBOARDING', uid: user?.uid });
    return <Redirect href="/(auth)/onboarding" />;
  }
  logAuthEvent({ type: 'auth:transition', from: 'SPLASH', to: 'APP', uid: user?.uid });
  return <Redirect href="/(tabs)" />;
}
```

- [ ] **Step 8.3: Type-check**

```bash
bun run tsc --noEmit 2>&1 | head -20
```

Expected: zero new errors.

- [ ] **Step 8.4: Manual smoke test — sign-in path**

```bash
bun run start
```

In another terminal / browser, sign in as a known good test user (e.g. `testuser@maamitra.app` / `Claudia123#`). Verify:

1. Splash holds briefly (logs show `auth:gate-pending`).
2. Lands on `/(tabs)` without flashing onboarding.
3. Logs show `auth:transition → APP`.

If onboarding flashes at any point → defect; investigate.

- [ ] **Step 8.5: Manual smoke test — fresh-cache scenario**

Open the same test account in a fresh incognito browser tab. Sign in. Verify:

1. Splash holds longer (`firestore-fetching` log fires).
2. Lands on `/(tabs)` directly.
3. Onboarding screen never renders.

- [ ] **Step 8.6: Commit**

```bash
git add app/index.tsx
git commit -m "fix(auth): add third gate (profile-cache-trust) to cold-start guard

Prevents returning users from being briefly routed to the signup form
when their local cache is stale, missing, or from another identity.

Resolves the historical bug where signing in occasionally sent users
into onboarding even though their server profile was complete."
```

---

## Phase 4 — Unified sign-out hook

### Task 9: Build the sign-out confirmation modal

**Files:**
- Create: `components/auth/SignOutConfirmModal.tsx`

- [ ] **Step 9.1: Create the modal component**

```tsx
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GradientButton from '../ui/GradientButton';
import { Colors, Fonts } from '../../constants/theme';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function SignOutConfirmModal({ visible, onCancel, onConfirm }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconWrap}>
            <Ionicons name="log-out-outline" size={26} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Sign out of MaaMitra?</Text>
          <Text style={styles.body}>
            You'll need your mobile number or Google account to come back in. Your data stays safe.
          </Text>
          <View style={styles.btnRow}>
            <Pressable style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.confirmBtn} onPress={onConfirm}>
              <Text style={styles.confirmText}>Sign out</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(28, 16, 51, 0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 22, maxWidth: 360, width: '100%' },
  iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5F0FF', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12 },
  title: { fontFamily: Fonts.serif, fontSize: 20, color: Colors.textDark, textAlign: 'center', marginBottom: 6 },
  body: { fontFamily: Fonts.sansRegular, fontSize: 14, color: Colors.textLight, textAlign: 'center', lineHeight: 21, marginBottom: 18 },
  btnRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E1EE', alignItems: 'center' },
  cancelText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: Colors.textLight },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#ef4444', alignItems: 'center' },
  confirmText: { fontFamily: Fonts.sansBold, fontSize: 14, color: '#fff' },
});
```

- [ ] **Step 9.2: Type-check**

```bash
bun run tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 9.3: Commit**

```bash
git add components/auth/SignOutConfirmModal.tsx
git commit -m "feat(auth): branded sign-out confirmation modal"
```

---

### Task 10: Build the sign-out loading + success overlay

**Files:**
- Create: `components/auth/SignOutOverlay.tsx`

- [ ] **Step 10.1: Create the overlay component**

```tsx
import { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../constants/theme';

interface Props {
  state: 'idle' | 'signing-out' | 'signed-out';
}

export default function SignOutOverlay({ state }: Props) {
  const rotation = useSharedValue(0);
  const checkScale = useSharedValue(0);

  useEffect(() => {
    if (state === 'signing-out') {
      rotation.value = withRepeat(withTiming(1, { duration: 700 }), -1, false);
    }
    if (state === 'signed-out') {
      checkScale.value = withSequence(withTiming(1.2, { duration: 180 }), withTiming(1, { duration: 120 }));
    }
  }, [state]);

  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value * 360}deg` }] }));
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }));

  if (state === 'idle') return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {state === 'signing-out' ? (
            <>
              <Animated.View style={spinStyle}>
                <Ionicons name="reload-outline" size={32} color={Colors.primary} />
              </Animated.View>
              <Text style={styles.text}>Signing out…</Text>
            </>
          ) : (
            <>
              <Animated.View style={checkStyle}>
                <View style={styles.checkCircle}>
                  <Ionicons name="checkmark" size={28} color="#fff" />
                </View>
              </Animated.View>
              <Text style={styles.text}>Signed out</Text>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(28, 16, 51, 0.55)', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 18, paddingVertical: 28, paddingHorizontal: 36, alignItems: 'center', gap: 14, minWidth: 200 },
  checkCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: Fonts.sansSemiBold, fontSize: 15, color: Colors.textDark },
});
```

- [ ] **Step 10.2: Type-check**

```bash
bun run tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 10.3: Commit**

```bash
git add components/auth/SignOutOverlay.tsx
git commit -m "feat(auth): sign-out loading + success overlay"
```

---

### Task 11: Build the `useSignOut` hook

**Files:**
- Create: `hooks/useSignOut.ts`

- [ ] **Step 11.1: Create the hook**

```ts
/**
 * useSignOut — the ONE allowed way to sign out anywhere in the app.
 *
 * Owns: confirmation modal, loading overlay, atomic state reset,
 * success overlay, explicit redirect. Replaces every raw
 * `useAuthStore.signOut()` callsite.
 *
 * Grep test in tests/grep-signout.test.ts enforces that no other
 * file calls `signOut()` from `useAuthStore` directly.
 */
import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';

type Stage = 'idle' | 'confirm-open' | 'signing-out' | 'signed-out';

export function useSignOut() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('idle');

  const open = useCallback(() => setStage('confirm-open'), []);
  const cancel = useCallback(() => setStage('idle'), []);

  const performSignOut = useCallback(async () => {
    setStage('signing-out');
    try {
      await useAuthStore.getState().signOut();
      setStage('signed-out');
      // Hold the success overlay 1200ms so any in-flight tab renders
      // settle before we navigate. Prevents the historical "onboarding
      // form flashes during signout" bug.
      setTimeout(() => {
        setStage('idle');
        router.replace('/(auth)/welcome');
      }, 1200);
    } catch (err) {
      console.error('useSignOut error:', err);
      setStage('idle');
      throw err;
    }
  }, [router]);

  return {
    stage,
    isConfirmOpen: stage === 'confirm-open',
    overlayState: stage === 'signing-out' ? 'signing-out' : stage === 'signed-out' ? 'signed-out' : 'idle',
    open,
    cancel,
    confirm: performSignOut,
  } as const;
}
```

- [ ] **Step 11.2: Type-check**

```bash
bun run tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 11.3: Commit**

```bash
git add hooks/useSignOut.ts
git commit -m "feat(auth): unified useSignOut hook — single sign-out primitive"
```

---

### Task 12: Replace `SettingsModal.tsx` sign-out flow

**Files:**
- Modify: `components/ui/SettingsModal.tsx`

- [ ] **Step 12.1: Read the current sign-out section**

Read `components/ui/SettingsModal.tsx` lines 1500-1660 to understand context. Currently has `signOut` from `useAuthStore`, a `setShowSignOutConfirm` boolean, and a manual `handleSignOut` async function.

- [ ] **Step 12.2: Add the imports at top of file**

```tsx
import { useSignOut } from '../../hooks/useSignOut';
import SignOutConfirmModal from '../auth/SignOutConfirmModal';
import SignOutOverlay from '../auth/SignOutOverlay';
```

- [ ] **Step 12.3: Replace the destructure**

Find: `const { user, signOut, deleteAccount } = useAuthStore();`

Replace with:

```tsx
const { user, deleteAccount } = useAuthStore();
const signOut = useSignOut();
```

- [ ] **Step 12.4: Delete the old `handleSignOut` function**

Delete the entire `handleSignOut` async function (lines ~1637-1654) and the related `setShowSignOutConfirm`, `signedOutSuccess`, and `setLoading` state if they are only used by sign-out.

(If `setLoading` is shared with other flows in the file, keep it.)

- [ ] **Step 12.5: Wire the button onPress**

Find the "Sign out" button (search for `signOutQuickBtn` or the "Sign out" Text). Change its `onPress` to:

```tsx
onPress={() => signOut.open()}
```

- [ ] **Step 12.6: Render the modal + overlay at the end of the SettingsModal JSX**

Before the closing tag of the outer Modal, add:

```tsx
<SignOutConfirmModal
  visible={signOut.isConfirmOpen}
  onCancel={signOut.cancel}
  onConfirm={signOut.confirm}
/>
<SignOutOverlay state={signOut.overlayState} />
```

- [ ] **Step 12.7: Type-check**

```bash
bun run tsc --noEmit 2>&1 | head -20
```

Expected: zero new errors. May find unused imports — clean them up.

- [ ] **Step 12.8: Manual smoke test**

```bash
bun run start
```

1. Sign in as a test user.
2. Open settings → tap Sign out.
3. Verify: confirmation modal appears.
4. Tap Cancel → modal closes, no signout.
5. Tap Sign out → loading overlay, then ✓ Signed out, then welcome screen.
6. **Record the screen during step 5** — verify no `/(auth)/onboarding` flash at any frame.

- [ ] **Step 12.9: Commit**

```bash
git add components/ui/SettingsModal.tsx
git commit -m "refactor(auth): SettingsModal sign-out uses unified useSignOut hook

Eliminates the bespoke handleSignOut function and replaces it with the
single allowed sign-out primitive. Confirmation modal and overlay are
now consistent with every other sign-out callsite."
```

---

### Task 13: Replace `app/admin/index.tsx` sign-out flow

**Files:**
- Modify: `app/admin/index.tsx`

- [ ] **Step 13.1: Read the current sign-out section**

Read `app/admin/index.tsx` lines 50-120 to understand context. Line 109 has `await signOut();` with no confirmation.

- [ ] **Step 13.2: Add imports**

```tsx
import { useSignOut } from '../../hooks/useSignOut';
import SignOutConfirmModal from '../../components/auth/SignOutConfirmModal';
import SignOutOverlay from '../../components/auth/SignOutOverlay';
```

- [ ] **Step 13.3: Replace destructure**

Find `const { user, signOut } = useAuthStore();`. Replace with:

```tsx
const { user } = useAuthStore();
const signOut = useSignOut();
```

- [ ] **Step 13.4: Replace the `await signOut()` callsite**

Find line 109 (the raw `await signOut();` call inside the handler). Replace the handler logic that wraps it with:

```tsx
const handleSignOut = () => signOut.open();
```

(Remove any router.replace that followed the raw signOut — the hook owns the redirect.)

- [ ] **Step 13.5: Render modal + overlay**

At the end of the component's JSX (just before the closing tag), add:

```tsx
<SignOutConfirmModal
  visible={signOut.isConfirmOpen}
  onCancel={signOut.cancel}
  onConfirm={signOut.confirm}
/>
<SignOutOverlay state={signOut.overlayState} />
```

- [ ] **Step 13.6: Type-check**

```bash
bun run tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 13.7: Manual smoke test on admin**

Sign in as `rocking.vsr@gmail.com` (admin). Sign out from `/admin`. Verify confirmation modal + overlay flow works. No flash of `/onboarding` or any user-tab content.

- [ ] **Step 13.8: Commit**

```bash
git add app/admin/index.tsx
git commit -m "refactor(auth): admin index uses unified useSignOut hook"
```

---

### Task 14: Replace `app/admin/settings.tsx` sign-out flow

**Files:**
- Modify: `app/admin/settings.tsx`

- [ ] **Step 14.1: Repeat Task 13 pattern**

Same edits as Task 13, applied to `app/admin/settings.tsx`:

1. Add the three imports.
2. Replace destructure `const { user, signOut } = useAuthStore();` with `const { user } = useAuthStore(); const signOut = useSignOut();`.
3. Around line 367, replace the raw `await signOut();` handler with `signOut.open()`.
4. Render `<SignOutConfirmModal />` + `<SignOutOverlay />` at the end of the JSX.

- [ ] **Step 14.2: Type-check + smoke test + commit**

```bash
bun run tsc --noEmit 2>&1 | head -20
git add app/admin/settings.tsx
git commit -m "refactor(auth): admin settings uses unified useSignOut hook"
```

---

### Task 15: Build-time grep test to enforce the rule

**Files:**
- Create: `tests/grep-signout.test.ts`

- [ ] **Step 15.1: Write the grep test**

```ts
/**
 * Enforce: the only file allowed to call useAuthStore.signOut() directly
 * is hooks/useSignOut.ts. Everything else MUST go through the hook.
 *
 * This test fails the build if anyone tries to bypass the unified flow.
 */
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');
const ALLOWED = new Set([
  'hooks/useSignOut.ts',
  'store/useAuthStore.ts', // internal definition
]);

function walk(dir: string, hits: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name.startsWith('.') || name === 'tests' || name === 'docs') continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, hits);
    else if (/\.(ts|tsx)$/.test(name)) hits.push(p);
  }
  return hits;
}

describe('grep: no raw signOut() outside the hook', () => {
  test('all signOut() callsites are inside the allowed files', () => {
    const offenders: string[] = [];
    for (const file of walk(ROOT)) {
      const rel = file.replace(ROOT + '/', '');
      if (ALLOWED.has(rel)) continue;
      const src = readFileSync(file, 'utf8');
      // Match patterns like `useAuthStore.getState().signOut(`, `.signOut(`,
      // or destructured `signOut` followed by `(`.
      if (/useAuthStore\.getState\(\)\.signOut\(|\.signOut\(\s*\)/.test(src)) {
        // Confirm the .signOut isn't on firebase auth itself
        const lines = src.split('\n').map((l, i) => ({ l, i: i + 1 }));
        for (const { l, i } of lines) {
          if (/\.signOut\(\)/.test(l) && !/firebaseSignOut|auth\.signOut|firebase\/auth/.test(l)) {
            offenders.push(`${rel}:${i}  ${l.trim()}`);
          }
        }
      }
    }
    if (offenders.length) {
      // eslint-disable-next-line no-console
      console.error('Raw signOut() callsites found:\n  ' + offenders.join('\n  '));
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 15.2: Run it**

```bash
bun test tests/grep-signout.test.ts
```

Expected: PASS (all callsites refactored in Tasks 12–14).

If FAIL → identify offender, refactor to use the hook.

- [ ] **Step 15.3: Commit**

```bash
git add tests/grep-signout.test.ts
git commit -m "test(auth): grep enforcement — no raw signOut() outside useSignOut hook"
```

---

## Phase 5 — Cache-stuck escape hatch

### Task 16: Create `storageEscape` utility

**Files:**
- Create: `lib/storageEscape.ts`
- Test: `tests/storageEscape.test.ts`

- [ ] **Step 16.1: Write the failing test**

```ts
import { describe, expect, test, mock } from 'bun:test';
import { wipeAllLocalStorage } from '../lib/storageEscape';

describe('wipeAllLocalStorage', () => {
  test('clears web localStorage when window is defined', async () => {
    const clearMock = mock(() => {});
    (globalThis as any).window = { localStorage: { clear: clearMock } };
    await wipeAllLocalStorage();
    expect(clearMock).toHaveBeenCalled();
    delete (globalThis as any).window;
  });

  test('no-throw when window is undefined (native path)', async () => {
    delete (globalThis as any).window;
    await expect(wipeAllLocalStorage()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 16.2: Run, verify fail**

```bash
bun test tests/storageEscape.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 16.3: Create `lib/storageEscape.ts`**

```ts
/**
 * The "stuck cache" escape hatch.
 *
 * When a browser ends up in an unrecoverable state (private mode that
 * lost its in-memory persistence, corrupted localStorage, third-party
 * cookie blocks that broke Firebase reCAPTCHA), the welcome screen
 * surfaces a "Reset local storage" link after 5 seconds of loading.
 * Tapping it confirms with the user, then calls this function.
 *
 * On web: localStorage.clear() + reload.
 * On native: AsyncStorage.clear() + Expo Updates.reloadAsync().
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { logAuthEvent } from './authObservability';

export async function wipeAllLocalStorage(): Promise<void> {
  logAuthEvent({ type: 'auth:cache-escape-hatch-triggered' });

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      window.localStorage?.clear();
    } catch {
      // localStorage may be disabled in private mode — ignore
    }
    try {
      window.sessionStorage?.clear();
    } catch {
      // same
    }
    try {
      // Reload to clear in-memory state
      window.location.reload();
    } catch {
      // ignore
    }
    return;
  }

  try {
    await AsyncStorage.clear();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('AsyncStorage clear failed:', err);
  }
  try {
    const Updates = await import('expo-updates');
    await Updates.reloadAsync();
  } catch {
    // If expo-updates isn't available (dev), the next app launch will pick
    // up the cleared storage anyway.
  }
}
```

- [ ] **Step 16.4: Run test, verify pass**

```bash
bun test tests/storageEscape.test.ts
```

Expected: PASS.

- [ ] **Step 16.5: Commit**

```bash
git add lib/storageEscape.ts tests/storageEscape.test.ts
git commit -m "feat(auth): storageEscape utility for cache-stuck recovery"
```

---

### Task 17: Wire the 5-second escape link into welcome screen

**Files:**
- Modify: `app/(auth)/welcome.tsx`

- [ ] **Step 17.1: Add imports**

At the top of `app/(auth)/welcome.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { wipeAllLocalStorage } from '../../lib/storageEscape';
```

- [ ] **Step 17.2: Add the visibility state + timer**

Inside the `WelcomeScreen` component, after the existing hooks:

```tsx
const isLoading = useAuthStore((s) => s.isLoading);
const [showEscape, setShowEscape] = useState(false);

useEffect(() => {
  if (!isLoading) {
    setShowEscape(false);
    return;
  }
  const t = setTimeout(() => setShowEscape(true), 5000);
  return () => clearTimeout(t);
}, [isLoading]);
```

- [ ] **Step 17.3: Add the confirm handler**

```tsx
const handleEscape = () => {
  const confirmText = 'This will clear cached data and sign you out completely. Continue?';
  if (typeof window !== 'undefined') {
    if (window.confirm(confirmText)) void wipeAllLocalStorage();
  } else {
    Alert.alert('Reset local storage', confirmText, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => void wipeAllLocalStorage() },
    ]);
  }
};
```

- [ ] **Step 17.4: Render the link in the footer area**

Inside the existing footer `<View style={styles.footer}>` block (both NativeWelcome and the web layout), add at the end:

```tsx
{showEscape && (
  <TouchableOpacity onPress={handleEscape} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
    <Text style={styles.escapeLink}>Trouble signing in? Reset local storage.</Text>
  </TouchableOpacity>
)}
```

- [ ] **Step 17.5: Add the style**

In the `StyleSheet.create` block:

```ts
escapeLink: {
  fontFamily: Fonts.sansMedium,
  fontSize: 11,
  color: Colors.textLight,
  textDecorationLine: 'underline',
  marginTop: 8,
  textAlign: 'center',
},
```

- [ ] **Step 17.6: Type-check + smoke test**

```bash
bun run tsc --noEmit 2>&1 | head -20
```

Manual: force `isLoading = true` indefinitely (temporarily by adding `if (true) return <View ... />` in `app/index.tsx`'s G1 branch). Wait 5 seconds. Verify the escape link appears on `/welcome`. Tap it → confirms → wipes storage → reloads.

After test, revert the temporary force-loading change.

- [ ] **Step 17.7: Commit**

```bash
git add app/\(auth\)/welcome.tsx
git commit -m "feat(auth): 5-second cache-stuck escape hatch on welcome screen"
```

---

## Phase 6 — Documentation + final QA

### Task 18: Update HANDOFF.md

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 18.1: Append a note**

Add to the top "Active task" or "Last action" section in `HANDOFF.md`:

```markdown
## Last action

Landed Plan A — Auth Hardening (docs/superpowers/plans/2026-05-19-auth-hardening.md):

- Three-gate cold-start guard in app/index.tsx (fixes "sign-in routes to signup form" bug)
- Unified useSignOut hook + SignOutConfirmModal + SignOutOverlay (fixes "signout flashes signup form" bug)
- Schema additions: Gender 'not-set', dismissedPrompts map
- Auth observability logging (lib/authObservability.ts)
- 5-second cache-stuck escape hatch on welcome screen
- Build-time grep enforces no raw signOut() outside the hook

## Next step

Plan B — New Signup Journey (auth entry rewrite + phone gate hardening + onboarding form + JIT prompts).
See docs/superpowers/specs/2026-05-19-streamlined-signup-design.md §5.2–§5.7.
```

- [ ] **Step 18.2: Commit**

```bash
git add HANDOFF.md
git commit -m "docs(handoff): Plan A landed — auth hardening complete"
```

---

### Task 19: Run the full test suite + type-check

- [ ] **Step 19.1: Tests**

```bash
bun test
```

Expected: all tests pass. New tests: `gender-types`, `promptBuilder-not-set`, `dismissed-prompts`, `authObservability`, `storageEscape`, `grep-signout`.

- [ ] **Step 19.2: Type-check**

```bash
bun run tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 19.3: Health check**

```bash
bun run lint 2>/dev/null || echo "(skip if no lint script)"
```

If lint exists, fix any new findings.

---

### Task 20: Manual QA pass against the bug-replication scenarios

These map to spec §9 tests #10–#20. Run each manually before declaring Plan A done.

- [ ] **Step 20.1: Test #10 — stale cache scenario**

1. Open the app in a fresh browser tab.
2. In DevTools console: `localStorage.setItem('useProfileStore', JSON.stringify({ state: { onboardingComplete: false, cachedProfileUid: 'someoneElsesUid' }, version: 0 }))`.
3. Reload. Sign in as a real test user (e.g. `testuser@maamitra.app`).
4. **Expected:** splash holds, then lands on `/(tabs)` directly. Onboarding never renders.

- [ ] **Step 20.2: Test #12 — sign-out flash, settings path**

1. Sign in.
2. Start a screen recording (browser DevTools or system).
3. Open settings → tap Sign out → confirm.
4. Stop recording.
5. **Expected:** no `/(auth)/onboarding` frame in the recording. Sequence: tabs → confirm modal → loading overlay → ✓ signed out → welcome.

- [ ] **Step 20.3: Test #13 — sign-out flash, admin path**

Same as 20.2 but on `/admin`. Sign out via the admin settings page.

- [ ] **Step 20.4: Test #16 — phone gate cannot be bypassed**

1. Sign in via Google with a test user that has no `phoneVerified`.
2. On the `/phone` screen, try: hardware back (Android), browser back, direct URL navigation to `/(tabs)`, direct URL to `/admin`.
3. **Expected:** every attempt redirects back to `/phone`.

- [ ] **Step 20.5: Test #17 — no silent identity mixing**

1. Sign in as user A. Note kid name, mother name.
2. Sign out.
3. Sign in as user B (different account) in the same browser tab.
4. **Expected:** no fragment of user A's profile is visible at any point in user B's session. Inspect: home greeting, family tab, chat history.

- [ ] **Step 20.6: Test #14 — incognito persistence failure**

1. Open the app in a private/incognito browser tab.
2. Trigger Google sign-in.
3. **Expected:** if web persistence fails, console shows `[auth:web-persistence-failed]` log. (Full UX message is part of Plan B; for Plan A we're verifying the log fires.)

- [ ] **Step 20.7: Document results in HANDOFF.md**

Update `HANDOFF.md` "Last action" with the manual test results. If any test failed, file the gap and don't ship.

---

## Self-review checklist

Before declaring Plan A complete:

- [ ] All tasks 1–20 committed.
- [ ] `bun test` green.
- [ ] `bun run tsc --noEmit` green.
- [ ] Manual QA tests 20.1–20.6 all pass.
- [ ] No raw `signOut()` callsites remain (test #15 enforces this).
- [ ] Sign-out from every entry point (settings modal, admin index, admin settings) shows the unified confirmation modal + overlay.
- [ ] Cold-start splash holds while any gate is pending (verified via slow-network throttle).
- [ ] No design drift — only existing tokens used in `SignOutConfirmModal` and `SignOutOverlay`.

## Shipping Plan A

Once self-review passes, run the standard ship chain (per project CLAUDE.md §4):

```bash
git pull --rebase origin main
bun run tsc --noEmit && bun test
# (build chain — exact commands depend on EAS / Firebase setup in this repo)
npm run update  # OTA via scripts/safe-update.sh
```

After Plan A is shipped and proven stable in production (24-48h of clean logs), proceed to Plan B (new signup journey).

---

## Spec coverage check

| Spec section | Tasks |
|---|---|
| §5.8 Sign-out flow | Tasks 9, 10, 11, 12, 13, 14, 15 |
| §5.5 Gender 'not-set' | Tasks 1, 2 |
| §10b H1 Three-gate guard | Tasks 6, 7, 8 |
| §10b H2 Five legal states | Task 8 (codified in `app/index.tsx`) |
| §10b H3 Sign-out atomicity | Tasks 11, 12, 13, 14 |
| §10b H4 Web persistence hardening | Tasks 5, 16, 17 (escape hatch + observability — full UX in Plan B) |
| §10b H5 Cache-stuck escape hatch | Tasks 16, 17 |
| §10b H6 No silent identity mixing | Task 8 (cache-trust gate) — verified by test 20.5 |
| §10b H7 Apple sub claim | **Deferred to Plan B** (no Apple sign-in in Plan A) |
| §10b H8 Phone gate cannot be bypassed | Task 8 (redirect logic) — verified by test 20.4. Strict UX in Plan B. |
| §10b H9 Visual consistency | Tasks 9, 10 (only existing tokens used) |
| §10b H10 Observability | Tasks 4, 5 |
| §9 Tests #10, #12–17, #19, #20 | Task 20 |
| §9 Test #18 Apple idempotency | **Deferred to Plan B** |
| §9 Test #11 Cleared cache | Task 20.1 covers (extend if needed) |

**Plan B will cover:**
- §5.2 Auth entry rewrite (Layout C)
- §5.3 Strict phone gate UX
- §5.4 Onboarding form rewrite (Layout B with morphing illustration)
- §5.5 Gender chip stage-dependent UI (the schema is here in Plan A)
- §5.6 Date validation split
- §5.7 Just-in-time prompts
- §6.5 New illustrations
- H7 Apple sub claim
- H8 Strict phone gate UX (no back/skip)
- Deletion of `sign-up.tsx`, `sign-in.tsx`, `forgot-password.tsx`, `verify-email.tsx`
