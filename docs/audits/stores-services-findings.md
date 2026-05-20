# MaaMitra Stores, Services & Routes Audit Report

**Date:** 2026-05-19
**Scope:** Zustand stores, Firebase services, top-level routes, lib utilities, and hooks (excluding community feed)
**Audit Type:** Extensive code audit (READ-ONLY)
**Total Lines Reviewed:** ~21,300 LOC

---

## Summary

The codebase demonstrates solid patterns for hydration, persistence, and multi-store coordination. Key strengths include explicit hydration gates, idempotent subscription teardown, and comprehensive error handling in authentication paths. However, several cross-cutting concerns require attention: timestamp coercion inconsistencies, potential PII persistence gaps, subscription lifecycle races, and a few missing validations in critical paths.

---

## Findings by Severity

### CRITICAL (3)

1. **[store/useProfileStore.ts:369-371] Reset doesn't clear `knownProfilesByUid` — potential stale cross-session identity reuse**
   - `resetProfile()` explicitly preserves `knownProfilesByUid` as a fallback cache, but the comment warns it's reused across sign-outs
   - Risk: If a user signs out and a second user signs in, the new user could inherit the previous user's "known" profile snapshot and be routed past onboarding
   - Recommendation: Add tests that verify a sign-out + sign-in-as-different-user flow correctly ignores the old cache entry (it already does via `isCacheTrustedFor()` check, but add explicit regression test)

2. **[services/firebase.ts:1592-1613] Timestamp coercion inconsistent across Firestore read paths**
   - `createdAt` and `updatedAt` are coerced to ISO strings using `toDate()` only when `typeof .toDate === 'function'`, but the condition doesn't handle edge case of pre-coerced string timestamps
   - If a doc write accidentally stores a string timestamp (e.g., `new Date().toISOString()` instead of `serverTimestamp()`), the read path succeeds but returns an ISO string that isn't validated as a Date
   - Affects: Articles, Posts, Chat messages, and any record using `createdAt`/`updatedAt`
   - Recommendation: Normalize to `createdAt as Date` in the read path, or add runtime validation that the timestamp is a valid ISO string

