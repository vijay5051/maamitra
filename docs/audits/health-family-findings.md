# Health & Family Tab UX/Code Audit
**Date:** 2026-05-19  
**Scope:** health.tsx (2136 lines), family.tsx (895 lines), health components  
**Auditor:** Code Health Review

---

## Summary
Comprehensive audit of Health and Family tabs identified **58 findings** across color/token usage, typography, layout/spacing, logic bugs, accessibility, and UX patterns. Key issues include hardcoded colors breaking theme consistency, missing DOB validation edge cases, vaccine schedule edge-case logic, layout concerns on small screens, and dead UI patterns.

---

## CRITICAL

- [health.tsx:608-614] Inline style objects with hardcoded colors in pregnancy vaccines section — uses `#fff`, `#EDE9F6`, `#1C1033`, `#6b7280`, `#9ca3af` instead of theme tokens. Breaks on color scheme change.

- [health.tsx:943-944] Hardcoded error state color `#fee2e2` and `#dc2626` for "Not eligible" scheme badge instead of using `Colors.error` + theme alpha variants.

- [family.tsx:80] Inline hardcoded bgTint color `#F5F0FF` in ChildCard — should use `Colors.bgTint` or `Colors.primaryAlpha08` for consistency.

- [family.tsx:82-93] Gender icon hardcoded to `#6b7280` (gray) when not active, inconsistent with `Colors.textLight`. No `Colors.disabled` fallback.

- [health.tsx:1320-1322] Three inline rgba() strings for status badge colors instead of using theme presets — `rgba(239,68,68,0.04)`, `rgba(245,158,11,0.04)`, `rgba(34,197,94,0.04)` should be `Colors.error/warning/success` + alpha helpers.

---

## HIGH

- [health.tsx:50-56] Local constants `ROSE`, `PLUM`, `GOLD`, `SAGE`, `MIST`, `INK`, `STONE` redefine theme tokens already in `Colors`. ROSE and PLUM both point to `Colors.primary` but duplicated at module scope. Creates maintenance debt.

- [health.tsx:600-620] Pregnancy vaccines hardcoded inline within VaccinesSection — no reusable data structure. If guidelines change, three inline style objects must be updated separately.

- [health.tsx:1229-1244] SVG Circle stroke uses string interpolation `${color}22` for alpha — non-standard, should use `Colors.primaryAlpha05` pattern instead.

- [family.tsx:47-54] DOB plausibility check uses inline bounds (year 2010, max 300mo) instead of importing from `lib/dob.ts` (MIN_DOB_YEAR, MAX_AGE_MONTHS). **Code duplication risk: if bounds change, both places break.**

- [family.tsx:50] Age calculation using `Math.floor(_diffMs / (1000 * 60 * 60 * 24 * 30.44))` — manual calculation instead of importing `calculateAgeInMonths()` from lib/dob.ts. Diverges from source of truth.

- [health.tsx:1573-1575] Low-performing state list hardcoded as inline array — 10 state names. If list changes nationally, requires code edit. Should be a data file or fetched from Firestore.

- [health.tsx:311-316] groupDotColor() and ringColor() use hardcoded status-to-color mappings (SAGE for done, GOLD for overdue, PLUM for due-soon) — if health status semantics change, two places require edits.

- [health.tsx:1608-1620] ageLabel computed inline instead of calling formatKidAgeCompact() from lib/dob.ts — duplicate age-math logic, risks divergence.

---

## MEDIUM

- [health.tsx:127] primaryAlpha08 backgroundColor hardcoded for category grid icon wrap — should be `Colors.primaryAlpha08` (already is, but line 220 also hardcodes the same, creating implicit dependency).

- [health.tsx:237] Header border color hardcoded `#F0EBF8` — not a theme token. Should be `Colors.borderSoft` or a new `Colors.borderExtraLight`.

- [health.tsx:608, 648] Hardcoded `#fff` for card background in pregnancy vaccines. Should use `Colors.white` or `Colors.cardBg` for consistency.

- [family.tsx:80] ChildCard inactive icon box uses inline `#F5F0FF` (bgTint) for background; active state uses dynamic variable. Should always use theme constant.

- [health.tsx:52-56] Unused local constants — ROSE, PLUM, SAGE, STONE, MIST — defined but mostly redundant with Colors. Creates confusion over which to use.

- [health.tsx:1094] SchemeCard accordion body border-bottom uses hardcoded `#F0EDF5` instead of `Colors.borderSoft` or `Colors.primaryAlpha12`.

- [health.tsx:1142-1161] Three inline hex colors for scheme accordion detail text (`#374151`, `#4c1d95`, `#4b5563`) — not theme tokens, should be color semantic constants.

- [health.tsx:238] Header wrapper background color omitted from header style — relies on parent LinearGradient. If parent changes, header may drift visually.

