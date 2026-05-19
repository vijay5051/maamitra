# MaaMitra Auth Flow UX/Code Audit – Findings

**Date:** 2026-05-19  
**Scope:** app/(auth)/*, components/auth/*, components/onboarding/*, hooks/useSignOut.ts, hooks/useGoogleSignIn.ts, lib/auth*.ts, store/useAuthStore.ts, store/useProfileStore.ts (auth-related sections)  
**Audit Rules:** CLAUDE.md Rule #1 (Cross-references), Rule #2 (No mocks/Coming soon), design tokens (Colors, Fonts, Spacing, Radius)

---

## CRITICAL

- [components/onboarding/StateSelector.tsx:158] `fontWeight: '600'` used instead of `Fonts.sansSemiBold` — TypeScript object property, bypasses design-token system entirely
- [components/onboarding/StateSelector.tsx:205] `fontWeight: '500'` used instead of `Fonts.sansMedium` — same issue, hardcoded weight without font family
- [components/onboarding/StateSelector.tsx:210] `fontWeight: '700'` used instead of `Fonts.sansBold` — same issue

---

## HIGH

- [components/auth/SignOutOverlay.tsx:45] `color="#fff"` hardcoded instead of `Colors.white` in checkmark icon (appears twice in similar code blocks)
- [components/auth/DeleteAccountOverlay.tsx:45] `color="#fff"` hardcoded instead of `Colors.white` in checkmark icon — inconsistent with design tokens
- [components/auth/SmartInputCard.tsx:279] `placeholderTextColor={Colors.textLight}` used for OTP code input — mismatch with phone input field which uses different placeholder color (line 254 uses `Colors.textLight` but line 264 uses hardcoded `#c4b5d4`)
- [app/(auth)/phone.tsx:264] `placeholderTextColor="#c4b5d4"` hardcoded instead of `Colors.textLight` — inconsistent across two similar screens (SmartInputCard uses textLight, phone.tsx uses hardcoded hex)
- [app/(auth)/phone.tsx:279] `placeholderTextColor="#d4c9e8"` hardcoded instead of design token — inconsistent placeholder color strategy
- [components/auth/SignOutConfirmModal.tsx:47] `color: '#fff'` hardcoded instead of `Colors.white` in confirm button text
- [components/auth/DeleteAccountConfirmModal.tsx:47] `color: '#fff'` hardcoded instead of `Colors.white` in confirm button text
- [components/onboarding/StateSelector.tsx:146,157,164,177,181,200,204,219] Multiple hardcoded hex colors (#f9fafb, #1a1a2e, #fdf6ff, #ffffff, #F5F0FF, #9ca3af, #d1d5db, #e5e7eb, #f3e8ff, #f3f4f6, rgba inline) — entire component built without design tokens, no Colors.* or Spacing.* usage
- [components/onboarding/StateSelector.tsx:166] `fontSize: 13` hardcoded instead of FontSize.sm — no FontFamily at all, relies on implicit system font
- [components/onboarding/StateSelector.tsx:156,175,177,204,219] Multiple hardcoded `fontSize` values (13, 14, 15, 18) without corresponding FontSize tokens — inconsistent typography across auth flow
- [app/(auth)/phone.tsx:446-447] `Platform.OS === 'web' ? 12 : 14` padding — acceptable but indicates web-specific visual adjustment may be needed elsewhere (code comment missing context)
- [app/(auth)/onboarding.tsx:161] `Platform.OS === 'ios' ? 'padding' : undefined` — web platform falls through to undefined behavior (correct but edge case worth documenting)

---

## MEDIUM

- [app/(auth)/welcome.tsx:353] `backgroundColor: '#ffffff'` hardcoded instead of Colors.cardBg (trust card)
- [app/(auth)/welcome.tsx:354] `borderColor: '#F0EDF5'` hardcoded instead of Colors.borderSoft — inconsistent border color naming
- [app/(auth)/phone.tsx:423,453] `backgroundColor: '#ffffff'` hardcoded instead of Colors.white (input row background)
- [components/auth/AppleSignInButton.tsx:33] `backgroundColor: '#000'` hardcoded and commented as "Apple HIG requirement" — valid but not reconciled with Colors token structure; exception noted in comment is good
- [app/(auth)/phone.tsx:221] `Platform.OS === 'ios' || Platform.OS === 'web' ? 'padding' : 'height'` — behavior mixes iOS and web (same padding behavior), but Android uses height; no documentation for why web is grouped with iOS
- [app/(auth)/phone.tsx:426,454] `borderColor: '#E5E1EE'` hardcoded; should check if this matches Colors.border (#E5E1EE per theme.ts line 34)
- [components/onboarding/StateSelector.tsx:149] `borderColor: '#e5e7eb'` does NOT match Colors.border (#E5E1EE) — 6-digit hex hardcoded, off-theme
- [app/(auth)/welcome.tsx:305,310,315,330,331,349,350,357,358,364] Mix of hardcoded colors (#1C1033, #6b7280, #4b5563, #F5F0FF, #F0EDF5) and Colors.* — inconsistent in same file
- [app/(auth)/welcome.tsx:305] `color: '#1C1033'` should be Colors.textDark (appears on line 306 as well)
- [components/auth/SignOutOverlay.tsx:58] `backgroundColor: 'rgba(28, 16, 51, 0.55)'` hardcoded rgba instead of Colors.primaryAlpha20 or similar — no pre-computed alpha variant used
- [components/auth/DeleteAccountOverlay.tsx:58] `backgroundColor: 'rgba(28, 16, 51, 0.55)'` same issue — hardcoded overlay transparency instead of theme token
- [components/auth/SignOutConfirmModal.tsx:38] `backgroundColor: 'rgba(28, 16, 51, 0.4)'` hardcoded rgba instead of computed alpha
- [components/auth/DeleteAccountConfirmModal.tsx:38] `backgroundColor: 'rgba(28, 16, 51, 0.4)'` same hardcoded overlay color
- [app/(auth)/setup.tsx:250-260] Error icon circle background `#FEE2E2` hardcoded — should be Colors.error with alpha or a dedicated semantic error-bg token
- [app/(auth)/onboarding.tsx:269-270] Multiple inline text color values (#F9F7FD background, #1C1033 text) — not using design tokens

---

## LOW

- [app/(auth)/phone.tsx:71-76] useEffect with inline comment "Plan B hotfix (Bug 3)" — historical debt marker; consider refactoring to more stable params-hydration pattern or adding a metrics label
- [app/(auth)/setup.tsx:129] Type cast `(router.replace as any)('/(auth)/setup')` — suggests typed-routes are out of sync; should regenerate or document workaround
- [app/(auth)/onboarding.tsx:149] Same type cast `(router.replace as any)` for navigation; affects setup.tsx line 148, setup.tsx line 152
- [app/(auth)/setup.tsx:144] Empty try-catch in `requestNotificationPermission` call — silently swallows errors; should log or surface in toast
- [components/auth/SmartInputCard.tsx:253] `inputMode="numeric"` used only on code input (line 205), not on phone input — inconsistent a11y across similar fields
- [app/(auth)/phone.tsx:258-270] Phone input and code input have different visual arrangements (prefix box vs centered) but both use similar styling — consider extracting shared OTP patterns
- [components/onboarding/StateSelector.tsx:82] `autoFocus={!!selected}` — auto-focus only when state is picked; initial focus behavior differs from typical onboarding flow
- [app/(auth)/onboarding.tsx:186] `autoCapitalize="words"` on mother-name field; baby-name field also has this, but no `autoComplete` hints for browser autocomplete
- [app/(auth)/onboarding.tsx:278] Input component missing `autoComplete` attribute — browser cannot suggest previous entries
- [app/(auth)/setup.tsx:196] Accessible button style `errorBtns` used for both error and notify phases — semantic naming mismatch

---

## NIT

- [components/auth/SmartInputCard.tsx:29] Comment says "Plan A Task 9" referring to external doc — should cite or remove
- [components/auth/SmartInputCard.tsx:232] `nativeID={PHONE_OTP_CONTAINER_ID}` appears twice (lines 233, 300) in same file — correct but verbose
- [app/(auth)/phone.tsx:51-52] Deep-link parameter ?e164 documented but no mention of fallback to manual entry if param is lost
- [app/(auth)/phone.tsx:336-338] reCAPTCHA container comment notes "must exist in DOM"; same note appears in SmartInputCard 299-300 — could be shared doc or constant
- [app/(auth)/phone.tsx:94] `const e164 = +91${...}` — hardcoded country code; no locale support for multi-country future
- [components/auth/SmartInputCard.tsx:86,245] Phone number construction hardcodes +91 prefix in two places — should be extracted to constant or localized
- [app/(auth)/welcome.tsx:176] `accessibilityRole="button"` on TouchableOpacity for reset link — correct but href-like buttons could use `accessibilityRole="link"`
- [app/(auth)/phone.tsx:173] Cast return type `(router.replace as any)` on line 149 but direct call on other lines (line 75) — inconsistent pattern
- [components/onboarding/StateSelector.tsx:152] `minHeight: 48` in selectedField differs from typical 44pt minimum tap target — should align with design system (theme.ts shows Radius.xs=8 but no tap-target constant)
- [app/(auth)/phone.tsx:269] `returnKeyType="done"` on phone input but `onSubmitEditing={handleSendOtp}` handler is declared — correct but keyboard dismissal UX not verified on different OS versions
- [components/onboarding/StateSelector.tsx:39-44] useMemo has `[query]` dependency but `INDIAN_STATES` is never checked as a source — immutable data source but could add comment

---

## Summary by Severity

| Severity | Count |
|----------|-------|
| CRITICAL | 3     |
| HIGH     | 19    |
| MEDIUM   | 14    |
| LOW      | 13    |
| NIT      | 10    |
| **TOTAL** | **59** |

---

## Key Issues at a Glance

1. **StateSelector component is almost entirely off-theme** — hardcoded colors, fonts, no design-token usage; affects visual consistency with rest of auth flow
2. **Placeholder colors inconsistent** — SmartInputCard vs phone.tsx use different placeholder colors (#c4b5d4, #d4c9e8, Colors.textLight mixed)
3. **Hardcoded #fff color in overlays** — SignOutOverlay, DeleteAccountOverlay, both confirm modals use #fff instead of Colors.white (4 instances)
4. **Hardcoded rgba overlays instead of pre-computed alpha tokens** — Four backdrop overlays use inline `rgba(28, 16, 51, ...)` instead of Colors.primaryAlpha* variants
5. **fontWeight hardcoded alongside missing fontFamily** — StateSelector uses `fontWeight: '500'/'600'/'700'` with no corresponding Fonts.* token (violates design system contract)
6. **Platform-specific padding without web alternative documented** — phone.tsx adjusts padding for web but rationale not explained; may indicate incomplete cross-platform QA
7. **Type casts on router.replace** — Suggested typed-routes generation is out of sync; affects 3 navigation sites
8. **Silent error swallowing** — requestNotificationPermission error caught and swallowed without logging (setup.tsx:147)
9. **Auth-specific colors not centralized** — Multiple hardcoded hex values that could be theme tokens (e.g., input backgrounds, border colors)
10. **Accessibility gaps** — Missing autoComplete hints on text inputs, inconsistent autoFocus behavior, inputMode hints only on one field

---

## Affected Files

| File | Severity | Issue Type |
|------|----------|-----------|
| components/onboarding/StateSelector.tsx | CRITICAL+HIGH | Colors, fonts, spacing all hardcoded |
| app/(auth)/phone.tsx | HIGH+MEDIUM | Placeholder colors, hardcoded hex, Platform handling |
| components/auth/SmartInputCard.tsx | MEDIUM | Placeholder color mismatch |
| components/auth/SignOutOverlay.tsx | HIGH | Hardcoded #fff, rgba backdrop |
| components/auth/DeleteAccountOverlay.tsx | HIGH | Same as SignOutOverlay |
| components/auth/SignOutConfirmModal.tsx | HIGH | Hardcoded #fff, rgba backdrop |
| components/auth/DeleteAccountConfirmModal.tsx | HIGH | Same as SignOutConfirmModal |
| app/(auth)/welcome.tsx | MEDIUM+LOW | Mixed hardcoded and token colors |
| app/(auth)/onboarding.tsx | LOW | Type casts, missing autoComplete |
| app/(auth)/setup.tsx | LOW+NIT | Type cast, silent error catch, icon background color |
| components/auth/AppleSignInButton.tsx | MEDIUM | Intentional hardcode (Apple HIG) but noted |
| hooks/useGoogleSignIn.ts | ✓ | No critical issues (well-structured) |
| hooks/useSignOut.ts | ✓ | No critical issues (well-structured) |
| lib/authObservability.ts | ✓ | No issues found |
| lib/friendlyAuthError.ts | ✓ | No issues found |
| lib/returningUserAuthGuard.ts | ✓ | No issues found |
| lib/savePhoneVerification.ts | ✓ | No issues found |
| lib/storageEscape.ts | ✓ | No issues found |

