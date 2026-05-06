# Handoff state

> **Read this first** when starting any session. It tracks what's
> in flight so a different agent (Claude / Codex) can resume without
> re-asking the user.

---

## Active task
No active coding task.

---

## Last action (2026-05-07) — Renamed "Real Story" → "Inspired Story" tag

**Commit `27f69c3` · functions deployed · hosting deployed · OTA `3fa21cb0` published.**

Why: today's UGC pipeline is wired but unused — every published "Real Story" is
AI-composed with attributed personas. Calling them "Real Stories" misled readers.
"Inspired Story" keeps warmth and signals composition without claiming a real
author. Real-mom UGC (when it lands) drops into the same pillar.

### What changed (user-visible only)
- Admin: template picker label, Settings → Template Preview tab + eyebrow,
  UGC queue description + render-button text.
- Pillar: `'Real Stories'` → `'Inspired Stories'` (label only; **id stays
  `real_stories`** so existing drafts/seasonal calendar don't break).
- Cloud Functions: text rendered ON post images (`Inspired Story · …`),
  draft `themeLabel`, caption `headline`, IG/FB hashtag (`RealStories` →
  `InspiredStories`).
- Compiled `functions/lib/*.js` mirrored.

### Deliberately NOT renamed (Firestore-persisted identifiers)
- Template key `'realStoryCard'`
- Pillar id `'real_stories'`
- Type/file names (`RealStoryCardProps`, `realStoryCard.ts`)

---

## Last action (2026-05-06) — Editable post time (slot + per-day weekly rhythm)

**Commit `0dd9b4c` · functions deployed · hosting deployed · OTA `26e7e803` published.**

### What changed
- **`app/admin/marketing/planner.tsx`** — `AutomationSlotsEditor` rewritten with
  local state + `onBlur` flush for the text inputs (slot **Label** and **Time**).
  The previous pattern called `onChange(slots)` on every keystroke, which
  triggered a parent re-render that wiped the input focus mid-typing. Chip
  toggles (platforms, frequency, on/off) still flush immediately. Add/Delete
  also persist immediately. WeeklyRhythmEditor gains an optional **Post time
  (HH:MM)** field per weekday — when set, overrides the slot time for drafts
  on that weekday.
- **`lib/marketingTypes.ts`** — `ThemeForDay.postTime?: string` (HH:MM).
- **`services/marketing.ts`** — `sanitiseThemeCalendar` validates `postTime`
  with `/^[0-2]\d:[0-5]\d$/` and drops it otherwise.
- **`functions/src/marketing/generator.ts`** — both today and tomorrow paths
  in the cron pick `theme.postTime` (if valid) before falling back to
  `slot.time` / `data.defaultPostTime`. Compiled JS in
  `functions/lib/marketing/generator.js` regenerated.

### Pre-existing TS errors (NOT introduced here, NOT blocking — esbuild builds)
- `services/marketing.ts:825-826,834-835` — `previewScheduledSlot` references
  `override` before the `.map()` callback that declares it. Likely a runtime
  ReferenceError on first call; "Tomorrow's auto-post" card on the Today tab
  may have been silently broken since the brand-kit-cronOverrides shape
  changed. **Worth a fix-up.**
- `app/admin/marketing/settings.tsx` — missing imports for `TextInput`,
  `ScheduledSlotPreview`, `AutomationSlot`. The Settings page still loads
  (esbuild lets the implicit any pass), but anything inside the missing-import
  branches will crash at runtime. **Check before next settings change.**
- `app/admin/marketing/preview.tsx:40` — `realStoryCard` missing from the
  `Record<RenderableTemplateName, TemplatePreset>` map. Means the preview
  tool can't render that card variant.

---

## Last action (2026-05-06) — Silent-swallow sweep + field-ownership doc

Companion cleanup to today's three social-flow bugs (post vanishing,
follow-accept reverting, follower-counter wiping). Removes the bug
class structurally — every write path now surfaces real errors instead
of silently lying about success.

### Silent-swallow rethrows (was: catch → console.error → return void)

- **`services/firebase.ts`** — `saveUserProfile`, `syncCompletedVaccines`,
  `syncHealthTracking`, `syncTeethTracking`, `syncFoodTracking`,
  `syncGrowthTracking`, `syncWellnessData`, `syncAllergies` now rethrow
  on failure. Awaited callers (SettingsModal, phone.tsx, useThemeStore,
  index.tsx) already had try/catch — no caller change required.
- **`services/social.ts`** — `cancelFollowRequest`, `unfollowUser`,
  `markNotificationRead`, `markNotificationRequestStatus`,
  `deleteNotification`, `deleteNotifications`, `markAllNotificationsRead`
  now rethrow. Store callers already had try/catch around them.

### Fire-and-forget call sites that lacked `.catch()` — wired up

Without `.catch()`, the new rethrows would become unhandled promise
rejections. Added explicit `.catch(err => console.warn(...))` at:

- `app/(tabs)/health.tsx:1579, 1587` — `syncHealthTracking`
- `app/(tabs)/wellness.tsx:1214, 1420` — `syncWellnessData`
- `app/(tabs)/chat.tsx:416` — `syncAllergies`

These are the truly fire-and-forget sites (AsyncStorage / Zustand is
the local source of truth; Firestore is a best-effort mirror). They
acknowledge errors instead of silently dropping them.

