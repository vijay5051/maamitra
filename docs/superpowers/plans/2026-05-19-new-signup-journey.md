# New Signup Journey Implementation Plan (Plan B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the new phone-first signup journey — Layout C auth entry (Smart input), strict phone gate, Layout B onboarding form (progressive reveal with morphing illustration), just-in-time prompts for deferred fields, and Apple Sign-In wiring.

**Architecture:** Builds on Plan A's hardened auth foundation (`useSignOut`, three-gate guard, observability, `'not-set'` Gender, `dismissedPrompts` map). New screens are pure UI rewrites + Apple SIWA + JIT prompt primitive. Email/password path is removed entirely.

**Tech Stack:** Expo Router · React Native · Firebase Auth · `expo-apple-authentication` · Reanimated · `bun:test`.

**Prerequisites (block execution if not done):**
1. Plan A shipped and stable in production for at least 24 hours (no fresh sign-in/sign-out bug reports).
2. Two new illustration assets generated and committed (see Task 0 — surface specs first).
3. Apple Developer Console: Service ID configured for web SIWA + Sign-In with Apple capability enabled on the iOS app ID (Vijay action — surface as prerequisite).
4. Firebase Console: Apple provider enabled in Authentication → Sign-in method.

**Source spec:** `docs/superpowers/specs/2026-05-19-streamlined-signup-design.md` §5.2–§5.7, §6, §10b H7 + H8.

---

## File structure overview

**Files to create:**
- `components/auth/SmartInputCard.tsx` — Phone input + Google + Apple shortcuts (Layout C).
- `components/auth/AppleSignInButton.tsx` — Platform-gated Apple button.
- `hooks/useAppleSignIn.ts` — Apple SIWA hook analogous to `useGoogleSignIn`.
- `components/onboarding/MorphingHero.tsx` — Illustration that cross-fades between expecting/newborn.
- `components/onboarding/LivePreviewPill.tsx` — Unlocked preview copy.
- `components/onboarding/StageChip.tsx` — The expecting/newborn chip group.
- `components/onboarding/GenderChip.tsx` — Stage-dependent chip group (3 chips pregnant, 2 chips newborn).
- `components/jit/JustInTimePrompt.tsx` — Generic prompt-card primitive.
- `components/jit/DietPrompt.tsx` — Diet JIT prompt instance.
- `components/jit/StatePrompt.tsx` — State JIT prompt instance.
- `components/jit/KidNamePrompt.tsx` — Soft baby-name prompt on Home.
- `components/jit/KidGenderPrompt.tsx` — Soft gender prompt for `'not-set'` newborns.
- `lib/dateValidation.ts` — Stage-aware date validators.
- `lib/appleAuth.ts` — Apple credential → Firebase token flow.
- `assets/onboardingExpecting.png` — Generated illustration (800×800 transparent).
- `assets/onboardingNewborn.png` — Generated illustration (800×800 transparent).
- `tests/dateValidation.test.ts`
- `tests/jit-prompt.test.ts`

**Files to modify:**
- `app/(auth)/welcome.tsx` — Rewrite as Layout C Smart input entry.
- `app/(auth)/phone.tsx` — Strict gate (no back, no skip).
- `app/(auth)/onboarding.tsx` — Rewrite as Layout B progressive reveal single-screen.
- `app/(tabs)/foods.tsx` — Wire DietPrompt.
- `app/(tabs)/community.tsx` — Wire StatePrompt.
- `app/(tabs)/health.tsx` — Wire StatePrompt for schemes.
- `app/(tabs)/family.tsx` — Wire KidGenderPrompt.
- `app/(tabs)/index.tsx` — Wire KidNamePrompt.
- `components/ui/SettingsModal.tsx` — Add familyType editor in "more about you" section.
- `services/firebase.ts` — Apple credential helper, persist `sub` claim.
- `store/useAuthStore.ts` — `onAppleCredential` action.
- `lib/illustrations.ts` — Register new asset names.

**Files to delete:**
- `app/signup.tsx`, `app/signin.tsx` (dead stubs).
- `app/(auth)/sign-up.tsx`, `app/(auth)/sign-in.tsx`.
- `app/(auth)/forgot-password.tsx`, `app/(auth)/verify-email.tsx`.

---

## Phase 0 — Prerequisites (surface to Vijay, block until done)

### Task 0: Surface illustration asset specs + Apple setup

**Files:** None (specs only).

- [ ] **Step 0.1: Print illustration prompts for Vijay**

Per project Rule 3, illustrations are generated externally by Vijay via ChatGPT. Print these two prompts verbatim and wait for the assets:

**Illustration 1 — `onboardingExpecting.png`**
> Painterly soft-shaded illustration of a pregnant Indian woman, hand resting on her belly, calm and content smile, eyes closed or looking down lovingly. Dusty lavender + warm cream + blush + sage + ochre palette. Soft watercolor texture. Transparent background. 800×800. No text in the image. Same style as the existing MaaMitra "feature*" illustrations.

**Illustration 2 — `onboardingNewborn.png`**
> Painterly soft-shaded illustration of an Indian mother holding a swaddled newborn baby in her arms, both peaceful. Dusty lavender + warm cream + blush + sage + ochre palette. Soft watercolor texture. Transparent background. 800×800. No text in the image. Same style as the existing MaaMitra "feature*" illustrations.

- [ ] **Step 0.2: Surface Apple Developer setup**

Vijay must complete in Apple Developer Console (per existing memory note about individual enrollment under Vijay Singh Rathore):

1. Bundle ID `in.maamitra.app` → enable "Sign In with Apple" capability.
2. Create a Service ID for web SIWA (`in.maamitra.app.web`), configure return URLs:
   - `https://maamitra.co.in/__/auth/handler`
   - `https://maa-mitra-7kird8.firebaseapp.com/__/auth/handler`
3. Create a Key with "Sign In with Apple" enabled. Download .p8.
4. In Firebase Console → Authentication → Sign-in method → Apple → enable + paste Service ID, Apple Team ID, Key ID, .p8 private key.

- [ ] **Step 0.3: Wait for assets + Apple config**

Do not proceed past Task 0 until:
- Both PNGs exist at `assets/onboardingExpecting.png` and `assets/onboardingNewborn.png`.
- Vijay confirms Apple Sign-In is configured in Firebase.

---

## Phase 1 — Apple Sign-In wiring

### Task 1: Install `expo-apple-authentication`

**Files:** `package.json`

- [ ] **Step 1.1: Install package**

```bash
bunx expo install expo-apple-authentication
```

- [ ] **Step 1.2: Add to app.config.ts plugins**

In `app.config.ts` (or `app.json`), under `plugins`, add:

```ts
['expo-apple-authentication'],
```

- [ ] **Step 1.3: Verify iOS entitlement**

In the iOS section of `app.config.ts`, ensure:

```ts
ios: {
  usesAppleSignIn: true,
  // ... existing config
}
```

- [ ] **Step 1.4: Commit**

```bash
git add package.json bun.lockb app.config.ts
git commit -m "feat(auth): install expo-apple-authentication"
```

---

### Task 2: Apple credential flow in services/firebase.ts

**Files:** `services/firebase.ts`, `lib/appleAuth.ts`

- [ ] **Step 2.1: Create `lib/appleAuth.ts`**

