/**
 * Pure DOB helpers — extracted from useProfileStore.ts so they can be unit-tested
 * without dragging zustand/AsyncStorage into the test environment.
 *
 * Single source of truth for kid-age math + display. Every screen that renders
 * "how old is this kid" must route through these to avoid the
 * "Shiv · 2002 years old" cascade we shipped on 2026-05-14.
 */

// Plausibility window: kid born no earlier than 2010, no later than ~2 years
// from now (handles `isExpecting` due-date entries). 25y is a hard sanity cap
// for display-side overflows.
const MIN_DOB_YEAR = 2010;
const MAX_DOB_TIME_MS = Date.now() + 2 * 365 * 86400000;
export const MAX_AGE_MONTHS = 25 * 12;
export const MAX_AGE_WEEKS = 25 * 52;

export function isPlausibleDob(dob: string | null | undefined): boolean {
  if (!dob || typeof dob !== 'string') return false;
  const birth = new Date(dob.includes('T') ? dob : dob + 'T00:00:00');
  if (isNaN(birth.getTime())) return false;
  if (birth.getFullYear() < MIN_DOB_YEAR) return false;
  if (birth.getTime() > MAX_DOB_TIME_MS) return false;
  return true;
}

export function calculateAgeInMonths(dob: string): number {
  if (!isPlausibleDob(dob)) return 0;
  const birth = new Date(dob.includes('T') ? dob : dob + 'T00:00:00');
  const today = new Date();
  const years = today.getFullYear() - birth.getFullYear();
  const months = today.getMonth() - birth.getMonth();
  const days = today.getDate() - birth.getDate();
  let totalMonths = years * 12 + months;
  if (days < 0) totalMonths -= 1;
  return Math.min(MAX_AGE_MONTHS, Math.max(0, totalMonths));
}

export function calculateAgeInWeeks(dob: string): number {
  if (!isPlausibleDob(dob)) return 0;
  const birth = new Date(dob.includes('T') ? dob : dob + 'T00:00:00');
  const today = new Date();
  const diffMs = today.getTime() - birth.getTime();
  return Math.min(MAX_AGE_WEEKS, Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7))));
}

export function formatKidAge(kid: { dob?: string; isExpecting?: boolean; ageInMonths?: number }): string {
  if (kid.isExpecting) return 'Expecting';
  if (!kid.dob || !isPlausibleDob(kid.dob)) return 'Set birthdate';
  const months = typeof kid.ageInMonths === 'number' && kid.ageInMonths <= MAX_AGE_MONTHS
    ? kid.ageInMonths
    : calculateAgeInMonths(kid.dob);
  if (months < 1) return 'Newborn';
  if (months < 24) return `${months} ${months === 1 ? 'month' : 'months'} old`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? 'year' : 'years'} old`;
}

export function formatKidAgeCompact(kid: { dob?: string; isExpecting?: boolean; ageInMonths?: number }): string {
  if (kid.isExpecting) return 'Expecting';
  if (!kid.dob || !isPlausibleDob(kid.dob)) return 'Set DOB';
  const months = typeof kid.ageInMonths === 'number' && kid.ageInMonths <= MAX_AGE_MONTHS
    ? kid.ageInMonths
    : calculateAgeInMonths(kid.dob);
  if (months < 1) return '<1m';
  if (months < 24) return `${months}m`;
  return `${Math.floor(months / 12)}y`;
}