### Functions intentionally left as silent-swallow

- `incrementPublicProfilePostCount` — fire-and-forget by design;
  cloud-function `onPostDelete` is the authoritative decrementer. Worth
  adding a matching `onPostCreate` cloud function in a future cleanup
  to make `postsCount` server-only like the follow counters.
- `createNotification` — fire-and-forget; loss of a single notification
  is not user-visible (in-app bell still works because notifications
  are created from many surfaces).
- `markConversationRead`, `unregisterFcmToken` — eventual consistency;
  next subscription tick reconciles.
- Read functions (`getFollowers`, `getMessages`, etc) — correctly
  return `[]` / `null` on read failure; UI handles the empty case.

### New documentation

- **`docs/firestore-fields.md`** — collection-by-collection table of
  every field with its single source of truth. Codifies the rule "every
  Firestore field has exactly one writer." Includes the three bug
  examples (post vanishing, follower-count zeroing, follow-accept
  reverting) so the next contributor understands why the rule exists.

### Why this matters

Today's three bugs all had the same shape: **silent error swallow + UI
optimistic update = fake success.** This sweep ensures the next bug in
this family surfaces in seconds (real toast / alert / unhandled
rejection in Sentry) instead of three days. The pattern is now
structurally hard to repeat — every write path either rethrows or has a
documented fire-and-forget contract.

---

## Last action (2026-05-06) — Admin session bounce on page reload (fixed)

**Commit `4adc6e2` · hosting deployed · OTA `cf46dab5` published.**

### Root cause
`ensureWebAuthPersistence()` was calling
`setPersistence(auth, browserLocalPersistence)` on every page load.
Firebase's default web persistence is **IndexedDB**, not localStorage.
Calling `setPersistence(localStorage)` migrated auth state from IndexedDB
to localStorage, during which `onAuthStateChanged` fired with `null`
(before firing with the real user). The admin layout saw
`isLoading:false + user:null` and bounced to `/welcome` — even with a
valid session.

