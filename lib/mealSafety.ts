// Meal safety checks shared by Tiffin, the weekly meal planner and Travel
// Meals:
//   1. Allergy check — the child's allergy list (Kid.allergies) against a
//      meal's ingredients and its declared allergens.
//   2. 3-day-rule check — which of the meal's ingredients have NOT yet been
//      cleared in Health → Foods (the 3-day tracker), plus any that caused a
//      reaction. Only meaningful for young kids; callers decide when to show.
//
// Pure functions — no React, no stores — so they're easy to test.

import { BABY_FOODS, FOOD_BY_ID, FoodRef } from '../data/babyFoods';
import type { KidFoodMap } from '../store/useFoodTrackerStore';

// ─── Allergens ─────────────────────────────────────────────────────────────

export type AllergenKey =
  | 'milk' | 'egg' | 'peanut' | 'tree_nuts' | 'gluten'
  | 'soy' | 'sesame' | 'fish' | 'shellfish';

export const COMMON_ALLERGENS: { key: AllergenKey; label: string }[] = [
  { key: 'milk', label: 'Milk / dairy' },
  { key: 'egg', label: 'Egg' },
  { key: 'peanut', label: 'Peanut' },
  { key: 'tree_nuts', label: 'Tree nuts' },
  { key: 'gluten', label: 'Wheat / gluten' },
  { key: 'soy', label: 'Soy' },
  { key: 'sesame', label: 'Sesame' },
  { key: 'fish', label: 'Fish' },
  { key: 'shellfish', label: 'Shellfish' },
];

const ALLERGEN_LABEL: Record<AllergenKey, string> = Object.fromEntries(
  COMMON_ALLERGENS.map((a) => [a.key, a.label]),
) as Record<AllergenKey, string>;

/** Ingredient words that mean the meal contains this allergen. */
const ALLERGEN_WORDS: Record<AllergenKey, string[]> = {
  milk: ['milk', 'curd', 'dahi', 'yogurt', 'yoghurt', 'paneer', 'cheese', 'butter', 'cream',
    'khoya', 'mawa', 'buttermilk', 'chaas', 'lassi', 'custard', 'kheer', 'malai', 'raita'],
  egg: ['egg', 'eggs', 'anda', 'omelette', 'omelet', 'mayonnaise', 'mayo'],
  peanut: ['peanut', 'peanuts', 'groundnut', 'groundnuts', 'moongphali', 'mungfali'],
  tree_nuts: ['almond', 'almonds', 'badam', 'cashew', 'cashews', 'kaju', 'walnut', 'walnuts',
    'akhrot', 'pistachio', 'pistachios', 'pista', 'dry fruit', 'dry fruits', 'hazelnut'],
  gluten: ['wheat', 'atta', 'maida', 'semolina', 'suji', 'sooji', 'rava', 'bread', 'pasta',
    'penne', 'fusilli', 'noodles', 'vermicelli', 'semiya', 'seviyan', 'dalia', 'barley', 'jau',
    'oats', 'roti', 'chapati', 'paratha', 'tortilla', 'biscuit', 'biscuits', 'cookies', 'rusk'],
  soy: ['soy', 'soya', 'tofu', 'soy sauce'],
  sesame: ['sesame', 'til', 'tahini', 'gingelly'],
  fish: ['fish', 'tuna', 'salmon', 'rohu', 'pomfret', 'sardine', 'mackerel', 'bangda', 'hilsa',
    'catla', 'tilapia', 'cod', 'surmai', 'machh', 'macher'],
  shellfish: ['prawn', 'prawns', 'shrimp', 'shrimps', 'crab', 'lobster', 'jhinga'],
};

/** Plant "milks" / nut "butters" — not dairy. */
const NOT_DAIRY = ['peanut butter', 'almond butter', 'nut butter', 'cocoa butter', 'coconut milk',
  'almond milk', 'soy milk', 'soya milk', 'oat milk', 'rice milk', 'coconut cream'];

/** Map the legacy family-level chat allergy labels to allergen keys. */
const LEGACY_LABELS: Record<string, AllergenKey> = {
  peanuts: 'peanut', 'tree nuts': 'tree_nuts', milk: 'milk', eggs: 'egg',
  'wheat/gluten': 'gluten', soy: 'soy', fish: 'fish', shellfish: 'shellfish', sesame: 'sesame',
};

export function isAllergenKey(v: string): v is AllergenKey {
  return v in ALLERGEN_WORDS;
}

/** Display label for a stored allergy value (key or free text). */
export function allergyLabel(v: string): string {
  return isAllergenKey(v) ? ALLERGEN_LABEL[v] : v;
}

/**
 * The allergy list to check against: the child's own list when the parent
 * has set one, otherwise the older family-level list from the chat picker.
 */