```ts
/**
 * Apple Sign-In flow.
 *
 * iOS: uses expo-apple-authentication (native SIWA UI).
 * Web: uses Firebase OAuthProvider('apple.com') with signInWithPopup.
 * Android: not supported (Apple doesn't ship a native Android SDK).
 *
 * Stores the Apple `sub` claim per user on first signin — required for
 * future Team ID Migration when MaaMitra incorporates and the Apple
 * Developer account transfers from individual to org.
 */
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  OAuthProvider,
  signInWithCredential,
  signInWithPopup,
  type UserCredential,
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { logAuthEvent } from './authObservability';

export const APPLE_AVAILABLE: Promise<boolean> = (async () => {
  if (Platform.OS === 'web') return true; // Firebase OAuthProvider works on any browser
  if (Platform.OS === 'ios') return AppleAuthentication.isAvailableAsync();
  return false; // Android not supported
})();

export async function signInWithApple(): Promise<UserCredential & { appleSub?: string }> {
  if (!auth) throw new Error('Firebase auth not configured');

  if (Platform.OS === 'web') {
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    const result = await signInWithPopup(auth, provider);
    const credential = OAuthProvider.credentialFromResult(result);
    // The Apple `sub` is in the ID token; extract it.
    const idToken = credential?.idToken;
    const appleSub = idToken ? decodeJwtSub(idToken) : undefined;
    logAuthEvent({ type: 'auth:apple-success', uid: result.user.uid, email: result.user.email ?? undefined });
    return Object.assign(result, { appleSub });
  }

  if (Platform.OS === 'ios') {
    const native = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!native.identityToken) throw new Error('Apple did not return an identity token');
    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({
      idToken: native.identityToken,
      rawNonce: undefined,
    });
    const result = await signInWithCredential(auth, credential);
    // Apple returns FullName only on the first sign-in. Pass through so
    // the auth store can persist it to Firestore before it disappears.
    const displayName = native.fullName
      ? [native.fullName.givenName, native.fullName.familyName].filter(Boolean).join(' ')
      : undefined;
    const appleSub = native.user;
    logAuthEvent({ type: 'auth:apple-success', uid: result.user.uid, email: result.user.email ?? undefined });
    return Object.assign(result, { appleSub, _appleDisplayName: displayName });
  }

  throw new Error('Apple Sign-In is not available on this platform');
}

function decodeJwtSub(jwt: string): string | undefined {
  try {
    const [, payloadB64] = jwt.split('.');
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    return payload.sub as string | undefined;
  } catch {
    return undefined;
  }
}
```

- [ ] **Step 2.2: Type-check + commit**

```bash
bun run tsc --noEmit 2>&1 | head -20
git add lib/appleAuth.ts
git commit -m "feat(auth): apple sign-in flow (web + iOS, android unsupported)"
```

---

### Task 3: `onAppleCredential` action in `useAuthStore`

**Files:** `store/useAuthStore.ts`, `services/firebase.ts`

- [ ] **Step 3.1: Add `onAppleCredential` to AuthState interface**

In `store/useAuthStore.ts`, near `onGoogleCredential`:

```ts
onAppleCredential: (
  credential: UserCredential & { appleSub?: string; _appleDisplayName?: string }
) => Promise<AuthDestination>;
```

- [ ] **Step 3.2: Implement the action**

Add the implementation alongside `onGoogleCredential` (model the same hydrate-from-Firestore pattern). Crucially, on first sign-in, persist `appleSub` and the display name to Firestore:

```ts
onAppleCredential: async (credential) => {
  logAuthEvent({ type: 'auth:apple-success', uid: credential.user.uid });
  set({ isLoading: true });
  try {
    await ensureWebAuthPersistence();
  } catch {}

  const uid = credential.user.uid;
  const preliminaryUser = {
    uid,
    email: credential.user.email ?? '',
    name: credential.user.displayName ?? credential._appleDisplayName ?? '',
    emailVerified: credential.user.emailVerified,
    photoURL: credential.user.photoURL ?? null,
  };

  // Persist Apple sub + name to Firestore on FIRST signin only.
  // Apple won't return fullName on subsequent signins, so we must
  // capture it now or never.
  if (credential.appleSub || credential._appleDisplayName) {
    try {
      await persistAppleClaims(uid, {
        appleSub: credential.appleSub,
        displayName: credential._appleDisplayName,
      });
    } catch (err) {
      console.warn('persistAppleClaims failed:', err);
    }
  }

  set({ user: preliminaryUser, isAuthenticated: true });
  const hadProfile = await hydrateProfileFromFirestore(uid);

  set({ isLoading: false });
  const phoneVerified = useProfileStore.getState().phoneVerified;
  const onboardingComplete = useProfileStore.getState().onboardingComplete;
  if (!phoneVerified) return 'phone';
  if (!onboardingComplete) return 'onboarding';
  return 'tabs';
},
```

- [ ] **Step 3.3: Add `persistAppleClaims` to `services/firebase.ts`**

```ts
export async function persistAppleClaims(
  uid: string,
  claims: { appleSub?: string; displayName?: string }
): Promise<void> {
  if (!db) return;
  const ref = doc(db, 'users', uid);
  const patch: Record<string, unknown> = {};
  if (claims.appleSub) patch.appleSub = claims.appleSub;
  if (claims.displayName) patch.displayName = claims.displayName;
  if (Object.keys(patch).length === 0) return;
  await setDoc(ref, patch, { merge: true });
}
```

(Adapt imports — `doc`, `setDoc` from `firebase/firestore`.)

- [ ] **Step 3.4: Type-check + commit**

```bash
bun run tsc --noEmit 2>&1 | head -20
git add store/useAuthStore.ts services/firebase.ts
git commit -m "feat(auth): onAppleCredential persists sub + displayName on first signin"
```

---

### Task 4: `useAppleSignIn` hook + `AppleSignInButton` component

**Files:** `hooks/useAppleSignIn.ts`, `components/auth/AppleSignInButton.tsx`

- [ ] **Step 4.1: Create `hooks/useAppleSignIn.ts`**

```ts
import { useEffect, useState } from 'react';
import { APPLE_AVAILABLE, signInWithApple } from '../lib/appleAuth';

export function useAppleSignIn() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    void APPLE_AVAILABLE.then(setAvailable);
  }, []);
  return { available, signIn: signInWithApple };
}
```

- [ ] **Step 4.2: Create `components/auth/AppleSignInButton.tsx`**

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../../constants/theme';

interface Props {
  onPress: () => void;
  disabled?: boolean;
}

export default function AppleSignInButton({ onPress, disabled }: Props) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.btn, disabled && styles.disabled]}>
      <Ionicons name="logo-apple" size={18} color="#fff" />
      <Text style={styles.text}>Continue with Apple</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
  },
  disabled: { opacity: 0.6 },
  text: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: '#fff' },
});
```

- [ ] **Step 4.3: Commit**

```bash
git add hooks/useAppleSignIn.ts components/auth/AppleSignInButton.tsx
git commit -m "feat(auth): useAppleSignIn hook + AppleSignInButton component"
```

---

## Phase 2 — Stage / gender / date primitives

### Task 5: `lib/dateValidation.ts` with stage-aware validators

**Files:** `lib/dateValidation.ts`, `tests/dateValidation.test.ts`

- [ ] **Step 5.1: Write failing tests**

Create `tests/dateValidation.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { validateNewbornDob, validatePregnantDueDate } from '../lib/dateValidation';

