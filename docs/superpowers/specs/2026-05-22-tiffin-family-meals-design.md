# Tiffin & Family Meals (1 yr+) — Design Spec

**Date:** 2026-05-22
**Phase:** 1 of 2 (Phase 2 = day-by-day Meal Plans for 6–12 mo, deferred to a separate spec)
**Surface:** Health tab → Foods sub-tab → renders when active kid is 12 months or older
**Status:** Approved for implementation planning

---

## 1. Problem

The Food Tracker today serves only 6–12 mo babies (3-day-rule introduction tracker). A kid who turns 12 months hits a dead-end screen — `"{Kid} has graduated! Age-appropriate meal ideas… are coming soon."` That's a dead click in a production app for every family with a toddler or school-going child.

Two PDFs were provided as content seeds:

- **Baby's Meal Plan (6–12 mo)** — day-by-day schedules honoring the 3-day rule. Future Phase 2 content.
- **Little Tiffin Recipes (age 2–10, vegetarian)** — 50+ recipes across 10 Indian cuisines. The seed for this spec.

## 2. Goal

Replace the "graduated" dead-end with a real, age-adaptive Tiffin & Family Meals experience that answers a school-morning parent's actual question: **"What should I cook or pack today?"**

## 3. Scope

### In scope (V1)
- Single Foods tab, content swaps by active kid's age (existing pattern extended).
- Three stacked sections for 1 yr+ kids: **Today's pick → Weekly planner → Browse library**.
- Rules-based daily pick (deterministic, no LLM, no network).
- Lightweight Mon–Sun planner, Firestore-synced per kid, free-text fallback.
- Soft allergy warnings sourced from existing 6–12 mo reaction history.
- Four age bands: Toddler (1–2), Pre-school (2–4), School (4–7), School (7–10).
- Diet filter extended to non-veg + eggetarian (Claude authors recipes; user vets during implementation review).
- Icon cards on cuisine-tinted backgrounds (no per-recipe imagery in V1).
- Content tasks Claude completes as part of V1:
  - Author ~15 non-veg + ~10 eggetarian tiffin recipes in the same PDF shape.
  - Adapt ~12–15 toddler (1–2 yr) recipes from the existing 10–12 mo PDF page.
  - Tag every recipe with `containsFoodIds[]` mapped to `data/babyFoods.ts` IDs.

### Out of scope (V1)
- Shopping list generation (aggregation, units, sharing).
- Push notifications / meal-prep reminders.
- LLM-powered daily picks or recipe ranking.
- Per-recipe illustrations (Phase 1.5 — batch via Codex, brand-style spec to be authored separately).
- Hard allergy filtering (we only warn, never hide).
- Day-by-day Meal Plans for 6–12 mo (Phase 2, separate spec).

## 4. UX architecture

### 4.1 Information architecture
- **No new top-level tab.** Existing Health → Foods sub-tab stays the home.
- Content swap inside `FoodTrackerTab.tsx` based on active kid age, matching the existing pattern (under-6mo, expecting, 6–12mo branches unchanged).
- New branch: `ageMonths >= 12` → renders `<TiffinScreen />` instead of the "graduated! coming soon" card.

### 4.2 Screen layout (1 yr+ active kid)
Single scrollable view, three stacked sections in order:

1. **Today's pick card** — recipe name, cuisine chip, time, serves, one-line reason (`"Quick 15 min · You haven't done Punjabi in 9 days"`), "View recipe" + "Swap" actions. If today is already filled in the planner, this card shows the planned recipe instead, with a subtle "Planned" badge.
2. **Weekly planner strip** — Mon–Sun mini grid showing the current ISO week. Each cell shows recipe name (or free-text, or "+ Plan"). Tap → opens `DayPickerSheet`. Today's cell is visually distinct.
3. **Browse library** — cuisine pills (10 cuisines + "All"), age-band filter, search, scrollable recipe list. Each row is a `RecipeCard`. Tapping opens `RecipeDetailSheet`.

A small "Ask MaaMitra" CTA — matching the gradient button pattern already used in the 6–12 mo tracker (`FoodTrackerTab.tsx` lines 262–273) — sits between sections 2 and 3, prefilled with kid age + diet + this week's planned meals.

### 4.3 Age band routing
| Kid age | Band | Default Browse filter |
|---|---|---|
| 12–24 mo | Toddler | Toddler band |
| 2–4 yr | Pre-school | Pre-school band |
| 4–7 yr | School (junior) | School junior |
| 7–10 yr | School (senior) | School senior |
| 10+ yr | School (senior) — capped | School senior |

Parent can override the Browse age filter; Today's pick always uses the kid's actual band.

