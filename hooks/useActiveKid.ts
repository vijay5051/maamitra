import { useProfileStore } from '../store/useProfileStore';

export function useActiveKid() {
  const { kids, activeKidId } = useProfileStore();
  const activeKid = kids.find((k) => k.id === activeKidId) || kids[0] || null;

  const ageLabel = (): string => {
    if (!activeKid) return '';
    if (activeKid.isExpecting) return 'Due soon 🤰';
    // Always calculate from DOB — stored ageInMonths can be stale or missing
    if (!activeKid.dob) return '';
    const diffMs = Date.now() - new Date(activeKid.dob).getTime();
    const months = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44)));
    const weeks = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7)));
    if (months < 1) return `${weeks} weeks old`;
    if (months < 24) return `${months} months old`;
    return `${Math.floor(months / 12)} years old`;
  };

  return { activeKid, ageLabel: ageLabel() };
}