describe('validateNewbornDob', () => {
  test('accepts a recent past DOB', () => {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    expect(validateNewbornDob(d.toISOString().slice(0, 10))).toBeNull();
  });
  test('rejects a future DOB with the stage-suggesting message', () => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    expect(validateNewbornDob(d.toISOString().slice(0, 10))).toContain('switch');
  });
  test('rejects a date > 18 years ago', () => {
    expect(validateNewbornDob('2005-01-01')).toContain('18 years');
  });
  test('rejects year < 2010', () => {
    expect(validateNewbornDob('2009-12-31')).toContain('2010');
  });
});

describe('validatePregnantDueDate', () => {
  test('accepts a date 6 months in the future', () => {
    const d = new Date(); d.setMonth(d.getMonth() + 6);
    expect(validatePregnantDueDate(d.toISOString().slice(0, 10))).toBeNull();
  });
  test('rejects a past due date with the stage-suggesting message', () => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    expect(validatePregnantDueDate(d.toISOString().slice(0, 10))).toContain('switch');
  });
  test('rejects a due date > 12 months in the future', () => {
    const d = new Date(); d.setMonth(d.getMonth() + 13);
    expect(validatePregnantDueDate(d.toISOString().slice(0, 10))).toContain('12 months');
  });
});
```

- [ ] **Step 5.2: Run, verify fail**

```bash
bun test tests/dateValidation.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 5.3: Create `lib/dateValidation.ts`**

```ts
/**
 * Stage-aware date validators for the onboarding form.
 *
 * Returns null on valid; returns a user-friendly error message on invalid.
 * The error messages explicitly guide the user to flip the stage chip if
 * the date is in the wrong direction — better UX than just "invalid date".
 */

function parse(yyyyMmDd: string): Date | null {
  const d = new Date(yyyyMmDd + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

export function validateNewbornDob(yyyyMmDd: string): string | null {
  const d = parse(yyyyMmDd);
  if (!d) return 'Please pick a valid date.';
  if (d.getFullYear() < 2010) return 'Please pick a date — the year should be 2010 or later.';
  const now = Date.now();
  if (d.getTime() > now) {
    return "That date is in the future. If your baby hasn't arrived yet, switch to 'We're expecting' above.";
  }
  const eighteenYears = 18 * 365 * 86400000;
  if (d.getTime() < now - eighteenYears) return 'That date is more than 18 years ago. Tap to pick a recent date.';
  return null;
}

export function validatePregnantDueDate(yyyyMmDd: string): string | null {
  const d = parse(yyyyMmDd);
  if (!d) return 'Please pick a valid date.';
  if (d.getFullYear() < 2010) return 'Please pick a date — the year should be 2010 or later.';
  const now = Date.now();
  if (d.getTime() <= now) {
    return "That date is in the past. If your baby is already here, switch to 'Baby is here' above.";
  }
  const twelveMonths = 12 * 30.5 * 86400000;
  if (d.getTime() > now + twelveMonths) return 'That date is more than 12 months away. Tap to pick a closer date.';
  return null;
}
```

- [ ] **Step 5.4: Run, verify pass**

```bash
bun test tests/dateValidation.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 5.5: Commit**

```bash
git add lib/dateValidation.ts tests/dateValidation.test.ts
git commit -m "feat(onboarding): stage-aware date validators with switch-stage guidance"
```

---

### Task 6: `StageChip` and `GenderChip` components

**Files:** `components/onboarding/StageChip.tsx`, `components/onboarding/GenderChip.tsx`

- [ ] **Step 6.1: Create `components/onboarding/StageChip.tsx`**

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../constants/theme';

export type Stage = 'pregnant' | 'newborn';

interface Props {
  value: Stage | null;
  onChange: (v: Stage) => void;
}

const OPTIONS: { v: Stage; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { v: 'pregnant', label: "We're expecting", icon: 'heart-outline' },
  { v: 'newborn', label: 'Baby is here', icon: 'happy-outline' },
];

export default function StageChip({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((o) => {
        const active = value === o.v;
        return (
          <Pressable key={o.v} onPress={() => onChange(o.v)} style={[styles.chip, active && styles.chipActive]}>
            <Ionicons name={o.icon} size={20} color={active ? Colors.primary : Colors.textLight} />
            <Text style={[styles.label, active && styles.labelActive]}>{o.label}</Text>
            {active && <Ionicons name="checkmark-circle" size={16} color={Colors.primary} style={styles.check} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  chip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E1EE', backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#F5F0FF', borderColor: Colors.primary },
  label: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.textLight },
  labelActive: { fontFamily: Fonts.sansBold, color: Colors.primary },
  check: { marginLeft: 4 },
});
```

- [ ] **Step 6.2: Create `components/onboarding/GenderChip.tsx`**

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts } from '../../constants/theme';
import type { Stage } from './StageChip';

export type GenderChipValue = 'boy' | 'girl' | 'surprise';

interface Props {
  stage: Stage;
  value: GenderChipValue | null;
  onChange: (v: GenderChipValue) => void;
}

