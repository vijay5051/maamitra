# Handoff state

> **Read this first** when starting any session. It tracks what's
> in flight so a different agent (Claude / Codex) can resume without
> re-asking the user.
>
> **Update this file constantly** — at task start, after every commit,
> before every reply. See `.claude/CLAUDE.md` § "Continuous handoff".

---

## Active task
Set up a continuous handoff system so Claude ↔ Codex can take over
each other's mid-flight work when one runs out of credits.

## Status
✅ Done. This file + the CLAUDE.md "Continuous handoff" rule are the
mechanism. No other open work in this session.

## Last action
Created `HANDOFF.md` and added the resume protocol to CLAUDE.md.

## Next step
None — ready for the next user request. Whoever picks this up next
should:
1. `git pull --rebase`
2. Read this file (already done if you're seeing it)
3. Read `git log --oneline -10` and `git status`
4. Ask the user what they want to do next.

## In-flight side processes (don't accidentally restart these)
- **EAS Android build:** `90c536ef-e74c-4b1a-b245-e1f14bf22d0b` —
  versionCode 22, includes AD_ID plugin + Codex's recovered morning
  work. Watch progress at:
  https://expo.dev/accounts/rockingvsr/projects/maamitra/builds/90c536ef-e74c-4b1a-b245-e1f14bf22d0b
  When finished, the user uploads the AAB manually to Play Console.

## Known constraints / gotchas
- **OTA is currently broken** — EAS rejects SDK 54 (`sdkVersion 54.0.0
  is not supported`). `npm run update` will fail until Expo SDK is
  upgraded. Web deploys + new AAB builds still work fine. The user
  has been told.
- **Two worktrees on `main`** — `/Users/vijay/Documents/Claude/Projects/App/Maamitra`
  (the canonical one Codex uses) and `.claude/worktrees/brave-lamport-4cec1d`
  is on a Claude session branch (`claude-session-recovery`) that's
  fast-forwarded to `main`. Both pull from the same `origin/main`.
- **`scripts/safe-update.sh`** guards `npm run update` against publishing
  from a dirty / out-of-sync tree. Bypass only via `SAFE_UPDATE_BYPASS=1`.

## Recent commits to be aware of
Run `git log --oneline -10` for the latest. As of writing:
- `b6f0e02` chore(process): unified Claude+Codex workflow + safe-update guard
- `b47c4c2` chore(release): bump android.versionCode 21 → 22
- `ad488a0` recover: morning OTA work — community/health/home heroes, family fixes
- `2e12fd7` chore(android): drop AD_ID permission via config plugin
- `13a4fa0` chore(chat): drop MaaMitra brand text from conversation header
