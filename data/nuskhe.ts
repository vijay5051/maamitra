// Dadi Maa ke Nuskhe — traditional Indian home remedies for common baby
// ailments. Source: in-app PDF "Dadima's Home Remedies Guide" curated by the
// MaaMitra editorial team. Each remedy is informational — the UI must show
// the disclaimer prominently and never replace pediatric advice.

import type { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

export interface Remedy {
  /** Stable id — used as React key. */
  id: string;
  /** Short remedy name shown as the card heading. */
  name: string;
  /** Comma-joined list of ingredients. */
  ingredients: string;
  /** Step-by-step method — single paragraph. */
  method: string;
  /** Safety / age note shown in highlighted footer. */
  note: string;
  /**
   * Minimum baby age in months this remedy is safe for. `-9` = pregnancy,
   * `0` = newborn-safe. Used to surface only age-appropriate cards by
   * default while still allowing the user to view all.
   */
  minAgeMonths: number;
}

export interface NuskheCategory {
  id: string;
  /** English title shown in the header. */
  title: string;
  /** Hindi gloss shown under the title (e.g. "Pet Dard / Gas"). */
  hindi: string;
  icon: IconName;
  /** Soft tint used as the category card background. */
  tint: string;
  /** Accent colour for icon + emphasis text. */
  accent: string;
  remedies: Remedy[];
}

export const NUSKHE_CATEGORIES: NuskheCategory[] = [
  {
    id: 'colic',
    title: 'Colic & Gas',
    hindi: 'Pet Dard / Gas',
    icon: 'flame-outline',
    tint: '#ECFDF5',
    accent: '#059669',
    remedies: [
      {
        id: 'colic-hing-paste',
        name: 'Hing Paste on Navel',
        ingredients: 'Hing (Asafoetida), warm water',
        method:
          "Mix a tiny pinch of hing with warm water to make a paste. Apply gently around (not inside) baby's navel in circular motion.",
        note: 'Always do a patch test first. Use only food-grade hing.',
        minAgeMonths: 0,
      },
      {
        id: 'colic-hing-water',
        name: 'Hing Water',
        ingredients: 'Hing, warm water',
        method:
          'Dissolve a tiny pinch of hing in 2 tbsp warm water. Give 1/2 tsp to baby after feeding.',
        note: 'For babies 6+ months only.',
        minAgeMonths: 6,
      },
      {
        id: 'colic-ajwain-potli',
        name: 'Ajwain Potli Massage',
        ingredients: 'Ajwain (carom seeds), muslin cloth',
        method:
          "Dry roast ajwain, tie in muslin cloth. When warm (not hot), gently press on baby's tummy in clockwise circles.",
        note: 'Test temperature on your wrist first.',
        minAgeMonths: 0,
      },
      {
        id: 'colic-gripe-water',
        name: 'Gripe Water (Homemade)',
        ingredients: 'Saunf (fennel), water',
        method:
          'Boil 1 tsp saunf in 1 cup water for 10 mins. Strain, cool, give 1 tsp to baby.',
        note: "Make fresh daily. Don't store.",
        minAgeMonths: 4,
      },
    ],
  },
  {
    id: 'cough-cold',
    title: 'Cough & Cold',
    hindi: 'Khansi / Sardi',
    icon: 'snow-outline',
    tint: '#EFF6FF',
    accent: '#2563EB',
    remedies: [
      {
        id: 'cold-mustard-garlic',
        name: 'Mustard Oil & Garlic Massage',
        ingredients: 'Mustard oil (sarson ka tel), 2-3 garlic cloves',
        method:
          "Heat oil with garlic until garlic turns brown. Cool to lukewarm. Massage on baby's chest, back, and soles of feet.",
        note: 'Cover feet with socks after massage. Best done before bath.',
        minAgeMonths: 0,
      },
      {
        id: 'cold-ajwain-garlic-potli',
        name: 'Ajwain & Garlic Potli',
        ingredients: 'Ajwain, garlic, muslin cloth',
        method:
          "Dry roast ajwain and crushed garlic. Tie in cloth. Place near baby's pillow or gently pat on chest.",
        note: 'The aroma helps clear congestion.',
        minAgeMonths: 0,
      },
      {
        id: 'cold-tulsi-honey',
        name: 'Tulsi & Honey Mix',
        ingredients: 'Tulsi (holy basil) leaves, honey (for 1+ year only)',
        method:
          'Extract juice from 4-5 tulsi leaves. Mix with 1/2 tsp honey. Give once daily.',
        note: 'NO honey for babies under 1 year! Use tulsi juice alone for younger babies.',
        minAgeMonths: 12,
      },
      {
        id: 'cold-steam',
        name: 'Steam Inhalation',
        ingredients: 'Hot water, ajwain or eucalyptus oil',
        method:
          'Add ajwain to hot water bowl. Hold baby safely away and let them breathe the steam. Or use a humidifier.',
        note: 'Never bring baby too close to hot water.',
        minAgeMonths: 0,
      },
      {
        id: 'cold-haldi-milk',
        name: 'Haldi Milk (Golden Milk)',
        ingredients: 'Warm milk, turmeric, ghee',
        method:
          'Add a tiny pinch of haldi and few drops of ghee to warm milk. Give at bedtime.',
        note: 'For babies 10+ months who have started milk.',
        minAgeMonths: 10,
      },
    ],
  },
  {
    id: 'teething',
    title: 'Teething Pain',
    hindi: 'Daant Nikalna',
    icon: 'happy-outline',
    tint: '#F5F3FF',
    accent: '#7C3AED',
    remedies: [
      {
        id: 'teeth-frozen-carrot',
        name: 'Frozen Carrot Stick',
        ingredients: 'Fresh carrot',
        method:
          'Wash and peel a thick carrot. Freeze for 1-2 hours. Let baby gnaw on it under supervision.',
        note: 'Use thick piece to prevent choking. Always supervise!',
        minAgeMonths: 6,
      },
      {
        id: 'teeth-cold-banana',
        name: 'Cold Banana',
        ingredients: 'Ripe banana',
        method:
          'Refrigerate (not freeze) a peeled banana. Let baby chew on it.',
        note: 'Soothes gums and provides nutrition.',
        minAgeMonths: 6,
      },
      {
        id: 'teeth-chamomile',
        name: 'Chamomile Tea Rub',
        ingredients: 'Chamomile tea bag',
        method:
          "Brew weak chamomile tea, cool completely. Dip clean finger and rub on baby's gums.",
        note: 'Chamomile has natural calming properties.',
        minAgeMonths: 4,
      },
      {
        id: 'teeth-cold-cloth',
        name: 'Cold Washcloth',
        ingredients: 'Clean muslin cloth',
        method:
          'Wet a clean cloth, wring out excess water, freeze for 30 mins. Let baby chew on it.',
        note: 'Simple and effective!',
        minAgeMonths: 4,
      },
      {
        id: 'teeth-clove-oil',
        name: 'Clove Oil (Diluted)',
        ingredients: 'Clove oil, coconut oil',
        method:
          'Mix 1 drop clove oil with 1 tbsp coconut oil. Apply tiny amount on gums with clean finger.',
        note: 'Use very sparingly — clove oil is strong.',
        minAgeMonths: 6,
      },
    ],
  },
  {
    id: 'constipation',
    title: 'Constipation',
    hindi: 'Kabz',
    icon: 'sad-outline',
    tint: '#FFF7ED',
    accent: '#EA580C',
    remedies: [
      {
        id: 'cons-prune-water',
        name: 'Prune/Date Water',
        ingredients: '2-3 prunes or dates, water',
        method:
          'Soak prunes/dates overnight in water. Mash and strain. Give 1-2 tsp of this water.',
        note: 'Works as natural stool softener.',
        minAgeMonths: 6,
      },
      {
        id: 'cons-ghee',
        name: 'Ghee in Food',
        ingredients: 'Pure desi ghee',
        method:
          "Add 1/2 tsp ghee to baby's dal, khichdi, or porridge.",
        note: 'Ghee lubricates the digestive system naturally.',
        minAgeMonths: 6,
      },
      {
        id: 'cons-tummy-massage',
        name: 'Tummy Massage',
        ingredients: 'Warm coconut/olive oil',
        method:
          "Massage baby's tummy in clockwise circular motions with warm oil. Follow with cycling leg movements.",
        note: 'Do this 2-3 times a day.',
        minAgeMonths: 0,
      },
      {
        id: 'cons-papaya',
        name: 'Papaya Puree',
        ingredients: 'Ripe papaya',
        method: 'Give 1-2 tbsp of fresh ripe papaya puree.',
        note: 'Papaya has natural digestive enzymes.',
        minAgeMonths: 8,
      },
      {
        id: 'cons-warm-water',
        name: 'Warm Water',
        ingredients: 'Lukewarm water',
        method: 'Give sips of lukewarm water between feeds.',
        note: 'For 6+ months only. Helps keep stools soft.',
        minAgeMonths: 6,
      },
    ],
  },
  {
    id: 'diaper-rash',
    title: 'Diaper Rash',
    hindi: 'Rashes',
    icon: 'water-outline',
    tint: '#FFF1F2',
    accent: '#E11D48',
    remedies: [
      {
        id: 'rash-coconut-oil',
        name: 'Coconut Oil',
        ingredients: 'Pure virgin coconut oil',
        method: 'Clean and dry the area. Apply thin layer of coconut oil.',
        note: 'Natural antibacterial and moisturizing.',
        minAgeMonths: 0,
      },
      {
        id: 'rash-ghee',
        name: 'Ghee Application',
        ingredients: 'Desi ghee',
        method: 'Apply thin layer of room-temperature ghee on rash.',
        note: 'Creates protective barrier and heals skin.',
        minAgeMonths: 0,
      },
      {
        id: 'rash-besan',
        name: 'Besan (Gram Flour) Powder',
        ingredients: 'Besan, clean cloth',
        method:
          'Dry roast besan until slightly brown. Cool completely. Apply as natural powder on dry rash.',
        note: 'Absorbs moisture and prevents friction.',
        minAgeMonths: 0,
      },
      {
        id: 'rash-neem-water',
        name: 'Neem Water Wash',
        ingredients: 'Neem leaves, water',
        method:
          'Boil neem leaves in water for 10 mins. Cool, strain. Use this water to clean diaper area.',
        note: 'Neem is naturally antibacterial.',
        minAgeMonths: 0,
      },
      {
        id: 'rash-air-time',
        name: 'Air Time',
        ingredients: 'None',
        method: 'Let baby go diaper-free for 15-20 mins several times a day.',
        note: 'Fresh air is the best healer for rashes!',
        minAgeMonths: 0,
      },
    ],
  },
  {
    id: 'fever',
    title: 'Fever',
    hindi: 'Bukhar',
    icon: 'thermometer-outline',
    tint: '#FEF2F2',
    accent: '#DC2626',
    remedies: [
      {
        id: 'fever-sponge',
        name: 'Sponge Bath',
        ingredients: 'Lukewarm water, soft cloth',
        method:
          "Dip cloth in lukewarm (not cold) water. Gently sponge baby's forehead, armpits, and feet.",
        note: 'Never use cold water — it can cause shivering and raise the fever.',
        minAgeMonths: 0,
      },
      {
        id: 'fever-onion',
        name: 'Onion in Socks',
        ingredients: 'Raw onion slices',
        method:
          "Place thin onion slices on soles of baby's feet, cover with socks. Keep overnight.",
        note: 'Traditional remedy believed to draw out fever.',
        minAgeMonths: 6,
      },
      {
        id: 'fever-tulsi',
        name: 'Tulsi Water',
        ingredients: 'Tulsi leaves, water',
        method:
          'Boil 5-6 tulsi leaves in 1 cup water. Cool, strain. Give 1 tsp every few hours.',
        note: 'For babies 6+ months. Natural immunity booster.',
        minAgeMonths: 6,
      },
      {
        id: 'fever-hydrate',
        name: 'Keep Hydrated',
        ingredients: 'Breastmilk/formula, water',
        method:
          'Offer frequent feeds. For 6+ months, offer sips of water and ORS if needed.',
        note: 'Hydration is crucial during fever.',
        minAgeMonths: 0,
      },
    ],
  },
  {
    id: 'sleep',
    title: 'Sleep Issues',
    hindi: 'Neend Ki Samasya',
    icon: 'moon-outline',
    tint: '#F5F3FF',
    accent: '#6D28D9',
    remedies: [
      {
        id: 'sleep-oil-massage',
        name: 'Warm Oil Massage',
        ingredients: 'Warm coconut/almond oil',
        method:
          'Give gentle full body massage with warm oil before bath time. Focus on head and feet.',
        note: 'Creates a calming bedtime routine.',
        minAgeMonths: 0,
      },
      {
        id: 'sleep-khus-khus',
        name: 'Poppy Seed Paste (Khus Khus)',
        ingredients: 'Khus khus (poppy seeds), milk',
        method:
          'Soak 1/2 tsp khus khus for 2 hours. Grind with little milk. Give tiny amount before sleep.',
        note: 'For babies 8+ months. Use very sparingly!',
        minAgeMonths: 8,
      },
      {
        id: 'sleep-saunf',
        name: 'Saunf Water',
        ingredients: 'Saunf (fennel seeds), water',
        method:
          'Boil 1/2 tsp saunf in water. Cool, strain. Give 1-2 tsp before bedtime.',
        note: 'Aids digestion and promotes calm.',
        minAgeMonths: 4,
      },
      {
        id: 'sleep-banana',
        name: 'Banana Before Bed',
        ingredients: 'Ripe banana',
        method: 'Give mashed banana as part of dinner.',
        note: 'Banana contains natural sleep-promoting compounds.',
        minAgeMonths: 6,
      },
    ],
  },
  {
    id: 'vomiting',
    title: 'Vomiting & Nausea',
    hindi: 'Ulti',
    icon: 'alert-circle-outline',
    tint: '#ECFDF5',
    accent: '#10B981',
    remedies: [
      {
        id: 'vomit-ginger',
        name: 'Ginger Water',
        ingredients: 'Fresh ginger, water',
        method:
          'Boil tiny piece of ginger in water. Cool, strain. Give 1/2 tsp at a time.',
        note: 'For babies 8+ months. Ginger settles the stomach.',
        minAgeMonths: 8,
      },
      {
        id: 'vomit-jeera',
        name: 'Cumin Water (Jeera Pani)',
        ingredients: 'Jeera (cumin), water',
        method:
          'Boil 1/2 tsp jeera in 1 cup water. Cool, strain. Give in small sips.',
        note: 'Helps with digestion and nausea.',
        minAgeMonths: 6,
      },
      {
        id: 'vomit-small-feeds',
        name: 'Small Frequent Feeds',
        ingredients: 'Breastmilk/formula',
        method:
          'Instead of large feeds, give small amounts more frequently.',
        note: 'Prevents overwhelming the stomach.',
        minAgeMonths: 0,
      },
      {
        id: 'vomit-rice-water',
        name: 'Rice Water',
        ingredients: 'Rice, water',
        method:
          'Boil rice in excess water. Strain and cool. Give this starchy water in sips.',
        note: 'Easy to digest and provides energy.',
        minAgeMonths: 6,
      },
    ],
  },
  {
    id: 'blocked-nose',
    title: 'Blocked Nose',
    hindi: 'Band Naak',
    icon: 'cloud-outline',
    tint: '#ECFEFF',
    accent: '#0891B2',
    remedies: [
      {
        id: 'nose-saline',
        name: 'Saline Drops (Homemade)',
        ingredients: 'Salt, clean water',
        method:
          'Mix 1/4 tsp salt in 1 cup boiled & cooled water. Put 1-2 drops in each nostril.',
        note: 'Make fresh daily. Use before feeds.',
        minAgeMonths: 0,
      },
      {
        id: 'nose-eucalyptus',
        name: 'Eucalyptus Oil Near Bed',
        ingredients: 'Eucalyptus oil, cotton ball',
        method:
          "Put 2-3 drops on cotton ball. Place near baby's bed (not on baby).",
        note: 'Vapors help clear congestion.',
        minAgeMonths: 3,
      },
      {
        id: 'nose-elevate',
        name: 'Elevate Head',
        ingredients: 'Folded towel/blanket',
        method:
          "Place folded towel under mattress to slightly elevate baby's head while sleeping.",
        note: 'Helps mucus drain naturally.',
        minAgeMonths: 0,
      },
      {
        id: 'nose-breast-milk',
        name: 'Breast Milk Drops',
        ingredients: 'Fresh breast milk',
        method: 'Put 1-2 drops of breast milk in each nostril.',
        note: 'Breast milk has natural antibodies!',
        minAgeMonths: 0,
      },
    ],
  },
  {
    id: 'immunity',
    title: 'Immunity Boosters',
    hindi: 'Rog Pratirodhak',
    icon: 'shield-checkmark-outline',
    tint: '#F0FDF4',
    accent: '#16A34A',
    remedies: [
      {
        id: 'imm-haldi',
        name: 'Daily Haldi in Food',
        ingredients: 'Turmeric powder',
        method: "Add a tiny pinch of haldi to baby's dal, khichdi, or milk.",
        note: 'Natural anti-inflammatory and immunity booster.',
        minAgeMonths: 6,
      },
      {
        id: 'imm-chyawanprash',
        name: 'Chyawanprash (Modified)',
        ingredients: 'Baby-safe Chyawanprash',
        method:
          'Give pea-sized amount mixed in warm milk. For babies 1+ year only.',
        note: 'Check with pediatrician first.',
        minAgeMonths: 12,
      },
      {
        id: 'imm-dry-fruit',
        name: 'Dry Fruit Powder',
        ingredients: 'Almonds, cashews, dates',
        method:
          'Powder equal amounts. Add 1/2 tsp to milk or porridge daily.',
        note: 'Rich in nutrients and energy.',
        minAgeMonths: 8,
      },
      {
        id: 'imm-tulsi-haldi',
        name: 'Tulsi & Haldi Drops',
        ingredients: 'Tulsi juice, haldi, ghee',
        method:
          'Mix 2-3 drops tulsi juice + pinch haldi + drop of ghee. Give once daily.',
        note: 'Traditional immunity kadha for babies 8+ months.',
        minAgeMonths: 8,
      },
    ],
  },
];

/** Total remedy count — used in the empty/header copy. */
export const TOTAL_NUSKHE_COUNT = NUSKHE_CATEGORIES.reduce(
  (sum, cat) => sum + cat.remedies.length,
  0,
);