export function effectiveAllergies(
  kidAllergies: string[] | undefined,
  legacyFamilyAllergies: string[] | null | undefined,
): string[] {
  if (kidAllergies) return kidAllergies;
  return (legacyFamilyAllergies ?? [])
    .map((l) => LEGACY_LABELS[l.toLowerCase()])
    .filter((k): k is AllergenKey => !!k);
}

function hasWord(text: string, word: string): boolean {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Whole word, allowing a plural ("potato" matches "potatoes").
  return new RegExp(`(^|[^a-z])${esc}(s|es)?([^a-z]|$)`, 'i').test(text);
}

export interface MealLike {
  name: string;
  /** Ingredient lines (free text). */
  ingredients: string[];
  /** Allergens the recipe data already declares (e.g. travel recipes). */
  declaredAllergens?: string[];
  /** babyFoods ids the recipe declares (tiffin recipes). */
  foodIds?: string[];
}

const FOOD_CATEGORY_ALLERGEN: Partial<Record<string, AllergenKey>> = {
  dairy: 'milk',
  fishSeafood: 'fish',
};
const FOOD_ID_ALLERGEN: Record<string, AllergenKey> = {
  'nutsSeeds.peanut': 'peanut',
  'nutsSeeds.almond-badam': 'tree_nuts',
  'nutsSeeds.cashew-kaju': 'tree_nuts',
  'nutsSeeds.walnut-akhrot': 'tree_nuts',
  'nutsSeeds.pistachio': 'tree_nuts',
  'nutsSeeds.sesame-seeds-til': 'sesame',
  'others.tofu': 'soy',
  'others.soya-chunks': 'soy',
};

/** Travel-recipe allergen names → our keys. */
const DECLARED_MAP: Record<string, AllergenKey> = {
  milk: 'milk', egg: 'egg', peanut: 'peanut', tree_nuts: 'tree_nuts',
  gluten: 'gluten', soy: 'soy', sesame: 'sesame', fish: 'fish', shellfish: 'shellfish',
};

/**
 * Which of the child's allergies this meal hits. Returns display labels,
 * de-duplicated. Empty = no known conflict.
 */
export function allergyConflicts(meal: MealLike, allergies: string[]): string[] {
  if (allergies.length === 0) return [];
  const text = [meal.name, ...meal.ingredients].join(' \n ');
  const present = new Set<AllergenKey>();
  for (const a of meal.declaredAllergens ?? []) {
    const k = DECLARED_MAP[a];
    if (k) present.add(k);
  }
  for (const id of meal.foodIds ?? []) {
    const k = FOOD_ID_ALLERGEN[id] ?? (id.startsWith('eggsPoultry.') && id.split('.')[1].includes('egg') ? 'egg' : undefined)
      ?? FOOD_CATEGORY_ALLERGEN[FOOD_BY_ID[id]?.category ?? ''];
    if (k) present.add(k);
  }
  const hits: string[] = [];
  for (const a of allergies) {
    if (isAllergenKey(a)) {
      const t = a === 'milk' ? NOT_DAIRY.reduce((acc, p) => acc.replace(new RegExp(p, 'gi'), ' '), text) : text;
      if (present.has(a) || ALLERGEN_WORDS[a].some((w) => hasWord(t, w))) hits.push(ALLERGEN_LABEL[a]);
    } else if (a.trim() && hasWord(text, a.trim().toLowerCase())) {
      hits.push(a.trim());
    }
  }
  return Array.from(new Set(hits));
}

// ─── 3-day rule ────────────────────────────────────────────────────────────

// Tracker items that aren't single ingredients (dishes) or are too minor
// to gate a meal on (herbs, spices, oils, sweeteners).
const SKIP_CATEGORIES = new Set(['spices', 'oilsFats', 'sweeteners']);
const SKIP_IDS = new Set([
  'grains.idli', 'grains.dosa', 'grains.upma', 'grains.khichdi', 'grains.paratha',
  'grains.sathumaavu', 'grains.wheat-porridge', 'grains.multigrain-atta', 'lentils.mixed-dal',
  'vegetables.coriander-leaves', 'vegetables.mint-leaves', 'vegetables.curry-leaves',
  'dairy.ghee', 'dairy.butter', 'eggsPoultry.egg-yolk', 'eggsPoultry.scrambled-egg',
  'eggsPoultry.boiled-egg', 'eggsPoultry.egg-omelette', 'eggsPoultry.chicken-minced',
  'eggsPoultry.chicken-soup', 'fishSeafood.fish-soup', 'meat.mutton-soup',
]);
/** Extra words that point at a tracker food. */
const EXTRA_ALIASES: Record<string, string[]> = {
  'eggsPoultry.whole-egg': ['egg', 'eggs', 'anda', 'omelette'],
  'dairy.curd-yogurt': ['curd', 'dahi', 'yogurt', 'yoghurt'],
  'dairy.milk-after-1-year': ['milk'],
  'grains.roti-chapati': ['wheat flour', 'atta', 'roti', 'chapati', 'wheat'],
  'grains.suji-semolina': ['semolina', 'suji', 'sooji', 'rava'],
  'others.besan-gram-flour': ['besan', 'gram flour'],
  'eggsPoultry.chicken-boiled': ['chicken'],
  'meat.mutton-minced': ['mutton'],
  'grains.puffed-rice-murmura': ['puffed rice', 'murmura'],
  'grains.poha': ['poha', 'flattened rice', 'chura'],
  'lentils.toor-dal-arhar': ['toor dal', 'arhar dal', 'tuvar dal'],
  'lentils.rajma-kidney-beans': ['rajma', 'kidney beans'],
  'vegetables.pumpkin-kaddu': ['pumpkin', 'kaddu'],
  'vegetables.bottle-gourd-lauki': ['bottle gourd', 'lauki', 'dudhi'],
  'vegetables.spinach-palak': ['spinach', 'palak'],
};

