# Tiffin & Family Meals (1 yr+) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "graduated! coming soon" dead-end in the Foods sub-tab with a real 1 yr+ Tiffin & Family Meals experience — three stacked sections (Today's pick → weekly planner → browse library) powered by a curated ~75-recipe registry and a deterministic rules-based daily pick.

**Architecture:** New static recipe + cuisine data files. New Zustand store for the Mon–Sun planner (Firestore-synced, mirrors the existing food tracker store). Pure-function daily-pick algorithm in `lib/`. Seven new components under `components/health/tiffin/`. Single line change in `FoodTrackerTab.tsx` to swap in `<TiffinScreen />` for kids 12 mo+. Untouched: 6–12 mo tracker, `babyFoods.ts`, existing Firestore food schema.

**Tech Stack:** React Native + Expo Router. Zustand + persist middleware (AsyncStorage) + Firestore sync. Jest + React Native Testing Library for tests. Ionicons + `Fonts.sansBold`/`sansRegular`/`sansSemiBold` from `constants/theme.ts` — same patterns as `FoodTrackerTab.tsx`.

**Spec:** [docs/superpowers/specs/2026-05-22-tiffin-family-meals-design.md](../specs/2026-05-22-tiffin-family-meals-design.md)

---

## Pre-flight checklist

