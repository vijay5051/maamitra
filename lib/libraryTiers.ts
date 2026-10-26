// Which library items each plan can open. Items are ranked so a plan's first N
// are spread across age bands / categories; an item is open when its rank is
// below the plan's count in PLAN_LIMITS.library.

import { RECIPES } from '../data/recipes';
import { TRAVEL_RECIPES } from '../data/travelRecipes';
import { NUSKHE_CATEGORIES } from '../data/nuskhe';
import { YOGA_SESSIONS } from '../data/yogaSessions';
import { GatedLibrary, rankRoundRobin } from './plans';

const cache: Partial<Record<GatedLibrary, Map<string, number>>> = {};

function build(library: GatedLibrary): Map<string, number> {
  switch (library) {
    case 'tiffin':
      return rankRoundRobin(RECIPES, (r) => r.id, (r) => r.ageBands[0] ?? 'any');
    case 'travel':
      return rankRoundRobin(TRAVEL_RECIPES, (r) => r.id, (r) => r.category);
    case 'nuskhe': {
      const remedies = NUSKHE_CATEGORIES.flatMap((c) => c.remedies.map((r) => ({ id: r.id, cat: c.id })));
      return rankRoundRobin(remedies, (r) => r.id, (r) => r.cat);
    }
    case 'yoga':
      return rankRoundRobin(YOGA_SESSIONS, (s) => s.id, () => 'all');
  }
}

/** Undefined for ids outside the catalogue (e.g. recipes added from Firestore), which stay open. */
export function libraryRank(library: GatedLibrary, id: string): number | undefined {
  const map = (cache[library] ??= build(library));
  return map.get(id);
}
