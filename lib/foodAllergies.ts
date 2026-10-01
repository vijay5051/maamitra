// Child-specific food allergies & suspected reactions.
//
// One list per child (Kid.foodAllergies), kept separate from the food
// introduction diary (useFoodTrackerStore): an untested food is never a
// warning, and a diary entry marked "cleared" never overrides an entry here.
//
// Pure functions — no React, no stores — so matching is easy to test.

import { BABY_FOODS, FOOD_BY_ID, FoodRef } from '../data/babyFoods';

// ─── Model ─────────────────────────────────────────────────────────────────

/** 'known' = diagnosed / confirmed allergy. 'suspected' = parent noticed a reaction. */
export type AllergyStatus = 'known' | 'suspected';

export interface FoodAllergyEntry {
  /**
   * `group:<AllergenKey>`  — an ingredient family (milk, wheat, …)
   * `food:<babyFoods id>`  — one food from the catalogue
   * `custom:<text>`        — anything else the parent typed
   */
  key: string;
  label: string;
  status: AllergyStatus;
  /** Reaction details or the doctor's advice. */
  note?: string;
}

export interface KidFoodAllergies {
  entries: FoodAllergyEntry[];
  /** Parent chose "Not sure yet" — nothing recorded, nothing implied. */
  notSure?: boolean;
}

export const EMPTY_ALLERGIES: KidFoodAllergies = Object.freeze({ entries: [] }) as KidFoodAllergies;

export type AllergenKey =
  | 'milk' | 'egg' | 'peanut' | 'tree_nuts' | 'gluten'
  | 'soy' | 'sesame' | 'fish' | 'shellfish';

interface GroupInfo {
  key: AllergenKey;
  /** Chip / list label. */
  label: string;
  /** Used in sentences: "…which is a <noun> ingredient." */
  noun: string;
  /** Ingredient words that belong to this family. First word is the family's own name. */
  words: string[];
}

export const ALLERGEN_GROUPS: GroupInfo[] = [
  { key: 'milk', label: 'Milk & dairy', noun: 'milk', words: ['milk', 'curd', 'dahi', 'yogurt', 'yoghurt', 'paneer', 'cheese', 'butter', 'cream', 'khoya', 'mawa', 'buttermilk', 'chaas', 'lassi', 'custard', 'kheer', 'malai', 'raita', 'milk powder'] },
  { key: 'egg', label: 'Egg', noun: 'egg', words: ['egg', 'anda', 'omelette', 'omelet', 'mayonnaise', 'mayo'] },
  { key: 'peanut', label: 'Peanut', noun: 'peanut', words: ['peanut', 'groundnut', 'moongphali', 'mungfali'] },
  { key: 'tree_nuts', label: 'Tree nuts', noun: 'tree nut', words: ['tree nut', 'almond', 'badam', 'cashew', 'kaju', 'walnut', 'akhrot', 'pistachio', 'pista', 'hazelnut', 'dry fruit'] },
  { key: 'gluten', label: 'Wheat / gluten', noun: 'wheat/gluten', words: ['wheat', 'atta', 'maida', 'semolina', 'suji', 'sooji', 'rava', 'bread', 'pasta', 'penne', 'fusilli', 'noodle', 'vermicelli', 'semiya', 'seviyan', 'dalia', 'barley', 'jau', 'oats', 'roti', 'chapati', 'paratha', 'tortilla', 'biscuit', 'cookie', 'rusk'] },
  { key: 'soy', label: 'Soy', noun: 'soy', words: ['soy', 'soya', 'tofu', 'soy sauce'] },
  { key: 'sesame', label: 'Sesame', noun: 'sesame', words: ['sesame', 'til', 'tahini', 'gingelly'] },
  { key: 'fish', label: 'Fish', noun: 'fish', words: ['fish', 'tuna', 'salmon', 'rohu', 'pomfret', 'sardine', 'mackerel', 'bangda', 'hilsa', 'catla', 'tilapia', 'cod', 'surmai', 'machh', 'macher'] },
  { key: 'shellfish', label: 'Shellfish', noun: 'shellfish', words: ['shellfish', 'prawn', 'shrimp', 'crab', 'lobster', 'jhinga'] },
];

const GROUP_BY_KEY = Object.fromEntries(ALLERGEN_GROUPS.map((g) => [g.key, g])) as Record<AllergenKey, GroupInfo>;

