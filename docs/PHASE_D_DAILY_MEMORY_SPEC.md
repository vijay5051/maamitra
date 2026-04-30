# Phase D — Daily Memory Capture

## Why this exists

The home screen ships with a Today-for-Aarav hero card and a daily affirmation,
but it cannot show "Memory of the day" because the app currently has no UI for
mothers to capture rich memories — only functional logs (vaccines, growth,
mood). Pulling "memories" from functional logs alone produced flat, admin-y
prompts ("1 month ago today, you logged 5.2kg"). That was rejected as
unfit for the warm motherhood feel of the app.

This spec defines the dedicated capture flow that unlocks Memory-of-the-Day
later, and turns the existing Library "Journey" subtab into a real scrapbook.

## North star

When a mother wakes up six months from now and opens MaaMitra, she sees:

> "1 month ago today, Aarav had his first taste of mango.
> *'He made the funniest scrunched face — I cried laughing.'*
> 📸 [the photo]"

Pulled from a memory **she captured herself in 30 seconds at the time it
happened**, not derived from a vaccine row.

## User stories

1. **Capture in 30 seconds** — From the home screen, tap "Today's moment",
   pick or take one photo, type 1–3 sentences (optional), save. Done.
2. **Auto-context** — The capture auto-attaches the active kid, that kid's
   age in months/weeks, today's date, and any milestones currently
   highlighted that week. The mother doesn't tag manually.
3. **Browse the journey** — In Library → Journey, see month-by-month cards.
   Each card: month label, that month's captured photos with notes, that
   month's milestones reached, that month's growth points. Read like a
   scrapbook.
4. **Memory of the day** — Once memories exist, the home screen surfaces
   *"1 month ago today, [moment]"* on relevant days, replacing or
   complementing the affirmation card.
5. **Private by default** — Memories never leave the mother's account
   unless she explicitly shares one to community.

## Data model

### New Firestore collection: `memories/{memoryId}`

```ts
interface Memory {
  id: string;
  uid: string;                  // owning user
  kidId: string;                // active kid at time of capture
  capturedAt: Timestamp;        // when the moment happened (today by default)
  createdAt: Timestamp;         // when saved
  updatedAt: Timestamp;
  photoUrl: string | null;      // Firebase Storage URL, optional
  photoStoragePath: string | null;
  note: string;                 // free text, 1–500 chars
  // Auto-attached context (denormalised at write time so stale facts
  // don't disappear if the kid's age advances):
  kidAgeMonths: number | null;
  kidAgeWeeks: number | null;   // for under-1mo
  isExpecting: boolean;
  // Tags — optional, light. Auto-suggest from a fixed list:
  // 'first', 'milestone', 'feeding', 'sleep', 'cuddle', 'silly', 'travel',
  // 'family', 'health'. Mother can pick 0–3.
  tags: string[];
  // Privacy:
  visibility: 'private' | 'shared-to-community';
  sharedPostId: string | null;   // set if posted to community
}
```

### New Firebase Storage path

`/users/{uid}/memories/{memoryId}/photo.jpg` — single photo per memory,
JPEG, max 1600×1600, server-side compressed to ~80% quality on upload.

### Security rules

Memories are user-private by default. Read/write only the owner. Storage
photo path must match the memory's `uid`. Sharing to community creates a
post with `originMemoryId` linking back, but the memory itself stays
private.

## UI surfaces

### 1. Home — "Today's moment" entry point

A new card just below the affirmation, above the Today-for-Aarav hero.
Three states:

- **Empty state (default)** — soft cream card with a small camera icon and
  text: *"Capture today's moment with Aarav"*. Tap → opens the capture
  sheet.
- **Captured today** — same card, now shows a thumbnail of today's photo
  and a check ("Saved today 💜"). Tap → opens that memory's detail.
- **Multiple captured today** — thumbnail strip horizontally; "Add another"
  at the end. Tap any → that memory's detail.

Card is intentionally low-pressure. NEVER nag. NEVER show a streak counter
or guilt-inducing language. Mothers who skip a day skip a day.

### 2. Capture sheet — bottom modal

Single column, top to bottom:
- Drag handle
- Title: "Today's moment with Aarav" (auto-personalised)
- Tappable photo well (square, 1:1) — tap to pick from library OR camera.
  After photo, shows thumbnail with edit/remove affordance.
- Multiline text field: *"What happened? (optional)"* — 1–500 chars,
  serif italic placeholder, sans body input. Soft border.
- Tag chips row: *"Tag this moment? (optional)"* — 9 chips (first,
  milestone, feeding, sleep, cuddle, silly, travel, family, health).
  0–3 selectable.
- Save button: full-width brand purple, *"Save memory"*. Disabled until at
  least one of {photo, note} is provided.
- Cancel: top-right close icon.

After save: confetti burst (reuse existing `<Confetti>`), success haptic
(reuse `successBump()`), dismiss sheet, return to home with the captured
state shown.

