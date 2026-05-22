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
    return { recipeId: null, reasonOneLine: "No recipes match today's filters. Try browsing." };
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
