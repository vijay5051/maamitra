# Handoff state

> **Read this first** when starting any session. It tracks what's
> in flight so a different agent (Claude / Codex) can resume without
> re-asking the user.

---

## Active task
**Marketing automation module — Phase 1 (foundation + brand kit).**

Worktree: `claude/crazy-cannon-8929dc` (pushes to `main`).

### Goal
Build a full marketing platform inside the admin panel that auto-generates
IG + FB content (image carousels, posts), routes through admin approval,
auto-publishes via Meta Graph API, and unifies comments + DMs into an
inbox — all without the admin ever logging into Meta.

### Plan (phased)
1. **Foundation + Brand Kit** ← current. Marketing nav group, Firestore
   schema, types, service, brand-kit editor (logo + palette + fonts +
   theme calendar). Real, no placeholders.
2. **Templating engine.** Satori-based React/HTML→PNG renderer with
   ~10 branded templates (tip card, quote card, milestone, carousel
   cover/slide, myth-buster, Q&A, statistic). Text-perfect because real
   fonts; backgrounds from Pexels/Unsplash + occasional FLUX Schnell.
3. **Daily draft generation.** Firebase Function cron (6am IST) calls
   Claude Haiku 4.5 for captions, picks template+theme, renders PNG,
   stores draft in `marketing_drafts`.
4. **Approval UI + Calendar + Manual-publish mode.** Drafts queue with
   approve/edit/regenerate/reject; calendar view of scheduled+posted;
   "Copy caption + download image" mode while Meta App Review pending.
5. **Webhook receiver Firebase Function.** Public HTTPS endpoint Meta
   pings on comment/DM events. Writes to `marketing_inbox` thread tree.
6. **Inbox UI.** Unified IG/FB comments+DMs with AI reply suggestions
   (Claude in brand voice), saved replies, sentiment tags.
7. **Auto-publish flip.** When Meta App Review approved, switch from
   manual mode to a publisher cron that calls Graph API.
8. **Analytics.** Per-post + weekly digest from Insights API.

### Meta side — already configured
- **App ID**: `1485870226522993` (App name: MaaMitra; type: Business)
- App Secret saved by user (not in repo)
- Linked to MaaMitra Business Portfolio (id 1341006954572747)
- Use cases configured: Manage messaging & content on Instagram (3 perms);
  Manage everything on your Page (7 perms). All "Ready for testing".
- App Settings → Basic: Privacy + Terms URLs set, App domain `maamitra.co.in`,
  Category Lifestyle, Contact `info@maamitra.co.in`.
- **Outstanding**: data-deletion URL rejected by Meta because our SPA
  shell HTML has no visible content — fix in Phase 5 (callback endpoint).
  Not blocking dev mode.
- Webhook URL: not set yet (waits for Phase 5 endpoint).
- Test asset wiring (App Roles → Roles): not done yet (waits for OAuth in Phase 4).
- App Review submission: not done yet (waits for working screencast,
  ie post-Phase 6).

### Last action
**Triple-feature drop — daily-cron style lock + drag-to-reschedule on the
Calendar + first-touch attribution capture & bio-link UTM builder.**

What shipped:
- **Style Profile → daily-cron generator (`functions/src/marketing/generator.ts`).**
  Brand kit's styleProfile (description / artKeywords / prohibited) now
  reads through `loadBrandKit()` and prefixes every Imagen / FLUX / dalle
  call in `renderDraftImage` via the new `buildStyleLockedImagePrompt`
  helper — same structure as `studio.ts buildStudioPrompt`, kept in sync
  by convention. Cron-generated drafts now share the Studio "flat 2D,
  pastel, brown-skin Indian moms" look. Pexels fallback intentionally
  uses the un-styled subject prompt (it's keyword-search; the style
  preamble would just narrow the photo set unhelpfully). Defaults
  (`STYLE_DEFAULT_DESCRIPTION` / `STYLE_DEFAULT_KEYWORDS`) match
  studio.ts so brand kits without an explicit profile still produce
  on-brand images.

- **Drag-to-reschedule on `/admin/marketing/calendar`.** Web-only
  HTML5 drag/drop (RN Web forwards `onDragStart` / `onDragOver` /
  `onDrop` to the underlying DOM element):
  - Each non-posted compact card is `draggable={true}` with the draft
    id in the `application/x-maamitra-draft-id` MIME (text/plain
    fallback). Posted drafts can't be moved — their date is the
    publication truth.
  - Day columns + the Unscheduled bucket are drop targets with hover
    styling (purple border + soft fill).
  - Drop calls `scheduleDraft(actor, id, composeIstIso(targetDay,
    existingTime))` — preserves time-of-day or defaults to 09:00 IST.
    Dropping into Unscheduled calls `unscheduleDraft`. Optimistic
    local update + Firestore write; rollback + plain-English banner on
    failure.
  - Native iOS / Android falls through cleanly: no draggable, no drop
    targets, tap-to-open behaviour unchanged.

- **First-touch attribution capture (M6b code half).**
  - New `services/attribution.ts`:
    - `captureFirstVisitAttribution()` — reads UTM params + referrer
      + landing path on first web visit; persists to localStorage.
      First-touch wins (subsequent visits no-op). Skips when no
      signal is present (direct visit with no UTM and same-origin
      referrer) so we don't bloat docs.
    - `writeAttributionToUser(uid)` — flushes the localStorage
      capture to `users/{uid}.attribution` with merge:true; server-
      side first-touch guard prevents later-touch overwrite.
    - `buildBioLink({ draftId, headline, channel })` — pure function
      that constructs `https://maamitra.co.in/?utm_source=…&
      utm_medium=social&utm_campaign={draftId}&utm_content={slug}`.
  - `app/_layout.tsx` — capture on root mount, write to user when
    auth-state-changed lands a uid.
  - `app/admin/marketing/drafts.tsx` — new BioLinkBlock on posted
    drafts: per-channel (IG / FB) UTM-tagged URL with Copy button +
    "Copied" feedback. Admin pastes into the IG/FB bio for
    post-of-the-day rotation.

Why this matters:
- **Style lock** closes the visual-coherence gap: every auto-draft now
  matches Studio output. The next big leap is LoRA training (one-time
  ~$2 + 30 min on Replicate), which will replace the prompt preamble
  with a custom Replicate endpoint via the same `model` discriminator
  in `studio.ts`.
- **Drag-to-reschedule** removes the slide-over → datetime-picker
  ceremony for the common "shift this draft a day later" action.
- **Attribution** finally answers "which IG post earned this user?" —
  the data was being thrown on the floor before; now it lands on
  `users/{uid}.attribution` and is queryable in admin / BigQuery.

Browser-verified in dev preview:
- UTM capture: navigated to `/?utm_source=facebook&utm_medium=social&
  utm_campaign=draft_abc123&utm_content=tip-tuesday` → localStorage
  contains a clean attribution capture JSON with all five fields +
  referrer + landingPath. ✓
- Calendar renders the new "Tip — drag any card…" hint, day columns
  are wired with drop handlers, type-checked clean. Real drag
  exercise needs deployed Firestore data.
- Drafts page loads clean, no console errors with the new BioLinkBlock
  + buildBioLink import. Bio link string built correctly via in-page
  `URLSearchParams` smoke test.

Outstanding:
- Boost env config — user adds `META_AD_ACCOUNT_ID` + `META_FB_PAGE_ID`
  to `functions/.env` so `boostMarketingDraft` actually fires (it
  currently returns "missing-creds"). Code half is fully shipped.
- Webhook signature mystery — `META_WEBHOOK_PERMISSIVE=1` still active.
  User to copy current App Secret from Meta Dashboard → Settings →
  Basic, paste into `functions/.env`, flip permissive=0, redeploy
  metaWebhookReceiver.

### Earlier this session
**Connection-health probe shipped — IG/FB dots in the marketing shell +
Settings Connected accounts card now reflect live token validity instead
of optimistic "always green".**

