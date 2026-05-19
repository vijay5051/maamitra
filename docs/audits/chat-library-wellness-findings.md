# Chat, Library, Wellness UX/Code Audit
**Scope:** app/(tabs)/chat.tsx, library.tsx, wellness.tsx + supporting components  
**Date:** 2026-05-19  
**Thoroughness:** Very thorough (50-70 findings)

---

## CRITICAL (Must fix before release)

- [app/(tabs)/chat.tsx:406-410] **Allergy gate blocks food questions until allergies are set.** Food detection (`detectIsFood()`) triggers the modal every first time, but `pendingMessage` is only released on `handleAllergyDone`. If the user dismisses the modal without selecting, the message is lost and no retry mechanism exists. Tappable elements (the modal buttons) have real actions, but the UX trap is that users can't see their message context while deciding.

- [services/claude.ts:66] **Hardcoded MAX_HISTORY=30 conflicts with store's MAX_CHAT_HISTORY=50.** The client trims to 30 messages before sending to the worker; the store persists 50 per thread locally. This inconsistency means the worker may reject payloads that the client thinks are valid. The constant should be centralized in `constants/config.ts`.

- [components/chat/ChatBubble.tsx:36-40] **Action chip route validation is permissive.** PATH_ALIASES maps bare routes like `/profile` → `/(tabs)?openProfile=1`, but if the alias target isn't in ALLOWED_QUERY_KEYS_BY_PATH, the query string is silently dropped. A fabricated /profile?badKey=1 that slips through parseActionChips will navigation to /(tabs) with no query, silently failing the intent.