/** Plant "milks" / nut "butters" — not dairy. Removed before the milk check. */
const NOT_DAIRY = ['peanut butter', 'almond butter', 'nut butter', 'cocoa butter', 'coconut milk',
  'almond milk', 'soy milk', 'soya milk', 'oat milk', 'rice milk', 'coconut cream', 'custard apple',
  'butter fruit', 'butter beans'];

/** Millet / corn / rice breads and flours — not wheat. Removed before the wheat check. */
const NOT_WHEAT = ['makki di roti', 'makki ki roti', 'makki roti', 'bajra roti', 'jowar roti', 'ragi roti',
  'rice roti', 'akki roti', 'makki ka atta', 'makki atta', 'bajra atta', 'jowar atta', 'ragi atta',
  'rice noodle', 'rice vermicelli', 'gluten-free oats', 'gluten free oats'];

function stripPhrases(text: string, phrases: string[]): string {
  return phrases.reduce((acc, p) => acc.replace(new RegExp(`${escapeRe(p)}(s|es)?`, 'gi'), ' '), text);
}

/** Text with look-alike phrases removed for a family ("peanut butter" is not dairy). */
function textForGroup(group: AllergenKey, text: string): string {
  if (group === 'milk') return stripPhrases(text, NOT_DAIRY);
  if (group === 'gluten') return stripPhrases(text, NOT_WHEAT);
  return text;
}

/** Catalogue foods that stand for a whole family when recorded as an allergy. */
const FOOD_TO_GROUP: Record<string, AllergenKey> = {
  'dairy.milk-after-1-year': 'milk',
  'eggsPoultry.egg-yolk': 'egg',
  'eggsPoultry.whole-egg': 'egg',
  'eggsPoultry.scrambled-egg': 'egg',
  'eggsPoultry.boiled-egg': 'egg',
  'eggsPoultry.egg-omelette': 'egg',
  'nutsSeeds.peanut': 'peanut',
  'nutsSeeds.sesame-seeds-til': 'sesame',
};

/** Which family a catalogue food id belongs to (for recipe metadata). */
function groupOfFoodId(id: string): AllergenKey | undefined {
  if (FOOD_TO_GROUP[id]) return FOOD_TO_GROUP[id];
  const food = FOOD_BY_ID[id];
  if (!food) return undefined;
  if (food.category === 'dairy') return 'milk';
  if (food.category === 'fishSeafood') return 'fish';
  if (['nutsSeeds.almond-badam', 'nutsSeeds.cashew-kaju', 'nutsSeeds.walnut-akhrot', 'nutsSeeds.pistachio'].includes(id)) return 'tree_nuts';
  if (id === 'others.tofu' || id === 'others.soya-chunks') return 'soy';
  return undefined;
}

// ─── Keys / labels ─────────────────────────────────────────────────────────

export function normalizeFoodText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s/&-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Short display name for a catalogue food ("Chikoo (Sapota)" → "Chikoo"). */
export function shortFoodName(f: FoodRef): string {
  return f.name.replace(/\s*\(.*?\)\s*/g, '').split('/')[0].trim();
}

export function groupEntry(key: AllergenKey, status: AllergyStatus = 'known'): FoodAllergyEntry {
  return { key: `group:${key}`, label: GROUP_BY_KEY[key].label, status };
}
export function foodEntry(food: FoodRef, status: AllergyStatus = 'known'): FoodAllergyEntry {
  return { key: `food:${food.id}`, label: shortFoodName(food), status };
}
export function customEntry(text: string, status: AllergyStatus = 'known'): FoodAllergyEntry | null {
  const norm = normalizeFoodText(text);
  if (!norm) return null;
  return { key: `custom:${norm}`, label: text.trim().slice(0, 40), status };
}

// ─── Reading a kid's list (incl. profiles saved before this feature) ───────

interface KidLike {
  foodAllergies?: KidFoodAllergies | null;
  /** v1 (2026-09-30): plain list of AllergenKey or free text. */
  allergies?: string[] | null;
}

function cleanEntry(e: any): FoodAllergyEntry | null {
  if (!e || typeof e.key !== 'string' || typeof e.label !== 'string') return null;
  if (!/^(group|food|custom):.+/.test(e.key)) return null;
  const entry: FoodAllergyEntry = {
    key: e.key,
    label: e.label,
    status: e.status === 'suspected' ? 'suspected' : 'known',
  };
  if (typeof e.note === 'string' && e.note.trim()) entry.note = e.note;
  return entry;
}

/**
 * The child's allergy list. Never throws on old / partial data:
 *   - no fields at all        → empty list
 *   - v1 `allergies: string[]`→ migrated as known allergies
 *   - malformed entries       → dropped
 */
