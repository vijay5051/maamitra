// Daily affirmations for the home screen rotating card.
// Tone: warm, motherly, validating. Indian context lightly woven in.
// Surfaced one per day on Home (Phase C — daily affirmation feature).

// Age-neutral pool — safe for any age (pregnancy, infants, toddlers, kids).
// Product rule: never call a 1y+ child "baby", so nothing in here may.
const NEUTRAL_AFFIRMATIONS: readonly string[] = [
  'You are allowed to rest; love still fills the room.',
  'Some days, surviving gently is more than enough.',
  'You do not need perfect hands to hold beautifully.',
  'This slow, ordinary moment is part of mothering too.',
  'Your tiredness does not cancel your tenderness.',
  'A warm cup of chai and one deep breath count.',
  'You may miss your old self and still welcome this one.',
  'Your softness is strength, not something to outgrow.',
  'Even on weepy days, you are still a good mother.',
  'Small routines can hold a whole trembling heart together.',
  'Your little one does not need a performance, only your presence.',
  'It is okay if today feels longer than yesterday.',
  'Home can be messy and still full of care.',
  'You are not behind; motherhood is not a race.',
  'One calm minute is enough to begin again.',
  'Your body deserves kindness, not commentary.',
  'Some love arrives quietly, in folded clothes and midnight yawns.',
  'You are allowed to ask for help before you are desperate.',
  'Your child will not remember perfection, only comfort.',
  'There is wisdom in pausing before doing one more thing.',
  'You can be grateful and overwhelmed at the same time.',
  'Your worry is not weakness; it is love looking for a place.',
  'The house can wait; your breathing matters too.',
  'You are becoming, not failing.',
  'Dadi-level advice is optional; your instinct matters too.',
  'A gentle day is still a meaningful day.',
  'You are enough, even before the laundry is folded.',
  'Some nights are just nights, not signs of anything bigger.',
  'Your little one is not judging your hair, your home, or your timings.',
  'You are allowed to laugh in the middle of chaos.',
  'Rest is not laziness; it is repair.',
  'Your care counts, even when nobody praises it.',
  'This phase is asking a lot of you; be extra tender inwardly.',
  'You can love your child deeply and need a break badly.',
  'Your pace is human, and that is a beautiful pace.',
  'Today, being gentle with yourself is also mothering.',
  'You are exactly the mother your child needs today.',
  'Your body is not a problem to solve.',
  'Love sometimes sounds like shhh, beta, I’m here.',
  'You do not have to enjoy every moment to cherish this season.',
  'Some days, chai first is excellent parenting.',
  'Your little one needs warmth, not a perfectly curated routine.',
  'You are carrying more than others can always see.',
  'Even your uncertainty can be held with compassion.',
  'There is no prize for doing this the hardest way.',
  'Your presence in the room changes everything for your child.',
  'A quiet mother is still a loving mother.',
  'You may outgrow old expectations and still remain deeply rooted.',
  'Your child feels your care in a hundred tiny ways.',
  'It is okay if your heart feels full and fragile together.',
  'Ghar is also the feeling you create in your arms.',
  'You do not need to explain your exhaustion to deserve support.',
  'This too is part of love.',
  'Your little one will not mind if dinner is simple again.',
  'The messy bun is doing excellent emotional labor.',
  'You are not too sensitive; you are deeply awake to love.',
  'Healing can be slow and still be healing.',
  'Your worth is not measured by how much you manage silently.',
  'Some comfort comes in whispers, some in naps.',
  'You can begin this day again, even at 4 p.m.',
  'You are allowed to protect your peace like a precious thing.',
  'Beti or beta, your love is already making a home.',
  'You do not need bigger strength, only softer support.',
  'A hard day does not make you a hard mother.',
  'Your child is growing; so are you.',
  'There is love even in the undone corners of the house.',
  'You can trust yourself one small decision at a time.',
  'Your child does not need constant cheerfulness to feel cherished.',
  'The world can wait while you sit and cuddle longer.',
  'Motherhood can be beautiful and bewildering in the same afternoon.',
  'Your kindness to yourself will reach your child too.',
  'Some days, keeping everyone fed is the whole victory.',
  'You are allowed to be held while learning to hold.',
  'Tomorrow can be lighter, and today can still be enough.',
];

// Infant-specific lines — only shown when the child is < 12 months
// (or age is unknown, e.g. pregnancy).
export const BABY_AFFIRMATIONS: readonly string[] = [
  'Your baby knows your voice before the world does.',
  'Your body is doing sacred work, even when it feels awkward.',
  'You are learning your baby, and your baby is learning you.',
  'Love can look like feeding, burping, and sitting quietly.',
  'One burp, one nap, one breath at a time.',
  'The baby clothes are tiny; your effort is not.',
];

// Combined list (kept for backward compatibility).
export const AFFIRMATIONS: readonly string[] = [
  ...BABY_AFFIRMATIONS,
  ...NEUTRAL_AFFIRMATIONS,
];

/**
 * Returns the affirmation for a given local date — same affirmation all day,
 * rotates across the list. Stable for the same date so caching works.
 *
 * `ageMonths` picks the pool: infant-specific lines (feeding, burping,
 * "your baby…") are only mixed in when the child is under 12 months or the
 * age is unknown (e.g. pregnancy). For 12m+ only the age-neutral pool is used.
 */
export function affirmationForDate(
  d: Date = new Date(),
  ageMonths?: number | null,
): string {
  const pool =
    ageMonths == null || ageMonths < 12 ? AFFIRMATIONS : NEUTRAL_AFFIRMATIONS;
  // Day-of-year index → modulo list length. Stable per local day.
  const start = new Date(d.getFullYear(), 0, 0);
  const diffMs = d.getTime() - start.getTime();
  const dayOfYear = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return pool[dayOfYear % pool.length];
}
