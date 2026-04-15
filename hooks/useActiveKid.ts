import { useProfileStore } from '../store/useProfileStore';

export function useActiveKid() {
  const { kids, activeKidId } = useProfileStore();
  const activeKid = kids.find((k) => k.id === activeKidId) || kids[0] || null;

  const ageLabel = (): string => {
    if (!activeKid) return '';
    if (activeKid.isExpecting) return 'Due soon 🤰';
    if (activeKid.ageInMonths < 1) return `${activeKid.ageInWeeks} weeks old`;
    if (activeKid.ageInMonths < 24) return `${activeKid.ageInMonths} months old`;
    return `${Math.floor(activeKid.ageInMonths / 12)} years old`;
  };

  return { activeKid, ageLabel: ageLabel() };
}
