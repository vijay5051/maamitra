// Baby's First Foods reference data — drives the 3-day rule tracker
// (Health tab → Foods sub-tab). Source: user-provided "Baby's First Foods
// Tracker" PDF + IAP / AAP weaning guidance.
//
// The 3-day rule: introduce ONE new food, feed it for 3 consecutive days,
// watch for rashes / tummy upset / vomiting / fussiness before trying the
// next. Min ages reflect Indian paediatric guidance (IAP 2024) — most
// solids start at 6 mo, with specific deferrals for honey, cow's milk,
// whole nuts, and some allergenic seafood.

export type FoodCategory =
  | 'fruits'
  | 'vegetables'
  | 'grains'
  | 'dairy'
  | 'lentils'
  | 'eggsPoultry'
  | 'fishSeafood'
  | 'meat'
  | 'nutsSeeds'
  | 'spices'
  | 'oilsFats'
  | 'sweeteners'
  | 'others';

export interface FoodCategoryInfo {
  id: FoodCategory;
  label: string;
  icon: string;          // Ionicons name
  /** Background tint for the category header pill. */
  tint: string;
}

export const FOOD_CATEGORIES: FoodCategoryInfo[] = [
  { id: 'fruits',      label: 'Fruits',           icon: 'nutrition-outline',  tint: '#FCE7F3' },
  { id: 'vegetables',  label: 'Vegetables',       icon: 'leaf-outline',       tint: '#DCFCE7' },
  { id: 'grains',      label: 'Grains & Cereals', icon: 'restaurant-outline', tint: '#FEF3C7' },
  { id: 'dairy',       label: 'Dairy',            icon: 'cafe-outline',       tint: '#EDE9FE' },
  { id: 'lentils',     label: 'Lentils & Legumes', icon: 'ellipse-outline',   tint: '#CFFAFE' },
  { id: 'eggsPoultry', label: 'Eggs & Poultry',   icon: 'egg-outline',        tint: '#FED7AA' },
  { id: 'fishSeafood', label: 'Fish & Seafood',   icon: 'fish-outline',       tint: '#DBEAFE' },
  { id: 'meat',        label: 'Meat',             icon: 'flame-outline',      tint: '#FECACA' },
  { id: 'nutsSeeds',   label: 'Nuts & Seeds',     icon: 'flower-outline',     tint: '#F5D0FE' },
  { id: 'spices',      label: 'Spices & Flavors', icon: 'sparkles-outline',   tint: '#FFE4E6' },
  { id: 'oilsFats',    label: 'Oils & Fats',      icon: 'water-outline',      tint: '#FEF9C3' },
  { id: 'sweeteners',  label: 'Sweeteners',       icon: 'ice-cream-outline',  tint: '#FED7AA' },
  { id: 'others',      label: 'Others',           icon: 'apps-outline',       tint: '#E0F2FE' },
];

export interface FoodRef {
  /** Stable slug — persisted to Firestore. */
  id: string;
  name: string;
  category: FoodCategory;
  /** Earliest age in months at which this food is generally safe. */
  minAgeMonths: number;
  /** Concise warning shown in the detail sheet (choking, allergy, age gate). */
  warning?: string;
}

function f(
  category: FoodCategory,
  name: string,
  opts: { minAge?: number; warning?: string; idOverride?: string } = {},
): FoodRef {
  const id =
    opts.idOverride ??
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  return {
    id: `${category}.${id}`,
    name,
    category,
    minAgeMonths: opts.minAge ?? 6,
    warning: opts.warning,
  };
}

// ─── Master food list ─────────────────────────────────────────────────
// Order within each category is preserved from the PDF so users find
// what they're looking for in the same place.

