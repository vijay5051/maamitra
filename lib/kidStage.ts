// Age-stage rules shared across Health, Home, Wellness and copy.
// One place for every "only show X until age Y" cut-off so the Health
// grid, deep links and Home cards can't drift apart.

/** From 12 months a child is no longer a "baby" in app copy. */
export const TODDLER_FROM_MONTHS = 12;
/** From 36 months we say "child" instead of "toddler". */
export const CHILD_FROM_MONTHS = 36;
/** Diaper & sleep log stops being useful once the child turns 2. */
export const ROUTINE_MAX_MONTHS = 24;
/** Travel Meals recipes are written for kids up to 1.5 years. */
export const TRAVEL_MEALS_MAX_MONTHS = 18;
/** From 5 years the teeth tracker switches to milk-teeth-falling-out mode. */
export const BIG_KID_TEETH_FROM_MONTHS = 60;

export type KidNoun = 'baby' | 'toddler' | 'child';

/**
 * The right word for this child in UI copy. Unknown age (expecting / no
 * DOB) stays "baby" — that's the only stage it can be.
 */
export function kidNoun(ageMonths: number | null | undefined): KidNoun {
  if (ageMonths == null || ageMonths < TODDLER_FROM_MONTHS) return 'baby';
  if (ageMonths < CHILD_FROM_MONTHS) return 'toddler';
  return 'child';
}

/** "your baby" / "your toddler" / "your child". */
export function yourKid(ageMonths: number | null | undefined): string {
  return `your ${kidNoun(ageMonths)}`;
}

/** Diaper + sleep log is only offered to kids under 2 (or when age is unknown). */
export function showsRoutineTracker(ageMonths: number | null | undefined): boolean {
  return ageMonths == null || ageMonths < ROUTINE_MAX_MONTHS;
}

/** Travel Meals is only offered to kids under 1.5 years (or when age is unknown). */
export function showsTravelMeals(ageMonths: number | null | undefined): boolean {
  return ageMonths == null || ageMonths < TRAVEL_MEALS_MAX_MONTHS;
}

export function isBigKidTeeth(ageMonths: number | null | undefined): boolean {
  return ageMonths != null && ageMonths >= BIG_KID_TEETH_FROM_MONTHS;
}
