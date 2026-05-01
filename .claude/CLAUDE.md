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

## 5. Live demo URL
Production: https://maamitra.co.in (fallback: https://maa-mitra-7kird8.web.app)
Test in that URL after every deploy when possible.
