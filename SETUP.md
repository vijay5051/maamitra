# MaaMitra Setup Guide

A complete step-by-step guide to get MaaMitra live — no terminal needed for most steps.

---

## Step 1: Get Your Anthropic API Key

1. Go to https://console.anthropic.com
2. Sign up or log in
3. Click **API Keys** in the left sidebar → **Create Key**
4. Name it "maamitra" and copy the key (starts with `sk-ant-`)
5. Save it somewhere safe — you'll need it in Step 4

---

## Step 2: Set Up Firebase

### 2a. Create the Project

1. Go to https://console.firebase.google.com
2. Click **Create a project** → name it `maamitra`
3. Enable Google Analytics (optional) → click **Create project**

### 2b. Enable Authentication

1. In the left sidebar → **Build** → **Authentication** → **Get started**
2. Click **Email/Password** → toggle **Enable** → **Save**

### 2c. Set Up Firestore Database

1. In the left sidebar → **Build** → **Firestore Database** → **Create database**
2. Choose **Start in test mode** → pick the closest region → **Done**

### 2d. Set Up Firebase Hosting

1. In the left sidebar → **Hosting** → **Get started**
2. Follow the setup wizard (you don't need to run CLI commands — CI/CD handles it)

### 2e. Get Your Firebase Config

1. Click the **gear icon** (top-left) → **Project settings**
2. Scroll down to **Your apps** → click **Add app** → Web icon (`</>`)
3. Name it "maamitra-web" → **Register app**
4. Copy the `firebaseConfig` values — you need all 6 fields:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

### 2f. Get Firebase Service Account (for CI/CD deployment)

1. In **Project settings** → **Service accounts** tab
2. Click **Generate new private key** → **Generate key**
3. A JSON file downloads — keep it safe (this is `FIREBASE_SERVICE_ACCOUNT`)

---

## Step 3: Set Up Expo Account

1. Go to https://expo.dev
2. Sign up or log in → **Create Organization** or use personal account
3. Click **+ New Project** → name it `maamitra`
4. Copy your **Project ID** (looks like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
5. Go to **Account Settings** → **Access Tokens** → **Create Token**
6. Name it "github-ci" and copy the token (this is `EXPO_TOKEN`)

### 3a. Update app.json

Open `app.json` and replace `YOUR_EAS_PROJECT_ID` with your Expo project ID:

```json
"extra": {
  "eas": {
    "projectId": "your-actual-project-id-here"
  }
}
```

---

## Step 4: Connect GitHub & Add Secrets

1. Push this code to a new GitHub repository (public or private)
2. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add each of the following:

| Secret Name | Where to Get It |
|---|---|
| `FIREBASE_API_KEY` | Firebase config `apiKey` |
| `FIREBASE_AUTH_DOMAIN` | Firebase config `authDomain` |
| `FIREBASE_PROJECT_ID` | Firebase config `projectId` |
| `FIREBASE_STORAGE_BUCKET` | Firebase config `storageBucket` |
| `FIREBASE_MESSAGING_SENDER_ID` | Firebase config `messagingSenderId` |
| `FIREBASE_APP_ID` | Firebase config `appId` |
| `FIREBASE_SERVICE_ACCOUNT` | Contents of the downloaded service account JSON file |
| `ANTHROPIC_API_KEY` | From Step 1 (starts with `sk-ant-`) |
| `EXPO_TOKEN` | From Step 3 |
| `ADMIN_EMAIL` | The email address you want as admin |

---

## Step 5: Create Your Admin Account

1. Go to **Firebase Console** → **Authentication** → **Users** tab
2. Click **Add user**
3. Enter the same email you used for `ADMIN_EMAIL` secret + a strong password
4. This is your admin login for the app

---

## Step 6: Generate App Icons

1. Go to https://icon.kitchen/
2. Select **Emoji** as the icon type
3. Type `🤱` in the emoji field
4. Set background to **Gradient**: `#ec4899` → `#8b5cf6`
5. Click **Download** → select all platforms
6. Replace the files in the `assets/` folder:
   - `icon.png` (1024×1024)
   - `splash.png` (1284×2778)
   - `adaptive-icon.png` (1024×1024)
   - `favicon.png` (32×32)

---

## Step 7: Set Up Firestore Security Rules (Before Going Live)

In Firebase Console → Firestore → **Rules** tab, replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public read for content, write requires auth
    match /articles/{doc} { allow read; allow write: if request.auth != null; }
    match /products/{doc} { allow read; allow write: if request.auth != null; }
    match /yoga/{doc} { allow read; allow write: if request.auth != null; }
    match /schemes/{doc} { allow read; allow write: if request.auth != null; }

    // Community: read approved posts, write requires auth
    match /community/{doc} {
      allow read: if resource.data.approved == true || request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null;
    }

    // User profiles: only own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## Previewing the App Locally

After Claude Code has installed all dependencies:

1. Use the **Preview** tool in Claude Code to launch the app in your browser instantly
2. Or run `npx expo start --web` and open `http://localhost:8081`

---

## Going Live

Push any code change to the `main` branch on GitHub — automatic builds start for:

- **Web** → deployed to Firebase Hosting (usually 3-5 minutes)
- **iOS** → built and submitted to App Store Connect (15-30 minutes)
- **Android** → built and submitted to Google Play (15-30 minutes)

Track build status at:
```
https://expo.dev/accounts/[your-account]/projects/maamitra/builds
```

### OTA Updates (Instant — No App Store Review)

For JS-only changes, use the **OTA Update** workflow:
1. Go to GitHub repo → **Actions** → **OTA Update**
2. Click **Run workflow** → enter a message → **Run**
3. Update pushes to all installed apps within minutes

---

## Troubleshooting

**Admin panel not showing?**
- Check that `EXPO_PUBLIC_ADMIN_EMAIL` in your `.env` matches the Firebase Auth user email exactly

**Firebase connection errors?**
- Verify all 6 Firebase config values are correct in GitHub Secrets
- Check Firestore is created (not just initialized)

**Build failures on EAS?**
- Ensure `EXPO_TOKEN` is valid and not expired
- Check that `projectId` in `app.json` matches your Expo project

**AI chat not working?**
- Verify `EXPO_PUBLIC_ANTHROPIC_API_KEY` starts with `sk-ant-`
- Check your Anthropic account has API credits