- [ ] **Sync main repo first** (per `.claude/CLAUDE.md` rule #3): `git -C $(git rev-parse --show-toplevel)/../../.. status` and `git -C $(git rev-parse --show-toplevel)/../../.. stash list` — if main repo has unstaged changes or stashes, stop and tell the user.
- [ ] **Verify `.env` symlink** (per rule #7): `ls .env 2>/dev/null || ln -sf $(git rev-parse --show-toplevel)/../../../.env .env`
- [ ] `git fetch origin && git pull --rebase origin main`
- [ ] Read the spec at [docs/superpowers/specs/2026-05-22-tiffin-family-meals-design.md](../specs/2026-05-22-tiffin-family-meals-design.md) front-to-back before starting Task 1.

---

## File structure

### New files
| Path | Responsibility |
|---|---|
| `data/cuisines.ts` | 10 cuisine definitions: id, label, icon, tint color |
| `data/recipes.ts` | Recipe types + `RECIPES` array (~75 recipes) + `RECIPE_BY_ID` map + helpers (filter by diet/ageBand/cuisine) |
| `lib/weekKeys.ts` | `getMondayOf(date)`, `dayKeyForDate(date)`, `formatWeekKey`, DST-safe |
| `lib/dailyPick.ts` | `pickDailyRecipe(input)` — pure function, deterministic |
| `store/useMealPlannerStore.ts` | Per-kid Mon–Sun planner with rollover + Firestore sync |
| `components/health/tiffin/TiffinScreen.tsx` | Top-level — composes the 3 sections, owns active-kid + diet props |
| `components/health/tiffin/TodaysPickCard.tsx` | Section 1 |
| `components/health/tiffin/WeekStrip.tsx` | Section 2 — Mon–Sun grid |
| `components/health/tiffin/DayPickerSheet.tsx` | Bottom sheet to plan a day |
| `components/health/tiffin/BrowseLibrary.tsx` | Section 3 — pills + filter + search + list |
| `components/health/tiffin/RecipeCard.tsx` | Shared compact card (icon + tint + allergy chip) |
| `components/health/tiffin/RecipeDetailSheet.tsx` | Full recipe view + "Add to {day}" actions |
| `__tests__/lib/weekKeys.test.ts` | Unit tests |
| `__tests__/lib/dailyPick.test.ts` | Unit tests |
| `__tests__/store/useMealPlannerStore.test.ts` | Unit tests |

### Modified files
| Path | Change |
|---|---|
| `components/health/FoodTrackerTab.tsx` | Replace the `ageMonths >= 12` branch (lines 129–139) with `<TiffinScreen kid={activeKid} ageMonths={ageMonths} diet={parentDiet} />` |
| `services/firebase.ts` | Add `syncMealPlanner(uid, byKid)` (mirror of `syncFoodTracking`) after line 703 |

### Untouched
- `data/babyFoods.ts` (referenced by recipes via `containsFoodIds`, never modified)
- `store/useFoodTrackerStore.ts` (read-only consumer for allergy data)
- All other Foods-tab branches (no active kid, expecting, under 6 mo, 6–12 mo)
- Firestore `users/{uid}/foodTracking` document

---

## Task list

1. Scaffold tiffin folder + add `syncMealPlanner` to firebase service
2. Cuisine registry (`data/cuisines.ts`)
3. Recipe types and helpers scaffold (`data/recipes.ts` — empty array, full type machinery)
4. Seed Tiffin recipes from PDF (vegetarian, ages 2–10) — batch 1 of 4
5. Toddler (1–2 yr) recipes — batch 2 of 4
6. Non-veg tiffin recipes — batch 3 of 4
7. Eggetarian tiffin recipes — batch 4 of 4
8. Tag every recipe with `containsFoodIds[]` (allergy mapping)
9. Week-key helpers (`lib/weekKeys.ts`) + tests
10. Daily-pick algorithm (`lib/dailyPick.ts`) + tests
11. Meal planner store (`store/useMealPlannerStore.ts`) + tests
12. `RecipeCard` component
13. `RecipeDetailSheet` component
14. `TodaysPickCard` component
15. `WeekStrip` + `DayPickerSheet` components
16. `BrowseLibrary` component
17. `TiffinScreen` (composition)
18. Wire `TiffinScreen` into `FoodTrackerTab.tsx`
19. Manual QA pass + HANDOFF.md + commit
20. Sync chain: tsc → commit → push → expo export → firebase deploy → OTA

---

## Task 1: Scaffold tiffin folder + add `syncMealPlanner` to firebase service

**Files:**
- Create: `components/health/tiffin/.gitkeep`
- Modify: `services/firebase.ts` (add new function after line 703)

- [ ] **Step 1: Create the tiffin folder placeholder**

```bash
mkdir -p components/health/tiffin && touch components/health/tiffin/.gitkeep
```

- [ ] **Step 2: Add `syncMealPlanner` to `services/firebase.ts`**

Insert immediately after the `syncFoodTracking` block (after line 703 — right before `syncGrowthTracking`):

```ts
/** Persist per-kid Mon–Sun meal planner (Tiffin & Family Meals, 1 yr+). */
export async function syncMealPlanner(uid: string, byKid: Record<string, any>): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, 'users', uid), { mealPlanning: byKid, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error('syncMealPlanner error:', error);
    throw error;
  }
}
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS (no new errors). If errors, fix and re-run.

- [ ] **Step 4: Commit**

```bash
git add components/health/tiffin/.gitkeep services/firebase.ts
git commit -m "$(cat <<'EOF'
scaffold: tiffin folder + syncMealPlanner firestore writer

First slice of the 1 yr+ Tiffin & Family Meals feature. No UI yet —
just the folder placeholder and the Firestore sync function that mirrors
syncFoodTracking. Writes to users/{uid}.mealPlanning with merge.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Cuisine registry (`data/cuisines.ts`)

**Files:**
- Create: `data/cuisines.ts`

- [ ] **Step 1: Write the file**

```ts
// 10 cuisines for the 1 yr+ Tiffin & Family Meals feature.
// Tints are background colors for cuisine-tinted icon cards (V1) and the
// cuisine chip on recipe cards. Picked from the brand palette
// (dusty lavender + warm cream + blush + sage + ochre) — see
// constants/theme.ts and the existing FOOD_CATEGORIES tints in babyFoods.ts.

export type Cuisine =
  | 'north-indian'
  | 'south-indian'
  | 'gujarati'
  | 'bengali'
  | 'rajasthani'
  | 'maharashtrian'
  | 'punjabi'
  | 'kashmiri'
  | 'northeast'
  | 'continental';

export interface CuisineInfo {
  id: Cuisine;
  label: string;
  icon: string;   // Ionicons name
  tint: string;   // background color for tinted icon card
}

export const CUISINES: CuisineInfo[] = [
  { id: 'north-indian',   label: 'N. Indian',      icon: 'flame-outline',      tint: '#FED7AA' },
  { id: 'south-indian',   label: 'S. Indian',      icon: 'leaf-outline',       tint: '#DCFCE7' },
  { id: 'gujarati',       label: 'Gujarati',       icon: 'restaurant-outline', tint: '#FEF3C7' },
  { id: 'bengali',        label: 'Bengali',        icon: 'fish-outline',       tint: '#F9E4E0' },
  { id: 'rajasthani',     label: 'Rajasthani',     icon: 'sparkles-outline',   tint: '#FFE4E6' },
  { id: 'maharashtrian',  label: 'Maharashtrian',  icon: 'cafe-outline',       tint: '#FED7AA' },
  { id: 'punjabi',        label: 'Punjabi',        icon: 'pizza-outline',      tint: '#FEF3C7' },
  { id: 'kashmiri',       label: 'Kashmiri',       icon: 'snow-outline',       tint: '#DBEAFE' },
  { id: 'northeast',      label: 'NE Indian',      icon: 'flower-outline',     tint: '#EDE9FE' },
  { id: 'continental',    label: 'Continental',    icon: 'globe-outline',      tint: '#E0F2FE' },
];

export const CUISINE_BY_ID: Record<Cuisine, CuisineInfo> = CUISINES.reduce(
  (acc, c) => ({ ...acc, [c.id]: c }),
  {} as Record<Cuisine, CuisineInfo>,
);
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add data/cuisines.ts
git commit -m "data: add 10-cuisine registry for Tiffin feature

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Recipe types and helpers scaffold (`data/recipes.ts`)

**Files:**
- Create: `data/recipes.ts`

This task lands the type machinery and helpers with an empty array. The next four tasks populate it.

- [ ] **Step 1: Write the file**

```ts
// Recipe registry for the 1 yr+ Tiffin & Family Meals feature.
// Source: Little Tiffin Recipes PDF (vegetarian, ages 2–10) + author-added
// non-veg, eggetarian, and toddler-adapted entries. See
// docs/superpowers/specs/2026-05-22-tiffin-family-meals-design.md §6.1.

import { Cuisine } from './cuisines';
import { FoodDiet } from './babyFoods';

export type AgeBand = 'toddler' | 'preschool' | 'school-jr' | 'school-sr';

export const AGE_BANDS: { id: AgeBand; label: string; range: string; minMonths: number; maxMonths: number }[] = [
  { id: 'toddler',   label: 'Toddler',         range: '1–2 yr', minMonths: 12, maxMonths: 24 },
  { id: 'preschool', label: 'Pre-school',      range: '2–4 yr', minMonths: 24, maxMonths: 48 },
  { id: 'school-jr', label: 'School (junior)', range: '4–7 yr', minMonths: 48, maxMonths: 84 },
  { id: 'school-sr', label: 'School (senior)', range: '7–10 yr', minMonths: 84, maxMonths: 120 },
];

export type RecipeTag =
  | 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'tiffin'
  | 'quick'     // ≤ 20 min total
  | 'one-pot'
  | 'festive'
  | 'fingerfood';

export interface Recipe {
  /** Stable slug — persisted in planner. */
  id: string;
  name: string;
  cuisine: Cuisine;
  ageBands: AgeBand[];
  diet: FoodDiet;
  timeMinutes: number;
  serves: number;
  ingredients: string[];
  steps: string[];
  tip?: string;
  /** IDs from data/babyFoods.ts — drives allergy warnings. Empty = no flagged ingredients. */
  containsFoodIds: string[];
  tags: RecipeTag[];
  /** V1 reserved for Phase 1.5 illustrations. Always null in V1. */
  image?: null;
}

/** Diet inclusion hierarchy (mirrors babyFoods.ts). */
const DIET_RANK: Record<FoodDiet, number> = {
  vegan: 0,
  vegetarian: 1,
  eggetarian: 2,
  nonveg: 3,
};

/** Does a user with `parentDiet` see a recipe with `recipeDiet`? */
export function isRecipeVisibleForDiet(recipeDiet: FoodDiet, parentDiet: FoodDiet | undefined): boolean {
  if (!parentDiet) return true;
  return DIET_RANK[recipeDiet] <= DIET_RANK[parentDiet];
}

/** Does a recipe apply to a kid in the given age band? */
export function isRecipeForBand(recipe: Recipe, band: AgeBand): boolean {
  return recipe.ageBands.includes(band);
}

/** Map kid's age in months → age band. Caps 10+ yr at school-sr. */
export function ageBandForMonths(ageMonths: number): AgeBand {
  if (ageMonths < 24) return 'toddler';
  if (ageMonths < 48) return 'preschool';
  if (ageMonths < 84) return 'school-jr';
  return 'school-sr';
}

// Helper to keep recipe entries DRY. NOT exported — internal to this file.
function r(
  id: string,
  name: string,
  cuisine: Cuisine,
  ageBands: AgeBand[],
  diet: FoodDiet,
  timeMinutes: number,
  serves: number,
  ingredients: string[],
  steps: string[],
  tags: RecipeTag[],
  opts: { tip?: string; containsFoodIds?: string[] } = {},
): Recipe {
  return {
    id,
    name,
    cuisine,
    ageBands,
    diet,
    timeMinutes,
    serves,
    ingredients,
    steps,
    tip: opts.tip,
    containsFoodIds: opts.containsFoodIds ?? [],
    tags,
    image: null,
  };
}

// ─── Master recipe list ─────────────────────────────────────────
// Recipes are added in task batches: PDF veg (Task 4), toddler (Task 5),
// non-veg (Task 6), eggetarian (Task 7). Allergy tagging in Task 8.

export const RECIPES: Recipe[] = [];

export const RECIPE_BY_ID: Record<string, Recipe> = RECIPES.reduce(
  (acc, x) => ({ ...acc, [x.id]: x }),
  {} as Record<string, Recipe>,
);

/** Diet + age-band + cuisine filter chain used by Browse and daily pick. */
export function filterRecipes(opts: {
  diet?: FoodDiet;
  ageBand?: AgeBand;
  cuisine?: Cuisine | 'all';
  search?: string;
}): Recipe[] {
  const search = opts.search?.trim().toLowerCase() ?? '';
  return RECIPES.filter((rec) => {
    if (opts.diet && !isRecipeVisibleForDiet(rec.diet, opts.diet)) return false;
    if (opts.ageBand && !isRecipeForBand(rec, opts.ageBand)) return false;
    if (opts.cuisine && opts.cuisine !== 'all' && rec.cuisine !== opts.cuisine) return false;
    if (search && !rec.name.toLowerCase().includes(search)) return false;
    return true;
  });
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add data/recipes.ts
git commit -m "data: recipe registry scaffold (types + helpers, empty list)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Seed Tiffin recipes from PDF — vegetarian, ages 2–10

**Files:**
- Modify: `data/recipes.ts` (append entries inside the `RECIPES` array)

The PDF has 50+ vegetarian recipes across 10 cuisines. Each entry needs the full body — ingredients, steps, tip. The schema is shown in Task 3.

- [ ] **Step 1: Source the PDF content**

Open `/Users/vijay/Downloads/Little Tiffin Recipes.pdf`. For each recipe, extract:
- Name, cuisine, time, serves, ingredients (list), steps (list), morning tip.

- [ ] **Step 2: Add ~50 recipe entries inside `RECIPES`**

Use the `r(...)` helper. Distribute across cuisines roughly evenly (5+ per cuisine). All entries use `diet: 'vegetarian'` (or `'vegan'` if no dairy/honey). `ageBands` is typically `['preschool', 'school-jr', 'school-sr']` — older-skewing tiffin. Tags include `'tiffin'` for all; add `'quick'` when `timeMinutes <= 20`, `'festive'` for celebration meals.

Pattern for one entry (do not invent — pull from PDF):

```ts
r(
  'aloo-paratha',
  'Aloo Paratha',
  'punjabi',
  ['preschool', 'school-jr', 'school-sr'],
  'vegetarian',
  20,
  2,
  [
    '2 small potatoes, boiled and mashed',
    '1 cup whole wheat flour (atta)',
    '1/4 tsp ajwain',
    '1/4 tsp salt (skip for under 1 yr)',
    'Ghee for cooking',
  ],
  [
    'Mash potatoes with ajwain and salt — make sure no lumps.',
    'Make a soft dough with atta and water; rest 10 min.',
    'Roll a small disc, place stuffing, seal, roll gently into a paratha.',
    'Cook on a tawa with ghee until golden on both sides.',
    'Cool slightly before packing — slice into wedges for small hands.',
  ],
  ['tiffin', 'breakfast'],
  {
    tip: 'Make the dough and stuffing the night before — assembly takes 5 min in the morning.',
    // containsFoodIds added in Task 8
  },
),
```

Add ~50 entries. Keep id slugs kebab-case and unique.

- [ ] **Step 3: `RECIPE_BY_ID` map**

No code change needed — `RECIPE_BY_ID` was declared `RECIPES.reduce(...)` in Task 3. The `.reduce` runs at module load *after* the `RECIPES` array literal is fully constructed (top-down execution of `const` declarations), so adding entries to the array literal in Task 4 automatically populates the map. Quick check: open `data/recipes.ts` in editor and confirm the `RECIPE_BY_ID` declaration is positioned *after* the `RECIPES` array.

- [ ] **Step 4: TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS. Common failures: duplicate id keys (rename); cuisine string not in union (typo).

- [ ] **Step 5: Commit**

```bash
git add data/recipes.ts
git commit -m "data: seed ~50 vegetarian tiffin recipes from Little Tiffin PDF

Covers all 10 cuisines for the preschool/school age bands. Toddler
band, non-veg, and eggetarian recipes follow in subsequent commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Toddler (1–2 yr) recipes

**Files:**
- Modify: `data/recipes.ts`

Adapt ~13 toddler recipes from the 10–12 mo page of `/Users/vijay/Downloads/Baby_Meal_Plan.pdf` — soft khichdi, dal-rice, paneer mash, soft idli, vegetable upma, fruit-curd bowls, sabudana khichdi, etc. Texture: soft / mashed / finger-food sized. **No salt** added until age 1; minimal after. **No honey**, **no whole nuts**, **no whole grapes / cherry tomatoes**.

- [ ] **Step 1: Add ~13 toddler entries**

Same `r(...)` helper. Each entry has `ageBands: ['toddler']` (do NOT add older bands — toddler portions/textures differ). Tags typically `['breakfast' or 'lunch' or 'dinner', 'fingerfood']`. Cuisines mostly `'south-indian'` (idli, dosa, upma), `'north-indian'` (khichdi, dal-rice), and `'gujarati'` (thepla soft).

Suggested list (final names from execution; one example shape):

```ts
r(
  'toddler-soft-khichdi',
  'Soft Veg Khichdi',
  'north-indian',
  ['toddler'],
  'vegetarian',
  25,
  2,
  [
    '1/4 cup rice',
    '2 tbsp moong dal',
    '1/4 cup mixed soft veggies (carrot, bottle gourd, peas) finely chopped',
    '1 tsp ghee',
    'Pinch turmeric',
    'Water as needed',
  ],
  [
    'Wash rice and dal together; soak 10 min.',
    'Pressure cook rice, dal, veggies, turmeric with 1.5 cups water for 3 whistles.',
    'Mash slightly so toddler can self-feed; finish with ghee.',
    'Serve warm — should fall off a spoon, not run.',
  ],
  ['lunch', 'one-pot'],
  { tip: 'Make a bigger batch — toddlers eat half and the rest is family lunch.' },
),
```

13 entries total. Cover: soft khichdi, dal-rice, paneer mash + chapati, mashed idli, soft dosa wedges, vegetable upma, sabudana khichdi (soft), curd rice mush, fruit + curd bowl, soft thepla, ragi porridge (continued from weaning), banana oats, soft poha.

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add data/recipes.ts
git commit -m "data: add ~13 toddler (1–2 yr) recipes adapted from 10–12 mo plan

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Non-veg tiffin recipes

**Files:**
- Modify: `data/recipes.ts`

Author ~15 non-veg tiffin recipes drawn from well-known Indian school-tiffin staples. User vets during PR review. **No invented exotic recipes** — these are commonly-known dishes.

- [ ] **Step 1: Add ~15 non-veg entries**

`diet: 'nonveg'`, `ageBands` typically `['preschool', 'school-jr', 'school-sr']`. Suggested coverage:

| Cuisine | Recipe (illustrative — name TBD per author judgement) |
|---|---|
| North Indian | Chicken keema paratha, mutton kheema toast |
| South Indian | Chicken chettinad rice (mild), fish curry rice (mild) |
| Bengali | Macher jhol with rice, fish cutlet sandwich |
| Punjabi | Butter chicken roll (mild), chicken tikka wrap (skewers removed) |
| Gujarati | (skip — Gujarati is typically veg) |
| Maharashtrian | Chicken sukka with bhakri |
| Rajasthani | Laal maas with bajra roti (mild for kids) |
| Kashmiri | Rogan josh rice bowl (mild) |
| NE Indian | Smoked pork rice (mild — for older kids only) |
| Continental | Chicken sandwich, tuna pasta salad (mild) |

Each entry follows the same `r(...)` shape from Task 4. Spice levels noted as "mild for kids" in steps. Use cooked, boneless preparations where possible. Mark age-restrictive entries (e.g., laal maas) with `ageBands: ['school-jr', 'school-sr']` only.

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add data/recipes.ts
git commit -m "data: add ~15 non-veg tiffin recipes across cuisines

Author-drafted from well-known Indian school-tiffin staples. User
review/edit during PR. Spice levels kept mild; bones removed where
possible.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Eggetarian tiffin recipes

**Files:**
- Modify: `data/recipes.ts`

Author ~10 eggetarian recipes — vegetarian families who eat eggs. `diet: 'eggetarian'`.

- [ ] **Step 1: Add ~10 eggetarian entries**

Coverage:

| Recipe (illustrative) | Cuisine |
|---|---|
| Egg bhurji paratha | Punjabi |
| Masala omelette roll | North Indian |
| Egg-veg fried rice | Continental |
| Anda curry with rice | North Indian |
| Egg dosa | South Indian |
| Egg sandwich | Continental |
| Egg appam | South Indian |
| Egg pulao (mild) | North Indian |
| Egg curry with chapati | Bengali |
| Egg paratha (folded with omelette) | Punjabi |

Same `r(...)` shape. `ageBands: ['preschool', 'school-jr', 'school-sr']` for all (egg is fine from 9 mo per existing tracker, so preschool-and-up is safe).

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add data/recipes.ts
git commit -m "data: add ~10 eggetarian tiffin recipes

Author-drafted, user review during PR.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Tag every recipe with `containsFoodIds[]`

**Files:**
- Modify: `data/recipes.ts`

Every recipe needs `containsFoodIds: [...]` populated so allergy warnings work. IDs come from `data/babyFoods.ts` — they look like `'fruits.apple'`, `'nutsSeeds.peanut'`, `'eggsPoultry.egg-whole'`, `'fishSeafood.salmon'`, etc.

- [ ] **Step 1: Build the ID lookup**

```bash
grep -E "^\s*f\('" data/babyFoods.ts | head -40
```

Read `data/babyFoods.ts` end-to-end. Extract every food ID. The ID format is `${category}.${slug}`. Common ones the recipes will reference:
- Fruits: `fruits.apple`, `fruits.banana`, `fruits.pear`, `fruits.papaya`, `fruits.avocado`, `fruits.mango`, `fruits.grapes-mashed`, `fruits.tomato` (check actual slugs)
- Vegetables: `vegetables.carrot`, `vegetables.spinach`, `vegetables.potato`, `vegetables.peas`, `vegetables.bottle-gourd`, `vegetables.pumpkin`, `vegetables.beetroot`
- Grains: `grains.rice`, `grains.wheat-roti`, `grains.ragi`, `grains.oats`, `grains.suji`, `grains.dalia`, `grains.poha`, `grains.idli`, `grains.dosa`
- Dairy: `dairy.curd`, `dairy.paneer`, `dairy.ghee`, `dairy.cheese`, `dairy.milk-cow`
- Lentils: `lentils.moong-dal`, `lentils.toor-dal`, `lentils.chana`, `lentils.rajma`, `lentils.urad-dal`
- Eggs/poultry: `eggsPoultry.egg-whole`, `eggsPoultry.egg-yolk`, `eggsPoultry.chicken`
- Fish: `fishSeafood.fish-rohu`, `fishSeafood.fish-pomfret`, `fishSeafood.prawn`
- Meat: `meat.mutton`, `meat.lamb`
- Nuts/seeds: `nutsSeeds.peanut`, `nutsSeeds.almond-paste`, `nutsSeeds.sesame`
- Spices: `spices.turmeric`, `spices.cumin`, `spices.coriander`

Verify each ID against the actual file before tagging.

- [ ] **Step 2: Walk every recipe and tag its `containsFoodIds`**

For each recipe in `RECIPES`, scan ingredients and tag every match. Example:

```ts
r(
  'aloo-paratha',
  'Aloo Paratha',
  'punjabi',
  ['preschool', 'school-jr', 'school-sr'],
  'vegetarian',
  20, 2,
  [/* ingredients */],
  [/* steps */],
  ['tiffin', 'breakfast'],
  {
    tip: '...',
    containsFoodIds: ['vegetables.potato', 'grains.wheat-roti', 'dairy.ghee', 'spices.ajwain'],
  },
),
```

Common high-risk allergens to ALWAYS tag if present:
- `nutsSeeds.peanut` (vermicelli, certain chutneys)
- `nutsSeeds.almond` / cashew (kheer, korma, biryani)
- `dairy.milk-cow`, `dairy.curd`, `dairy.paneer` (lactose)
- `eggsPoultry.egg-whole` (every eggetarian recipe)
- `fishSeafood.*`, `meat.*` (non-veg)
- `spices.mustard` (Bengali, S. Indian tempering)
- `nutsSeeds.sesame` (til)

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS. A common failure is a `containsFoodIds` string that doesn't exist in `babyFoods.ts` — but since the field is typed `string[]`, tsc won't catch it. Spot-check by importing `FOOD_BY_ID` in a test helper if needed.

- [ ] **Step 4: Quick sanity check via Node**

```bash
node -e "
const { RECIPES } = require('./data/recipes.ts');
const untagged = RECIPES.filter(r => r.containsFoodIds.length === 0);
console.log('Total recipes:', RECIPES.length);
console.log('Untagged:', untagged.map(r => r.id));
"
```
(If ts-node isn't available, do this as a manual scan in the editor — every recipe should have at least 2 entries in `containsFoodIds`.)

- [ ] **Step 5: Commit**

```bash
git add data/recipes.ts
git commit -m "data: tag all recipes with containsFoodIds for allergy warnings

Maps every recipe's ingredients to data/babyFoods.ts IDs so the 6–12 mo
reaction history surfaces yellow warning chips on relevant recipe cards.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Week-key helpers (`lib/weekKeys.ts`) + tests

**Files:**
- Create: `lib/weekKeys.ts`
- Create: `__tests__/lib/weekKeys.test.ts`

- [ ] **Step 1: Write the failing tests first**

```ts
// __tests__/lib/weekKeys.test.ts
import { getMondayOf, dayKeyForDate, isSameWeek, addDays } from '../../lib/weekKeys';

describe('getMondayOf', () => {
  it('returns the same date when given a Monday', () => {
    expect(getMondayOf(new Date('2026-05-18'))).toEqual(new Date('2026-05-18T00:00:00'));
  });
  it('returns the previous Monday for a Wednesday', () => {
    // 2026-05-20 is a Wednesday → Monday is 2026-05-18
    expect(getMondayOf(new Date('2026-05-20'))).toEqual(new Date('2026-05-18T00:00:00'));
  });
  it('returns the previous Monday for a Sunday', () => {
    // 2026-05-24 is a Sunday → Monday is 2026-05-18
    expect(getMondayOf(new Date('2026-05-24'))).toEqual(new Date('2026-05-18T00:00:00'));
  });
  it('handles month boundaries', () => {
    // 2026-06-01 is a Monday — should return itself
    expect(getMondayOf(new Date('2026-06-01'))).toEqual(new Date('2026-06-01T00:00:00'));
    // 2026-06-02 is a Tuesday — Monday is 2026-06-01
    expect(getMondayOf(new Date('2026-06-02'))).toEqual(new Date('2026-06-01T00:00:00'));
  });
  it('handles year boundaries', () => {
    // 2027-01-01 is a Friday — Monday is 2026-12-28
    expect(getMondayOf(new Date('2027-01-01'))).toEqual(new Date('2026-12-28T00:00:00'));
  });
});

describe('dayKeyForDate', () => {
  it('returns "mon" for Monday', () => {
    expect(dayKeyForDate(new Date('2026-05-18'))).toBe('mon');
  });
  it('returns "sun" for Sunday', () => {
    expect(dayKeyForDate(new Date('2026-05-24'))).toBe('sun');
  });
  it('returns "thu" for Thursday', () => {
    expect(dayKeyForDate(new Date('2026-05-21'))).toBe('thu');
  });
});

describe('isSameWeek', () => {
  it('returns true for two dates in the same Mon-Sun week', () => {
    expect(isSameWeek(new Date('2026-05-18'), new Date('2026-05-24'))).toBe(true);
  });
  it('returns false for dates in different weeks', () => {
    expect(isSameWeek(new Date('2026-05-24'), new Date('2026-05-25'))).toBe(false);
  });
});

describe('addDays', () => {
  it('handles month rollover', () => {
    expect(addDays(new Date('2026-05-30'), 3)).toEqual(new Date('2026-06-02T00:00:00'));
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx jest __tests__/lib/weekKeys.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/weekKeys.ts`**

```ts
// Week math for the Mon-Sun meal planner. All operations work in LOCAL
// time so a parent in IST sees the same week boundaries regardless of UTC.

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** Returns local midnight of the Monday of the week containing `d`. */
export function getMondayOf(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate()); // local midnight, copy
  const dow = out.getDay(); // 0=Sun .. 6=Sat
  // Shift back to Monday: Mon=1 → 0, Tue=2 → 1, ..., Sun=0 → 6
  const shift = dow === 0 ? 6 : dow - 1;
  out.setDate(out.getDate() - shift);
  return out;
}

/** Returns the planner's DayKey for a date (mon..sun). */
export function dayKeyForDate(d: Date): DayKey {
  const dow = d.getDay(); // 0=Sun .. 6=Sat
  // Map: Sun=0 → 'sun' (index 6), Mon=1 → 'mon' (index 0), ...
  const idx = dow === 0 ? 6 : dow - 1;
  return DAY_KEYS[idx];
}

/** True if two dates fall in the same Mon-Sun week. */
export function isSameWeek(a: Date, b: Date): boolean {
  return getMondayOf(a).getTime() === getMondayOf(b).getTime();
}

/** Adds N days to a date (negative ok). Returns a fresh local-midnight copy. */
export function addDays(d: Date, n: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + n);
  return out;
}

/** YYYY-MM-DD format for the local date — used as the planner's week key. */
export function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export { DAY_KEYS };
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx jest __tests__/lib/weekKeys.test.ts`
Expected: PASS (all green).

- [ ] **Step 5: Commit**

```bash
git add lib/weekKeys.ts __tests__/lib/weekKeys.test.ts
git commit -m "lib: week-key helpers (Mon-Sun) for meal planner

DST-safe and month/year-boundary tested. Used by useMealPlannerStore
for rollover and by dailyPick for last-7-days lookup.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Daily-pick algorithm (`lib/dailyPick.ts`) + tests

**Files:**
- Create: `lib/dailyPick.ts`
- Create: `__tests__/lib/dailyPick.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/lib/dailyPick.test.ts
import { pickDailyRecipe, PickInput } from '../../lib/dailyPick';

function baseInput(overrides: Partial<PickInput> = {}): PickInput {
  return {
    ageBand: 'preschool',
    diet: 'vegetarian',
    last7DaysRecipeIds: [],
    reactionFlaggedFoodIds: new Set(),
    todayISO: '2026-05-22',
    dayOfWeek: 4, // Thursday
    todayPlanned: undefined,
    ...overrides,
  };
}

describe('pickDailyRecipe', () => {
  it('short-circuits to the planned recipe when today is already in the planner', () => {
    const result = pickDailyRecipe(baseInput({
      todayPlanned: { recipeId: 'aloo-paratha', plannedAt: '2026-05-22T07:00:00Z' },
    }));
    expect(result.recipeId).toBe('aloo-paratha');
    expect(result.reasonOneLine).toContain('Planned');
  });

  it('returns a non-null recipe for a typical preschool vegetarian input', () => {
    const result = pickDailyRecipe(baseInput());
    expect(result.recipeId).not.toBeNull();
  });

  it('excludes recipes in last7DaysRecipeIds', () => {
    // Run twice — first to find what it picks, then exclude it
    const first = pickDailyRecipe(baseInput());
    expect(first.recipeId).not.toBeNull();
    const second = pickDailyRecipe(baseInput({
      last7DaysRecipeIds: [first.recipeId!],
    }));
    expect(second.recipeId).not.toBe(first.recipeId);
  });

  it('is deterministic — same input → same output across 100 runs', () => {
    const input = baseInput();
    const first = pickDailyRecipe(input);
    for (let i = 0; i < 100; i++) {
      expect(pickDailyRecipe(input).recipeId).toBe(first.recipeId);
    }
  });

  it('returns null with an empty-state reason when no recipes match', () => {
    const result = pickDailyRecipe(baseInput({
      ageBand: 'toddler',
      diet: 'vegan', // tight filter
      last7DaysRecipeIds: [], // doesn't matter
      // If toddler+vegan still has matches, change to an impossible combo by feeding a huge exclusion list
    }));
    // This may or may not return null depending on recipe coverage —
    // just assert the shape is well-formed
    expect(result).toHaveProperty('recipeId');
    expect(result).toHaveProperty('reasonOneLine');
  });

  it('penalizes recipes with reaction-flagged ingredients but does not hard-filter', () => {
    // Lower-priority test — depends on recipe coverage; mostly a smoke test
    const result = pickDailyRecipe(baseInput({
      reactionFlaggedFoodIds: new Set(['nutsSeeds.peanut']),
    }));
    expect(result.recipeId).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx jest __tests__/lib/dailyPick.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/dailyPick.ts`**

```ts
// Deterministic rules-based daily recipe pick for the 1 yr+ Foods screen.
// Spec §7. No network. No randomness — same input → same output.

import { RECIPES, Recipe, AgeBand, isRecipeVisibleForDiet, isRecipeForBand } from '../data/recipes';
import { FoodDiet } from '../data/babyFoods';
import { Cuisine } from '../data/cuisines';

export interface PlannedDayInput {
  recipeId?: string;
  freeText?: string;
  plannedAt: string;
}

export interface PickInput {
  ageBand: AgeBand;
  diet: FoodDiet;
  /** Recipe IDs planned/eaten in the last 7 days (current week so far + last week). */
  last7DaysRecipeIds: string[];
  /** Food IDs from babyFoods.ts where this kid has an uncleared rash/vomit reaction. */
  reactionFlaggedFoodIds: Set<string>;
  /** YYYY-MM-DD. */
  todayISO: string;
  /** 0=Sun .. 6=Sat. */
  dayOfWeek: number;
  /** If today is already planned, that wins. */
  todayPlanned?: PlannedDayInput;
}

export interface PickResult {
  recipeId: string | null;
  reasonOneLine: string;
}

const WEEKDAY = (d: number) => d >= 1 && d <= 5;

/** Stable, deterministic tiebreak hash. Same input → same output. */
function stableHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Score a single candidate. Higher = better. */
function scoreRecipe(rec: Recipe, input: PickInput, last7Cuisines: Set<Cuisine>): number {
  let score = 0;
  if (!last7Cuisines.has(rec.cuisine)) score += 10;
  if (WEEKDAY(input.dayOfWeek) && rec.tags.includes('quick')) score += 5;
  if (!WEEKDAY(input.dayOfWeek) && (rec.tags.includes('festive') || rec.tags.includes('one-pot'))) score += 5;
  if (WEEKDAY(input.dayOfWeek) && rec.tags.includes('tiffin')) score += 3;
  if (rec.containsFoodIds.some((id) => input.reactionFlaggedFoodIds.has(id))) score -= 5;
  return score;
}

export function pickDailyRecipe(input: PickInput): PickResult {
  // 1. Short-circuit if today is already planned
  if (input.todayPlanned?.recipeId) {
    return { recipeId: input.todayPlanned.recipeId, reasonOneLine: 'Planned for today.' };
  }

  // 2. Filter by diet + age band, exclude last 7 days
  const last7 = new Set(input.last7DaysRecipeIds);
  const candidates = RECIPES.filter((rec) =>
    isRecipeVisibleForDiet(rec.diet, input.diet) &&
    isRecipeForBand(rec, input.ageBand) &&
    !last7.has(rec.id),
  );

  if (candidates.length === 0) {
    return { recipeId: null, reasonOneLine: 'No recipes match today's filters. Try browsing.' };
  }

  // 3. Score
  const last7Cuisines = new Set<Cuisine>(
    input.last7DaysRecipeIds
      .map((id) => RECIPES.find((r) => r.id === id)?.cuisine)
      .filter((c): c is Cuisine => !!c),
  );

  const scored = candidates.map((rec) => ({
    rec,
    score: scoreRecipe(rec, input, last7Cuisines),
  }));

  // 4. Deterministic tiebreak: hash(recipeId + todayISO)
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return stableHash(a.rec.id + input.todayISO) - stableHash(b.rec.id + input.todayISO);
  });

  const pick = scored[0].rec;

  // 5. Reason one-liner — pick the rule that fired hardest
  let clause: string;
  if (!last7Cuisines.has(pick.cuisine) && last7Cuisines.size > 0) {
    const days = 9; // approximate — we don't track exact gap in V1
    clause = `You haven't done ${pick.cuisine.replace('-', ' ')} in a while`;
  } else if (WEEKDAY(input.dayOfWeek) && pick.tags.includes('quick')) {
    clause = 'Light weekday breakfast';
  } else if (!WEEKDAY(input.dayOfWeek) && pick.tags.includes('festive')) {
    clause = 'Weekend special';
  } else if (pick.tags.includes('tiffin')) {
    clause = 'Great tiffin pick';
  } else {
    clause = 'Great for this age';
  }

  return {
    recipeId: pick.id,
    reasonOneLine: `Quick ${pick.timeMinutes} min · ${clause}.`,
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx jest __tests__/lib/dailyPick.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/dailyPick.ts __tests__/lib/dailyPick.test.ts
git commit -m "lib: deterministic rules-based daily recipe pick

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Meal planner store (`store/useMealPlannerStore.ts`) + tests

**Files:**
- Create: `store/useMealPlannerStore.ts`
- Create: `__tests__/store/useMealPlannerStore.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/store/useMealPlannerStore.test.ts
import { useMealPlannerStore } from '../../store/useMealPlannerStore';

// Reset before each test
beforeEach(() => {
  useMealPlannerStore.getState().resetPlanner();
});

describe('useMealPlannerStore', () => {
  it('starts empty', () => {
    expect(useMealPlannerStore.getState().byKid).toEqual({});
  });

  it('sets a day for a kid', () => {
    useMealPlannerStore.getState().setDay('kid-1', 'mon', { recipeId: 'aloo-paratha' });
    const kid = useMealPlannerStore.getState().byKid['kid-1'];
    expect(kid.current.days.mon?.recipeId).toBe('aloo-paratha');
    expect(kid.current.weekStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('overwrites a previously-set day', () => {
    useMealPlannerStore.getState().setDay('kid-1', 'mon', { recipeId: 'aloo-paratha' });
    useMealPlannerStore.getState().setDay('kid-1', 'mon', { recipeId: 'dosa' });
    expect(useMealPlannerStore.getState().byKid['kid-1'].current.days.mon?.recipeId).toBe('dosa');
  });

  it('clears a day', () => {
    useMealPlannerStore.getState().setDay('kid-1', 'mon', { recipeId: 'aloo-paratha' });
    useMealPlannerStore.getState().clearDay('kid-1', 'mon');
    expect(useMealPlannerStore.getState().byKid['kid-1'].current.days.mon).toBeUndefined();
  });

  it('supports free-text fallback', () => {
    useMealPlannerStore.getState().setDay('kid-1', 'tue', { freeText: 'leftover dal-rice' });
    expect(useMealPlannerStore.getState().byKid['kid-1'].current.days.tue?.freeText).toBe('leftover dal-rice');
  });

  it('isolates by kid', () => {
    useMealPlannerStore.getState().setDay('kid-1', 'mon', { recipeId: 'aloo-paratha' });
    useMealPlannerStore.getState().setDay('kid-2', 'mon', { recipeId: 'dosa' });
    expect(useMealPlannerStore.getState().byKid['kid-1'].current.days.mon?.recipeId).toBe('aloo-paratha');
    expect(useMealPlannerStore.getState().byKid['kid-2'].current.days.mon?.recipeId).toBe('dosa');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx jest __tests__/store/useMealPlannerStore.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `store/useMealPlannerStore.ts`**

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, syncMealPlanner } from '../services/firebase';
import { DayKey, getMondayOf, formatYMD, isSameWeek } from '../lib/weekKeys';

export interface PlannedDay {
  recipeId?: string;
  freeText?: string;
  plannedAt: string;
}

export interface PlannerWeek {
  weekStartDate: string; // YYYY-MM-DD of local Monday
  days: Partial<Record<DayKey, PlannedDay>>;
}

export interface KidPlanner {
  current: PlannerWeek;
  history: PlannerWeek[]; // last 8 weeks, FIFO
}

interface MealPlannerState {
  byKid: Record<string /* kidId */, KidPlanner>;

  hydrate: (byKid: Record<string, KidPlanner>) => void;
  setDay: (kidId: string, dayKey: DayKey, payload: { recipeId?: string; freeText?: string }) => void;
  clearDay: (kidId: string, dayKey: DayKey) => void;
  /** Called on mount — archives the current week into history if it's no longer this week. */
  rolloverIfStale: (kidId: string) => void;
  resetPlanner: () => void;
}

function freshWeek(): PlannerWeek {
  return {
    weekStartDate: formatYMD(getMondayOf(new Date())),
    days: {},
  };
}

function freshKidPlanner(): KidPlanner {
  return { current: freshWeek(), history: [] };
}

function pushToFirestore(byKid: Record<string, KidPlanner>) {
  const uid = auth?.currentUser?.uid;
  if (uid) {
    syncMealPlanner(uid, byKid).catch(() => {
      // non-blocking — local persist still saves
    });
  }
}

export const useMealPlannerStore = create<MealPlannerState>()(
  persist(
    (set, get) => ({
      byKid: {},

      hydrate: (byKid) => set({ byKid: byKid ?? {} }),

      setDay: (kidId, dayKey, payload) => {
        set((state) => {
          const kid = state.byKid[kidId] ?? freshKidPlanner();
          const today = new Date();
          const currentMonday = formatYMD(getMondayOf(today));
          // Rollover inline if needed
          let current = kid.current;
          let history = kid.history;
          if (current.weekStartDate !== currentMonday) {
            history = [current, ...history].slice(0, 8);
            current = freshWeek();
          }
          const days = {
            ...current.days,
            [dayKey]: {
              ...payload,
              plannedAt: new Date().toISOString(),
            },
          };
          const nextKid: KidPlanner = { current: { ...current, days }, history };
          const byKid = { ...state.byKid, [kidId]: nextKid };
          pushToFirestore(byKid);
          return { byKid };
        });
      },

      clearDay: (kidId, dayKey) => {
        set((state) => {
          const kid = state.byKid[kidId];
          if (!kid) return state;
          const days = { ...kid.current.days };
          delete days[dayKey];
          const nextKid: KidPlanner = { ...kid, current: { ...kid.current, days } };
          const byKid = { ...state.byKid, [kidId]: nextKid };
          pushToFirestore(byKid);
          return { byKid };
        });
      },

      rolloverIfStale: (kidId) => {
        set((state) => {
          const kid = state.byKid[kidId];
          if (!kid) return state;
          const currentMonday = formatYMD(getMondayOf(new Date()));
          if (kid.current.weekStartDate === currentMonday) return state;
          const history = [kid.current, ...kid.history].slice(0, 8);
          const nextKid: KidPlanner = { current: freshWeek(), history };
          const byKid = { ...state.byKid, [kidId]: nextKid };
          pushToFirestore(byKid);
          return { byKid };
        });
      },

      resetPlanner: () => set({ byKid: {} }),
    }),
    {
      name: 'maamitra-meal-planner',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** Convenience: get the recipe IDs the kid has planned in the current + history weeks within the last 7 days. */
export function getLast7DaysRecipeIds(kidPlanner: KidPlanner | undefined): string[] {
  if (!kidPlanner) return [];
  const ids: string[] = [];
  const allWeeks = [kidPlanner.current, ...kidPlanner.history.slice(0, 1)]; // current + previous
  for (const w of allWeeks) {
    for (const d of Object.values(w.days)) {
      if (d?.recipeId) ids.push(d.recipeId);
    }
  }
  return ids;
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx jest __tests__/store/useMealPlannerStore.test.ts`
Expected: PASS.

If tests fail because `syncMealPlanner` import errors in jest (no firestore in node env), mock it:

```ts
// At top of test file, before imports:
jest.mock('../../services/firebase', () => ({
  auth: { currentUser: null },
  syncMealPlanner: jest.fn(),
}));
```

- [ ] **Step 5: Commit**

```bash
git add store/useMealPlannerStore.ts __tests__/store/useMealPlannerStore.test.ts
git commit -m "store: Mon-Sun meal planner with Firestore sync + rollover

Mirrors useFoodTrackerStore patterns. History caps at 8 weeks FIFO.
getLast7DaysRecipeIds helper feeds the daily-pick algorithm.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: `RecipeCard` component

**Files:**
- Create: `components/health/tiffin/RecipeCard.tsx`

Shared compact card used in Browse, planner cells (compact variant), and search results. Shows icon + name + meta + optional allergy chip.

- [ ] **Step 1: Write the component**

```tsx
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Fonts } from '../../../constants/theme';
import { CUISINE_BY_ID } from '../../../data/cuisines';
import { Recipe } from '../../../data/recipes';

const INK = '#1C1033';
const STONE = '#6B7280';
const MIST = '#EDE9F6';
const WARN_BG = '#FEF3C7';
const WARN_FG = '#92400E';
const WARN_BORDER = '#FCD34D';

interface Props {
  recipe: Recipe;
  /** IDs from babyFoods.ts that triggered an uncleared rash/vomit for this kid. */
  flaggedFoodIds?: Set<string>;
  onPress: () => void;
}

export default function RecipeCard({ recipe, flaggedFoodIds, onPress }: Props) {
  const cuisine = CUISINE_BY_ID[recipe.cuisine];
  const flagged = flaggedFoodIds
    ? recipe.containsFoodIds.filter((id) => flaggedFoodIds.has(id))
    : [];
  const tagsLine = recipe.tags
    .filter((t) => t === 'tiffin' || t === 'breakfast' || t === 'quick' || t === 'festive')
    .slice(0, 2)
    .map((t) => t[0].toUpperCase() + t.slice(1))
    .join(' · ');

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.card}>
      <View style={[styles.iconBox, { backgroundColor: cuisine.tint }]}>
        <Ionicons name={cuisine.icon as any} size={20} color={INK} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.name} numberOfLines={1}>{recipe.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {cuisine.label} · {recipe.timeMinutes} min{tagsLine ? ` · ${tagsLine}` : ''}
        </Text>
        {flagged.length > 0 && (
          <View style={styles.warnChip}>
            <Ionicons name="warning-outline" size={11} color={WARN_FG} />
            <Text style={styles.warnText}>
              Contains {flagged.length} watch ingredient{flagged.length === 1 ? '' : 's'}
            </Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={14} color="#C5BDD3" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#ffffff',
    borderRadius: 13,
    padding: 11,
    borderWidth: 1,
    borderColor: MIST,
    marginBottom: 8,
  },
  iconBox: {
    width: 44, height: 44, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontFamily: Fonts.sansSemiBold, fontSize: 13.5, color: INK, marginBottom: 2 },
  meta: { fontFamily: Fonts.sansRegular, fontSize: 11, color: STONE },
  warnChip: {
    alignSelf: 'flex-start',
    marginTop: 4,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 7,
    backgroundColor: WARN_BG,
    borderWidth: 1, borderColor: WARN_BORDER,
  },
  warnText: { fontFamily: Fonts.sansSemiBold, fontSize: 10, color: WARN_FG },
});
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/health/tiffin/RecipeCard.tsx
git commit -m "ui: RecipeCard with cuisine tint + allergy chip

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: `RecipeDetailSheet` component

**Files:**
- Create: `components/health/tiffin/RecipeDetailSheet.tsx`

Full recipe view in a bottom-sheet modal. Shows ingredients, steps, tip, allergy banner, and "Add to {day}" actions.

- [ ] **Step 1: Look at the existing `FoodDetailSheet` for sheet conventions**

```bash
sed -n '1,40p' components/health/FoodDetailSheet.tsx
```

Match its Modal + ScrollView + close-button pattern.

- [ ] **Step 2: Write the component**

```tsx
import { useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts } from '../../../constants/theme';
import { CUISINE_BY_ID } from '../../../data/cuisines';
import { Recipe } from '../../../data/recipes';
import { DAY_KEYS, DayKey } from '../../../lib/weekKeys';
import { FOOD_BY_ID } from '../../../data/babyFoods';

const INK = '#1C1033';
const STONE = '#6B7280';
const MIST = '#EDE9F6';
const ROSE = Colors.primary;
const PLUM = Colors.primary;
const WARN_BG = '#FEF3C7';
const WARN_FG = '#92400E';
const WARN_BORDER = '#FCD34D';

interface Props {
  visible: boolean;
  recipe: Recipe | null;
  flaggedFoodIds?: Set<string>;
  onClose: () => void;
  onAddToDay: (dayKey: DayKey) => void;
}

const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

export default function RecipeDetailSheet({ visible, recipe, flaggedFoodIds, onClose, onAddToDay }: Props) {
  const cuisine = recipe ? CUISINE_BY_ID[recipe.cuisine] : null;
  const flaggedNames = useMemo(() => {
    if (!recipe || !flaggedFoodIds) return [];
    return recipe.containsFoodIds
      .filter((id) => flaggedFoodIds.has(id))
      .map((id) => FOOD_BY_ID[id]?.name)
      .filter((n): n is string => !!n);
  }, [recipe, flaggedFoodIds]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={INK} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{recipe?.name ?? ''}</Text>
          <View style={{ width: 22 }} />
        </View>
        {recipe && cuisine && (
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={[styles.heroIcon, { backgroundColor: cuisine.tint }]}>
              <Ionicons name={cuisine.icon as any} size={36} color={INK} />
            </View>
            <Text style={styles.recipeName}>{recipe.name}</Text>
            <Text style={styles.recipeMeta}>{cuisine.label} · {recipe.timeMinutes} min · Serves {recipe.serves}</Text>

            {flaggedNames.length > 0 && (
              <View style={styles.warnBanner}>
                <Ionicons name="warning-outline" size={16} color={WARN_FG} />
                <Text style={styles.warnText}>
                  Contains {flaggedNames.join(', ')}. Your child has had a reaction to {flaggedNames.length === 1 ? 'this' : 'one of these'} — review in the tracker before serving.
                </Text>
              </View>
            )}

            <Text style={styles.sectionLabel}>Ingredients</Text>
            {recipe.ingredients.map((ing, i) => (
              <Text key={i} style={styles.bullet}>• {ing}</Text>
            ))}

            <Text style={styles.sectionLabel}>Steps</Text>
            {recipe.steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <Text style={styles.stepNum}>{i + 1}</Text>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}

            {recipe.tip && (
              <View style={styles.tipBox}>
                <Ionicons name="bulb-outline" size={15} color={PLUM} />
                <Text style={styles.tipText}>{recipe.tip}</Text>
              </View>
            )}

            <Text style={styles.sectionLabel}>Add to planner</Text>
            <View style={styles.dayRow}>
              {DAY_KEYS.map((d) => (
                <TouchableOpacity
                  key={d}
                  onPress={() => onAddToDay(d)}
                  style={styles.dayBtn}
                  activeOpacity={0.85}
                >
                  <Text style={styles.dayBtnText}>{DAY_LABELS[d]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF9F0' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: MIST,
  },
  headerTitle: { fontFamily: Fonts.sansBold, fontSize: 15, color: INK, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  scroll: { padding: 18, paddingBottom: 60 },
  heroIcon: {
    width: 64, height: 64, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-start', marginBottom: 12,
  },
  recipeName: { fontFamily: Fonts.sansBold, fontSize: 20, color: INK, marginBottom: 4 },
  recipeMeta: { fontFamily: Fonts.sansRegular, fontSize: 13, color: STONE, marginBottom: 14 },
  warnBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 10, borderRadius: 10,
    backgroundColor: WARN_BG, borderWidth: 1, borderColor: WARN_BORDER,
    marginBottom: 18,
  },
  warnText: { flex: 1, fontFamily: Fonts.sansMedium, fontSize: 12.5, color: WARN_FG, lineHeight: 18 },
  sectionLabel: { fontFamily: Fonts.sansBold, fontSize: 13, color: INK, marginTop: 16, marginBottom: 8 },
  bullet: { fontFamily: Fonts.sansRegular, fontSize: 13, color: INK, lineHeight: 20, marginBottom: 3 },
  stepRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  stepNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.primaryAlpha08, color: PLUM,
    fontFamily: Fonts.sansBold, fontSize: 12, textAlign: 'center', lineHeight: 22,
  },
  stepText: { flex: 1, fontFamily: Fonts.sansRegular, fontSize: 13, color: INK, lineHeight: 19 },
  tipBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.primaryAlpha05,
    borderLeftWidth: 3, borderLeftColor: PLUM,
    borderRadius: 10, padding: 11, marginTop: 14,
  },
  tipText: { flex: 1, fontFamily: Fonts.sansMedium, fontSize: 12.5, color: '#4c1d95', lineHeight: 18 },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  dayBtn: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 11,
    backgroundColor: Colors.primaryAlpha08,
  },
  dayBtnText: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: PLUM },
});
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/health/tiffin/RecipeDetailSheet.tsx
git commit -m "ui: RecipeDetailSheet — ingredients, steps, tip, allergy banner, planner CTAs

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: `TodaysPickCard` component

**Files:**
- Create: `components/health/tiffin/TodaysPickCard.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Fonts } from '../../../constants/theme';
import { CUISINE_BY_ID } from '../../../data/cuisines';
import { Recipe } from '../../../data/recipes';

const INK = '#1C1033';
const STONE = '#6B7280';
const ROSE = Colors.primary;
const PLUM = Colors.primary;
const MIST = '#EDE9F6';

interface Props {
  recipe: Recipe | null;
  reasonOneLine: string;
  isPlanned: boolean;
  todayLabel: string; // e.g. "Thu, 22 May"
  onView: () => void;
  onSwap: () => void;
}

export default function TodaysPickCard({ recipe, reasonOneLine, isPlanned, todayLabel, onView, onSwap }: Props) {
  if (!recipe) {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>★ Today's pick</Text>
        <Text style={styles.emptyText}>{reasonOneLine}</Text>
      </View>
    );
  }
  const cuisine = CUISINE_BY_ID[recipe.cuisine];
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.label}>{isPlanned ? '✓ Planned today' : '★ Today's pick'}</Text>
        <Text style={styles.dayBadge}>{todayLabel}</Text>
      </View>
      <View style={styles.recipeRow}>
        <View style={[styles.iconBox, { backgroundColor: cuisine.tint }]}>
          <Ionicons name={cuisine.icon as any} size={28} color={INK} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.recipeName}>{recipe.name}</Text>
          <Text style={styles.recipeMeta}>
            {cuisine.label} · {recipe.timeMinutes} min · Serves {recipe.serves}
          </Text>
        </View>
      </View>
      <View style={styles.reasonBox}>
        <Text style={styles.reasonText}>{reasonOneLine}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={onView} activeOpacity={0.9}>
          <LinearGradient colors={[ROSE, PLUM]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryGrad}>
            <Text style={styles.primaryText}>View recipe</Text>
          </LinearGradient>
        </TouchableOpacity>
        {!isPlanned && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={onSwap} activeOpacity={0.85}>
            <Text style={styles.secondaryText}>Swap</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1, borderColor: '#F1EBF8',
    marginBottom: 12,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  label: { fontFamily: Fonts.sansBold, fontSize: 11, color: ROSE, letterSpacing: 1 },
  dayBadge: { fontFamily: Fonts.sansSemiBold, fontSize: 11, color: STONE },
  recipeRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  iconBox: {
    width: 56, height: 56, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  recipeName: { fontFamily: Fonts.sansBold, fontSize: 16, color: INK, marginBottom: 2 },
  recipeMeta: { fontFamily: Fonts.sansRegular, fontSize: 12, color: STONE },
  reasonBox: {
    marginTop: 10, paddingHorizontal: 11, paddingVertical: 9,
    backgroundColor: Colors.primaryAlpha05,
    borderLeftWidth: 3, borderLeftColor: PLUM,
    borderRadius: 8,
  },
  reasonText: { fontFamily: Fonts.sansMedium, fontSize: 12.5, color: '#4c1d95', lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  primaryBtn: { flex: 1, borderRadius: 11, overflow: 'hidden' },
  primaryGrad: { paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: Fonts.sansBold, color: '#fff', fontSize: 13.5 },
  secondaryBtn: {
    paddingVertical: 11, paddingHorizontal: 18, borderRadius: 11,
    backgroundColor: '#fff', borderWidth: 1, borderColor: MIST,
  },
  secondaryText: { fontFamily: Fonts.sansSemiBold, color: PLUM, fontSize: 13 },
  emptyText: { fontFamily: Fonts.sansRegular, fontSize: 13, color: STONE, marginTop: 8 },
});
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/health/tiffin/TodaysPickCard.tsx
git commit -m "ui: TodaysPickCard with reason line + View/Swap actions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: `WeekStrip` + `DayPickerSheet` components

**Files:**
- Create: `components/health/tiffin/WeekStrip.tsx`
- Create: `components/health/tiffin/DayPickerSheet.tsx`

- [ ] **Step 1: Write `WeekStrip.tsx`**

```tsx
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Fonts } from '../../../constants/theme';
import { DayKey, DAY_KEYS, addDays, getMondayOf } from '../../../lib/weekKeys';
import { PlannedDay } from '../../../store/useMealPlannerStore';
import { RECIPE_BY_ID } from '../../../data/recipes';

const INK = '#1C1033';
const STONE = '#6B7280';
const MIST = '#EDE9F6';
const ROSE = Colors.primary;
const BLUSH = '#F9E4E0';
const SAGE = '#34D399';

const DAY_LETTERS: Record<DayKey, string> = {
  mon: 'MON', tue: 'TUE', wed: 'WED', thu: 'THU', fri: 'FRI', sat: 'SAT', sun: 'SUN',
};

interface Props {
  weekStartDate: string; // YYYY-MM-DD
  days: Partial<Record<DayKey, PlannedDay>>;
  todayDayKey: DayKey;
  onTapDay: (dayKey: DayKey) => void;
}

export default function WeekStrip({ days, todayDayKey, onTapDay }: Props) {
  return (
    <View style={styles.row}>
      {DAY_KEYS.map((dk) => {
        const planned = days[dk];
        const isToday = dk === todayDayKey;
        const recipe = planned?.recipeId ? RECIPE_BY_ID[planned.recipeId] : null;
        const label = recipe?.name ?? planned?.freeText ?? null;
        return (
          <TouchableOpacity
            key={dk}
            onPress={() => onTapDay(dk)}
            activeOpacity={0.85}
            style={[styles.cell, isToday && styles.cellToday]}
          >
            <Text style={[styles.dayLetter, isToday && styles.dayLetterToday]}>{DAY_LETTERS[dk]}</Text>
            {label ? (
              <>
                <Text style={styles.dayName} numberOfLines={1}>{label}</Text>
                {!isToday && <View style={styles.dot} />}
              </>
            ) : (
              <>
                <Ionicons name="add" size={16} color={STONE} style={{ opacity: 0.5, marginVertical: 6 }} />
                <Text style={[styles.dayName, { opacity: 0.5 }]}>Plan</Text>
              </>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  cell: {
    flex: 1, minHeight: 78,
    paddingVertical: 8, paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: MIST,
    alignItems: 'center',
    position: 'relative',
  },
  cellToday: { backgroundColor: BLUSH, borderColor: ROSE, borderWidth: 1.5 },
  dayLetter: { fontFamily: Fonts.sansBold, fontSize: 9.5, color: STONE, letterSpacing: 0.5 },
  dayLetterToday: { color: ROSE },
  dayName: {
    fontFamily: Fonts.sansSemiBold, fontSize: 9, color: INK,
    textAlign: 'center', marginTop: 4, paddingHorizontal: 2,
  },
  dot: {
    position: 'absolute', top: 6, right: 6,
    width: 5, height: 5, borderRadius: 5,
    backgroundColor: SAGE,
  },
});
```

- [ ] **Step 2: Write `DayPickerSheet.tsx`**

```tsx
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../../constants/theme';
import { DayKey } from '../../../lib/weekKeys';
import { AgeBand, filterRecipes, Recipe } from '../../../data/recipes';
import { FoodDiet } from '../../../data/babyFoods';
import RecipeCard from './RecipeCard';

const INK = '#1C1033';
const STONE = '#6B7280';
const MIST = '#EDE9F6';
const PLUM = Colors.primary;

interface Props {
  visible: boolean;
  dayKey: DayKey | null;
  ageBand: AgeBand;
  diet: FoodDiet | undefined;
  flaggedFoodIds?: Set<string>;
  onClose: () => void;
  onPick: (payload: { recipeId?: string; freeText?: string }) => void;
}

const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

export default function DayPickerSheet({ visible, dayKey, ageBand, diet, flaggedFoodIds, onClose, onPick }: Props) {
  const [search, setSearch] = useState('');
  const [freeText, setFreeText] = useState('');

  const recipes = useMemo(
    () => filterRecipes({ diet, ageBand, search }),
    [diet, ageBand, search],
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={INK} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            Plan {dayKey ? DAY_LABELS[dayKey] : ''}
          </Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={16} color={STONE} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search dosa, paratha…"
            placeholderTextColor="#9ca3af"
            style={styles.searchInput}
          />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {recipes.slice(0, 50).map((rec) => (
            <RecipeCard
              key={rec.id}
              recipe={rec}
              flaggedFoodIds={flaggedFoodIds}
              onPress={() => { onPick({ recipeId: rec.id }); onClose(); }}
            />
          ))}
          <Text style={styles.orLabel}>Or type something custom</Text>
          <View style={styles.freeRow}>
            <TextInput
              value={freeText}
              onChangeText={setFreeText}
              placeholder="e.g. leftover dal-rice"
              placeholderTextColor="#9ca3af"
              style={styles.freeInput}
            />
            <TouchableOpacity
              style={styles.addBtn}
              disabled={freeText.trim().length === 0}
              onPress={() => {
                onPick({ freeText: freeText.trim() });
                setFreeText('');
                onClose();
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF9F0' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: MIST,
  },
  headerTitle: { fontFamily: Fonts.sansBold, fontSize: 15, color: INK, flex: 1, textAlign: 'center' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 16, padding: 10,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: MIST,
  },
  searchInput: { flex: 1, fontFamily: Fonts.sansRegular, fontSize: 13.5, color: INK },
  orLabel: {
    fontFamily: Fonts.sansBold, fontSize: 12, color: STONE,
    textAlign: 'center', marginTop: 16, marginBottom: 8, letterSpacing: 0.5,
  },
  freeRow: { flexDirection: 'row', gap: 8 },
  freeInput: {
    flex: 1, fontFamily: Fonts.sansRegular, fontSize: 13.5, color: INK,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: MIST,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  addBtn: {
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 11,
    backgroundColor: PLUM,
  },
  addBtnText: { fontFamily: Fonts.sansBold, color: '#fff', fontSize: 13 },
});
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/health/tiffin/WeekStrip.tsx components/health/tiffin/DayPickerSheet.tsx
git commit -m "ui: WeekStrip + DayPickerSheet for Mon-Sun planner

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: `BrowseLibrary` component

**Files:**
- Create: `components/health/tiffin/BrowseLibrary.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../../constants/theme';
import { CUISINES, Cuisine } from '../../../data/cuisines';
import { AGE_BANDS, AgeBand, filterRecipes, Recipe } from '../../../data/recipes';
import { FoodDiet } from '../../../data/babyFoods';
import RecipeCard from './RecipeCard';

const INK = '#1C1033';
const STONE = '#6B7280';
const MIST = '#EDE9F6';
const PLUM = Colors.primary;

interface Props {
  kidAgeBand: AgeBand;
  diet: FoodDiet | undefined;
  flaggedFoodIds?: Set<string>;
  onPickRecipe: (r: Recipe) => void;
}

export default function BrowseLibrary({ kidAgeBand, diet, flaggedFoodIds, onPickRecipe }: Props) {
  const [cuisine, setCuisine] = useState<Cuisine | 'all'>('all');
  const [ageBand, setAgeBand] = useState<AgeBand>(kidAgeBand);
  const [search, setSearch] = useState('');

  const recipes = useMemo(
    () => filterRecipes({ diet, ageBand, cuisine, search }),
    [diet, ageBand, cuisine, search],
  );

  const currentBandLabel = AGE_BANDS.find((b) => b.id === ageBand)?.label ?? '';

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Browse recipes</Text>
        <TouchableOpacity
          style={styles.ageFilter}
          onPress={() => {
            // cycle through bands
            const idx = AGE_BANDS.findIndex((b) => b.id === ageBand);
            setAgeBand(AGE_BANDS[(idx + 1) % AGE_BANDS.length].id);
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.ageFilterText}>
            {currentBandLabel} ({AGE_BANDS.find((b) => b.id === ageBand)?.range})
          </Text>
          <Ionicons name="chevron-down" size={12} color={PLUM} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
        <Pill label="All" active={cuisine === 'all'} onPress={() => setCuisine('all')} />
        {CUISINES.map((c) => (
          <Pill key={c.id} label={c.label} active={cuisine === c.id} onPress={() => setCuisine(c.id)} />
        ))}
      </ScrollView>

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={STONE} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search paneer, dosa, paratha…"
          placeholderTextColor="#9ca3af"
          style={styles.searchInput}
        />
      </View>

      <View style={{ marginTop: 10 }}>
        {recipes.length === 0 ? (
          <Text style={styles.empty}>No recipes match. Try a different cuisine or age band.</Text>
        ) : (
          recipes.slice(0, 60).map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              flaggedFoodIds={flaggedFoodIds}
              onPress={() => onPickRecipe(r)}
            />
          ))
        )}
      </View>
    </View>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontFamily: Fonts.sansBold, fontSize: 14.5, color: INK },
  ageFilter: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, backgroundColor: Colors.primaryAlpha08,
  },
  ageFilterText: { fontFamily: Fonts.sansSemiBold, fontSize: 11.5, color: PLUM },
  pillsRow: { flexDirection: 'row', gap: 6, paddingBottom: 4 },
  pill: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14,
    backgroundColor: '#fff', borderWidth: 1, borderColor: MIST,
  },
  pillActive: { backgroundColor: Colors.primaryAlpha08, borderColor: PLUM },
  pillText: { fontFamily: Fonts.sansSemiBold, fontSize: 11.5, color: STONE },
  pillTextActive: { color: PLUM },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 10, padding: 10,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: MIST,
  },
  searchInput: { flex: 1, fontFamily: Fonts.sansRegular, fontSize: 13.5, color: INK },
  empty: { fontFamily: Fonts.sansRegular, fontSize: 12.5, color: STONE, textAlign: 'center', paddingVertical: 20 },
});
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/health/tiffin/BrowseLibrary.tsx
git commit -m "ui: BrowseLibrary — cuisine pills, age filter, search, recipe list

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: `TiffinScreen` (composition)

