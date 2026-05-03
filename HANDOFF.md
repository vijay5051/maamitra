# Handoff state

> **Read this first** when starting any session. It tracks what's
> in flight so a different agent (Claude / Codex) can resume without
> re-asking the user.
>
> **Update this file constantly** — at task start, after every commit,
> before every reply. See `.claude/CLAUDE.md` § "Continuous handoff".

---

## Active task
Make MaaMitra chat feel more like a real, caring person — empathy,
intellectual honesty, hostile-user handling, mental-health crisis
support, and "answer through the user's health lens" rules.

## Status
✅ System prompt rewritten in `services/claude.ts` `buildSystemPrompt()`.
Added sections: SOUND LIKE A REAL PERSON (kill AI tells, vary openings,
contractions, react-first, hold opinions, calibrated certainty),
EMOTIONAL ATTUNEMENT (loaded-question reading, permission-giving,
cultural texture, honor-the-unasked, no comparison-bait),
WHEN SHE'S STRUGGLING OR IN CRISIS (postpartum red flags +
Vandrevala 1860-2662-345, hostile-user de-escalation, "I don't know"
honesty), USE WHAT YOU KNOW ABOUT HER (force health-aware framing
when allergies/conditions are relevant). Mental-health helpline is
Vandrevala only (per user). Pure prompt change — no schema, no UI.

## Last action
Edited `services/claude.ts:357–432`. `npx tsc --noEmit` passes.

## Next step
Commit + push + expo export + firebase deploy + npm run update (OTA).
Then queued follow-ups for separate sessions:
- **Phase 1 (profile surfacing):** expand `ChatContext` + `buildContext()`
  in `app/(tabs)/chat.tsx` to surface growthTracking, foodTracking,
  healthTracking checklist gaps, all kids (not just active), local
  time-of-day, days-since-last-chat. No new writes — pure aggregation.
- **Phase 2 (learned facts memory):** new `users/{uid}/memory` doc
  with facts/concerns/preferences arrays. Tiny secondary Claude call
  per Nth chat turn extracts durable facts ("husband travels Mon-Thu",
  "lives with MIL") and merges with dedup + confidence + cap. Inject
  into the next system prompt as "WHAT YOU'VE LEARNED ABOUT HER".

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
