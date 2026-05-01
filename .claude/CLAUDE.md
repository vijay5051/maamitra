# MaaMitra — Working agreements

These apply to every session on this project. Re-read before starting work.

## 1. Cross-reference every change
When the user asks to change anything — a section, a text string, a component, a
data shape, a prop — do NOT change only the surface. Before editing:

1. Grep the whole repo for every reference to the thing being changed
   (component name, store field, string literal, route, event handler).
2. List every callsite that could be affected.
3. Update every dependent piece in the same commit so nothing is left stale.

Example patterns to watch for:
- Renaming a store field → update the interface, persist partialize, every
  selector, every destructure, every Firestore read/write that mirrors it.
- Changing a component's prop signature → update every caller.
- Changing a text/greeting → search for related greetings/strings elsewhere
  (home page, profile card, empty states, notifications) to keep tone
  consistent.
- Changing routes → update every `router.push`, Link, and deep-link handler.
- Adding a filter (blocked users, followers-only, etc.) → apply it everywhere
  posts/comments/notifications are rendered: feed, profile modal, user posts
  sheet, notifications sheet, home highlight.

## 2. No mocks, no demo data, no dead screens in the live app
This is a production app — it's being used live. Do NOT ship:
- Hardcoded fake posts/comments/users (e.g., "Priya posted 2h ago").
- Placeholder content that looks real ("First teeth finally showed up!").
- Non-interactive UI that looks interactive (buttons with no onPress,
  "Coming soon" alerts, cards that appear tappable but do nothing).
- Seed/fixture data rendered unconditionally.

Correct patterns:
- If real data is empty → hide the section entirely OR show an explicit
  empty state ("No posts yet. Be the first!") that's clearly a non-content
  state, not fake content.
- Every tappable element must have a real destination or a real action.
- Every button/icon should do something, not just look pretty.
- Seed data may ONLY exist for local dev/testing and must never render in
  prod builds.

## 3. Shared `main` — do not work in silos
Multiple agents (Claude + Codex) work on this repo simultaneously. To stop
their work overwriting each other:

1. **Always pull first.** Before editing anything:
   `git fetch origin && git pull --rebase origin main`
   Branch must be `main` (or rebased onto it).
2. **Never publish from a dirty / unpushed tree.** OTA bundles ship from
   the working tree and overwrite the channel — uncommitted code goes to
   users but lives nowhere in git, and the next push wipes it. Use
   `npm run update` (which calls `scripts/safe-update.sh`) — it refuses
   to publish if the tree is dirty or out of sync with origin.
3. **One branch.** No long-lived feature branches. Land on `main` in
   small commits + push frequently.

## 4. Always sync everything
After any change, the full delivery chain is, in order:
  pull --rebase → TypeScript clean → git commit → git push → expo export →
  firebase deploy → npm run update (OTA)
Do not stop partway. If Firestore/Storage rules changed, deploy those too.
Tell the user each link in the chain is done.

## 5. Continuous handoff (Claude ↔ Codex)
Sessions die unpredictably (rate limits, network, tab close). To survive
that, keep `HANDOFF.md` at the repo root constantly up to date — never
"on demand". The other agent reads it on session start and picks up.

**Resume protocol — first thing in every new session, before answering
anything:**
1. `git pull --rebase`
2. Read `HANDOFF.md`
3. Skim `git log --oneline -10` and `git status`
4. If a task is active there, summarize it back to the user in one or two
   sentences ("Picking up: X. Last action: Y. Next: Z. OK to continue?")
   before doing anything else.

**While working — keep `HANDOFF.md` current:**
- At the start of any non-trivial task: write the goal, the plan, and
  what "done" looks like into the "Active task" / "Next step" sections.
- After every commit: update "Last action" + "Next step".
- After every deploy / OTA / build: note it under "In-flight side
  processes" so the next agent doesn't accidentally re-trigger it.
- When the task is fully done: clear `HANDOFF.md` back to "no active
  task" — don't leave stale notes.

Commit `HANDOFF.md` updates with the same commit as the related code
change when possible, so a single push captures both. Push frequently
(after every commit) so the file is always live on `origin/main`.

## 6. Live demo URL
Production: https://maamitra.co.in (fallback: https://maa-mitra-7kird8.web.app)
Test in that URL after every deploy when possible.