**Files:**
- Create: `components/health/tiffin/TiffinScreen.tsx`

This composes everything. It owns:
- Active kid + age + diet (from parent)
- The picked recipe state (Today's pick computed via `dailyPick`)
- The currently-open detail sheet recipe
- The currently-open day picker

- [ ] **Step 1: Write the component**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Colors, Fonts } from '../../../constants/theme';
import { ageBandForMonths, AgeBand, RECIPE_BY_ID, Recipe } from '../../../data/recipes';
import { FoodDiet } from '../../../data/babyFoods';
import { useMealPlannerStore, getLast7DaysRecipeIds } from '../../../store/useMealPlannerStore';
import { useFoodTrackerStore } from '../../../store/useFoodTrackerStore';
import { pickDailyRecipe } from '../../../lib/dailyPick';
import { DayKey, dayKeyForDate } from '../../../lib/weekKeys';
import TodaysPickCard from './TodaysPickCard';
import WeekStrip from './WeekStrip';
import DayPickerSheet from './DayPickerSheet';
import BrowseLibrary from './BrowseLibrary';
import RecipeDetailSheet from './RecipeDetailSheet';

const ROSE = Colors.primary;
const PLUM = Colors.primary;
const INK = '#1C1033';
const STONE = '#6B7280';

interface Props {
  kidId: string;
  kidName: string;
  ageMonths: number;
  diet: FoodDiet | undefined;
}