## 5. Architecture & file layout

### 5.1 New data files (static, like `data/babyFoods.ts`)
- `data/recipes.ts` — `RECIPES: Recipe[]` and `RECIPE_BY_ID: Record<string, Recipe>`. ~75 recipes total.
- `data/cuisines.ts` — `CUISINES: CuisineInfo[]` with `id, label, tint, icon` for 10 cuisines (N. Indian, S. Indian, Gujarati, Bengali, Rajasthani, Maharashtrian, Punjabi, Kashmiri, Northeast, Continental).

### 5.2 New store (Firestore-synced, like `store/useFoodTrackerStore.ts`)
- `store/useMealPlannerStore.ts` — per-kid weekly planner with archival.

### 5.3 New components
All under `components/health/tiffin/`:
- `TiffinScreen.tsx` — top-level for 1 yr+ swap.
- `TodaysPickCard.tsx` — section 1.
- `WeekStrip.tsx` — section 2 (Mon–Sun grid).
- `DayPickerSheet.tsx` — bottom sheet to plan a day.
- `BrowseLibrary.tsx` — section 3.
- `RecipeCard.tsx` — shared compact card (icon + tint + allergy chip).
- `RecipeDetailSheet.tsx` — full recipe view + "Add to {day}" actions.

### 5.4 New logic module
- `lib/dailyPick.ts` — pure function `pickDailyRecipe(input) → { recipeId, reasonOneLine }`. Deterministic, no side effects.
- `lib/weekKeys.ts` — `getMondayOf(date)`, `dayKeyForDate(date)`, week comparison helpers. DST + month-boundary safe.

### 5.5 Modified files (minimal surface)
- `components/health/FoodTrackerTab.tsx` — replace the `ageMonths >= 12` branch with `<TiffinScreen />`. All other branches unchanged.
- `services/firebase.ts` — add `syncMealPlanner(uid, byKid)` next to `syncFoodTracking`.

### 5.6 Untouched
- 6–12 mo tracker (`FoodCategoryAccordion`, `FoodDetailSheet`, `useFoodTrackerStore`, `babyFoods.ts`) — zero changes.
- Firestore `foodTracking/{uid}` document — zero schema changes.

## 6. Data model

### 6.1 Recipe
```ts
type Cuisine =
  | 'north-indian' | 'south-indian' | 'gujarati' | 'bengali' | 'rajasthani'
  | 'maharashtrian' | 'punjabi' | 'kashmiri' | 'northeast' | 'continental';

type AgeBand = 'toddler' | 'preschool' | 'school-jr' | 'school-sr';

type RecipeDiet = 'vegan' | 'vegetarian' | 'eggetarian' | 'nonveg';

type RecipeTag = 'breakfast' | 'tiffin' | 'snack' | 'dinner' | 'festive' | 'quick' | 'one-pot';

interface Recipe {
  id: string;               // stable slug, persisted in planner
  name: string;
  cuisine: Cuisine;
  ageBands: AgeBand[];      // recipe may span multiple bands
  diet: RecipeDiet;         // most-restrictive diet that allows it
  timeMinutes: number;      // total prep + cook
  serves: number;
  ingredients: string[];    // human-readable
  steps: string[];
  tip?: string;             // "morning tip" from PDF
  containsFoodIds: string[]; // IDs from data/babyFoods.ts — drives allergy warnings
  tags: RecipeTag[];
  /** Optional override for v1 image; null for v1 → falls back to cuisine icon card. */
  image?: null;
}
```

### 6.2 Meal planner store
```ts
type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

interface PlannedDay {
  recipeId?: string;        // canonical: ref to data/recipes.ts
  freeText?: string;        // fallback for "just dal-rice today"
  plannedAt: string;        // ISO timestamp
}

interface PlannerWeek {
  weekStartDate: string;    // YYYY-MM-DD of local Monday
  days: Partial<Record<DayKey, PlannedDay>>;
}

interface KidPlanner {
  current: PlannerWeek;
  history: PlannerWeek[];   // last 8 weeks, FIFO
}

interface MealPlannerState {
  byKid: Record<string /* kidId */, KidPlanner>;
  setDay: (kidId: string, dayKey: DayKey, payload: { recipeId?: string; freeText?: string }) => void;
  clearDay: (kidId: string, dayKey: DayKey) => void;
  rolloverIfStale: (kidId: string) => void;  // called on mount
  hydrate: (byKid: Record<string, KidPlanner>) => void;
  resetPlanner: () => void;
}
```

