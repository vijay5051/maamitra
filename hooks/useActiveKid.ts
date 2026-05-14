import { useProfileStore, formatKidAge, isPlausibleDob } from '../store/useProfileStore';

export function useActiveKid() {
  const { kids, activeKidId } = useProfileStore();
  const activeKid = kids.find((k) => k.id === activeKidId) || kids[0] || null;

  const ageLabel = (): string => {
    if (!activeKid) return '';
    if (activeKid.isExpecting) return 'Due soon 🤰';
    // Guard against bad DOB (year < 2010 / future > 2y / unparseable) before
    // doing any arithmetic — was rendering "2002 years old" when onboarding
    // accepted a 2-digit year.
    if (!activeKid.dob || !isPlausibleDob(activeKid.dob)) return 'Set birthdate';
    const diffMs = Date.now() - new Date(activeKid.dob).getTime();
    const months = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44)));
    if (months < 1) {
      const weeks = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7)));
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} old`;
    }
    return formatKidAge(activeKid);
  };

  return { activeKid, ageLabel: ageLabel() };
}
