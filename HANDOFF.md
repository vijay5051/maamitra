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
- **M4b — Real Meta wiring (IG)** ✅ Shipped earlier. FB Page
  (fb_message + fb_comment + FB feed posts) deferred to M4c —
  needs Page Access Token + Page ID.
- **M5 — Analytics + feedback loop (IG-only)** ✅ Shipped earlier.
- **M6 — UGC + Boost-this-post** ✅ Shipped this session. UTM
  attribution deferred to M6b.
- **M4c / M5-FB** — FB Page wiring + FB Insights (deferred until
  user generates META_FB_PAGE_ID + META_FB_PAGE_ACCESS_TOKEN; the
  Manage Pages use case has the perms granted but the token UI
  was hard to locate in the new dashboard layout).
- **M6b — UTM attribution + Boost env config** — small follow-up:
  add UTM params to outbound IG bio URLs, capture on web app
  first-visit, store as users/{uid}.attribution. Plus user adds
  META_AD_ACCOUNT_ID + META_FB_PAGE_ID to .env for boost to fire.
- **M5 — Performance + growth.** Per-post analytics, weekly insight
  digest, feedback loop, UGC pipeline, attribution.

### Next step

Marketing system is feature-complete for IG including UGC + Boost.
Three doors:

1. **Stress-test it** — generate / approve / publish / inbox /
   reply / inject UGC / boost — for 1-2 weeks. Watch analytics +
   feedback loop improve content quality. No more code; just usage.
2. **M6b — UTM attribution + Boost env config** — small (~150 LOC):
   user adds META_AD_ACCOUNT_ID + META_FB_PAGE_ID to .env so
   boost actually fires. UTM params on outbound bio URLs + web-app
   first-visit capture → install attribution per post.
3. **M4c — FB Page parity** — when user has Page Access Token,
   ~120 LOC adds FB feed posting + FB comments inbox + FB Page
   Insights to M3b/M4b/M5 paths.

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