What shipped:
- `functions/src/marketing/health.ts` — new module:
  - `probeMarketingHealth` (pubsub cron, every 1 hour, 256MB / 60s) —
    fires two cheap Graph node fetches (IG `/{ig-user-id}?fields=id,username`
    + FB `/{page-id}?fields=id,name` via the SU→PAT derivation already
    used by the publisher) and writes the result to
    `marketing_health/main`. Maps Meta error codes (190, 10, 200, 4/17/32)
    to plain-English copy with actionable guidance.
  - `probeMarketingHealthNow` (admin callable, 30s) — same probe, fired
    by the new "Re-check now" button in Settings → Connected accounts.
- `firestore.rules` — adds `marketing_health/{docId}` rule (admin read,
  service-account-only write).
- `lib/marketingTypes.ts` — new `ChannelHealth` + `MarketingHealth`
  interfaces; `UNKNOWN_CHANNEL_HEALTH` / `UNKNOWN_MARKETING_HEALTH`
  fallbacks for pre-first-probe state.
- `services/marketing.ts` — `subscribeMarketingHealth(cb)` Firestore
  subscription + `probeMarketingHealthNow()` callable wrapper. All shapes
  normalised at the boundary so UI reads typed values (no raw Firestore
  Timestamps leaking through).
- `components/marketing/MarketingShell.tsx` — `HealthStatus` interface
  extended with `igHandle`, `fbHandle`, `igError`, `fbError`,
  `healthUnknown`. The chip now has three dot states (ok green / fail
  red / unknown muted-gray); accessibility label includes the live
  handle or the plain-English error reason.
- `app/admin/marketing/_layout.tsx` — subscribes to the health doc
  alongside the brand kit; passes live state into the shell.
- `app/admin/marketing/settings.tsx` — Connected accounts card rewritten:
  - Live IG / FB dots driven by the probe doc (gray Checking… while
    pre-first-probe, green Connected when ok, red Reconnect with the
    plain-English error inline below the row when failed).
  - "Re-check now" button on the card head fires the callable and shows
    a banner with both channels' status.
  - Footer hint shows relative timestamp ("Checked 4 min ago. Re-checks
    every hour automatically.") instead of the previous optimistic
    "Tokens refresh automatically." copy.

Why this matters:
- Replaced two pieces of CLAUDE.md-violating optimistic UI ("✓ ✓ static"
  in Connected accounts; `igConnected: true` hardcoded in MarketingShell)
  with honest live state. Token expiry / scope loss now visible at a
  glance instead of silent until publishes start failing.
- Sets up future surface for FB Messenger fb_message channel — once
  `pages_messaging` scope is added, extending the probe is a 5-line
  patch: a third channel field on the doc + a third dot in the chip.

Browser-verified in dev preview:
- Settings page renders correctly with both channels in "Checking…"
  pending state
- Health chip shows muted-gray dots + warn border in the pre-probe
  state (correctly degraded from previous always-green lie)
- "Re-check now" button visible + accessibility-labelled correctly
- Real probe path needs deployed Cloud Functions + real auth (next
  step)

Outstanding (Studio Phase 4+):
- Carousels, mask inpainting, LoRA training, bg swap, logo overlay,
  reuse winners

### Earlier this session
**Studio v2 Phase 3 — text-edit shipped. Admin can refine a picked
variant ("change bg to pastel pink") without re-rolling all 4.**

What shipped:
- `functions/src/marketing/imageSources.ts` — new `openaiImageEdit(buf,
  prompt, opts)` helper using OpenAI `/v1/images/edits` (multipart).
  Mirrors `openaiImage()` but takes an input PNG buffer + optional mask.
  Returns the edited image as data: URL.
- `functions/src/marketing/studio.ts` — new `buildEditStudioImage`
  callable:
  - Input `{ imageStoragePath, prompt, quality? }`. Path must start
    with `marketing/studio/` (anti-tamper guard — admin can only edit
    images they generated in the studio).
  - Server-side daily cost-cap pre-check (~₹3.50 per medium edit, ₹14.50
    high).
  - Downloads input from Storage via admin SDK, builds an edit prompt
    with brand-style guard ("Keep this visual style intact: …"), posts
    to gpt-image-1, uploads result to `marketing/studio/{ts}-edit.png`,
    logs cost.
  - Returns `{ ok, variantId, url, storagePath, costInr }`.
- `services/marketingStudio.ts` — `editStudioImage()` typed wrapper.
- `app/admin/marketing/create.tsx` — Edit Mode wired into Step 2:
  - When a variant is picked, a new "Edit it first" ghost button
    appears next to "Try again".
  - Clicking it slides in an Edit Panel: brush icon + "Edit variant
    {A/B/C/D}" + ₹3.50 cost chip + textarea ("Change the background
    to soft pastel pink") + Apply / Cancel.
  - While applying, the picked variant card gets a dark overlay with
    "Editing…" + spinner so admin sees what's being changed.
  - On success: replaces the picked variant in-place (preserves grid
    position, auto-keeps it picked), shows "Edited! ✨ Pick again or
    continue when you're happy." banner.
  - On failure: friendlyError message inline; variant grid intact.

How style stays locked through edits:
- Edit prompt always prefixed: "Edit instruction: {user prompt}\n\nKeep
  this visual style intact: {styleProfile.oneLiner}" + the prohibited
  list as a "Do NOT introduce" guard. So admin can ask for "soft pastel
  pink background" without breaking into photorealism.

Cost + safety guardrails preserved from Phase 2:
- ✅ Server-side daily cost cap pre-check
- ✅ Per-call `marketing_cost_log` row with parent + edit prompt snippet
- ✅ Permanent Storage upload of edited image
- ✅ Admin-only callable
- ✅ Anti-tamper: editStudioImage refuses paths outside marketing/studio/

Browser-verified in dev preview:
- Step 1 renders cleanly, fresh bundle confirmed
- Live bundle contains "Edit it first" string (production verified)
- Step 2 Edit Mode panel — needs real auth + variants to fully test;
  trusting type-checked code for now. End-to-end on prod when admin
  generates first real variant set.

Outstanding (Phase 4+):
- Carousels (3–5 images sharing seed + style for IG carousel)
- Mask inpainting (rectangular brush over a region for surgical edits)
- LoRA training (one-time ~$2 + 30 min on Replicate, then $0.003/inference;
  next big consistency leap)
- Background swap from a curated set
- Logo overlay (Skia compose, no API cost)
- "Reuse winners" — pre-fill prompt from analytics top performer

### Earlier this session
**Studio v2 Phase 2 — image-gen canvas shipped at /admin/marketing/create.**

Studio Phase 2 wires the actual create flow. Admin types a prompt, picks
quality, gets 4 brand-locked AI variants in parallel, picks one, edits/
auto-generates caption, saves as draft (or schedules). Output lands in
the existing M2 `marketing_drafts` queue → M3 publish / M4 inbox / M5
insights / M6 boost all work without changes.

What shipped:
- `functions/src/marketing/studio.ts` — two callables:
  - `generateStudioVariants` — admin callable. Reads `marketing_brand/main`
    + styleProfile, builds a style-locked prompt (description + art keywords
    + negative-prohibited list), fires N (1–4) parallel calls to the
    chosen provider (Imagen default, FLUX option), uploads each result
    to `marketing/studio/{ts}-{i}.png` via `file.makePublic()`, returns
    `[{ variantId, url, storagePath }, …]`. Logs each call to
    `marketing_cost_log` with source + bytes + actor. **Server-side
    daily cost cap pre-check** — refuses to start if planned spend
    would push total over `costCaps.dailyInr` (CLAUDE.md audit item).
  - `createStudioDraft` — admin callable. Picked variant URL + (optional)
    caption + (optional) scheduledAt → creates `marketing_drafts/{id}`
    row with status = `pending_review` (or `scheduled`). Synthesises
    caption via gpt-4o-mini in brand voice if admin didn't write one.
    Tags `schemaVersion: 2` + `sourceTool: 'studio'` so analytics +
    Posts hub can identify Studio-created drafts.
- `functions/src/marketing/index.ts` + `functions/src/index.ts` — exports
  wired and bound to `ADMIN_EMAILS` allow-list, deployed alongside the
  rest of the marketing module.
- `services/marketingStudio.ts` — client wrappers for both callables,
  returning the raw discriminated-union response so callers can pipe
  through `friendlyError()`.
- `app/admin/marketing/create.tsx` — replaces the 4-option stub with
  the actual canvas. Three-step wizard:
  - **Step 1 — Prompt:** large textarea + Quality picker (Best ₹13/4
    Imagen, Quick ₹1/4 FLUX) + live cost estimate + Generate CTA.
    Empty-state validation prevents firing without a real prompt.
  - **Step 2 — Pick:** prompt summary card with "Edit" link, 2x2
    variant grid with skeleton loaders (each shows A/B/C/D badge),
    selected variant gets purple border + checkmark, "Try again"
    re-fires generation, "Use this image" advances when picked.
    Failed variants surface "Skipped" + an info banner suggesting retry.
  - **Step 3 — Save:** picked image preview (with "Change image" link),
    caption editor with placeholder explaining AI auto-write, char
    counter, native datetime picker, "Save as draft" (default) and
    "Schedule" (requires datetime) actions. On success → drops admin
    into Posts → To-review tab with the new draft slide-over open.

Brand-style lock (the foundation for "everything looks on-brand"):
- Style preamble built server-side from `marketing_brand/main.styleProfile`
  (codified during Studio v2 Phase 1):
  - `description` → "Visual style: …"
  - `artKeywords` → "Art direction keywords: …"
  - `prohibited` → "Do NOT include: …"
  - Plus universal suffix: "Single coherent illustration. No text, no
    logos, no watermarks." (so we don't end up with garbled AI text in
    the image — we composite text via Satori later if needed).
