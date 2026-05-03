# Handoff state

> **Read this first** when starting any session. It tracks what's
> in flight so a different agent (Claude / Codex) can resume without
> re-asking the user.

---

## Active task
**Admin panel — full overhaul ("billion-dollar redesign").**
Multi-day, ships wave by wave. Waves 1–4 LANDED + DEPLOYED to prod
(Firestore rules, web hosting, Android/iOS OTA). Waves 5–8 deferred.

Worktree: `claude/competent-agnesi-a53c43` (pushes to `main`).

## Wave plan & status
1. **Foundation** — sidebar shell, design system primitives, status enums,
   query hook. ✅ shipped (`809dcba`).
2. **Visibility control** — `app_config/runtime` doc + admin screen +
   maintenance overlay + force-update prompt + 13 feature flags with
   sticky cohort rollout. ✅ shipped (`1e36641`).
3. **Screen rebuilds** — 6 of 14 admin screens migrated:
   dashboard, audit, comments, chat-usage, vaccine-overdue, users.
   ✅ shipped (`af68209`, `091416a`).
   Remaining 8 screens still on old style but functional inside the
   new shell: **feedback, banner, support, vaccines, content,
   community, notifications, settings, users/[uid]**. Lower-priority
   polish — they work, they just don't have AdminPage breadcrumbs +
   DataTable yet.
4. **Safety & moderation** — PII redaction, crisis detection (PPD,
   self-harm, abuse, eating disorder), `crisis_queue` collection,
   `/admin/safety` queue with hotline + take/resolve/escalate actions,
   `moderation.requireApproval` and `autoHideKeywords` wired into
   `services/social.ts createPost`. ✅ shipped (`fda72d4`).

5–8 deferred. Notes for resumption below.

## Deployed to prod
- Firestore rules (`firebase deploy --only firestore:rules`). New
  match blocks: `/app_config/{docId}` (Wave 2), `/crisis_queue/{docId}`
  (Wave 4).
- Web hosting (`firebase deploy --only hosting`). Live at
  https://maa-mitra-7kird8.web.app and https://maamitra.co.in.
- Android/iOS OTA (`SAFE_UPDATE_BYPASS=1 npm run update`). Update
  group `40a356fe-ad9f-4ceb-931a-1bd00750ad6c`, runtime 1.0.5,
  message "wave 4 safety".

The bypass was used because `safe-update.sh` checks `origin/$branch`
but this worktree's local branch is `claude/competent-agnesi-a53c43`
while it pushes to `main`. State at deploy was: tree clean, all
commits on `main`. Future sessions: same pattern is safe under the
"single shared `main`" rule (CLAUDE.md §3).

## Files touched (high level)
**Wave 1**: `lib/adminEnums.ts`, `lib/useFirestoreQuery.ts`,
`components/admin/ui/{AdminShell,AdminPage,DataTable,StatCard,
EmptyState,ConfirmDialog,SlideOver,Toolbar,FilterBar,StatusBadge,
index}.tsx`, modified `app/admin/_layout.tsx`.

**Wave 2**: `services/featureFlags.ts`,
`store/useRuntimeConfigStore.ts`, `lib/useFeatureFlag.ts`,
`components/{FeatureGate,MaintenanceOverlay,ForceUpdateOverlay}.tsx`,
`app/admin/visibility.tsx`, modified `app/_layout.tsx`,
`services/audit.ts` (extended action union), `firestore.rules`
(+`/app_config/{docId}`).

**Wave 3a/3b**: rewrote `app/admin/{index,audit,comments,chat-usage,
vaccine-overdue,users}.tsx` on the new design system. Shrunk total
LoC by ~300 across these six.

**Wave 4**: `lib/{piiRedact,crisisDetect}.ts`, `services/safety.ts`,
`app/admin/safety.tsx`, modified `services/social.ts createPost` to
run the safety pipeline, `firestore.rules` (+`/crisis_queue/{docId}`),
nav entry in `components/admin/ui/AdminShell.tsx`.

## Status
✅ Waves 1–4 shipped + deployed end-to-end. App boots clean, no
console errors, /admin/visibility and /admin/safety load correctly,
welcome screen + auth flow unaffected.

## Last action
Deployed Firestore rules, web hosting, and Android/iOS OTA to prod.
Live URL https://maamitra.co.in is on the new code.

## Next step (Waves 5–8 deferred — resume here)
Order by leverage-per-hour:

**Wave 5 — Targeting & notifications**
- `services/segments.ts` — saved audience definitions (state, role,
  kid age band, days-since-active). Stored in `admin_segments`
  collection.
- Audience-preview helper: count users matching a segment before push
  send. Drop into `app/admin/notifications.tsx` compose form. Hard
  guard: typing "ALL USERS" required when audience >5k.
- Lifecycle automation skeleton — flow definitions in
  `admin_lifecycle_flows`, evaluated by a new daily cron.
- Push template library — `admin_push_templates` with variable
  interpolation `{{kidName}}`.