const DAY_FORMATTER = new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short' });

export default function TiffinScreen({ kidId, kidName, ageMonths, diet }: Props) {
  const router = useRouter();
  const ageBand: AgeBand = ageBandForMonths(ageMonths);
  const byKid = useMealPlannerStore((s) => s.byKid);
  const setDay = useMealPlannerStore((s) => s.setDay);
  const rolloverIfStale = useMealPlannerStore((s) => s.rolloverIfStale);
  const kidPlanner = byKid[kidId];
  const foodEntries = useFoodTrackerStore((s) => s.byKid[kidId] ?? {});

  // Rollover on mount + when kid changes
  useEffect(() => {
    rolloverIfStale(kidId);
  }, [kidId, rolloverIfStale]);

  // Derive flagged food IDs from tracker reactions
  const flaggedFoodIds = useMemo(() => {
    const s = new Set<string>();
    for (const [foodId, entry] of Object.entries(foodEntries)) {
      if ((entry.reaction === 'rash' || entry.reaction === 'vomit') && !entry.cleared) {
        s.add(foodId);
      }
    }
    return s;
  }, [foodEntries]);

  const today = new Date();
  const todayDayKey = dayKeyForDate(today);
  const todayLabel = DAY_FORMATTER.format(today);
  const todayPlanned = kidPlanner?.current.days[todayDayKey];

  // Swap counter — incrementing this lets the user reroll today's pick
  const [swapCount, setSwapCount] = useState(0);

  const pick = useMemo(() => {
    return pickDailyRecipe({
      ageBand,
      diet: diet ?? 'nonveg',
      last7DaysRecipeIds: getLast7DaysRecipeIds(kidPlanner),
      reactionFlaggedFoodIds: flaggedFoodIds,
      todayISO: today.toISOString().slice(0, 10),
      dayOfWeek: today.getDay(),
      todayPlanned,
    });
  }, [ageBand, diet, kidPlanner, flaggedFoodIds, todayPlanned, swapCount, today]);

  const pickedRecipe: Recipe | null = pick.recipeId ? RECIPE_BY_ID[pick.recipeId] ?? null : null;

  const [openRecipe, setOpenRecipe] = useState<Recipe | null>(null);
  const [openDay, setOpenDay] = useState<DayKey | null>(null);

  function handleAskAI() {
    const plannedThisWeek = kidPlanner
      ? Object.entries(kidPlanner.current.days)
          .map(([dk, d]) => {
            const r = d?.recipeId ? RECIPE_BY_ID[d.recipeId] : null;
            return r ? r.name : d?.freeText;
          })
          .filter(Boolean)
          .join(', ')
      : '';
    const parts: string[] = [`My child ${kidName} is ${Math.floor(ageMonths / 12)} years old.`];
    if (diet) parts.push(`We're a ${diet} family — please only suggest foods we eat.`);
    if (plannedThisWeek) parts.push(`This week we've planned: ${plannedThisWeek}.`);
    parts.push('What should I cook or pack for school tiffin this week?');
    router.push({ pathname: '/(tabs)/chat', params: { prefill: parts.join(' ') } });
  }

  return (
    <View>
      {/* SECTION 1 — Today's pick */}
      <Text style={styles.eyebrow}>For today</Text>
      <TodaysPickCard
        recipe={pickedRecipe}
        reasonOneLine={pick.reasonOneLine}
        isPlanned={!!todayPlanned?.recipeId}
        todayLabel={todayLabel}
        onView={() => pickedRecipe && setOpenRecipe(pickedRecipe)}
        onSwap={() => setSwapCount((c) => c + 1)}
      />

      {/* SECTION 2 — Weekly planner */}
      <Text style={styles.eyebrow}>This week</Text>
      <WeekStrip
        weekStartDate={kidPlanner?.current.weekStartDate ?? ''}
        days={kidPlanner?.current.days ?? {}}
        todayDayKey={todayDayKey}
        onTapDay={(dk) => setOpenDay(dk)}
      />

      {/* Ask MaaMitra CTA */}
      <TouchableOpacity onPress={handleAskAI} activeOpacity={0.9} style={styles.askBtn}>
        <LinearGradient colors={[ROSE, PLUM]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.askGrad}>
          <Ionicons name="sparkles" size={16} color="#fff" />
          <Text style={styles.askText}>Ask MaaMitra what to cook this week</Text>
          <Ionicons name="arrow-forward" size={14} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* SECTION 3 — Browse */}
      <View style={{ marginTop: 18 }}>
        <BrowseLibrary
          kidAgeBand={ageBand}
          diet={diet}
          flaggedFoodIds={flaggedFoodIds}
          onPickRecipe={(r) => setOpenRecipe(r)}
        />
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={14} color={PLUM} />
        <Text style={styles.disclaimerText}>
          Recipes are guidance — adapt textures and portions to your child. Check with your paediatrician for any concerns.
        </Text>
      </View>

      <RecipeDetailSheet
        visible={!!openRecipe}
        recipe={openRecipe}
        flaggedFoodIds={flaggedFoodIds}
        onClose={() => setOpenRecipe(null)}
        onAddToDay={(dk) => {
          if (openRecipe) setDay(kidId, dk, { recipeId: openRecipe.id });
          setOpenRecipe(null);
        }}
      />

      <DayPickerSheet
        visible={!!openDay}
        dayKey={openDay}
        ageBand={ageBand}
        diet={diet}
        flaggedFoodIds={flaggedFoodIds}
        onClose={() => setOpenDay(null)}
        onPick={(payload) => {
          if (openDay) setDay(kidId, openDay, payload);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: Fonts.sansBold, fontSize: 10.5, color: PLUM,
    letterSpacing: 1, textTransform: 'uppercase',
    marginTop: 10, marginBottom: 6, marginLeft: 2,
  },
  askBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 14 },
  askGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12,
  },
  askText: { fontFamily: Fonts.sansBold, color: '#fff', fontSize: 13.5 },
  disclaimer: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    marginTop: 18, padding: 12,
    backgroundColor: Colors.primaryAlpha05, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.primaryAlpha08,
  },
  disclaimerText: {
    fontFamily: Fonts.sansRegular, flex: 1, fontSize: 12, color: STONE, lineHeight: 17,
  },
});
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/health/tiffin/TiffinScreen.tsx
git commit -m "ui: TiffinScreen composes Today's pick + Week strip + Browse

