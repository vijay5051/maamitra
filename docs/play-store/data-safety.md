# MaaMitra — Google Play Data Safety form answers

Paste these into Play Console → App content → Data safety. Each section maps to a screen in Google's wizard.

**Review before submitting:** these answers reflect what the app collects *today* (Firebase Auth, Firestore, Firebase Storage, Anthropic API for AI chat). If you later add analytics SDKs (Mixpanel, Amplitude, etc.) or ads, re-open this form and add them.

---

## Section 1 — Data collection and security

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS / TLS for all Firebase + Anthropic API calls) |
| Do you provide a way for users to request that their data is deleted? | **Yes** (in-app "Delete account" in Settings removes all Firestore + Storage data) |
| Has your app's data collection and handling practices been independently validated against a global security standard? | **No** |
| Is your app committed to following the Play Families Policy? | **No** (app is not targeted at children — audience is mothers / parents / adults) |

---

## Section 2 — Data types collected

For each data type below, mark **Collected** with these settings unless stated otherwise:

- **Collected:** Yes
- **Shared with third parties:** No *(Firebase and Anthropic are processors acting on our behalf, not third-party recipients — Play treats SDK/processor use this way)*
- **Optional or required:** see each row
- **Purposes:** see each row

### Personal info

| Data type | Collected | Optional/Required | Purposes |
|---|---|---|---|
| Name | Yes | Required | App functionality, Account management |
| Email address | Yes | Required | App functionality, Account management |
| User IDs | Yes | Required | App functionality, Account management *(Firebase UID)* |
| Phone number | Yes | **Optional** | App functionality *(optional OTP verification for trust signals in community)* |
| Address | No | — | — |
| Race and ethnicity | No | — | — |
| Political or religious beliefs | No | — | — |
| Sexual orientation | No | — | — |
| Other info | Yes | Optional | App functionality, Personalization *(bio, expertise tags, parent gender, family type — all user-authored)* |

### Financial info
- **None collected.** MaaMitra does not take payments.

### Health and fitness

| Data type | Collected | Optional/Required | Purposes |
|---|---|---|---|
| Health info | Yes | **Optional** | App functionality, Personalization *(pregnancy stage, due date, child DOB, height/weight tracking, vaccine completion records)* |
| Fitness info | No | — | — |

> Note: pregnancy and baby growth data is self-reported by the user for their own tracking. It is not used to provide medical diagnosis.

### Messages

| Data type | Collected | Optional/Required | Purposes |
|---|---|---|---|
| Emails | No | — | — |
| SMS or MMS | No | — | — |
| Other in-app messages | Yes | **Optional** | App functionality *(community posts, comments, direct messages between users, AI chat history)* |

### Photos and videos

| Data type | Collected | Optional/Required | Purposes |
|---|---|---|---|
| Photos | Yes | **Optional** | App functionality, Personalization *(profile photo, child photo, community post images)* |
| Videos | No | — | — |

### Audio files
- **None collected.**

### Files and docs
- **None collected.**

### Calendar
- **None collected.**

### Contacts
- **None collected.**

### App activity

| Data type | Collected | Optional/Required | Purposes |
|---|---|---|---|
| App interactions | Yes | Required | App functionality *(community likes/follows, saved content, onboarding progress)* |
| In-app search history | No | — | — |
| Installed apps | No | — | — |
| Other user-generated content | Yes | Optional | App functionality *(journal-style entries, milestone notes, food tracker entries)* |
| Other actions | No | — | — |

### Web browsing
- **None collected.**

### App info and performance

| Data type | Collected | Optional/Required | Purposes |
|---|---|---|---|
| Crash logs | Yes | Required | Analytics *(Firebase Crashlytics if enabled — confirm in app.json plugins)* |
| Diagnostics | No | — | — |
| Other app performance data | No | — | — |

> **Confirm:** check `app.json` plugins + native code — if `@react-native-firebase/crashlytics` is NOT integrated, change "Crash logs" to **No**.

### Device or other IDs

| Data type | Collected | Optional/Required | Purposes |
|---|---|---|---|
| Device or other IDs | Yes | Required | App functionality *(push notification tokens via Expo / FCM)* |

---

## Section 3 — Data security practices

- **Encrypted in transit:** Yes (HTTPS/TLS enforced on all network calls).
- **Users can request data deletion:** Yes. In-app Settings → Delete account permanently removes profile, kids, community posts, DMs, chat history, and uploaded photos from Firestore and Storage. A web deletion request is also supported at https://maamitra.co.in/privacy (email hello@maamitra.co.in).
- **Committed to Play Families Policy:** No (audience: adult mothers/parents).

---

## Quick sanity check before you submit

1. Does the app currently integrate Firebase Crashlytics? If **no**, mark "Crash logs" as **Not collected**.
2. Is there any third-party analytics SDK (Mixpanel, Amplitude, GA4, etc.)? If yes, add under "App activity → App interactions" and mark shared = Yes.
3. Are push notifications live? If yes, "Device or other IDs" stays **Yes**. If push is still disabled, mark **No**.
4. Any Google/Meta ad SDK? If yes, that changes a lot of answers — tell Claude and we'll redo this.

If none of the above apply differently from these drafts, you can paste as-is.
