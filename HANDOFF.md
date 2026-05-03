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
**Phase 2 fully wired up + Tip Card UI fix** (commit `8f5abbc`).
- Pexels + Replicate keys loaded via `functions/.env` (gitignored)
- functions:renderMarketingTemplate redeployed (now reads keys via
  `process.env.*`, no Secret Manager / `secrets:` line needed)
- Tip Card UI: hides Pexels/AI picker since template is text-only
  by design (was a dead-click violation)
- Web rebuilt + Firebase Hosting deployed
- OTA published (update group `63e3ea9e-566b-4da2-bfae-843e66cbe3ea`)

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

### Next step
**Phase 3 — daily draft generation cron**:
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
