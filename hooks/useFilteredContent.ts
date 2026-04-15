import { useMemo } from 'react';
import { ARTICLES } from '../data/articles';
import { useActiveKid } from './useActiveKid';

export function useFilteredArticles() {
  const { activeKid } = useActiveKid();

  return useMemo(() => {
    if (!activeKid || activeKid.isExpecting) return ARTICLES;

    const ageMonths = activeKid.ageInMonths;
    return ARTICLES.filter((a) => {
      const min = (a.ageMin ?? 0) - 3;
      const max = (a.ageMax ?? 60) + 3;
      return ageMonths >= min && ageMonths <= max;
    });
  }, [activeKid]);
}
