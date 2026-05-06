# Firestore field ownership

> **Read this before adding or modifying any Firestore field.** This document maps every field to its single source of truth so the client never writes a field whose value lives somewhere else. The follower-count-zeroing bug, the post-vanishing bug, and the follow-accept-reverting bug all came from violating this principle — multiple writers fighting over one field.

## The one rule

**Every Firestore field has exactly one writer.** That writer is either:

- **Phone (the client app)** — for fields the user typed or the device knows
- **Cloud Function** — for aggregates, counters, and anything derived from concurrent writes
- **Admin SDK / repair script** — for one-off corrections (manual recount, role grants)

If you find yourself writing a field from a place that isn't its listed owner: **stop, route through the right writer.** Don't add a second writer "just in case" — it's how races and silent overwrites are born.

## Quick rules of thumb

- **Counters / aggregates** (`*Count`, totals, sums) → Cloud Function trigger only. Never write from the client.
- **User-typed content** (post text, comment text, profile bio, names) → client only.
- **Read state / interaction state** (`read: bool`, `unreadBy[]`, `seenAt`) → owner client only.
- **Timestamps that mark "happened on server"** (`createdAt`) → `serverTimestamp()` only — never `new Date()`.
- **Identity claims** (`authorUid`, `fromUid`, `toUid`) → set once on create, never updated.
- **Cross-user notifications** (`notifications/{uid}/items/*`) → the *sender* writes; only the *recipient* updates `read` / `requestStatus`.

## Field-by-field

### `users/{uid}` — owner: phone

The user's personal profile and settings. Always written by the owner's own device.

| Field | Writer | Notes |
|---|---|---|
| `email`, `name`, `motherName`, `parentGender` | phone (owner) | typed by user |
| `phone`, `phoneVerified` | phone (owner) | OTP flow updates this |
| `kids[]`, `bio`, `expertise[]`, `photoUrl` | phone (owner) | profile editor |
| `completedVaccines`, `healthTracking`, `teethTracking`, `foodTracking`, `growthTracking` | phone (owner) | health-tab checklists |
| `moodHistory[]`, `healthConditions[]` | phone (owner) | wellness-tab logs |
| `allergies[]` | phone (owner) | chat-tab modal |
| `accentColor`, `visibilitySettings`, `hasSeenIntro`, `hasDismissedFeatureGuide` | phone (owner) | per-user UI prefs |
| `fcmTokens[]` | phone (owner) | `arrayUnion` / `arrayRemove` only — never literal write |
| `pushEnabled`, `pushUpdatedAt` | phone (owner) | wired with FCM token writes |
| `adminRole` | admin SDK | granted via `scripts/set-admin.mjs` only |
| `onboardingComplete` | phone (owner) | flipped after setup wizard |
| `createdAt`, `updatedAt` | server timestamp | use `serverTimestamp()` only |

### `publicProfiles/{uid}` — owner: split

Shown to other users on profile cards. **Counters are server-only.**

| Field | Writer | Notes |
|---|---|---|
| `uid`, `name`, `photoUrl`, `bio`, `expertise[]`, `state`, `parentGender`, `badge` | phone (owner) | mirrored from `users/{uid}` via `syncPublicProfile` |
| `nameLower` | phone (owner) | written alongside `name` for case-insensitive search |
| `postsCount` | phone (owner) | incremented by `incrementPublicProfilePostCount` on post create; `onPostDelete` decrements |
| **`followersCount`** | **Cloud Function only** (`onFollowCreate` / `onFollowDelete`) | Phone must NEVER write this. Was the source of the counter-zeroing bug. |
| **`followingCount`** | **Cloud Function only** (`onFollowCreate` / `onFollowDelete`) | Same as above. |
| `blockedUids[]` | phone (owner) | `arrayUnion` / `arrayRemove` only |
| `countersRepairedAt` | repair script | written by the nightly counter-drift sweep |
| `createdAt`, `updatedAt` | server timestamp | |

**Why split:** counters are touched by many users at once (every follow / unfollow). Only a server trigger can resolve those concurrent writes safely with `FieldValue.increment`. The owner's app doesn't know the right value — it only knows what its local store happens to think.

### `communityPosts/{postId}` — owner: split

| Field | Writer | Notes |
|---|---|---|
| `authorUid`, `authorName`, `authorInitial`, `authorPhotoUrl`, `badge` | phone (author, on create) | snapshot at create time, never updated |
| `topic`, `text`, `imageUri`, `imageAspectRatio`, `imageEmoji`, `imageCaption` | phone (author) | author edits via `updatePost` |
| `editedAt` | phone (author) | set by `updatePost` |
| `authorFollowersOnly` | phone (author, on create) | snapshot of `visibilitySettings.postsFollowersOnly` |
| `reactions{}`, `reactionsByUser{}` | phone (any signed-in user) | toggled by `togglePostReaction` (transaction) |
| `commentCount`, `lastComment`, `lastCommentAt` | Cloud Function only (`onCommentCreate` / `onCommentDelete`) | Phone never writes these — they're aggregates |
| `hidden`, `hiddenReason`, `hiddenBy`, `hiddenAt`, `approved` | admin only | moderation flags |
| `flaggedPII`, `flaggedCrisis` | phone (author, on create) | safety pipeline output, never updated |
| `createdAt` | server timestamp | |

