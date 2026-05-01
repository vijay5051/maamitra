# Handoff state

> **Read this first** when starting any session. It tracks what's
> in flight so a different agent (Claude / Codex) can resume without
> re-asking the user.
>
> **Update this file constantly** — at task start, after every commit,
> before every reply. See `.claude/CLAUDE.md` § "Continuous handoff".

---

## Active task
Fix intermittent Community tab crash that showed the root retry screen
when opening Community on mobile/web.

## Status
✅ Done by Codex. Root cause found in `components/community/PostCard.tsx`:
the component referenced `Fonts` in styles without importing it, so loading
the Community bundle could throw at module evaluation. Also hardened the
latest-comment preview model so malformed/missing comment data cannot crash
the card.

## Last action
Committed and pushed `f97047e Fix community crash on open` to `main`.
Published Android/iOS OTA update group
`2772745a-b67f-4d90-b7e4-2a9d6cb6818e` and deployed Firebase Hosting.
`npx tsc --noEmit` still only fails on unrelated pre-existing
`services/admin.ts(132)` (`"factory.reset"` not assignable to `AdminAction`).

## Next step
None for this crash. If it recurs, inspect production console/error logs for
a new stack trace; the known `PostCard` module crash is fixed and deployed.

## In-flight side processes (don't accidentally restart these)
- **EAS Android build:** `90c536ef-e74c-4b1a-b245-e1f14bf22d0b` —
  versionCode 22, includes AD_ID plugin + Codex's recovered morning
  work. Watch progress at:
  https://expo.dev/accounts/rockingvsr/projects/maamitra/builds/90c536ef-e74c-4b1a-b245-e1f14bf22d0b
  When finished, the user uploads the AAB manually to Play Console.

## Known constraints / gotchas
- **Shared branch is `main` only.** Do not create `codex/*` or `feat/*`
  branches. Pull/rebase before work, before every commit, and push
  immediately after every commit.
- **"Push" means user-facing deploy.** After pushing JS-only changes to
  `main`, run `npm run update` for Android/iOS OTA and deploy web hosting.
- **`scripts/safe-update.sh`** guards `npm run update` against publishing
  from a dirty / out-of-sync tree. It now auto-supplies the latest commit
  subject as `--message`, `--environment production`, and `--non-interactive`.
  Bypass only via `SAFE_UPDATE_BYPASS=1`.

## Recent commits to be aware of
Run `git log --oneline -10` for the latest. As of writing:
- `b6f0e02` chore(process): unified Claude+Codex workflow + safe-update guard
- `b47c4c2` chore(release): bump android.versionCode 21 → 22
- `ad488a0` recover: morning OTA work — community/health/home heroes, family fixes
- `2e12fd7` chore(android): drop AD_ID permission via config plugin
- `13a4fa0` chore(chat): drop MaaMitra brand text from conversation header
