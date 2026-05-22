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
  image?: string | null;
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

// Suppress "declared but never used" — r() is consumed by Tasks 4–7 entries below.
void r;

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
