# Streamlined signup journey — design spec

**Date:** 2026-05-19
**Status:** Approved by Vijay, ready for implementation planning
**Author:** Claude (brainstormed with Vijay)

---

## 1. Problem

The current MaaMitra signup journey is long, password-based, email-first, and asks for ten fields across four screens before the user reaches the app. It contradicts MaaMitra's India-first, mother-first, phone-first positioning. The single biggest abandon points are (a) the email-verification link wait and (b) the four-step onboarding form that asks for details (state, diet, family type) that don't shape the day-1 experience.

The new journey reframes signup as **phone-first auth → ~20-second minimal-personalisation form → app**, with everything else collected just-in-time inside the app at the moment each consumer needs it.

## 2. Goals

1. Reduce time-to-first-app-view from ~2 minutes to **under 45 seconds** (auth + form combined) for most users.
2. Make **every MaaMitra user have a verified Indian mobile number** on file, regardless of auth method (the phone-first promise).
3. Drop the email/password path entirely. No magic-link wait.
4. Personalise the home + chat experience from the user's **first session**, using only the load-bearing 3 fields (stage, date, mother's name).
5. Collect the remaining personalisation signals (state, diet, extra kids, family type) **in context, inline, just-in-time** — each prompt one-tap, skippable, and never asked twice.
6. Preserve all existing functionality. No regression in admin, community, AI chat, milestones, schemes, vaccines, growth, family management.

## 3. Non-goals

- Custom 6-digit **email OTP** infrastructure (deferred; revisit if diaspora demand surfaces). Email magic-link is retired too.
- Re-design of the inside-app surfaces themselves. Just-in-time prompts are additive UI on top of existing tabs.
- Sign-in for fathers / non-mother parents. The launch is mother-only, locked by `parentGender = 'mother'`.
- Internationalisation of the form copy itself in this iteration (existing i18n hooks continue to apply).

## 4. As-is (what we're replacing)

Current chain, traced from the code on 2026-05-19:

| # | Screen | Behaviour | Issue |
|---|---|---|---|
| 1 | `/(auth)/welcome.tsx` | Hero + features + CTA fork: Sign up / Sign in | False fork — users just want in |
| 2a | `/(auth)/sign-up.tsx` | Name + email + password + Google. 608 lines. | Password is the wrong primitive for India |
| 2b | `/(auth)/sign-in.tsx` | Email + password + Google. 574 lines. | Same |
| 3 | `/(auth)/verify-email.tsx` | Wait for magic link in inbox | High abandon — inbox jump on mobile |
| 4 | `/(auth)/onboarding.tsx` | 4 steps: You · Baby · Home · Family. 1001 lines. ~10 required fields. | Asks for state, diet, family type before user has seen the AI |
| 5 | `/(auth)/phone.tsx` | 10-digit + 6-digit OTP, after onboarding. | Phone is buried; for an India-first app this is backwards |
| 6 | `/(tabs)` | Home | — |

## 5. To-be (the design)

### 5.1 End-to-end flow

```
Welcome (single CTA: Continue)
   ↓
Auth entry — "Smart input" layout (Layout C)
   ↓
   ┌─────────────────┬───────────────────┬────────────────────────┐
   │ Phone OTP       │ Google sign-in    │ Apple sign-in (iOS)    │
   │ (primary input) │ (shortcut)        │ (shortcut)             │
   └────────┬────────┴─────────┬─────────┴────────────┬───────────┘
            │                  │                      │
            │                  ↓                      ↓
            │       ┌──────────────────────────────────┐
            │       │ Mandatory phone OTP gate         │
            │       │ (cannot be bypassed/skipped)     │
            │       └────────────────┬─────────────────┘
            │                        │
            └────────────┬───────────┘
                         ↓
                Onboarding form
       (single screen, Layout B — Progressive reveal)
                         ↓
                /(tabs) — full app
   (just-in-time prompts surface contextually as user explores)
```

### 5.2 Auth entry screen — `Layout C: Smart input`

**Route:** `/(auth)/welcome` (re-rendered) or a new `/(auth)/auth-entry`.

**Replaces:** `/(auth)/sign-up`, `/(auth)/sign-in`, current `/(auth)/welcome`.

**Composition:**

