# Home Tab UX/Code Audit — Findings Report

**Scope:** app/(tabs)/index.tsx (3953 lines), app/(tabs)/_layout.tsx (294 lines), components/ui/* used by home, jit components  
**Design System:** constants/theme.ts  
**Audit Date:** 2026-05-19  
**Excluded:** Community-related issues (community.tsx, community store, community modals)

---

## Executive Summary

Comprehensive UX/code audit of MaaMitra's HOME tab revealed **48 findings** across 10 severity levels:
- **4 CRITICAL** (risk of runtime errors or data corruption)
- **10 HIGH** (design system violations, accessibility gaps, logic bugs)
- **13 MEDIUM** (maintainability issues, anti-patterns, potential bugs)
- **15 LOW** (naming, consistency, documentation)
- **6 NIT** (code style, minor polish)

---

## CRITICAL Issues

These pose immediate risk of crashes, invalid UI rendering, or incorrect behavior in production.

### 1. [app/(tabs)/index.tsx:647] Invalid vaccine tint background color

**Issue:** Vaccine health card builds an invalid hex color by appending '1A' to an already-full hex color:
```javascript
const vaccineTint = overdue.length > 0 ? Colors.error : dueSoon.length > 0 ? Colors.warning : Colors.success;
// ...
tintBg: `${vaccineTint}1A`,  // ← Becomes "#ef44441A" (invalid)
```

**Impact:** Vaccine status icon background fails to render with correct opacity. Should use `withAlpha(vaccineTint, 0.1)` or pre-computed `Colors.errorAlpha10` token.

**Fix:** Use `Colors.withAlpha(vaccineTint, 0.1)` or define semantic alpha variants in theme.

---

### 2. [app/(tabs)/index.tsx:952–993] Optional onPress passed without null check

**Issue:** TodayCard type defines `onPress?: () => void` (optional), but it's passed directly to `AnimatedPressable` without null guards:
```javascript
<AnimatedPressable
  onPress={hero.onPress}  // ← Could be undefined
  // ...
/>
```

**Impact:** If a card is rendered with undefined `onPress`, tapping it will silently fail or cause undefined behavior. All cards in `buildTodayCards()` should enforce onPress is set.

**Fix:** 1) Ensure all cards pushed to `buildTodayCards()` set `onPress` as required (remove optional), or 2) wrap in `onPress={() => hero.onPress?.()}`.

---

### 3. [app/(tabs)/index.tsx:810] ScrollView paddingBottom doesn't account for tab bar safe area

**Issue:** Home ScrollView has fixed `paddingBottom: 80`, but tab bar height varies by platform and includes safe area inset. On tall notch devices, content may be cut off or over-padded.

**Impact:** Bottom safe area double-padding risk on edge-to-edge Android devices.

**Fix:** Compute paddingBottom dynamically: `paddingBottom: 80 + insets.bottom`.

---

### 4. [app/(tabs)/index.tsx:1217] Hardcoded gradient color not matching design system

**Issue:** Read card gradient uses inline `['#FAFAFB', '#F5F0FF']` instead of theme token:
```javascript
<LinearGradient colors={['#FAFAFB', '#F5F0FF']} />
```

**Impact:** If brand colors change, this gradient is missed during migration. Should reference `Gradients.softPurple` or extracted theme constant.

**Fix:** Replace with `Gradients.softPurple` or define as a theme constant.

---

## HIGH Issues

Design system violations, accessibility gaps, missing handlers, or logic errors that affect user experience.

### 5. [app/(tabs)/index.tsx:264–265] Greeting fallback can read as "Hello there"

**Issue:** When `motherName` is empty/null, greeting reads "Hello there", which feels impersonal:
```javascript
const firstName = (motherName || 'there').split(' ')[0];
const greetingTitle = firstName === 'there' ? 'Hello' : firstName;
// Result: "Good morning, Hello" (reads awkwardly)
```

**Impact:** UX feels broken when user hasn't set name. Should show "Welcome" or skip the name entirely.

**Fix:** When firstName === 'there', set greetingTitle to '' (empty string, suppress name display) and adjust layout.

---

### 6. [app/(tabs)/index.tsx:892] Hardcoded padding instead of Spacing token

**Issue:** `paddingHorizontal: 22` should be `Spacing.xl` (20):
```javascript
<View style={{ paddingHorizontal: 22 }}>
  <KidNamePrompt />
</View>
```

**Impact:** Inconsistent spacing grid. If Spacing changes, this is missed.

**Fix:** Replace with `Spacing.xl`.

---

### 7. [app/(tabs)/index.tsx:1088] Inline style object created on every render

**Issue:** ScrollView style object created inline on every render:
```javascript
<ScrollView style={{ marginTop: 10, marginHorizontal: -Spacing.md }} />
```

**Impact:** Minor perf hit; violates StyleSheet best practices.

**Fix:** Move to `styles` constant: `babyHealthScrollOuter: { marginTop: Spacing.sm, marginHorizontal: -Spacing.md }`.

---

### 8. [app/(tabs)/index.tsx:1960–1980, 3145, 3661] Deprecated Colors.bgPink used instead of Colors.bgTint

**Issue:** Multiple today cards and pill backgrounds use `Colors.bgPink` instead of the preferred `Colors.bgTint`:
```javascript
bg: Colors.bgPink,  // ← Deprecated name
```

**Impact:** Confuses future maintainers. `bgPink` is an alias; `bgTint` is the canonical name.

**Fix:** Replace all instances with `Colors.bgTint`.

---

### 9. [app/(tabs)/index.tsx:1950, 2009] Colors.error/warning/success in todo card backgrounds lack contrast validation

**Issue:** Vaccine card uses semantic colors (error, warning, success) directly as bg, but no WCAG contrast check against dark text:
```javascript
bg: nextVaccine.status === 'overdue' ? '#FEE2E2' : Colors.border,
```

**Impact:** Red background (#FEE2E2) with dark text may fail WCAG AA contrast (4.5:1). Should use semantic light variants.

**Fix:** Define `Colors.errorLight`, `Colors.warningLight` in theme and use those.

---

### 10. [app/(tabs)/index.tsx:981–1010] Quick Actions grid lacks accessibility labels on animated cards

**Issue:** AnimatedPressable cards in Quick Actions grid lack `accessibilityLabel`:
```javascript
<AnimatedPressable
  onPress={c.onPress}
  style={[styles.todayCard, { backgroundColor: c.bg }]}
  // ← Missing accessibilityLabel, accessibilityRole
/>
```

**Impact:** Screen reader users cannot understand what each card does without labels.

**Fix:** Add `accessibilityLabel={c.label}` and `accessibilityRole="button"` to all AnimatedPressable instances.

---

### 11. [app/(tabs)/index.tsx:2000–2002] Days calculation off-by-one near midnight

**Issue:** Vaccine reminder shows "Overdue by ${Math.abs(days)}d" but Math.abs(days) can be 0 when due today:
```javascript
const days = Math.round((due - now) / (1000 * 60 * 60 * 24));
const label = nextVaccine.status === 'overdue'
  ? `Overdue by ${Math.abs(days)}d`  // ← Could show "Overdue by 0d"
```

**Impact:** Confusing copy when a vaccine is due today but status is 'overdue'. Should say "Due today" or "Due now".

**Fix:** Check if days === 0 and show "Due today" instead.

---

### 12. [app/(tabs)/index.tsx:1137–1142] Timezone-unsafe date arithmetic for post timestamps

**Issue:** "ago" calculation for latest community post uses local time without accounting for timezone:
```javascript
const mins = Math.max(1, Math.floor((Date.now() - created.getTime()) / 60000));
```

**Impact:** Post timestamp will show wrong "ago" duration for users in timezones far from UTC or server timezone.

**Fix:** Ensure `latestPost.createdAt` is stored and parsed consistently in UTC. Use a utility like `getRelativeTime()` from the codebase.

---

### 13. [app/(tabs)/index.tsx:324–327, 404–407, 938–943, 1025–1030, 2299] Multiple unsafe age calculations with dob strings

**Issue:** Age in months computed directly from dob string without timezone handling:
```javascript
Math.floor((Date.now() - new Date(activeKid.dob).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
```

**Impact:** Off-by-one month near midnight if dob is stored as string without timezone. A baby born at 11pm IST could be shown as 1 month old instead of <1 month at 12:01am UTC.

**Fix:** Use a utility function that treats dob as a date-only value (e.g., "2024-05-01") and computes age from today's date in the user's timezone, not Date.now().

---

### 14. [app/(tabs)/index.tsx:267–271] Greeting salutation fixed at mount, doesn't update if app stays open past midnight

**Issue:** `greetingSalutation` is memoized with empty dependency array:
```javascript
const greetingSalutation = useMemo(() => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  // ...
}, []);  // ← Never re-computes
```

**Impact:** User who keeps app open from 11pm to 12:01am will see "Good evening" until app refreshes.

**Fix:** Add a daily refresh trigger (e.g., poll time of day on a 1-minute timer, or re-compute on app resume).

---

### 15. [app/(tabs)/index.tsx:546–651] babyHealthStrip includes empty state items when no kid is active

**Issue:** babyHealthStrip returns empty array when `activeKid?.isExpecting` is true, but the component still renders the section. Empty section looks broken.

**Impact:** Users with expecting kids see a blank "Your baby" corner section.

**Fix:** Wrap the entire health strip rendering in a conditional: `{babyHealthStrip.length > 0 && <ScrollView ...>}` (already done for the ScrollView, good).

---

## MEDIUM Issues

Maintainability concerns, anti-patterns, or potential bugs under edge cases.

### 16. [app/(tabs)/index.tsx:2939–2962] babyHealthCard empty state styling needs better visual distinction

**Issue:** Empty health cards (no data) have `borderStyle: 'dashed'`, but they still show "Log now" in muted text, making them hard to distinguish from real data.

**Impact:** Users might confuse empty cards with low values (e.g., "Log now" vs "0 kg").

**Fix:** Add a more prominent empty state indicator, e.g., dashed border + lighter bg color.

---

### 17. [app/(tabs)/index.tsx:2989–3011] todayCard minHeight hard to scale with dynamic content

**Issue:** Quick Action cards have fixed `minHeight: 92`, but if illustration size or text length changes, cards may overflow.

**Impact:** Long labels could overflow or clip. Cards are not responsive to content.

**Fix:** Consider using `aspectRatio` or flexible height with a minimum, not a fixed minHeight.

---

### 18. [app/(tabs)/index.tsx:3085] Arbitrary rgba color string instead of theme token

**Issue:** Expander button uses inline rgba:
```javascript
backgroundColor: 'rgba(28, 16, 51, 0.048)',
```

**Impact:** Hardcoded. Should use `Colors.primaryAlpha05` or similar.

**Fix:** Replace with `Colors.primaryAlpha05` or define a `Colors.textDarkAlpha05` token.

---

### 19. [app/(tabs)/index.tsx:3146–3147, 3230–3231] Milestone pill padding doesn't use Spacing

**Issue:** Pill has hardcoded `paddingHorizontal: 10, paddingVertical: 6`, not from Spacing:
```javascript
milestonePill: {
  paddingHorizontal: 10,
  paddingVertical: 6,
}
```

**Impact:** Inconsistent spacing grid. Spacing.xs = 4, so this is an odd value.

**Fix:** Use `Spacing.xs` (4) and `Spacing.xs` (4) or `Spacing.sm` (8).

---

### 20. [app/(tabs)/index.tsx:2299] Milestone card ageMonths calculation vulnerable to timezone drift

**Issue:** Milestone selection based on age in months computed unsafely (same issue as #13).

**Impact:** Milestone card may show wrong milestone for user's current stage near midnight.

**Fix:** Use a timezone-aware age utility function.

---

### 21. [app/(tabs)/index.tsx:1507–1511] Kid chip age label calculated unsafely in profile sheet

**Issue:** Same age-in-months calculation in the profile sheet kids chip without timezone handling:
```javascript
const m = Math.max(
  0,
  Math.floor((Date.now() - new Date(k.dob).getTime()) / (1000 * 60 * 60 * 24 * 30.44)),
);
```

**Impact:** Profile sheet shows wrong age relative to home tab age if calculated at different times.

**Fix:** Extract age calculation to a shared, timezone-safe utility.

---

### 22. [app/(tabs)/index.tsx:2704–2708] Explicit height on FeatureGuideCarousel needed for Web but comments indicate it's a hacky workaround

**Issue:** Horizontal ScrollView requires explicit height to work on Web, but this is not idiomatic:
```javascript
style={{ height: cardSize + 24 + Spacing.xl }}
```

**Impact:** Brittle. If Spacing.xl changes, carousel breaks on Web.

**Fix:** Document why this is needed and consider extracting to a constant `FEATURE_CAROUSEL_HEIGHT` that scales with Spacing.

---

### 23. [app/(tabs)/index.tsx:3256] weekGrid gap not from Spacing token

**Issue:** "Your week" digest grid has `gap: 10` instead of `Spacing.sm` (8):
```javascript
weekGrid: {
  gap: 10,
}
```

**Impact:** Spacing inconsistency.

**Fix:** Use `Spacing.sm` or document why 10 is needed.

---

### 24. [app/(tabs)/index.tsx:2722] Key on FEATURE_GUIDE_CARDS.map uses item.title (unstable if title changes)

**Issue:** Carousel dots and slides both key on `item.title`:
```javascript
{FEATURE_GUIDE_CARDS.map((item, index) => (
  <FeatureGuideDot key={item.title} active={index === page} />
))}
```

**Impact:** If FEATURE_GUIDE_CARDS is reordered or a title changes, React may fail to reconcile the carousel correctly.

**Fix:** Use `key={index}` or a stable `id` field on each item (only safe for static lists).

---

### 25. [app/(tabs)/index.tsx:3256–3286] weekGrid tiles don't have accessible labels or semantic meaning

**Issue:** Each "Your week" tile (mood, vaccines, posts) lacks `accessibilityLabel`:
```javascript
<AnimatedPressable
  style={styles.weekTile}
  onPress={() => router.push(...)}
  // ← No label
/>
```

**Impact:** Screen readers can't announce what each stat means.

**Fix:** Add `accessibilityLabel={`Mood: ${weeklyDigest.moodLoggedDays} days logged`}` etc.

---

### 26. [app/(tabs)/index.tsx:2467–2479] FirstRunHero typing animation uses setInterval, not Reanimated

**Issue:** Hero uses old Animated API for pulse and setInterval for typing, inconsistent with rest of app:
```javascript
let i = 0;
const id = setInterval(() => {
  i += 1;
  setTyped(fullQuestion.slice(0, i));
}, 38);
```

**Impact:** Can cause jank if JS thread is busy. Should use Reanimated worklet or requestAnimationFrame.

**Fix:** Migrate typing animation to Reanimated or requestAnimationFrame.

---

### 27. [app/(tabs)/index.tsx:2463–2479] Animated.loop on pulse not cleaned up if component unmounts mid-animation

**Issue:** Animated.loop on pulse is started but cleanup might not stop it:
```javascript
Animated.loop(
  Animated.sequence([...])
).start();
// Cleanup: return () => clearInterval(id);
```

**Impact:** Loop might continue running in the background if modal closes mid-animation.

**Fix:** Capture the loop reference and call `.stop()` in cleanup.

---

### 28. [app/(tabs)/index.tsx:677–702] Micro-survey logic has race condition if user switches user accounts quickly

**Issue:** `ANCHOR_KEY` and `SEEN_PREFIX` are keyed on `user.uid`, but useEffect dependency is `[user?.uid]`. If user logs out and logs back in as a different user, old surveys may re-fire.

**Impact:** User could see same Day-1 survey twice if they switch accounts in same session.

**Fix:** Add a check to ensure surveys are keyed per-session (not just per-user).

---

## LOW Issues

Naming, consistency, and documentation issues that don't break functionality but reduce maintainability.

### 29. [app/(tabs)/index.tsx:264] Variable name `firstName` is misleading when it's fallback 'there'

**Issue:** `firstName` is actually "there" if motherName is missing, which is confusing.

**Fix:** Rename to `displayName` or add a comment: `// fallback: 'there'`.

---

### 30. [app/(tabs)/index.tsx:1902–1925, etc.] bg colors hardcoded in todayCards instead of derived from card theme

**Issue:** Every card sets `bg: '#F5F0FF'` manually instead of using a card theme or constant.

**Impact:** If design changes all card backgrounds, 20+ lines need updating.

**Fix:** Define a `CARD_BG = Colors.bgTint` constant and reuse.

---

### 31. [app/(tabs)/index.tsx:2759] Unused imports or incomplete cleanup from old code?

**Issue:** Multiple imports from store and hooks that may not all be used. Consider:
- `useTeethStore`
- `useFoodTrackerStore`
- `useGrowthStore`
- etc.

**Impact:** Bloat. Verify all are actually used.

**Fix:** Run a dead-code analyzer and clean up unused imports.

---

### 32. [app/(tabs)/index.tsx:1704–1829] buildInbox function is dead code (never called)

**Issue:** `buildInbox()` and related helper functions (notifTypeToKind, notifTitle, notifBody, etc.) are defined but never called in the current code.

**Impact:** Dead code. Suggests a refactoring removed the feature but left the function behind.

**Fix:** Remove or document why it's kept.

---

### 33. [app/(tabs)/index.tsx:2407–2427] JumpTile component defined inline, not extracted to separate file

**Issue:** `JumpTile()` is a small UI component that could live in components/ui/JumpTile.tsx.

**Impact:** Bloats index.tsx. Makes it harder to test JumpTile in isolation.

**Fix:** Extract to components/ui/JumpTile.tsx.

---

### 34. [app/(tabs)/index.tsx:2429–2547] FirstRunHero component defined inline, not extracted

**Issue:** `FirstRunHero()` is a large component (119 lines) defined inline.

**Impact:** Bloats index.tsx to 3953 lines. Harder to maintain.

**Fix:** Extract to components/jit/FirstRunHero.tsx.

---

### 35. [app/(tabs)/index.tsx:2550–2634] FeatureGuideSlide component defined inline, not extracted

**Issue:** `FeatureGuideSlide()` defined inline (85 lines).

**Impact:** Same bloat issue.

**Fix:** Extract to components/jit/FeatureGuideSlide.tsx.

---

### 36. [app/(tabs)/index.tsx:2636–2660] FeatureGuideDot component defined inline

**Issue:** `FeatureGuideDot()` defined inline (25 lines).

**Impact:** Contributes to bloat.

**Fix:** Extract to components/ui/FeatureGuideDot.tsx.

---

### 37. [app/(tabs)/index.tsx:2662–2757] FeatureGuideCarousel component defined inline

**Issue:** `FeatureGuideCarousel()` defined inline (96 lines).

**Impact:** Bloat.

**Fix:** Extract to components/jit/FeatureGuideCarousel.tsx.

---

### 38. [app/(tabs)/index.tsx:2368–2401] ProfileRow component defined inline

**Issue:** `ProfileRow()` defined inline (34 lines).

**Impact:** Minor bloat.

**Fix:** Extract to components/ui/ProfileRow.tsx or components/profile/ProfileRow.tsx.

---

### 39. [app/(tabs)/index.tsx:50–65] Many unused imports from components (NotificationsSheet, ConversationsSheet, HelpSupportSheet, etc.) despite not being called inline

**Issue:** These are imported but used only in the modal render, not in inline component calls. Could be lazy-loaded.

**Impact:** Slight perf hit at init.

**Fix:** Consider lazy-loading sheets on first mount.

---

### 40. [app/(tabs)/index.tsx:2311–2337] "Gentle check-in" mood card inserted via splice, not appended

**Issue:** If `todayCards[0]?.id === 'mood'`, the gentle card is spliced at index 1. If not, it's unshifted to index 0. This logic is fragile:
```javascript
if (cards[0]?.id === 'mood') {
  cards.splice(1, 0, gentleCard);
} else {
  cards.unshift(gentleCard);
}
```

**Impact:** Order depends on whether mood card was rendered first, which is implicit and fragile.

**Fix:** Reorder based on priority weights, not implicit position checks.

---

## NIT Issues

Code style, formatting, and minor polish.

### 41. [app/(tabs)/index.tsx:2797] Missing semantic comment on newborn sleep bg color

**Issue:** Newborn card uses `Colors.border` as bg without explanation:
```javascript
bg: Colors.border,
```

**Impact:** Unclear why border color is used as background.

**Fix:** Add comment: `// Muted color for age-specific tips`.

---

### 42. [app/(tabs)/_layout.tsx:145–166] Tab bar style object could be extracted to a constant

**Issue:** Long tabBarStyle object defined inline in screenOptions.

**Impact:** Hard to read.

**Fix:** Extract to `const TAB_BAR_STYLE = { ... }`.

---

### 43. [app/(tabs)/_layout.tsx:158–159] Platform-specific padding logic could be a helper

**Issue:** Tab bar padding computed inline with ternaries:
```javascript
paddingBottom: (Platform.OS === 'ios' ? 20 : 10) + (Platform.OS === 'android' ? insets.bottom : 0),
```

**Impact:** Hard to read.

**Fix:** Extract to a helper: `const getTabBarPadding = (platform, insets) => ...`.

---

### 44. [app/(tabs)/index.tsx:2815] Hardcoded #FFF8F1 instead of Colors.creamWarm

**Issue:** Hero image bg uses hardcoded color:
```javascript
backgroundColor: '#FFF8F1',
```

Should use `Colors.creamWarm` which is defined in theme.

**Fix:** Replace with `Colors.creamWarm`.

---

### 45. [app/(tabs)/index.tsx:2850] Hardcoded #FFFCF7 instead of theme color

**Issue:** Dadi hero bg uses hardcoded `#FFFCF7` (whisper-cream), should use `Colors.cardBg`.

**Fix:** Replace with `Colors.cardBg`.

---

### 46. [app/(tabs)/index.tsx:3161] Hardcoded #EDE9F6 instead of semantic token

**Issue:** Community avatar fallback bg is hardcoded:
```javascript
backgroundColor: '#EDE9F6',
```

Should be a theme color.

**Fix:** Use `Colors.bgPink` or define `Colors.avatarFallbackBg`.

---

### 47. [app/(tabs)/index.tsx:3255–3286] weekTile component structure inconsistent with todayCard structure

**Issue:** weekTile and todayCard have similar layouts but different naming conventions (weekTileValue vs todayVal, weekTileLabel vs todaySub).

**Impact:** Confusing to maintain parallel styles.

**Fix:** Unify naming: use `CardValue` / `CardLabel` / `CardSub` pattern.

---

### 48. [app/(tabs)/index.tsx:891–894] KidNamePrompt indentation inconsistent

**Issue:** Padding on KidNamePrompt line breaks the visual indentation pattern. Minor style issue.

**Fix:** Format consistently with other sections.

---

## Summary by Severity

| Severity | Count | Categories |
|----------|-------|-----------|
| **CRITICAL** | 4 | Invalid hex colors, missing null checks, unsafe padding, hardcoded gradients |
| **HIGH** | 11 | UX copy, deprecated colors, accessibility gaps, date arithmetic, timezone issues |
| **MEDIUM** | 13 | Spacing tokens, animation patterns, dead code detection, component extraction |
| **LOW** | 15 | Naming clarity, constant extraction, code organization |
| **NIT** | 6 | Color hardcoding, formatting, style consolidation |
| **TOTAL** | **48** | |

---

## Recommended Fixes (Priority Order)

1. **CRITICAL-1:** Fix vaccine tint background color (line 647)
2. **CRITICAL-2:** Add null checks to card onPress handlers (lines 952, 993)
3. **CRITICAL-3:** Dynamic ScrollView paddingBottom for safe area (line 810)
4. **CRITICAL-4:** Replace hardcoded gradient with theme constant (line 1217)
5. **HIGH-1:** Fix greeting fallback text (lines 264–265)
6. **HIGH-2–3:** Replace deprecated Colors.bgPink with Colors.bgTint
7. **HIGH-4:** Extract age calculation to timezone-safe utility
8. **HIGH-5:** Add accessibility labels to all interactive cards

---

## Cross-Reference Cleanup

Per CLAUDE.md Rule #1 (cross-references), verify these are current:
- All router.push() calls are valid routes: ✓
- All store references (useProfileStore, useWellnessStore, etc.) are current: Verify
- All illustration names in QUICK_ILLUS map are valid: Verify with lib/illustrations
- AppIcon names used are current: Verify with components/ui/AppIcon

---

**End of Report**
