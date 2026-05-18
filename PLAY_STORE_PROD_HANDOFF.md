# MaaMitra v1.0.6 — Play Store Production Launch Handoff

**Generated:** 2026-05-18
**Code state:** `main` @ commit `1f33254`+ (auto-increment from EAS may add a versionCode bump commit)
**Version:** 1.0.6 · Android versionCode 29 (EAS may auto-bump to 30) · iOS buildNumber 6

## What's in this build

Bundles all internal-testing work since v1.0.3 (versionCode 11, 2026-04-29):

- **Security hardening** (P0 + P1 + F1–F4): jailbreak telemetry to Firestore, server-side chat prompt construction, factoryReset constant-time secret compare, Meta webhook HMAC fail-closed, all GitHub Actions SHA-pinned
- **Marketing Studio v2**: 4+1 pill tabs (Today / Posts / Replies / Insights / ⚙), 6-month rhythm queue, FB Page publish via PAT
- **QA pass**: drove web QA score past 90 (a11y labels, console quieted, visual polish)
- **Pre-Play-Store-prod audit fixes** (2026-05-18, this session):
  - Branded `+not-found.tsx` 404 + `/signin` `/signup` `/contact` redirect aliases
  - Splash overlay gated to first-load only (deep links no longer sit behind 1.8s splash)
  - `__DEV__` hardening on `lib/devPreviewAdmin.ts` — verified inert in prod web bundle
  - `lib/friendlyAuthError.ts` maps every Firebase Auth code to plain-English UI (no raw `FirebaseError` strings reach users)
  - Welcome footer Contact = visible selectable `info@maamitra.co.in`, Privacy/Terms get hitSlop + a11y roles
  - Official multicolor Google G logo (replaces hand-drawn blue text "G" — was Play Store policy risk)
  - Stopped trimming password on sign-in / sign-up (silent lockout risk)
  - Wordmark unified to Lora serif across welcome + auth (was DMSans on welcome only)
  - 600ms web font gate kills Times FOUT
  - Inputs 28 → 44px (WCAG 2.5.5 Target Size)
  - Welcome hero CTAs hidden from a11y tree via `inert` (web) + `accessibilityElementsHidden` (native)
  - Divider text contrast bumped to clear WCAG AA on cream bg

## Release notes for Play Console (paste verbatim)

> **MaaMitra v1.0.6 — first public production release**
>
> • Polished sign-in and sign-up flow — faster, friendlier, easier to tap on small phones
> • Friendlier error messages instead of technical codes
> • New Marketing Studio for content rhythm and community replies
> • Stronger privacy, security hardening, and faster web experience
> • Bug fixes and visual polish across welcome, profile, and chat
>
> Built with love in India for new and expecting mothers. 🤍

## What you must do in Play Console (UI-only, can't be automated)

In order:

### 1. Wait for EAS build to finish (~15–20 min from now)
Build ID: `07442625-cda5-4890-b5ed-408c04e8d16c`
Track at: https://expo.dev/accounts/rockingvsr/projects/maamitra/builds/07442625-cda5-4890-b5ed-408c04e8d16c
Status: IN_PROGRESS (~6 min in as of 15:37 IST 2026-05-18).
versionCode 30 · appVersion 1.0.6 · runtimeVersion 1.0.6 · channel production · git commit 1f33254.
You'll get an AAB download link when ready. Save it locally.