- Brand mark (logo + wordmark "MaaMitra" in Lora).
- One-line tagline.
- **Heading:** "Let's get you in" / sub: "Just your number. We'll figure out the rest."
- **Primary input:** Indian phone prefix (`🇮🇳 +91`) locked, 10-digit numeric input. Single CTA: "Continue".
- **Divider:** "faster sign-in"
- **Google button** (existing `useGoogleSignIn` hook, no changes to underlying mechanics).
- **Apple button** — rendered only on iOS (and web with Apple JS SDK). Hidden on Android.
- **Footnote:** "Returning user? Same screen. We detect your account." + Terms / Privacy links.

**No "Sign in vs Sign up" fork.** The server determines new-vs-returning by phone / google uid / apple sub after auth completes.

**Web parity:** identical layout, but `useWindowDimensions().width ≥ 900` widens the card and keeps marketing surfaces (features grid, "How it works") below the fold for SEO / Play Console URL crawlability.

### 5.3 Mandatory phone OTP gate

**Route:** `/(auth)/phone` (existing screen, repurposed).

**Trigger:** any time `isAuthenticated === true && phoneVerified !== true`, the user is redirected here via `<Redirect>` from `app/index.tsx` (and from any screen that requires phone).

**Behaviour:**

- Same two-step UX as today (enter number → enter 6-digit code).
- **Strictly non-skippable.** No back button, no skip link, no "do this later" affordance. The router redirect is mount-time `<Redirect>` so the user cannot navigate away.
- Banner copy adjusted from the current "you can do this later" framing: "One last thing — your number lets us send vaccine reminders and connect you with moms near you."
- Existing Firebase Phone Auth on web (JS SDK + reCAPTCHA) and Android (RN Firebase) is unchanged.

### 5.4 Onboarding form — `Layout B: Progressive reveal`

**Route:** `/(auth)/onboarding` (existing route, fully redesigned).

**Replaces:** the 4-step "You / Baby / Home / Family" form.

**Behaviour:**

- **One scrollable screen**, not a step-wizard.
- **Hero illustration anchor** at top that morphs between "expecting" and "newborn" variants the moment the stage chip is tapped (250ms cross-fade).
- **Fields appear progressively** (existing fields stay visible — we only reveal the next one when its prerequisite is set).
- **Live-preview pill** below the last filled field: e.g. *"✨ 24 weeks in — your second trimester is here. Your mitra is ready."* (newborn variant: *"✨ Aarav is 8 weeks old. Vaccines and milestones loaded."*)
- **CTA pinned to bottom**: "Take me in →". Disabled until required fields valid.

**Field order (top → bottom):**

| # | Field | Always shown? | Notes |
|---|---|---|---|
| 1 | Mother's name | Only if not pre-filled from auth | If Google/Apple gave us `displayName`, hide the field and just write it silently; show "Hi, Priya 👋" in the heading instead. |
| 2 | Stage chip — Expecting / Baby is here | Yes | Drives every label below + the hero morph. |
| 3 | Date — due date OR DOB | Yes | Label and validation depend on stage. |
| 4 | Baby's name | Yes (optional) | Copy: newborn → "Baby's name"; pregnant → "Have you picked a name yet? (optional)". |
| 5 | Gender chip | Yes (optional) | **Stage-dependent** options — see §5.5. |

Helper-text under each field stays as today's onboarding (it's already good).

**Submission:** on tap of "Take me in":
1. Run validation (§5.6).
2. If valid → write profile to local store via existing `useProfileStore` actions (`setMotherName`, `setProfile`, `addKid`, `setParentGender('mother')`).
3. Hand off to existing `/(auth)/setup` screen, which owns the Firestore write + `onboardingComplete` flip (no change there).
4. After setup → `/(tabs)`.

**Removed from this form:**

- `state` — moved to just-in-time prompt (§5.7).
- `diet` — moved to just-in-time prompt (§5.7).
- `familyType` — moved to Profile section in Settings (§5.7).
- `relation` / `parentGender` — defaulted to `'mother'` at submit, no UI question.
- `extraKids` — kept entirely in Family tab (which already supports it). Removed from signup flow.
- The "Step 4: More children" page is deleted.
- The 4-step header (step rail + step count) is removed.

### 5.5 Gender chip — stage-dependent rules

`Gender` type extended:

```ts
type Gender = 'boy' | 'girl' | 'surprise' | 'not-set';
```

**Pregnant stage** — three chips: `Boy` / `Girl` / `Surprise`. If user proceeds without selecting → default `'surprise'`. No follow-up re-prompt.

