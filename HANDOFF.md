# Handoff state

> **Read this first** when starting any session. It tracks what's
> in flight so a different agent (Claude / Codex) can resume without
> re-asking the user.

---

## Active task
No active coding task.

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
