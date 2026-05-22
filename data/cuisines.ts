// 10 cuisines for the 1 yr+ Tiffin & Family Meals feature.
// Tints are background colors for cuisine-tinted icon cards (V1) and the
// cuisine chip on recipe cards. Picked from the brand palette
// (dusty lavender + warm cream + blush + sage + ochre) — see
// constants/theme.ts and the existing FOOD_CATEGORIES tints in babyFoods.ts.

export type Cuisine =
  | 'north-indian'
  | 'south-indian'
  | 'gujarati'
  | 'bengali'
  | 'rajasthani'
  | 'maharashtrian'
  | 'punjabi'
  | 'kashmiri'
  | 'northeast'
  | 'continental';

export interface CuisineInfo {
  id: Cuisine;
  label: string;
  icon: string;   // Ionicons name
  tint: string;   // background color for tinted icon card
}

export const CUISINES: CuisineInfo[] = [
  { id: 'north-indian',   label: 'N. Indian',      icon: 'flame-outline',      tint: '#FED7AA' },
  { id: 'south-indian',   label: 'S. Indian',      icon: 'leaf-outline',       tint: '#DCFCE7' },
  { id: 'gujarati',       label: 'Gujarati',       icon: 'restaurant-outline', tint: '#FEF3C7' },
  { id: 'bengali',        label: 'Bengali',        icon: 'fish-outline',       tint: '#F9E4E0' },
  { id: 'rajasthani',     label: 'Rajasthani',     icon: 'sparkles-outline',   tint: '#FFE4E6' },
  { id: 'maharashtrian',  label: 'Maharashtrian',  icon: 'cafe-outline',       tint: '#FED7AA' },
  { id: 'punjabi',        label: 'Punjabi',        icon: 'pizza-outline',      tint: '#FEF3C7' },
  { id: 'kashmiri',       label: 'Kashmiri',       icon: 'snow-outline',       tint: '#DBEAFE' },
  { id: 'northeast',      label: 'NE Indian',      icon: 'flower-outline',     tint: '#EDE9FE' },
  { id: 'continental',    label: 'Continental',    icon: 'globe-outline',      tint: '#E0F2FE' },
];

export const CUISINE_BY_ID: Record<Cuisine, CuisineInfo> = CUISINES.reduce(
  (acc, c) => ({ ...acc, [c.id]: c }),
  {} as Record<Cuisine, CuisineInfo>,
);