### `communityPosts/{postId}/comments/{commentId}` — owner: phone (author)

| Field | Writer | Notes |
|---|---|---|
| `authorUid`, `authorName`, `authorInitial`, `authorPhotoUrl` | phone (author, on create) | snapshot at create |
| `text` | phone (author) | editable via `updateComment` |
| `editedAt` | phone (author) | |
| `createdAt` | server timestamp | |

### `follows/{fromUid_toUid}` — owner: phone (either party)

| Field | Writer | Notes |
|---|---|---|
| `fromUid`, `toUid`, `fromName`, `toName`, `fromPhotoUrl`, `toPhotoUrl` | phone (creating party) | set once on create |
| `createdAt` | server timestamp | |

Counter side-effects on `publicProfiles` are handled by `onFollowCreate` / `onFollowDelete` Cloud Functions. **Never client-side.**

### `followRequests/{requestId}` — owner: split

| Field | Writer | Notes |
|---|---|---|
| `fromUid`, `toUid`, `fromName`, `fromPhotoUrl` | phone (sender, on create) | |
| `status: 'pending' \| 'accepted' \| 'declined'` | recipient or admin | sender can `delete` to cancel; only recipient can update status |
| `createdAt` | server timestamp | |

### `notifications/{uid}/items/{notifId}` — owner: split

| Field | Writer | Notes |
|---|---|---|
| `type`, `fromUid`, `fromName`, `fromPhotoUrl`, `postId`, `commentId`, `text`, `emoji`, `requestId` | phone (sender, on create) | rule whitelists exactly these fields on create |
| `read` | phone (recipient owner) | flipped by `markNotificationRead` |
| `requestStatus: 'accepted' \| 'declined'` | phone (recipient owner) | set by `markNotificationRequestStatus` after accept/decline |
| `createdAt` | server timestamp | |

### `conversations/{convId}` — owner: split

1:1 DM thread metadata. `convId = sortedUids.join('_')`.

| Field | Writer | Notes |
|---|---|---|
| `participants[]` | phone (creating party, on create) | both UIDs, sorted |
| `lastMessage`, `lastMessageTime`, `lastMessageSenderUid` | phone (sender of latest message) | overwritten on each new message |
| `unreadBy[]` | phone (split): sender writes `[recipient]` on send; recipient filters self out on read | semantically correct because in a 1:1 thread the sender's perspective is always "the other person hasn't seen this yet" |

### `conversations/{convId}/messages/{msgId}` — owner: phone (sender)

| Field | Writer | Notes |
|---|---|---|
| `senderUid`, `senderName`, `senderPhoto`, `text`, `imageUrl` | phone (sender, on create) | |
| `read` | phone (sender, on create) | always false on create |
| `createdAt` | server timestamp | |

### `blocks/{blockId}` — owner: phone (blocker)

| Field | Writer | Notes |
|---|---|---|
| `blockerUid`, `blockedUid` | phone (blocker, on create) | doc id = `${blockerUid}_${blockedUid}` |
| `createdAt` | server timestamp | |

### `app_config/runtime` — owner: admin only

Drives feature flags, maintenance mode, force-update prompt, and moderation policy. Read by everyone (even unauthenticated). **No client writes.**

### `app_settings/*` — owner: admin only

Banner, tone, site config. Same rule.

### `audit/*`, `admin_audit/*`, `crisis_queue/*` — owner: write-once

Append-only logs. Phone (or admin) creates; nobody updates. Read is admin-only.

## When you add a new field

Before merging the PR:

1. Decide who's writing it. **One writer.**
2. Add a row to this document.
3. If the writer is the Cloud Function, the rules should *deny* client writes to the field (or limit them via `onlyFields(...)`). If the writer is the client, the Cloud Function should not also write it.
4. If the field is touched by many concurrent users (a counter, an aggregate), default to Cloud Function. Resist the urge to "let the client also bump it for responsiveness" — that's the bug pattern.

## Why this matters — the bug examples

- **Post-vanishing (2026-05-03 to 2026-05-06):** `createPost` set three optional fields to literal `undefined`. SDK rejected the write. The client's `try/catch` swallowed the rejection and returned a fake post id. Fixed by `ignoreUndefinedProperties: true` + rethrowing the error.
- **Follower-count zeroing (Divya):** the client's `syncPublicProfile` was reading `followersCount` from the local Zustand store (which initialises to 0) and writing those zeros into `publicProfiles`, racing the `onFollowCreate` trigger and clobbering correct counts. Fixed by removing those fields from the client's payload — server is now the only writer.
- **Follow-accept reverting:** rule allowed updating only `read` on notifications, but the client wrote both `read` and `requestStatus`. Whole batch was rejected, status never persisted, badge reappeared as pending after refresh. Fixed by updating the rule to allow both fields together.

Each of those was the same shape of bug: **two writers fighting over one field.** This document exists so we don't ship a third instance.
