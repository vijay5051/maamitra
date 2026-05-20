# Audit fixes applied — 2026-05-19

This file tracks what was fixed from `docs/audits/*-findings.md`, what was
intentionally deferred, and what remains open. Branch: `claude/app-audit-review-N82tF`.

## Commits

| Commit | Wave | Scope |
|---|---|---|
| `df2e1c9` | A | critical logic bugs |
| `ea28a4f` | B | DM blocked filter + auth token sweep + DOB unification |
| `5e769ed` | C | chat.tsx tokens + isExpecting reconcile |
| `2a697e1` | C | +not-found auth-aware redirect |
| `f5a3d13` | C | health.tsx token sweep (parallel worktree) |
| `441f2da` | C | library + wellness token sweep (parallel worktree) |
| `5156a94` | C | shared UI components token sweep (parallel worktree) |

Total diff: 38 files, +900/−730. 86 tests pass (76 baseline + 10 new for crisisDetect). TypeScript clean (one pre-existing community error remains, out of audit scope).

## Wave A — critical logic

- **`app/index.tsx`**: phone-verification gate now runs **before** the admin redirect — admins without a verified phone can no longer slip past the phone gate (stores LOW #37).
- **`app/(tabs)/index.tsx`**:
  - Vaccine tint background fixed — `` `${color}1A` `` produced an invalid 8-digit hex that RN rendered as transparent; now uses `withAlpha(tint, 0.1)` (home CRITICAL #1).
  - ScrollView `paddingBottom` respects `insets.bottom` so the last card isn't clipped on edge-to-edge Android (home CRITICAL #3).
  - Inline `['#FAFAFB', '#F5F0FF']` gradient → `Gradients.softPurple` (home CRITICAL #4).
  - Greeting no longer reads "Good morning, Hello there" — empty motherName collapses to just "Hello" (home HIGH #5).
  - Salutation refreshes every 60s so it flips at noon / 5pm / midnight while the app is open (home HIGH #14).
  - Seven duplicate age-in-months callsites unified through `calculateAgeInMonths()` from `lib/dob.ts` — kills the IST/UTC midnight drift across home cards, milestones, yoga picks, teeth/food prompts, kid chip (home HIGH #13, MEDIUM #20, #21).
  - 25 hardcoded `'#F5F0FF'` bg values and 4 `Colors.bgPink` references → `Colors.bgTint`.
- **`constants/config.ts` + `services/claude.ts`**: `MAX_HISTORY=30` was hardcoded; now `MAX_CHAT_HISTORY_API` lives in `constants/config.ts` next to `MAX_CHAT_HISTORY=50` (chat CRITICAL).
- **`store/useChatStore.ts`**:
  - `imageDataUrl`/`imageMimeType` stripped during `partialize` so multi-MB base64 images can't bloat AsyncStorage across sessions (stores CRITICAL #3).
  - Slice limit reads `MAX_CHAT_HISTORY` from constants instead of the magic 50.
- **`lib/crisisDetect.ts`**: `text.includes()` replaced with a Unicode word-boundary regex. Fixes both substring false-positives (`ppd` inside `rappdown`) and false-negatives (`suicidality` was matching `suicidal`) (chat CRITICAL).
- **`tests/crisisDetect.test.ts`**: 10 new tests covering positive matches, word-boundary safety, and edge cases.

## Wave B — DM safety, auth sweep, DOB unification

- **`store/useDMStore.ts`** (stores HIGH #5 + #6):
  - New `filterBlockedConvs` helper drops conversations whose other participant is on the user's blocked list.
  - Applied at `loadConversations` AND inside `subscribeConversations` (live listener). Unread count re-derived post-filter so the badge can't disagree with the list.
  - `sendMessage` now refuses to send if the recipient is blocked — belt-and-braces against UI races.
- **`app/(tabs)/family.tsx`** (health-family HIGH #4, #5):
  - `ChildCard` age math now uses `calculateAgeInMonths` / `calculateAgeInWeeks` / `isPlausibleDob` from `lib/dob.ts` instead of inline `_diffMs / 30.44` math and locally-redefined plausibility bounds.
  - Mechanical hex → token sweep: `#1C1033` → `textDark`, `#9ca3af` → `textMuted`, `#6b7280` → `textLight`, `#F5F0FF` → `bgTint`, `#EDE9F6` → `borderSoft`, `#E5E1EE` → `border`.
- **`components/onboarding/StateSelector.tsx`** (auth CRITICAL): full rewrite. Every hex, every `fontWeight`-without-`fontFamily`, every off-grid spacing/radius mapped to tokens (Colors / Fonts / FontSize / Spacing / Radius / withAlpha). Added `accessibilityRole` + `accessibilityLabel` to every tappable target.
- **`components/auth/*Modal.tsx` + `*Overlay.tsx`** (auth HIGH): imported `withAlpha`. Four `'rgba(28, 16, 51, 0.x)'` backdrops → `withAlpha(Colors.textDark, 0.x)`. Four `'#fff'`/`#fff` references → `Colors.white`.
- **`app/(auth)/{phone,welcome,setup}.tsx`**: hex token sweep for `textDark` / `borderSoft` / `white`; two hardcoded placeholder colors (`#c4b5d4`, `#d4c9e8`) unified to `Colors.textLight`.

## Wave C — design-token sweep + ancillary fixes

### `app/(tabs)/chat.tsx` (chat-library-wellness LOW)
- Consolidated two `constants/theme` imports into one, added `withAlpha`.
- Mechanical sweep: `#1C1033` → `textDark`, `#9CA3AF/#9ca3af` → `textMuted`, `#6b7280/#6B7280` → `textLight`, `#EDE9F6` → `borderSoft`, `#ffffff` → `white`.
- Five inline `'rgba(28, 16, 51, 0.x)'` separators/overlays → `withAlpha(Colors.textDark, 0.x)`.
- Two opaque rgba values (overlay 0.92, shadow 0.3) intentionally left as raw — they're solid-fill design choices, not theme leakage.

### `app/(tabs)/health.tsx` (health-family HIGH + MEDIUM)
- Deleted the seven local color aliases (`ROSE`, `PLUM`, `GOLD`, `SAGE`, `MIST`, `INK`, `STONE`) and replaced every usage with the canonical theme token:
  - `ROSE`, `PLUM` → `Colors.primary` (they were both already aliased to it)
  - `GOLD` (`#F59E0B`) → `Colors.warning`
  - `SAGE` (`#34D399`) → `Colors.success`
  - `MIST` (`#EDE9F6`) → `Colors.borderSoft` for borders/dots, `Colors.bgTint` for backgrounds
  - `INK` → `Colors.textDark`, `STONE` → `Colors.textLight`
- Inline `'rgba(239,68,68,0.04)'`, `'rgba(245,158,11,0.04)'`, `'rgba(34,197,94,0.04)'` → `withAlpha(Colors.error/warning/success, 0.04)`.
- `#fee2e2` → `withAlpha(Colors.error, 0.15)`; `#dc2626` → `Colors.error`.
- `#F0EBF8`, `#F0EDF5`, `#EDE9F6` borders → `Colors.borderSoft`.
- `#FFF8F1` → `Colors.creamWarm`.
- ~107 lines changed.
- FIXMEs left on off-palette hexes (`#16a34a` darker success text; status-color map of warm/cool semantic-lights; warm peach milestone bg; muted plum footer text; lilac milestone toggle).

### `app/(tabs)/library.tsx` + `app/(tabs)/wellness.tsx` (chat-library-wellness CRITICAL #4 + #5, plus MEDIUM)
- ~54 substitutions in library.tsx, ~39 in wellness.tsx.
- `textDark`, `textLight`, `textMuted`, `white`, `primary`, `success`, `warning`, `cardBg`, `bgLight`, `borderSoft`, `bgTint`, `creamWarm`, `primaryAlpha*`, `overlay`, `withAlpha(textDark, ...)`.
- ~59 FIXME markers added for off-palette extension colors (mood-bar gradients `#F4B3CC/#C9A8E0`; article topic gradients with `#10b981/#3b82f6/#6366f1/#a855f7/#f97316`; journey status semantic-light fills `#dcfce7/#fff7ed/#f3f4f6`; purple-adjacent surface tones `#C4B5D4/#F3F0FA/#A78BCA`). These were left in place — they're intentional brand-extension colors that need product decision before becoming tokens.

### Shared UI components (`components/ui/*`, `components/feedback/*`, `components/jit/*`) (ui-components HIGH + MEDIUM)
- 15 files, ~254 insertions / ~249 deletions.
- Tokenisation:
  - `GradientButton`: white, textDark shadow, border, `Spacing.xl/sm`, `Radius.sm`.
  - `Card`: white, `Radius.lg`.
  - `ContextualAskChip`: white, `Spacing.sm`.
  - `EmailVerifyBanner`: warning palette mapped (`#b45309`/`#78350f` → `Colors.warning`), white/`withAlpha`, `Radius.sm/xs`, `Spacing.md/lg/sm`.
  - `Skeleton`: `Spacing`/`Radius` across post + article skeletons.
  - `AppBannerStrip`: `Spacing.lg/md`; the three tone gradients (info/celebrate/warn) kept as-is with a single `// FIXME: extract banner gradients to theme` marker — they're a design system gap, not a leak.
  - `RootErrorBoundary`: `cardBg`, `Spacing`, `Radius`, `textLight`, white, `textMuted`.
  - `TypingIndicator`: `Spacing.sm/xs`.
  - `DatePickerField`: `textLight/Muted`, white, `Radius.sm`, `Spacing.md`.
  - `SuccessCheck`: `Colors.success` defaults via `withAlpha`.
  - `MicroSurveyModal` (feedback): white, `textDark/Light/Muted`, `Spacing`, `Radius`, `withAlpha`, `bgTint`.
  - `FeedbackSurveyModal`: white, `Spacing` across chip/pay/note rows.
  - `JustInTimePrompt`, `KidNamePrompt`: `Spacing.xs/sm/md`.
  - `SettingsModal`: full sweep of `s`, `cp`, `spStyles` style sheets — ~80 substitutions covering white, textDark/Light/Muted, error, bgTint, borderSoft, Radius, Spacing, `withAlpha` for the chipActive surface.

### Cross-cutting safety
- **`store/useProfileStore.ts`** `onRehydrateStorage` (stores MEDIUM #19): reconciles `isExpecting` against today's date. Previously-expecting kids whose DOB has now passed automatically flip to `isExpecting: false`, `stage: 'newborn'`, with fresh `ageInMonths` / `ageInWeeks`. Closes the "permanently sticky" expecting-flag bug.
- **`app/+not-found.tsx`** (stores LOW #28): "Back to MaaMitra" button is now auth-aware — authed users go to `/(tabs)`, unauthed users go to `/(auth)/welcome` (was always welcome).

## What was intentionally deferred

These findings are real but require product/infra decisions, are non-mechanical, or touch the community feed (which the audit explicitly excluded):

- **Encrypted phone storage** (stores HIGH #8): persisting `+91...` to AsyncStorage in plain text needs an encrypted-storage library or a backend change. Not a code edit.
- **Server-side block enforcement** for DM (stores HIGH #6): client guard is now in place; the Firestore rule should also reject blocked-user writes. Out of scope for this branch.
- **i18n** (ui-components LOW): banners, overlays, and several copy strings are hardcoded English. Adding i18n requires infra (translation table, locale provider) the project doesn't yet have.
- **FAQ → Firestore** (HelpSupportSheet): backend work.
- **Animation API migration** (home MEDIUM #26, #27 + ui-components MEDIUM): `setInterval`-based typing animation + legacy `Animated.loop` cleanup. Touching live animation paths is risky without a full QA pass.
- **Modal remount fix** (ui-components MEDIUM): switching SettingsModal / HelpSupportSheet / FeedbackSurveyModal from conditional render to `opacity + pointerEvents` is a behaviour change with regression risk.
- **Inline component extraction** (home LOW): `app/(tabs)/index.tsx` 3,953 lines with 6 inline components. Mechanical but high-risk refactor — best done in its own PR with focused testing.
- **Dead code removal** (`buildInbox`, `notifTypeToKind`, `notifTitle`, `notifBody`): real dead code in home tab. Removing it is straightforward but not safety-critical.
- **Prop name standardisation** (`loading` vs `busy`): subjective; would touch every async-capable component.
- **Off-palette FIXME hexes** in health/library/wellness: ~60 colors that aren't currently in the theme but are intentional brand-extension surfaces. Marked with `// FIXME: extract as theme token` so they're discoverable. Decision is "extend theme.ts" vs "redesign to one accent per card" — product call.
- **Community findings**: per audit scope, all community-related code (`(tabs)/community.tsx`, `useCommunityStore`, community sheets/modals) is excluded.
- **Inconsistent timestamp formats in services/firebase.ts** (stores HIGH #2, #7): touches every Firestore read/write — should land in its own PR with full subscription-lifecycle testing.

## Test/typecheck status

- `bun test tests/` — **86 pass / 0 fail** (76 baseline + 10 new crisisDetect tests).
- `bunx tsc --noEmit` — **clean**; one pre-existing error in `components/community/ConversationsSheet.tsx:193` (`Platform` not imported) remains; that file is out of audit scope.
