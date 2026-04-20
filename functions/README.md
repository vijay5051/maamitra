# MaaMitra push dispatcher

The app-side of push notifications is fully wired:

- `public/firebase-messaging-sw.js` — background FCM handler (deployed at `/firebase-messaging-sw.js`)
- `services/push.ts` — permission prompt, FCM token grab, save to `users/{uid}.fcmTokens[]`
- Settings → Notifications toggle — lets each user enable/disable per device
- `push_queue` Firestore collection — jobs get enqueued by:
  - `createNotification` in `services/social.ts` (reactions, comments, follows, DMs → personal push)
  - `enqueueBroadcastPush` called from Admin → Notifications (broadcasts)

**What's missing: the server-side dispatcher.** Nothing reads `push_queue` yet. Deploy the Cloud Function below once and push becomes live.

---

## Setup (one-time)

### 1. Firebase Console → get a VAPID public key

Firebase Console → Project Settings → **Cloud Messaging** tab → **Web configuration** section → **Generate key pair**. Copy the public key. Add to `.env`:

```
EXPO_PUBLIC_FCM_VAPID_KEY=<paste here>
```

Then redeploy. Without this the in-app "Enable push" toggle logs a warning and fails gracefully.

### 2. Deploy the dispatcher Cloud Function

```bash
cd functions
npm install
firebase deploy --only functions:dispatchPush
```

That's it. The function triggers on every new `push_queue/{id}` document.

### 3. (Optional) Grant admin custom claim

By default `firestore.rules` treats two email addresses as admins
(`admin@maamitra.app`, `vijay@maamitra.app`) for convenience. For any
other admin, grant the `admin: true` custom claim via the Firebase
Admin SDK. A one-liner:

```ts
await admin.auth().setCustomUserClaims(uid, { admin: true });
```

---

## How it flows end-to-end

```
┌─────────┐     createNotification()     ┌──────────────┐
│  User   │ ───────────────────────────> │ push_queue   │
│ action  │    enqueueBroadcastPush()    │  (Firestore) │
└─────────┘                              └──────┬───────┘
                                                │ onCreate trigger
                                                ▼
                                         ┌──────────────┐
                                         │ dispatchPush │
                                         │  (Function)  │
                                         └──────┬───────┘
                                                │ FCM HTTP v1
                                                ▼
                                         ┌──────────────┐
                                         │ user's device│
                                         └──────────────┘
```

## Function source

See `functions/src/index.ts` in this directory.
