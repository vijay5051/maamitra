import { describe, expect, test } from 'bun:test';
import {
  allergyAlertSentences,
  allergyAlertTitle,
  customEntry,
  foodEntry,
  FoodAllergyEntry,
  groupEntry,
  matchAllergies,
  matchAllergiesInText,
  readKidAllergies,
  summarizeAllergies,
} from '../lib/foodAllergies';
import { FOOD_BY_ID } from '../data/babyFoods';
import { RECIPES } from '../data/recipes';
import { TRAVEL_RECIPES } from '../data/travelRecipes';
import { pickDailyRecipe } from '../lib/dailyPick';
import { tiffinMeal, travelMeal } from '../hooks/useKidAllergies';

const milk = groupEntry('milk');
const paneerParatha = { name: 'Paneer Paratha', ingredients: ['1 cup wheat flour', '100 g paneer (grated)', 'Ghee'] };

describe('matching — families and aliases', () => {
  test('milk family catches paneer / curd / cheese', () => {
    const m = matchAllergies(paneerParatha, [milk]);
    expect(m.length).toBe(1);
    expect(m[0].ingredient).toBe('paneer');
    expect(m[0].family).toBe('milk');
    expect(matchAllergies({ name: 'Curd rice', ingredients: ['rice', 'dahi'] }, [milk]).length).toBe(1);
    expect(matchAllergies({ name: 'Toast', ingredients: ['bread', 'cheese slices'] }, [milk])[0].ingredient).toBe('cheese');
  });
  test('wheat family catches atta / maida / suji', () => {
    const wheat = groupEntry('gluten');
    for (const ing of ['2 cups atta', 'maida', '1/2 cup suji', 'semolina']) {
      expect(matchAllergies({ name: 'x', ingredients: [ing] }, [wheat]).length).toBe(1);
    }
  });
  test('peanut family catches groundnut', () => {
    expect(matchAllergies({ name: 'Chutney', ingredients: ['roasted groundnuts'] }, [groupEntry('peanut')])[0].ingredient)
      .toBe('groundnut');
  });
  test('recording catalogue "Milk" or "Whole Egg" covers the whole family', () => {
    const milkFood = foodEntry(FOOD_BY_ID['dairy.milk-after-1-year']);
    expect(matchAllergies(paneerParatha, [milkFood])[0].family).toBe('milk');
    const egg = foodEntry(FOOD_BY_ID['eggsPoultry.whole-egg']);
    expect(matchAllergies({ name: 'Roll', ingredients: ['2 eggs', 'mayonnaise'] }, [egg]).length).toBe(1);
  });
  test('a single catalogue food matches only itself', () => {
    const paneer = foodEntry(FOOD_BY_ID['dairy.paneer']);
    expect(matchAllergies(paneerParatha, [paneer]).length).toBe(1);
    expect(matchAllergies({ name: 'Curd rice', ingredients: ['curd'] }, [paneer]).length).toBe(0);
  });
  test('recipe metadata is used when the text is silent', () => {
    expect(matchAllergies({ name: 'Mix', ingredients: ['health mix'], declaredAllergens: ['tree_nuts'] }, [groupEntry('tree_nuts')])[0].ingredient)
      .toBeNull();
    expect(matchAllergies({ name: 'Bowl', ingredients: [], foodIds: ['fruits.banana'] }, [foodEntry(FOOD_BY_ID['fruits.banana'])]).length)
      .toBe(1);
  });
});

