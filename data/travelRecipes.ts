// Travel recipe catalogue — 37 recipes sourced from The Little Traveller's Cookbook
// (babies 6–12 months). Fetched from Firestore at runtime; this file is the
// local seed / fallback used when the network is unavailable.

export type TravelAllergen =
  | 'milk' | 'gluten' | 'tree_nuts' | 'egg' | 'soy' | 'sesame' | 'peanut';

export type TravelCategory =
  | 'instant_mix'
  | 'no_prep_fruit'
  | 'shelf_stable_snack'
  | 'ready_to_eat'
  | 'packed_home_meal'
  | 'homemade_snack';

export type TravelType =
  | 'flight_short' | 'flight_long' | 'train' | 'road_trip' | 'vacation';

export type PrepLocation = 'home_before_trip' | 'on_the_go' | 'thermos_only';

export type GearKey =
  | 'vacuum_flask_thermos' | 'insulated_lunchbox' | 'insulated_bag'
  | 'silicone_pouch' | 'airtight_container' | 'none';

export interface TravelIngredient {
  name: string;
  quantity: string;
  unit: string;
  notes?: string;
  allergenFlag?: TravelAllergen;
  substitute?: string;
}

export interface TravelRecipe {
  id: string;
  title: string;
  subtitle: string;
  category: TravelCategory;
  travelTypes: TravelType[];
  prepLocation: PrepLocation;
  prepTimeMinutes: number;

  ageMinMonths: number;
  ageMaxMonths: number;
  stageBadge: string;

  // Storage — all in hours; 0 = not applicable
  roomTempHours: number;
  insulatedBagHours: number;
  thermosHours: number;
  requiresRefrigeration: boolean;
  gearRequired: GearKey[];
  storageNotes?: string;

  allergenContains: TravelAllergen[];
  // Human-readable allergen note shown as a tooltip
  allergenNote?: string;
  // true = show "already tested at home?" prompt
  goldenRuleFlag: boolean;

  nutritionHighlights: string[];

  ingredients: TravelIngredient[];
  steps: string[];
  stepTips: Record<number, string>; // stepIndex → tip text

  packingTips: string[];
  tags: string[];
}

// ─── Category metadata ───────────────────────────────────────────────────────
export const TRAVEL_CATEGORIES: {
  key: TravelCategory;
  label: string;
  icon: string;
  sortOrder: number;
}[] = [
  { key: 'instant_mix',        label: 'Instant Mixes',     icon: '🥣', sortOrder: 1 },
  { key: 'no_prep_fruit',      label: 'No-Prep Fruits',    icon: '🍌', sortOrder: 2 },
  { key: 'shelf_stable_snack', label: 'Shelf-Stable Snacks',icon: '🍪', sortOrder: 3 },
  { key: 'ready_to_eat',       label: 'Ready-to-Eat',      icon: '🥛', sortOrder: 4 },
  { key: 'packed_home_meal',   label: 'Packed Meals',      icon: '🍱', sortOrder: 5 },
  { key: 'homemade_snack',     label: 'Homemade Snacks',   icon: '🥞', sortOrder: 6 },
];

export const CATEGORY_BY_KEY = Object.fromEntries(
  TRAVEL_CATEGORIES.map((c) => [c.key, c]),
) as Record<TravelCategory, (typeof TRAVEL_CATEGORIES)[number]>;

// ─── Gear metadata ────────────────────────────────────────────────────────────
export const GEAR_LABELS: Record<GearKey, string> = {
  vacuum_flask_thermos: 'Vacuum flask thermos',
  insulated_lunchbox:  'Insulated lunchbox',
  insulated_bag:       'Insulated bag',
  silicone_pouch:      'Silicone squeeze pouch',
  airtight_container:  'Airtight container',
  none:                'No gear needed',
};

// ─── Recipe catalogue ─────────────────────────────────────────────────────────