- Default profile (set at first onboarding) codifies "flat 2D, pastel,
  brown-skin Indian moms" — every Studio gen starts from this.
- LoRA training (Phase 5 from the plan) is the next step-change in
  consistency. ~$2 + 30 min training on the 72 illustration set →
  custom Replicate endpoint replaces Imagen as default. Wires into
  the same `model` discriminator already in `studio.ts`.

Cost + safety guardrails (CLAUDE.md audit items implemented):
- ✅ Server-side daily cost cap before any image gen
- ✅ Per-call `marketing_cost_log` row with actor + bytes + variantId
- ✅ Permanent Storage upload of every variant (signed-URL expiry safe)
- ✅ Admin-only callable gating (callerIsMarketingAdmin)
- ✅ Plain-English errors throughout (friendlyError client-side, no raw
  Cloud Function codes leak)

Browser-verified in dev preview:
- Step 1 renders cleanly: textarea, quality picker, cost estimate,
  disabled CTA when empty → enabled when valid
- Click Generate fires the callable; "Not connected" friendly fallback
  in dev mode (no real Firebase auth) — confirms the error path works
- Step 2 + 3 layouts visible in code; live verification needs deployed
  functions (next step)

Outstanding (next session — Studio Phase 3+):
- Image editing (text-edit "change bg to pink", masked inpaint, bg
  swap, logo overlay)
- Multi-image carousel (3–5 variants sharing seed + style for IG carousel)
- LoRA training pipeline (one-time ~$2, then $0.003/inference)
- "Reuse winners" — Today CTA pre-fills prompt from last week's
  top-performing draft (closes M5 feedback loop visually)
- Style reference image input — currently only prompt prefix; once we
  pick a provider that supports image-input (gpt-image-1 edits API or
  Imagen subject-ref), pass the styleReferences[] from brand kit too.

### Earlier this session
**Studio v2 — UX restructure shipped (calm shell + onboarding + Posts hub
+ Settings hub + Style Profile foundation + plain-English errors).**

Big rebuild of the marketing section's chrome and information architecture
to match the design plan (Today / Posts / Replies / Insights / Settings
pill nav, forced onboarding wizard, no jargon, single primary action per
screen). All existing routes still work as deep links — the rebuild is
additive. Studio Phase 2 (image-gen canvas) plugs into `/admin/marketing/create`
in the next session.

What shipped (this commit):
- `components/marketing/MarketingShell.tsx` — chrome wrapping every
  marketing screen. Greeting "Hi {firstName} 👋" left, health chip
  "● IG ● FB Auto on/off" right (click → Settings), 4+1 pill tabs
  (Today / Posts / Replies / Insights / ⚙). Active-tab detection via
  pathname matching keeps existing `/admin/marketing/inbox` etc. URLs
  working — they just appear as "Replies" / "Insights" in the nav.
- `app/admin/marketing/_layout.tsx` — wraps Stack in MarketingShell.
  Forces onboarding wizard when `marketing_brand/main.onboardedAt`
  is null. Dev preview bypass (`__DEV__` + `previewAdmin=1`) so
  Today/Posts/Settings can be reviewed without a real signed-in admin.
- `app/admin/marketing/index.tsx` — Today screen replaces the v1
  setup-checklist. Hero "Create post" CTA on top + 3 KPIs (this week's
  posts, 7d reach, unread replies) + "Going out next" card + 7-day
  recent-posts strip. Single primary action per CLAUDE.md.
- `app/admin/marketing/onboarding.tsx` — forced 3-step wizard:
  Welcome → Brand vibe (name + voice + accent picker, 6 swatches) →
  Done summary + finish. Sets onboardedAt sentinel, drops admin into
  Today.
- `app/admin/marketing/posts.tsx` — Posts hub with 4 inner pill sub-tabs
  (Calendar default, To-review for drafts pending, From-users for UGC,
  Posted history). Calendar shows week-grid with "+" empties, drag
  reschedule deferred to next session. Click any row → existing
  slide-overs at /admin/marketing/drafts?open=<id> still own the rich
  editing UI.
- `app/admin/marketing/settings.tsx` — sectioned Settings page:
  - Daily knobs: Auto-post toggle, Crisis pause toggle, Connected
    accounts (IG ✓ + FB ✓ static — needs marketing_health/main doc
    for live state in next pass).
  - Setup: Brand kit nav card, Strategy nav card, **inline Style
    Profile editor** (Studio v2 foundation — one-liner / detailed
    description / art keywords / prohibited list, all flushed back
    to `marketing_brand/main.styleProfile`).
  - Advanced: Template preview, Cost log.
- `app/admin/marketing/create.tsx` — Studio Phase 1 stub. Four-option
  hub: Generate now (working) · Template preview (working) · Upload
  your own (coming soon) · Custom AI (coming soon). Lands the
  affordances in plain English.
- `lib/marketingTypes.ts` — BrandKit gains `onboardedAt`, `styleProfile`,
  `styleReferences[]`. New `StyleProfile` interface (oneLiner /
  description / prohibited / artKeywords). Default profile codifies
  "flat 2D, pastel, brown-skin Indian moms" as the brand visual DNA.
- `services/marketing.ts` — sanitiser + writer honour the new fields.
  `onboardedAt` write sentinel: any non-empty string converts to
  serverTimestamp(); empty string / null clears it.
- `services/marketingErrors.ts` — new `friendlyError(action, err)` +
  `friendlyPublishError(raw)` helpers. Maps every Cloud Function
  error code (no-credentials / no-page-token / publish-failed /
  container-error / rate-limited / etc.) to plain-English copy with
  inline action ("Reconnect Facebook in Settings"). Raw codes still
  go to console.warn for dev observability. Applied across drafts,
  inbox, ugc — all `${label} failed: ${e.message}` patterns gone.
- `components/admin/ui/AdminShell.tsx` — sidebar collapsed to a single
  Marketing entry "Studio" with the sparkles icon. Sub-navigation
  lives inside the marketing area as pill tabs (matches existing
  admin pattern: top-level sidebar, in-section pill nav).

UX decisions locked in:
- Greeting uses first-name only, derived from `useProfileStore.motherName`
  with email fallback. (`profile.name` doesn't exist on the Profile
  interface — that was a bug in v1 of the shell, fixed before commit.)
- Studio open route (`/admin/marketing/create`) is a route, not a modal
  — refresh-safe, deep-linkable, browser-back works.
- Forced onboarding rather than dismissible banner — non-techies need
  the guardrail.
- Pill tab match for Posts also activates on `/drafts`, `/calendar`,
  `/ugc`, `/create` URLs — so legacy deep links still highlight the
  correct nav state.

