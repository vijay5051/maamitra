import { describe, expect, test } from 'bun:test';
import {
  allergyConflicts,
  effectiveAllergies,
  shortFoodName,
  threeDayStatus,
  trackerFoodsInMeal,
} from '../lib/mealSafety';

const alooParatha = {
  name: 'Aloo Paratha',
  ingredients: ['2 cups wheat flour', '2 medium potatoes (boiled, mashed)', 'Ghee or butter for cooking'],
};

describe('allergyConflicts', () => {
  test('matches allergen keys by ingredient words', () => {
    expect(allergyConflicts(alooParatha, ['gluten'])).toEqual(['Wheat / gluten']);
    expect(allergyConflicts(alooParatha, ['milk'])).toEqual(['Milk / dairy']);
    expect(allergyConflicts(alooParatha, ['peanut', 'egg'])).toEqual([]);
  });
  test('uses declared allergens (travel recipes)', () => {
    expect(allergyConflicts({ name: 'Mix', ingredients: [], declaredAllergens: ['tree_nuts'] }, ['tree_nuts']))
      .toEqual(['Tree nuts']);
  });
  test('free-text foods match whole words only', () => {
    expect(allergyConflicts(alooParatha, ['potato'])).toEqual(['potato']); // plural matches
    expect(allergyConflicts(alooParatha, ['pota'])).toEqual([]);
    expect(allergyConflicts({ name: 'Chickpea salad', ingredients: [] }, ['pea'])).toEqual([]);
  });
  test('peanut butter / coconut milk are not dairy', () => {
    expect(allergyConflicts({ name: 'PB sandwich', ingredients: ['2 tbsp peanut butter', 'coconut milk'] }, ['milk']))
      .toEqual([]);
  });
  test('chicken food ids are not treated as egg', () => {
    expect(allergyConflicts({ name: 'Roll', ingredients: [], foodIds: ['eggsPoultry.chicken-boiled'] }, ['egg']))
      .toEqual([]);
  });
});

describe('effectiveAllergies', () => {
  test('kid list wins, else legacy family labels are mapped', () => {
    expect(effectiveAllergies(['egg'], ['Peanuts'])).toEqual(['egg']);
    expect(effectiveAllergies([], ['Peanuts'])).toEqual([]);
    expect(effectiveAllergies(undefined, ['Peanuts', 'None', 'Wheat/Gluten'])).toEqual(['peanut', 'gluten']);
  });
});

describe('3-day rule', () => {
  test('finds tracker foods without descriptor false-positives', () => {
    const names = trackerFoodsInMeal(alooParatha).map(shortFoodName);
    expect(names).toContain('Potato');
    expect(names).not.toContain('Chicken');
  });
  test('sweet potato is not also counted as potato', () => {
    const names = trackerFoodsInMeal({ name: 'Mash', ingredients: ['1 sweet potato'] }).map(shortFoodName);
    expect(names).toEqual(['Sweet Potato']);
  });
  test('untested vs cleared vs reacted', () => {
    const meal = { name: 'Curd rice', ingredients: ['1 cup rice', '1/2 cup curd'] };
    const s1 = threeDayStatus(meal, {});
    expect(s1.untested.length).toBe(2);
    expect(s1.allCleared).toBe(false);
    const s2 = threeDayStatus(meal, {
      'grains.rice': { cleared: true } as any,
      'dairy.curd-yogurt': { cleared: false, reaction: 'rash' } as any,
    });
    expect(s2.untested.length).toBe(0);
    expect(s2.reacted.map(shortFoodName)).toEqual(['Curd']);
    const s3 = threeDayStatus(meal, {
      'grains.rice': { cleared: true } as any,
      'dairy.curd-yogurt': { cleared: true } as any,
    });
    expect(s3.allCleared).toBe(true);
  });
});