export const TRAVEL_RECIPES: TravelRecipe[] = [
  // ── 🥣 Instant Mixes & Porridges ──────────────────────────────────────────
  {
    id: 'tr_sathumaavu',
    title: 'Sathumaavu / Health Mix',
    subtitle: 'Multi-grain powder — just add hot water',
    category: 'instant_mix',
    travelTypes: ['flight_short', 'flight_long', 'train', 'road_trip', 'vacation'],
    prepLocation: 'on_the_go',
    prepTimeMinutes: 3,
    ageMinMonths: 6, ageMaxMonths: 12, stageBadge: '🍼 6m+',
    roomTempHours: 2, insulatedBagHours: 3, thermosHours: 0,
    requiresRefrigeration: false,
    gearRequired: ['none'],
    storageNotes: 'Carry powder dry; mix with thermos hot water just before feeding.',
    allergenContains: ['gluten', 'tree_nuts'],
    allergenNote: 'Contains wheat and mixed nuts. Use a nut-free, wheat-free blend for allergies.',
    goldenRuleFlag: true,
    nutritionHighlights: ['multi-grain', 'iron_rich', 'protein_rich'],
    ingredients: [
      { name: 'Sathumaavu / Health mix powder', quantity: '2', unit: 'tbsp' },
      { name: 'Hot water or milk', quantity: '4', unit: 'tbsp', allergenFlag: 'milk', substitute: 'Use water for dairy-free' },
    ],
    steps: [
      'Mix 2 tbsp powder into 4 tbsp hot water (or milk). Stir well until smooth.',
      'Cool to a warm, comfortable temperature before feeding.',
    ],
    stepTips: { 0: 'Carry the powder in a small zip-lock bag. Mix in the cup right before feeding.' },
    packingTips: [
      'Pre-measure powder into a small sealed zip-lock bag.',
      'Request hot water from flight attendants or train pantry.',
    ],
    tags: ['instant', 'no_fridge', 'just_add_water', 'multi_grain'],
  },
  {
    id: 'tr_dry_fruit_powder',
    title: 'Dry Fruit Powder',
    subtitle: 'Almonds, cashews & dates — stir into any porridge',
    category: 'instant_mix',
    travelTypes: ['flight_short', 'flight_long', 'train', 'road_trip', 'vacation'],
    prepLocation: 'home_before_trip',
    prepTimeMinutes: 10,
    ageMinMonths: 8, ageMaxMonths: 24, stageBadge: '🍼 8m+',
    roomTempHours: 0, insulatedBagHours: 0, thermosHours: 0,
    requiresRefrigeration: false,
    gearRequired: ['none'],
    storageNotes: 'Stays good 2–3 weeks at room temperature in an airtight jar.',
    allergenContains: ['tree_nuts'],
    allergenNote: 'Contains almonds and cashews (tree nuts). Skip nuts entirely for nut-allergic babies.',
    goldenRuleFlag: true,
    nutritionHighlights: ['healthy_fats', 'calcium', 'iron_rich'],
    ingredients: [
      { name: 'Almonds', quantity: '10', unit: 'nos', allergenFlag: 'tree_nuts' },
      { name: 'Cashews', quantity: '8', unit: 'nos', allergenFlag: 'tree_nuts' },
      { name: 'Dates (pitted)', quantity: '5', unit: 'nos' },
    ],
    steps: [
      'Blend almonds, cashews and dates together into a fine powder at home.',
      'Store in an airtight container. Stir 1 tsp into any porridge or milk for a nutrition boost.',
    ],
    stepTips: {},
    packingTips: ['Pre-pack in a small jar or zip-lock. Lasts weeks — great travel staple.'],
    tags: ['instant', 'no_fridge', 'booster', 'no_cooking'],
  },
  {
    id: 'tr_instant_oats',
    title: 'Instant Oats Porridge',
    subtitle: 'Quick oats, hot water & banana',
    category: 'instant_mix',
    travelTypes: ['flight_long', 'train', 'road_trip'],
    prepLocation: 'on_the_go',
    prepTimeMinutes: 5,
    ageMinMonths: 7, ageMaxMonths: 12, stageBadge: '🍼 7m+',
    roomTempHours: 2, insulatedBagHours: 3, thermosHours: 0,
    requiresRefrigeration: false,
    gearRequired: ['none'],
    storageNotes: 'Mix just before feeding. Do not pre-mix and carry.',
    allergenContains: ['gluten'],
    allergenNote: 'Oats contain gluten. Use certified gluten-free oats if needed.',
    goldenRuleFlag: true,
    nutritionHighlights: ['fiber_rich', 'energy'],
    ingredients: [
      { name: 'Quick oats (instant)', quantity: '3', unit: 'tbsp', allergenFlag: 'gluten', substitute: 'Gluten-free oats' },
      { name: 'Hot water', quantity: '5', unit: 'tbsp' },
      { name: 'Ripe banana (mashed)', quantity: '¼', unit: 'nos' },
    ],
    steps: [
      'Pour hot water over quick oats. Stir and let sit 2 minutes until soft.',
      'Mash in ripe banana for natural sweetness.',
    ],
    stepTips: { 0: 'Request hot water from flight crew. Quick oats are fine with room-temp hot water — no stove needed.' },
    packingTips: ['Carry oats in a zip-lock. Banana travels well unpeeled.'],
    tags: ['instant', 'no_fridge', 'just_add_water', 'oats'],
  },
  {
    id: 'tr_rice_cereal',
    title: 'Rice Cereal',
    subtitle: 'Roasted rice powder — easy-to-digest first food',
    category: 'instant_mix',
    travelTypes: ['flight_short', 'flight_long', 'train', 'road_trip', 'vacation'],
    prepLocation: 'on_the_go',
    prepTimeMinutes: 3,
    ageMinMonths: 6, ageMaxMonths: 10, stageBadge: '🍼 6m+',
    roomTempHours: 2, insulatedBagHours: 3, thermosHours: 0,
    requiresRefrigeration: false,
    gearRequired: ['none'],
    allergenContains: [],
    goldenRuleFlag: true,
    nutritionHighlights: ['easy_digest', 'energy'],
    ingredients: [
      { name: 'Roasted rice powder', quantity: '2', unit: 'tbsp' },
      { name: 'Hot water', quantity: '5', unit: 'tbsp' },
    ],
    steps: [
      'Mix roasted rice powder with hot water until smooth and lump-free.',
      'Cool to a comfortable temperature and feed.',
    ],
    stepTips: {},
    packingTips: ['Carry powder in a small sealed bag. Allergen-free and perfect for first flights.'],
    tags: ['instant', 'no_fridge', 'allergen_free', 'just_add_water'],
  },
  {
    id: 'tr_dalia',
    title: 'Dalia (Broken Wheat Porridge)',
    subtitle: 'Roasted broken wheat powder — just add hot water',
    category: 'instant_mix',
    travelTypes: ['train', 'road_trip', 'vacation'],
    prepLocation: 'home_before_trip',
    prepTimeMinutes: 5,
    ageMinMonths: 8, ageMaxMonths: 12, stageBadge: '🍼 8m+',
    roomTempHours: 2, insulatedBagHours: 3, thermosHours: 0,
    requiresRefrigeration: false,
    gearRequired: ['none'],
    storageNotes: 'Dry-roast and powder at home. Powder keeps weeks unsealed.',
    allergenContains: ['gluten'],
    allergenNote: 'Dalia is broken wheat — contains gluten.',
    goldenRuleFlag: true,
    nutritionHighlights: ['fiber_rich', 'protein_rich', 'energy'],
    ingredients: [
      { name: 'Dalia (broken wheat, roasted & powdered)', quantity: '2', unit: 'tbsp', allergenFlag: 'gluten' },
      { name: 'Hot water', quantity: '6', unit: 'tbsp' },
    ],
    steps: [
      'Dry-roast dalia at home until lightly golden. Cool and blend to a smooth powder.',
      'On the go: mix 2 tbsp powder with 6 tbsp hot water. Stir until creamy and soft.',
    ],
    stepTips: { 0: 'Roasting at home removes raw smell and makes it faster to cook on the go.' },
    packingTips: ['Store powder in an airtight container. Lasts 2–3 weeks.'],
    tags: ['instant', 'no_fridge', 'just_add_water', 'wheat'],
  },

  // ── 🍌 No-Prep Fruits ──────────────────────────────────────────────────────
  {
    id: 'tr_banana',
    title: 'Banana',
    subtitle: 'Peel & mash — the ultimate travel food',
    category: 'no_prep_fruit',
    travelTypes: ['flight_short', 'flight_long', 'train', 'road_trip', 'vacation'],
    prepLocation: 'on_the_go',
    prepTimeMinutes: 1,
    ageMinMonths: 6, ageMaxMonths: 24, stageBadge: '🍼 6m+',
    roomTempHours: 4, insulatedBagHours: 6, thermosHours: 0,
    requiresRefrigeration: false,
    gearRequired: ['none'],
    allergenContains: [],
    goldenRuleFlag: false,
    nutritionHighlights: ['energy', 'potassium', 'easy_digest'],
    ingredients: [
      { name: 'Ripe banana', quantity: '1', unit: 'nos', notes: 'Choose a fully ripe one — easier to mash' },
    ],
    steps: [
      'Peel and mash with a spoon directly in the peel for minimal mess, or in a small bowl.',
      'For older babies (8m+): offer as soft finger-food slices.',
    ],
    stepTips: {},
    packingTips: ['Keep the peel on until just before feeding. The peel is nature\'s packaging.'],
    tags: ['no_prep', 'no_fridge', 'allergen_free', 'finger_food'],
  },
  {
    id: 'tr_mango_aamras',
    title: 'Mango (Aamras)',
    subtitle: 'Squeeze pulp from a ripe mango — no tools needed',
    category: 'no_prep_fruit',
    travelTypes: ['road_trip', 'vacation', 'train'],
    prepLocation: 'on_the_go',
    prepTimeMinutes: 2,
    ageMinMonths: 7, ageMaxMonths: 24, stageBadge: '🍼 7m+',
    roomTempHours: 2, insulatedBagHours: 4, thermosHours: 0,
    requiresRefrigeration: false,
    gearRequired: ['none'],
    storageNotes: 'Seasonal — best May to July. Once opened, feed within 2 hrs.',
    allergenContains: [],
    goldenRuleFlag: true,
    nutritionHighlights: ['vitamin_c', 'vitamin_a', 'energy'],
    ingredients: [
      { name: 'Ripe Alphonso or Kesar mango', quantity: '1', unit: 'nos' },
    ],
    steps: [
      'Soften the mango by gently rolling it between your palms.',
      'Cut a small opening at the tip and squeeze the pulp out directly. Feed with a spoon.',
    ],
    stepTips: {},
    packingTips: ['Carry in a cloth bag — bruises easily but the peel protects the pulp.', 'Messy but worth it!'],
    tags: ['no_prep', 'no_fridge', 'allergen_free', 'seasonal'],
  },
  {
    id: 'tr_custard_apple',
    title: 'Custard Apple (Sitaphal)',
    subtitle: 'Break open, remove seeds, feed the creamy flesh',
    category: 'no_prep_fruit',
    travelTypes: ['road_trip', 'vacation'],
    prepLocation: 'on_the_go',
    prepTimeMinutes: 3,
    ageMinMonths: 8, ageMaxMonths: 24, stageBadge: '🍼 8m+',
    roomTempHours: 2, insulatedBagHours: 3, thermosHours: 0,
    requiresRefrigeration: false,
    gearRequired: ['none'],
    allergenContains: [],
    goldenRuleFlag: true,
    nutritionHighlights: ['vitamin_c', 'calcium', 'natural_sweetness'],
    ingredients: [
      { name: 'Ripe sitaphal (custard apple)', quantity: '1', unit: 'nos' },
    ],
    steps: [
      'Break open the custard apple with your hands.',
      'Remove ALL seeds carefully before feeding — seeds are a choking hazard.',
      'Feed the creamy pulp directly with a spoon.',
    ],
    stepTips: { 1: 'Double-check for seeds — they can be hidden in the flesh. Safety first.' },
    packingTips: ['Choose a ripe one (slightly soft to touch). Remove seeds at a table, not on the move.'],
    tags: ['no_prep', 'no_fridge', 'allergen_free', 'seasonal'],
  },
  {
    id: 'tr_steamed_apple',
    title: 'Steamed Apple',
    subtitle: 'Steam at home, carry soft — stays good 24 hrs',
    category: 'no_prep_fruit',
    travelTypes: ['flight_short', 'flight_long', 'train', 'road_trip', 'vacation'],
    prepLocation: 'home_before_trip',
    prepTimeMinutes: 15,
    ageMinMonths: 6, ageMaxMonths: 12, stageBadge: '🍼 6m+',
    roomTempHours: 4, insulatedBagHours: 8, thermosHours: 0,
    requiresRefrigeration: false,
    gearRequired: ['airtight_container'],
    storageNotes: 'Stays soft and safe for ~24 hrs in an airtight container. In hot weather, keep in insulated bag.',
    allergenContains: [],
    goldenRuleFlag: false,
    nutritionHighlights: ['fiber_rich', 'vitamin_c', 'easy_digest'],
    ingredients: [
      { name: 'Fresh apple (peeled, cored)', quantity: '1', unit: 'nos' },
    ],
    steps: [
      'Peel, core and chop apple into pieces. Steam for 10–12 minutes until very soft.',
      'Cool completely. Store in an airtight container.',
      'At feeding time: mash with a spoon and feed.',
    ],
    stepTips: { 0: 'Over-steam slightly — mushy is better than firm for travel; no reheating needed.' },
    packingTips: ['Pack in a small airtight container. Works for 6-hour flights without any fridge.'],
    tags: ['no_fridge', 'allergen_free', 'prep_at_home', 'puree'],
  },

  // ── 🍪 Shelf-Stable Snacks ─────────────────────────────────────────────────
  {
    id: 'tr_makhana',
    title: 'Makhana (Fox Nuts)',
    subtitle: 'Roasted in ghee — melt-in-mouth, high in calcium',
    category: 'shelf_stable_snack',
    travelTypes: ['flight_short', 'flight_long', 'train', 'road_trip', 'vacation'],
    prepLocation: 'home_before_trip',
    prepTimeMinutes: 10,
    ageMinMonths: 8, ageMaxMonths: 24, stageBadge: '🍼 8m+',
    roomTempHours: 72, insulatedBagHours: 0, thermosHours: 0,
    requiresRefrigeration: false,
    gearRequired: ['airtight_container'],
    storageNotes: 'Stays crisp for 3–4 days in an airtight container at room temperature.',
    allergenContains: ['milk'],
    allergenNote: 'Roasted in ghee (clarified butter) — contains trace milk. Skip ghee or use coconut oil for dairy-free.',
    goldenRuleFlag: false,
    nutritionHighlights: ['calcium', 'protein_rich', 'low_sodium'],
    ingredients: [
      { name: 'Makhana (fox nuts)', quantity: '1', unit: 'cup' },
      { name: 'Ghee', quantity: '1', unit: 'tsp', allergenFlag: 'milk', substitute: 'Coconut oil' },
    ],
    steps: [
      'Heat ghee in a pan on low. Add makhana and roast gently for 5–7 minutes until crisp.',
      'Cool completely before storing in an airtight container.',
    ],
    stepTips: { 0: 'Low and slow — they go from pale to burnt quickly. Stir constantly.' },
    packingTips: ['Pack in a small zip-lock or container. Perfect finger food for 8m+ babies.'],
    tags: ['no_fridge', 'finger_food', 'shelf_stable', 'calcium'],
  },
  {
    id: 'tr_puffed_rice',
    title: 'Puffed Rice (Murmura)',
    subtitle: 'Plain, unsalted — light and easy to self-feed',
    category: 'shelf_stable_snack',
    travelTypes: ['flight_short', 'flight_long', 'train', 'road_trip', 'vacation'],
    prepLocation: 'on_the_go',
    prepTimeMinutes: 0,
    ageMinMonths: 8, ageMaxMonths: 24, stageBadge: '🍼 8m+',
    roomTempHours: 0, insulatedBagHours: 0, thermosHours: 0,
    requiresRefrigeration: false,
    gearRequired: ['none'],
    storageNotes: 'Shelf-stable indefinitely in sealed packaging.',
    allergenContains: [],
    goldenRuleFlag: false,
    nutritionHighlights: ['energy', 'easy_digest', 'low_sodium'],
    ingredients: [
      { name: 'Plain unsalted puffed rice (murmura)', quantity: '½', unit: 'cup', notes: 'Must be plain, no masala or salt' },
    ],
    steps: [
      'Offer plain, unsalted murmura directly as a snack.',
    ],
    stepTips: {},
    packingTips: ['Buy a small pack. Check label: no added salt, no masala, no flavouring.'],
    tags: ['no_fridge', 'allergen_free', 'finger_food', 'shelf_stable', 'zero_prep'],
  },
  {
    id: 'tr_dry_fruit_laddoo',
    title: 'Dry Fruit Laddoo',
    subtitle: 'Dates, nut powder & ghee — lasts 1–2 weeks',
    category: 'shelf_stable_snack',
    travelTypes: ['flight_short', 'flight_long', 'train', 'road_trip', 'vacation'],
    prepLocation: 'home_before_trip',
    prepTimeMinutes: 20,
    ageMinMonths: 10, ageMaxMonths: 24, stageBadge: '🍼 10m+',
    roomTempHours: 336, insulatedBagHours: 0, thermosHours: 0,
    requiresRefrigeration: false,
    gearRequired: ['airtight_container'],
    storageNotes: 'Lasts 1–2 weeks at room temperature. Keep away from direct sunlight.',
    allergenContains: ['tree_nuts', 'milk'],
    allergenNote: 'Contains tree nuts and ghee (milk). Skip nuts for nut-allergic babies.',
    goldenRuleFlag: false,
    nutritionHighlights: ['iron_rich', 'energy', 'healthy_fats', 'calcium'],
    ingredients: [
      { name: 'Dates (pitted)', quantity: '10', unit: 'nos' },
      { name: 'Mixed nut powder (almond + cashew)', quantity: '3', unit: 'tbsp', allergenFlag: 'tree_nuts' },
      { name: 'Ghee', quantity: '1', unit: 'tsp', allergenFlag: 'milk', substitute: 'Coconut oil' },
    ],
    steps: [
      'Blend dates into a sticky paste. Mix in nut powder.',
      'Add a small amount of ghee to bind. Roll into small balls.',
      'Refrigerate overnight to set. Carry at room temperature for up to 2 weeks.',
    ],
    stepTips: { 1: 'Make small, age-appropriate portions — a ball the size of a grape is plenty.' },
    packingTips: ['Pack in an airtight box. A great energy snack for long journeys.'],
    tags: ['no_fridge', 'high_energy', 'shelf_stable', 'iron'],
  },
  {
    id: 'tr_ragi_cookies',
    title: 'Ragi Cookies',
    subtitle: 'No sugar, no salt — soft-baked for easy gumming',
    category: 'shelf_stable_snack',
    travelTypes: ['flight_short', 'flight_long', 'train', 'road_trip', 'vacation'],
    prepLocation: 'home_before_trip',
    prepTimeMinutes: 30,
    ageMinMonths: 8, ageMaxMonths: 24, stageBadge: '🍼 8m+',
    roomTempHours: 72, insulatedBagHours: 0, thermosHours: 0,
    requiresRefrigeration: false,
    gearRequired: ['airtight_container'],
    storageNotes: 'Stays good for 3 days at room temperature. Can refrigerate up to a week.',
    allergenContains: ['milk'],
    allergenNote: 'Made with ghee (trace milk). Use coconut oil to make dairy-free.',
    goldenRuleFlag: false,
    nutritionHighlights: ['iron_rich', 'calcium', 'fiber_rich'],
    ingredients: [
      { name: 'Ragi flour', quantity: '4', unit: 'tbsp' },
      { name: 'Ripe banana', quantity: '½', unit: 'nos', notes: 'Mashed — natural sweetener' },
      { name: 'Ghee', quantity: '1', unit: 'tsp', allergenFlag: 'milk', substitute: 'Coconut oil' },
    ],
    steps: [
      'Mash banana well. Mix in ragi flour and ghee to form a soft dough.',
      'Shape into small round cookies. Bake at 160°C for 12–15 minutes until just firm.',
      'Cool completely before packing — they crisp up as they cool.',
    ],
    stepTips: { 1: 'Soft-baked is the goal — overbaking makes them hard for young gums.' },
    packingTips: ['Stack in an airtight box. 3–4 cookies is a good snack portion.'],
    tags: ['no_fridge', 'finger_food', 'shelf_stable', 'iron', 'ragi', 'baked'],
  },

  // ── 🥛 Ready-to-Eat ────────────────────────────────────────────────────────
  {
    id: 'tr_curd_cup',
    title: 'Curd / Yogurt Cup',
    subtitle: 'Small sealed cups — probiotic goodness for hours',
    category: 'ready_to_eat',
    travelTypes: ['flight_short', 'train', 'road_trip'],
    prepLocation: 'on_the_go',
    prepTimeMinutes: 0,
    ageMinMonths: 8, ageMaxMonths: 24, stageBadge: '🍼 8m+',
    roomTempHours: 2, insulatedBagHours: 4, thermosHours: 0,
    requiresRefrigeration: true,
    gearRequired: ['insulated_bag'],
    storageNotes: 'Carry in insulated bag. Safe for up to 4 hrs if kept cold. Discard if warmed.',
    allergenContains: ['milk'],
    allergenNote: 'Dairy product. Not suitable for milk-allergic babies.',
    goldenRuleFlag: false,
    nutritionHighlights: ['protein_rich', 'calcium', 'probiotic'],
    ingredients: [
      { name: 'Plain full-fat curd / yogurt (sealed cup)', quantity: '1', unit: 'small cup', allergenFlag: 'milk' },
    ],
    steps: [
      'Carry sealed cups in an insulated bag with an ice pack.',
      'Open just before feeding. Do not re-seal and carry after opening.',
    ],
    stepTips: {},
    packingTips: ['Check expiry date before packing. Discard any cup that looks puffed or swollen.'],
    tags: ['ready_to_eat', 'keep_cool', 'probiotic', 'calcium'],
  },
  {
    id: 'tr_baby_pouch',
    title: 'Organic Baby Pouch',
    subtitle: 'Fruit or veggie puree pouches — no spoon needed',
    category: 'ready_to_eat',
    travelTypes: ['flight_short', 'flight_long', 'train', 'road_trip', 'vacation'],
    prepLocation: 'on_the_go',
    prepTimeMinutes: 0,
    ageMinMonths: 6, ageMaxMonths: 12, stageBadge: '🍼 6m+',
    roomTempHours: 0, insulatedBagHours: 0, thermosHours: 0,
    requiresRefrigeration: false,
    gearRequired: ['none'],
    storageNotes: 'Shelf-stable until opened. Once opened, must be consumed immediately.',
    allergenContains: [],
    allergenNote: 'Allergens vary by brand — check label carefully.',
    goldenRuleFlag: true,
    nutritionHighlights: ['vitamin_c', 'easy_digest'],
    ingredients: [
      { name: 'Organic baby puree pouch (trusted brand)', quantity: '1', unit: 'pouch', notes: 'Check ingredients and expiry before packing' },
    ],
    steps: [
      'Open the cap and feed directly — no spoon or bowl needed.',
      'Do not save unused portions. Discard opened pouch immediately.',
    ],
    stepTips: {},
    packingTips: ['Check ingredients for any allergens. Always check expiry date before travel.'],
    tags: ['ready_to_eat', 'no_fridge', 'no_prep', 'zero_mess'],
  },
  {
    id: 'tr_cheese_cubes',
    title: 'Cheese Cubes',
    subtitle: 'Mild cheese in safe bite-sized portions',
    category: 'ready_to_eat',
    travelTypes: ['flight_short', 'train', 'road_trip'],
    prepLocation: 'home_before_trip',
    prepTimeMinutes: 5,
    ageMinMonths: 10, ageMaxMonths: 24, stageBadge: '🍼 10m+',
    roomTempHours: 2, insulatedBagHours: 4, thermosHours: 0,
    requiresRefrigeration: true,
    gearRequired: ['insulated_bag'],
    storageNotes: 'Keep in insulated bag. Safe for 3–4 hours without refrigeration.',
    allergenContains: ['milk'],
    allergenNote: 'Dairy product. Not suitable for milk-allergic babies.',
    goldenRuleFlag: false,
    nutritionHighlights: ['calcium', 'protein_rich', 'healthy_fats'],
    ingredients: [
      { name: 'Mild cheese (cheddar or mozzarella)', quantity: '30', unit: 'g', allergenFlag: 'milk' },
    ],
    steps: [
      'Cut cheese into small, age-appropriate cubes (roughly 1cm × 1cm).',
      'Store in a small airtight container in an insulated bag.',
    ],
    stepTips: { 0: 'Size check: each piece should be soft enough to squish between your fingers.' },
    packingTips: ['Use a small airtight container. Keep in insulated bag with an ice pack.'],
    tags: ['ready_to_eat', 'keep_cool', 'finger_food', 'calcium'],
  },

  // ── 🍱 Packed Meals from Home ──────────────────────────────────────────────
  {
    id: 'tr_idli',
    title: 'Idli',
    subtitle: 'Soft rice cakes — carry sambar in thermos, dip & feed',
    category: 'packed_home_meal',
    travelTypes: ['flight_long', 'train', 'road_trip', 'vacation'],
    prepLocation: 'home_before_trip',
    prepTimeMinutes: 30,
    ageMinMonths: 7, ageMaxMonths: 24, stageBadge: '🍼 7m+',
    roomTempHours: 6, insulatedBagHours: 10, thermosHours: 0,
    requiresRefrigeration: false,
    gearRequired: ['airtight_container', 'vacuum_flask_thermos'],
    storageNotes: 'Idlis travel well for 8–10 hrs. Carry sambar separately in thermos.',
    allergenContains: [],
    goldenRuleFlag: false,
    nutritionHighlights: ['protein_rich', 'easy_digest', 'fermented'],
    ingredients: [
      { name: 'Idli (steamed)', quantity: '3–4', unit: 'nos' },
      { name: 'Mild sambar (thinned)', quantity: '½', unit: 'cup' },
    ],
    steps: [
      'Steam fresh idlis at home. Pack in an airtight container while slightly warm.',
      'Heat sambar separately. Pour into a preheated vacuum flask.',
      'At feeding: dip idli in sambar, mash slightly and feed.',
    ],
    stepTips: { 1: 'Preheat thermos with boiling water for 5 minutes before filling — adds 2+ hours of heat retention.' },
    packingTips: ['Idlis should be slightly warm when packed — they firm up as they cool.', 'Avoid rice with hard centre on travel day.'],
    tags: ['home_cooked', 'no_fridge', 'south_indian', 'soft_texture', 'thermos'],
  },
  {
    id: 'tr_khichdi_thermos',
    title: 'Khichdi in Thermos',
    subtitle: 'Hot, filling — stays warm 6–8 hrs in a vacuum flask',
    category: 'packed_home_meal',
    travelTypes: ['flight_long', 'train', 'road_trip', 'vacation'],
    prepLocation: 'home_before_trip',
    prepTimeMinutes: 20,
    ageMinMonths: 8, ageMaxMonths: 24, stageBadge: '🍼 8m+',
    roomTempHours: 2, insulatedBagHours: 4, thermosHours: 8,
    requiresRefrigeration: false,
    gearRequired: ['vacuum_flask_thermos'],
    storageNotes: 'Fill thermos to the brim — airspace speeds cooling. Preheat thermos with boiling water first.',
    allergenContains: ['milk'],
    allergenNote: 'Ghee is clarified butter — trace milk proteins remain. Substitute with coconut oil for dairy-free.',
    goldenRuleFlag: false,
    nutritionHighlights: ['protein_rich', 'iron_rich', 'easy_digest'],
    ingredients: [
      { name: 'Rice', quantity: '3', unit: 'tbsp', notes: 'Washed and soaked 20 min' },
      { name: 'Moong dal (yellow, split)', quantity: '1', unit: 'tbsp' },
      { name: 'Ghee', quantity: '1', unit: 'tsp', allergenFlag: 'milk', substitute: 'Coconut oil' },
      { name: 'Water', quantity: '1', unit: 'cup' },
    ],
    steps: [
      'Pressure cook rice and dal with 1 cup water for 4–5 whistles until very soft.',
      'Mash to a smooth consistency.',
      'Preheat thermos: fill with boiling water for 5 minutes, then empty.',
      'Stir ghee into khichdi. Pour into preheated thermos immediately. Seal tight.',
    ],
    stepTips: {
      2: 'A preheated thermos keeps food warm 2 hours longer.',
      3: 'Fill to the brim — no airspace = stays hotter longer.',
    },
    packingTips: [
      'Pack a small folding silicone bib — khichdi is sticky.',
      'Carry a separate small spoon in a zip-lock bag.',
      'Label thermos with pack time to track the 8-hr window.',
    ],
    tags: ['thermos', 'no_fridge', 'protein', 'iron', 'indian', 'savory', 'soft_texture'],
  },
  {
    id: 'tr_paratha_thepla',
    title: 'Paratha / Thepla',
    subtitle: 'Methi thepla stays freshest — tear, pair with curd',
    category: 'packed_home_meal',
    travelTypes: ['flight_long', 'train', 'road_trip', 'vacation'],
    prepLocation: 'home_before_trip',
    prepTimeMinutes: 30,
    ageMinMonths: 10, ageMaxMonths: 24, stageBadge: '🍼 10m+',
    roomTempHours: 8, insulatedBagHours: 12, thermosHours: 0,
    requiresRefrigeration: false,
    gearRequired: ['airtight_container'],
    storageNotes: 'Methi thepla stays fresh longest — up to 2 days at room temperature.',
    allergenContains: ['gluten', 'milk'],
    allergenNote: 'Wheat flour (gluten). Made with ghee (trace milk). Skip ghee for dairy-free.',
    goldenRuleFlag: false,
    nutritionHighlights: ['iron_rich', 'fiber_rich', 'energy'],
    ingredients: [
      { name: 'Wheat flour (atta)', quantity: '½', unit: 'cup', allergenFlag: 'gluten' },
      { name: 'Fresh methi (fenugreek) leaves', quantity: '¼', unit: 'cup' },
      { name: 'Ghee', quantity: '1', unit: 'tsp', allergenFlag: 'milk', substitute: 'Oil' },
    ],
    steps: [
      'Mix atta, chopped methi and a little ghee. Add water to make a soft dough.',
      'Roll into thin parathas. Cook on medium heat until golden on both sides.',
      'Cool completely before packing to avoid sogginess.',
    ],
    stepTips: { 2: 'Pack only after fully cooled — steam makes them soggy.' },
    packingTips: ['Wrap in foil then a clean cloth — stays soft longer.', 'Tear into small pieces at feeding time.'],
    tags: ['home_cooked', 'no_fridge', 'shelf_stable', 'gujarati', 'wheat'],
  },
  {
    id: 'tr_upma_poha',
    title: 'Upma / Poha',
    subtitle: 'Best eaten within 4–5 hrs — pack hot in insulated box',
    category: 'packed_home_meal',
    travelTypes: ['train', 'road_trip'],
    prepLocation: 'home_before_trip',
    prepTimeMinutes: 15,
    ageMinMonths: 8, ageMaxMonths: 24, stageBadge: '🍼 8m+',
    roomTempHours: 3, insulatedBagHours: 5, thermosHours: 0,
    requiresRefrigeration: false,
    gearRequired: ['insulated_lunchbox'],
    storageNotes: 'Best eaten within 4–5 hrs. Pack in insulated container while still hot.',
    allergenContains: ['gluten'],
    allergenNote: 'Upma uses semolina (rava) — contains gluten. Use poha (flattened rice) for gluten-free.',
    goldenRuleFlag: false,
    nutritionHighlights: ['energy', 'iron_rich', 'easy_digest'],
    ingredients: [
      { name: 'Semolina (rava) or Poha', quantity: '⅓', unit: 'cup', allergenFlag: 'gluten', substitute: 'Poha for gluten-free' },
      { name: 'Mixed soft vegetables (carrot, peas)', quantity: '¼', unit: 'cup' },
      { name: 'Ghee / oil', quantity: '1', unit: 'tsp', allergenFlag: 'milk', substitute: 'Oil' },
    ],
    steps: [
      'Cook upma or poha with soft vegetables until very soft.',
      'Pack in an insulated container while piping hot.',
    ],
    stepTips: { 1: 'The hotter it goes in, the longer it stays warm.' },
    packingTips: ['Insulated box extends safe window to 4–5 hrs.', 'Avoid for flights — cools faster without heating option.'],
    tags: ['home_cooked', 'insulated_box', 'south_indian', 'soft_texture'],
  },
  {
    id: 'tr_curd_rice',
    title: 'Curd Rice',
    subtitle: 'Classic Indian travel food — cool, easy, no reheating',
    category: 'packed_home_meal',
    travelTypes: ['flight_long', 'train', 'road_trip', 'vacation'],
    prepLocation: 'home_before_trip',
    prepTimeMinutes: 20,
    ageMinMonths: 8, ageMaxMonths: 24, stageBadge: '🍼 8m+',
    roomTempHours: 3, insulatedBagHours: 5, thermosHours: 0,
    requiresRefrigeration: false,
    gearRequired: ['airtight_container', 'insulated_bag'],
    storageNotes: 'Keep in insulated bag. Safe at room temperature for 3 hrs.',
    allergenContains: ['milk'],
    allergenNote: 'Contains curd (dairy). Not suitable for milk-allergic babies.',
    goldenRuleFlag: false,
    nutritionHighlights: ['probiotic', 'easy_digest', 'cooling'],
    ingredients: [
      { name: 'Cooked rice', quantity: '½', unit: 'cup' },
      { name: 'Fresh curd (plain)', quantity: '3', unit: 'tbsp', allergenFlag: 'milk' },
      { name: 'Mild tempering (mustard seeds, curry leaf)', quantity: 'pinch', unit: 'optional' },
    ],
    steps: [
      'Mix cooled rice with curd until well combined.',
      'Add mild tempering if baby is used to it.',
      'Pack in an airtight container. Keep in insulated bag.',
    ],
    stepTips: {},
    packingTips: ['Keep in insulated bag with a small ice pack for 5-hr safety window.', 'Curd rice is India\'s original travel food for a reason.'],
    tags: ['home_cooked', 'no_reheating', 'probiotic', 'south_indian', 'cooling'],
  },

  // ── 🥞 Homemade Snacks ─────────────────────────────────────────────────────
  {
    id: 'tr_banana_pancake',
    title: 'Banana Pancake',
    subtitle: 'Ripe banana, oats & makhana — soft, sugar-free',
    category: 'homemade_snack',
    travelTypes: ['train', 'road_trip', 'vacation'],
    prepLocation: 'home_before_trip',
    prepTimeMinutes: 20,
    ageMinMonths: 8, ageMaxMonths: 24, stageBadge: '🍼 8m+',
    roomTempHours: 4, insulatedBagHours: 6, thermosHours: 0,
    requiresRefrigeration: false,
    gearRequired: ['airtight_container'],
    allergenContains: ['gluten'],
    allergenNote: 'Oats contain gluten. Use certified gluten-free oats if needed.',
    goldenRuleFlag: false,
    nutritionHighlights: ['energy', 'fiber_rich', 'calcium'],
    ingredients: [
      { name: 'Ripe banana', quantity: '1', unit: 'nos' },
      { name: 'Oats powder', quantity: '2', unit: 'tbsp', allergenFlag: 'gluten', substitute: 'Gluten-free oat flour' },
      { name: 'Foxnut (makhana) powder', quantity: '1', unit: 'tbsp' },
    ],
    steps: [
      'Mash banana thoroughly. Mix in oats powder and makhana powder to a soft batter.',
      'Cook small pancakes on a lightly greased pan until golden on both sides.',
      'Cool completely before packing.',
    ],
    stepTips: { 1: 'Small pancakes (5cm diameter) are the right size for little hands.' },
    packingTips: ['Stack with parchment between each pancake to prevent sticking.'],
    tags: ['home_cooked', 'no_fridge', 'finger_food', 'sugar_free', 'soft_texture'],
  },
  {
    id: 'tr_poha_balls',
    title: 'Poha Balls',
    subtitle: 'Poha, potato & beans — allergen-free, easy to eat',
    category: 'homemade_snack',
    travelTypes: ['train', 'road_trip', 'vacation'],
    prepLocation: 'home_before_trip',
    prepTimeMinutes: 25,
    ageMinMonths: 8, ageMaxMonths: 24, stageBadge: '🍼 8m+',
    roomTempHours: 4, insulatedBagHours: 6, thermosHours: 0,
    requiresRefrigeration: false,
    gearRequired: ['airtight_container'],
    allergenContains: [],
    goldenRuleFlag: false,
    nutritionHighlights: ['protein_rich', 'iron_rich', 'fiber_rich'],
    ingredients: [
      { name: 'Poha (flattened rice, softened)', quantity: '½', unit: 'cup' },
      { name: 'Boiled potato', quantity: '1', unit: 'medium' },
      { name: 'Boiled beans', quantity: '2', unit: 'tbsp' },
      { name: 'Cumin powder', quantity: 'pinch', unit: '' },
    ],
    steps: [
      'Soften poha in water for 3 minutes. Drain well.',
      'Mash boiled potato and beans. Mix with poha and a pinch of cumin powder.',
      'Roll into small balls. Lightly steam or pan-toast until firm.',
      'Cool completely before packing.',
    ],
    stepTips: { 2: 'Pan-toasting adds a slight crust that helps balls hold shape during travel.' },
    packingTips: ['Pack in a single layer in an airtight container.'],
    tags: ['home_cooked', 'no_fridge', 'allergen_free', 'finger_food', 'iron'],
  },
  {
    id: 'tr_veg_tikki',
    title: 'Veg Tikki',
    subtitle: 'Potato, chickpea & oats — shallow-fried in ghee',
    category: 'homemade_snack',
    travelTypes: ['train', 'road_trip', 'vacation'],
    prepLocation: 'home_before_trip',
    prepTimeMinutes: 30,
    ageMinMonths: 10, ageMaxMonths: 24, stageBadge: '🍼 10m+',
    roomTempHours: 4, insulatedBagHours: 6, thermosHours: 0,
    requiresRefrigeration: false,
    gearRequired: ['airtight_container'],
    allergenContains: ['gluten', 'milk'],
    allergenNote: 'Oats (gluten) and ghee (trace milk). Use oil and gluten-free oats for variants.',
    goldenRuleFlag: false,
    nutritionHighlights: ['protein_rich', 'iron_rich', 'fiber_rich'],
    ingredients: [
      { name: 'Boiled potato', quantity: '2', unit: 'medium' },
      { name: 'Oats powder', quantity: '2', unit: 'tbsp', allergenFlag: 'gluten', substitute: 'Gluten-free flour' },
      { name: 'Boiled chickpea', quantity: '2', unit: 'tbsp' },
      { name: 'Ghee / oil', quantity: '1', unit: 'tsp', allergenFlag: 'milk', substitute: 'Oil' },
    ],
    steps: [
      'Mash potato and chickpea together.',
      'Bind with oats powder. Shape into small patties (4–5cm).',
      'Shallow-fry in ghee on medium heat until golden on both sides.',
      'Cool completely before packing.',
    ],
    stepTips: { 2: 'A golden crust helps tikkis hold together in the container.' },
    packingTips: ['Pack upright in a box, not stacked, to preserve the crust.'],
    tags: ['home_cooked', 'no_fridge', 'finger_food', 'iron', 'protein'],
  },
  {
    id: 'tr_uttapam',
    title: 'Mini Uttapam',
    subtitle: 'Rice & lentil pancakes with soft veggies',
    category: 'homemade_snack',
    travelTypes: ['train', 'road_trip'],
    prepLocation: 'home_before_trip',
    prepTimeMinutes: 20,
    ageMinMonths: 8, ageMaxMonths: 24, stageBadge: '🍼 8m+',
    roomTempHours: 3, insulatedBagHours: 5, thermosHours: 0,
    requiresRefrigeration: false,
    gearRequired: ['airtight_container'],
    allergenContains: [],
    goldenRuleFlag: false,
    nutritionHighlights: ['protein_rich', 'fermented', 'easy_digest'],
    ingredients: [
      { name: 'Dosa / Idli batter (fermented)', quantity: '½', unit: 'cup' },
      { name: 'Finely grated carrot', quantity: '1', unit: 'tbsp' },
      { name: 'Finely chopped tomato (deseeded)', quantity: '1', unit: 'tsp' },
      { name: 'Oil for the pan', quantity: '½', unit: 'tsp' },
    ],
    steps: [
      'Pour a small ladle of batter on a hot pan. Sprinkle veggies on top.',
      'Cook on medium heat until the top sets. Flip and cook for 1 minute more.',
      'Make mini size (6cm) — easier to handle and pack.',
    ],
    stepTips: {},
    packingTips: ['Cool fully before stacking in a box. Pairs well with curd carried separately in an insulated bag.'],
    tags: ['home_cooked', 'no_fridge', 'allergen_free', 'finger_food', 'fermented'],
  },
];