### 6.3 Firestore shape
- Path: `mealPlanning/{uid}` — single document, mirrors `foodTracking/{uid}`.
- Body: `{ byKid: Record<kidId, KidPlanner>, updatedAt: serverTimestamp() }`.
- Synced via debounced `syncMealPlanner(uid, byKid)` on every store mutation, same non-blocking pattern as `pushToFirestore` in `useFoodTrackerStore.ts`.

## 7. Daily pick algorithm

`pickDailyRecipe(input): { recipeId, reasonOneLine }`

**Input:**
```ts
{
  ageBand: AgeBand;
  diet: FoodDiet;                       // vegan | vegetarian | eggetarian | nonveg
  last7DaysRecipeIds: string[];         // from current + history weeks
  reactionFlaggedFoodIds: Set<string>;  // from useFoodTrackerStore reactions
  todayISO: string;                     // 'YYYY-MM-DD'
  dayOfWeek: 0..6;                      // 0 = Sun
  todayPlanned?: PlannedDay;            // if today is already in planner
}
```

**Steps:**
1. **Short-circuit:** if `todayPlanned?.recipeId` is set, return `{ recipeId: todayPlanned.recipeId, reasonOneLine: 'Planned for today.' }`.
2. **Filter** by age band, diet (inclusive hierarchy: vegan ⊂ vegetarian ⊂ eggetarian ⊂ nonveg).
3. **Exclude** recipes in `last7DaysRecipeIds`.
4. **Score remaining candidates:**
   - `+10` if recipe.cuisine hasn't appeared in last 7 days (cuisine rotation).
   - `+5` if dayOfWeek is weekday (Mon–Fri) and recipe.tags includes `'quick'` (≤20 min).
   - `+5` if dayOfWeek is weekend (Sat–Sun) and recipe.tags includes `'festive'` or `'one-pot'`.
   - `+3` if recipe.tags includes `'tiffin'` and dayOfWeek is weekday.
   - `-5` if recipe.containsFoodIds intersects `reactionFlaggedFoodIds` (soft penalty — still pickable, just lower-ranked).
5. **Deterministic tiebreak:** sort by score desc, then by `hash(recipeId + todayISO)` for stability across re-opens of the same day.
6. **Reason one-liner template:**
   - Always: `"Quick {timeMinutes} min · {reasonClause}"`
   - Reason clause picks the highest-scoring rule that fired, e.g. `"You haven't done {cuisine} in {N} days"` or `"Light weekday breakfast"` or `"Weekend special"`.

**Fallback** (empty candidate set after filters — diet too restrictive, age band has no recipes): return `{ recipeId: null, reasonOneLine: 'No recipes match today's filters. Try browsing.' }`. UI renders an empty state with a "Browse all" CTA.

## 8. Allergy integration