Bugs caught + fixed during browser verification:
- `<Link asChild>` doesn't accept style arrays on its child Pressable
  — refactored 5 callsites to `useRouter().push` directly.
- `Profile.name` doesn't exist — switched to `useProfileStore.motherName`
  with email fallback.
- Horizontal `ScrollView` defaults to `flex: 1` and balloons vertically
  on web. Fixed pill strip + recent-thumbs strip + Posts sub-tab strip
  with `style={{ flexGrow: 0 }}`.
- UgcStatus value `'pending'` doesn't exist — corrected to `'pending_review'`.

Outstanding (next session):
- Studio Phase 2: actual image-gen canvas at /admin/marketing/create
  (gpt-image-1 + Imagen + style-ref binding). Phase 5 LoRA training
  layered after.
- Webhook signature mystery still open — `META_WEBHOOK_PERMISSIVE=1`
  active. (See "Earlier this session" notes below.)

### Earlier this session
**M4c — FB Page Insights polling shipped. M4c is now feature-complete.**

Context: M4c was originally scoped as "FB feed posting + FB comments
inbox + FB Page Insights." The feed posting + comments inbox pieces
landed earlier this session via the SU→PAT derivation fix (commit
`4bfb349`) and the webhook-subscription work (commit `2a1cced`). The
remaining gap was Insights polling, which this commit closes.

What shipped:
- `functions/src/marketing/insights.ts`:
  - New `fetchFbPostMetrics(fbPostId)` — two parallel calls per post:
    `/{post-id}?fields=likes.summary,comments.summary,shares,reactions.summary`
    for engagement counts + `/{post-id}/insights?metric=post_impressions,
    post_impressions_unique` for reach. Maps both into the existing
    `PostInsightMetrics` shape so the analytics service can sum without
    per-platform branches. FB has no equivalent of IG saves or per-post
    profile-visits — those zero-fill.
  - New `fetchFbAccountSnapshot()` — reads `fan_count` + `followers_count`
    from the page node, plus daily `page_impressions` + `page_impressions_unique`.
    Insights perms can be flaky on small Pages; falls back to fan-count-only
    when /insights returns 4xx.
  - `pollMarketingInsights` (every 6h cron) now also polls FB when
    the draft has `postFbPostId`. FB metrics stored at
    `marketing_drafts/{id}/insights_fb/{ts}` + denormalised onto
    `latestFbInsights` / `latestFbInsightsAt`. IG path unchanged.
  - `pollMarketingAccountInsights` (daily 03:00 IST) now writes
    `fbFanCount`, `fbReach`, `fbImpressions`, `fbFansDelta` alongside
    the existing IG fields on the same `marketing_account_insights/{date}`
    doc. Only written when FB_CONFIGURED + snapshot succeeded — older
    docs stay backward-compat.
  - `generateWeeklyInsightDigest` (Mondays 08:00 IST) sums IG + FB reach
    + engagement when computing the per-post engagement rate, so the
    LLM commentary reflects total cross-platform performance.
- `functions/src/marketing/publisher.ts` — exported `getFbPagePat()`
  so insights.ts can reuse the same memoised SU→PAT derivation. No
  behavioural change.
- `lib/marketingTypes.ts` — `AccountInsightDay` gains optional
  `fbFanCount` / `fbReach` / `fbImpressions` / `fbFansDelta` fields.
  All optional → existing pre-M4c docs deserialize unchanged.
- `services/marketingAnalytics.ts`:
  - `PostWithMetrics` gains `igMetrics` + `fbMetrics` per-platform
    breakdown alongside the combined `metrics` field.
  - New helpers `normaliseMetrics()` + `combineMetrics()` — sum across
    platforms when both are present, else return whichever exists.
  - `AnalyticsTopline` gains `fbFanCount` + `fbFanDelta7d` for the
    new dashboard tile.
- `app/admin/marketing/analytics.tsx`:
  - Topline tiles now show "Reach (7d) · IG+FB", "IG followers",
    and a new "FB Page fans" tile with 7d delta. Layout unchanged
    otherwise (5 tiles instead of 4 — flex-wraps on narrow widths).
  - PostRow shows a "IG", "FB", or "IG+FB" suffix in the meta line
    indicating which platforms contributed metrics.
  - Page description + empty-state body updated to mention FB.

Open follow-ups (not blocking; pick when ready):
- The /admin/marketing/inbox webhook signature mystery from the
  previous session is still open — `META_WEBHOOK_PERMISSIVE=1` is
  active. Per-post FB Insights work independently of the webhook;
  they hit Graph directly with the derived PAT.
- `fb_message` (FB Messenger DMs) still deferred — needs
  `pages_messaging` scope which requires its own App Review pass.
  IG DMs cover most engagement; per-channel split visible in inbox UI.

### Earlier this session
**Unified inbox — webhook subscriptions wired + diagnostic + refresh
button. Awaiting user to re-copy current App Secret to fix strict-mode
signature verification.**

What was wrong:
- App-level subscriptions only had `object: user, fields: [feed]` —
  Meta had no `instagram` or `page` object subscribed, so IG comments/
  DMs/mentions and FB Page feed/mentions were not being delivered to
  our webhook receiver at all.
- Plus: signature verification was rejecting every Meta-sent payload
  with `hash-mismatch`, so even when delivery happened it was 403'd.

What was done (via API, in-session):
- Subscribed app to `object: instagram` with fields `comments,
  mentions, messages, messaging_postbacks, messaging_seen,
  messaging_referral, message_reactions`.
- Subscribed app to `object: page` with `feed, mention, messages,
  messaging_postbacks, message_reactions, message_reads,
  message_deliveries`.
- Subscribed Page `1107050432491903` → MaaMitra app with `feed,
  mention` (Messenger fields require `pages_messaging` scope, deferred).
- Verified subscription state via /{app-id}/subscriptions and
  /{page-id}/subscribed_apps — all green.

Code changes (commit `2a1cced`):
- `functions/src/marketing/inbox.ts` — heavy diagnostic (full sigs,
  body sha256, body base64 for small bodies, secret length + endpoints
  without leaking the secret) + new `META_WEBHOOK_PERMISSIVE` env flag.
- `app/admin/marketing/inbox.tsx` — Refresh button (re-subscribes to
  threads on press), Last-synced timestamp in banner, banner copy
  updated to reflect live webhook state.
- `functions/.env` — set `META_WEBHOOK_PERMISSIVE=1` so events ingest
  while we resolve the signature mismatch (gitignored, env-only).

Outstanding mystery — **Meta is signing webhook payloads with a
secret different from our env `META_APP_SECRET`**:
- 7 HMAC variants tested against a real IG-DM payload (sha256/sha1/md5,
  secret as utf8/hex/base64/reversed, body raw/base64) — NONE matched.
- The same env secret successfully authenticates `app_id|app_secret`
  on debug_token, /me/accounts, and the subscription POSTs we just did
  — so the secret IS valid for *auth*, just not for *webhook signing*.
- Most likely: the App Secret was rotated at some point and Meta's
  auth endpoints accept old values during a grace window while webhook
  signing uses the current one. User to copy current App Secret from
  Meta App Dashboard → Settings → Basic → App Secret → Show, paste
  into `functions/.env` `META_APP_SECRET`, then flip
  `META_WEBHOOK_PERMISSIVE=0` and redeploy `metaWebhookReceiver`.
- IG DM ("Hey" from sender 2082504342326261) DID arrive as the first
  successful ingestion — visible in marketing_inbox/<thread> with
  permissive mode active.

### Earlier this session
**FB Page publish FIXED — System User token vs Page Access Token.**

Root cause (deep audit traced this empirically across every Meta endpoint):
The token in `META_FB_PAGE_ACCESS_TOKEN` is a **System User token**
(debug_token reports type=SYSTEM_USER and `/me` returns
`id=122099819877297791, name=Maaitrasystem` — the System User
identity, not the Page identity). Despite SU tokens looking like Page
tokens (EAA-prefixed, 21 scopes including `pages_manage_posts`), the
**New Pages Experience** rejects them on publish/comment endpoints
with `(#190) error_subcode=2069032 — User access token is not
supported. A Page access token is required for this call for the
new Pages experience.` On `/photos` and `/feed` POSTs Meta returns
the misleading catchall `(#200) publish_actions deprecated`.