export const BABY_FOODS: FoodRef[] = [
  // Fruits — most start at 6 mo. Berries / citrus around 8-9 mo. Whole
  // grapes are a choking hazard until ≥ 12 mo (mash before that).
  f('fruits', 'Apple'),
  f('fruits', 'Banana'),
  f('fruits', 'Pear'),
  f('fruits', 'Papaya'),
  f('fruits', 'Avocado'),
  f('fruits', 'Mango', { minAge: 8 }),
  f('fruits', 'Orange', { minAge: 9, warning: 'Citrus — watch for mouth rash' }),
  f('fruits', 'Chikoo (Sapota)'),
  f('fruits', 'Watermelon'),
  f('fruits', 'Muskmelon'),
  f('fruits', 'Grapes (mashed)', { minAge: 8, warning: 'Choking hazard whole — always mash or quarter until age 4' }),
  f('fruits', 'Pomegranate', { minAge: 8 }),
  f('fruits', 'Kiwi', { minAge: 8 }),
  f('fruits', 'Peach'),
  f('fruits', 'Plum'),
  f('fruits', 'Strawberry', { minAge: 8 }),
  f('fruits', 'Blueberry', { minAge: 8 }),
  f('fruits', 'Custard Apple', { minAge: 8 }),
  f('fruits', 'Litchi', { minAge: 9 }),
  f('fruits', 'Guava', { minAge: 8 }),
  f('fruits', 'Jamun', { minAge: 9 }),
  f('fruits', 'Fig (Anjeer)', { minAge: 8, idOverride: 'fig-anjeer' }),

  // Vegetables — most safe from 6 mo as purees, then mashed, then soft pieces.
  f('vegetables', 'Carrot'),
  f('vegetables', 'Sweet Potato'),
  f('vegetables', 'Pumpkin (Kaddu)'),
  f('vegetables', 'Bottle Gourd (Lauki)'),
  f('vegetables', 'Spinach (Palak)'),
  f('vegetables', 'Beetroot'),
  f('vegetables', 'Potato'),
  f('vegetables', 'Tomato', { minAge: 8, warning: 'Mildly acidic — watch for nappy rash' }),
  f('vegetables', 'Cucumber', { minAge: 8 }),
  f('vegetables', 'Peas'),
  f('vegetables', 'Methi (Fenugreek)', { minAge: 8 }),
  f('vegetables', 'French Beans'),
  f('vegetables', 'Zucchini'),
  f('vegetables', 'Broccoli', { minAge: 8 }),
  f('vegetables', 'Cauliflower', { minAge: 8, warning: 'Can cause gas — start small' }),
  f('vegetables', 'Cabbage', { minAge: 9, warning: 'Can cause gas — start small' }),
  f('vegetables', 'Capsicum', { minAge: 9 }),
  f('vegetables', 'Corn', { minAge: 8, warning: 'Choking hazard whole — puree or use cornmeal' }),
  f('vegetables', 'Drumstick', { minAge: 9 }),
  f('vegetables', 'Ridge Gourd (Turai)'),
  f('vegetables', 'Bitter Gourd (Karela)', { minAge: 10, warning: 'Bitter — introduce in tiny amounts mixed with khichdi' }),
  f('vegetables', 'Ash Gourd'),
  f('vegetables', 'Snake Gourd'),
  f('vegetables', 'Parwal'),
  f('vegetables', 'Turnip (Shalgam)', { minAge: 8 }),
  f('vegetables', 'Radish (Mooli)', { minAge: 9 }),
  f('vegetables', 'Coriander Leaves'),
  f('vegetables', 'Mint Leaves'),
  f('vegetables', 'Curry Leaves'),
  f('vegetables', 'Amaranth (Chaulai)'),

  // Grains & Cereals — rice, ragi, oats, suji are classic 6-mo first grains.
  f('grains', 'Rice'),
  f('grains', 'Ragi (Finger Millet)', { idOverride: 'ragi-finger-millet' }),
  f('grains', 'Oats'),
  f('grains', 'Suji (Semolina)'),
  f('grains', 'Dalia (Broken Wheat)', { minAge: 8, warning: 'Contains gluten — start after baby tolerates other grains', idOverride: 'dalia-broken-wheat' }),
  f('grains', 'Sabudana (Sago)', { minAge: 8 }),
  f('grains', 'Poha', { minAge: 8 }),
  f('grains', 'Vermicelli (Semiya)', { minAge: 8, idOverride: 'vermicelli-semiya' }),
  f('grains', 'Bread', { minAge: 9, warning: 'Soft pieces only — toast hard for older babies' }),
  f('grains', 'Idli', { minAge: 8 }),
  f('grains', 'Dosa', { minAge: 9 }),
  f('grains', 'Upma', { minAge: 9 }),
  f('grains', 'Khichdi'),
  f('grains', 'Roti / Chapati', { minAge: 9, idOverride: 'roti-chapati' }),
  f('grains', 'Paratha', { minAge: 10 }),
  f('grains', 'Bajra (Pearl Millet)', { minAge: 8, idOverride: 'bajra-pearl-millet' }),
  f('grains', 'Jowar (Sorghum)', { minAge: 8 }),
  f('grains', 'Maize / Corn', { minAge: 8, idOverride: 'maize-corn' }),
  f('grains', 'Barley (Jau)', { minAge: 8 }),
  f('grains', 'Quinoa', { minAge: 8 }),
  f('grains', 'Sathumaavu'),
  f('grains', 'Puffed Rice (Murmura)', { minAge: 9, idOverride: 'puffed-rice-murmura' }),
  f('grains', 'Rice Flakes', { minAge: 8 }),
  f('grains', 'Wheat Porridge', { minAge: 8 }),
  f('grains', 'Multigrain Atta', { minAge: 9 }),

  // Dairy — yogurt, paneer, ghee, cheese OK from 6-8 mo. Cow's milk as a
  // drink is deferred to ≥ 12 mo per IAP. Honey ≥ 12 mo (botulism risk).
  f('dairy', 'Curd / Yogurt', { idOverride: 'curd-yogurt' }),
  f('dairy', 'Paneer'),
  f('dairy', 'Cheese', { minAge: 8 }),
  f('dairy', 'Ghee'),
  f('dairy', 'Butter', { minAge: 8 }),
  f('dairy', 'Buttermilk', { minAge: 8 }),
  f('dairy', 'Cream', { minAge: 9 }),
  f('dairy', 'Khoya / Mawa', { minAge: 9, idOverride: 'khoya-mawa' }),
  f('dairy', 'Cottage Cheese', { minAge: 8 }),
  f('dairy', 'Milk (after 1 year)', { minAge: 12, warning: 'Cow\'s milk as a drink is unsafe before 12 months — IAP', idOverride: 'milk-after-1-year' }),

  // Lentils & Legumes — moong dal first, then others. Start whole pulses
  // and rajma later (harder to digest).
  f('lentils', 'Moong Dal'),
  f('lentils', 'Toor Dal (Arhar)'),
  f('lentils', 'Masoor Dal'),
  f('lentils', 'Chana Dal', { minAge: 8 }),
  f('lentils', 'Urad Dal', { minAge: 8 }),
  f('lentils', 'Rajma (Kidney Beans)', { minAge: 10, warning: 'Hard to digest — soak well, cook soft', idOverride: 'rajma-kidney-beans' }),
  f('lentils', 'Chickpea (Chole)', { minAge: 10 }),
  f('lentils', 'Black Eyed Peas (Lobia)', { minAge: 9, idOverride: 'black-eyed-peas-lobia' }),
  f('lentils', 'Green Gram (Whole Moong)', { minAge: 8, idOverride: 'green-gram-whole-moong' }),
  f('lentils', 'Black Gram (Sabut Urad)', { minAge: 9, idOverride: 'black-gram-sabut-urad' }),
  f('lentils', 'Kulthi Dal', { minAge: 9 }),
  f('lentils', 'Mixed Dal', { minAge: 8, warning: 'Introduce each dal individually first' }),
  f('lentils', 'Sprouts (Moong)', { minAge: 9 }),
  f('lentils', 'Sprouts (Chana)', { minAge: 10 }),

  // Eggs & Poultry — egg yolk OK from 6-8 mo; whole egg from 8 mo. AAP
  // now encourages early egg introduction to reduce allergy risk.
  f('eggsPoultry', 'Egg Yolk', { minAge: 7 }),
  f('eggsPoultry', 'Whole Egg', { minAge: 8, warning: 'Common allergen — watch closely on D1' }),
  f('eggsPoultry', 'Scrambled Egg', { minAge: 8 }),
  f('eggsPoultry', 'Boiled Egg', { minAge: 8, warning: 'Mash well — choking hazard whole' }),
  f('eggsPoultry', 'Egg Omelette', { minAge: 9 }),
  f('eggsPoultry', 'Chicken (Boiled)', { minAge: 8 }),
  f('eggsPoultry', 'Chicken (Minced)', { minAge: 8 }),
  f('eggsPoultry', 'Chicken Soup', { minAge: 8 }),
  f('eggsPoultry', 'Chicken Keema', { minAge: 9 }),
  f('eggsPoultry', 'Turkey', { minAge: 9 }),

  // Fish & Seafood — low-mercury fish from 6-8 mo. Avoid high-mercury
  // (king mackerel, swordfish). Salmon / sardine excellent for omega-3.
  f('fishSeafood', 'Rohu Fish', { minAge: 8, warning: 'Debone meticulously — choking hazard' }),
  f('fishSeafood', 'Pomfret', { minAge: 8, warning: 'Debone meticulously — choking hazard' }),
  f('fishSeafood', 'Salmon', { minAge: 8 }),
  f('fishSeafood', 'Sardine', { minAge: 8 }),
  f('fishSeafood', 'Mackerel (Bangda)', { minAge: 9, idOverride: 'mackerel-bangda' }),
  f('fishSeafood', 'Hilsa', { minAge: 9, warning: 'Many fine bones — debone meticulously' }),
  f('fishSeafood', 'Catla', { minAge: 8 }),
  f('fishSeafood', 'Tilapia', { minAge: 8 }),
  f('fishSeafood', 'Tuna', { minAge: 9, warning: 'Limit to once a week — moderate mercury' }),
  f('fishSeafood', 'Cod', { minAge: 8 }),
  f('fishSeafood', 'Fish Soup', { minAge: 8 }),

  // Meat — minced/soft only initially. Liver is iron-rich but limit to
  // once a week (high vitamin A).
  f('meat', 'Mutton (Minced)'),
  f('meat', 'Mutton Soup'),
  f('meat', 'Lamb Keema', { minAge: 8 }),
  f('meat', 'Goat Meat', { minAge: 8 }),
  f('meat', 'Liver (Chicken/Mutton)', { minAge: 8, warning: 'Iron-rich but limit to once a week — high vitamin A', idOverride: 'liver-chicken-mutton' }),

  // Nuts & Seeds — as PASTE / POWDER only until ≥ 4 yr (whole nuts are
  // a top choking hazard). Peanut introduction at 6 mo reduces allergy
  // risk per LEAP study.
  f('nutsSeeds', 'Almond (Badam)', { warning: 'Powder or paste only — never whole nuts before age 4', idOverride: 'almond-badam' }),
  f('nutsSeeds', 'Cashew (Kaju)', { minAge: 7, warning: 'Powder or paste only', idOverride: 'cashew-kaju' }),
  f('nutsSeeds', 'Walnut (Akhrot)', { minAge: 7, warning: 'Powder or paste only', idOverride: 'walnut-akhrot' }),
  f('nutsSeeds', 'Peanut', { minAge: 6, warning: 'Smooth peanut butter or peanut powder — never whole. Top allergen' }),
  f('nutsSeeds', 'Pistachio', { minAge: 8, warning: 'Powder or paste only' }),
  f('nutsSeeds', 'Raisins (Kishmish)', { minAge: 9, warning: 'Choking hazard whole — soak and chop until age 4', idOverride: 'raisins-kishmish' }),
  f('nutsSeeds', 'Dates (Khajoor)', { minAge: 7, warning: 'Pit and chop finely', idOverride: 'dates-khajoor' }),
  f('nutsSeeds', 'Fig (Anjeer)', { minAge: 8, idOverride: 'fig-anjeer' }),
  f('nutsSeeds', 'Coconut'),
  f('nutsSeeds', 'Sesame Seeds (Til)', { minAge: 7, warning: 'Common allergen', idOverride: 'sesame-seeds-til' }),
  f('nutsSeeds', 'Flax Seeds', { minAge: 8, warning: 'Grind first' }),
  f('nutsSeeds', 'Chia Seeds', { minAge: 8, warning: 'Always soak in liquid before serving' }),
  f('nutsSeeds', 'Pumpkin Seeds', { minAge: 8, warning: 'Powder for younger babies' }),
  f('nutsSeeds', 'Sunflower Seeds', { minAge: 8, warning: 'Powder for younger babies' }),
  f('nutsSeeds', 'Makhana (Lotus Seeds)', { minAge: 8, warning: 'Roast soft and mash for younger babies', idOverride: 'makhana-lotus-seeds' }),

  // Spices & Flavors — mild Indian spices OK from 6-7 mo in tiny amounts.
  // Hold black pepper / chilli until later.
  f('spices', 'Turmeric (Haldi)', { idOverride: 'turmeric-haldi' }),
  f('spices', 'Cumin (Jeera)', { idOverride: 'cumin-jeera' }),
  f('spices', 'Coriander Powder'),
  f('spices', 'Hing (Asafoetida)', { idOverride: 'hing-asafoetida' }),
  f('spices', 'Cinnamon (Dalchini)', { minAge: 7, idOverride: 'cinnamon-dalchini' }),
  f('spices', 'Cardamom (Elaichi)', { minAge: 7, idOverride: 'cardamom-elaichi' }),
  f('spices', 'Nutmeg (Jaiphal)', { minAge: 8, warning: 'Tiny pinch only — large amounts toxic', idOverride: 'nutmeg-jaiphal' }),
  f('spices', 'Black Pepper', { minAge: 9, warning: 'Tiny pinch only' }),
  f('spices', 'Fennel Seeds (Saunf)', { idOverride: 'fennel-seeds-saunf' }),
  f('spices', 'Ajwain'),
  f('spices', 'Ginger'),
  f('spices', 'Garlic'),

  // Oils & Fats — ghee from 6 mo, neutral oils from 6 mo; mustard oil
  // commonly used in North Indian cuisine but use sparingly.
  f('oilsFats', 'Ghee'),
  f('oilsFats', 'Coconut Oil'),
  f('oilsFats', 'Olive Oil'),
  f('oilsFats', 'Mustard Oil', { minAge: 8 }),
  f('oilsFats', 'Groundnut Oil'),
  f('oilsFats', 'Sesame Oil'),
  f('oilsFats', 'Sunflower Oil'),
  f('oilsFats', 'Rice Bran Oil'),

  // Sweeteners — jaggery from 6 mo (better than sugar). HONEY ≥ 12 MO
  // (botulism risk). Maple syrup also better deferred.
  f('sweeteners', 'Jaggery (Gur)', { idOverride: 'jaggery-gur' }),
  f('sweeteners', 'Date Syrup'),
  f('sweeteners', 'Maple Syrup', { minAge: 12 }),
  f('sweeteners', 'Coconut Sugar', { minAge: 8 }),
  f('sweeteners', 'Honey (After 1 year)', { minAge: 12, warning: 'Strict ≥ 12 months — risk of infant botulism', idOverride: 'honey-after-1-year' }),

  // Others
  f('others', 'Tofu', { minAge: 8 }),
  f('others', 'Soya Chunks', { minAge: 9, warning: 'Boil thoroughly, blend smooth for younger babies' }),
  f('others', 'Besan (Gram Flour)', { minAge: 8 }),
  f('others', 'Rice Flour'),
  f('others', 'Ragi Flour'),
  f('others', 'Coconut Milk', { minAge: 8 }),
  f('others', 'Almond Milk', { minAge: 12, warning: 'Not a substitute for breast milk / formula in first year' }),
];

export const FOOD_BY_ID: Record<string, FoodRef> = BABY_FOODS.reduce((acc, food) => {
  acc[food.id] = food;
  return acc;
}, {} as Record<string, FoodRef>);

export function foodsByCategory(category: FoodCategory): FoodRef[] {
  return BABY_FOODS.filter((f) => f.category === category);
}