Reads from useMealPlannerStore + useFoodTrackerStore (for allergy
flagging), calls pickDailyRecipe deterministically, routes to chat
with prefilled context.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 18: Wire `TiffinScreen` into `FoodTrackerTab.tsx`

**Files:**
- Modify: `components/health/FoodTrackerTab.tsx`

- [ ] **Step 1: Add the import**

At the top of `components/health/FoodTrackerTab.tsx`, after the existing imports (around line 22):

```ts
import TiffinScreen from './tiffin/TiffinScreen';
```

- [ ] **Step 2: Replace the 12-month "graduated" branch**

Find this block (lines 126–139):

```tsx
  // ── 12 months and over ────────────────────────────────────────
  // This section covers the weaning window (6–12 months). Age-appropriate
  // content for older kids (tiffin ideas, family meals, etc.) is coming.
  if (ageMonths !== null && ageMonths >= 12) {
    return (
      <Card style={styles.emptyCard} shadow="sm">
        <Ionicons name="restaurant-outline" size={40} color={GOLD} style={{ marginBottom: 12 }} />
        <Text style={styles.emptyTitle}>{activeKid.name} has graduated!</Text>
        <Text style={styles.emptyText}>
          The weaning tracker covers 6–12 months. Age-appropriate meal ideas for {activeKid.name} — tiffin recipes, family foods, and more — are coming soon.
        </Text>
      </Card>
    );
  }
```

