# Handoff state

> **Read this first** when starting any session. It tracks what's
> in flight so a different agent (Claude / Codex) can resume without
> re-asking the user.

---

## Active task
**Admin panel — full overhaul.** All 8 waves SHIPPED + DEPLOYED.
No active sub-task.

Worktree: `claude/competent-agnesi-a53c43` (pushes to `main`).

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