interface FoodMatcher { food: FoodRef; words: string[] }

const MATCHERS: FoodMatcher[] = BABY_FOODS
  .filter((f) => !SKIP_CATEGORIES.has(f.category) && !SKIP_IDS.has(f.id))
  .map((food) => {
    const base = food.name.toLowerCase();
    const words = new Set<string>();
    const outside = base.replace(/\(.*?\)/g, '').trim();
    outside.split('/').map((s) => s.trim()).filter(Boolean).forEach((w) => words.add(w));
    for (const m of base.matchAll(/\(([^)]+)\)/g)) {
      const inner = m[1].trim();
      // Skip descriptors ("Boiled", "Minced", "after 1 year") and cross-refs
      // ("Liver (Chicken/Mutton)") — only real alternative names count.
      if (!/after|mashed|boiled|minced|chicken|mutton/.test(inner)) inner.split('/').forEach((w) => words.add(w.trim()));
    }
    (EXTRA_ALIASES[food.id] ?? []).forEach((w) => words.add(w));
    return { food, words: Array.from(words).filter((w) => w.length >= 3) };
  })
  // Longer names first so "sweet potato" claims its text before "potato".
  .sort((a, b) => Math.max(...b.words.map((w) => w.length)) - Math.max(...a.words.map((w) => w.length)));

/** Tracker foods found in a meal's ingredients / declared food ids. */
export function trackerFoodsInMeal(meal: MealLike): FoodRef[] {
  let text = ` ${[meal.name, ...meal.ingredients].join(' | ').toLowerCase()} `;
  const found = new Map<string, FoodRef>();
  for (const id of meal.foodIds ?? []) {
    const f = FOOD_BY_ID[id];
    if (f && !SKIP_CATEGORIES.has(f.category) && !SKIP_IDS.has(f.id)) found.set(f.id, f);
  }
  for (const { food, words } of MATCHERS) {
    for (const w of words) {
      if (hasWord(text, w)) {
        found.set(food.id, food);
        // Blank the match so a shorter name can't re-claim it.
        text = text.replace(new RegExp(`${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(s|es)?`, 'gi'), ' ');
      }
    }
  }
  return Array.from(found.values());
}

export interface ThreeDayStatus {
  /** Ingredients not yet cleared in the 3-day tracker. */
  untested: FoodRef[];
  /** Ingredients that caused a rash / vomiting / upset tummy. */
  reacted: FoodRef[];
  /** Every tracked ingredient cleared and none reacted. */
  allCleared: boolean;
}

export function threeDayStatus(meal: MealLike, kidFoods: KidFoodMap): ThreeDayStatus {
  const foods = trackerFoodsInMeal(meal);
  const reacted = foods.filter((f) => {
    const r = kidFoods[f.id]?.reaction;
    return r === 'rash' || r === 'vomit' || r === 'upset';
  });
  const untested = foods.filter((f) => !kidFoods[f.id]?.cleared && !reacted.includes(f));
  return { untested, reacted, allCleared: foods.length > 0 && untested.length === 0 && reacted.length === 0 };
}

/** 3-day-rule reminders are shown for kids under 2 (and when age is unknown). */
export const THREE_DAY_RULE_MAX_MONTHS = 24;
export function showsThreeDayCheck(ageMonths: number | null | undefined): boolean {
  return ageMonths == null || ageMonths < THREE_DAY_RULE_MAX_MONTHS;
}

/** Short display name for a tracker food ("Chikoo (Sapota)" → "Chikoo"). */
export function shortFoodName(f: FoodRef): string {
  return f.name.replace(/\s*\(.*?\)\s*/g, '').split('/')[0].trim();
}
