# Handoff state

> **Read this first** when starting any session. It tracks what's
> in flight so a different agent (Claude / Codex) can resume without
> re-asking the user.
>
> **Update this file constantly** — at task start, after every commit,
> before every reply. See `.claude/CLAUDE.md` § "Continuous handoff".

---

## Active task
Fix Community comment count showing 0 while comments are visible.

## Status
✅ Done by Codex. Patched comment count reconciliation to merge both
comment arrays (`comments` and `commentList`) instead of letting an empty loaded
list mask existing comments. Loading comments now also repairs the parent
Firestore `commentCount` / latest-comment summary from the actual subcollection.

## Last action
Committed and pushed `168f589 Fix visible comments showing zero count`.
Published Android/iOS OTA update group
`a63f0d06-8860-44f7-8610-06ea94dd49b2` and deployed Firebase Hosting.
`npx tsc --noEmit` passes.

## Next step
None for this comment-count fix.

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
