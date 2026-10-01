import { useCallback, useMemo } from 'react';
import { useActiveKid } from './useActiveKid';
import {
  AllergyMatch,
  KidFoodAllergies,
  matchAllergies,
  MealLike,
  readKidAllergies,
} from '../lib/foodAllergies';

/**
 * The ACTIVE child's allergy list and a `match(meal)` checker. Only the
 * selected child's list is used — never a sibling's or the parent's — and
 * switching child re-renders every consumer.
 */
export function useKidAllergies() {
  const { activeKid } = useActiveKid();
  const allergies: KidFoodAllergies = useMemo(
    () => readKidAllergies(activeKid),
    [activeKid?.foodAllergies, activeKid?.allergies, activeKid?.id], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const kidName = activeKid?.name || 'your child';

  const match = useCallback(
    (meal: MealLike): AllergyMatch[] => matchAllergies(meal, allergies.entries),
    [allergies],
  );

  return { activeKid, kidName, allergies, match };
}

// ─── Recipe → MealLike adapters ────────────────────────────────────────────

export function tiffinMeal(r: { name: string; ingredients: string[]; containsFoodIds: string[] }): MealLike {
  return { name: r.name, ingredients: r.ingredients, foodIds: r.containsFoodIds };
}

export function travelMeal(r: {
  title: string;
  ingredients: { name: string }[];
  allergenContains: string[];
}): MealLike {
  return {
    name: r.title,
    ingredients: r.ingredients.map((i) => i.name),
    declaredAllergens: r.allergenContains,
  };
}