// ─── Lookup map ───────────────────────────────────────────────────────────────
export const TRAVEL_RECIPE_BY_ID: Record<string, TravelRecipe> = Object.fromEntries(
  TRAVEL_RECIPES.map((r) => [r.id, r]),
);

// ─── Filter helpers ───────────────────────────────────────────────────────────
export function filterTravelRecipes(
  recipes: TravelRecipe[],
  opts: {
    ageMonths?: number;
    categories?: TravelCategory[];
    noFridge?: boolean;
    allergenFreeOf?: TravelAllergen[];
    travelType?: TravelType;
    maxRoomTempHours?: number;
  },
): TravelRecipe[] {
  return recipes.filter((r) => {
    if (opts.ageMonths !== undefined && opts.ageMonths < r.ageMinMonths) return false;
    if (opts.categories?.length && !opts.categories.includes(r.category)) return false;
    if (opts.noFridge && r.requiresRefrigeration) return false;
    if (opts.allergenFreeOf?.length) {
      const conflict = opts.allergenFreeOf.some((a) => r.allergenContains.includes(a));
      if (conflict) return false;
    }
    if (opts.travelType && !r.travelTypes.includes(opts.travelType)) return false;
    if (opts.maxRoomTempHours !== undefined && r.roomTempHours > 0 && r.roomTempHours < opts.maxRoomTempHours) return false;
    return true;
  });
}
