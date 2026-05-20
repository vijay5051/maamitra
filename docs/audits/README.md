# MaaMitra App Audit — 2026-05-19

Extensive read-only review of the app **excluding the community feed**
(`(tabs)/community.tsx`, community store, community modals).

Findings are split across six files by area. Each file groups its issues by
severity and cites `file:line` for every finding.

## Files

| File | Scope | Findings |
|---|---|---:|
| [`auth-findings.md`](./auth-findings.md) | `app/(auth)/*`, `components/auth/*`, `components/onboarding/*`, auth-related hooks/lib | 59 |
| [`home-findings.md`](./home-findings.md) | `app/(tabs)/index.tsx` (3,953 lines), `(tabs)/_layout.tsx`, chrome | 48 |
| [`health-family-findings.md`](./health-family-findings.md) | `(tabs)/health.tsx`, `(tabs)/family.tsx`, `components/health/*`, vaccine/growth/teeth/food stores | 58 |
| [`chat-library-wellness-findings.md`](./chat-library-wellness-findings.md) | `(tabs)/chat.tsx`, `(tabs)/library.tsx`, `(tabs)/wellness.tsx`, chat/wellness components, claude/voice services | 71 |
| [`ui-components-findings.md`](./ui-components-findings.md) | `components/ui/*`, feedback/JIT modals, banners, overlays, theme tokens, icon registry | 73 |
| [`stores-services-findings.md`](./stores-services-findings.md) | Zustand stores, Firebase services, top-level routes (`post`, `conversation`, `contact`, `terms`, `privacy`, `share-story`, `delete-account`, `+not-found`), lib helpers | 51 |
| **Total** | | **360** |

Severity totals across all files:

| Severity | Count |
|---|---:|
| CRITICAL | 26 |
| HIGH     | 79 |
| MEDIUM   | 117 |
| LOW      | 96 |
| NIT      | 42 |

## Cross-cutting themes

These patterns recur in every area and would benefit from a single, batched fix.

### 1. Design-system token leakage (>140 findings, the largest theme)
- Hardcoded hex values (`#1a1a2e`, `#6b7280`, `#F5F0FF`, `#EDE9F6`, `#1C1033`, `#f59e0b`, `#FEE2E2`, `#fff`) where `Colors.*` tokens already exist.
- Inline `rgba(28,16,51,0.x)` overlays instead of the pre-computed `Colors.primaryAlpha05/08/12/20/25` presets.
- Deprecated tokens still in use: `Colors.bgPink` (use `bgTint`), `Colors.secondary/gold/sage/sky/stone/cloud`.
- Local re-aliases of brand colors in feature files (`ROSE`, `PLUM`, `GOLD`, `SAGE`, `MIST` in `health.tsx`).
- Worst offenders: `library.tsx`, `wellness.tsx`, `components/onboarding/StateSelector.tsx`, `EmailVerifyBanner`, `AppBannerStrip`.

### 2. Spacing / radius / shadow token leakage (~60 findings)
- Arbitrary pixel values (`14`, `10`, `22`, `6`, `48`) instead of `Spacing.xs/sm/md/lg/xl/xxl/xxxl`.
- Card shadows inlined per-component rather than reused from `Shadow.sm/md/lg/card`.

### 3. Typography pairing breaks (~25 findings)
- `fontWeight: '600'` set without the matching `fontFamily: Fonts.sansSemiBold` (falls back to system font).
- `StateSelector.tsx` is the most extreme case — no `Fonts.*` references at all.
- Arbitrary `fontSize` values outside the `FontSize` scale.

### 4. Icon-registry bypass (~7 findings)
- Raw `<Ionicons>` with hardcoded color in `SettingsModal`, `EmailVerifyBanner`, `AppBannerStrip`, several health/auth screens.
- All should route through `<AppIcon name="…" role="…" />` per `constants/icons.ts`.

### 5. Timezone / DOB / age math (~10 findings, **safety-critical**)
- Age-in-months computed in five+ places using `Date.now() - new Date(dob)` instead of the canonical `lib/dob.ts` helpers (`calculateAgeInMonths`, `formatKidAgeCompact`).
- Vaccine `overdue` vs `upcoming` flips across IST/UTC midnight.
- Greeting (`Good morning/afternoon/evening`) frozen at mount — never re-evaluates if app stays open past midnight.
- Daily-bucket key in `services/chatUsage.ts` uses local timezone, server is UTC → analytics drift.