The fix: derive a real Page Access Token by calling
`GET /me/accounts?fields=id,access_token` *with* the SU token —
that returns Pages with their proper Page-scoped tokens (tasks
include `MANAGE` + `CREATE_CONTENT`). With the derived PAT,
`POST /{page-id}/photos` returns 200 + a real post_id (verified by
two test posts which were then deleted).

Implementation in `functions/src/marketing/publisher.ts`:
- New `getFbPagePat()` helper — single in-flight Promise memoised
  in module scope. First call exchanges SU→PAT via /me/accounts;
  subsequent calls reuse. PAT derived this way doesn't expire as
  long as the System User keeps Page asset access.
- `publishDraftToFacebook` and `replyToFbComment` both now `await`
  the PAT before hitting Graph; surface `no-page-token` error code
  if /me/accounts can't return a Page (means System User lost
  asset access).
- IG paths unchanged — IG endpoints accept the SU token directly.
- env var `META_FB_PAGE_ACCESS_TOKEN` keeps its name (it's still
  the SU token); the PAT lives only in memory at runtime.

Redeployed: publishMarketingDraftNow, scheduledMarketingPublisher,
metaInboxReplyPublisher (the 3 callers of FB Graph publish/reply).

User-visible: Retry publish on a failed draft should now succeed
on both IG and FB.

### Earlier this session
**Retry-publish button + persistent publish-error card on failed
drafts.**

Symptom: when "Publish now" hit a transient IG/FB error, draft went
to status='failed' and the slide-over only offered Regenerate/Delete
— no way to retry without re-running the LLM generator.

Changes:
- `functions/src/marketing/publisher.ts` `publishMarketingDraftNow`
  now accepts `status='failed'` (in addition to approved/scheduled).
  Same publish path; on success, status flips to 'posted' as usual.
- `app/admin/marketing/drafts.tsx` slide-over:
  - new `Retry publish` primary button visible only on failed drafts
    (reuses the existing `handlePublishNow` handler).
  - persistent "Last publish error" red card in body shows
    `draft.publishError` so a returning admin sees why it failed
    without having to click anything (was only shown ephemerally
    after a click).

Deployed: publishMarketingDraftNow function + web hosting + OTA
(group `7c42d58a-2069-40f5-9e86-26f8c293896f`, runtime 1.0.5).

### Open follow-up — FB Page publish failing
IG publishes successfully now, but FB Page side returns:
`(#200) The permission(s) publish_actions are not available.
It has been deprecated.`
That's Meta's misleading catchall — not actually a deprecated-perm
issue (we have `pages_manage_posts`). Likely the SYSTEM_USER token
(profile_id `122099819877297791`) doesn't have explicit Page asset
access in the Business Portfolio, OR the `/{page-id}/photos` endpoint
needs different params. Next session should:
1. Check Business Portfolio → Users → System Users → assigned assets:
   confirm the System User has Page asset access with `MANAGE` task.
2. If that's set, swap `/{page-id}/photos` to use `source` (multipart
   binary) instead of `url=`, OR try `/{page-id}/feed` with `link=`.

### Earlier this session
**IG publish container-status polling fix.**

Symptom: clicking "Publish now" on /admin/marketing/drafts returned
`publish-failed: Media ID is not available`. Cause: classic IG Graph
API timing race — POST `/{ig-user-id}/media` returns a container id,
but IG processes the image asynchronously; calling
`/media_publish?creation_id=…` before processing completes returns
exactly that error (code 9007).

Fix in `functions/src/marketing/publisher.ts` `publishDraftToInstagram`:
between Step 1 (create container) and Step 2 (publish), poll
`GET /{container-id}?fields=status_code,status` every 3s up to 60s.
Proceed only when `status_code === 'FINISHED'`. Map `ERROR`/`EXPIRED`
to `container-error`, timeout to `container-timeout` (admin can retry).

Also bumped `publishMarketingDraftNow` timeout 60→180s so the new
polling has headroom.

Redeployed: publishMarketingDraftNow, scheduledMarketingPublisher.

### Earlier this session
**Permanent SYSTEM_USER access token wired for FB + IG (M4c-token milestone).**

What changed:
- New `scripts/mint-fb-page-token.mjs` (3-step Meta flow:
  short-lived user token → long-lived user token → never-expiring
  Page token). Reads `META_APP_SECRET` + `META_FB_PAGE_ID` from
  `functions/.env` so the secret never appears on the command line.
- User minted a permanent token; debug_token confirms:
  - type `SYSTEM_USER`, app `MaaMitra`, valid, `expires_at: 0` (never)
  - 21 scopes — every FB Page perm + every IG perm + `ads_management`
    + `ads_read` + `business_management` + `read_insights`
- `functions/.env` updated: `META_IG_ACCESS_TOKEN` now points at the
  same SYSTEM_USER Page token (single permanent token drives every
  marketing surface). The old `IGAATY…` Instagram-Login token was
  the wrong shape and was erroring out (code 190) anyway.
- Verified: GET `/{ig-user-id}` and GET `/{page-id}` both return 200
  with the Page token (`maamitra.official` / `MaaMitra` page).
- Redeployed: pollMarketingInsights, pollMarketingAccountInsights,
  scheduledMarketingPublisher, publishMarketingDraftNow,
  metaInboxReplyPublisher, boostMarketingDraft — all `Successful
  update operation`.

Side effect: **boost-this-post is now functional**. Previously
blocked because `META_IG_ACCESS_TOKEN` lacked `ads_management`;
the Page token has it baked in. M6b's "set boost env vars"
follow-up is no longer needed for token reasons (still need
`META_AD_ACCOUNT_ID` and `META_FB_PAGE_ID` — both already set).

Token is gitignored (`functions/.env` in root `.gitignore`); only
the script + this handoff note are committed.

### Earlier this session
**Admin panel mobile polish shipped** (worktree `claude/eager-grothendieck-0d6818`).

What changed:
- `app/admin/_layout.tsx` — `headerShown: false` for the Stack on every
  width. Previously mobile got both a Stack header AND the AdminPage
  header (double chrome). Now AdminPage owns the title on every screen.
- `components/admin/ui/AdminShell.tsx` — added `AdminDrawerContext`
  exposing `{ available, open }` so descendants can host the hamburger.
  Removed the bottom-left FAB (it overlapped content + chat bubble on
  mobile). The slide-in drawer modal is unchanged.
- `components/admin/ui/AdminPage.tsx` — narrow widths (<900px) get a
  two-row header: top bar with hamburger + back + horizontally-scrolling
  actions; title block full-width below. Tightened body padding from
  Spacing.lg → Spacing.md on narrow.
- `components/admin/ui/StatCard.tsx` — at <700px, drops minWidth 160→140,
  shrinks padding + value font (xxl→xl). Two cards reliably fit per row
  on a 360px screen.
- `app/admin/index.tsx` — KPI grid uses tighter gap on narrow.

Visual verification skipped (Expo cold-start bundler stalled in this
worktree). TypeScript clean. Live verification at
https://maamitra.co.in/admin after deploy.

### Earlier this session
**M6 — UGC pipeline + Boost-this-post shipped** (commits `95a89ec` + `67a6591`).

What's now live:
- `/share-story` (user-facing) — moms submit photo + story + display
  name with explicit consent. Photo upload to gated Storage path
  (admin-read only). DPDP-compliant consent ledger row written.
- `/admin/marketing/ugc` — review queue with status filter chips
  (Pending / Approved / Rendered / Rejected), thumbnail cards,
  slide-over with full preview + Approve / Reject (with reason) /
  Render-as-Real-Story / Delete.
- New `realStoryCard` Satori template (4th template) — 60% photo
  + 40% quote panel with eyebrow + attribution + logo. Falls back
  to brand-color fill when no photo.
- `renderUgcAsDraft` Cloud Function — approved UGC → realStoryCard
  render → marketing_drafts/{id} status='approved' (skips
  pending_review since admin vetted source). Goes through M3
  publish pipeline.
- `boostMarketingDraft` Cloud Function — Marketing API Campaign +
  AdSet + Creative + Ad on a posted draft. Budget ₹100-5000/day,
  duration 1-7 days, India targeting, IG stream + story
  placements. Result stored on `draft.boost`.