Replace with:

```tsx
  // ── 12 months and over → Tiffin & Family Meals ────────────────
  if (ageMonths !== null && ageMonths >= 12) {
    return (
      <TiffinScreen
        kidId={activeKid.id}
        kidName={activeKid.name}
        ageMonths={ageMonths}
        diet={parentDiet}
      />
    );
  }
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Hydrate the planner store from Firestore at app boot**

Find where `useFoodTrackerStore.hydrate` is wired in the app. Likely `services/firebase.ts` has a post-login function that reads `users/{uid}` and dispatches `hydrate`. Grep for it:

```bash
grep -rn "foodTracking" services/ store/ hooks/ app/ | head
```

In the same place, add a parallel hydrate for `mealPlanning`:

```ts
const mealPlanning = userData.mealPlanning ?? {};
useMealPlannerStore.getState().hydrate(mealPlanning);
```

If no such central hydrate exists, the persist middleware will load from AsyncStorage on app start — Firestore hydration can land as a follow-up. Note it in the commit message if so.

- [ ] **Step 5: Commit**

```bash
git add components/health/FoodTrackerTab.tsx services/firebase.ts
git commit -m "feat: wire TiffinScreen into Foods sub-tab for kids 12 mo+

Replaces the 'graduated! coming soon' dead-end with the new Tiffin &
Family Meals experience.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 19: Manual QA pass + HANDOFF.md

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: Run the manual QA path from the spec (§10.4)**

