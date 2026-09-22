// Per-meal photos for the Travel Meals catalogue, keyed by recipe id.
// Source: The Little Traveller's Cookbook (one photo per meal card),
// resized to 480×480 webp. Required statically so Metro bundles them.
//
// tr_curd_cup, tr_khichdi_thermos and tr_veg_soup are drawings in the
// cookbook (no photo) — replace with real photos when available.

import type { ImageSourcePropType } from 'react-native';

export const TRAVEL_RECIPE_IMAGES: Record<string, ImageSourcePropType> = {
  tr_avocado: require('../assets/travel-meals/tr_avocado.webp'),
  tr_baby_pouch: require('../assets/travel-meals/tr_baby_pouch.webp'),
  tr_banana: require('../assets/travel-meals/tr_banana.webp'),
  tr_banana_chips: require('../assets/travel-meals/tr_banana_chips.webp'),
  tr_banana_pancake: require('../assets/travel-meals/tr_banana_pancake.webp'),
  tr_cerelac: require('../assets/travel-meals/tr_cerelac.webp'),
  tr_cheese_cubes: require('../assets/travel-meals/tr_cheese_cubes.webp'),
  tr_chikoo: require('../assets/travel-meals/tr_chikoo.webp'),
  tr_coconut_water: require('../assets/travel-meals/tr_coconut_water.webp'),
  tr_curd_cup: require('../assets/travel-meals/tr_curd_cup.webp'),
  tr_curd_rice: require('../assets/travel-meals/tr_curd_rice.webp'),
  tr_custard_apple: require('../assets/travel-meals/tr_custard_apple.webp'),
  tr_dalia: require('../assets/travel-meals/tr_dalia.webp'),
  tr_dry_fruit_laddoo: require('../assets/travel-meals/tr_dry_fruit_laddoo.webp'),
  tr_dry_fruit_powder: require('../assets/travel-meals/tr_dry_fruit_powder.webp'),
  tr_idli: require('../assets/travel-meals/tr_idli.webp'),
  tr_instant_oats: require('../assets/travel-meals/tr_instant_oats.webp'),
  tr_khichdi_thermos: require('../assets/travel-meals/tr_khichdi_thermos.webp'),
  tr_makhana: require('../assets/travel-meals/tr_makhana.webp'),
  tr_mango_aamras: require('../assets/travel-meals/tr_mango_aamras.webp'),
  tr_mashed_potato: require('../assets/travel-meals/tr_mashed_potato.webp'),
  tr_packaged_khichdi: require('../assets/travel-meals/tr_packaged_khichdi.webp'),
  tr_papaya: require('../assets/travel-meals/tr_papaya.webp'),
  tr_paratha_thepla: require('../assets/travel-meals/tr_paratha_thepla.webp'),
  tr_poha_balls: require('../assets/travel-meals/tr_poha_balls.webp'),
  tr_puffed_rice: require('../assets/travel-meals/tr_puffed_rice.webp'),
  tr_ragi_cookies: require('../assets/travel-meals/tr_ragi_cookies.webp'),
  tr_ragi_malt: require('../assets/travel-meals/tr_ragi_malt.webp'),
  tr_rice_cereal: require('../assets/travel-meals/tr_rice_cereal.webp'),
  tr_rice_ragi_puffs: require('../assets/travel-meals/tr_rice_ragi_puffs.webp'),
  tr_sathumaavu: require('../assets/travel-meals/tr_sathumaavu.webp'),
  tr_sprouted_moong: require('../assets/travel-meals/tr_sprouted_moong.webp'),
  tr_steamed_apple: require('../assets/travel-meals/tr_steamed_apple.webp'),
  tr_upma_poha: require('../assets/travel-meals/tr_upma_poha.webp'),
  tr_uttapam: require('../assets/travel-meals/tr_uttapam.webp'),
  tr_veg_soup: require('../assets/travel-meals/tr_veg_soup.webp'),
  tr_veg_tikki: require('../assets/travel-meals/tr_veg_tikki.webp'),
};

export function travelRecipeImage(id: string): ImageSourcePropType | undefined {
  return TRAVEL_RECIPE_IMAGES[id];
}