- "Boost this post" button on slide-over (posted state, no boost
  yet). Modal asks for daily budget + duration; previews total
  spend cap. Active boost shows status chip with ₹ + reach.
- Storage rules updated for `ugc/{id}/{file}` path.
- Firestore rules updated: users may CREATE pending UGC under
  their own uid; admin has full CRUD.

Required env vars for boost (not yet set, function gracefully
errors with "missing-creds"):
- META_AD_ACCOUNT_ID
- META_FB_PAGE_ID
- ads_management scope on the existing META_IG_ACCESS_TOKEN

UTM attribution — deferred to M6b (iOS deep-linking edge cases
make it a separate session).

### Earlier this session
**M5 — analytics + feedback loop shipped** (commits `2a60b6c` + `a7194ed`).

What's now live (IG-only — FB Page parity deferred until token):
- `pollMarketingInsights` (every 6h) — pulls reach/impressions/likes/
  comments/saved/shares/profile_visits per posted draft via IG Graph
  /{media-id}/insights. Snapshots → marketing_drafts/{id}/insights/{ts};
  latest values denormalised onto the draft.
- `pollMarketingAccountInsights` (daily 03:00 IST) — follower count
  + daily reach/impressions snapshot to marketing_account_insights/
  {YYYY-MM-DD} with computed followersDelta.
- `generateWeeklyInsightDigest` (Mondays 08:00 IST) — gpt-4o-mini
  weekly recap + 3 actionable recommendations stored at
  marketing_insights/{ISO-week-id}.
- M3b publisher now stores `postIgMediaId` at publish time so
  insights polling can find each post.
- runGenerator now self-improves: pillar selection biased 0.5×–2×
  by 30d engagement vs overall avg; caption prompt receives
  "inspiration" from top 3 winning image prompts + a templateHint
  when one template clearly outperforms in the active pillar.
- New `/admin/marketing/analytics` dashboard: 4 topline tiles,
  per-pillar bar chart, per-persona bar chart, top-5 + bottom-5
  posts, weekly digest card.
- Overview shows weekly digest preview card with click-thru to
  full analytics.

### Earlier this session
**M3b + M4b — IG auto-publish + outbound replies shipped** (commits
`174e116` + `e8f26eb`).

End-to-end IG live integration:
- `metaInboxReplyPublisher` (Firestore trigger) — outbound messages
  with outboundStatus='pending_send' auto-send via Graph API. ig_dm
  uses Send API; ig_comment looks up the most recent inbound message's
  externalId and threads as a reply. Synthetic threads no-op to 'sent'.
- `scheduledMarketingPublisher` (pubsub @ every 5 min) — finds
  drafts with status='scheduled' AND scheduledAt<=now, runs the
  IG container/publish flow, marks 'posted' with permalink.
- `publishMarketingDraftNow` (admin callable) — same flow, fires
  immediately. Wired to "Publish now" rocket button on slide-over.
- All 3 functions respect crisisPaused; synthetic drafts skipped.
- FB Page channels (fb_message + fb_comment + FB feed posting)
  deferred to M4c — needs a Page access token, not yet generated.

Webhook setup status:
- `metaWebhookReceiver` deployed + verified ✅ (Section 3 green in
  Meta dashboard for the Instagram use case).
- IG account `maamitra.official` (id `17841418138572653`) connected.
- All 4 META_* env vars in functions/.env: APP_SECRET,
  WEBHOOK_VERIFY_TOKEN, IG_USER_ID, IG_ACCESS_TOKEN.

### Earlier this session
**M4a engagement layer shipped** (commits `875431d` + `ca2ef7b`).

What's now live:
- `/admin/marketing/inbox` — split-pane unified inbox: thread list
  with filter chips (All/Unread/Replied/Resolved/Archived/Spam),
  conversation pane with message bubbles, AI suggest panel, reply
  queue, header actions (re-classify, resolve, spam, archive,
  delete). TEST badge on synthetic threads. Unread dot per row.
- 3 new Cloud Functions:
  - `metaWebhookReceiver` (public HTTPS) — GET handshake +
    HMAC-SHA256 signature verification + idempotent ingestion of
    IG/FB comments and DMs. URL:
    `https://us-central1-maa-mitra-7kird8.cloudfunctions.net/metaWebhookReceiver`
  - `generateInboxReplies` (admin callable) — OpenAI gpt-4o-mini
    returns 3 distinct draft replies (warm/informative/concise) in
    brand voice with compliance forbidden list applied.
  - `classifyInboxThread` (admin callable) — auto-tags sentiment
    + intent + urgency. Updates the thread doc.
- Synthetic test thread injector — admin clicks "Inject test thread"
  to seed realistic inbound messages. Tagged isSynthetic=true with
  TEST badge in UI; CLAUDE.md "no mocks in prod" honoured (opt-in,
  labelled, deletable).
- Outbound replies queue with status='pending_send'. UI explicitly
  says "queued — copy/paste to Meta until M4b lands". Each queued
  outbound message shows a Copy button.
- Overview: Unified inbox checklist row → done; Webhook checklist
  row → "in progress (Awaiting Meta config)". Unread inbox stat
  tile is live + clickable.

M4b (when Meta App Review approves the inbox permissions):
- Set `META_APP_SECRET` + `META_WEBHOOK_VERIFY_TOKEN` in
  `functions/.env`, redeploy `metaWebhookReceiver`.
- Register webhook URL in Meta App Dashboard → subscribe to
  `instagram` (comments + messages) + `pages` (feed + messages).
- Wire outbound Graph API call: ~30 LOC in
  `functions/src/marketing/inbox.ts` next to the receiver. Trigger
  on Firestore write where `outboundStatus=pending_send`, POST to
  `/v21.0/{ig-user-id}/messages` (DM) or `/v21.0/{comment-id}/replies`
  (comment), update message status to `sent` or `failed`.

### Earlier this session
**M3 ship-today scope shipped** (commits `fa7300f` + `8943fef`).

What's now live:
- `/admin/marketing/calendar` — week-grid view of approved + scheduled
  + posted drafts with prev/next/today arrows; click any card →
  opens slide-over via `?open=<id>` deep link.
- Schedule: approved drafts get a Schedule… button that opens a
  datetime-local picker (treats input as IST → UTC ISO). Status
  flips to 'scheduled'. Mark-posted manually publishes once admin
  has pasted to the channels.
- A/B mode: "Generate 2 (A/B)" button on /drafts fires two parallel
  generations with same slot params. Admin picks one, rejects other.
- Crisis pause: BrandKit gains cronEnabled + crisisPaused +
  crisisPauseReason. Cron honours both. Overview shows two toggle
  cards + a sticky red banner when paused.
- Export package: collapsible per-channel ready-to-paste content
  in slide-over (IG, FB, X≤280, LinkedIn, WhatsApp, Email subj+body,
  Push title+body). Pure client-side string transforms — zero LLM
  cost. Each block has Copy + char counter.
- Filter chips on /drafts: now include "Scheduled".

M3b deferred (needs external setup): Meta Graph auto-publish (App
Review pending), LinkedIn / X / YouTube / WhatsApp Business
adapters. Each one is ~50 LOC + an OAuth flow once creds are ready.

### Earlier this session
**M2 content engine + approval queue shipped** (commits `847ed91` + `a169f76`).

What's now live:
- `/admin/marketing/drafts` — live snapshot queue with status filter
  chips, thumbnail cards, slide-over editor (full preview, editable
  caption, compliance flags box, Approve/Reject/Regenerate/Delete).
- "Generate now" button on the queue + Pending-review tile on the
  marketing overview clickable into the queue.
- Approved drafts: Copy-caption + Download-image buttons (manual
  publish mode while Meta App Review is pending).
- 4 Cloud Functions deployed: renderMarketingTemplate (existing),
  scoreMarketingDraft (M1), **generateMarketingDraft** (callable),
  **dailyMarketingDraftCron** (pubsub @ 6am IST).
- Cron is opt-in: set `marketing_brand/main.cronEnabled=true` to
  enable. Default off so test deploys don't generate spam.
