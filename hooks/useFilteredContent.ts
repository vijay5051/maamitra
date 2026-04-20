import { useMemo } from 'react';
import { ARTICLES } from '../data/articles';
import { useActiveKid } from './useActiveKid';
import { calculateAgeInMonths, useProfileStore } from '../store/useProfileStore';
import { filterByAudience, parentGenderToAudience } from '../data/audience';

export function useFilteredArticles() {
  const { activeKid } = useActiveKid();
  // Watch parentGender so articles re-filter if it ever changes — today
  // it's locked at signup but the hook stays correct if that changes.
  const parentGender = useProfileStore((s) => s.parentGender);

  return useMemo(() => {
    const viewer = parentGenderToAudience(parentGender);
    const byAudience = filterByAudience(ARTICLES, viewer);

    if (!activeKid || activeKid.isExpecting) return byAudience;

    const ageMonths = calculateAgeInMonths(activeKid.dob);
    return byAudience.filter((a) => {
      const min = (a.ageMin ?? 0) - 3;
      const max = (a.ageMax ?? 60) + 3;
      return ageMonths >= min && ageMonths <= max;
    });
  }, [activeKid, parentGender]);
}