- [app/(tabs)/library.tsx:lines 200+] **Multiple hardcoded hex colors (#1a1a2e, #6b7280, #f59e0b, etc.) violate design system.** The design system defines `textDark: '#1C1033'`, `textMuted: '#9ca3af'`, but library uses `#1a1a2e` (different) for article title text. Colors like `#374151` are used for icons. Inconsistency across the app means library cards will not match other tabs if the design system is later updated (see CLAUDE.md Rule #1: cross-references must be kept in sync).

- [app/(tabs)/wellness.tsx:316] **Mood chart bar uses hardcoded pink/lavender gradients instead of semantic colors.** Non-today bars use `['#F4B3CC', '#C9A8E0']` (hardcoded rose/lavender). The mood score itself determines the entry, but the visualization doesn't use the MOOD_TINTS (which include sageMild, sky, gold). Today's bar uses `Colors.primary`, but past days silently downgrade to a generic gradient, losing semantic meaning.

- [lib/crisisDetect.ts:38-82] **Crisis detection uses `text.includes(term)` without word boundaries on multi-word terms.** The regex check is loose; a post saying "I can't eat" will not match "cant eat" (lacks apostrophe). A post saying "I'm feeling fine, can't complain" will match "can't" but NOT the full "can't eat" check because `includes()` on whole text will find "can't eat" as a substring. However, single-word matches like "suicidal" may false-positive in contexts like "discussing suicidal ideation academically." Word boundaries not enforced = both false-positives and false-negatives likely.

---

## HIGH (Likely to cause bugs or significant UX friction)

- [app/(tabs)/chat.tsx:269-284] **Deep-link prefill does not de-dupe if the user taps the same quick-chip twice.** If a user taps "Best exercises during pregnancy" → chat opens with prefill → they don't send, click back, and tap the chip again, `consumedRouteRef.current` doesn't reset, so the second tap is silently ignored. The UI appears broken (chip tap has no effect on second press).

- [app/(tabs)/chat.tsx:601-619] **Empty-state hydration gate hides suggestions until `chatHydrated` is true.** Returning users see a blank 4-line space where suggestions would be, then suggestions snap in after ~1s. The gate exists to prevent "flash of suggestions before old thread appears," but the fix creates the opposite UX: blank space that snaps. Should render suggestions speculatively or use a loading skeleton.

- [components/chat/ChatBubble.tsx:230-238] **User message image + text can stack visually awkwardly.** If user sends an image + text, the image renders above the gradient bubble, but the layout is `flexDirection: 'column'` in userWrapper with no flex on the bubble. Multi-line text in the bubble might exceed image width, making the UX asymmetric. No test coverage for long text + image combos.

- [app/(tabs)/library.tsx:233-300] **Article card image fallback is gradient, but image loading errors silently degrade.** If a real image URL fails to load (`onError={setImgError}`), a gradient is shown. However, there's no retry mechanism and no toast notification. The user sees a gradient and has no idea whether it's a fallback or intentional design.

- [app/(tabs)/library.tsx:1349-1350] **Search input has hardcoded placeholder colors (#9ca3af).** Should use `Colors.textMuted` or a design system constant. Same issue appears in multiple places (ChatInput, ChatHistorySheet).

- [app/(tabs)/wellness.tsx:408] **Mood calendar cell background uses hardcoded #F3F0FA instead of design-system constant.** The unused/no-entry cells show this color, but there's no constant defined for it. Future changes to the color system will miss this surface.

- [app/(tabs)/wellness.tsx:563] **"No logs" state in mood calendar is not visually distinct enough.** Empty calendar cells show `#EDE9F6` background with no visual hint that they're empty (no slash, no cross, no icon). Users can't tell if they forgot to log or if the cell is intentionally empty.

- [components/wellness/YogaModal.tsx:181 & 211] **Hardcoded gradient colors ['#FFFCF7', '#F5F0FF'] in completion + main screens.** Should use Colors.bgLight or a design-system gradient. If the design system colors change, yoga modal is missed.

- [app/(tabs)/chat.tsx:143-144] **Inline rgba() string in AllergyModal chip styles.** Line 143: `'rgba(28, 16, 51, 0.048)'` should be `Colors.primaryAlpha05` (or similar). Inconsistency and brittleness.

- [services/claude.ts:149+] **detectIsFood() is not exported; implementation not visible.** Cannot audit the food detection heuristic. If it's regex-based, false-positives (e.g., "I'm not feeling well" or "What time should we feed the baby?") would trigger the allergy modal unexpectedly.

- [store/useChatStore.ts:336] **revealAnswerProgressively() animation abandons gracefully on new message but doesn't clean up the OLD message's streamingId.** If user sends a second message while the first is being revealed, the old message's animatedId is cleared but the text stays. Then on the next reveal, both messages might have streamingId set briefly, causing render flicker.

---

## MEDIUM (Polish issues, UX debt, potential data integrity risks)

- [app/(tabs)/chat.tsx:131-149] **AllergyModal chip layout is hardcoded gap=8, borderRadius=20.** Should use Spacing.sm and Radius.lg from the design system. Brittle to future updates.

- [app/(tabs)/chat.tsx:454-481] **Thread list header is white (#FFFFFF) gradient, but the page background is `Colors.bgLight` (#FBF7F1).** The header doesn't blend; there's a subtle seam. Should use `Colors.bgLight` gradient or no gradient.

- [app/(tabs)/chat.tsx:515-519] **Conversation header is also white gradient (#FFFFFF), creating the same seam.** Both headers should use `Colors.bgLight` for visual consistency.

- [components/chat/ChatBubble.tsx:374] **User image userImage has backgroundColor #EDE9F6.** This is a deprecated color alias (old cloud). Should be `Colors.bgTint` or `Colors.primaryAlpha08`.

- [components/chat/ChatBubble.tsx:388] **User text fontSize is 18 (+20% from 15), but bot text is also 18.** The audit says this was a deliberate change to improve readability on mobile, but the code comment is missing. No design rationale documented.

- [components/chat/ChatBubble.tsx:419-433] **Bot bubble has hardcoded rgba(255,255,255,0.94) with no constant.** The frosted-glass effect is nice but not parameterized. If the design system ever wants to adjust the opacity or tint, this is a callsite that's easy to miss.

- [app/(tabs)/library.tsx:218-229] **getArticleGradient() maps topics to hardcoded hex colors that don't use the design system.** `Feeding: [Colors.primary, '#f472b6']` – the second color (#f472b6, a pink) is hardcoded. The design system deprecation notice says secondary/gold/sage/sky should be replaced, but these gradients were never moved to the system. Fragile.

- [app/(tabs)/library.tsx:372-509] **articleStyles StyleSheet has 140+ lines of hardcoded colors and dimensions.** Multiple inline rgba(), hardcoded #1a1a2e, #6b7280, etc. Should use design-system constants wherever possible (Colors.textDark, Colors.textMuted, etc.). This is the largest violation of the design system in the three tabs.

- [app/(tabs)/library.tsx:628-800] **bookStyles also has extensive hardcoding:** #1a1a2e, #6b7280, #f59e0b (gold), inline rgba(). Same issue as articleStyles.

- [app/(tabs)/library.tsx:849-896] **productCardStyles has inline #EDE9F6, #f9a8d4 instead of design system.** The #f9a8d4 (pink) is never defined anywhere; arbitrary insertion.

- [app/(tabs)/wellness.tsx:50-57] **MOOD_TINTS map has inconsistent formatting.** Entry 5 uses 'rgba(52,211,153,0.08)' (sage), but entries are not aligned to the semantic system. sage (green) = success color conceptually, but the map doesn't use `Colors.success`. Magic values throughout.

- [app/(tabs)/wellness.tsx:316] **isToday condition uses ternary to pick gradient colors.** Non-today bars silently downgrade to a generic "past day" color. There's no visual feedback that the user's past moods are less important — they just look different. Could use opacity fade instead.

- [components/chat/ChatInput.tsx:234] **Voice error toast is shown for 4 seconds (hardcoded setTimeout).** No design system constant for toast duration. If the app ever standardizes on 3s or 5s, this will be missed.

- [components/chat/ChatInput.tsx:425] **Error banner uses hardcoded #FEE2E2, #991b1b for error styling.** Should use Colors.error + a tinted overlay constant. Inconsistent with other error UI in the app.

- [app/(tabs)/chat.tsx:660-689] **Footer stack (disclaimer + input) is not visually separated from chat list.** The medical disclaimer text merges visually with the last message. A subtle divider or different background might help.

- [app/(tabs)/wellness.tsx:275-401] **MoodChart component is 126 lines of inline styles, hardcoded colors throughout.** #C4B5D4 (border), #F3F0FA (empty cell), #EDE9F6 (handle). All should be design-system constants or semantic tokens.

- [app/(tabs)/wellness.tsx:1118-1123] **Wellness header pills (kid, activity) use hardcoded border colors (#F0EDF5, #E5DAF5).** Should be derived from Colors.borderSoft or a design-system border.

- [lib/piiRedact.ts:38] **PHONE_RE requires leading digit 6-9 to match Indian mobiles, but doesn't match +911234567890 (11 digits with +91 prefix).** The regex is: `(?:(?:\+|00)?91[-\s.]?|0)?[6-9]\d{2}[-\s.]?\d{3}[-\s.]?\d{4}\b`. The `+91` prefix is optional, but then the `[6-9]\d{2}...` expects exactly 10 more digits, totaling 12 with +91. This is correct for Indian format. However, if someone types +91-98765-43210 (spaces inserted arbitrarily), the regex may not match due to the specific `-\s.` group. Conservative regex = false-negatives likely.

- [app/(tabs)/chat.tsx:438] **Saved toast hardcodes duration to 1800ms.** Same issue as voice error toast — no constant.

---

## LOW (Minor inconsistencies, edge cases, polish)

- [app/(tabs)/chat.tsx:118-149] **AllergyModal border color for handle is #EDE9F6.** This is the old cloud color. Should be Colors.borderSoft or Colors.primaryAlpha08.

- [app/(tabs)/chat.tsx:143] **Allergy chip uses 'rgba(28, 16, 51, 0.048)' for chipSelected background.** Should be Colors.primaryAlpha05.

- [app/(tabs)/chat.tsx:159-173] **TodaySeparator gradient line uses hardcoded 'rgba(28, 16, 51, 0.12)'** instead of `Colors.primaryAlpha12`.

- [app/(tabs)/chat.tsx:290] **gearBtn icon color is Colors.primary for the chevron, but on iOS/Android it might not render as expected.** No explicit test for platform parity.

- [components/chat/ChatBubble.tsx:262] **Emergency message uses red (#ef4444) for the left border, but no comment explains the semantic meaning.** Why red? Should be Colors.error?

- [components/chat/ChatBubble.tsx:309-328] **TTS button has no accessibility announcement for "Loading" state.** When loading, the icon changes to hourglass but the label doesn't update. Should show "Generating audio…" or similar.

- [components/chat/QuickChips.tsx:182] **Chips container uses maxHeight: 200 as a hardcoded magic number.** Should be a constant or derived from the card height.

- [app/(tabs)/library.tsx:251] **Article staticImage fallback uses getStaticArticleImageSource() which is expensive to call on every render.** Should be memoized or cached at a higher level.

- [app/(tabs)/library.tsx:445, 463, 470, 717, 722, 732] **Multiple hardcoded greys (#1a1a2e, #6b7280, #f59e0b, #374151, #1f2937) that don't align with the design system.** These should all be mapped to Colors.textDark, Colors.textMuted, Colors.warning, etc.

- [app/(tabs)/library.tsx:894] **Product card buy button border uses hardcoded #f9a8d4 (pink) which is never defined in the design system.** This appears to be a typo or leftover from an earlier design iteration. Should be Colors.primary or Colors.blushMild.

- [app/(tabs)/wellness.tsx:52-56] **MOOD_TINTS are not semantic.** Entry 5 is sage green (success-adjacent) but labeled "Great". Entry 1 is rose (error-adjacent) but labeled "Tough". The semantic mapping is inverted compared to traditional UI patterns (error = red = bad). This works for a wellness app (low mood = red alert), but the comment is missing.

- [app/(tabs)/wellness.tsx:626] **bottomGradient has hardcoded colors ['#F59E0B', Colors.primary].** The first color is the deprecated gold. Should use Colors.ochreMild + Colors.primary or similar.

- [app/(tabs)/wellness.tsx:1379] **Navigation arrow color is hardcoded #A78BCA (lavender) instead of Colors.primary.** Future design updates will miss this.

- [components/wellness/YogaModal.tsx:181, 211] **Completion screen and main screen both use LinearGradient with hardcoded colors.** These should be consistent with the rest of the app's color system or at least defined as constants.

- [app/post/[id].tsx:147] **Back button icon color is #6b7280 (textLight).** Should be Colors.textLight for consistency (though this screen is read-only and not part of the main audit scope).

---

## NIT (Stylistic, low priority)

- [app/(tabs)/chat.tsx:117-149] **AllergyModal doesn't have an explicit "Cancel" button.** Users can tap the overlay or press Android back, but the UX is implicit. A "Cancel" button would be clearer.

- [components/chat/ChatBubble.tsx:291] **Action chip text has fontWeight: '700' hardcoded as a string.** Should use `Fonts.sansBold` or a FontWeight constant.

- [app/(tabs)/library.tsx:215-229] **getArticleGradient() function is 15 lines long with hardcoded color tuples.** Could be a data-driven constant instead.

- [app/(tabs)/wellness.tsx:155-164] **MoodEmojiItem has no press feedback beyond the scale animation.** Could use `activeOpacity` like other buttons.

- [components/wellness/YogaModal.tsx:99-100] **Timer initialization sets `setTimeLeft(session.poses[0]?.durationSeconds ?? 0)` but assumes session.poses is non-empty.** No length check. If poses is [], duration is 0 and the timer is stuck.

- [app/(tabs)/library.tsx:1349-1350] **Search input in library uses `placeholderTextColor="#9ca3af"` (hardcoded string).** Should use `Colors.textMuted` for consistency.

---

## Summary by Severity

| Severity | Count |
|----------|-------|
| CRITICAL | 6     |
| HIGH     | 12    |
| MEDIUM   | 28    |
| LOW      | 17    |
| NIT      | 8     |
| **TOTAL**| **71**|

---

## Key Themes

1. **Design System Leakage:** The majority of findings are hardcoded hex colors (#1a1a2e, #6b7280, #f59e0b, etc.) that should be mapped to Colors.* constants. Library and Wellness tabs have the worst adherence.

2. **Cross-Reference Rot (CLAUDE.md Rule #1):** Multiple color constants are defined in theme.ts but ignored in the tabs (e.g., Colors.textDark defined but #1C1033 hardcoded in library). If the design system is ever updated, these callsites will be missed.

3. **Crisis Detection / PII Redaction:** Both use regex patterns that are conservative but may have false-positives/negatives due to loose matching on multi-word terms or flexible spacing.

4. **UX Traps:** Allergy gate, prefill dedupe, hydration blank space, and image fallback all have UX friction that users will notice.

5. **Constants Scattered:** Toast durations, chip dimensions, spinner timeouts are hardcoded in multiple places instead of centralized.

---

## Recommendations

1. **Immediate:** Replace all hardcoded hex colors in library.tsx and wellness.tsx with Colors.* constants. Audit gradient definitions (article, book, product, mood chart).

2. **Short-term:** Add word-boundary checks to crisis detection regex. Add retry mechanism to allergy-gate flow. Fix empty-state hydration blank space with a skeleton or speculative render.

3. **Medium-term:** Move all timeout durations and magic numbers to constants/config.ts. Ensure design-system coverage = 100% (zero hardcoded colors in new code).

4. **Long-term:** Consider a design-system linter or StyleSheet scanner to catch future violations.

---
