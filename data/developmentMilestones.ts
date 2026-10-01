// Developmental milestones for Health → Growth & Milestones.
//
// Sources (checked 2026-10-01):
//   • CDC "Learn the Signs. Act Early." milestone checklists (2022 revision),
//     cdc.gov/act-early/milestones — skills MOST children (75% or more) show
//     BY the stated age. Wording here is paraphrased.
//   • WHO Motor Development Study, "Windows of achievement for six gross
//     motor milestones" (Acta Paediatrica Suppl 2006;450:86–95) — the age
//     range (1st–99th percentile) in which healthy children reached each one.
//
// These are guides, not deadlines. Nothing here is ever marked for a child
// automatically — only the parent records "Observed" or "Not yet".

export type MilestoneDomain = 'movement' | 'communication' | 'social' | 'learning';

export const MILESTONE_DOMAINS: { id: MilestoneDomain; label: string; icon: string; tint: string }[] = [
  { id: 'movement', label: 'Movement', icon: 'walk-outline', tint: '#DBEAFE' },
  { id: 'communication', label: 'Communication', icon: 'chatbubble-ellipses-outline', tint: '#FEF3C7' },
  { id: 'social', label: 'Social', icon: 'heart-outline', tint: '#FCE7F3' },
  { id: 'learning', label: 'Learning & fine motor', icon: 'bulb-outline', tint: '#DCFCE7' },
];

export type MilestoneSource = 'cdc' | 'who';

export interface DevMilestone {
  id: string;
  domain: MilestoneDomain;
  title: string;
  /** CDC: most children (75%+) do this by this age, in months. */
  byMonths?: number;
  /** WHO motor study: window in months in which healthy children reached it. */
  window?: [number, number];
  source: MilestoneSource;
}

export const MILESTONE_SOURCES: Record<MilestoneSource, { name: string; url: string }> = {
  cdc: { name: 'CDC — Learn the Signs. Act Early. (milestones most children reach by each age)', url: 'https://www.cdc.gov/act-early/milestones/index.html' },
  who: { name: 'WHO Motor Development Study — windows of achievement', url: 'https://www.who.int/tools/child-growth-standards/standards/motor-development-milestones' },
};

const c = (id: string, byMonths: number, domain: MilestoneDomain, title: string): DevMilestone => ({ id, byMonths, domain, title, source: 'cdc' });
const w = (id: string, window: [number, number], title: string): DevMilestone => ({ id, window, domain: 'movement', title, source: 'who' });