### Three-layer fix
1. **`services/firebase.ts`** — `ensureWebAuthPersistence` now uses
   `indexedDBLocalPersistence` (= Firebase's own default). Re-affirming
   the same persistence type is a true no-op: no migration, no null
   callback, no bounce. Incognito fallback: indexedDB → sessionStorage →
   inMemory.
2. **`store/useAuthStore.ts`** — 700ms debounce on null callbacks from
   `onAuthStateChanged`. If the real user arrives within 700ms the timer
   cancels. If 700ms pass with no user it's a genuine sign-out.
3. **`app/admin/_layout.tsx`** — 800ms grace period before bouncing on
   null user, as a final safety net.

---

## Last action (2026-05-06) — Follower-counter wipe fix + Divya recount

**Bug**: Divya appeared to have 0 followers / 0 following in the UI, but
the `/follows` collection had 4 followers + 3 follows for her — the count
was correct in the source of truth, but the publicProfile counters were
wiped to 0/0. Audit across all 19 publicProfiles found a 2nd victim
(Manvi Bhandari, off by 1 in followingCount). Both manually corrected
via Firestore REST PATCH after fix shipped.

### Root cause
`store/useSocialStore.ts syncPublicProfile()` was reading
`followersCount` / `followingCount` from the local Zustand store (which
initialises to 0, 0 on every fresh app open) and writing those values
into the publicProfile via `upsertPublicProfile`. When the user opened
the app, the sync fired before `loadSocialData()` had hydrated the real
counts from `/follows`, so 0,0 overwrote whatever the
`onFollowCreate`/`onFollowDelete` triggers had correctly written.

The Cloud Function triggers ARE correct — they increment counters on
every follow create/delete. Client-side sync was racing them and
clobbering the result.

### What changed
- **`store/useSocialStore.ts`** — `syncPublicProfile()` no longer writes
  `followersCount` or `followingCount`. Those fields are now exclusively
  maintained by the `onFollowCreate` / `onFollowDelete` Cloud Function
  triggers (which use admin SDK and bypass rules). `postsCount` still
  flows from the client because it's incremented by the same client via
  `incrementPublicProfilePostCount`.

### Recovery (already done manually)
- Divya (`PYPNqlFdFARnyBOCjNON29jwR9k2`): set followersCount=4, followingCount=3
- Manvi Bhandari (`5tEfLCMKzHVpwgpsD13tkNwuxdI2`): set followingCount=1
- All 19 publicProfiles audited and now match `/follows` reality

---

## Last action (2026-05-06) — Follow-accept reverting after refresh

**Commit `55c52ac` · rules + hosting deployed · OTA `ba394b1c-...`.**

Three connected bugs caused tap-Accept → "Accepted ✓" briefly → buttons
reappear after refresh, requestor's counters never increment:

1. `firestore.rules` `notifications/{uid}/items` update rule restricted
   to `onlyFields(['read'])`. `markNotificationRequestStatus` writes both
   `read` AND `requestStatus`, so the update was permission-denied — the
   `requestStatus` field never persisted, so on refresh the row had no
   badge. Allowed `['read', 'requestStatus']` together.
2. `services/social.ts` `acceptFollowRequest` / `declineFollowRequest`
   had the same silent-swallow pattern that hid the post bug. Rethrow
   so the caller can roll back optimistic state.
3. `components/community/NotificationsSheet.tsx` `handleAccept` /
   `handleDecline` fired un-awaited and unconditionally set
   `handled='accepted'` / `'declined'`. Even with the rethrow above, the
   UI claimed success on a real failure. Now awaits the call and rolls
   the badge back on error.

---

## Last action (2026-05-06) — Drafts post preview image collapse fix

**Commit `36be0ac` · hosting deployed · OTA `7622ebb9` published.**

### What changed (`app/admin/marketing/drafts.tsx`)
- `previewWrap` style gained `width: '100%'` so the `Image` inside it
  (which also has `width: '100%', aspectRatio: 1`) resolves to the panel
  width rather than collapsing to 0 height inside `SlideOver`'s
  `ScrollView` body.
- Root cause: `SlideOver`'s ScrollView `contentContainerStyle` is
  `{ padding: 20, gap: 16 }` with no `alignItems: 'stretch'`, so any
  child View without an explicit width collapses; the Image's
  `width: '100%'` then resolves to 0. Adding `width: '100%'` to the
  wrapper fixes it.

---

## Last action (2026-05-06) — Community posts vanishing (P0 fix)

**Hotfix for "posts of members not visible to other members" reported live.**

### Root cause
Wave 4 safety commit `fda72d4` (2026-05-03) added three fields to the
`addDoc` payload in `services/social.ts` `createPost` that are
`undefined` for clean posts — `hideReason`, `flaggedPII`, `flaggedCrisis`.
The default Firestore Web SDK instance from `getFirestore()` rejects any
`undefined` field with `FirebaseError: Function addDoc() called with
invalid data. Unsupported field value: undefined`. The throw was swallowed
inside `createPost` (`return ''`), so the optimistic local store entry
showed the post to the author while NOTHING was written to Firestore —
no other member ever saw it, and on refresh the post vanished.

Comments kept working because `addPostComment`'s payload doesn't have any
`undefined` fields — the spread (`...data`) only contains required strings.

### What changed (3 files)

- **`services/firebase.ts`** — switched `getFirestore(app)` →
  `initializeFirestore(app, { ignoreUndefinedProperties: true })`. Strips
  `undefined` fields automatically; immunizes the entire codebase from
  this class of bug. Falls back to `getFirestore()` if init throws (fast
  refresh re-import path).
- **`services/social.ts`** — `createPost` and `addPostComment` now
  rethrow on failure instead of silently returning `''` / fake objects.
  The existing `.catch()` handlers in `community.tsx` and `PostCard.tsx`
  surface real alerts when a write actually fails.
- **`firestore.rules`** — `isVerified()` now also accepts
  `firebase.sign_in_provider == 'phone'` so phone-OTP users (no
  `email_verified` claim) can post / comment / follow / DM. Was a latent
  bug — phone users would have been blocked even after the SDK fix.

### Recovery for affected users
Posts that "vanished" between 2026-05-03 OTA and 2026-05-06 fix were
never written to Firestore — not recoverable. Authors can re-post.

---

## Last action (2026-05-06) — Studio mobile layout fixes

**Commit `2c8c7cf` · hosting deployed · OTA `34c10318` published.**

### What changed (4 files)

- **`components/marketing/MarketingShell.tsx`** — Settings gear extracted from
  the horizontal ScrollView into a sibling View pinned to the right. On mobile
  the `flex:1` spacer inside a ScrollView does nothing, so the gear was being
  scrolled off-screen. Now always visible.
- **`app/admin/marketing/create.tsx`** (Studio wizard)
  - Preview image collapse fixed: `savePreviewWrap` style with `width:'100%',
    maxWidth:360` so the Image's `width:'100%'` resolves correctly inside the
    `alignItems:center` parent (was collapsing to 0).
  - Step 2 action row: on narrow screens ghost buttons (Try again / Edit first)
    are in a row and the primary button is full-width below — no more overflow.
  - Quality card sub-text shortened to prevent excessive line-wrapping in the
    narrow cards.
- **`app/admin/marketing/index.tsx`** — TomorrowCard Skip/Queue buttons switch
  to `flexDirection:'column'` on narrow so they never squeeze or overlap.
- **`app/admin/marketing/posts.tsx`** — Calendar day-grid wrapped in a
  horizontal ScrollView; `dayCell` changed from `width:'13.7%' minWidth:100`
  (700 px minimum = off-screen on mobile) to a fixed `width:100` that scrolls.

---

## Last action (2026-05-06) — Notifications outbox rebuild

**Commit `ca9f3ff` · hosting deployed · OTA `0a030d18` published.**

### What changed (`app/admin/notifications.tsx` + `services/admin.ts`)
- **Outbox now groups by status** — three colour-coded section headers:
  - **Failed** (red) — shown first so failures are never buried
  - **Pending / Processing** (amber) — pending, scheduled, skipped
  - **Sent** (green) — successfully delivered pushes
- **Each outbox card** now clearly shows:
  - **Type badge** (Info / Reminder / Alert / Celebrate) — from `pushType`
  - **Direction row** `→ Audience · N recipients · by you / by admin ···xxxxx`
  - **Delivery stat pills** — ✓ delivered / ✗ failed / ⟳ skipped inline
  - "View report →" hint to the per-recipient modal
- **`PushQueueEntry` interface** (`services/admin.ts`) — added `pushType?` and
  `fromEmail?` fields; `listPushOutbox` mapper surfaces them from Firestore.
- ScheduleList and delivery report modal untouched (still work correctly).

---

## Last action (2026-05-06) — Admin dashboard mobile redesign

**Commit `2792c07` · hosting deployed · OTA `179c824b` published.**

### What changed (`app/admin/index.tsx`)
- **Quick nav chip strip** (phones only, `!twoCol`) — horizontal scrolling row of
  6 chips: Users / Community / Support / Content / Studio / Notify. Lets admin
  navigate directly without opening the hamburger drawer.
- **Icon-only header actions** on narrow (<500px): Refresh = refresh icon; Sign out =
  log-out icon. Full buttons with text remain on wider viewports.
- **Compact card padding** — all body cards get `padding: 12px / gap: 4px` on narrow
  (vs 16px/8px). Controlled via new `compact` prop on the local `Card` component.
- **Row limits on narrow**: recent signups 3 (vs 6), live activity 8 (vs 12).
- **Rebase onto origin/main** — pulled in 7 commits from the other agent
  (library-ai two-tier nav, autopilot discoverability) before committing.

### Also fixed (`app/admin/content.tsx`)
- TS2367 — `isImageUrl` check no longer references removed 'articles'/'books' tabs
  (the other agent moved those to `library-ai.tsx`). Fixed to plain `imageUrl` key
  check; generateCover button still works for Schemes & Yoga imageUrl fields.

---


## Last action (2026-05-05) — MaaMitra LoRA trained and wired into Studio

**Replicate FLUX style LoRA trained from the 72 local app illustrations and
deployed as the first-choice Studio "Best" image path.**

### What changed
- Built a LoRA training dataset from all 72 `assets/illustrations/*.webp`.
  - First attempt used WebP files and failed because Replicate trainer did not
    recognize them as images.
  - Rebuilt as flat root-level `.png + .txt` caption pairs:
    `/tmp/maamitra-lora-png.zip`
  - Trigger word: `MAAMITRASTYLE`
  - Training type: `style`
  - Steps: `1200`
- Uploaded the PNG dataset ZIP to Firebase Storage:
  `marketing/lora/maamitra-style-png-1777957380557.zip`
- Created private Replicate model:
  `vijay5051/maamitra-style-lora`
- Training succeeded:
  - Training id: `x3gvj0kqd5rmw0cxyt3tq9wjdc`
  - Version:
    `vijay5051/maamitra-style-lora:2062475b5a6f39beae964d257f9f3d0b744c06416a1229b98b145a0103d58c77`
  - Weights:
    `https://replicate.delivery/xezq/erSsfBgjE3jMWUYebri5iIyBDHXYqZ8lP9Cagh4sL2kLwlDtA/flux-lora.tar`
- Set production Integrations doc:
  - `app_settings/integrations.replicate.loraModel`
  - `app_settings/integrations.replicate.loraTrigger = MAAMITRASTYLE`
- `functions/src/marketing/imageSources.ts`
  - Added `replicateLoraImage()`.
  - Supports explicit `owner/model:version` routes via `/v1/predictions`.
- `functions/src/marketing/studio.ts`
  - Studio **Best** now tries MaaMitra LoRA first.
  - If LoRA fails, falls back to OpenAI high-fidelity reference edits.
  - Cost logging uses `source=lora` for LoRA hits.
- `app/admin/marketing/create.tsx`
  - Best copy now says: "MaaMitra LoRA brand model. OpenAI fallback."

### What deployed
- Cloud Function deployed:
  `generateStudioVariants`
- Firebase Hosting deployed.

### Verification
- LoRA sample generation succeeded and wrote:
  `/tmp/maamitra-lora-smoke.png`
  This is the best output so far: much closer to app illustrations than
  prompt-only or OpenAI reference-only.
- `npm run build` in `functions/` passed.
- `npm run build:web` passed.

---

## Previous last action (2026-05-05) — Studio Best uses illustration references

**Reference-conditioned Studio generation deployed after prompt-only OpenAI output
still looked off-brand.**

### What changed
- Built a compact deployable reference pack from the local MaaMitra illustration
  library:
  - `functions/src/marketing/style-refs/all-72-style-mosaic.webp` contains all
    72 `assets/illustrations/*.webp` files as a packed style sheet.
  - Six high-detail anchors are included first for face/character fidelity:
    `community-hero`, `feature-community`, `feature-growth`,
    `health-cat-mother`, `dadi-ke-nuskhe-hero`, `health-cat-baby`.
- `functions/package.json` now copies `src/marketing/style-refs/*.webp` into
  `lib/marketing/style-refs/` during function builds.
- `functions/src/marketing/studio.ts` now routes Studio **Best** through
  OpenAI image edits with all 7 references and `input_fidelity=high`, instead
  of text-only `/images/generations`.
- `functions/src/marketing/imageSources.ts` supports multiple image buffers for
  OpenAI edits, sets `input_fidelity`, and asks for PNG output.
- `app/admin/marketing/create.tsx` copy/cost updated:
  "Reference-locked ChatGPT image model. ~₹15 per image."

### What deployed
- Cloud Function deployed:
  `generateStudioVariants`
- Firebase Hosting deployed for the refreshed cost/copy label.

### Verification
- `npm run build` in `functions/` passed.
- `npm run build:web` passed.
- Live OpenAI smoke test succeeded and wrote:
  `/tmp/maamitra-reference-smoke.png`
  It used the same 7-reference pack and returned a much closer MaaMitra-style
  mother/baby packing scene.

---

## Previous last action (2026-05-05) — Brand illustration style reinjected

**Live Firestore Brand Kit patched after Studio output looked off-brand.**

### What changed
- Reviewed the local illustration library count: 72 assets in
  `assets/illustrations/`.
- Repacked the visual style into a stricter, efficient Brand Kit profile:
  recurring MaaMitra mom/baby/dadi character design, lavender chikankari
  wardrobe, ivory negative space, polished gouache/ink finish, Indian home
  objects, and hard bans on generic cartoon/blob/photoreal/uncanny outputs.
- Patched production Firestore doc `marketing_brand/main.styleProfile` via
  Firestore REST using the Firebase CLI auth token.
  - Updated at `2026-05-05T04:23:50.966743Z`
  - Description length: 1308 chars
  - Art keywords length: 238 chars
  - Prohibited list: 28 items
- Synced `lib/marketingTypes.ts` `DEFAULT_STYLE_PROFILE` to the same profile
  so future Brand Kit resets keep the sharper house style.

### Notes
- No function deploy was needed for the prompt reinjection because Studio and
  generators read `marketing_brand/main.styleProfile` at request time.
- The backend still routes Studio "Best" to OpenAI `gpt-image-1` by default.

---

## Previous last action (2026-05-05) — Marketing image generation switched to OpenAI default

**Functions deployed + web hosting deployed.**

### What changed
- Fixed the failing Studio image path that was still tied to old Imagen behavior:
  - `functions/src/marketing/imageSources.ts` now defaults Gemini Imagen fallback
    to `imagen-4.0-generate-001`, uses `x-goog-api-key`, supports
    `gemini.imagenModel` / `GEMINI_IMAGEN_MODEL`, and parses multiple image
    response shapes.
- Per user request, Marketing Studio **Best** now uses OpenAI `gpt-image-1`
  as the default image generator while preserving the Brand Kit style lock:
  - `functions/src/marketing/studio.ts` treats all non-FLUX Studio requests as
    OpenAI, so old web bundles that still send `model: "imagen"` also route to
    OpenAI immediately.
  - `app/admin/marketing/create.tsx` copy now says
    "ChatGPT image model + your brand theme."
- Manual/daily marketing draft generation now defaults to `dalle` / OpenAI:
  - `functions/src/marketing/generator.ts` default image model changed from
    `imagen` to `dalle`.
- Template preview defaults its AI model to OpenAI too.
- Integration Hub OpenAI copy updated to mention branded post image generation.

### What deployed
- Cloud Functions updated:
  `generateStudioVariants`, `generateMarketingDraft`, `dailyMarketingDraftCron`,
  `generateAheadDrafts`.
- Firebase Hosting updated:
  https://maa-mitra-7kird8.web.app

### Verification
- `npm run build` in `functions/` passed.
- `npm run build:web` passed and deployed.
- `npx tsc --noEmit` still fails on a pre-existing typed-route issue:
  `app/admin/community.tsx(303)` rejects `"/admin/safety"` as a route. This is
  unrelated to the image generation changes.

---

## Previous last action (2026-05-05) — Library admin unified UX (two-tier nav)

**Commit `c383bcc` · hosting deployed · OTA `df8ce8b3` published.**

### What changed
- `app/admin/library-ai.tsx` — full rewrite: two-tier nav
  - **Tier 1**: Kind pill chips (📰 Articles / 📚 Books / 🛍️ Products)
  - **Tier 2**: Section underline tabs (Library | Autopilot | History)
  - Default section = Library so admin lands on content, not settings
  - `ContentLibrarySection`: all items (AI + manual), search, status filter,
    full CRUD — edit opens modal showing entire article body
  - `AutopilotSection`: compact StatusBanner + SettingsCard + GenerateCard
  - `HistorySection`: cron run logs
- `app/admin/content.tsx` — stripped to Schemes & Yoga only
- `AdminShell.tsx` — nav order: Library (AI+CRUD) first, Schemes & Yoga second

---

## Previous last action (2026-05-05) — Library AI autopilot (Articles · Books · Products)

**Full AI content pipeline for all three Library sections. Fully deployed.**

### What was built

**9 new Cloud Function modules** under `functions/src/library/`:
- `settings.ts` — `LibraryAiSettings` per-kind config (frequency / topics / tone /
  age-buckets / autoPublish / expiry) stored in `app_settings/libraryAi`. Admin
  changes take effect instantly (no cache).
- `brand.ts` — shares brand voice + compliance + style profile from
  `marketing_brand/main` (same forbidden-words list, same visual DNA as Studio).
- `openai.ts` — gpt-4o-mini JSON-mode helper (reuses Firestore-stored API key).
- `auth.ts` — admin gate (super | content role); mirrors marketing gate.
- `articles.ts` — AI writes article → Imagen hero image → compliance scan →
  Firestore `articles` collection. Rotates age buckets and topics by day. De-dupes
  by scanning recent 60 days of titles.
- `books.ts` — AI picks 3-5 real book candidates → verifies each against Google
  Books API (free, no key) → constructs Amazon.in deep links (`/dp/<ISBN13>`) or
  search URLs. Stores book covers in Firebase Storage.
- `products.ts` — AI picks brand-name products (Pigeon, Mee Mee, Himalaya…) →
  constructs Amazon.in + Flipkart search URLs. AI thumbnail via Imagen → Pexels
  fallback.
- `cron.ts` — daily 06:30 IST generator (fires each kind if `shouldFireToday()`);
  daily 03:00 IST stale-archival sweep (flips past-`expiresAt` items to `archived`).
- `index.ts` — barrel exports.

**6 new Cloud Functions exported from `functions/src/index.ts`:**
`generateArticleNow`, `generateBooksNow`, `generateProductsNow`,
`archiveLibraryItem`, `dailyLibraryAiCron`, `expireStaleLibrary`. All created.

**Admin UI** (`app/admin/library-ai.tsx`):
- Per-kind tabs (Articles / Books / Products) with enable toggle, frequency picker,
  perRun/expireAfterDays steppers, autoPublish switch, topic catalog textarea,
  tone editor.
- Generate-now card: topic override, age bucket chips, count, publish mode → fires
  callable, shows live result.
- AI item queue: live onSnapshot feed with thumbnail, title, topic, age range,
  timestamp, expiry, compliance flags, status badge, link button, archive button.
- Cron run history table (articles tab).
- Nav item added: "Library AI autopilot" (sparkles icon, `edit_content` cap) in
  AdminShell Content group.

**Firestore live sync** (`hooks/useLibraryFirestoreSync.ts`):
- 3 `onSnapshot` subscriptions on `articles`, `books`, `products`
  (where `status == 'published'`), mounted from the Library tab.
- Hydrates Zustand stores (`setArticles`, `setBooks`, `setProducts`) in real time.

**Other files changed:**
- `store/useArticleStore.ts`, `useBookStore.ts`, `useProductStore.ts` — added
  `setArticles / setBooks / setProducts` actions.
- `services/libraryAi.ts` — client callable wrappers + settings subscribe.
- `firestore.rules` — admin read for `library_ai_log`, `library_ai_runs`.
- `firestore.indexes.json` — 6 composite indexes
  (`source+createdAt`, `source+status+expiresAt`) across articles/books/products.
- `services/audit.ts` — added `library_ai.*` action types.

### What deployed (commit `5a89241`)
- Firebase Functions: 6 new functions created, 39 existing updated. ✔
- Firestore rules + indexes deployed. ✔
- Web hosting updated. ✔
- EAS OTA published (update group `4366c8b3`). ✔

---

## Previous last action (2026-05-05) — Auto-scheduler visibility & control

**Phase 5 — Admin can now see and control what the 6 AM cron will generate.**

Root cause of the user's concern: the cron ran silently every morning and
the admin had no way to know what it would generate or skip a date.

Three layers shipped in one commit (`4372c06` + lib compile `bad5387`):

### Layer 1 — Tomorrow's preview card (pure-client)
- New `previewScheduledSlot(brand: BrandKit, targetDate: Date): ScheduledSlotPreview`
  in `services/marketing.ts`. Pure computation — reads enabled personas/pillars/
  cultural calendar/themeCalendar from the brand kit snapshot + cronOverrides.
  Mirrors the exact same round-robin / event-hint logic the cron uses.
- **Today tab** (`app/admin/marketing/index.tsx`): when `cronEnabled=true`, a
  "Tomorrow's auto-post" section appears below the KPI tiles. Shows a date box
  (day abbrev + date), theme label, persona chip, pillar chip with emoji, event
  chip (if any matching cultural calendar event). Two action buttons:
  - "Skip tomorrow" — toggles the per-date skip override
  - "Queue 7 days" — fires `generateAheadDrafts` callable
- Subscribes to brand kit via `subscribeBrandKit` so the slot recomputes
  live when overrides change.

### Layer 2 — Per-date cron overrides
- New `CronOverride` / `CronOverrides` types added to `lib/marketingTypes.ts`
  and `BrandKit` interface.
- Stored at `marketing_brand/main.cronOverrides[YYYY-MM-DD]` with fields
  `{ skip?, promptOverride?, personaId?, pillarId? }`.
- `buildDailyMarketingDraftCron` now reads today's override before running:
  - `skip: true` → logs + returns null (no draft)
  - Override fields (personaId / pillarId / promptOverride) are merged into
    the `GenerateInput` passed to `runGenerator`.
- `saveCronOverride(actor, dateIso, override | null)` in `services/marketing.ts`
  writes a dot-notation Firestore update (`cronOverrides.YYYY-MM-DD = {...}`)
  so only that one key is touched. Pass `null` to delete the override.
  Audit-logged as `marketing.cron.override`.
- **Settings page** (`app/admin/marketing/settings.tsx`): new "Upcoming auto-posts"
  card under Daily knobs (only visible when `cronEnabled=true`). Shows next 3 IST
  dates with skip/un-skip toggle buttons. "Queue 7 days" on the card head. Stale
  override immediately reflected in the preview card when brand kit subscription
  fires back.

### Layer 3 — Ahead-generate callable
- `buildGenerateAheadDrafts(allowList)` in `generator.ts` — iterates tomorrow
  through +days (1–7). For each date: checks `cronOverrides[date].skip` → skips;
  queries `marketing_drafts` where `generatedForDate == date AND status in
  [pending_review, approved, scheduled, posted]` → skips if already exists;
  else runs `runGenerator({ forDateIso: date, ...overrides }, actorEmail)`.
- `runGenerator` extended with `forDateIso?` and `promptOverride?` inputs.
  `forDateIso` resolves the IST weekday key for any future date; `promptOverride`
  is injected as an "Admin override for today" line in the AI caption prompt.
- Every new draft now records `generatedForDate: YYYY-MM-DD` so the cron can
  detect and skip pre-generated dates via `draftExistsForDate(isoDate)`.
- Exported as `generateAheadDrafts` Cloud Function. Deployed.
- Client wrapper `generateAheadDrafts(days)` in `services/marketing.ts`.

### What deployed
- `functions:generateAheadDrafts` — created (new callable)
- `functions:generateMarketingDraft` — updated (forDateIso + promptOverride inputs)
- `functions:dailyMarketingDraftCron` — updated (override check + skip-if-exists)
- Web hosting — updated
- OTA — in-flight (publishing at time of handoff; will succeed once complete)

### Merge notes
Codex had landed `Integration Hub` (commit `dc1724e`) while this session was
running. Integration merged cleanly via `git pull --rebase`. Only conflict was
`services/audit.ts` — resolved to include both `integration.update` (Codex)
and `marketing.cron.override` (this session).

---

## Last action (2026-05-05) — Brand visual style + Generate cover button

**Two commits shipped:**

### 1. Brand visual style fingerprint + gpt-image-1 default (`fab5c52`)
- Audited actual in-app illustrations to identify the real visual DNA:
  painterly storybook (NOT flat vector), lavender+sage+dusty-pink+cream palette,
  Indian women in white chikankari-embroidered lavender kurtas, messy bun hair,
  generous negative space.
- Rewrote `DEFAULT_STYLE_PROFILE` in `lib/marketingTypes.ts` to match: added
  `oneLiner` (~280 chars for Imagen token limit), full `description`, full
  `prohibited` list (flat vector, 3D puffy, photorealism, non-Indian looks…),
  `artKeywords`.
- Added `DEFAULT_STYLE_REFERENCES` array (6 canonical illustration paths).
- Switched default AI image model from `'imagen'` → `'dalle'` (gpt-image-1)
  in `generator.ts` (cron) and `studio.ts` (Studio canvas).
- `buildStyleLockedImagePrompt` / `buildStudioPrompt` now use `oneLiner` first
  (avoids Imagen's ~480-token cap hitting the long description).
- Style constants in 3 places (`lib/marketingTypes.ts`, `generator.ts`,
  `studio.ts`) all updated and kept in sync.

### 2. ✨ Generate cover button on article + book editor (`e862462`)
- `app/admin/content.tsx`: when editing an article or book, the "Header image
  URL" / "Cover image URL" field gets a "✨ Generate" button inline.
- Calls `generateStudioVariants({ prompt, model: 'dalle', variantCount: 1 })`
  with a subject prompt built from `title + topic` (articles) or
  `title + author + topic` (books). Style injection happens server-side via
  `buildStudioPrompt`.
- On success, the returned Storage URL is written back into `imageUrl`; admin
  saves as normal.

### What deployed
- Web hosting — updated
- OTA — published (update group `dcebfb48-bd48-4745-be63-2651eb40d3d6`)
- No new Cloud Functions needed (reuses `generateStudioVariants`).

---

## Previous action (2026-05-05) — Auto-scheduler visibility & control

**Phase 5 — Admin can now see and control what the 6 AM cron will generate.**

Root cause of the user's concern: the cron ran silently every morning and
the admin had no way to know what it would generate or skip a date.

Three layers shipped in one commit (`4372c06` + lib compile `bad5387`):

### Layer 1 — Tomorrow's preview card (pure-client)
- New `previewScheduledSlot(brand: BrandKit, targetDate: Date): ScheduledSlotPreview`
  in `services/marketing.ts`. Pure computation — reads enabled personas/pillars/
  cultural calendar/themeCalendar from the brand kit snapshot + cronOverrides.
  Mirrors the exact same round-robin / event-hint logic the cron uses.
- **Today tab** (`app/admin/marketing/index.tsx`): when `cronEnabled=true`, a
  "Tomorrow's auto-post" section appears below the KPI tiles. Shows a date box
  (day abbrev + date), theme label, persona chip, pillar chip with emoji, event
  chip (if any matching cultural calendar event). Two action buttons:
  - "Skip tomorrow" — toggles the per-date skip override
  - "Queue 7 days" — fires `generateAheadDrafts` callable
- Subscribes to brand kit via `subscribeBrandKit` so the slot recomputes
  live when overrides change.

### Layer 2 — Per-date cron overrides
- New `CronOverride` / `CronOverrides` types added to `lib/marketingTypes.ts`
  and `BrandKit` interface.
- Stored at `marketing_brand/main.cronOverrides[YYYY-MM-DD]` with fields
  `{ skip?, promptOverride?, personaId?, pillarId? }`.
- `buildDailyMarketingDraftCron` now reads today's override before running:
  - `skip: true` → logs + returns null (no draft)
  - Override fields (personaId / pillarId / promptOverride) are merged into
    the `GenerateInput` passed to `runGenerator`.
- `saveCronOverride(actor, dateIso, override | null)` in `services/marketing.ts`
  writes a dot-notation Firestore update (`cronOverrides.YYYY-MM-DD = {...}`)
  so only that one key is touched. Pass `null` to delete the override.
  Audit-logged as `marketing.cron.override`.
- **Settings page** (`app/admin/marketing/settings.tsx`): new "Upcoming auto-posts"
  card under Daily knobs (only visible when `cronEnabled=true`). Shows next 3 IST
  dates with skip/un-skip toggle buttons. "Queue 7 days" on the card head. Stale
  override immediately reflected in the preview card when brand kit subscription
  fires back.

### Layer 3 — Ahead-generate callable
- `buildGenerateAheadDrafts(allowList)` in `generator.ts` — iterates tomorrow
  through +days (1–7). For each date: checks `cronOverrides[date].skip` → skips;
  queries `marketing_drafts` where `generatedForDate == date AND status in
  [pending_review, approved, scheduled, posted]` → skips if already exists;
  else runs `runGenerator({ forDateIso: date, ...overrides }, actorEmail)`.
- `runGenerator` extended with `forDateIso?` and `promptOverride?` inputs.
  `forDateIso` resolves the IST weekday key for any future date; `promptOverride`
  is injected as an "Admin override for today" line in the AI caption prompt.
- Every new draft now records `generatedForDate: YYYY-MM-DD` so the cron can
  detect and skip pre-generated dates via `draftExistsForDate(isoDate)`.
- Exported as `generateAheadDrafts` Cloud Function. Deployed.
- Client wrapper `generateAheadDrafts(days)` in `services/marketing.ts`.

### What deployed
- `functions:generateAheadDrafts` — created (new callable)
- `functions:generateMarketingDraft` — updated (forDateIso + promptOverride inputs)
- `functions:dailyMarketingDraftCron` — updated (override check + skip-if-exists)
- Web hosting — updated
- OTA — in-flight (publishing at time of handoff; will succeed once complete)

### Merge notes
Codex had landed `Integration Hub` (commit `dc1724e`) while this session was
running. Integration merged cleanly via `git pull --rebase`. Only conflict was
`services/audit.ts` — resolved to include both `integration.update` (Codex)
and `marketing.cron.override` (this session).

---

## Earlier sessions — quick summary

**Studio Phase 4** (`14e78f6`): carousels, mask inpainting, upload-your-own,
logo overlay, reuse-winners. All deployed.

**Connection-health probe**: live IG/FB dots in MarketingShell + Settings via
`marketing_health/main` doc. `probeMarketingHealth` (hourly cron) +
`probeMarketingHealthNow` (admin callable). Deployed.

**Style lock + drag-to-reschedule + UTM attribution**: cron drafts now use
brand styleProfile preamble for visual consistency with Studio. Calendar has
HTML5 drag-to-reschedule (web only). First-touch UTM capture + bio-link builder.

**Integration Hub** (`dc1724e`, Codex): `/admin/integrations` page + health
probe + credential persistence via `app_settings/integrations`.

**M1–M6**: full marketing platform — brand kit, content engine, approval queue,
calendar, IG+FB publish, unified inbox, analytics, UGC, boost. All shipped.

---

## Open follow-ups (not blocking; pick when ready)

1. **Webhook App Secret** — `META_WEBHOOK_PERMISSIVE=1` still active.
   Copy current App Secret from Meta Dashboard → Settings → Basic, paste
   into `functions/.env`, flip `META_WEBHOOK_PERMISSIVE=0`, redeploy
   `metaWebhookReceiver`.

2. **FB Page carousel publish** — falls through to single-image for now.
   Uses `unpublished-photo + attached_media` pattern, ~80 LOC.

3. **Per-slide logo overlay on carousels** — single-image only for now.

4. **LoRA training pipeline** — biggest visual-consistency leap but
   operational (Replicate training run ~$2 + ~30 min + endpoint swap).
   Uses the same `model` discriminator already in `studio.ts`.

5. **`cronOverrides` prompt override UI** — the data model supports
   `promptOverride` per date but the UI only exposes skip/un-skip.
   To add: a text field below each slot row in Settings → Upcoming auto-posts
   and a "Set override" form sheet on the Today tab card.

6. **Custom-role capability gating, consent recording, impersonation
   read path** — wired but not yet consumed; see older handoff notes.

---

## Production URLs
- https://maamitra.co.in (primary)
- https://maa-mitra-7kird8.web.app (fallback)

## Admin access
- Admin email: rocking.vsr@gmail.com (in allow-list since 2026-04-24)
- Dev preview bypass: `?previewAdmin=1` (__DEV__ only)

## Known constraints / gotchas
- **Shared branch is `main` only.** Pull/rebase before work and before
  every commit.
- **OTA `safe-update.sh` bypass** required when local branch isn't `main`
  (worktrees push to `main` from a `claude/*` branch). Use
  `SAFE_UPDATE_BYPASS=1 npm run update` after confirming tree is clean
  (the node_modules symlinks in the worktree show as untracked but are
  excluded by .gitignore; they don't affect the bundle).
- **`META_WEBHOOK_PERMISSIVE=1`** — active in functions/.env; all webhook
  events ingest but signature is not verified. Not a blocker for daily
  operations.
- **Cron override promptOverride UI** — the Firestore field is supported
  server-side but there is no UI to set it yet (only skip toggle is wired).
  To set a prompt override manually: write to
  `marketing_brand/main.cronOverrides.{YYYY-MM-DD}.promptOverride` in
  Firestore console.