### 6. Blocked-user / privacy filter gaps (CLAUDE.md cross-reference rule)
- `useDMStore.loadConversations` doesn't filter against `useSocialStore.blockedUids`.
- Conversation send path enforces blocking in UI only, not before the Firestore write.
- These are exactly the kind of "apply filter everywhere posts/comments/notifications render" cases the project rules call out.

### 7. PII / persistence concerns
- Phone (E.164) persisted to AsyncStorage in plain text on Android.
- `imageDataUrl` not stripped during chat partialize — large base64 images persist across sessions, risking AsyncStorage quota.
- `crisisDetect.ts` uses `text.includes()` without word boundaries → both false-positives and false-negatives.
- `piiRedact` regex is conservative on Indian mobile formats with non-standard separators.

### 8. CTA / dead-UI risk (CLAUDE.md rule #2)
- `TodayCard.onPress` is typed `?: () => void` and passed directly to `AnimatedPressable` — undefined-onPress slips through.
- Quick-chip prefill in chat doesn't reset after consumed → second tap is silently a no-op.
- Allergy gate consumes the pending message; dismissing the modal drops it with no retry.
- "Hello, Hello there" / awkward greeting fallback when `motherName` is empty.

### 9. Animation lifecycle
- Mix of legacy `Animated` API and Reanimated worklets within the same screen (e.g. home `FirstRunHero` uses `Animated.loop` + `setInterval`).
- `Animated.loop` and `Reanimated` shared values not torn down on unmount in several places (`Confetti`, `SplashAnimation`, `AnimatedNumber`, `SuccessCheck`).
- Accordion height animations memoize a stale measured height when the content grows.

### 10. Modal / sheet lifecycle
- `SettingsModal`, `HelpSupportSheet`, `FeedbackSurveyModal` unmount/remount on `visible` toggle, losing form state.
- `MilestonePrompt` has no `onRequestClose` → Android hardware back doesn't dismiss.
- Z-index contract between `ImpersonationBanner` (10000), `MaintenanceOverlay` (9999), `ForceUpdateOverlay` (9998) is undocumented and not tested for simultaneous mount.

### 11. Auth-gate ordering
- `app/index.tsx:68` admin email check runs **before** phone-verification gate — admin can reach `/admin` without verifying phone.
- `(setup|onboarding|phone).tsx` cast `router.replace as any` in several places, signalling typed-routes are out of sync.

### 12. Inline component bloat
- `app/(tabs)/index.tsx` is 3,953 lines and defines `JumpTile`, `FirstRunHero`, `FeatureGuideCarousel`, `FeatureGuideSlide`, `FeatureGuideDot`, `ProfileRow` inline. `buildInbox()` and friends are dead code that survived a refactor.

## Suggested fix order

1. **Token sweep** (low risk, mechanical) — replace hex/rgba/spacing/radius hardcodes with `Colors.*` / `Spacing.*` / `Radius.*` / `Shadow.*` everywhere in the worst offenders (`library.tsx`, `wellness.tsx`, `StateSelector.tsx`, `EmailVerifyBanner.tsx`, `AppBannerStrip.tsx`, `SettingsModal.tsx`, `health.tsx`).
2. **DOB/age unification** — funnel every age calc through `lib/dob.ts`; add a daily greeting-refresh timer.
3. **Blocked-user filter parity** — apply in `useDMStore.loadConversations`, send-time guard, server rule.
4. **Phone in AsyncStorage** — encrypted storage or drop persistence and refetch.
5. **CTA wiring sweep** — find every `AnimatedPressable` / `TouchableOpacity` without `onPress`; add labels + roles.
6. **Auth-gate order** — phone verification must precede admin routing.
7. **Animation cleanup pass** — every Reanimated shared value reset on unmount; replace `setInterval` typing animation with Reanimated.
8. **Icon registry migration** — replace remaining raw `<Ionicons>` callsites with `<AppIcon>`.
9. **Modal remount fix** — switch from conditional render to opacity + pointerEvents for sticky-state modals.
10. **Extract inline components** out of `app/(tabs)/index.tsx`; delete dead `buildInbox` / `notif*` helpers.

## Scope notes

- Community surfaces were intentionally excluded.
- Admin (`app/admin/*`) was out of scope for this pass.
- Audit is **diagnostic only** — no code changes were made.