export function readKidAllergies(kid: KidLike | null | undefined): KidFoodAllergies {
  if (!kid) return EMPTY_ALLERGIES;
  const fa = kid.foodAllergies;
  if (fa && Array.isArray(fa.entries)) {
    const entries = fa.entries.map(cleanEntry).filter((e): e is FoodAllergyEntry => !!e);
    return { entries, notSure: entries.length === 0 && !!fa.notSure };
  }
  if (Array.isArray(kid.allergies)) {
    const entries: FoodAllergyEntry[] = [];
    for (const a of kid.allergies) {
      if (typeof a !== 'string' || !a.trim()) continue;
      const e = a in GROUP_BY_KEY ? groupEntry(a as AllergenKey) : customEntry(a);
      if (e && !entries.some((x) => x.key === e.key)) entries.push(e);
    }
    return { entries };
  }
  return EMPTY_ALLERGIES;
}

/** One-line summary for cards: "Milk & dairy, Banana (suspected)". */
export function summarizeAllergies(a: KidFoodAllergies): string {
  if (a.entries.length === 0) return a.notSure ? 'Not sure yet' : 'None added';
  return a.entries.map((e) => (e.status === 'suspected' ? `${e.label} (suspected)` : e.label)).join(', ');
}

// ─── Matching ──────────────────────────────────────────────────────────────

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whole word / phrase match, allowing a plural. Never a bare substring:
 * "pea" does not match "peanut", "til" does not match "until".
 */
export function hasWord(text: string, word: string): boolean {
  return new RegExp(`(^|[^a-z])${escapeRe(word)}(s|es)?([^a-z]|$)`, 'i').test(text);
}

/** Words that identify one catalogue food in ingredient text. */
const EXTRA_ALIASES: Record<string, string[]> = {
  'dairy.curd-yogurt': ['curd', 'dahi', 'yogurt', 'yoghurt'],
  'grains.roti-chapati': ['roti', 'chapati'],
  'grains.suji-semolina': ['semolina', 'suji', 'sooji', 'rava'],
  'others.besan-gram-flour': ['besan', 'gram flour'],
  'eggsPoultry.chicken-boiled': ['chicken'],
  'meat.mutton-minced': ['mutton'],
  'grains.puffed-rice-murmura': ['puffed rice', 'murmura'],
  'grains.poha': ['poha', 'flattened rice'],
  'lentils.toor-dal-arhar': ['toor dal', 'arhar dal', 'tuvar dal'],
  'lentils.rajma-kidney-beans': ['rajma', 'kidney beans'],
  'vegetables.bottle-gourd-lauki': ['bottle gourd', 'lauki', 'dudhi'],
};

function wordsForFood(food: FoodRef): string[] {
  const base = food.name.toLowerCase();
  const words = new Set<string>();
  base.replace(/\(.*?\)/g, '').split('/').map((s) => s.trim()).filter(Boolean).forEach((w) => words.add(w));
  for (const m of base.matchAll(/\(([^)]+)\)/g)) {
    const inner = m[1].trim();
    // Skip descriptors ("Boiled", "after 1 year") — only real alternative names count.
    if (!/after|mashed|boiled|minced|chicken|mutton/.test(inner)) inner.split('/').forEach((w) => words.add(w.trim()));
  }
  (EXTRA_ALIASES[food.id] ?? []).forEach((w) => words.add(w));
  return Array.from(words).filter((w) => w.length >= 3);
}

const FOOD_WORDS: Record<string, string[]> = Object.fromEntries(BABY_FOODS.map((f) => [f.id, wordsForFood(f)]));

export interface MealLike {
  name: string;
  /** Ingredient lines (free text). */
  ingredients: string[];
  /** Allergen families the recipe data declares (travel recipes). */
  declaredAllergens?: string[];
  /** Catalogue food ids the recipe declares (tiffin recipes). */
  foodIds?: string[];
}

export interface AllergyMatch {
  entry: FoodAllergyEntry;
  /** The ingredient word that triggered it ("paneer"), or null when it came from recipe metadata. */
  ingredient: string | null;
  /** Set when the match is through an ingredient family ("paneer" → milk). */
  family: AllergenKey | null;
}