export default function GenderChip({ stage, value, onChange }: Props) {
  const options: { v: GenderChipValue; label: string }[] =
    stage === 'pregnant'
      ? [
          { v: 'boy', label: 'Boy' },
          { v: 'girl', label: 'Girl' },
          { v: 'surprise', label: 'Surprise' },
        ]
      : [
          { v: 'boy', label: 'Boy' },
          { v: 'girl', label: 'Girl' },
        ];

  return (
    <View style={styles.row}>
      {options.map((o) => {
        const active = value === o.v;
        return (
          <Pressable key={o.v} onPress={() => onChange(o.v)} style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.label, active && styles.labelActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: '#E5E1EE', backgroundColor: '#fff', alignItems: 'center' },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  label: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.textLight },
  labelActive: { fontFamily: Fonts.sansBold, color: '#fff' },
});
```

- [ ] **Step 6.3: Type-check + commit**

```bash
bun run tsc --noEmit 2>&1 | head -20
git add components/onboarding/StageChip.tsx components/onboarding/GenderChip.tsx
git commit -m "feat(onboarding): StageChip + stage-dependent GenderChip components"
```

---

### Task 7: `MorphingHero` component

**Files:** `components/onboarding/MorphingHero.tsx`, `lib/illustrations.ts`

- [ ] **Step 7.1: Register the new illustrations**

Open `lib/illustrations.ts`. Find the map of `IllustrationName → require()`. Add:

```ts
onboardingExpecting: require('../assets/onboardingExpecting.png'),
onboardingNewborn: require('../assets/onboardingNewborn.png'),
```

And add `'onboardingExpecting'` and `'onboardingNewborn'` to the `IllustrationName` type union.

- [ ] **Step 7.2: Create `components/onboarding/MorphingHero.tsx`**

```tsx
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Illustration } from '../ui/Illustration';
import type { Stage } from './StageChip';

interface Props {
  stage: Stage | null;
}

export default function MorphingHero({ stage }: Props) {
  const expectingOpacity = useSharedValue(stage === 'pregnant' ? 1 : stage === 'newborn' ? 0 : 0.4);
  const newbornOpacity = useSharedValue(stage === 'newborn' ? 1 : 0);

  useEffect(() => {
    expectingOpacity.value = withTiming(stage === 'pregnant' ? 1 : 0, { duration: 250 });
    newbornOpacity.value = withTiming(stage === 'newborn' ? 1 : 0, { duration: 250 });
  }, [stage]);

  const expectingStyle = useAnimatedStyle(() => ({ opacity: expectingOpacity.value }));
  const newbornStyle = useAnimatedStyle(() => ({ opacity: newbornOpacity.value }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.layer, expectingStyle]} pointerEvents="none">
        <Illustration name="onboardingExpecting" style={styles.illus} contentFit="contain" />
      </Animated.View>
      <Animated.View style={[styles.layer, newbornStyle]} pointerEvents="none">
        <Illustration name="onboardingNewborn" style={styles.illus} contentFit="contain" />
      </Animated.View>
      {!stage && (
        // Neutral placeholder before any stage is picked — show expecting at 40% so the canvas isn't empty.
        <Animated.View style={[styles.layer, { opacity: 0.4 }]} pointerEvents="none">
          <Illustration name="onboardingExpecting" style={styles.illus} contentFit="contain" />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', height: 180, marginBottom: 12, alignItems: 'center', justifyContent: 'center' },
  layer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  illus: { width: 180, height: 180 },
});
```

- [ ] **Step 7.3: Commit**

```bash
git add components/onboarding/MorphingHero.tsx lib/illustrations.ts
git commit -m "feat(onboarding): morphing hero illustration (expecting ↔ newborn cross-fade)"
```

---

### Task 8: `LivePreviewPill` component

**Files:** `components/onboarding/LivePreviewPill.tsx`

- [ ] **Step 8.1: Create the component**

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, Colors } from '../../constants/theme';

interface Props {
  message: string | null;
}

export default function LivePreviewPill({ message }: Props) {
  if (!message) return null;
  return (
    <View style={styles.pill}>
      <Ionicons name="sparkles-outline" size={14} color={Colors.primary} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F5F0FF', borderColor: '#E0D4F6', borderWidth: 1,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12,
  },
  text: { flex: 1, fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.textDark, lineHeight: 18 },
});
```

Buildable preview-message helper goes inside the onboarding screen (Task 11) since it needs profile-store context.

- [ ] **Step 8.2: Commit**

```bash
git add components/onboarding/LivePreviewPill.tsx
git commit -m "feat(onboarding): LivePreviewPill component for unlocked preview copy"
```

---

## Phase 3 — Auth entry rewrite

### Task 9: `SmartInputCard` component (Layout C)

**Files:** `components/auth/SmartInputCard.tsx`

- [ ] **Step 9.1: Create the component**

```tsx
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import GradientButton from '../ui/GradientButton';
import GoogleGIcon from '../ui/GoogleGIcon';
import AppleSignInButton from './AppleSignInButton';
import { Colors, Fonts } from '../../constants/theme';

interface Props {
  onSubmitPhone: (e164: string) => void;
  onPressGoogle: () => void;
  onPressApple: () => void;
  showApple: boolean;
  loading?: boolean;
  error?: string;
}

export default function SmartInputCard({
  onSubmitPhone, onPressGoogle, onPressApple, showApple, loading, error,
}: Props) {
  const [digits, setDigits] = useState('');
  const clean = digits.replace(/\D/g, '').slice(0, 10);
  const valid = clean.length === 10 && /^[6-9]/.test(clean);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Let's get you in</Text>
      <Text style={styles.sub}>Just your number. We'll figure out the rest.</Text>

      <View style={styles.inputRow}>
        <Text style={styles.prefix}>🇮🇳 +91</Text>
        <TextInput
          value={clean}
          onChangeText={setDigits}
          placeholder="Mobile number"
          placeholderTextColor="#9ca3af"
          keyboardType="phone-pad"
          maxLength={10}
          style={styles.input}
          accessibilityLabel="Indian mobile number"
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <GradientButton
        title={loading ? 'Sending OTP…' : 'Continue'}
        onPress={() => valid && onSubmitPhone(`+91${clean}`)}
        style={styles.cta}
      />

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>faster sign-in</Text>
        <View style={styles.dividerLine} />
      </View>

      <Pressable style={styles.googleBtn} onPress={onPressGoogle}>
        <GoogleGIcon size={18} />
        <Text style={styles.googleText}>Continue with Google</Text>
      </Pressable>

      {showApple && <View style={{ marginTop: 8 }}><AppleSignInButton onPress={onPressApple} /></View>}

      <Text style={styles.footnote}>Returning user? Same screen — we'll detect your account.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 380 },
  title: { fontFamily: Fonts.serif, fontSize: 24, color: Colors.textDark, textAlign: 'center', marginBottom: 4 },
  sub: { fontFamily: Fonts.sansRegular, fontSize: 13, color: Colors.textLight, textAlign: 'center', marginBottom: 18, lineHeight: 19 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F9F7FD', borderColor: '#E5E1EE', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  prefix: { fontFamily: Fonts.sansBold, fontSize: 14, color: Colors.textDark },
  input: { flex: 1, fontFamily: Fonts.sansRegular, fontSize: 16, color: Colors.textDark, paddingVertical: 0 },
  errorText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: '#ef4444', marginTop: 6 },
  cta: { marginTop: 12 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E1EE' },
  dividerText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: Colors.textLight, letterSpacing: 0.5, textTransform: 'uppercase' },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#fff', borderColor: '#E5E1EE', borderWidth: 1, borderRadius: 12, paddingVertical: 14 },
  googleText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: Colors.textDark },
  footnote: { fontFamily: Fonts.sansRegular, fontSize: 11, color: Colors.textLight, textAlign: 'center', marginTop: 14, lineHeight: 16 },
});
```

- [ ] **Step 9.2: Commit**

```bash
git add components/auth/SmartInputCard.tsx
git commit -m "feat(auth): SmartInputCard (Layout C — phone-first with Google/Apple shortcuts)"
```

---

### Task 10: Rewrite `app/(auth)/welcome.tsx` as Smart input entry

**Files:** `app/(auth)/welcome.tsx`

- [ ] **Step 10.1: Read the existing file fully**

Read `app/(auth)/welcome.tsx`. Note the marketing landing for web (`IS_WEB` path) — preserve that below-the-fold content for SEO / Play Console URL crawlability.

- [ ] **Step 10.2: Rewrite as phone-first entry, preserving web marketing scroll**

Replace the file with a structure that:

1. Renders `<SmartInputCard>` above the fold for both web and native.
2. Below the fold on web only, keeps the existing FEATURES grid + STEPS + trust card + footer for SEO.
3. Keeps the cache-stuck escape link from Plan A Task 17.

Outline (real code; long but every block matters):

```tsx
import { useState } from 'react';
import { Alert, Image, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import SmartInputCard from '../../components/auth/SmartInputCard';
import { Illustration } from '../../components/ui/Illustration';
import { useAuthStore } from '../../store/useAuthStore';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import { useAppleSignIn } from '../../hooks/useAppleSignIn';
import { wipeAllLocalStorage } from '../../lib/storageEscape';
import { friendlyAuthError } from '../../lib/friendlyAuthError';
import { isAdminEmail } from '../../lib/admin';
import { logAuthEvent } from '../../lib/authObservability';
import { Fonts, Colors } from '../../constants/theme';

const LOGO = require('../../assets/logo.png');
const IS_WEB = Platform.OS === 'web';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const { onGoogleCredential, onAppleCredential } = useAuthStore();
  const isLoading = useAuthStore((s) => s.isLoading);
  const { signIn: googleSignIn, ready: googleReady } = useGoogleSignIn();
  const { available: appleAvailable, signIn: appleSignIn } = useAppleSignIn();

  const [authError, setAuthError] = useState<string>('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [showEscape, setShowEscape] = useState(false);

  // 5-second cache-stuck escape hatch (from Plan A)
  useEffect(() => {
    if (!isLoading) { setShowEscape(false); return; }
    const t = setTimeout(() => setShowEscape(true), 5000);
    return () => clearTimeout(t);
  }, [isLoading]);

  const handleSubmitPhone = (e164: string) => {
    setPhoneLoading(true);
    // Pass through to the phone-OTP screen with the prefilled E.164 number
    router.push({ pathname: '/(auth)/phone', params: { e164 } });
    setPhoneLoading(false);
  };

  const handleGoogle = async () => {
    setAuthError('');
    try {
      const credential = await googleSignIn();
      const dest = await onGoogleCredential(credential);
      if (isAdminEmail(credential.user.email)) return router.replace('/admin');
      router.replace(dest === 'tabs' ? '/(tabs)' : dest === 'phone' ? '/(auth)/phone' : '/(auth)/onboarding');
    } catch (e: any) {
      logAuthEvent({ type: 'auth:method-cancelled', method: 'google' });
      setAuthError(friendlyAuthError(e, 'google'));
    }
  };

  const handleApple = async () => {
    setAuthError('');
    try {
      const credential = await appleSignIn();
      const dest = await onAppleCredential(credential);
      if (isAdminEmail(credential.user.email)) return router.replace('/admin');
      router.replace(dest === 'tabs' ? '/(tabs)' : dest === 'phone' ? '/(auth)/phone' : '/(auth)/onboarding');
    } catch (e: any) {
      logAuthEvent({ type: 'auth:method-cancelled', method: 'apple' });
      setAuthError(friendlyAuthError(e, 'apple'));
    }
  };

  const handleEscape = () => {
    const txt = 'This will clear cached data and sign you out completely. Continue?';
    if (typeof window !== 'undefined' && window.confirm(txt)) void wipeAllLocalStorage();
    else if (typeof window === 'undefined') {
      Alert.alert('Reset local storage', txt, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => void wipeAllLocalStorage() },
      ]);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.container, isWide && styles.containerWide]}>
        <View style={styles.hero}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <Text style={styles.wordmark}>MaaMitra</Text>
          <Text style={styles.tagline}>Your AI mitra for every step of parenthood.</Text>
        </View>

        <SmartInputCard
          onSubmitPhone={handleSubmitPhone}
          onPressGoogle={handleGoogle}
          onPressApple={handleApple}
          showApple={appleAvailable}
          loading={phoneLoading || !googleReady}
          error={authError}
        />

        {showEscape && (
          <TouchableOpacity onPress={handleEscape} style={{ marginTop: 16 }}>
            <Text style={styles.escapeLink}>Trouble signing in? Reset local storage.</Text>
          </TouchableOpacity>
        )}

        {IS_WEB && (
          // Below-the-fold marketing scroll for SEO / Play Console URL.
          // Preserved verbatim from the prior welcome.tsx — search engines
          // and Play Console need this content discoverable on /welcome.
          <WebMarketingSection isWide={isWide} />
        )}
      </View>
    </ScrollView>
  );
}

// Move the existing FEATURES/STEPS/trust/finalCta/footer JSX from
// the prior welcome.tsx into this function verbatim, minus the CTAs
// (which are now in SmartInputCard above the fold).
function WebMarketingSection({ isWide }: { isWide: boolean }) {
  /* ...preserved marketing content from prior welcome.tsx... */
  return null; // placeholder — implementer copies the original section
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgLight },
  scroll: { flexGrow: 1, alignItems: 'center' },
  container: { paddingHorizontal: 22, alignSelf: 'stretch', alignItems: 'center' },
  containerWide: { maxWidth: 960, paddingHorizontal: 32 },
  hero: { alignItems: 'center', marginBottom: 18 },
  logo: { width: 56, height: 56, marginBottom: 6 },
  wordmark: { fontFamily: Fonts.serif, fontSize: 36, color: Colors.textDark, letterSpacing: -0.4, marginBottom: 6 },
  tagline: { fontFamily: Fonts.sansRegular, fontSize: 14, color: Colors.textLight, textAlign: 'center', maxWidth: 320, lineHeight: 20 },
  escapeLink: { fontFamily: Fonts.sansMedium, fontSize: 11, color: Colors.textLight, textDecorationLine: 'underline', textAlign: 'center' },
});
```

**Critical:** the `WebMarketingSection` placeholder MUST be filled with the existing FEATURES/STEPS/trust/finalCta JSX from the prior `welcome.tsx`. Read the previous file, copy those sections, drop into the function body, remove only the top-of-page hero + duplicate CTAs (now handled by SmartInputCard).

- [ ] **Step 10.3: Type-check + smoke**

```bash
bun run tsc --noEmit 2>&1 | head -20
bun run start
```

Manually verify: welcome screen shows new SmartInputCard above the fold on both web and native. Marketing scroll still visible on web below.

- [ ] **Step 10.4: Commit**

```bash
git add app/\(auth\)/welcome.tsx
git commit -m "feat(auth): rewrite welcome screen as Smart input entry (Layout C)"
```

---

### Task 11: Delete deprecated auth screens

**Files:** delete `app/signup.tsx`, `app/signin.tsx`, `app/(auth)/sign-up.tsx`, `app/(auth)/sign-in.tsx`, `app/(auth)/forgot-password.tsx`, `app/(auth)/verify-email.tsx`

- [ ] **Step 11.1: Grep for incoming links to these routes**

```bash
grep -rEn "/(auth)/sign-up|/(auth)/sign-in|/(auth)/forgot-password|/(auth)/verify-email|/signup|/signin" --include="*.tsx" --include="*.ts" app/ components/ store/ lib/ services/ hooks/ 2>/dev/null
```

Note every callsite. Each must be removed or redirected to `/(auth)/welcome` before deleting the route files.

- [ ] **Step 11.2: Remove `signUp` / `signIn` actions from useAuthStore (or stub them)**

In `store/useAuthStore.ts`, remove the `signUp` and `signIn` action implementations (email/password). Remove from the interface too. Any remaining caller will fail to type-check — that's the desired surface.

- [ ] **Step 11.3: Remove imports/references**

Resolve every grep finding from Step 11.1. Typically just removing dead links / "Sign in" buttons that pointed at the deprecated routes.

- [ ] **Step 11.4: Delete the files**

```bash
git rm app/signup.tsx app/signin.tsx
git rm app/\(auth\)/sign-up.tsx app/\(auth\)/sign-in.tsx
git rm app/\(auth\)/forgot-password.tsx app/\(auth\)/verify-email.tsx
```

- [ ] **Step 11.5: Type-check + commit**

```bash
bun run tsc --noEmit 2>&1 | head -30
```

Fix any remaining errors. Then:

```bash
git add -A
git commit -m "refactor(auth): delete deprecated email/password screens

The Smart input welcome screen is now the single entry point.
sign-up, sign-in, forgot-password, verify-email — all removed.
useAuthStore.signUp + signIn (email/password) removed."
```

---

## Phase 4 — Strict phone gate

### Task 12: Harden `app/(auth)/phone.tsx`

**Files:** `app/(auth)/phone.tsx`

- [ ] **Step 12.1: Read the current file**

Read `app/(auth)/phone.tsx` fully. Note current back-button behaviour, skip affordances, recaptcha handling.

- [ ] **Step 12.2: Apply strict-gate edits**

1. **Accept e164 from route params** — if `useLocalSearchParams().e164` is present (passed from welcome screen), pre-fill the input and auto-submit.

2. **Remove any skip / "later" affordance** — search the file for "skip" / "later" / "back" buttons or links. Delete them.

3. **Intercept hardware back on Android:** add a `useFocusEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => true); return () => sub.remove(); }, [])` block.

4. **Add a Sign out link at the bottom-right** that opens `useSignOut()`'s confirm modal — this is the only escape route from the gate.

5. **On successful OTP verify:** route based on `useProfileStore.onboardingComplete` — completed → `/(tabs)` (or `/admin` for admin), not-completed → `/(auth)/onboarding`. The router's three-gate guard from Plan A already handles this on every render; we just call `router.replace('/')` and let the guard route correctly.

- [ ] **Step 12.3: Add observability events**

In `handleSendOtp` success path:

```ts
logAuthEvent({ type: 'auth:phone-otp-sent', e164Masked: e164.slice(0, 6) + '****' });
```

In `handleVerifyOtp` success:

```ts
logAuthEvent({ type: 'auth:phone-otp-verified', uid: user?.uid ?? '' });
```

In failure paths:

```ts
logAuthEvent({ type: 'auth:phone-otp-failed', reason: String(e?.code ?? e?.message ?? 'unknown') });
```

- [ ] **Step 12.4: Type-check + manual smoke**

```bash
bun run tsc --noEmit 2>&1 | head -20
bun run start
```

Manual: sign in via Google → land on `/(auth)/phone`. Try every bypass: hardware back, browser back, direct URL navigation to `/(tabs)`, `/admin`. All blocked. Sign-out link works (opens unified confirm modal).

- [ ] **Step 12.5: Commit**

```bash
git add app/\(auth\)/phone.tsx
git commit -m "feat(auth): phone OTP screen is a strict, unbypassable gate

- Accepts e164 from route params (deep link from welcome SmartInputCard)
- Removes all skip / back / 'later' affordances
- Intercepts hardware back on Android
- Sign-out link in footer is the only exit (uses unified hook)
- Structured observability for every OTP event"
```

---

## Phase 5 — Onboarding form rewrite

### Task 13: Build `app/(auth)/onboarding.tsx` as single-screen progressive reveal

**Files:** `app/(auth)/onboarding.tsx`

- [ ] **Step 13.1: Delete the current 4-step file**

```bash
git rm app/\(auth\)/onboarding.tsx
```

- [ ] **Step 13.2: Create the new single-screen onboarding**

Create `app/(auth)/onboarding.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';
import DatePickerField from '../../components/ui/DatePickerField';
import GradientButton from '../../components/ui/GradientButton';
import MorphingHero from '../../components/onboarding/MorphingHero';
import StageChip, { type Stage } from '../../components/onboarding/StageChip';
import GenderChip, { type GenderChipValue } from '../../components/onboarding/GenderChip';
import LivePreviewPill from '../../components/onboarding/LivePreviewPill';
import { validateNewbornDob, validatePregnantDueDate } from '../../lib/dateValidation';
import { Colors, Fonts } from '../../constants/theme';

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { setMotherName, setProfile, addKid, setParentGender, onboardingComplete } = useProfileStore();
  const isAuthed = useAuthStore((s) => s.isAuthenticated);
  const phoneOnFile = useProfileStore((s) => s.phoneVerified);

  // Re-entry guards — <Redirect> not router.replace (project Rule 5)
  if (!isAuthed) return <Redirect href="/(auth)/welcome" />;
  if (!phoneOnFile) return <Redirect href="/(auth)/phone" />;
  if (onboardingComplete) return <Redirect href="/(tabs)" />;

  const initialName = user?.name ?? '';
  const [name, setName] = useState(initialName);
  const [stage, setStage] = useState<Stage | null>(null);
  const [keyDate, setKeyDate] = useState('');
  const [kidName, setKidName] = useState('');
  const [kidGenderChip, setKidGenderChip] = useState<GenderChipValue | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const showNameField = !initialName;
  const dateLabel = stage === 'pregnant' ? 'Due date' : 'Date of birth';
  const namePlaceholder = stage === 'pregnant' ? 'Have you picked a name yet? (optional)' : "Baby's name (optional)";

  const livePreview = useMemo(() => {
    if (!stage || !keyDate || dateError) return null;
    const d = new Date(keyDate + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    if (stage === 'pregnant') {
      const weeks = Math.max(0, Math.min(40, 40 - Math.round((d.getTime() - Date.now()) / (7 * 86400000))));
      const tri = weeks <= 13 ? 'first' : weeks <= 27 ? 'second' : 'third';
      return `You're around ${weeks} weeks in — your ${tri} trimester. Your mitra is ready.`;
    }
    const months = Math.max(0, Math.round((Date.now() - d.getTime()) / (30.5 * 86400000)));
    const who = kidName.trim() || 'Little one';
    return `${who} is ${months} ${months === 1 ? 'month' : 'months'} old. Vaccines and milestones loaded.`;
  }, [stage, keyDate, dateError, kidName]);

  const onDateChange = (v: string) => {
    setKeyDate(v);
    if (!stage) { setDateError(null); return; }
    setDateError(stage === 'pregnant' ? validatePregnantDueDate(v) : validateNewbornDob(v));
  };

  const onStageChange = (s: Stage) => {
    setStage(s);
    setKidGenderChip(null);
    if (keyDate) setDateError(s === 'pregnant' ? validatePregnantDueDate(keyDate) : validateNewbornDob(keyDate));
  };

  const canSubmit = !!(name.trim() && stage && keyDate && !dateError);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      setParentGender('mother');
      setMotherName(name.trim());

      const parsed = new Date(keyDate + 'T00:00:00');
      const validKeyDate = !isNaN(parsed.getTime()) ? parsed.toISOString() : '';
      const isExpecting = stage === 'pregnant';

      setProfile({
        stage: stage!,
        keyDate: validKeyDate,
        state: '', // collected JIT
        diet: 'vegetarian', // default; collected JIT
        familyType: 'nuclear', // default; collected via Settings
      });

      const primaryName = kidName.trim() || 'Little one';
      const genderToStore: 'boy' | 'girl' | 'surprise' | 'not-set' =
        kidGenderChip
          ? kidGenderChip
          : stage === 'pregnant'
            ? 'surprise'
            : 'not-set';

      addKid({
        name: primaryName,
        dob: validKeyDate,
        stage: isExpecting ? 'pregnant' : 'newborn',
        gender: genderToStore,
        isExpecting,
      });

      // Hand off to existing setup screen (Firestore write + onboardingComplete flip)
      (router.replace as any)('/(auth)/setup');
    } catch (err: any) {
      Alert.alert('Could not continue', err?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <MorphingHero stage={stage} />

          <Text style={styles.heading}>{initialName ? `Hi, ${initialName.split(' ')[0]} 👋` : "Let's get to know you"}</Text>
          <Text style={styles.sub}>Just a few quick things so MaaMitra can be your mitra, not a generic chatbot.</Text>

          {showNameField && (
            <View style={styles.field}>
              <Text style={styles.label}>Your name</Text>
              <TextInput value={name} onChangeText={setName} placeholder="How should we address you?" placeholderTextColor="#9ca3af" style={styles.input} autoCapitalize="words" />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Where are you right now?</Text>
            <StageChip value={stage} onChange={onStageChange} />
          </View>

          {stage && (
            <View style={styles.field}>
              <Text style={styles.label}>{dateLabel}</Text>
              <DatePickerField value={keyDate} onChange={onDateChange} />
              {dateError && <Text style={styles.errorText}>{dateError}</Text>}
            </View>
          )}

          {stage && keyDate && !dateError && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>{namePlaceholder}</Text>
                <TextInput value={kidName} onChangeText={setKidName} placeholder={stage === 'pregnant' ? 'Even a working name helps' : 'e.g. Aarav'} placeholderTextColor="#9ca3af" style={styles.input} autoCapitalize="words" />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Gender</Text>
                <GenderChip stage={stage} value={kidGenderChip} onChange={setKidGenderChip} />
              </View>

              <LivePreviewPill message={livePreview} />
            </>
          )}

          <GradientButton title={submitting ? 'Setting up…' : 'Take me in →'} onPress={handleSubmit} disabled={!canSubmit || submitting} style={styles.cta} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgLight },
  scroll: { paddingHorizontal: 22, paddingBottom: 40 },
  heading: { fontFamily: Fonts.serif, fontSize: 24, color: Colors.textDark, textAlign: 'center', marginTop: 4 },
  sub: { fontFamily: Fonts.sansRegular, fontSize: 13, color: Colors.textLight, textAlign: 'center', marginBottom: 18, lineHeight: 19 },
  field: { marginBottom: 18 },
  label: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: Colors.textDark, marginBottom: 8 },
  input: { backgroundColor: '#F9F7FD', borderColor: '#E5E1EE', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Fonts.sansRegular, fontSize: 16, color: Colors.textDark },
  errorText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: '#ef4444', marginTop: 6 },
  cta: { marginTop: 16 },
});
```

- [ ] **Step 13.3: Type-check + smoke test**

```bash
bun run tsc --noEmit 2>&1 | head -20
bun run start
```

Manual: complete the form end-to-end for both stages. Verify morphing hero transitions, live preview unlocks, validation errors guide to switch stage.

- [ ] **Step 13.4: Commit**

```bash
git add app/\(auth\)/onboarding.tsx
git commit -m "feat(onboarding): rewrite as single-screen progressive reveal (Layout B)

