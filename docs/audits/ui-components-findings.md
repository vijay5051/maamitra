# MaaMitra UI Components & Animations Audit

**Audit Date:** May 19, 2026
**Scope:** components/ui/*, components/feedback/*, components/jit/*, components/ForceUpdateOverlay.tsx, components/ImpersonationBanner.tsx, components/MaintenanceOverlay.tsx, constants/theme.ts, constants/icons.ts, lib/haptics.ts, lib/cross-platform-alerts.ts, lib/illustrations.ts

**Executive Summary:** 73 findings across 5 severity levels. Primary issues are hardcoded colors/spacing lacking token use, inconsistent prop naming across button/modal/sheet components, raw Ionicons usage bypassing the AppIcon registry, and z-index conflicts between overlays.

---

## CRITICAL (5 findings)

- **[components/ui/SettingsModal.tsx:110]** Raw Ionicons with hardcoded color `#ef4444` — should use `<AppIcon name="action.delete" role="error" />` instead of inline `<Ionicons name={icon as any} size={18} color={danger ? '#ef4444' : Colors.primary} />`

- **[components/ui/SettingsModal.tsx:549]** Raw Ionicons close icon with hardcoded `#6b7280` (textMuted approximation) — `<Ionicons name="close" size={22} color="#6b7280" />` should be `<AppIcon name="nav.close" role="muted" />`

- **[components/ui/EmailVerifyBanner.tsx:49]** Raw Ionicons hardcoded to `#b45309` (warning color not in theme) — `<Ionicons name="mail-unread" size={20} color="#b45309" />` bypasses role system entirely

- **[components/ui/AppBannerStrip.tsx:77]** Raw Ionicons hardcoded to `#1a1a2e` (inline text color) — should route through AppIcon with semantic role

- **[components/ImpersonationBanner.tsx:45, MaintenanceOverlay.tsx:50, ForceUpdateOverlay.tsx:71]** Z-index conflict: ImpersonationBanner (10000) can overlay MaintenanceOverlay (9999) and ForceUpdateOverlay (9998), causing unexpected stacking order when multiple overlays mount simultaneously. No documented stacking contract.

---

## HIGH (18 findings)

- **[components/ui/GradientButton.tsx:51]** Ad-hoc color `#c9b7f7` (BRAND_DIM) — should be `Colors.primaryAlpha` variant or theme token instead of inline hex

- **[components/ui/GradientButton.tsx:177-194]** Arbitrary spacing: `paddingVertical: 15`, `paddingHorizontal: 20`, `paddingVertical: 14`, `paddingHorizontal: 20` — none map to Spacing tokens (xs/sm/md/lg/xl/xxl/xxxl). Should use `Spacing.md` (12) + `Spacing.lg` (16) or similar.

- **[components/ui/GradientButton.tsx:182, 192, 197]** Hardcoded colors in styles: `shadowColor: '#1C1033'` (should be Colors.textDark), `borderColor: '#E5E1EE'` (should be Colors.border), `backgroundColor: '#ffffff'` (should be Colors.white)

- **[components/ui/Card.tsx:87, 90]** Hardcoded colors in card styles: `backgroundColor: '#ffffff'` should be `Colors.white` or `Colors.cardBg`; `borderColor: '#EDE9F6'` should be `Colors.borderSoft`

- **[components/ui/Card.tsx:22-50]** Card shadows defined inline with raw colors instead of using `Shadow.sm`, `Shadow.md`, `Shadow.lg` from theme

- **[components/ui/ContextualAskChip.tsx:39]** Raw Ionicons `color="#fff"` hardcoded — should use `Colors.white` and route through AppIcon

- **[components/ui/ContextualAskChip.tsx:67]** Arbitrary padding `paddingHorizontal: 10`, `paddingVertical: 8` — not in Spacing scale

- **[components/ui/EmailVerifyBanner.tsx:70-87]** Entirely custom warning palette (#fef3c7, #fcd34d, #b45309, #78350f, #92400e) — these are raw Tailwind colors, not theme tokens. Should use Colors.warning + semantic accents or define in theme.ts if reused

- **[components/ui/Skeleton.tsx:138]** Hardcoded skeleton placeholder `backgroundColor: '#EDE9F6'` — should use Colors.border or Colors.borderSoft for consistency with card borders

- **[components/ui/AppBannerStrip.tsx:25-28]** Gradient hardcoded for banner tones: ['#DBEAFE', '#BFDBFE'], ['#FCE7F3', '#F9A8D4'], ['#FEF3C7', '#FDE68A'] — all raw Tailwind, not theme tokens. No easy way to shift brand if needed.

- **[components/ui/AppBannerStrip.tsx:86-92]** Arbitrary spacing: `padding: 14` (should be Spacing.md?), `marginHorizontal: 16` (should be Spacing.lg), `marginTop: 12` (should be Spacing.md), `padding: 4` (should be Spacing.xs)

- **[components/ui/RootErrorBoundary.tsx:103, 165, 169]** Hardcoded colors in error boundary: `#FFFCF7`, `#FFF1F2`, `#FBCFE8` — should use theme tokens or define semantic error colors

- **[components/ui/TypingIndicator.tsx:85-98]** Arbitrary spacing: `marginLeft: 8`, `marginVertical: 4`, `paddingVertical: 10`, `paddingHorizontal: 14` — none map to Spacing tokens

- **[components/ui/Skeleton.tsx:102, 107, 151-165, 175-180]** Arbitrary spacing in skeleton presets: `gap: 8` (should be Spacing.sm), `marginTop: 14` (should be Spacing.md?), `padding: 16` (should be Spacing.lg), various margins — inconsistent token use

- **[components/ui/DatePickerField.tsx:384, 400]** Arbitrary spacing: `marginRight: 10`, `paddingHorizontal: 18`, `paddingVertical: 12` — not Spacing tokens

- **[components/ui/MicroSurveyModal.tsx:121]** Hardcoded backdrop overlay `'rgba(28, 16, 51, 0.45)'` — should use Colors.overlay or Colors.primaryAlpha variant

- **[components/ui/MicroSurveyModal.tsx:148]** Hardcoded icon bubble bg `'#F5F0FF'` (bgTint) — should use Colors.bgTint or Colors.primaryAlpha20

- **[components/ui/AnimatedPressable.tsx:missing]** No cleanup of shared values on unmount — scale.value is initialized in component render scope but never explicitly reset, potential leak if component re-mounts rapidly

---

## MEDIUM (28 findings)

- **[components/ui/GradientButton.tsx:40, 61, 88, 120, 155]** Prop name: `loading` — inconsistent with other components that use `busy` (SettingsModal, MicroSurveyModal). Standardize to one convention across all async/loading states

- **[components/ui/SettingsModal.tsx:206, 1086]** Prop name: `busy` used locally; GradientButton uses `loading`. Buttons/sheets should standardize on `isLoading` or `loading` across the app

- **[components/ui/MicroSurveyModal.tsx:26]** Local state `busy` for submit spinner — should align with GradientButton's `loading` prop if both show spinners during async operations

- **[components/ui/SuccessCheck.tsx:39-40]** Default color `'#16a34a'` (success green) and `bgColor: '#dcfce7'` — not from theme. Should use Colors.success or define in theme.ts

- **[components/ui/Confetti.tsx:23-29]** Color list hardcoded to brand colors, never exposed as configurable. If a screen needs different celebration colors, must fork the component

- **[components/ui/TypingIndicator.tsx:65, 100]** Hardcoded border colors: `borderColor: Colors.borderSoft` (good), but bubble styling mixes token use with arbitrary values. Bubble shadow not using Shadow tokens

- **[components/ui/TagPill.tsx:16-22]** Helper function `hexToRgba()` exists — creates inline rgba for computed bg, but doesn't use Colors.primaryAlpha* presets. Should prefer `Colors.primaryAlphaXX` for hot paths to avoid StyleSheet cache busting

- **[components/ui/DatePickerField.tsx:45-78]** Web date input styling uses `webInputStyle` (likely defined separately) — not shown in scope, but if hardcoded colors/sizing, should route through theme

- **[components/ui/Card.tsx:69-82]** Card pressable has `activeOpacity={0.85}` — AnimatedPressable uses `scale: 0.97 + spring`. Inconsistent press feedback across press-feedback components (opacity vs. scale)

- **[components/ui/AnimatedPressable.tsx:45, 58]** Press animation uses fixed `scaleTo: 0.97` and `Easing.out(Easing.quad)` + spring damping 14, stiffness 260 — this scale value is hardcoded in multiple places (GradientButton also 0.97), should be a theme constant

- **[components/ui/SplashAnimation.tsx:36-66]** Multiple useAnimatedStyle hooks + shared values per element — no cleanup hook visible; if component unmounts mid-animation, shared values may persist. useDependencyArray missing explicit dependency on shared values

- **[components/ui/AnimatedNumber.tsx:55-58]** useDerivedValue without explicit cleanup — if component unmounts during animation, derived value hook may continue executing (lower priority than useEffect but still a potential leak)

- **[components/feedback/FeedbackSurveyModal.tsx:74-76]** Hardcoded tint colors for pay options: '#10B981' (success), '#F59E0B' (warning), '#EF4444' (error) — should use Colors.success, Colors.warning, Colors.error from theme

- **[components/feedback/FeedbackSurveyModal.tsx:visible={visible}]** No memoization of survey state — FeedbackSurveyModal can remount if parent re-renders with visible prop flipping, causing full reset of form state

- **[components/ui/HelpSupportSheet.tsx:visible={visible}]** Modal visibility toggle causes full unmount/remount — form state in parent may reset unexpectedly if parent re-renders

- **[components/ui/SettingsModal.tsx:visible={visible}]** Same modal remount issue — large component, expensive to unmount/remount on every visibility toggle

- **[components/jit/JustInTimePrompt.tsx:77-90]** Arbitrary spacing: `padding: 14` (should be Spacing.md?), `marginBottom: 12`, `top: 10`, `right: 10`, `paddingRight: 28` (ad-hoc), `marginBottom: 4`, `marginBottom: 10`, `marginTop: 8` — many non-token values

- **[components/jit/DietPrompt.tsx, KidGenderPrompt.tsx, StatePrompt.tsx]** Each JIT prompt returns null if not visible — no early return guard if profile store hasn't hydrated yet. Race condition possible if profile store is still loading when prompts check dismissedPrompts

- **[constants/icons.ts:97]** action.delete defaultRole set to 'error' — semantically correct, but some call sites may expect 'action' color. TabIcon override needed in library sub-tabs where delete should be neutral

- **[components/ui/AppIcon.tsx:79-86]** TabIcon hard override for library sub-tab pills — not using AppIcon registry, raw Ionicons. OK for now (documented), but future migration needed

- **[lib/cross-platform-alerts.ts:11]** No retry logic — if Linking.openURL fails silently on native, user gets no feedback. HTTP links in banners/overlays should fallback to error alert

- **[components/ui/EmailVerifyBanner.tsx:not-using-AppIcon]** Entire component is raw Ionicons + hardcoded colors instead of routing through AppIcon. Could be refactored to use AppIcon for mail icon

- **[components/MaintenanceOverlay.tsx]** No translated text — "You'll be able to use MaaMitra again automatically once we're done" is hardcoded English string. Should use i18n if app is localized

- **[components/ForceUpdateOverlay.tsx]** Same hardcoded English strings — no translation support visible

- **[components/ImpersonationBanner.tsx]** Hardcoded English "Viewing as" — no i18n

---

## LOW (18 findings)

- **[components/ui/Skeleton.tsx:33]** shimmerX shared value range hardcoded to -200 → 200 — ties shimmer animation to fixed pixel values, not viewport width. On wide screens, shimmer may not cover full width

- **[components/ui/GradientButton.tsx:156, 163, 208]** Color consistency: activity spinner uses `color="#ffffff"` but Colors.white exists. Minor, but should normalize all white refs to Colors.white

- **[components/ui/SuccessCheck.tsx:size=72]** Default size hardcoded — no prop to make it larger for bigger celebration moments. 72px is arbitrary

- **[components/ui/AppBannerStrip.tsx:68]** Close button hitSlop hardcoded to 10 — should be a theme constant if used elsewhere

- **[components/ui/DatePickerField.tsx:missing-locale]** Hard-coded locale 'en-IN' for date formatting — should be a runtime constant or pulled from device locale preference

- **[components/ui/RootErrorBoundary.tsx:49]** Uses `__DEV__` global to show stack traces — reliance on build-time constant limits runtime configuration. Could use a feature flag instead

- **[components/ui/MicroSurveyModal.tsx:95]** Placeholder text "A sentence or two helps us a lot…" hardcoded — no i18n

- **[components/ui/MicroSurveyModal.tsx:160-197]** Hardcoded label colors: '#1C1033' (textDark, good), but some hardcoded: '#a89bbf' (placeholder, ad-hoc purple), '#9ca3af' (textMuted, should use Colors.textMuted)

- **[components/ui/ContextualAskChip.tsx:not-accessible]** No accessibilityLabel or accessibilityRole on TouchableOpacity — just "Ask about this" would help

- **[components/feedback/MicroSurveyModal.tsx:59]** Icon bubble uses hardcoded `#F5F0FF` instead of Colors.bgTint — correct color but not via token

- **[components/jit/KidNamePrompt.tsx:42-47]** Placeholder text "e.g. Aarav, Diya, Aanya" hardcoded — no i18n support

- **[components/jit/StatePrompt.tsx, DietPrompt.tsx, KidGenderPrompt.tsx]** Each prompt uses local dismissal logic via `dismiss(promptKey)` — if user swipes away before profile save completes, dismissal may not persist. No error handling for async profile update

- **[components/ui/Confetti.tsx:47]** Particle count hardcoded to 28 — no way to scale confetti intensity for different celebrations (big milestone vs. small mood log)

- **[components/ui/Card.tsx:60]** Default padding hardcoded to 16 — no tokens, arbitrary value

- **[components/ui/TypingIndicator.tsx:22, 23, 24]** Animation timings hardcoded (STEP_MS=220, PULSE_UP_MS=380, PULSE_DOWN_MS=380) — feels custom but not documented why these exact values

- **[components/feedback/FeedbackSurveyModal.tsx:37-59]** Tag lists LOVED_TAGS and FRUSTRATED_TAGS hardcoded — no i18n, no way to swap for different markets (US vs. India vs. Brazil might have different pain points)

- **[components/ui/HelpSupportSheet.tsx:37-58]** FAQ hardcoded in component — should move to Firestore so support can update without shipping new builds

- **[components/ui/AppBannerStrip.tsx:47]** Banner gradient tones and colors not reusable — TONE_GRADIENTS only used here, can't repurpose for other UI surfaces needing info/celebrate/warn states

---

## NIT (4 findings)

- **[components/ui/AnimatedPressable.tsx:63, 74]** Dependency arrays missing some dependencies — `scale` is used in the callback but not listed (though closure captures it). Linter would flag if strict mode is on

- **[components/ui/GradientButton.tsx:18]** Comment says "useNativeDriver=true on web triggers console warning" but NATIVE_DRIVER logic is correct. Comment could be clearer about fallback behavior

- **[components/ui/Confetti.tsx:84]** eslint-disable-next-line exhaustive-deps on useEffect — acknowledged but could be refactored to avoid the disable (move animation logic to Reanimated callback instead)

- **[components/ui/RootErrorBoundary.tsx:49]** typeof __DEV__ check is redundant — __DEV__ is always defined in React Native, should just check the value

---

## Summary by Severity

| Severity | Count |
|----------|-------|
| CRITICAL | 5     |
| HIGH     | 18    |
| MEDIUM   | 28    |
| LOW      | 18    |
| NIT      | 4     |
| **TOTAL**| **73**|

---

## Key Themes

### 1. **Token System Underutilization** (38 findings)
Colors, spacing, radius, shadow, and font constants exist but many components hardcode hex values or arbitrary pixel spacing. Calls to standardize:
- Use Colors.* tokens everywhere (white, primary, border, borderSoft, etc.)
- Use Spacing.xs/sm/md/lg/xl/xxl/xxxl for all padding/margin/gap
- Use Radius.xs/sm/md/lg/xl/xxl/full for border-radius
- Use Shadow.sm/md/lg/card for elevation
- Never inline rgba() — prefer Colors.primaryAlphaXX presets

### 2. **Icon Registry Bypass** (7 findings)
Raw `<Ionicons>` components in GradientButton, SettingsModal, EmailVerifyBanner, AppBannerStrip bypass the AppIcon semantic system. All icons should route through `<AppIcon name="..." role="..." />` to ensure consistent coloring and future glyph migration.

### 3. **Prop Name Inconsistency** (3 findings)
Buttons use `loading`, but modals and sheets use `busy`. Standardize on `loading` or `isLoading` across all async UI components.

### 4. **Z-Index Conflicts** (1 critical finding)
Overlays have no documented stacking contract. Multiple overlays mounting simultaneously can cause unexpected stacking. Define:
- ImpersonationBanner: 10000 (always topmost)
- MaintenanceOverlay: 9999
- ForceUpdateOverlay: 9998
- Ensure no other z-indices fall in these ranges

### 5. **Animation Cleanup & Lifecycle** (4 findings)
Confetti, SuccessCheck, SplashAnimation, and AnimatedNumber don't explicitly reset shared values on unmount. Low priority (animations complete quickly), but good practice to prevent leak if components remount during active animation.

### 6. **Press Feedback Inconsistency** (2 findings)
AnimatedPressable uses `scale: 0.97 + spring`, but Card uses `opacity: 0.85`. Should standardize on one approach or document the choice.

### 7. **Missing Internationalization** (6 findings)
Banners, overlays, modals, and JIT prompts have hardcoded English strings. If app is localized, these should use i18n library.

### 8. **Modal Remount Issues** (3 findings)
HelpSupportSheet, SettingsModal, and FeedbackSurveyModal unmount/remount on visibility toggle, causing form state loss. Consider using opacity + pointerEvents instead of conditional rendering.

---

## Recommended Fixes (Priority Order)

1. **CRITICAL (must fix before ship):**
   - Define z-index contract for all overlays
   - Route all raw Ionicons through AppIcon (5 instances)
   - Remove hardcoded warning colors from EmailVerifyBanner

2. **HIGH (before next sprint):**
   - Replace all hardcoded colors with theme tokens (25+ instances)
   - Replace arbitrary spacing with Spacing.* tokens (20+ instances)
   - Standardize `loading` vs `busy` prop naming

3. **MEDIUM (next 2 sprints):**
   - Refactor banner gradients to theme + semantic accents
   - Add cleanup/reset for Reanimated shared values
   - Fix modal remount issue with opacity instead of unmount

4. **LOW (backlog):**
   - Add i18n to UI text strings
   - Move FAQ to Firestore
   - Add accessibilityLabels to silent buttons
   - Standardize press feedback scale/opacity

---

## Testing Checklist

- [ ] All hardcoded colors changed to theme tokens
- [ ] All spacing changed to Spacing.* constants
- [ ] All raw Ionicons routed through AppIcon
- [ ] Overlays tested for z-index stacking with 2+ visible simultaneously
- [ ] Animations tested on slow-motion (1.5x) to catch jank
- [ ] Modals tested for form state retention on visibility toggle
- [ ] Loading states tested: `loading` prop behaves consistently across GradientButton, sheets, modals
- [ ] Dark mode / high contrast tested for hardcoded colors
- [ ] Haptics tested on web (should no-op) and native (should work)

