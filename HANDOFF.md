# Handoff state

> **Read this first** when starting any session. It tracks what's
> in flight so a different agent (Claude / Codex) can resume without
> re-asking the user.

---

## Active task
**Admin panel — full overhaul.** Waves 1–4 shipped + deployed.
Wave 3 now COMPLETE (all 14 admin screens migrated). Waves 5–8
deferred.

Worktree: `claude/competent-agnesi-a53c43` (pushes to `main`).

## Wave plan & status
1. **Foundation** ✅ shipped (`809dcba`)
2. **Visibility control** ✅ shipped (`1e36641`)
3. **Screen rebuilds** ✅ COMPLETE (all 14 screens):
   - 3a (`af68209`): dashboard, audit, comments, chat-usage, vaccine-overdue
   - 3b (`091416a`): users
   - 3c (`af9f9eb`): community, support, feedback, banner
   - 3d (`c99c889`): vaccines, content
   - 3e (`505e14a`): users/[uid]
   - 3f: notifications + settings (this commit — minimal AdminPage wrap;
     inner Compose/Outbox/Schedule and Feature-Flags/Theme/Admin-team
     panels preserved as-is)
4. **Safety & moderation** ✅ shipped (`fda72d4`)

5–8 deferred. Notes for resumption below.

## Deployed to prod
- Firestore rules (Wave 2 + Wave 4 match blocks)
- Web hosting at https://maa-mitra-7kird8.web.app + https://maamitra.co.in
- Android/iOS OTA, runtime 1.0.5

After this Wave 3f commit, re-run the deploy chain to ship the new
screens (Firestore rules unchanged; only TypeScript / hosting / OTA).

## Wave 3f notes (notifications + settings)
notifications.tsx: minimal touch — outer screen now wraps in
`<AdminPage title="Notifications" …>` with `<FilterBar>` replacing
the bespoke tab bar. The three sub-tabs (ComposeTab, OutboxList,
ScheduleList) and their internal layouts are unchanged. Refresh
moved to a header action.

settings.tsx: minimal touch — `<ScrollView>` wrapper replaced by
`<AdminPage title="App settings" …>` with crumbs. All sections
(Feature Flags, Rollout %, Admin team, Theme, Tab Config, Save All)
are untouched. Description points to /admin/visibility for the new
flag system; this screen still drives the legacy app_settings doc.

Future polish (deferable): rebuild ComposeTab on the design system
+ add audience preview before send (already proposed for Wave 5).

## Next step (Waves 5–8 deferred — resume here)
Order by leverage-per-hour:

**Wave 5 — Targeting & notifications**
- `services/segments.ts` — saved audience definitions.
- Audience-preview helper for the existing notifications/Compose.
- Lifecycle automation skeleton.
- Push template library.
- A/B test runner.

**Wave 6 — Analytics & CMS**
- BigQuery export wiring (Firebase extension).
- Cohort retention curves + funnel editor.
- Draft → preview → publish for content.
- Scheduled publish, i18n console, what's-new publisher.

**Wave 7 — Org maturity**
- Custom roles UI replacing the four hardcoded roles.
- Read-only "viewer" role.
- Per-role PII redaction.
- Immutable audit log w/ hash chain.
- Vaccine schedule versioning + two-person signoff.
- DPDP consent ledger.
- RTBF queue.

**Wave 8 — Ops & AI**
- Cloud Functions log viewer + cron retry/replay.
- User impersonation ("view as").
- Claude-assisted ticket replies + 30-day user summaries.
- Dashboard anomaly callouts.

## Earlier queued follow-ups (still valid)
- **Phase 1 (chat profile surfacing):** expand `ChatContext` +
  `buildContext()` in `app/(tabs)/chat.tsx` to surface growthTracking,
  foodTracking, healthTracking checklist gaps, all kids (not just
  active), local time-of-day, days-since-last-chat.
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
  `SAFE_UPDATE_BYPASS=1 npm run update` after confirming tree clean.
- **Wide-web Stack header is suppressed** when sidebar shows.
  Every admin screen now renders its own AdminPage header so this
  no longer creates blank-title panes.
- **node_modules symlink in worktree.** Required for the bundler.
  `ln -s /Users/vijay/Documents/Claude/Projects/App/Maamitra/node_modules node_modules`
  Removed before each safe-update; recreated after.
- **Wave 4 safety pipeline** runs client-side from `services/social.ts
  createPost`. Comments / DMs are NOT yet wired — extend similarly
  from `addCommentFirestore` and DM creation when needed. Image
  moderation is not yet wired.

## Recent commits
- `505e14a` feat(admin): wave 3e — users/[uid]
- `c99c889` feat(admin): wave 3d — vaccines + content
- `af9f9eb` feat(admin): wave 3c — community + support + feedback + banner
- `091416a` feat(admin): wave 3b — users + null-guard runtime config
- `af68209` feat(admin): wave 3a — dashboard + audit + comments + chat-usage + vaccine-overdue
- `fda72d4` feat(admin): wave 4 safety
- `1e36641` feat(admin): wave 2 visibility control
- `809dcba` feat(admin): wave 1 foundation