- Morphing hero illustration (expecting ↔ newborn cross-fade)
- Progressive field reveal: stage → date → name → gender
- Live preview pill unlocks once stage + date set
- Stage-dependent gender chip (3 chips pregnant, 2 chips newborn)
- Stage-aware date validation with switch-stage guidance
- All deferred fields (state, diet, family) defaulted, collected JIT"
```

---

## Phase 6 — Just-in-time prompts

### Task 14: `JustInTimePrompt` primitive

**Files:** `components/jit/JustInTimePrompt.tsx`, `tests/jit-prompt.test.ts`

- [ ] **Step 14.1: Write the failing test**

```ts
import { describe, expect, test, beforeEach } from 'bun:test';
import { useProfileStore } from '../store/useProfileStore';

describe('JIT prompt dismissal semantics', () => {
  beforeEach(() => useProfileStore.getState().resetProfile());
  test('shouldShow when key not yet answered/dismissed', () => {
    expect(useProfileStore.getState().isPromptDismissed('diet')).toBe(false);
  });
  test('shouldShow=false after dismiss', () => {
    useProfileStore.getState().dismissPrompt('diet');
    expect(useProfileStore.getState().isPromptDismissed('diet')).toBe(true);
  });
});
```

- [ ] **Step 14.2: Create the primitive**

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../constants/theme';
import { useProfileStore } from '../../store/useProfileStore';

interface Props {
  promptKey: string;          // dedup key (e.g. 'diet', 'state', 'kidName')
  question: string;
  reason: string;
  visible: boolean;           // owner controls visibility (e.g. !profile.diet)
  children: React.ReactNode;  // the input or chip group
  onSkip?: () => void;
}

export default function JustInTimePrompt({ promptKey, question, reason, visible, children, onSkip }: Props) {
  const dismissed = useProfileStore((s) => s.dismissedPrompts[promptKey] ?? false);
  const dismiss = useProfileStore((s) => s.dismissPrompt);

  if (!visible || dismissed) return null;

  return (
    <View style={styles.card}>
      <Pressable style={styles.closeBtn} onPress={() => { dismiss(promptKey); onSkip?.(); }} hitSlop={8}>
        <Ionicons name="close" size={16} color={Colors.textLight} />
      </Pressable>
      <Text style={styles.q}>{question}</Text>
      <Text style={styles.r}>{reason}</Text>
      {children}
      <Pressable onPress={() => { dismiss(promptKey); onSkip?.(); }} style={styles.skipBtn} hitSlop={8}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderColor: '#E0D4F6', borderWidth: 1,
    borderRadius: 14, padding: 14, marginBottom: 12, position: 'relative',
  },
  closeBtn: { position: 'absolute', top: 10, right: 10, padding: 4 },
  q: { fontFamily: Fonts.sansBold, fontSize: 14, color: Colors.textDark, paddingRight: 28, marginBottom: 4 },
  r: { fontFamily: Fonts.sansRegular, fontSize: 12, color: Colors.textLight, marginBottom: 10, lineHeight: 17 },
  skipBtn: { alignSelf: 'flex-start', marginTop: 8 },
  skipText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: Colors.textLight, textDecorationLine: 'underline' },
});
```

