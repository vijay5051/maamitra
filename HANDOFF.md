# Handoff state

> **Read this first** when starting any session. It tracks what's
> in flight so a different agent (Claude / Codex) can resume without
> re-asking the user.

---

## Active task
No active coding task.

---

## Last action (2026-05-05) — Library admin unified UX (two-tier nav)

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