- A/B test runner — variant assignment tied to feature flags via
  the same FNV bucket. Track conversion in `admin_ab_results`.

**Wave 6 — Analytics & CMS**
- BigQuery export wiring (one-time: enable Firestore→BigQuery via
  Firebase Extensions). Then SQL-backed cohort retention curves +
  funnel editor in admin.
- Draft → preview → publish for `articles/books/products/schemes/
  yoga`. Add `status: 'draft'|'published'` field, gate reads in
  `firestore.rules` so non-admins only see published.
- Scheduled publish (cron flips status when scheduledFor < now).
- i18n console — `i18n_strings` collection, edit Hindi/English
  without OTA. Client subscribes and merges over baked-in defaults.
- What's-new publisher — `app_config/whatsnew` doc, shows in-app on
  first open after a bump.

**Wave 7 — Org maturity**
- Custom roles UI — `admin_roles` collection with capability
  checkbox arrays, replacing the four hardcoded roles in `lib/
  admin.ts`. Existing roles seeded as defaults. Roles UI at
  `/admin/roles`.
- Read-only "viewer" role (KPIs only, no writes).
- Per-role PII redaction — when role lacks `view_pii_full`, the
  user 360 hides phone/email last 4 digits.
- Immutable audit log — separate `admin_audit_immutable` collection
  with deny-delete rule + hash chain in metadata.
- Vaccine schedule versioning — `vaccine_schedule_versions` with
  two-person signoff (proposer + approver, both audit-logged).
- DPDP consent ledger — `consent_ledger/{uid}/versions/{version}`
  with timestamp + IP, written when user accepts privacy policy.
- RTBF queue — `rtbf_requests` with SLA timer, drives the existing
  DSAR delete in services/admin.ts.

**Wave 8 — Ops & AI**
- Cloud Functions log viewer — proxies Logging API into
  `/admin/ops/functions`, last N invocations per function.
- Cron retry/replay — admin button to re-fire a failed scheduled
  job from the panel.
- User impersonation ("view as") — short-lived custom token that
  flips client into read-only sandbox, audit-logged on start/end
  (action codes already declared: `user.impersonate.start/end`).
- Claude-assisted ticket replies — Claude proposes draft, admin
  edits + sends. Backed by `services/claude.ts`.
- 30-day user summary — single click in user 360 produces a Claude
  summary of the user's activity.
- Dashboard anomaly callouts — daily compute "X dropped 40% vs 7d
  avg", surface as cards on the dashboard.

## Earlier queued follow-ups (still valid)
- **Phase 1 (chat profile surfacing):** expand `ChatContext` +
  `buildContext()` in `app/(tabs)/chat.tsx` to surface growthTracking,
  foodTracking, healthTracking checklist gaps, all kids (not just
  active), local time-of-day, days-since-last-chat. No new writes.
- **Phase 2 (learned facts memory):** new `users/{uid}/memory` doc
  with facts/concerns/preferences arrays, fed by tiny secondary
  Claude extraction call.

## In-flight side processes
- None.

## Known constraints / gotchas
- **Shared branch is `main` only.** Pull/rebase before work and
  before every commit. Push immediately after every commit.
- **OTA `safe-update.sh` bypass** required when local branch isn't
  `main` (worktrees push to `main` from a `claude/*` branch). Use
  `SAFE_UPDATE_BYPASS=1 npm run update` after confirming tree clean
  and all commits on `origin/main`.
- **Wide-web Stack header is suppressed** when sidebar shows. Until
  a screen migrates to AdminPage it has no title bar on wide-web —
  intentional. The 8 unmigrated screens (feedback, banner, support,
  vaccines, content, community, notifications, settings,
  users/[uid]) still render their own LinearGradient headers from
  the old style. This is fine on narrow but visually inconsistent
  on wide.
- **node_modules symlink in worktree.** Required for the bundler
  to find packages (worktree has no real `node_modules`). The
  symlink is gitignored as a path but `git status` still flags it
  as untracked because gitignore patterns with trailing `/` don't
  match symlinks. Removed before deploy then recreated for dev.
  If the symlink is missing on a fresh worktree clone:
  `ln -s /Users/vijay/Documents/Claude/Projects/App/Maamitra/node_modules node_modules`
- **Wave 4 safety pipeline** runs client-side from `services/
  social.ts createPost`. Comments / DMs are NOT yet wired — extend
  similarly from `addCommentFirestore` and DM creation when needed.
  Image moderation is not yet wired (would need Cloud Vision API).

## Recent commits
- `fda72d4` feat(admin): wave 4 safety
- `091416a` feat(admin): wave 3b — users + null-guard runtime config
- `af68209` feat(admin): wave 3a — dashboard + audit + comments + chat-usage + vaccine-overdue
- `1e36641` feat(admin): wave 2 visibility control
- `809dcba` feat(admin): wave 1 foundation
- `f67831d` feat(community): five-wave overhaul (previous task)
