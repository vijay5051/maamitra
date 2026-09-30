import { useCallback, useMemo } from 'react';
import { useActiveKid } from './useActiveKid';
import { useChatStore } from '../store/useChatStore';
import { useFoodTrackerStore } from '../store/useFoodTrackerStore';
import { calculateAgeInMonths, isPlausibleDob } from '../lib/dob';
import {
  allergyConflicts,
  effectiveAllergies,
  MealLike,
  showsThreeDayCheck,
  threeDayStatus,
  ThreeDayStatus,
} from '../lib/mealSafety';

export interface MealSafety {
  /** Child's allergy labels this meal contains. */
  allergyHits: string[];
  /** 3-day-rule status, or null when the child is too old for it. */
  threeDay: ThreeDayStatus | null;
}

/**
 * Active kid's allergy list + 3-day tracker, and a `check(meal)` that
 * returns what to warn about. Used by Tiffin, the planner and Travel Meals.
 */
export function useMealSafety() {
  const { activeKid } = useActiveKid();
  const legacy = useChatStore((s) => s.allergies);
  const foodsByKid = useFoodTrackerStore((s) => s.byKid);

  const ageMonths =
    activeKid && !activeKid.isExpecting && activeKid.dob && isPlausibleDob(activeKid.dob)
      ? calculateAgeInMonths(activeKid.dob)
      : null;
  const allergies = useMemo(
    () => effectiveAllergies(activeKid?.allergies, legacy),
    [activeKid?.allergies, legacy],
  );
  const kidFoods = activeKid ? foodsByKid[activeKid.id] ?? {} : {};
  const withThreeDay = showsThreeDayCheck(ageMonths);

  const check = useCallback(
    (meal: MealLike): MealSafety => ({
      allergyHits: allergyConflicts(meal, allergies),
      threeDay: withThreeDay ? threeDayStatus(meal, kidFoods) : null,
    }),
    [allergies, kidFoods, withThreeDay],
  );

  return { activeKid, ageMonths, allergies, check, withThreeDay };
}

// ─── Adapters ──────────────────────────────────────────────────────────────

export function tiffinMeal(r: { name: string; ingredients: string[]; containsFoodIds: string[] }): MealLike {
  return { name: r.name, ingredients: r.ingredients, foodIds: r.containsFoodIds };
}

export function travelMeal(r: {
  title: string;
  ingredients: { name: string; notes?: string }[];
  allergenContains: string[];
}): MealLike {
  return {
    name: r.title,
    ingredients: r.ingredients.map((i) => i.name),
    declaredAllergens: r.allergenContains,
  };
}