export const DEV_MILESTONES: DevMilestone[] = [
  // ── By 2 months (CDC)
  c('d2-mv', 2, 'movement', 'Holds head up when lying on tummy'),
  c('d2-co', 2, 'communication', 'Makes sounds other than crying'),
  c('d2-so', 2, 'social', 'Smiles when you talk to or smile at them'),
  c('d2-le', 2, 'learning', 'Watches you as you move'),
  // ── By 4 months (CDC)
  c('d4-mv', 4, 'movement', 'Holds head steady without support when held'),
  c('d4-co', 4, 'communication', 'Makes cooing sounds like “oooo” and “aahh”'),
  c('d4-so', 4, 'social', 'Chuckles when you try to make them laugh'),
  c('d4-le', 4, 'learning', 'Looks at their own hands with interest'),
  // ── By 6 months (CDC)
  c('d6-mv', 6, 'movement', 'Rolls from tummy to back'),
  c('d6-co', 6, 'communication', 'Takes turns making sounds with you'),
  c('d6-so', 6, 'social', 'Knows familiar people'),
  c('d6-le', 6, 'learning', 'Reaches to grab a toy they want'),
  // ── WHO motor windows
  w('w-sit', [3.8, 9.2], 'Sits without support'),
  w('w-stand-help', [4.8, 11.4], 'Stands with help'),
  w('w-crawl', [5.2, 13.5], 'Crawls on hands and knees'),
  w('w-walk-help', [6.0, 13.7], 'Walks with help'),
  w('w-stand', [6.9, 16.9], 'Stands alone'),
  w('w-walk', [8.2, 17.6], 'Walks alone'),
  // ── By 9 months (CDC)
  c('d9-co', 9, 'communication', 'Makes sounds like “mamamama” and “babababa”'),
  c('d9-so', 9, 'social', 'Looks when you call their name'),
  c('d9-le', 9, 'learning', 'Looks for things dropped out of sight'),
  // ── By 12 months (CDC)
  c('d12-co', 12, 'communication', 'Waves “bye-bye”'),
  c('d12-so', 12, 'social', 'Plays games with you, like pat-a-cake'),
  c('d12-le', 12, 'learning', 'Picks up small things between thumb and pointer finger'),
  // ── By 15 months (CDC)
  c('d15-co', 15, 'communication', 'Tries to say one or two words besides “mama” or “dada”'),
  c('d15-so', 15, 'social', 'Shows you affection with hugs, cuddles or kisses'),
  c('d15-le', 15, 'learning', 'Stacks at least two small objects, like blocks'),
  // ── By 18 months (CDC)
  c('d18-mv', 18, 'movement', 'Climbs on and off a couch or chair without help'),
  c('d18-co', 18, 'communication', 'Tries to say three or more words besides “mama” or “dada”'),
  c('d18-so', 18, 'social', 'Points to show you something interesting'),
  c('d18-le', 18, 'learning', 'Scribbles'),
  // ── By 2 years (CDC)
  c('d24-mv', 24, 'movement', 'Kicks a ball and runs'),
  c('d24-co', 24, 'communication', 'Says at least two words together, like “more milk”'),
  c('d24-so', 24, 'social', 'Notices when others are hurt or upset'),
  c('d24-le', 24, 'learning', 'Eats with a spoon'),
  // ── By 30 months (CDC)
  c('d30-mv', 30, 'movement', 'Jumps off the ground with both feet'),
  c('d30-co', 30, 'communication', 'Says about 50 words'),
  c('d30-so', 30, 'social', 'Plays next to other children, and sometimes with them'),
  c('d30-le', 30, 'learning', 'Uses things to pretend, like feeding a doll'),
  // ── By 3 years (CDC)
  c('d36-co', 36, 'communication', 'Asks “who”, “what”, “where” or “why” questions'),
  c('d36-so', 36, 'social', 'Notices other children and joins them to play'),
  c('d36-le', 36, 'learning', 'Draws a circle when you show them how'),
  // ── By 4 years (CDC)
  c('d48-mv', 48, 'movement', 'Catches a large ball most of the time'),
  c('d48-co', 48, 'communication', 'Says sentences with four or more words'),
  c('d48-so', 48, 'social', 'Comforts others who are hurt or sad'),
  c('d48-le', 48, 'learning', 'Draws a person with three or more body parts'),
  // ── By 5 years (CDC)
  c('d60-mv', 60, 'movement', 'Hops on one foot'),
  c('d60-co', 60, 'communication', 'Tells a story with at least two events'),
  c('d60-so', 60, 'social', 'Follows rules or takes turns when playing games'),
  c('d60-le', 60, 'learning', 'Counts to 10'),
];

/** Age (months) used to order a milestone on the timeline. */
export function milestoneSortAge(m: DevMilestone): number {
  return m.byMonths ?? m.window![1];
}

function monthsLabel(m: number): string {
  if (m < 24) return `${m} months`;
  return m % 12 === 0 ? `${m / 12} years` : `${Math.floor(m / 12)}½ years`;
}

/** "Most children do this by 9 months" / "Usually between 4 and 9 months". */
export function milestoneWindowText(m: DevMilestone): string {
  if (m.window) return `Usually between ${Math.round(m.window[0])} and ${Math.round(m.window[1])} months`;
  return `Most children do this by ${monthsLabel(m.byMonths!)}`;
}

/**
 * Milestones worth showing for a child's age: everything up to the next
 * checkpoint ahead of them. Older ones stay visible so a parent can still
 * record them — nothing is assumed from age.
 */
export function milestonesForAge(ageMonths: number): DevMilestone[] {
  const checkpoints = [2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60];
  const next = checkpoints.find((cp) => cp > ageMonths) ?? 60;
  return DEV_MILESTONES.filter((m) => (m.byMonths ? m.byMonths <= next : m.window![0] <= Math.max(ageMonths, next)))
    .sort((a, b) => milestoneSortAge(a) - milestoneSortAge(b));
}