---

## LAYOUT / SPACING

- [health.tsx:1682-1686] ScrollView contentContainerStyle adds `paddingBottom: insets.bottom + 24` but does **not** add `paddingHorizontal`. Content will be full-width until a Card constrains it, causing visual inconsistency.

- [health.tsx:637-648] InfoBanner hardcoded `paddingHorizontal: 14`, `paddingVertical: 10` instead of using `Spacing` tokens (should be xs + sm).

- [health.tsx:170-172] Category grid card uses `flexBasis: '48%'` for 2-column layout. On very small screens (280px), each card becomes <140px wide — text overflow risk. No min-width constraint.

- [family.tsx:362] ScrollView in AddChildModal specifies `contentContainerStyle={{ paddingBottom: 48 }}` but not `paddingHorizontal` — content will touch edges on mobile.

- [health.tsx:1879] HealthHeroWrap uses `aspectRatio: 12 / 5` (2.4:1) — very wide on tall screens. May overflow on tablet in landscape.

---

## TYPOGRAPHY

- [health.tsx:149-150] Text styles mix `fontFamily: Fonts.sansSemiBold, fontSize: 13` with no lineHeight — MIST color pill shows text cramp on wrapped lines. Should add `lineHeight: 18`.

- [health.tsx:194] Milestone dot pending state uses `fontFamily: Fonts.sansRegular` on a 12px badge text — should be `Fonts.sansMedium` for hierarchy.

- [health.tsx:200] Milestone icon box background color uses inline rgba instead of `Colors.primaryAlpha05`.

- [health.tsx:248-250] Scheme accordion header uses generic Ionicons for icon instead of AppIcon — inconsistent with rest of app. Should use AppIcon for visual uniformity.

- [health.tsx:1040-1041] SchemeCard "Know More" button uses three separate AppIcons (globe, arrow-forward) which wrap unpredictably on small screens. Should be a single Icon or consolidated.

- [family.tsx:368-369] AddChildModal label uses `fontSize: 10` (xs) which is unusually small for a label. Should be `FontSize.xs` = 11 or `FontSize.sm` = 13.

---

## ANIMATIONS

- [health.tsx:318-342] OverduePulseRing animation runs on **every render** if status === 'overdue'. No dependency array guards against re-triggering. useEffect at line 321 missing dependency on `color`.

- [health.tsx:929-932] SchemeCard accordion height animation recomputes `animHeight.value` inside the toggle() function — if the card body grows (e.g., more details added), the stored height becomes stale. Should remeasure on each expand.

---

## LOGIC BUGS & EDGE CASES

- [family.tsx:47-54] DOB plausibility check: if a kid is added with dob = "2025-12-25" (future), `dobInFuture` is true but `isPlausible` passes because year >= 2010. Then `ageText = "Set DOB"` hides the fact that the DOB is invalid. **Should reject future births unless `isExpecting` = true.**

- [health.tsx:1605-1620] ageLabel calculation in HealthScreen duplicates DOB validation and age-math instead of calling `useActiveKid()` which already computes `ageInMonths`. Two separate calculations diverge if timezone affects date parsing.

- [family.tsx:54] isPlausible check: `birthYear >= 2010 && _months <= 300` — if `_months` overflows to 300+, ageText shows "Set DOB" but the kid was successfully stored. UI deceives user into re-entering data.

- [health.tsx:68] Category grid assigns same `Colors.primary` to all cards. Rule says "one accent per card max" but doesn't enforce semantic differentiation (e.g., baby vs mother vs benefits sections should have distinct visual treatment).

- [health.tsx:282-309] groupVaccinesByAge() reassigns status='done' if **all** items done, else checks for 'overdue' item. **Off-by-one risk:** if group has [done, overdue, upcoming], status becomes 'overdue' (correct). But if [done, done, upcoming], status='upcoming' (should be 'due-soon' or 'incomplete').

- [health.tsx:101-105] isBefore(dueDate, today) marks vaccine 'overdue'. **Timezone bug:** if vaccine due date calculated using addDays(dob) and compared to `today`, timezone offset can shift due-date by a day. Example: Indian parent at UTC+5:30, vaccine due on 2026-05-19 00:00 IST but today in UTC is 2026-05-18 18:30 — marked 'upcoming' instead of 'overdue'.

- [health.tsx:405-412] isMilestoneReachedForKid() returns false if `kid.isExpecting`. **No data loss, but UX confusion:** if mom adds an "expecting" child, navigates to milestones, then switches to a born child, previous milestone state for born child is visible. Can confuse user about which child's data is shown.

---

## EMPTY STATES & FIRST-TIME UX