function matchGroup(group: AllergenKey, meal: MealLike, text: string): { hit: boolean; ingredient: string | null } {
  const info = GROUP_BY_KEY[group];
  const t = textForGroup(group, text);
  // Prefer a specific ingredient ("paneer") over the family's own name.
  const specific = info.words.slice(1).find((w) => hasWord(t, w));
  if (specific) return { hit: true, ingredient: specific };
  if (hasWord(t, info.words[0])) return { hit: true, ingredient: info.words[0] };
  if ((meal.declaredAllergens ?? []).includes(group)) return { hit: true, ingredient: null };
  const viaId = (meal.foodIds ?? []).find((id) => groupOfFoodId(id) === group);
  if (viaId) return { hit: true, ingredient: shortFoodName(FOOD_BY_ID[viaId]).toLowerCase() };
  return { hit: false, ingredient: null };
}

/**
 * Which entries on the child's list this meal contains. One match per
 * entry. An empty result means "nothing detected" — NOT "allergy-free".
 */
export function matchAllergies(meal: MealLike, entries: FoodAllergyEntry[]): AllergyMatch[] {
  if (entries.length === 0) return [];
  const text = [meal.name, ...meal.ingredients].join(' \n ').toLowerCase();
  const out: AllergyMatch[] = [];
  for (const entry of entries) {
    const [kind, ...rest] = entry.key.split(':');
    const value = rest.join(':');
    if (kind === 'group' && value in GROUP_BY_KEY) {
      const g = value as AllergenKey;
      const r = matchGroup(g, meal, text);
      if (r.hit) out.push({ entry, ingredient: r.ingredient, family: g });
    } else if (kind === 'food') {
      const family = FOOD_TO_GROUP[value];
      if (family) {
        const r = matchGroup(family, meal, text);
        if (r.hit) out.push({ entry, ingredient: r.ingredient, family });
        continue;
      }
      if ((meal.foodIds ?? []).includes(value)) {
        out.push({ entry, ingredient: entry.label.toLowerCase(), family: null });
        continue;
      }
      const t = value.startsWith('dairy.') ? stripPhrases(text, NOT_DAIRY) : text;
      const w = (FOOD_WORDS[value] ?? []).find((word) => hasWord(t, word));
      if (w) out.push({ entry, ingredient: w, family: null });
    } else if (kind === 'custom' && value) {
      if (hasWord(normalizeFoodText(text), value)) out.push({ entry, ingredient: value, family: null });
    }
  }
  return out;
}

/** Check typed text (e.g. a planner note). It is not a full ingredient list. */
export function matchAllergiesInText(text: string, entries: FoodAllergyEntry[]): AllergyMatch[] {
  return matchAllergies({ name: text, ingredients: [] }, entries);
}

// ─── Wording ───────────────────────────────────────────────────────────────

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function listName(m: AllergyMatch): string {
  return m.family ? cap(GROUP_BY_KEY[m.family].noun) : m.entry.label;
}

/**
 * One sentence per match, e.g.
 * "This recipe contains paneer, which is a milk ingredient. Milk is on Navi's allergy list."
 */
export function allergyAlertSentences(kidName: string, matches: AllergyMatch[], subject = 'This recipe'): string[] {
  return matches.map((m) => {
    const which = m.entry.status === 'known' ? 'allergy list' : 'suspected-reaction list';
    const name = listName(m);
    let contains: string;
    if (!m.ingredient) {
      contains = `${subject} is marked as containing ${name.toLowerCase()}.`;
    } else if (m.family && m.ingredient !== GROUP_BY_KEY[m.family].words[0]) {
      const noun = GROUP_BY_KEY[m.family].noun;
      contains = `${subject} contains ${m.ingredient}, which is ${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun} ingredient.`;
    } else {
      contains = `${subject} contains ${m.ingredient}.`;
    }
    return `${contains} ${name} is on ${kidName}'s ${which}.`;
  });
}

export function allergyAlertTitle(kidName: string, matches: AllergyMatch[]): string {
  return matches.some((m) => m.entry.status === 'known')
    ? `Allergy alert for ${kidName}`
    : `Possible reaction alert for ${kidName}`;
}

/** Short chip text: "paneer (milk)" / "banana". */
export function matchChipText(m: AllergyMatch): string {
  if (m.family && m.ingredient && m.ingredient !== GROUP_BY_KEY[m.family].words[0]) {
    return `${m.ingredient} (${GROUP_BY_KEY[m.family].noun})`;
  }
  return m.ingredient ?? listName(m).toLowerCase();
}

/** Shown wherever we say "nothing detected". */
export const NOT_A_GUARANTEE =
  'This is not a guarantee. Always check packaged-food labels, any ingredients you swap in, and cross-contact in the kitchen.';
