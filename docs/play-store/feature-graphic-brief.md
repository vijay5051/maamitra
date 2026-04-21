# MaaMitra Feature Graphic — Canva brief

Google Play feature graphic spec:
- **Size:** 1024 × 500 px (exact)
- **Format:** PNG or JPG, no alpha
- **No rounded corners / drop shadows** — Google crops them off
- **Safe area:** keep text and logo at least 80 px away from every edge — Play Store sometimes overlays a play button on the right side

---

## Brand palette (match the app)

| Role | Hex | Use for |
|---|---|---|
| Brand purple (primary) | `#7C3AED` | Accents, button fills |
| Deep plum (hero bg) | `#1C1033` | Background left half |
| Mid plum | `#3b1060` | Background gradient stop |
| Magenta plum | `#6d1a7a` | Background gradient end |
| Ink plum (text) | `#1C1033` | Body text on light bg |
| Lilac tint | `#F5F0FF` | Card fills, pills |
| Off-white | `#FAFAFB` | Light background |

**Gradient to use for the hero background:** linear `#1C1033 → #3b1060 → #6d1a7a` (top-left to bottom-right).

---

## Layout — two-column composition

```
┌─────────────────────────────────────────────────────┐
│  LEFT  (≈ 60% width)          RIGHT (≈ 40%)         │
│                                                     │
│  [Logo 🤱]                     [Phone mockup or     │
│                                 soft illustration]  │
│  MaaMitra                                           │
│  Your AI mitra for                                  │
│  Indian motherhood.                                 │
│                                                     │
│  • AI chat • Milestones • Community                 │
│                                                     │
└─────────────────────────────────────────────────────┘
   dark plum gradient                     soft lilac
```

### Left column (on dark plum gradient)
- **Logo** (use `assets/logo.png`) top-left, ~120 px tall
- **Wordmark "MaaMitra"** in the app's display font (Fraunces / serif feel). Size ~72-80 px. Colour: **white**.
- **Headline tagline:** `Your AI mitra for Indian motherhood.` — ~36 px, white, medium weight, line-break after "for".
- **3 feature pills** below: `AI chat` `Milestones` `Community` — each a small rounded pill, lilac bg (`#F5F0FF`), plum text (`#1C1033`), 12px padding.

### Right column (on lilac `#F5F0FF`)
- Option A (fastest): a single phone-shaped mockup showing the app home screen or chat screen (use a phone screenshot you'll capture below). Float it with a soft shadow.
- Option B (no screenshot yet): a stylised illustration — a soft purple circle with the 🤱 emoji or a simple "mother + baby" silhouette in `#7C3AED`.

---

## Canva steps (5 min)

1. Open Canva → **Custom size** → 1024 × 500 px.
2. Drop a rectangle covering the full canvas → fill with linear gradient `#1C1033 → #6d1a7a` (120° angle).
3. Add a second rectangle on the right 40% → fill `#F5F0FF`. Skew its left edge 8° if you want a diagonal split (optional, looks great).
4. Upload `assets/logo.png` → place top-left on the dark side.
5. Add "MaaMitra" wordmark text → font: Fraunces or DM Serif Display → colour white.
6. Add the tagline → font: Inter or Nunito → weight 500 → white.
7. Add the 3 pills using Canva's rounded-rectangle shape + text inside.
8. On the right side: drop a phone mockup element from Canva's library and place a screenshot of the app inside. Or a simple circular avatar with the emoji.
9. **Check safe area:** preview with Play Store's 4:5 crop (Canva has a preview tool). Keep everything critical away from right 100 px in case Play overlays a play-icon.
10. Export as **PNG** at 1024 × 500 (no compression if possible).

Save to: `assets/play-store/feature-graphic.png`

---

## Text to copy-paste into Canva

- Wordmark: `MaaMitra`
- Tagline (two lines): `Your AI mitra for` / `Indian motherhood.`
- Pill 1: `AI chat`
- Pill 2: `Milestones`
- Pill 3: `Community`
- Optional footer (small, white 60% opacity, bottom-left): `maamitra.co.in`

---

## Alternative taglines (if the main one runs long)

- `Indian motherhood, one app.`
- `Your 2 a.m. parenting mitra.`
- `AI help for every stage of motherhood.`

---

## When done

Drop `feature-graphic.png` into `assets/play-store/` and tell me — I'll verify dimensions and preview how it'll sit on a Play Store listing card.