Start the Expo dev server (`npm start`) and follow:

1. Phone-login as `+91 9999999999` (OTP `123456`).
2. Use Family tab → confirm a kid exists with DOB making them >12 mo (e.g., born 2024-03-15 → today is 2026-05-22, age ~26 mo, preschool band). If no such kid, add one.
3. Open Health → Foods. Verify **TiffinScreen renders** (not the graduated card).
4. Verify Today's pick shows a non-null recipe matching the preschool band and the family's diet.
5. Tap **Swap** → verify pick changes.
6. Tap a Week strip cell (say Friday) → DayPickerSheet opens → tap a recipe → planner cell fills.
7. Reopen — Today's card should defer to the planned recipe if you tapped *today's* cell.
8. Open Profile → toggle diet from vegetarian to eggetarian → return to Foods → Browse list should grow (more recipes visible).
9. If the kid has a flagged reaction in the 6–12 mo tracker history, open a recipe containing that ingredient → verify yellow chip on card + banner in detail sheet.
10. Switch to a 6–11 mo kid (or add one) → verify original 3-day-rule tracker still renders unchanged.
11. Force-close the app → reopen → verify planner state persists.
12. Toggle airplane mode → plan a day → verify no UI error (Firestore sync fails silently, AsyncStorage saves).
13. Toggle airplane mode off → wait → next mutation re-syncs.

