# Handoff state

> **Read this first** when starting any session. It tracks what's
> in flight so a different agent (Claude / Codex) can resume without
> re-asking the user.
>
> **Update this file constantly** — at task start, after every commit,
> before every reply. See `.claude/CLAUDE.md` § "Continuous handoff".

---

## Active task
Community section overhaul — five-wave hardening pass against the
user's report ("section feels dummy, counters not realtime, multiple
reactions, comment count loads only on tap"). Worktree branch
`claude/optimistic-jang-774f1b`. Status: all 5 waves applied; awaiting
browser preview verification, then commit + deploy.

## Wave summary (this session)
- **Wave 1 — security & privacy** (firestore.rules + storage.rules + indexes):
  - Split the communityPosts update rule into 4 narrow clauses with
    value-shape validation (reactions/reactionsByUser, comment-summary
    bounded ±1, lastComment.authorUid pinned to requester).
  - Storage MIME allowlist `image/(jpeg|jpg|png|webp|heic|heif|gif)` —
    blocks SVG.
  - `allow get` on hidden posts gated to author + admin only; share
    page no longer leaks moderated content.
  - publicProfiles field-name typo fixed (`followerCount` →
    `followersCount`, `postCount` → `postsCount`); follower counts
    actually persist for non-owner writes.
  - New composite indexes: `(communityPosts, authorUid, createdAt)`,
    `(followRequests, toUid, status, createdAt)`,
    `(followRequests, fromUid, toUid, status)`,
    `(notifications/items, read, createdAt)`.
  - Topic enum enforced server-side.
  - Reactions: one-per-user (Instagram model, with legacy multi-emoji
    cleanup on next toggle).
  - Storage path collisions fixed (`Date.now()` → unique suffix).
  - `deletePost` cleans the image from Storage; `createPost` rolls
    back the upload on doc-write failure.
  - `unfollowUser` idempotency guard.
  - `blockUser` rejects self-block.
- **Wave 2 — realtime + optimistic UX**:
  - New `subscribeRecentPosts` / `subscribePost` / `subscribePostComments`
    in services/social.ts.
  - Store gained `subscribeToFeed` + `subscribeToComments` actions
    (with proper teardown registry) — community.tsx uses them.
  - Home "From the community" card now subscribes live.
  - `addCommentFirestore` is fully optimistic with rollback on error.
  - `loadMorePosts` dedupes by id.
  - `loadCommentsForPost` taught to subscribe on open and tear down on
    close — counters update without re-tapping.
  - Hardcoded "20 fellow parents" copy removed.
- **Wave 3 — Cloud Function triggers** (functions/src/index.ts):
  - `onCommentCreate` / `onCommentDelete` are sole writers of
    commentCount + lastComment + lastCommentAt; client-side writes
    removed from `addPostComment` / `deleteComment`.
  - `onPostDelete` cascades comment subcollection (admin priv) +
    decrements postsCount.
  - `onFollowCreate` / `onFollowDelete` maintain followersCount /
    followingCount; client writes removed from acceptFollowRequest /
    unfollowUser / blockUser.
  - `onUserCreated` (auth trigger) bootstraps publicProfile so the
    first-follower-of-new-user race goes away.
  - `repairCommunityCounters` cron (3 AM IST) walks publicProfiles
    nightly and reconciles drift.
- **Wave 4 — UI polish**:
  - PostCard wrapped in `React.memo` with field-aware equality.
  - community.tsx FlatList callbacks lifted to `useCallback` so memo
    actually saves rerenders.
  - Comment input: multiline, maxLength=2000, accessibilityLabel,
    blurOnSubmit=false, error-toast-on-failure with text-restore.
  - EditPostModal + NewPostModal cap at 5000 chars (matches server)
    with character counter visible.
  - timeAgo guards future dates (clock-skew safe).
  - Author/post images get `onError` fallback to GradientAvatar.
- **Wave 5 — share/deep-link/OG**:
  - app/post/[id].tsx subscribes live (reactions/comments update on
    the share page).
  - Web meta tags (title, description, og:*, twitter:*) populated
    from post — WhatsApp/Twitter previews now show author + snippet
    + image.
  - Service worker version bumped to 4 to drop stale caches.

## Status
All 5 waves applied. tsc clean. `firebase deploy --dry-run`
(rules + indexes + storage + functions) passes. Browser preview
verification pending — Metro is in cold bundle compile.

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
Five-wave community overhaul (see Wave summary above). All edits in
the worktree at `.claude/worktrees/optimistic-jang-774f1b`. `npx tsc
--noEmit` passes (root + functions). `firebase ... --dry-run` passes
for rules + indexes + storage + functions.

## Next step
1. Verify in browser preview — community feed renders, reaction tap
   works, comment thread streams live.
2. `git add` the changed files (firestore.rules, storage.rules,
   firestore.indexes.json, functions/src/index.ts, services/social.ts,
   services/storage.ts, store/useCommunityStore.ts, app/(tabs)/community.tsx,
   app/(tabs)/index.tsx, app/post/[id].tsx, components/community/PostCard.tsx,
   components/community/EditPostModal.tsx, public/firebase-messaging-sw.js).
3. Commit with a single message describing the five waves.
4. Run the full deploy chain (per CLAUDE.md §4):
   `git push → expo export → firebase deploy --only firestore,storage,functions
   → npm run update (OTA)`.
5. Smoke test on https://maamitra.co.in.

## Earlier queued follow-ups (still valid)
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