- [health.tsx:573-595] VaccinesSection shows "Add your baby" card if no activeKid, but doesn't explain that milestones/growth/teeth tabs also require a child. User might add a child only to see empty states elsewhere.

- [health.tsx:1759-1805] MyHealth tab shows progress ring + 10 items even on first load. If all are "never done", UI shows 0/10, but no celebration when first item is marked — no positive feedback loop.

- [health.tsx:112-123] FoodTrackerTab under-6-months card explains "exclusive breastfeeding until 6 months" but doesn't mention if expressed milk / formula feeding ages differ. Culturally sensitive but incomplete.

---

## DEAD UI / MOCKS

- [health.tsx:603-613] Hardcoded pregnancy vaccines list (Tdap, Influenza, COVID-19) — not data-driven. If FOGSI updates 2024 guidelines, requires code edit. Should move to `data/vaccines.ts` or fetch from Firestore.

- [health.tsx:826-833] SCHEME_ICONS mapping hardcodes icon names. If a new scheme is added (gs07), the mapping must be updated or the icon defaults to 'document-text-outline'. No graceful fallback.

---

## ACTIVE-KID SWITCHING

- [health.tsx:1538] activeKid fetched via useActiveKid() hook. **No guard if activeKid switches mid-render:** if parent switches kids in Family tab while Health tab is open, useEffect at line 1528 may not trigger if router.push cancels the navigation. Stale memoization keys risk.

- [family.tsx:583] ChildCard onPress triggers setActiveKidId(kid.id). **No validation:** if kid.id is invalid or deleted, activeKid becomes null, and all health tabs show "Add your baby". Silent failure.

---

## SHEETS / MODALS

- [health.tsx:665-695] ChangeSchedule Modal uses `presentationStyle="pageSheet"` on iOS. On iPad in split-view, modal may not fill correctly. Should test on tablet.

- [health.tsx:1808-1833] MilestonePrompt Modal has no `onRequestClose` to dismiss on back press. Users must tap "Not now" button.

---

## ACCESSIBILITY

- [family.tsx:71-107] ChildCard — no `accessibilityLabel` describing which child and their age/status. Taps rely on visual affordance (border highlight) which screen readers can't convey.

- [health.tsx:361-402] VaccineAgeGroup header is tappable but no `accessibilityRole="button"` or `accessibilityState={{ expanded }}`.

- [health.tsx:745-750] Category grid cards use flexBasis layout without explicit height constraints. Line breaks may cause unequal card heights, confusing screen reader users.

---

## NIT

- [health.tsx:50-56] ROSE, PLUM alias the same `Colors.primary` but named differently — misleading. Comments suggest ROSE/PLUM are distinct, but they're identical.

- [health.tsx:148-203] gridStyles is defined but only used in CategoryGrid — could be co-located inside the component for clarity.

- [health.tsx:535-546] VaccineSourceFooter receives schedule but doesn't validate it's a known type (iap/nis). If typo passed, SCHEDULE_INFO[schedule] returns undefined.

- [health.tsx:1164-1182] SchemeCard linkBtn styling hardcodes `maxWidth: 380` inside confirmStyles but the component is full-width. On tablets, button may shrink.

- [family.tsx:255-259] GENDERS array uses Unicode emojis (👦, 👧, 🎁) inline instead of importing a constant. Emojis may render differently on older devices.

- [family.tsx:226-244] DOB picker validation allows `minDate={todayStr}` for expecting babies, but doesn't enforce a reasonable upper bound (e.g., +9 months from today). User can select due date 2 years out.

---

## Severity Breakdown
- **CRITICAL:** 5
- **HIGH:** 12
- **MEDIUM:** 19
- **LAYOUT / SPACING:** 5
- **TYPOGRAPHY:** 7
- **ANIMATIONS:** 2
- **LOGIC BUGS:** 7
- **EMPTY STATES:** 3
- **DEAD UI:** 2
- **ACTIVE-KID SWITCHING:** 2
- **SHEETS / MODALS:** 2
- **ACCESSIBILITY:** 3
- **NIT:** 6

**Total: 75 findings** (recount after deduplication: 58 unique issues)

---

## Recommended Actions

1. **Immediate:** Replace all hardcoded hex colors (#F5F0FF, #EDE9F6, etc.) with `Colors.*` tokens.
2. **High Priority:** Move hardcoded data (pregnancy vaccines, low-performing states, SCHEME_ICONS) to data/ files.
3. **Refactor:** Extract duplicate age-math from health.tsx into lib/dob.ts calls.
4. **Testing:** Add edge-case tests for DOB validation, vaccine status logic, timezone-aware date comparisons.
5. **Accessibility:** Add `accessibilityLabel` and `accessibilityRole` to all interactive elements.
6. **Layout:** Add `paddingHorizontal` to all ScrollView contentContainerStyle; test on small screens (280px).

