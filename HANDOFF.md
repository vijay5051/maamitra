# Handoff state

> **Read this first** when starting any session. It tracks what's
> in flight so a different agent (Claude / Codex) can resume without
> re-asking the user.

---

## Active task
No active coding task.

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