### 2. Upload AAB to **Internal testing** track first
- Play Console → **Testing → Internal testing → Create new release**
- Upload the AAB
- Paste the release notes above into the "Release notes" textarea
- **Save**, then **Review release** (don't roll out yet)
- Per existing memory: API access is hidden under nikkishekhawat91's console, so `eas submit` won't work — manual upload only.

### 3. Submit Data Safety form (REQUIRED for prod track)
Play Console → **App content → Data safety → Start / Edit**. Map to what `/privacy` already declares:

| Data type | Collected? | Shared? | Required? | Purpose |
|---|---|---|---|---|
| **Personal info → Name** | Yes | No | Required | Account management, personalization |
| **Personal info → Email** | Yes | No | Required | Account management, communications |
| **Personal info → Phone number** | Yes (OTP) | No | Optional | Account security, account management |
| **Personal info → User IDs (Firebase UID)** | Yes | No | Required | Account management |
| **Health & fitness → Health info (pregnancy due date, child DOB, milestones)** | Yes | No | Optional | App functionality (personalisation) |
| **Photos and videos → Photos (profile pic)** | Yes | No | Optional | Account management |
| **Messages → Other in-app messages (chat with AI mitra, community posts/comments)** | Yes | No | Optional | App functionality |
| **App activity → App interactions / In-app search history** | Yes | No | Optional | Analytics |
| **Device or other IDs** | Yes | No | Optional | Analytics, fraud prevention |

Security practices:
- ✅ Data encrypted in transit (Firebase enforces TLS)
- ✅ Users can request data deletion (`/delete-account` route exists)
- ✅ Committed to Play Families Policy (we serve adults 18+, not children)

### 4. Content rating (IARC) — may already be done from internal-testing setup
Play Console → **App content → Content rating**. Likely 3+ or Teen. If the questionnaire hasn't been filled, do it (~5 min).

### 5. Privacy policy URL
Play Console → **App content → Privacy policy** → `https://maamitra.co.in/privacy` (confirm it's set).

### 6. Listing assets sanity check
The Lora wordmark + new auth screens mean any screenshots from before 2026-05-18 are now stale.
Play Console → **Main store listing → Phone screenshots**. If they show the DMSans wordmark or the dead Contact link, replace them. Take fresh screenshots from the live web preview (`/welcome`, `/sign-in`, `/(tabs)/home`, chat) or from the device.

### 7. Soak in Internal testing for at least 12 hours
- After upload, **Roll out to internal testing**.
- Internal testers (~5 emails) get the OTA-style auto-update.
- Wait for **Pre-launch report** in Play Console (Google auto-runs the app on real devices — ~few hours). Read the report. No crashes / a11y P0 → proceed.

### 8. Promote Internal → Production
- Play Console → **Production → Create new release** → **Promote release** from Internal.
- Same release notes.
- **Staged rollout: start at 20%**. Watch Play Console Vitals for 24h.
- If crash-free sessions ≥ 99%, ANR rate < 0.5%, bump to 50%, then 100%.

## Known follow-ups (post-launch, not blocking)

1. **Crashlytics native install** — `@react-native-firebase/crashlytics` + plugin config + rebuild. Real visibility into crashes from day 1 of the next AAB.
2. **Transitive npm CVEs**: `protobufjs`, `@xmldom/xmldom`, `fast-xml-builder` — all through Firebase / Google SDKs, not direct deps. `npm audit fix` pass when safe.
3. **Codex's parked work** in `stash@{0}` — marketing template-image batch generator script + 1 sample thumbnail. Either land or formally drop next time you sit down with Codex.
4. **iOS App Store** — separate path, gated on Apple Developer enrollment under Vijay Singh Rathore (per `project_ios_apple_developer_path` memory).
5. **`/canary` post-deploy monitoring** — run after rollout hits 20% to catch console errors, perf regressions, screenshots vs baseline.
6. **Android 15 edge-to-edge deprecation** (Play Console suggestion, surfaced on v1.0.5 build 27) — `setStatusBarColor` / `setNavigationBarColor` / `LAYOUT_IN_DISPLAY_CUTOUT_MODE_*` are deprecated. Source is React Native core (`StatusBarModule`, `WindowUtilKt`) + Material Design lib, not our code. Fix = bump RN 0.83.6 → 0.84+ (or whatever the next stable is). Plan for v1.1. Not user-visible today; deprecated ≠ broken.
7. **Android 16 large-screen orientation lock** (Play Console suggestion) — `MainActivity android:screenOrientation="PORTRAIT"` (set by `"orientation": "portrait"` in `app.json:6`) will be ignored by Android 16 on foldables / tablets, causing stretched portrait layouts on those devices. Fix is more than one line: remove the lock AND add responsive landscape layouts (welcome, auth, chat, profile, marketing) using `useWindowDimensions()` breakpoints. ~1–2 days. Plan for v1.x. <5% of Indian Android users today; defer is reasonable.

## Verification snapshots saved

- `tmp/design-audit-20260518/` — full pre-fix audit screenshots
- `tmp/design-audit-20260518/after/` — post-fix live verification screenshots
- `tmp/qa-20260518/` — /qa pass output (if generated)

All in `tmp/` (gitignored).

## Quick reference: this session's commits

- `31b6b03` — D1 critical (404, redirects, splash gate, devPreviewAdmin, friendlyAuthError, contact email, Google G, no-trim password)
- `c173195` — D2 polish (Lora wordmark, font gate, taller inputs, hidden hero CTAs, AA divider)
- `246aa17` — D2.5 QA fixes (web `inert` attempt for tab order, inputs 40→44)
- `1f33254` — version bump 1.0.6 / vC 29 (this is the commit EAS built from)
- `ffeb4f9` — EAS auto-increment vC 29→30 + this handoff doc
- `44945ef` — D2.6 web tab-order proper fix (RN Web filters `inert` on View, so tabIndex=-1 had to be pushed down to focusable children + new `a11yHidden` prop on GradientButton). Web is live with this fix. Will OTA to 1.0.6 channel so new AAB users get it at first launch.

---

**Status when next agent picks this up:** Web is live with all fixes. OTA on prod channel pushed for runtime 1.0.5 (D1 + D2 changes reach existing internal testers). AAB for 1.0.6 building in EAS cloud. After AAB lands → Play Console manual upload → 12h soak → promote to prod.