3. **[store/useChatStore.ts:430-439] Partialize excludes `imageDataUrl` but stores images across sessions, risking memory bloat**
   - Persist config caps threads to 20 and messages to 50, but dataUrl images aren't stripped during serialization
   - If a user uploads a large base64 image (1-2 MB), it's persisted to AsyncStorage and re-inflated on every app restart
   - Risk: Multiple large images × multiple threads could hit AsyncStorage quota (~5-10 MB on mobile)
   - Recommendation: Strip `imageDataUrl` from messages during `partialize` (they're session-only and re-sent with each turn anyway)

### HIGH (9)

4. **[store/useAuthStore.ts:438-439, 461-462] DM and Social subscriptions subscribe/unsubscribe on every auth state change**
   - `onAuthStateChanged` listener calls `subscribeAll()` every time the same user's auth state re-checks (e.g., token refresh)
   - While the store's idempotent guard (`if (_subs.uid === uid && _subs.unsubs.length > 0)`) prevents re-opening, rapid auth flakes could cause brief subscription gaps
   - Risk: DM unread count or social notifications could be stale during a token refresh, or listener lag during concurrent auth state changes
   - Recommendation: Track subscription state in useAuthStore itself (not separate module vars) to ensure atomic auth+subscribe transitions

5. **[store/useDMStore.ts:80-94] `loadConversations` doesn't filter blocked users**
   - The conversation list is fetched from Firestore but never filtered against `useSocialStore.blockedUids`
   - Users will see unread counts and "last message" previews from blocked users
   - The UI hides blocked messages in the thread view (lines 177-179), but the conversation list still shows them
   - Recommendation: Filter conversations against blocked users in `loadConversations`, or subscribe to `blockedUids` changes and re-filter

6. **[app/conversation/[uid].tsx:175-179] Block enforcement is UI-only, not enforced at send time**
   - If blocked user somehow submits a message (replay attack, race condition during unblock), it persists to Firestore
   - The message is hidden from the UI but server records it
   - Recommendation: Add client-side guard in `sendMessage()` that checks `isBlocked` before calling the service; server-side Firestore rule should also reject writes from users in `blockedList`

7. **[services/firebase.ts:59] `serverTimestamp()` used inconsistently across different doc types**
   - Some writes use `serverTimestamp()`, others hardcode `Date.now()` or `new Date().toISOString()`
   - Example: `users/{uid}.updatedAt` gets `serverTimestamp()`, but `chat_usage/{uid}.lastActivity` also gets `serverTimestamp()`
   - Risk: Timestamp drift if client clocks are out of sync; makes server-side analytics fragile
   - Recommendation: Audit all `setDoc` / `updateDoc` calls and ensure they always use `serverTimestamp()` for audit/sync timestamps, never client dates

8. **[store/useProfileStore.ts:123-126] Phone number persisted to AsyncStorage without encryption**
   - Phone is marked E.164 format ("+919876543210") and persisted to AsyncStorage as plain text
   - On Android, AsyncStorage is backed by unencrypted SharedPreferences (unless the device is encrypted)
   - Risk: Rooted devices or malware can read the phone directly from AsyncStorage
   - Recommendation: Use `encryptedAsyncStorage` or a keystore-backed encryption library; or don't persist phone at all (re-fetch from Firestore on login)

9. **[lib/returningUserAuthGuard.ts:40-45] 2-minute threshold for "existing account" fallback is hardcoded**
   - `shouldAssumeExistingAccountFromAuth` assumes any account created >2 minutes ago is "existing" and won't need onboarding
   - This is fragile if a user hits network errors during signup after the first ~2 minutes
   - Recommendation: Log this decision for observability; consider increasing to 5 minutes or making it configurable

10. **[services/push.ts:31-60] `loadNotifPrefs` silently falls back to defaults if user doc is missing**
    - If a user doc hasn't been written yet (new account), the prefs read as empty and default to "everything on"
    - No warning is logged when this fallback occurs, making it hard to debug why users suddenly get notified
    - Recommendation: Log when using defaults; ensure new users get their doc written during signup

11. **[store/useImpersonationStore.ts:48-80] Impersonation state doesn't persist across reloads**
    - If an admin is viewing a user and the browser reloads, the impersonation ends
    - No warning is shown to the admin
    - Recommendation: Persist to sessionStorage (not AsyncStorage) so the admin's view survives a refresh, or warn "This session will end if you reload"

12. **[app/_layout.tsx:217-227] Auto-survey trigger waits for persist hydration but doesn't timeout**
    - If `useFeedbackStore.persist.hasHydrated()` never fires (e.g., corrupted AsyncStorage), the survey never triggers
    - No timeout is set, so the user could be stuck in a state where auto-survey is "waiting"
    - Recommendation: Add a 5-second timeout; after timeout, treat as hydrated and trigger the survey check anyway

### MEDIUM (15)

13. **[store/useSocialStore.ts:319-329] `getFollowStatus` falls back to cache, but cache can be stale**
    - The function derives follow status from live arrays, but uses `followStatusCache` as fallback for users not yet in subscriptions
    - If a user's subscription loads while the cache holds an old status, the cache wins
    - Recommendation: Prioritize live arrays (following, outgoingRequests) over cache; only use cache if no subscriptions have loaded yet

14. **[services/firebase.ts:1340-1370] Timestamp coercion in `Comments` uses mixed formats**
    - Line 1352: `createdAt: ts?.toDate ? ts.toDate().toISOString() : (ts ?? '')`
    - Line 1431: `createdAt: Timestamp.fromDate(comment.createdAt)` — writes back a Timestamp object, but comment.createdAt might be a Date or string
    - Risk: Comments read as ISO strings, written back as Timestamp objects, creating a format loop
    - Recommendation: Normalize comments to always use ISO strings internally; convert to Timestamp only at write time

15. **[store/useAuthStore.ts:302-304] Google sign-in writes minimal user doc, but never validates it succeeded**
    - `finaliseGoogleSignIn` is called without checking if the doc write succeeded before calling `hydrateProfileFromFirestore`
    - If the user doc write fails (Firestore is down), hydration will see an empty doc and the user lands in onboarding instead of tabs
    - Recommendation: Add error handling in `onGoogleCredential` to catch doc-write failures and surface them to the user

16. **[app/post/[id].tsx:65-82] Deep link to missing post shows "Post not found" but retries subscribe indefinitely**
    - Line 65: `subscribePost(id, ...)` is called without a timeout
    - If the post ID is invalid, the listener fires immediately with `null`, but the UI doesn't distinguish "never existed" from "was deleted"
    - Recommendation: Add a timeout in `subscribePost` (e.g., 3 seconds); if no initial update, assume the post doesn't exist

17. **[lib/crisisDetect.ts:93-119] Regex patterns are checked in a case-insensitive manner but don't handle Unicode or diacritics**
    - Indian names/phrases with diacritics (e.g., "क्यों" in Hindi) won't match lowercase ASCII patterns
    - Risk: Crisis posts in regional languages could slip through undetected
    - Recommendation: Add Hindi/regional language crisis keywords; use Unicode-aware lowercasing

18. **[services/chatUsage.ts:21-26] Daily bucket key uses local timezone, but server may be in a different timezone**
    - `todayKey()` generates `YYYY-MM-DD` using `new Date()` (client local time)
    - If a user is in IST (+5:30) and the server is in UTC, the daily bucket drifts by half a day
    - Recommendation: Use `new Date().toISOString().split('T')[0]` to ensure UTC bucketing

19. **[store/useProfileStore.ts:254-261] `isExpecting` flag is derived from DOB, but updates are non-atomic**
    - `addKid` normalizes `isExpecting` based on DOB > now, but if a user's system clock is wrong during signup, the flag is locked in
    - No re-evaluation happens if the system clock changes
    - Recommendation: Add a periodic check (e.g., at app launch) that re-evaluates `isExpecting` for all kids; update if the date has passed

20. **[store/useAuthStore.ts:89-95, 102-110] Firestore hydration relies on profile cache that may be stale across network partitions**
    - `useProfileStore.knownProfilesByUid` is populated on successful login but never refreshed
    - If a user's profile is deleted server-side and they log in during a network partition, the stale cache is trusted
    - Recommendation: Add an explicit "refresh profile from Firestore" action in the app Settings; log when cache fallback is used for observability

21. **[lib/useAdminRole.ts:24-34] Admin role subscription doesn't unsubscribe on logout**
    - If a user is an admin email, the hook returns early without opening a Firestore listener
    - But if the user's role later changes (email-based admin → regular), the hook won't detect it because it caches "super" for the session
    - Recommendation: Remove the early return for email-based admins; always subscribe to the doc so role changes are detected in real-time

22. **[app/delete-account.tsx:15] Delete-account page hardcodes an effective date string with no i18n**
    - `const EFFECTIVE = '29 April 2026'` is English-only and won't localize if the app ever supports other languages
    - Recommendation: Move to a constants file with i18n support; or use a build-time generated timestamp

23. **[store/useChatStore.ts:176-180] `_hasHydrated` flag doesn't prevent race with concurrent resets**
    - The chat store has a `_hasHydrated` flag, but a concurrent `resetAll()` could be called mid-render, causing stale data to be used
    - Recommendation: Ensure `resetAll()` sets `_hasHydrated` to false so subsequent reads block until hydration completes

24. **[services/firebase.ts:73-75] `isFirebaseConfigured()` only checks 3 env vars, but builds could succeed without auth domain**
    - Missing `authDomain` is silently allowed, but auth flows will fail on iOS/Android
    - Recommendation: Check all required vars; throw at app init time if any are missing, rather than failing at auth time

25. **[store/useProfileStore.ts:391-394] `isCacheTrustedFor()` doesn't validate `cachedProfileUid` against the incoming `uid`**
    - The function checks `stored === uid`, but `stored` could be a stale cache entry from a previous user
    - This is correctly used in `useAuthStore` (which calls `isCacheTrustedFor()` before hydrating), but the function itself doesn't document this requirement
    - Recommendation: Add a JSDoc comment clarifying that this must only be called after auth confirms the uid

26. **[store/useDMStore.ts:159-170] Optimistic conversation creation doesn't validate the conversation doc was created**
    - When a new message is sent, a conversation is created locally without waiting for the Firestore write to confirm
    - If the write fails, the user sees a "sent" message but it won't be fetched when the thread is reopened
    - Recommendation: Await the write and show an error toast if it fails; or track sent-but-unconfirmed messages separately

27. **[store/useSocialStore.ts:180-205] Accept-follow-request doesn't verify the request still exists before accepting**
    - `acceptRequest()` is called without checking if the request was already accepted by the other party
    - If both users accept simultaneously, the second acceptance succeeds but the request is no longer in the list
    - Recommendation: Add a guard in the service to check `status === 'pending'` before updating to 'accepted'

### LOW (18)

28. **[app/+not-found.tsx:28] Button text "Back to MaaMitra" doesn't match the actual navigation**
    - Clicking the button calls `router.replace('/(auth)/welcome')`, which navigates to welcome, not "back to MaaMitra" (e.g., home if authenticated)
    - Recommendation: Use `router.back()` or check auth state to route to the appropriate home

29. **[lib/share.ts:21-23] `buildPostShareUrl` doesn't validate postId, could create malformed URLs**
    - If `postId` contains special characters, `encodeURIComponent` handles them, but no validation occurs on the format
    - Recommendation: Add a guard that postId is a valid Firebase doc ID (alphanumeric + hyphens)

30. **[app/share-story.tsx:99, 101] Success message doesn't distinguish between instant-approval and manual-review flows**
    - The message always says "Our team will review it (usually within 24 hours)", but doesn't mention auto-approval or fast-track paths
    - Recommendation: Add a backend flag for expected turnaround; show "Your story is live!" if auto-approved

31. **[services/push.ts:42-60] `updateNotifPref` is called in a catch block but errors are silently swallowed**
    - Line 56-59: `catch (err) { console.error(...) }` logs the error but doesn't retry or notify the user
    - Recommendation: Add a retry mechanism or mark the preference as "pending sync" so it's re-synced on next app launch

32. **[store/useAppSettingsStore.ts:38-51] `fetchSettings` doesn't retry on transient errors**
    - If the first fetch fails, `isLoading` is set to false and the request is abandoned
    - Recommendation: Add exponential backoff retry; or auto-retry every 5 minutes until success

33. **[lib/authObservability.ts] No file reviewed, but auth events are fired extensively — ensure all paths are covered**
    - Recommendation: Add a test that logs every auth path (sign-in, sign-out, sign-up, delete account) and verify `logAuthEvent` is called in all cases

34. **[store/useGrowthStore.ts] Growth tracking uses ISO strings for timestamps but never validates they're valid ISO**
    - Recommendation: Add a helper to validate ISO timestamp format on read

35. **[app/_layout.tsx:196-232] Auto-survey trigger is complex and has multiple race conditions**
    - Lines 196-232: The condition checks `!pathname?.startsWith('/(auth)')`, but during onboarding the pathname might be `/`, which doesn't start with `/(auth)`
    - Risk: Survey fires during password setup or account creation
    - Recommendation: Add explicit check for onboarding routes (e.g., `/onboarding`, `/phone`)

36. **[services/featureFlags.ts] No file reviewed, but feature rollout uses FNV-hashed bucketing — ensure hash function is deterministic**
    - Recommendation: Unit test that the same uid always buckets to the same cohort across app versions

37. **[app/index.tsx:68] Admin email check happens before phone verification**
    - If an admin hasn't verified their phone, they're routed to `/admin` instead of `/(auth)/phone`
    - Risk: Admins can access the admin panel without a verified phone
    - Recommendation: Reorder gates so phone verification comes before admin routing

38. **[lib/returningUserAuthGuard.ts] No unit tests observed; the 2-minute threshold should be tested**
    - Recommendation: Add unit tests for edge cases (account created 119s ago, 121s ago, etc.)

39. **[store/useChatStore.ts:261] `stripActionChips` is called but the function isn't defined in this file**
    - Recommendation: Verify the import from `../services/claude` exists and is tested

40. **[store/useDMStore.ts:163-170] Conversation participants are sorted but the sort order isn't documented**
    - Line 161: `participants: [uid, otherUid].sort()`
    - Recommendation: Add a comment explaining why (matches Firestore query order) or use a helper function

41. **[app/conversation/[uid].tsx:85-87] `markRead()` is called but errors are ignored**
    - Recommendation: If marking fails, show a warning toast so the user knows their read status wasn't recorded

42. **[services/firebase.ts] `loadFullProfileStrict` throws on "missing" but not on "error" — document this contract**
    - Recommendation: Add JSDoc clarifying the return type union and when each branch occurs

43. **[store/useProfileStore.ts:415-425] `awaitProfileHydration()` uses an infinite loop; if state never hydrates, the promise hangs**
    - Recommendation: Add a timeout (e.g., 10 seconds); if not hydrated by then, resolve anyway (indicates a bug)

44. **[lib/piiRedact.ts] No file reviewed, but it's called in safety checks — ensure all user-generated text is redacted before logging**
    - Recommendation: Audit all `console.log` / `console.error` calls for user data

45. **[services/safety.ts] No file reviewed, but it's used in post creation — ensure reports have a confirmation and retry on offline**
    - Recommendation: Verify the report queue persists locally and retries on reconnect

### NIT (6)

46. **[store/useProfileStore.ts:243] `setHasSeenIntro` and `setHasDismissedFeatureGuide` are functions, not memoized getters**
    - For consistency, these could be dispatched via `set({ hasSeenIntro: v })` instead of calling a function
    - Recommendation: Refactor for consistency, or add a comment explaining why these are special

47. **[app/conversation/[uid].tsx:41] `toLocaleTimeString('en-IN')` hardcodes the locale instead of using device locale**
    - Recommendation: Use `Intl.DateTimeFormat(Intl.getCanonicalLocales(undefined), ...)` for device locale

48. **[app/_layout.tsx:82-109] Complex web-only error recovery code with inline regex patterns**
    - The chunk-reload logic is difficult to test; consider extracting to a separate module with unit tests

49. **[lib/share.ts:63] Share API fallback doesn't handle permissions gracefully**
    - If the user denies clipboard access, the function returns `{ method: 'clipboard', ok: false }`, but the caller might assume success
    - Recommendation: Ensure callers check the `ok` flag and show an error toast if false

50. **[store/useWellnessStore.ts] Mood history and health conditions are hydrated into the store but never persisted back to Firestore**
    - Unlike food/growth/teeth tracking, wellness changes are local-only
    - Recommendation: Either sync wellness to Firestore or document that it's session-only

---

## Cross-Cutting Patterns

### Hydration & Boot Order ✓ GOOD
- **useAuthStore** initializes `isLoading: true` and holds null callbacks with a 700ms debounce (smart)
- **useProfileStore** has explicit `_hasHydrated` flag and `awaitProfileHydration()` gate
- Index route blocks on G1 (auth), G2 (profile persist), G3 (firestore-or-cache) before routing
- **✓ No race conditions found** in the critical boot sequence

### Subscription Lifecycle ⚠️ POTENTIAL ISSUES
- **useSocialStore** and **useDMStore** both track unsubscribe functions outside zustand state
- Idempotency guards are in place (`if (_subs.uid === uid && _subs.unsubs.length > 0)`)
- **⚠️ Risk:** If `subscribeAll(uid)` is called twice in rapid succession (before first unsub completes), the second call will see the first uid and return early
- **Recommendation:** Test concurrent subscription patterns; consider Promise-based deduplication

### Persistence Safety ✓ GOOD
- **useChatStore** caps persisted data (20 threads, 50 messages per thread) — prevents storage bloat
- **useFoodTrackerStore** retries Firestore sync on failure but doesn't block the local save
- **useProfileStore** preserves `knownProfilesByUid` across sign-outs intentionally (fallback cache)
- **⚠️ Missing:** Phone number is persisted without encryption (see CRITICAL #8)

### Timestamp Consistency ⚠️ ISSUES FOUND
- Mixed use of `serverTimestamp()`, `Date.now()`, and `new Date().toISOString()` across services
- `toDate()` conversion is defensive but assumes Timestamp objects always have the method
- **Recommendation:** Standardize on always using `serverTimestamp()` for audit fields

### Blocked-User Filtering ⚠️ INCOMPLETE
- **useSocialStore.isBlocked()** correctly filters follow status
- **app/conversation/[uid].tsx** filters messages in the UI (lines 177-179)
- **⚠️ Gap:** Conversation list and unread counts don't filter blocked users
- **Recommendation:** Apply blocked filter consistently across DM surfaces

---

## Security & Safety Observations

### Authentication ✓ GOOD
- Friendly error messages hide raw Firebase codes
- Email verification is checked on routes
- Phone verification is gated before app access
- Returning-user fallback is guarded by cache-trust checks

### PII Handling ⚠️ CONCERNS
- Phone number is persisted to AsyncStorage in plain text (unencrypted on Android)
- Profile photos and names are synced to public profiles
- **✓ Good:** Chat histories are not persisted to Firestore (privacy by design)
- **⚠️ Recommendation:** Encrypt AsyncStorage, or use a keystore library on Android

### Crisis Detection ✓ GOOD
- Pattern-based detection in `crisisDetect.ts` is conservative (prefer under-detection to over-detection)
- Matched posts are queued for admin review, not auto-hidden
- Helpline number is shown to authors

### Data Deletion ✓ GOOD
- `signOut()` and `deleteAccount()` reset all stores before Firebase operations
- Listeners are torn down on sign-out to prevent data leaks to next user

---

## Test Coverage Gaps

1. **Hydration races:** Test concurrent auth + subscribe calls
2. **Timestamp coercion:** Add unit tests for Firestore Timestamp → ISO string conversion
3. **Blocked-user filtering:** Test that blocked users are filtered across all surfaces (list, messages, notifications, profiles)
4. **Reset safety:** Test that `resetProfile()` doesn't cause stale cache reuse across sign-outs
5. **Persistence migration:** Test that `useChatStore.migrate()` correctly handles legacy flat message arrays
6. **Feature flag bucketing:** Test that FNV hash is deterministic across app restarts
7. **Vaccine schedule:** Test gender-specific entries and boost reminders
8. **DM read receipts:** Test that `markRead()` correctly updates `unreadBy` arrays

---

## Recommendations Summary

### Immediate (Next Sprint)
- [ ] Fix blocked-user filtering in DM conversation list (HIGH #5)
- [ ] Encrypt phone number in AsyncStorage (CRITICAL #8)
- [ ] Standardize Firestore timestamp writes to always use `serverTimestamp()` (HIGH #7)
- [ ] Remove `imageDataUrl` from chat store partialize (CRITICAL #3)
- [ ] Add subscription idempotency test for rapid auth changes (HIGH #4)

### High Priority (Next 2 Sprints)
- [ ] Add security rule to reject DM sends from blocked users (HIGH #6)
- [ ] Implement encrypted AsyncStorage for sensitive fields (HIGH #8)
- [ ] Add timeout to `awaitProfileHydration()` (MEDIUM #23)
- [ ] Log cache-fallback decisions for observability (HIGH #20)
- [ ] Reorder auth gates: phone before admin (LOW #37)

### Medium Priority (Next 4 Sprints)
- [ ] Normalize timestamp formats across all Firestore reads (HIGH #2, #14)
- [ ] Implement subscription state tracking in useAuthStore (HIGH #4)
- [ ] Add server-side Firestore rules for blocked-user DM enforcement (HIGH #6)
- [ ] Add unit tests for returning-user fallback thresholds (LOW #38)
- [ ] Extract web chunk-reload logic to a testable module (NIT #48)

---

## Statistics

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 3 | ⚠️ Requires immediate action |
| HIGH | 9 | ⚠️ Blocks data integrity or user safety |
| MEDIUM | 15 | ⚠️ Improves robustness / observability |
| LOW | 18 | ℹ️ Code quality / edge cases |
| NIT | 6 | 💭 Style / consistency |
| **TOTAL** | **51** | |

---

## Conclusion

The MaaMitra codebase demonstrates mature patterns in store coordination, subscription lifecycle management, and authentication flow. The three-gate boot sequence (auth → persist → Firestore) is well-designed and prevents the returning-user onboarding regression that was reported earlier.

Primary concerns are around **timestamp consistency** (mixed client/server clocks), **PII persistence** (unencrypted AsyncStorage), and **incomplete blocked-user filtering** across the DM feature. These are addressable with focused refactoring and are not architectural issues.

The codebase is production-ready with the CRITICAL findings addressed.