### 3. Library — Journey subtab (rebuild)

Currently a placeholder. Convert into the scrapbook:

- Header: kid switcher (if multiple), then a year-month timeline at the top.
- For each month with at least one memory: section card titled
  *"Aarav · Month 4 · April 2026"*. Inside:
  - Photo grid (3 per row) of that month's captured photos
  - Notes overlay on tap — long-press shows the full note + tags
  - That month's milestones reached (compact pill row)
  - That month's growth deltas (small chart sparkline)
- Empty months are skipped silently — no "you didn't capture anything"
  reproach.
- Tapping any photo opens a detail sheet with full photo, full note, tags,
  date, kid age. Edit / Delete / Share-to-community actions.

### 4. Memory-of-the-day on home (new behaviour)

After capture flow ships and memories accumulate, replace OR
supplement the affirmation card with memory recall:

- On home mount, query memories where `capturedAt` is "today's date minus
  N" for N in {30 days, 90 days, 365 days}. Pick the most recent match.
- If found, render an "On this day" card above (or instead of) the
  affirmation:
  > **One month ago today**
  > *"He made the funniest scrunched face when he tried mango."*
  > 📸 thumbnail · Aarav, 3mo
- If no match, the affirmation card holds its current spot.
- Tap → opens the memory detail.

This behaviour ships AS PART OF Phase D so it lights up immediately as soon
as the user has month-old memories.

## Implementation phases

### Phase D-1: capture flow + storage (foundation)

- New Firestore collection + security rules
- New Storage path + rules
- New zustand store: `useMemoriesStore` (CRUD + cache)
- New service: `services/memories.ts` (Firestore + Storage adapters)
- New component: `components/memory/MemoryCaptureSheet.tsx`
- Home card: `components/home/TodaysMomentCard.tsx`
- Wire home card into `app/(tabs)/index.tsx` (above the affirmation)
- expo-image-picker integration for the photo well
- Image compression on upload (resize 1600×1600 max, jpeg q80)

Acceptance: a mother can capture a memory with photo + note, see it
persisted, see it reflected in the home card state.

### Phase D-2: Journey scrapbook (consume)

- Rebuild Library → Journey subtab using `useMemoriesStore`
- Month grouping logic
- Photo grid with tap → detail sheet
- Detail sheet with edit / delete / share-to-community
- Empty state if no memories yet — illustration + "Start your journey"
  CTA that opens the capture sheet

### Phase D-3: Memory of the day (surface)

- New helper `findMemoryOfTheDay()` — queries memories from same calendar
  date 30/90/365 days ago for the active kid
- New `<MemoryOfTheDayCard>` component
- Home conditional render: if memory found → memory card, else
  affirmation card (or both stacked, configurable)

### Phase D-4: share-to-community

- "Share to community" action in memory detail
- Reuses existing community post composer with photo + note prefilled
- Creates a community post with `originMemoryId` link
- Updates the memory's `sharedPostId` field

## Out of scope (defer or never)

- ❌ Video memories (photo only for v1; add later if mothers ask)
- ❌ Multi-photo memories (one photo per memory; can capture multiple
  memories per day)
- ❌ Streak counters or "memory of the week" gamification — explicitly
  rejected; this is not a reward loop
- ❌ Public profile of memories (privacy first)
- ❌ AI-generated captions or "summarise this month" features (later, when
  there's enough data per user to be useful)

## Asset needs

Two illustrations needed when this is built:

1. **`empty-journey.webp`** — shown in Library → Journey when no memories
   yet. Soft scene: open photo album, tiny heart photo charm, baby's
   silhouette nearby. 800×600, transparent.
2. **`todays-moment-thumb.webp`** — small icon for the home card's empty
   state. 200×200 transparent. Stylised camera with a soft heart shutter.

Generate via the standard ChatGPT batch pattern when picking up Phase D-1.

## Estimates

| Phase | Scope | Effort |
|---|---|---|
| D-1 | Capture flow + storage + home card | ~half day |
| D-2 | Journey scrapbook rebuild | ~half day |
| D-3 | Memory-of-the-day on home | ~2 hours |
| D-4 | Share-to-community | ~2 hours |

Total: ~1.5 days end-to-end for a single owner. Can split across two PRs
(D-1+D-2 = capture + display, D-3+D-4 = surface + share).

## Open questions for product

- Should memory-of-the-day fully replace the affirmation card on days a
  match exists, or stack? (Default proposal: replace, since memories are
  more personal than affirmations.)
- Should we surface the memory in chat too — *"Aarav had his first solids
  one year ago today. Want to revisit?"* — or only on home? (Default: home
  only for v1.)
- Auto-prompt to capture: once-per-day push notification at e.g. 8 PM if
  nothing captured? Or zero-nag forever? (Default: zero-nag for v1.)

---

*Status: speced, not yet built. Author: Claude Code session 2026-04-30.*