- Generator uses OpenAI gpt-4o-mini (already in `functions/.env`)
  for caption JSON, Imagen for image (with Pexels fallback), runs
  M1 compliance scorer, auto-attaches matched disclaimers.
- Full per-draft tagging: persona, pillar, cultural event, locale,
  template, image source, INR cost. Visible in queue + slide-over.
- Firestore index added for `marketing_drafts (status, generatedAt
  DESC)`.

### Earlier this session
**M1 strategic foundation shipped** (commits `4baf769` + `79c2731`).

Roadmap reorganised into milestones M1-M5 (see "Roadmap" section). M1
is the foundation that shapes M2's daily generator.

What shipped in M1:
- BrandKit schema gained personas[], pillars[], culturalCalendar[],
  compliance{forbiddenWords, disclaimers, blockedTopics}, costCaps, and
  a curated illustrations[] bank from `assets/illustrations/` (72 files).
- New /admin/marketing/strategy editor (5 sections, sanitised on save).
- New scoreMarketingDraft Cloud Function (regex compliance screen +
  auto-disclaimer detection). Pairs with the strategy editor.
- renderMarketingTemplate now logs every render to `marketing_cost_log`
  with per-provider INR cost. Spend tile on /admin/marketing/.
- Indian-mom defaults: 5 personas, 7 pillars, 12 cultural events,
  20+ forbidden words, 9 disclaimer rules, ₹200/day + ₹3000/mo caps.
- Marketing palette stays pink (`#E91E63`) — distinct from app's
  purple — deliberate brand-identity split. Logged in user memory.

Web rebuilt + Firebase Hosting deployed. OTA update group
`23d2d778-d8e7-492e-aee5-1ef011b4968b`.

### Earlier this session
**Phase 2 + Imagen + gpt-image-1 providers shipped** (commit `974573f`).
- 4 image providers now wired: Pexels (free stock), FLUX Schnell (cheap
  AI), **Imagen 3 via Gemini API** (default — best Indian context),
  and **OpenAI gpt-image-1** (strongest prompt adherence).
- Cloud Function payload refactored to a discriminated `background`
  union — Phase-3 cron will use the same shape.
- Preview UI is now a two-level picker (Source kind → AI Model)
  with Indian-context-rich default prompts per template.
- Defaults: Tip Card = no bg; Quote/Milestone Card = AI / Imagen.
- Tip Card picker stays hidden (template is text-only by design).
- 4 keys in `functions/.env`: PEXELS_API_KEY, REPLICATE_API_TOKEN,
  GEMINI_API_KEY, OPENAI_API_KEY. (Gitignored via root `.env` rule.)
- Web rebuilt + Firebase Hosting deployed
- OTA published (update group `6f634104-780e-4ee2-a670-12b68f6f892b`)

Live at https://maamitra.co.in/admin/marketing/preview — Tip Card now
shows a hint instead of the picker; Quote Card / Milestone Card pull
real Pexels photos and (optionally) AI backgrounds from FLUX Schnell.

**Earlier fix this session**: previous deploy had shipped a `dist/`
without `index.html` — the entire site was 404'ing. Cleaned + rebuilt
+ redeployed and now both root and admin routes serve correctly.

### Secret-management approach (decided this session)
- We use `functions/.env` (gitignored via root `.gitignore` `.env`
  rule) for Pexels + Replicate. Loaded by Firebase Functions on
  deploy as ordinary env vars.
- Do **not** uncomment the `secrets:` line in
  `functions/src/marketing/index.ts` — that path uses GCP Secret
  Manager which we deliberately bypassed.
- To rotate: edit `functions/.env`, redeploy
  `functions:renderMarketingTemplate`. Done.

### Roadmap (re-organised this session)

The original 8-phase plan was reorganised into 5 milestones (M1-M5).
Each milestone is shippable + end-to-end testable.

- **M1 — Strategic foundation** ✅ Shipped earlier this session.
- **M2 — Content engine + approval queue** ✅ Shipped earlier this session.
- **M3a — Scheduling + calendar + A/B + crisis pause + export** ✅
  Shipped earlier this session.
- **M3b — IG auto-publish (scheduled + manual)** ✅ Shipped earlier.
  LinkedIn / X / YouTube / WhatsApp adapters still deferred.
- **M4a — Engagement (UI + endpoint scaffolding)** ✅ Shipped earlier.
- **M4b — Real Meta wiring (IG)** ✅ Shipped earlier.
- **M5 — Analytics + feedback loop (IG-only)** ✅ Shipped earlier.
- **M6 — UGC + Boost-this-post** ✅ Shipped earlier. UTM
  attribution deferred to M6b.
- **M4c — FB Page parity** ✅ Shipped this session.
  Feed posting + comments inbox + outbound replies came in via the
  SU→PAT derivation fix (`4bfb349`) and webhook subscriptions
  (`2a1cced`); FB Page Insights polling closes the milestone.
  fb_message (Messenger DMs) still deferred — needs `pages_messaging`
  scope which requires its own App Review.
- **M6b — UTM attribution + Boost env config** — small follow-up:
  add UTM params to outbound IG bio URLs, capture on web app
  first-visit, store as users/{uid}.attribution. Plus user adds
  META_AD_ACCOUNT_ID + META_FB_PAGE_ID to .env for boost to fire.
- **M5 — Performance + growth.** Per-post analytics, weekly insight
  digest, feedback loop, UGC pipeline, attribution.

### Next step

Marketing system is feature-complete for IG **and FB Page**, including
UGC + Boost. Two doors:

1. **Stress-test it** — generate / approve / publish (IG+FB) / inbox /
   reply / inject UGC / boost — for 1-2 weeks. Watch analytics +
   feedback loop improve content quality. No more code; just usage.
   Note: per-post FB Insights take ~6h to populate after publish (the
   poll cron interval); FB account-level snapshot is daily at 03:00 IST.
2. **M6b — UTM attribution + Boost env config** — small (~150 LOC):
   user adds META_AD_ACCOUNT_ID + META_FB_PAGE_ID to .env so
   boost actually fires. UTM params on outbound bio URLs + web-app
   first-visit capture → install attribution per post.

Resolve before next session if you want strict webhook signing back on:
- App Secret mismatch — Meta is signing webhook payloads with a secret
  that doesn't match `META_APP_SECRET` in functions/.env (currently
  permissive mode is on). User to copy current App Secret from Meta
  Dashboard → Settings → Basic, paste into env, flip
  `META_WEBHOOK_PERMISSIVE=0`, redeploy `metaWebhookReceiver`.

After those three small follow-ups, the marketing system is
genuinely complete. Anything beyond is product feature work
(LinkedIn, X, YouTube, WhatsApp Business broadcast, etc.) which
each needs its own OAuth + paid API + ~50 LOC adapter.

To enable the daily cron now that M3 is shipped:
- /admin/marketing/ → "Daily 6am IST cron" toggle card → Enable.
- Or write `marketing_brand/main.cronEnabled = true` directly in
  Firestore.
- Pubsub-triggered Function at 6am IST
- Reads brand kit's theme calendar for today's weekday
- Calls Claude Haiku 4.5 for caption + headline + body
- Picks template + image source (rule-based: tipCard for tips, quoteCard
  for wisdom, milestoneCard if AI infers age-related content)
- Calls renderTemplate, writes draft to marketing_drafts/{auto-id}
- Status starts as `pending_review` for the admin to approve.

### Dev preview admin
Local browser previews can bypass auth via
`http://localhost:8081/admin/marketing?previewAdmin=1`. Bypass is
__DEV__-only and stripped from prod builds. See `lib/devPreviewAdmin.ts`.

## Wave summary — what shipped

### Wave 1: Foundation (`809dcba`)
Sidebar shell, design system primitives (AdminPage, DataTable,
StatCard, EmptyState, ConfirmDialog, SlideOver, Toolbar, FilterBar,
StatusBadge), enums in `lib/adminEnums.ts`, `useFirestoreQuery` hook.

