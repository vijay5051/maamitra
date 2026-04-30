# Parked tasks — waiting on Codex

These tasks specifically require Codex's batch-image pipeline (the loop-the-
image-API → sharp WebP → commit chain that produced the 45-illustration
batch and the 3 time-of-day hero variants). ChatGPT chat caps per-message
images and drops context across long batches, so single-image asks work
there but >3-image batches don't. Picking these up requires Codex access.

Status as of 2026-04-30: Codex usage limit hit, no upgrade currently
available. Do NOT start these in a fallback path — they all need real
batch image generation.

## Tier 1 — Highest impact when Codex returns

### 1. Sticker pack for community reactions
- ~15 illustrated reactions (heart-with-baby, prayer hands, chai cup,
  marigold, "you got this", "sending love", etc.) replacing the generic ❤️
- 512×512 transparent PNG → WebP at q82
- Plus a `<StickerPicker>` component, sticker reactions data model,
  Firestore migration for existing post reactions
- Highest user-visible community win

### 2. Festival banner batch
- 5 seasonal banners: Diwali (diyas, marigolds), Holi (color splash, soft),
  monsoon (rain on window), summer (lassi, mango), winter (chai, shawl)
- 1000×400 cream backgrounds, brand palette
- Plus `useFestival()` hook returning the active festival window, and a
  small decor overlay component on home/wellness/community
- Pays off seasonally — Diwali Oct/Nov, Holi March, etc.

### 3. Custom illustrative nav + key icons
- Replace ~10 high-visibility Ionicons with brand SVG/raster illustrations
- Bottom tab bar (8 tabs) + a few prominent screen icons
- Should land AFTER the AppIcon foundation is in place (already built in
  this conversation as a manual fallback for the parked Codex spec, see
  components/ui/AppIcon.tsx and constants/icons.ts)

### 4. Phase D-1 small assets
- 2 illustrations needed when daily memory capture ships:
  - `empty-journey.webp` — Library Journey empty state, 800×600 transparent
  - `todays-moment-thumb.webp` — home card icon, 200×200 transparent
- Small enough that you could also generate via ChatGPT chat single-image
  if Codex stays unavailable when Phase D-1 build starts

## Spec source-of-truth

The spec template that worked well for image batches is in the project
chat history (the "MAAMITRA ILLUSTRATION BATCH" mega-prompt). Reuse the
structure:
- Brand style preface (palette, soft Indian motherhood, no text in image)
- Numbered list of `filename — size, background — scene description`
- Pipeline instructions (image API → sharp → WebP q82 → commit)
- Acceptance criteria (TS clean, web export, file sizes under target)
- PR convention (open PR, do not push to main directly)

## Workflow when Codex is back

1. Pick one parked tier-1 task
2. Ask Claude Code to write a fresh spec for it (it knows the pattern)
3. Paste into Codex Code mode, target `vijay5051/maamitra` on `main`
4. Wait for PR
5. Have Claude review for stale-base regressions and merge

Do NOT batch multiple tier-1 tasks into a single Codex run — 45-image
batches are the upper limit; 15-sticker-pack-plus-data-migration plus
8-icon-set is too much for one PR. One task at a time.