**Newborn stage** — two chips: `Boy` / `Girl`. No "Surprise" — baby is here, gender is known. If user proceeds without selecting → stored as `'not-set'`. A soft re-prompt may appear once on the Family tab (one-line chip card: "Pick a gender for Aarav so MaaMitra uses the right pronouns" — dismissible, never blocks).

**Downstream rendering (no behaviour change beyond rename-friendliness):**

- AI prompt (`lib/promptBuilder.ts`): `'surprise'` and `'not-set'` both → generic "your baby" / "your little one".
- Family tab avatar (`app/(tabs)/family.tsx`): `'surprise'` and `'not-set'` both → neutral icon.
- Health tab eligibility (`app/(tabs)/health.tsx`): girl-only schemes require `kid.gender === 'girl'` strictly — unchanged. `'not-set'` and `'surprise'` are both "not eligible".

### 5.6 Date validation rules

Validation is split by stage (current code merges them into a single window — that's the change):

**Newborn DOB:**

- Must be ≤ today (no future dates).
- Must be ≥ today − 18 years (existing).
- Year ≥ 2010 (existing plausibility check).
- On invalid future date → error: *"That date is in the future. If your baby hasn't arrived yet, switch to 'We're expecting' above."* — and shake / scroll to the stage chip.

**Pregnant due date:**

- Must be > today.
- Must be ≤ today + **12 months** (tightened from the current 2-year window).
- On invalid past date → error: *"That date is in the past. If your baby is already here, switch to 'Baby is here' above."* — and shake / scroll to the stage chip.

Both errors gently guide the user to the correct stage chip rather than just rejecting the input.

### 5.7 Just-in-time prompts — deferred fields

Each deferred field is collected at the moment its consumer fires, with the same prompt-card pattern (inline, never modal, one tap, skippable, asked once).

| Field | Trigger | Surface |
|---|---|---|
| `state` | First tap on Community tab OR Schemes (Health tab → Schemes) | Inline prompt card above the tab content. 28 states + 8 UTs selector. Skippable. Once set or skipped → never appears again on first-tap; user edits via Profile. |
| `diet` | First tap on Foods tab | Inline prompt card. 4 chips (Veg / Eggetarian / Non-veg / Vegan). Skippable. |
| `familyType` | **Never proactively asked.** | Lives in Profile / Settings under "Tell us more for better tone". User can fill on their own. Default `'nuclear'` in AI prompt remains. |
| `kidName` (if skipped at signup) | Home tab, weekly max | Soft prompt card: "Has your little one got a name yet? Adding it makes MaaMitra feel a lot more personal." One text input, dismissible. |
| `kidGender` (if `'not-set'` on newborn) | Family tab, once | Soft re-prompt described in §5.5. |
| `extraKids` | Family tab — existing "Add another child" button. **Optional:** chat AI may detect mentions of an older sibling and offer "Should I add a profile for your elder one?" as an inline chip in the chat. | Family tab is unchanged. Chat-detection is an optional follow-up enhancement, not in scope of this spec. |

**Five design rules every just-in-time prompt must follow:**

1. **Inline, never modal.** A prompt card above the tab content. User can scroll past, dismiss, or answer in place.
2. **One question, one tap.** Chips or a single text input. Never a multi-field form.
3. **Always skippable.** Skip link is visible. The app must work fully with the field empty (defaults baked in everywhere).
4. **Asked once.** Once answered OR skipped, never appears again unless the user goes to Profile to edit.
5. **Reason given.** Every prompt has one sub-line explaining *why* we're asking. Never feels like a tax.

State for "has this prompt been answered or dismissed" lives in `useProfileStore` under a new `dismissedPrompts: { [key: string]: true }` map, persisted with the rest of the profile.

### 5.8 Sign-out flow

Sign-out is part of the auth module and is given equal hardening attention. Historical bugs reported by admins (sign-out briefly flashing the signup form for 2-3 users) trace to inconsistent sign-out paths across the codebase. This redesign **unifies all sign-out paths** behind a single primitive.

**5.8.1 Single sign-out primitive**

A new hook `hooks/useSignOut.ts` becomes the **only** way to sign out anywhere in the app. It owns:

1. **Confirmation modal** — branded, consistent. Title: *"Sign out of MaaMitra?"* / body: *"You'll need your mobile number or Google/Apple account to come back in. Your data stays safe."* / buttons: `Cancel` (text) · `Sign out` (destructive red).
2. **Loading overlay** — full-screen, branded spinner over a dim layer. Cannot be dismissed by the user.
3. **Atomic state reset** — calls `useAuthStore.getState().signOut()` (which itself flips `isAuthenticated: false` BEFORE resetting downstream stores, per existing defense at `store/useAuthStore.ts:417`).
4. **Success overlay** — 1200ms branded success state (✓ "Signed out") to give the router time to settle without flashing intermediate screens.
5. **Explicit redirect** — `router.replace('/(auth)/welcome')` after the success overlay.

**5.8.2 Replace every raw `signOut()` callsite with `useSignOut()`**

- `app/admin/index.tsx:109` — currently calls `await signOut()` raw. Replace with `useSignOut().confirm()`.
- `app/admin/settings.tsx:367` — same. Replace.
- `components/ui/SettingsModal.tsx:1641` — already has a confirm+overlay flow; refactor to use the unified hook to keep behaviour consistent.

After this change, `useAuthStore.signOut` becomes an **internal primitive** only called by `useSignOut`. Grep-check at build time ensures no other callsite uses it.

**5.8.3 No mid-flow sign-out**

The auth screens themselves (`/welcome`, `/phone`, `/onboarding`, `/setup`) do not expose a sign-out affordance — there's nothing to sign out *of* yet. Sign-out is only exposed inside `/(tabs)` and `/admin`.

## 6. Code-level changes

### 6.1 Files to be deleted

- `app/signup.tsx` (dead stub — only 9 lines, unused)
- `app/signin.tsx` (dead stub — only 9 lines, unused)
- `app/(auth)/sign-up.tsx`
- `app/(auth)/sign-in.tsx`
- `app/(auth)/forgot-password.tsx` (no password → no forgot-password)
- `app/(auth)/verify-email.tsx` (no email signup → no magic-link verify)

### 6.2 Files to be replaced

- `app/(auth)/welcome.tsx` → new "Smart input" entry screen.
- `app/(auth)/onboarding.tsx` → new single-screen progressive-reveal form.

### 6.3 Files to be modified

- `app/(auth)/phone.tsx` — strip skip/back affordances; tighten copy.
- `app/index.tsx` — routing logic stays (`<Redirect>` based), but the order becomes: not authed → `/welcome`; authed & no phone → `/phone`; authed & phone & not onboarded → `/onboarding`; else → tabs/admin.
- `store/useAuthStore.ts` — `signUp` and `signIn` (email/password) functions become unused; remove or keep as deprecated. Add Apple sign-in handler analogous to `onGoogleCredential`.
- `services/firebase.ts` — Apple Sign-In wiring (web + iOS via `@invertase/react-native-apple-authentication` or expo equivalent). Save Apple `sub` claim per user (see existing memory note about Team ID Migration).
- `store/useProfileStore.ts` — add `dismissedPrompts: Record<string, boolean>` for the just-in-time pattern. Add `'not-set'` to `Gender` type.
- `lib/promptBuilder.ts` — handle `'not-set'` identically to `'surprise'` for `kidGenderWord`.
- `app/(tabs)/foods.tsx`, `app/(tabs)/community.tsx`, `app/(tabs)/health.tsx`, `app/(tabs)/family.tsx`, `app/(tabs)/index.tsx` — each gets a JustInTimePrompt component instance gated by `!profile.<field> && !dismissedPrompts['<field>']`.
- `components/ui/SettingsModal.tsx` — add `familyType` editor under "More about you" / "Tell us more for better tone".
- Apple SIWA: save `sub` to Firestore user doc (per existing memory rule for future Team ID Migration).

### 6.4 New components

- `components/auth/SmartInputCard.tsx` — phone input + Google + Apple shortcuts.
- `components/onboarding/MorphingHero.tsx` — pregnant ↔ newborn illustration cross-fade.
- `components/onboarding/LivePreviewPill.tsx` — the unlocked preview copy below the form.
- `components/jit/JustInTimePrompt.tsx` — generic prompt-card primitive used by Foods, Community, Home, Family.

### 6.5 Illustration assets (per Rule 3 — user generates externally)

Two new hero illustrations needed; surfaced as specs:

- `onboardingExpecting.png` — 800×800, transparent background, dusty-lavender + warm-cream palette, soft Indian motherhood illustration showing a pregnant woman in a calm gesture (hand on belly, soft smile, no text).
- `onboardingNewborn.png` — 800×800, transparent background, same palette, mother holding a swaddled newborn.

Both should match the existing painterly style of `featureAi`, `featureIndia`, `featureGrowth` etc. so the morph feels native. Generated via ChatGPT (single-image route per project rules), one at a time.

## 7. Data flow

```
auth-entry
  │
  ├─ phone OTP success → set { isAuthenticated, phoneVerified } in stores
  │
  ├─ google success    → set { isAuthenticated }; phoneVerified stays false → router redirects to /(auth)/phone
  │
  └─ apple success     → set { isAuthenticated }; phoneVerified stays false → router redirects to /(auth)/phone
        |
        v
phone-OTP gate (skipped only if phone path)
  │
  └─ on verify → setPhone, setPhoneVerified(true) → router redirects to /(auth)/onboarding
                                                                              │
                                                                              v
onboarding-form (single screen)
  │
  └─ on submit → setProfile + addKid + setParentGender('mother') → /(auth)/setup
                                                                       │
                                                                       v
                                                              setup writes to Firestore,
                                                              flips onboardingComplete
                                                                       │
                                                                       v
                                                                  /(tabs)
```

## 8. Error handling

All user-facing errors must use `friendlyAuthError` / `friendlyError` (project Rule 4). Raw Firebase codes go to `console.warn` only.

Specific cases to handle:

| Case | UX |
|---|---|
| Invalid Indian mobile (not 10 digits, doesn't start 6-9) | Inline error under input — current behaviour kept. |
| OTP send failed (SMS gateway down) | "We couldn't send an SMS just now. Try again in a moment." — keep on phone screen. |
| OTP code wrong | "That code didn't match. Try again or resend." — re-input only. |
| OTP expired | "That code has expired. Tap resend." |
| Google sign-in cancelled | Silent (no banner). |
| Apple sign-in cancelled | Silent. |
| Network error during onboarding submit | Existing `/(auth)/setup` retry UI kicks in. |
| Pregnant + past date | Inline error guiding to switch to "Baby is here". |
| Newborn + future date | Inline error guiding to switch to "Expecting". |

## 9. Testing

This is a **pre-implementation spec**. Tests will be defined per-task in the implementation plan, but at a minimum:

1. **Unit (`lib/promptBuilder.ts`):** `'not-set'` is rendered identically to `'surprise'` for kid-gender word.
2. **Unit (date validation):** Newborn DOB future-date rejected; pregnant due-date > 12 months rejected; gentle stage-suggestion errors fire correctly.
3. **Integration (auth flow):** Google sign-in → routed to `/phone`; cannot bypass via back button or deep-link.
4. **Integration (auth flow):** Phone OTP sign-in → routed directly to `/onboarding` (no phone gate).
5. **E2E (web Playwright via `/qa`):** complete happy path Phone → onboarding → tabs. <45 seconds.
6. **E2E:** Google → phone gate → onboarding → tabs. <60 seconds.
7. **Visual regression (`/design-review`):** morphing hero cross-fade works at 250ms, no jitter.
8. **Just-in-time prompts:** appear on first tab tap, disappear after answer or skip, never re-appear unless edited in Profile.
9. **Existing behaviour preserved:** community state-filter, AI prompt context, health girl-only schemes, milestones, family tab.

**Hardening regression tests — must replicate the historical bugs and prove they're fixed:**

10. **"Sign-in sent me to signup" — stale cache scenario.** Seed local storage with `{ onboardingComplete: false, cachedProfileUid: 'someoneElsesUid' }`. Sign in as the real user. Verify the router waits for Firestore re-hydration and routes straight to `/tabs`. Onboarding form must NEVER render at any frame.
11. **"Sign-in sent me to signup" — cleared cache scenario.** Clear localStorage entirely. Sign in via Google. Verify router waits for Firestore, then routes correctly per profile state.
12. **"Sign-out flash" — admin path.** Sign in. Open admin → sign out via `app/admin/settings.tsx`. Record screen for 3 seconds. Verify no `/(auth)/onboarding` frame appears anywhere in the recording.
13. **"Sign-out flash" — settings modal path.** Sign in. Open settings modal → sign out. Same recording test. No onboarding flash.
14. **Incognito browser sign-in.** Open in private browsing. Verify the `ensureWebAuthPersistence` failure surfaces a clear error rather than infinite splash.
15. **5-second cache-stuck escape hatch.** Mock `isLoading === true` indefinitely. Verify the "Reset local storage" link appears after 5 seconds and works.
16. **Phone gate cannot be bypassed.** Sign in via Google. On the phone-OTP screen, attempt: hardware back button (Android), browser back button (web), deep-link to `/(tabs)`, deep-link to `/admin`. None should bypass the gate.
17. **No silent identity mixing.** Sign in as user A. Sign out. Sign in as user B in the same browser tab. Verify no fragment of user A's profile (name, kid name, photo) is visible at any point.
18. **Apple re-signin name preservation.** Mock Apple returning `null` displayName on second sign-in. Verify the persisted name from Firestore is used.
19. **All signout callsites use the unified hook.** Build-time grep test: zero direct `await signOut()` calls outside `hooks/useSignOut.ts` and `store/useAuthStore.ts` itself.
20. **Three-gate cold-start guard.** Force a slow Firestore round-trip (network throttle). Verify splash holds and no `<Redirect>` fires until all three gates are satisfied.

## 10. Migration / backwards compatibility

- **Existing signed-in users:** unaffected. They already have profiles. Routing logic continues to send them straight to `/tabs`.
- **Existing users without `phoneVerified`:** on next launch, router sends them to `/(auth)/phone`. The strictly-gated phone-OTP screen replaces the current optional one. This *will* affect a small set of historical users — acceptable per phone-first promise.
- **Email/password users:** any user currently using email + password remains signed in (Firebase session persists). On sign-out they cannot sign back in via email/password — they must use phone or Google. This is acceptable; we can add a one-time "your password sign-in is going away — set up phone now" prompt in a follow-up if needed.
- **`Gender = 'not-set'`:** new value. All call sites that switch on Gender must be audited to handle it (see §6.3).
- **Firestore profile docs:** no schema change. `state`, `diet`, `familyType` remain optional fields. New `dismissedPrompts` map is purely client-side persistence initially (Zustand `persist`), can be mirrored to Firestore later if cross-device sync is needed.

## 10b. Auth hardening — military-grade requirements

This section is a **non-negotiable hardening contract** for the auth module. Every requirement here maps to a specific historical bug, edge case, or known fragility in the existing code. The implementation must satisfy every requirement; the acceptance criteria in §12 explicitly test them.

### H1. Three-gate cold-start guard

The router at `app/index.tsx` must NOT make any routing decision until all three gates are satisfied:

| Gate | What it means | Why |
|---|---|---|
| **G1 — Auth resolved** | `useAuthStore.isLoading === false` | Firebase reported whether the user is signed-in or not. |
| **G2 — Profile hydrated** | `useProfileStore._hasHydrated === true` | Zustand-persist has finished reading the local profile cache from AsyncStorage / localStorage. (Already in place.) |
| **G3 — Profile-cache-trust** | `cachedProfileUid === user.uid` OR Firestore round-trip done | The cached profile actually belongs to the *current* user. (Currently missing — this is the third bug.) |

While any gate is pending, render a branded splash (`bgLight` with logo). Never render `<Redirect>` during this window.

If G3 fails (cache UID mismatch, or no cache, or auth UID differs), the router must **block on `hydrateProfileFromFirestore(user.uid)`** before deciding. Cached `onboardingComplete: false` from another user is the exact scenario that sent returning users to the signup form.

### H2. Idempotent, race-free state transitions

The auth state machine has exactly **five legal states** — no half-states allowed:

```
SPLASH     → (any gate pending)
UNAUTHED   → /(auth)/welcome
PHONE_GATE → /(auth)/phone           [authed, !phoneVerified]
ONBOARDING → /(auth)/onboarding      [authed, phoneVerified, !onboardingComplete]
APP        → /(tabs) or /admin       [authed, phoneVerified, onboardingComplete]
```

Transitions are driven by store changes; the router re-evaluates atomically. Forbidden:
- Rendering `/(auth)/onboarding` while the user is signing out.
- Rendering `/(tabs)` while phone is unverified.
- Rendering `/(auth)/welcome` while auth state is still resolving.

Every transition must pass through `Redirect` (mount-time safe per project Rule 5) — **never** `router.replace` from a `useEffect`.

### H3. Sign-out atomicity

`useAuthStore.signOut` already flips `isAuthenticated: false` before resetting downstream stores (per existing comment block at line 411-416). This pattern is **codified as a requirement**, not just current behaviour:

1. `set({ user: null, isAuthenticated: false })` — fires first; route guards immediately compute UNAUTHED.
2. Reset every domain store in the same JS tick (profile, wellness, chat, teeth, food, growth, DM, social, community).
3. **Only then** await `firebaseSignOut(auth)`.

This sequence guarantees that no render between step 1 and step 3 can see `(isAuthenticated: false, onboardingComplete: false)` and route to onboarding — the exact state that caused the flash.

The `useSignOut` hook (§5.8) wraps this with a loading overlay that prevents any tab content from rendering during the transition, providing a UI-level belt to the state-level suspenders.

### H4. Web persistence hardening

Web auth is the most fragile surface because of browser persistence semantics:

- **Private / incognito mode** — `indexedDB` may be restricted; Firebase falls back to in-memory persistence, which doesn't survive refresh.
- **Cookies disabled** — Google sign-in popup breaks.
- **Third-party cookies blocked** — Firebase reCAPTCHA for phone OTP may fail.

The auth module must:

- Call `ensureWebAuthPersistence()` and **await its resolution before subscribing to `onAuthStateChanged`** (already done at `store/useAuthStore.ts:488`, codified here).
- If `ensureWebAuthPersistence` throws or `indexedDB` is unavailable, surface a **specific** error on the welcome screen: *"Your browser is blocking sign-in storage. Try a regular (non-private) browser tab, or [Open MaaMitra in our app instead]"* with a Play Store link. Never let the user spin on a blank splash.
- The phone-OTP screen on web must detect reCAPTCHA failures (network, cookies blocked) and offer a clear retry path. Existing `resetPhoneRecaptcha()` is the unwind primitive — call it on every retry.

### H5. The "cache stuck" escape hatch

Some users get into an unrecoverable cache state (LocalStorage corruption, partial writes after force-quit). To give them a way out without contacting support:

- On the welcome screen, after **5 seconds** of `isLoading === true`, show a small text link near the footer: *"Trouble signing in? Reset local storage."*
- Tapping it shows a confirmation: *"This will clear cached data and sign you out completely. Continue?"*
- On confirm: `useAuthStore.getState().signOut()` + `localStorage.clear()` (web) / `AsyncStorage.clear()` (native) + `window.location.reload()` / `Updates.reloadAsync()`.
- This is the kill switch for the historical "signin sent me to signup" bug when all other defenses fail.

### H6. No silent identity mixing

A single browser/device can never be authenticated as user A in Firebase but holding user B's profile data in Zustand. Defenses:

- `cachedProfileUid` in `useProfileStore` is the source of truth for "whose cache is this".
- On `onAuthStateChanged` firing with a new UID, the router must NOT use the cached profile for `onboardingComplete` until Firestore re-hydration verifies the same UID.
- On `signOut`, every store's `reset()` clears all per-user data including `cachedProfileUid`.

### H7. Apple sign-in idempotency

Apple's `displayName` is only returned on the **first** sign-in for a given Apple ID. Subsequent sign-ins return `null`. The implementation must:

- On the first Apple sign-in, save `displayName` + `sub` to the user's Firestore doc.
- On subsequent sign-ins (re-install, sign-out + back in), read `displayName` from Firestore — never expect it from Apple.
- The `sub` claim is the **stable identifier** for future Team ID Migration when the app transfers from individual to org Apple Developer account.

### H8. Phone OTP — gate cannot be bypassed

The phone OTP screen at `/(auth)/phone` is the universal gate for Google/Apple users. Hardening:

- Mount-time `<Redirect>` from any non-auth route: if `isAuthenticated && !phoneVerified`, redirect to `/phone`. Applies to every protected route including `/admin`.
- The screen itself has **no back affordance, no skip link, no "later" option, no system back-button override**. Hardware back on Android intercepted and re-rendered as a tiny shake animation on the OTP input.
- The only way to leave the screen is (a) verify phone successfully, or (b) the `useSignOut` hook (a "Sign out" link at the bottom-right of the phone screen, opening the same confirm modal). Phone gate is not a trap — it's a strict gate.
- OTP attempts are rate-limited server-side (Firebase already does this); UI surfaces friendly error if blocked.

### H9. Visual and design consistency — do NOT drift

Every new auth screen must use the existing design tokens exclusively. No new colors, no new fonts, no new spacing scales. Verified inventory:

- **Colors:** `Colors.primary` (#6C4FB6), `Colors.bgLight` (#fdf6ff), `Colors.cardBg`, `Colors.textDark` (#1C1033), `Colors.textLight` (#6b7280). All defined in `constants/theme.ts`.
- **Fonts:** `Fonts.serif` (Lora, for headlines / wordmark), `Fonts.sansBold` / `sansSemiBold` / `sansMedium` / `sansRegular` (DM Sans family).
- **Components:** existing `GradientButton`, `Illustration`, `GoogleGIcon`, `AnimatedField` (from current sign-up.tsx — move to `components/ui/`). No new button styles. No new input styles.
- **Border radii:** 10 (inputs), 12 (cards/buttons), 14 (prompts), 18 (sheets), 22 (hero cards). Match existing patterns.
- **Spacing:** 22px horizontal padding for screen content. Vertical rhythm follows existing onboarding form.
- **Illustration style:** new `onboardingExpecting.png` + `onboardingNewborn.png` (per §6.5) must be visually indistinguishable in style from existing `featureAi`, `featureIndia`, `featureGrowth` illustrations. ChatGPT-generated, painterly, dusty lavender + warm cream + blush + sage + ochre palette. No text in the image.

A `/design-review` pass after implementation is mandatory and must produce **zero drift findings**.

### H10. Observability

Auth is critical infrastructure. Every state transition logs a structured event (via existing `console.warn` for now; can be upgraded to analytics later):

- `auth:gate-pending` with reason (`auth-loading` | `profile-hydrating` | `firestore-fetching`)
- `auth:transition` with from-state + to-state
- `auth:signout-started`, `auth:signout-completed`, `auth:signout-failed`
- `auth:phone-otp-sent`, `auth:phone-otp-verified`, `auth:phone-otp-failed` (with reason)
- `auth:google-success`, `auth:apple-success`, `auth:method-cancelled`
- `auth:web-persistence-failed` (the incognito-mode signal)
- `auth:cache-escape-hatch-triggered` (the §H5 button)

When the next admin report comes in ("X user couldn't sign in"), these logs give an immediate diagnosis without guessing.

## 11. Open questions

None for the design itself — every section was approved interactively.

Implementation-plan-level open questions (deferred to the plan):

- Apple SIWA web setup — Firebase configuration steps + Apple Developer Console redirect URI (will need user to register).
- Whether to ship behind a feature flag for staged rollout, or replace cold-turkey. Given this is a fundamental flow change and the existing flow has known abandon issues, cold-turkey on `main` with the OTA chain (Vijay's project Rule 4) is probably right — but worth confirming during planning.

## 12. Acceptance criteria

- Time to first `/tabs` view from cold app open: under 45 s for phone path, under 60 s for Google/Apple path (with phone gate).
- 100% of authenticated users have `phoneVerified === true` before reaching `/tabs`.
- No email-password, no magic-link, no `forgot-password` route remain.
- Onboarding form is a single screen with at most 5 visible inputs (often 3–4).
- All five "just-in-time prompt" rules (§5.7) hold for every prompt instance.
- Stage-dependent gender chip behaves per §5.5; `'not-set'` exists in the type and is handled everywhere `Gender` is consumed.
- Date validation behaves per §5.6.
- No regression in existing tab functionality.

**Hardening pass/fail (every item must pass before ship):**

- Three-gate cold-start guard implemented in `app/index.tsx` (H1).
- Five-state auth state machine — no half-states reachable (H2).
- Sign-out atomicity — `isAuthenticated` flips before downstream resets (H3).
- All sign-out callsites route through `useSignOut` hook — grep verified (§5.8.2, H3).
- Web persistence hardening — incognito mode shows specific error, not infinite splash (H4).
- 5-second cache-stuck escape hatch present on welcome screen (H5).
- No silent identity mixing — proven by test #17 (H6).
- Apple `sub` + `displayName` persisted on first signin, re-read on subsequent (H7).
- Phone gate cannot be bypassed via any back/deep-link path — proven by test #16 (H8).
- `/design-review` pass shows zero design-token drift (H9).
- Auth state transitions log structured events (H10).
- Tests #10–#20 all pass (the historical-bug regression suite).

---

**Approval:** Vijay approved each section interactively during the brainstorm on 2026-05-19:
- Field teardown (keep / defer / drop) — approved.
- Just-in-time pattern — approved.
- Auth Layout C (Smart input) — approved.
- Drop email entirely at launch — approved.
- Onboarding Layout B (Progressive reveal) — approved.
- Baby name in day-1 form — added at Vijay's request.
- Gender chip rules (Surprise pregnant-only, Not Set as newborn default) — added at Vijay's request.
- Mandatory phone OTP for Google/Apple users — corrected at Vijay's request.
- Date validation (DOB ≤18y, due date ≤12mo) — confirmed at Vijay's request.