### Wave 2: Visibility control (`1e36641`)
`app_config/runtime` Firestore doc drives 13 feature flags + maintenance
mode + force-update prompt + moderation policy. `useFeatureFlag` hook,
`<FeatureGate>`, `<MaintenanceOverlay>`, `<ForceUpdateOverlay>`,
`/admin/visibility` screen. Sticky cohort rollout via FNV bucket.

### Wave 3: Screen rebuilds (`af68209`, `091416a`, `af9f9eb`, `c99c889`, `505e14a`, `ed9fa75`)
All 14 admin screens migrated to AdminPage shell:
dashboard, audit, comments, chat-usage, vaccine-overdue, users (3a/3b);
community, support, feedback, banner (3c); vaccines, content (3d);
users/[uid] (3e); notifications + settings minimal-touch (3f).

### Wave 4: Safety (`fda72d4`)
PII auto-redaction (phone/email/Aadhaar/PAN), crisis-language detection
(PPD/self-harm/abuse/eating disorder), `crisis_queue` collection +
`/admin/safety` screen with Vandrevala hotline. Wired into
`services/social.ts createPost`.

### Wave 5: Targeting (`4bea0e4` shared with Wave 6)
`services/segments.ts` + `admin_segments` collection. `/admin/segments`
with chip multi-select for states / parent-roles / audience-buckets,
number ranges for kids + days-active, push-only switch, **live
preview** that counts matching users without saving.

### Wave 6: CMS draft/publish + what's-new (`4bea0e4`)
Content collections (books/articles/products/schemes/yoga) gated by
`status != 'draft'` for non-admin reads. New items default to draft.
Publish/Unpublish toggle in form footer. `services/whatsNew.ts` +
`/admin/whatsnew` for monotonic-version release-notes modal.

### Wave 7: Org maturity (`37e37f1` shared with Wave 8)
- DPDP consent ledger: `services/consent.ts` + `consent_ledger`
  collection (append-only, deletes denied) + `/admin/consent`. RTBF
  processing emits a withdrawn-now row + audits `rtbf.process`.
- Custom roles: `services/customRoles.ts` + `admin_roles` collection +
  `/admin/roles` with capability matrix view + custom-role editor.

### Wave 8: Ops + AI (`37e37f1`)
- `services/adminAi.ts`: piggybacks on the user-chat Cloudflare Worker
  with task-specific system prompts. `draftTicketReply` and
  `summarizeUser` entry points.
- `store/useImpersonationStore.ts` + `<ImpersonationBanner>`: view-as
  user. Tracks target uid + name; sticky orange bar at top of every
  screen while active. Audit-logged on start/end.
- `app/admin/users/[uid].tsx`: "AI summary" + "View as" header buttons.
- `app/admin/support.tsx`: "AI draft" button proposes a reply.

## Deployed to prod
Latest deploy: 2026-05-03.
- **Firestore rules**: includes /app_config, /crisis_queue,
  /admin_segments, /admin_roles, /consent_ledger, content
  draft-gate.
- **Web hosting**: https://maa-mitra-7kird8.web.app +
  https://maamitra.co.in
- **Android/iOS OTA**: latest update group
  `5323e6ff-c70a-44ac-85c2-758e8fbbe282`, runtime 1.0.5, message
  "waves 7+8".

## Open follow-ups (not blocking; pick when ready)

**Wired but not yet client-consumed:**
- Custom-role capability gating: `services/customRoles.ts` writes
  rows but `lib/admin.ts can()` only checks built-in roles. To
  activate a custom role, extend `can()` to also consult an
  in-memory cache populated from `listCustomRoles()` at mount.
- Impersonation read path: `useImpersonationStore` is plumbed but
  no user-facing screens read from it yet. Pick the most useful
  one (e.g. `/(tabs)/community`) and have it read `targetUid ??
  authUser.uid` so the admin sees the impersonated user's feed.
- Consent recording: `recordConsent()` exists but the onboarding /
  privacy-policy screens don't yet call it. Wire from
  `app/(auth)/onboarding.tsx` final step.
- Lifecycle automation, A/B test runner, push template library:
  scaffolded as deferred Wave 5 items in earlier handoff; segments
  alone unblock most use cases.
- BigQuery export: needs Firebase Extension config; not coded.
- Vaccine schedule versioning + two-person signoff: out of scope
  for this overhaul; opens in a future clinical-safety pass.
- Cloud Functions log viewer: needs Logging API access; deferred.

**Earlier queued chat work (still valid):**
- Phase 1: expand ChatContext + buildContext() in
  `app/(tabs)/chat.tsx` to surface growthTracking, foodTracking,
  health checklist gaps, all kids, time-of-day, days-since-last-chat.
- Phase 2: `users/{uid}/memory` doc with facts/concerns/preferences,
  fed by tiny secondary Claude extraction call.

## In-flight side processes
- None.

## Known constraints / gotchas
- **Shared branch is `main` only.** Pull/rebase before work and
  before every commit.
- **OTA `safe-update.sh` bypass** required when local branch isn't
  `main` (worktrees push to `main` from a `claude/*` branch). Use
  `SAFE_UPDATE_BYPASS=1 npm run update` after confirming tree clean.
- **node_modules symlink in worktree.** `ln -s
  /Users/vijay/Documents/Claude/Projects/App/Maamitra/node_modules
  node_modules`. Removed before each safe-update; recreated after.
- **Wave 4 safety pipeline** runs only from
  `services/social.ts createPost`. Comments / DMs are NOT yet wired.
- **adminAi.ts** uses the SAME Cloudflare Worker as the user-facing
  chat. Worker enforces auth (Firebase ID token) and rate limits.
  No new server config needed.
- **Wave 8 impersonation is view-as, not session-swap.** The admin's
  Firebase identity is unchanged; this is for support debugging,
  not for acting on behalf of users.

## Recent commits
- `67a6591` chore(functions) — rebuild lib/ for M6 UGC + boost
- `95a89ec` feat(marketing) — M6 UGC pipeline + Boost-this-post
- `a7194ed` chore(functions) — rebuild lib/ for M5 insights
- `2a60b6c` feat(marketing) — M5 analytics + feedback loop
- `e8f26eb` chore(functions) — rebuild lib/ for M3b+M4b publisher
- `174e116` feat(marketing) — M3b+M4b IG auto-publish + outbound replies
- `ca2ef7b` chore(functions) — rebuild lib/ for M4 webhook + AI inbox
- `875431d` feat(marketing) — M4a unified inbox + webhook + AI replies
- `8943fef` chore(functions) — rebuild lib/ for M3 cron crisis check
- `fa7300f` feat(marketing) — M3 scheduling/calendar/A/B/crisis/export
- `a169f76` chore(functions) — rebuild lib/ for M2 generator + cron
- `847ed91` feat(marketing) — M2 content engine + approval queue
- `2488234` docs(handoff) — record M1 shipped + new M1-M5 roadmap
- `79c2731` chore(functions) — rebuild lib/ for M1 scoring + cost log
- `4baf769` feat(marketing) — M1 strategic foundation
- `4c0c35e` chore(functions) — rebuild lib/ for new providers
- `974573f` feat(marketing) — Imagen + gpt-image-1 providers, two-level picker
- `26e39f7` docs(handoff) — Pexels/Replicate live; Tip Card fix shipped
- `8f5abbc` fix(marketing) — hide bg-image picker for Tip Card
- `4334dc9` docs(handoff) — Phase 2 shipped
- `63d1cf1` feat(marketing) — Phase 2 (Satori + 3 templates)
- `45b362f` docs(handoff) — Phase 1 shipped
- `d42f24f` feat(marketing) — Phase 1 foundation + brand kit editor
- `37e37f1` waves 7+8 — DPDP, custom roles, impersonation, AI assist
- `4bea0e4` waves 5+6 — segments, draft/publish, what's new
- `ed9fa75` wave 3f — notifications + settings (Wave 3 complete)
- `505e14a` wave 3e — users/[uid]
- `c99c889` wave 3d — vaccines + content
- `af9f9eb` wave 3c — community + support + feedback + banner
- `091416a` wave 3b — users + null-guard
- `af68209` wave 3a — dashboard + audit + comments + chat-usage + vaccine-overdue
- `fda72d4` wave 4 safety
- `1e36641` wave 2 visibility control
- `809dcba` wave 1 foundation
