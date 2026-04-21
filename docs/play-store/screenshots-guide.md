# MaaMitra — Play Store screenshots capture guide

Google requires **min 2, max 8** phone screenshots. Recommended: **6 screenshots** covering the most compelling screens.

---

## Specs Google wants

- **Dimensions:** between 320 px and 3840 px on each side
- **Aspect ratio:** anywhere from 9:16 to 16:9 — **recommended 9:19.5 (modern phone) or 1080 × 1920**
- **Format:** PNG or JPG
- **Max 8 images**

---

## What to capture (in this order — Play Store shows them left-to-right)

| # | Screen | Why it sells |
|---|---|---|
| 1 | **AI chat** with a realistic question answered | First impression — the hero feature |
| 2 | **Home / feed** showing milestones + greeting | Shows daily-use personalization |
| 3 | **Community** with a real (or seed) parent post | Proves the social layer is live |
| 4 | **Growth tracker** with a chart + milestones | Tangible, useful tool |
| 5 | **Vaccines / schemes** list | India-specific trust signal |
| 6 | **Profile** with baby card | Shows multi-child support |

---

## Two good capture paths — pick one

### Option A — your actual phone (BEST for Play Store; feels native)

1. Install the AAB on your Android phone (after Play verification) or sideload via USB:
   ```bash
   adb install builds/maamitra-v1.0.0.aab
   ```
   *(AABs don't sideload directly — use `bundletool` or install the matching `apk` variant. Easiest is internal testing track once verification clears.)*
2. Sign in as a real user with some seed data (baby profile, a few community posts).
3. For each screen: **Power + Volume Down** → saved to Photos.
4. Airdrop / Google Drive to your Mac.
5. Drop them into `assets/play-store/screenshots/` as `01-chat.png`, `02-home.png`, etc.

### Option B — browser on desktop (FASTEST, good quality)

1. Open Chrome → https://maamitra.co.in
2. Open DevTools (⌥⌘I) → click the **Device Toolbar** icon (Ctrl+Shift+M)
3. Pick device: **Pixel 7** (412 × 915) OR **iPhone 14 Pro** (393 × 852). Set DPR to **3**.
4. Sign in as a real/test user, seed a baby profile if the account is fresh.
5. Navigate to each screen in the list above.
6. Capture at full resolution:
   - DevTools → ⋮ (three dots, top-right of device bar) → **Capture full size screenshot**
   - OR press Cmd+Shift+P → type "screenshot" → select **Capture screenshot** (viewport only — usually what you want)
7. Save as PNG → drop into `assets/play-store/screenshots/`.

> **Heads up:** the *web build* at maamitra.co.in renders the same app, but the route `/` is the marketing landing page. After you sign in you'll be redirected to `/(tabs)/` which is the in-app home — that's what you want to capture. If you land on marketing, navigate to `/sign-in` first.

---

## Polish pass (5 min in Canva, optional but worth it)

The screenshots alone are fine. But most top Play Store listings add a **caption banner** above or below each screen — 2x conversion lift in A/B tests.

1. Canva → Custom size **1080 × 1920 px**.
2. Fill background: Gradient `#1C1033 → #6d1a7a`.
3. Top 30% of canvas: big white headline caption in Fraunces/DM Serif Display, 80 px. Example captions:
   - Screenshot 1: `Ask your mitra anything.`
   - Screenshot 2: `Your baby's story, one tap in.`
   - Screenshot 3: `Real Indian moms. Real answers.`
   - Screenshot 4: `Track every tiny milestone.`
   - Screenshot 5: `Vaccines, schemes — sorted.`
   - Screenshot 6: `Every child, their own space.`
4. Middle/bottom 70%: drop the screenshot inside a phone-frame element (Canva has several). Shrink to ~75% of width.
5. Export as PNG at 1080 × 1920.
6. Name them `01-chat.png` through `06-profile.png` for ordering.

---

## When done

Drop all 6 into `assets/play-store/screenshots/` and tell me — I'll verify dimensions and order before we upload to Play Console.
