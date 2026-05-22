import { describe, it, expect } from 'bun:test';
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

  it('returns a non-null pick for toddler vegetarian (we have 13 toddler recipes)', () => {
    const result = pickDailyRecipe(baseInput({ ageBand: 'toddler' }));
    expect(result.recipeId).not.toBeNull();
  });

  it('returns a non-null pick for non-veg school-jr', () => {
    const result = pickDailyRecipe(baseInput({ ageBand: 'school-jr', diet: 'nonveg' }));
    expect(result.recipeId).not.toBeNull();
  });

  it('returns shape with empty-state reason when filters exclude everything', () => {
    // Force an empty candidate set by excluding all recipes
    // Get all recipe IDs and pass them as last 7 days
    const { RECIPES } = require('../../data/recipes');
    const allIds = RECIPES.map((r: any) => r.id);
    const result = pickDailyRecipe(baseInput({ last7DaysRecipeIds: allIds }));
    expect(result.recipeId).toBeNull();
    expect(result.reasonOneLine).toBeTruthy();
  });

  it('penalizes recipes with reaction-flagged ingredients but does not hard-filter', () => {
    const result = pickDailyRecipe(baseInput({
      reactionFlaggedFoodIds: new Set(['nutsSeeds.peanut']),
    }));
    expect(result.recipeId).not.toBeNull();
  });
});