describe('matching — no false positives', () => {
  test('no naive substrings', () => {
    expect(matchAllergies({ name: 'Chickpea salad', ingredients: ['chickpeas'] }, [customEntry('pea')!]).length).toBe(0);
    expect(matchAllergies({ name: 'Cook until soft', ingredients: ['until golden'] }, [groupEntry('sesame')]).length).toBe(0);
    expect(matchAllergies({ name: 'Eggplant fry', ingredients: ['eggplant'] }, [groupEntry('egg')]).length).toBe(0);
  });
  test('peanut butter / coconut milk are not dairy; chicken is not egg', () => {
    expect(matchAllergies({ name: 'PB toast', ingredients: ['peanut butter', 'coconut milk'] }, [milk]).length).toBe(0);
    expect(matchAllergies({ name: 'Roll', ingredients: ['chicken'], foodIds: ['eggsPoultry.chicken-boiled'] }, [groupEntry('egg')]).length).toBe(0);
  });
  test('custard apple is a fruit; makki / bajra roti are not wheat', () => {
    expect(matchAllergies({ name: 'Custard Apple', ingredients: ['1 ripe custard apple'] }, [milk]).length).toBe(0);
    const wheat = groupEntry('gluten');
    expect(matchAllergies({ name: 'Makki di Roti with Saag', ingredients: ['2 cups makki atta', 'saag'] }, [wheat]).length).toBe(0);
    expect(matchAllergies({ name: 'Korma with Bajra Roti', ingredients: ['bajra rotis', '1 tbsp wheat flour'] }, [wheat])[0].ingredient).toBe('wheat');
  });
  test('unrelated recipes produce nothing', () => {
    expect(matchAllergies({ name: 'Lemon rice', ingredients: ['rice', 'lemon', 'mustard seeds'] }, [milk, groupEntry('peanut')]).length).toBe(0);
    expect(matchAllergies(paneerParatha, []).length).toBe(0);
  });
  test('custom foods: normalized whole words or phrases, plural-aware', () => {
    const kiwi = customEntry('  Kiwi ')!;
    expect(kiwi.key).toBe('custom:kiwi');
    expect(matchAllergies({ name: 'Fruit bowl', ingredients: ['2 kiwis, sliced'] }, [kiwi]).length).toBe(1);
    const sp = customEntry('Sweet Corn')!;
    expect(matchAllergies({ name: 'Soup', ingredients: ['1 cup sweet corn'] }, [sp]).length).toBe(1);
    expect(matchAllergies({ name: 'Soup', ingredients: ['cornflour'] }, [sp]).length).toBe(0);
    expect(customEntry('   ')).toBeNull();
  });
});

describe('child isolation', () => {
  const navi = { id: 'k1', foodAllergies: { entries: [milk] } };
  const dhairyaa = { id: 'k2', foodAllergies: { entries: [{ ...groupEntry('peanut'), status: 'suspected' as const }] } };
  const newborn: { id: string; allergies?: string[] } = { id: 'k3' };
  test('each child is checked only against their own list', () => {
    expect(matchAllergies(paneerParatha, readKidAllergies(navi).entries).length).toBe(1);
    expect(matchAllergies(paneerParatha, readKidAllergies(dhairyaa).entries).length).toBe(0);
    expect(matchAllergies(paneerParatha, readKidAllergies(newborn).entries).length).toBe(0);
  });
  test('reading one child never mutates or leaks into another', () => {
    const a = readKidAllergies(navi);
    a.entries.push(groupEntry('egg'));
    expect(readKidAllergies(dhairyaa).entries.map((e) => e.key)).toEqual(['group:peanut']);
    expect(readKidAllergies(newborn).entries.length).toBe(0);
  });
});

describe('persistence compatibility', () => {
  test('profiles created before the feature read as an empty list', () => {
    expect(readKidAllergies({}).entries).toEqual([]);
    expect(readKidAllergies(null).entries).toEqual([]);
    expect(readKidAllergies({ foodAllergies: null }).entries).toEqual([]);
  });
  test('v1 `allergies: string[]` migrates to known allergies', () => {
    const a = readKidAllergies({ allergies: ['tree_nuts', 'banana', '', 'tree_nuts'] });
    expect(a.entries.map((e) => [e.key, e.status])).toEqual([
      ['group:tree_nuts', 'known'],
      ['custom:banana', 'known'],
    ]);
  });
  test('the new field wins over v1 and malformed entries are dropped', () => {
    const a = readKidAllergies({
      allergies: ['milk'],
      foodAllergies: {
        entries: [
          { key: 'group:egg', label: 'Egg', status: 'suspected', note: 'rash on cheeks' },
          { key: 'weird', label: 'x', status: 'known' },
          { label: 'no key' },
          null,
          { key: 'custom:kiwi', label: 'Kiwi', status: 'whatever' },
        ] as any,
      },
    });
    expect(a.entries).toEqual([
      { key: 'group:egg', label: 'Egg', status: 'suspected', note: 'rash on cheeks' },
      { key: 'custom:kiwi', label: 'Kiwi', status: 'known' },
    ]);
  });
  test('"Not sure yet" is kept only while the list is empty', () => {
    expect(readKidAllergies({ foodAllergies: { entries: [], notSure: true } }).notSure).toBe(true);
    expect(readKidAllergies({ foodAllergies: { entries: [milk], notSure: true } }).notSure).toBe(false);
    expect(summarizeAllergies({ entries: [], notSure: true })).toBe('Not sure yet');
  });
  test('survives a JSON round-trip (AsyncStorage / Firestore)', () => {
    const stored = { entries: [{ ...milk, note: 'Dr said avoid till 2y' }, { ...groupEntry('egg'), status: 'suspected' as const }] };
    const back = readKidAllergies({ foodAllergies: JSON.parse(JSON.stringify(stored)) });
    expect(back.entries).toEqual(stored.entries);
  });
});

