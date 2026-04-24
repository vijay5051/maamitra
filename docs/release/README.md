# MaaMitra release runbook

One-stop instructions for shipping a new build to Android + iOS. Written so
future-you (or any collaborator) can do this without thinking.

---

## ⚠️ Current state (2026-04-24)

**`eas submit` for Android is NOT yet set up**, because Play Console's **API access** page is hidden for new personal developer accounts until production access is granted. Until that unlocks (~3–4 weeks after our first closed test):

- **Android releases**: GitHub Actions build → **manual** AAB upload to Play Console → Internal testing rollout. ~25 min total per release.
- **OTA updates** (JS-only fixes): work today — `npm run update` pushes to the `production` channel and installed users get the fix on next cold start.
- **iOS**: not yet set up (no Apple Developer account).

When Play Console starts showing the **Setup → API access** section, come back and do the "Google Play Store service account" one-time setup below. From then on, `npm run submit:android` works.

---

## One-time setup (DO LATER — after production access is granted)

### Google Play Store service account

Lives at repo root as `google-service-account.json` (gitignored).

**Prerequisite**: Play Console → Settings must show an **API access** item. If it doesn't, your account doesn't have production access yet — keep shipping via manual upload for now.

If it ever gets lost / needs regenerating:

1. **Play Console** → **Setup → API access**
2. If not already linked, click **Accept** on the Google Cloud Platform linking dialog. This links your Play Console to a Google Cloud project.
3. Scroll to **Service accounts** → **Create new service account**. This opens Google Cloud Console in a new tab.
4. In Google Cloud Console: **Create service account** → name `eas-submit` (or similar) → **Create and continue**. Skip roles (we grant them in Play Console, not GCP). Click **Done**.
5. In the service account list, click the three-dot menu on the row you just created → **Manage keys** → **Add key → Create new key → JSON**. A JSON file downloads.
6. Back in **Play Console → Setup → API access** → click **Refresh service accounts**. Your new one appears.
7. Click **Grant access** on its row → **App permissions: add MaaMitra** → **Account permissions**: tick **"Admin (all permissions)"** for a simple setup, or minimally **Release manager** (release apps to testing + production tracks) + **View app information and download bulk reports**. → **Invite user** → **Send invitation**.
8. Save the downloaded JSON as `google-service-account.json` in the repo root. Never commit it — `.gitignore` already blocks it.

### EAS CLI auth

On your laptop: `npx eas-cli login` once. Token is cached under `~/.expo/`.

---

## Normal release flow

When you want to ship a new version:

```bash
# 1. Bump version in app.json
#    expo.version          → e.g. "1.0.1" (semantic — what users see)
#    expo.ios.buildNumber  → increment (e.g. "2")
#    expo.android.versionCode → increment (e.g. 3)
#    Tip: production profile has autoIncrement:true, so Android versionCode
#    is bumped by EAS automatically. You still need to bump expo.version
#    and ios.buildNumber manually.

# 2. Make sure everything is committed and pushed
git status
git push

# 3. Build the AAB via GitHub Actions (cleanest)
open https://github.com/vijay5051/maamitra/actions/workflows/build-mobile.yml
#    Click "Run workflow" → platform: android → Run
#    Wait ~20 min. You'll see it go green in the Actions tab.

# 4a. [Until API access is available] Download AAB from expo.dev → manual
#     upload via Play Console → Testing → Internal testing → Create release.
#     https://expo.dev/accounts/rockingvsr/projects/maamitra/builds
#
# 4b. [Once API access is available] Submit to Play Store — one command,
#     uploads AAB + mapping file to the Internal testing track
npm run submit:android

# 5. (Optional) push an OTA update to users who already have the app
#    on this version — fixes small JS-only bugs without a new build
npm run update
```

### What `npm run submit:android` does

Reads `eas.json` → finds the latest production Android build on EAS → downloads it → uploads it to Play Console using the service account → posts it to the Internal testing track. Takes ~2 minutes.

### What changes in Play Console after submission

A new release appears on **Testing → Internal testing**. Your existing testers list is kept. Release notes carry over from the previous release unless overridden (see below).

---

## Customising release notes per release

Create a file at `store-config.json` (gitignored) in repo root:

```json
{
  "configVersion": 0,
  "release": {
    "android": {
      "releaseNotes": {
        "en-IN": "Bug fixes and a new milestone reminder card."
      }
    }
  }
}
```

Then run `npm run submit:android --store-config=store-config.json`. Or skip this and just edit release notes in Play Console after submission.

---

## iOS release flow (when App Store account is set up)

```bash
# Build
# GitHub Actions → platform: ios → Run workflow
#    (or local: npm run build:prod)

# Submit to TestFlight
npm run submit:ios
```

First time you run `submit:ios`, EAS prompts for your Apple ID + app-specific password. Those get stored. After that it's silent.

---

## OTA update flow (JS-only fixes, no rebuild)

For pure JavaScript / TypeScript / asset fixes that don't touch native code or `app.json` runtime-affecting fields:

```bash
git push  # ship the fix
npm run update  # runs: eas update --branch production
```

Users on the **production** channel will get the update next time they cold-start the app. Native code changes, new Expo plugins, bundle-identifier changes, etc. **require a new build + submit**, not an OTA.

### When NOT to use OTA
- Added/removed an Expo plugin
- Changed `app.json` fields that compile into the native app (permissions, bundle id, splash config, etc.)
- Upgraded Expo SDK version
- Added a native module

If unsure: rebuild.

---

## Deobfuscation (crash trace readability)

Because `submit:android` uploads via service account, the ProGuard/R8 mapping file is attached automatically — Play Console's "no deobfuscation file" warning goes away. No manual step needed.

(R8 isn't currently enabled in our Expo config. When we enable it, no pipeline changes are needed — the mapping file will just start appearing.)

---

## Rollbacks

If a release breaks:

- **Small JS bug**: push an OTA update (`npm run update`) with the fix. Fastest.
- **Native bug**: Play Console → Release overview → **Halt rollout**. Then build a fixed version and submit a new release.
- **Full rollback to previous version**: Play Console → App Bundle Explorer → select the previous versionCode → **Resume release**. New users get the old version again.

---

## Troubleshooting

**`submit:android` fails with "The service account does not have permissions..."**
→ In Play Console → Setup → API access → on your service account row, click **Grant access** and add the MaaMitra app + Release manager role.

**`submit:android` fails with "Package name does not match"**
→ Your Play Console app's package name must exactly match `in.maamitra.app`. Check Play Console → App information → App details.

**Build has the wrong version code**
→ `autoIncrement` is on for the production profile. EAS remembers the last versionCode across builds. If you need to force a specific one, set `expo.android.versionCode` in `app.json`.

**Friends don't see the update in Play Store**
→ For internal testing track, updates usually appear within 15 min but sometimes take a few hours. Tell them to manually check: Play Store → Profile icon → Manage apps & device → Updates available.
