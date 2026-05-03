# Handoff state

> **Read this first** when starting any session. It tracks what's
> in flight so a different agent (Claude / Codex) can resume without
> re-asking the user.
>
> **Update this file constantly** — at task start, after every commit,
> before every reply. See `.claude/CLAUDE.md` § "Continuous handoff".

---

## Active task
**Admin panel — full overhaul ("billion-dollar redesign").**
User asked for a complete redesign of `/admin` (17 screens, ~7.5k LoC,
no shared shell, no feature flags, magic strings everywhere) plus
brand-new visibility-control / feature-flag / kill-switch capability
across the live app.

Worktree: `claude/competent-agnesi-a53c43`. Multi-day, shipped wave by
wave with a commit + push between each. Each wave must end with
`tsc --noEmit` clean + commit + push.

## Wave plan
1. **Foundation** — sidebar shell, design system primitives, status
   enums, query hook. *(code complete; commit pending)*
2. **Visibility control**: `app_config/runtime` doc, `useFeatureFlag`,
   `<FeatureGate>`, `/admin/visibility` screen, gate user-facing tabs,
   maintenance overlay, force-update prompt, OTA rollback UI.
3. **Screen rebuilds** on the new primitives.
4. **Safety & moderation**: image moderation, PII auto-redact,
   crisis-language → wellness queue, real approval queue, bulk
   inbox triage (j/k/e/r/s + snooze + assign + internal notes).
5. **Targeting & notifications**: segment builder, audience preview,
   lifecycle automation, A/B runner, template library.
6. **Analytics & CMS**: BigQuery mirror, cohort retention, funnel
   editor, draft→preview→publish, scheduled publish, i18n console.
7. **Org maturity**: custom roles UI, viewer role, per-role PII
   redaction, immutable audit, vaccine versioning w/ two-person
   signoff, DPDP consent ledger, RTBF queue.
8. **Ops & AI**: Functions log viewer, cron retry/replay, user
   impersonation, Claude-assisted replies + summaries + anomaly
   callouts.

## Wave 1 — foundation (code complete, pending commit)
New files:
- `lib/adminEnums.ts` — typed enums + labels + colour mapping for
  TicketStatus, PostStatus, HideReason, AuditAction, CommunityTopic,
  PushAudience, CrisisSeverity. Single source of truth replacing
  magic strings inlined across 17 screens.
- `lib/useFirestoreQuery.ts` — generic paginated/live Firestore hook.
- `components/admin/ui/AdminShell.tsx` — persistent sidebar on
  wide-web (>=1100px), hamburger drawer on narrow/native. Grouped IA:
  Overview · People · Content · Engagement · Operations · Visibility ·
  Settings. Each item gated by `can(role, cap)`.
- `components/admin/ui/AdminPage.tsx` — page wrapper with breadcrumb,
  header actions slot, sticky toolbar slot, loading/error rails.
- `components/admin/ui/DataTable.tsx` — sortable, paginated,
  bulk-select, sticky header, typed empty/loading/error states.
- `components/admin/ui/StatCard.tsx` — KPI card with delta pill.
- `components/admin/ui/EmptyState.tsx` — typed kind=empty|loading|error.
- `components/admin/ui/ConfirmDialog.tsx` — modal w/ destructive
  variant + require-typing-to-confirm guard.
- `components/admin/ui/SlideOver.tsx` — right-side detail panel.
- `components/admin/ui/Toolbar.tsx` + `ToolbarButton`.
- `components/admin/ui/FilterBar.tsx` — chip row w/ counts.
- `components/admin/ui/StatusBadge.tsx` — colored badge.
- `components/admin/ui/index.ts` — barrel.

Modified:
- `app/admin/_layout.tsx` — wraps existing `<Stack>` in `<AdminShell>`.
  On wide-web hides redundant Stack header (AdminPage renders its
  own); on narrow keeps it so unmigrated screens still have nav.
  Founder bootstrap → 'super' role.

Notes:
- `npx tsc --noEmit` clean.
- No existing screens migrated yet — Wave 3 does that. Wave 1 is
  pure foundation: existing screens render unchanged inside the new
  shell.
- Nav has a **Visibility** entry pointing to a screen Wave 2 creates.
- New audit-log actions are seeded in `adminEnums.ts` for future
  waves; existing audit log keeps working.

## Status
Wave 1 code complete. tsc passes. Commit + push next, then Wave 2.

## Last action
Wrote Wave 1 foundation files + rewired `app/admin/_layout.tsx`.

## Next step
1. Commit Wave 1, push to `main`.
2. Wave 2: build `services/featureFlags.ts`, `useFeatureFlag` hook,
   `<FeatureGate>` wrapper, `app/admin/visibility.tsx` screen,
   maintenance mode overlay in root layout, force-update prompt.

## Earlier queued follow-ups (still valid)
- **Phase 1 (profile surfacing):** expand `ChatContext` + `buildContext()`
  in `app/(tabs)/chat.tsx` to surface growthTracking, foodTracking,
  healthTracking checklist gaps, all kids (not just active), local
  time-of-day, days-since-last-chat.
- **Phase 2 (learned facts memory):** new `users/{uid}/memory` doc
  with facts/concerns/preferences arrays, fed by tiny secondary
  Claude extraction call.

## In-flight side processes
- None.

## Known constraints / gotchas
- **Shared branch is `main` only.** Pull/rebase before work and
  before every commit. Push immediately after every commit.
- **"Push" means user-facing deploy.** After pushing JS-only changes,
  run `npm run update` for Android/iOS OTA and Firebase Hosting deploy.
- **`scripts/safe-update.sh`** guards against dirty/out-of-sync trees.
- **Wide-web header is suppressed** when sidebar shows. Until a screen
  migrates to AdminPage it has no title bar on wide-web — intentional
  (Wave 3 fixes it).

## Recent commits to be aware of
Run `git log --oneline -10` for the latest.