describe('selection warnings', () => {
  const entries: FoodAllergyEntry[] = [milk, { ...foodEntry(FOOD_BY_ID['fruits.banana']), status: 'suspected' }];
  test('popup wording names the child, the food and the list', () => {
    const m = matchAllergies(paneerParatha, entries);
    expect(allergyAlertTitle('Navi', m)).toBe('Allergy alert for Navi');
    expect(allergyAlertSentences('Navi', m)).toEqual([
      "This recipe contains paneer, which is a milk ingredient. Milk is on Navi's allergy list.",
    ]);
  });
  test('suspected reactions are worded as suspected, not as an allergy', () => {
    const m = matchAllergies({ name: 'Banana oats', ingredients: ['1 ripe banana', 'oats'] }, entries);
    expect(allergyAlertTitle('Navi', m)).toBe('Possible reaction alert for Navi');
    expect(allergyAlertSentences('Navi', m)).toEqual([
      "This recipe contains banana. Banana is on Navi's suspected-reaction list.",
    ]);
  });
  test('typed planner notes are checked by word', () => {
    expect(matchAllergiesInText('leftover dal-rice', entries).length).toBe(0);
    expect(matchAllergiesInText('paneer sandwich', entries).length).toBe(1);
  });
  test('real tiffin + travel recipes: flagged ones are exactly those with a match', () => {
    const flagged = RECIPES.filter((r) => matchAllergies(tiffinMeal(r), [groupEntry('egg')]).length > 0).map((r) => r.id);
    expect(flagged).toContain('egg-sandwich');
    expect(flagged).not.toContain('lemon-rice');
    const nutty = TRAVEL_RECIPES.filter((r) => matchAllergies(travelMeal(r), [groupEntry('tree_nuts')]).length > 0);
    expect(nutty.length).toBeGreaterThan(0);
    expect(nutty.every((r) => r.allergenContains.includes('tree_nuts') || /almond|cashew|walnut|dry fruit|pista|badam|kaju/i.test(JSON.stringify(r.ingredients) + r.title))).toBe(true);
  });
  test('automatic daily pick never returns an excluded (matching) recipe', () => {
    const exclude = new Set(RECIPES.filter((r) => matchAllergies(tiffinMeal(r), [milk]).length > 0).map((r) => r.id));
    expect(exclude.size).toBeGreaterThan(0);
    for (let skip = 0; skip < 60; skip++) {
      const pick = pickDailyRecipe({
        ageBand: 'school-jr', diet: 'nonveg', last7DaysRecipeIds: [], reactionFlaggedFoodIds: new Set(),
        todayISO: '2026-10-01', dayOfWeek: 4, excludeRecipeIds: exclude, skip,
      });
      expect(pick.recipeId && exclude.has(pick.recipeId)).toBeFalsy();
    }
  });
  test('a diary "cleared" entry cannot override a recorded allergy', () => {
    // The matcher takes no diary input at all — the allergy list alone decides.
    expect(matchAllergies.length).toBe(2);
    expect(matchAllergies(paneerParatha, [milk]).length).toBe(1);
  });
});