- [ ] **Step 14.3: Run test + commit**

```bash
bun test tests/jit-prompt.test.ts
git add components/jit/JustInTimePrompt.tsx tests/jit-prompt.test.ts
git commit -m "feat(jit): JustInTimePrompt primitive for deferred-field collection"
```

---

### Task 15: Diet, State, KidName, KidGender JIT prompt instances

**Files:** `components/jit/DietPrompt.tsx`, `components/jit/StatePrompt.tsx`, `components/jit/KidNamePrompt.tsx`, `components/jit/KidGenderPrompt.tsx`

- [ ] **Step 15.1: Create each instance**

Each is a thin wrapper around `JustInTimePrompt` with its own chip group / input. Pattern:

```tsx
// DietPrompt.tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import JustInTimePrompt from './JustInTimePrompt';
import { useProfileStore } from '../../store/useProfileStore';
import { Colors, Fonts } from '../../constants/theme';

const DIETS = [
  { v: 'vegetarian', label: '🌿 Vegetarian' },
  { v: 'eggetarian', label: '🥚 Eggetarian' },
  { v: 'non-vegetarian', label: '🍗 Non-veg' },
  { v: 'vegan', label: '🌱 Vegan' },
] as const;

export default function DietPrompt() {
  const profile = useProfileStore((s) => s.profile);
  const setProfile = useProfileStore((s) => s.setProfile);
  const dismiss = useProfileStore((s) => s.dismissPrompt);

  const visible = !profile?.diet || profile.diet === 'vegetarian'; // default-set is treated as unanswered
  // Note: if you'd rather differentiate, use a separate 'dietAnswered' flag.

  const set = (v: typeof DIETS[number]['v']) => {
    if (!profile) return;
    setProfile({ ...profile, diet: v });
    dismiss('diet');
  };

  return (
    <JustInTimePrompt
      promptKey="diet"
      question="Quick — what works for your home?"
      reason="So we filter weaning foods to match your kitchen."
      visible={visible}
    >
      <View style={styles.chipRow}>
        {DIETS.map((d) => (
          <Pressable key={d.v} onPress={() => set(d.v)} style={styles.chip}>
            <Text style={styles.chipText}>{d.label}</Text>
          </Pressable>
        ))}
      </View>
    </JustInTimePrompt>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderColor: '#E5E1EE', borderWidth: 1, backgroundColor: '#fff' },
  chipText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.textDark },
});
```