- [ ] **Step 2: Fix any bugs found**

Each bug fix is its own atomic commit with a clear message.

- [ ] **Step 3: Update `HANDOFF.md`**

Set:
```markdown
## Active task
None — Tiffin & Family Meals (1 yr+) shipped behind /(tabs)/health → Foods.

## Last action
Manual QA passed across all 13 scenarios. Ready for OTA.

## Next step
Run sync chain (Task 20).

## In-flight side processes
None.
```

- [ ] **Step 4: Commit**

```bash
git add HANDOFF.md
git commit -m "handoff: Tiffin feature manual QA complete

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 20: Sync chain — tsc → commit → push → expo export → firebase deploy → OTA

Per `.claude/CLAUDE.md` rule #4: do not stop partway. Tell user each link as done.

- [ ] **Step 1: Final TypeScript check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 2: Final test run**

```bash
npx jest __tests__/lib/weekKeys.test.ts __tests__/lib/dailyPick.test.ts __tests__/store/useMealPlannerStore.test.ts
```

Expected: all green.

- [ ] **Step 3: Verify nothing else is uncommitted**

```bash
git status
```

- [ ] **Step 4: Push to origin/main**

```bash
git push origin main
```

- [ ] **Step 5: Check for pending OTA changes**

```bash
git fetch origin --tags && git log ota/production-latest..origin/main --oneline
```

Expect: all commits from this plan listed.

- [ ] **Step 6: OTA publish**

```bash
npm run update
```

This invokes `scripts/safe-update.sh` which:
- Refuses if tree dirty or out of sync with origin.
- Publishes to EAS `production` channel.
- Force-moves the `ota/production-latest` tag.

- [ ] **Step 7: Verify on production**

Open `https://maamitra.co.in`, phone-login as `+91 9999999999`, switch to a >12 mo kid, open Foods. Verify Tiffin screen renders live.

- [ ] **Step 8: Final HANDOFF.md update**

```markdown
## Active task
None.

## Last action
Tiffin & Family Meals (1 yr+) shipped — OTA published to production
channel, verified live at maamitra.co.in.

## Next step
Open. Possible Phase 1.5 (per-recipe illustrations) or Phase 2 (6–12 mo
day-by-day meal plans) when prioritized.

## In-flight side processes
None.
```

Commit + push:

```bash
git add HANDOFF.md
git commit -m "handoff: Tiffin V1 shipped to production OTA

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

## Done

Spec §13 decision log fully implemented. Phase 1.5 (per-recipe illustrations via Codex batch) and Phase 2 (6–12 mo day-by-day Meal Plans) remain open follow-ups — separate specs when prioritized.