For every rendered `RecipeCard` (Today's pick, planner cells, Browse rows, detail sheet):

```ts
const reactionFoodIds = Object.entries(kidFoodEntries)
  .filter(([id, e]) => (e.reaction === 'rash' || e.reaction === 'vomit') && !e.cleared)
  .map(([id]) => id);

const flagged = recipe.containsFoodIds.filter(id => reactionFoodIds.includes(id));
```

If `flagged.length > 0`:
- **On card:** yellow chip `"⚠ {N} watch ingredient{s}"`.
- **In detail sheet:** banner `"⚠ Contains {ingredientNames}. {Kid} reacted on {date}. Tap to review in the tracker."` Tap routes to the existing 6–12 mo `FoodDetailSheet` for that food.

Cleared foods (3-day rule completed, no recent reaction) are not flagged — `entry.cleared` suppresses the chip.

## 9. Edge cases & error handling

| Case | Behavior |
|---|---|
| No active kid | Existing empty card (unchanged). |
| Expecting | Existing "solids start later" card (unchanged). |
| Age < 6 mo | Existing wait card (unchanged). |
| Age 6–12 mo | Existing 3-day-rule tracker (unchanged). |
| Age 12–24 mo | Tiffin screen, Browse defaults to Toddler band. |
| No planner data yet | WeekStrip renders 7 empty "+ Plan" cells. Today's pick comes from rules alone. |
| Network down | Recipes are local; daily pick + browse work fully. Planner writes persist to AsyncStorage; Firestore sync retries silently on next change. |
| Diet changed mid-week | Planned days whose recipe no longer matches the new diet render with a "Diet changed — pick again" pill. No silent deletion. |
| Recipe removed from registry | `RECIPE_BY_ID[id] ?? null` — planner falls back to `freeText: lastKnownName` on next render. Never crashes. |
| Reaction-filter false positive | Allergy chip only fires when `entry.cleared !== true`. |
| Empty candidate set after filters | Today's pick shows empty state with "Browse all" CTA. Browse still works. |
| User-facing errors | Per `CLAUDE.md` rule #4: never surface raw error codes. Sync failures are `console.warn` only; UI never blocks on Firestore. |

## 10. Testing

### 10.1 Unit
- `lib/dailyPick.ts` — table-driven tests:
  - Each `(ageBand, diet)` combo returns a non-null recipe (sanity).
  - `last7DaysRecipeIds` excludes correctly.
  - `todayPlanned.recipeId` short-circuits.
  - Reaction food ID lowers rank, doesn't hard-filter.
  - Same input → same output (determinism check across 100 runs).
  - Empty candidate set → null + empty-state reason.
- `lib/weekKeys.ts`:
  - `getMondayOf` correct across DST boundary (March + November).
  - Month-end and year-end rollover.

### 10.2 Component (snapshot)
- `TiffinScreen` at each age band (toddler, preschool, school-jr, school-sr).
- `RecipeCard` with and without allergy chip.
- `WeekStrip` empty, partially filled, fully filled.

### 10.3 Integration (jest + RNTL)
- Plan a day → assert `TodaysPickCard` swaps + `WeekStrip` updates + `syncMealPlanner` mock called.
- Toggle parent diet → assert Browse list refilters + flagged planner days surface the pill.

### 10.4 Manual QA path
Documented in spec for the implementer:
1. Phone-login as `+91 9999999999` (OTP `123456`).
2. Switch to a kid >12 mo (use test account `testuser@maamitra.app` if no toddler kid exists — seed via Family tab).
3. Open Health → Foods. Verify Tiffin screen renders.
4. Tap Today's "Swap" → verify a different recipe appears.
5. Tap a Week cell → plan a recipe → verify Today's card swaps to the planned recipe.
6. Toggle profile diet (vegetarian → eggetarian) → verify Browse list grows and planner pill appears on any cell that no longer matches.
7. Open a recipe with an ingredient flagged in the kid's 6–12 mo tracker → verify yellow chip + banner.

## 11. Content tasks (V1 deliverables)

Claude authors / vets, user reviews during implementation PR:

1. **Toddler (1–2 yr) recipes (~12–15)** — adapted from the existing 10–12 mo Baby's Meal Plan PDF page. Soft khichdi, dal-rice, paneer mash, soft idli, vegetable upma, fruit + curd bowls, etc.
2. **Non-veg tiffin recipes (~15)** — drawn from well-known Indian school-tiffin staples (egg paratha, chicken keema sandwich, fish cutlet, prawn pulao, mutton kheema toast, etc.). One per cuisine where reasonable.
3. **Eggetarian tiffin recipes (~10)** — egg bhurji paratha, anda curry rice, masala omelette roll, egg-veg fried rice, etc.
4. **Ingredient tagging** — every recipe (including the ~50 from the original PDF) gets `containsFoodIds[]` mapped to existing `babyFoods.ts` IDs. This is what makes allergy warnings work.

User reviews and accepts/edits/rejects each authored recipe during implementation PR review. None ship without explicit user OK.

## 12. Follow-up phases (not this spec)

- **Phase 1.5 — Per-recipe illustrations.** Batch via Codex. Brand-style spec to be authored separately (dusty lavender + warm cream + blush + sage + ochre, soft Indian motherhood illustration, no text). Wired in via the `recipe.image` field that's already in the data model.
- **Phase 2 — Day-by-day Meal Plans (6–12 mo).** Layers on top of the existing 3-day-rule tracker. Uses the four 28-day plans from `Baby_Meal_Plan.pdf`. Separate spec.
- **Phase 3 — Shopping list.** Aggregates ingredients from the planner week. Units normalization, sharable as text. Separate spec.
- **Phase 4 — LLM ranking layer.** Rules pick a shortlist of 3; LLM ranks + writes a richer reason. Drop-in replacement for the rules-only reason line.

## 13. Open questions resolved during brainstorm

| Decision | Choice |
|---|---|
| Phase split | Tiffin first (this spec), Meal Plans next. |
| IA | Single Foods tab, age-adaptive content. |
| Layout | Stacked sections: Today → Week → Browse. |
| Daily pick | Rules-based, deterministic, local. |
| Diet coverage | Extend to non-veg + eggetarian before V1 ships. |
| Age bands | Toddler / Pre-school / School-jr / School-sr. |
| Planner depth | Lightweight Mon–Sun grid, Firestore-synced, no shopping list. |
| Allergy handling | Soft warning, never hide. |
| Imagery | Icon cards in V1, illustrations as Phase 1.5. |
| Content authorship | Claude drafts, user vets during implementation review. |