Similarly for:
- `StatePrompt.tsx` — opens existing `StateSelectorComponent` modal on tap; sets `profile.state`.
- `KidNamePrompt.tsx` — single text input; sets `kids[active].name`.
- `KidGenderPrompt.tsx` — 2-chip group (Boy / Girl); only renders when active kid is newborn AND gender === 'not-set'.

(Implementer fills these analogously, ~25-40 lines each.)

- [ ] **Step 15.2: Commit**

```bash
git add components/jit/
git commit -m "feat(jit): Diet, State, KidName, KidGender prompt instances"
```

---

### Task 16: Wire JIT prompts into tabs

**Files:** `app/(tabs)/foods.tsx`, `app/(tabs)/community.tsx`, `app/(tabs)/health.tsx`, `app/(tabs)/family.tsx`, `app/(tabs)/index.tsx`

- [ ] **Step 16.1: foods.tsx — wire DietPrompt**

Near the top of the tab content (above any food list):

```tsx
import DietPrompt from '../../components/jit/DietPrompt';
// ...
<DietPrompt />
{/* existing foods content */}
```

- [ ] **Step 16.2: community.tsx + health.tsx — wire StatePrompt**

Same pattern.

- [ ] **Step 16.3: family.tsx — wire KidGenderPrompt**

Near the active-kid card.

- [ ] **Step 16.4: index.tsx (home) — wire KidNamePrompt**

Below the home greeting, before the home cards. Show only if `kids[active].name === 'Little one'`.

- [ ] **Step 16.5: Smoke test each tab**

```bash
bun run start
```

For each tab, verify the prompt appears, can be answered or dismissed, and never reappears after.

- [ ] **Step 16.6: Commit**

```bash
git add app/\(tabs\)/
git commit -m "feat(jit): wire JIT prompts into Foods, Community, Health, Family, Home tabs"
```

---

### Task 17: `familyType` editor in SettingsModal

**Files:** `components/ui/SettingsModal.tsx`

- [ ] **Step 17.1: Add a "More about you" section**

In `SettingsModal.tsx`, in the user-profile section (search for the existing state/diet editors around line 1801-1823), add a new editable row for `familyType`:

```tsx
<View style={styles.editRow}>
  <Text style={styles.editLabel}>Family setup</Text>
  <Picker
    selectedValue={profile.familyType}
    onValueChange={(v) => setProfile({ ...profile, familyType: v as any })}
  >
    <Picker.Item label="Nuclear" value="nuclear" />
    <Picker.Item label="Joint" value="joint" />
    <Picker.Item label="With in-laws" value="in-laws" />
    <Picker.Item label="Single parent" value="single-parent" />
  </Picker>
</View>
```

(Adapt to match the existing pattern in the file — it may use chip groups or different picker primitives. Match the style.)

- [ ] **Step 17.2: Commit**

```bash
git add components/ui/SettingsModal.tsx
git commit -m "feat(settings): familyType editor in 'more about you' section"
```

---

## Phase 7 — Final QA

### Task 18: Run all bug-replication tests from spec §9

- [ ] **Step 18.1: Run automated suite**

```bash
bun test
bun run tsc --noEmit
```

Expected: all green.

- [ ] **Step 18.2: Manual bug-replication suite**

Re-run all of Plan A Task 20's manual tests (stale cache, sign-out flash on settings + admin, no identity mixing, phone gate cannot be bypassed). Plus new Plan B tests:

- Test #18 (Apple re-signin): sign in on iOS with Apple. Sign out. Sign back in. Verify display name from first signin is preserved.
- Form: complete onboarding both as pregnant (Surprise default) and newborn (Not-set default if gender skipped). Verify both produce sensible AI greetings.
- Test #16 again: phone gate cannot be bypassed via deep-link, hardware back, browser back.
- JIT prompts: each prompt fires on first tab tap, answering it removes it, dismissing it removes it, navigating away+back does not re-show.

- [ ] **Step 18.3: `/design-review` pass**

Run the gstack `/design-review` skill against the deployed staging build. **Must produce zero design drift findings.**

- [ ] **Step 18.4: `/qa` pass**

Run the gstack `/qa` skill (Standard tier) on the full signup journey. Must pass.

---

### Task 19: Update HANDOFF.md + ship chain

- [ ] **Step 19.1: Update HANDOFF.md**

```markdown
## Last action

Landed Plan B — New Signup Journey:
- Layout C welcome (phone-first SmartInputCard, Google + Apple shortcuts)
- Strict phone gate (no back, no skip, sign-out is the only exit)
- Layout B onboarding (single screen, morphing hero, progressive reveal)
- Stage-aware date validation (DOB ≤18y, Due Date ≤12mo)
- Just-in-time prompts for diet, state, kidName, kidGender
- Apple SIWA on web + iOS
- familyType editor in Settings
- Deleted: sign-up, sign-in, forgot-password, verify-email screens
```

- [ ] **Step 19.2: Ship chain**

```bash
git pull --rebase origin main
bun run tsc --noEmit && bun test
git push
# ship chain (EAS update + Firebase deploy via project scripts)
npm run update
```

- [ ] **Step 19.3: Monitor**

After OTA: monitor admin reports for 48h. Watch logs for `auth:*` events. If any unexpected pattern emerges, investigate immediately using the structured logging.

---

## Self-review checklist

- [ ] All tasks 0–19 committed.
- [ ] `bun test` green (existing + new tests).
- [ ] `bun run tsc --noEmit` green.
- [ ] All deprecated auth screens deleted; grep finds zero callers.
- [ ] Apple SIWA works on iOS and web.
- [ ] Phone gate strictly cannot be bypassed.
- [ ] Onboarding form is a single screen with progressive reveal.
- [ ] All 4 JIT prompts (Diet, State, KidName, KidGender) wired into their respective tabs.
- [ ] `/design-review` zero drift findings.
- [ ] `/qa` Standard tier pass.

---

## Spec coverage check

| Spec section | Tasks |
|---|---|
| §5.2 Auth entry Layout C | 9, 10 |
| §5.3 Strict phone gate | 12 |
| §5.4 Onboarding Layout B | 13 |
| §5.5 Stage-dependent gender chip | 6, 13 |
| §5.6 Date validation split | 5, 13 |
| §5.7 JIT prompts | 14, 15, 16 |
| §5.7 familyType in Settings | 17 |
| §6.1 Deletion of deprecated screens | 11 |
| §6.5 New illustrations | 0, 7 |
| §10b H7 Apple sub claim | 2, 3 |
| §10b H8 Phone gate cannot be bypassed | 12 |
| §10b H9 Visual consistency | All component files use existing tokens |
| §9 Tests #11, #18 | 18 |
