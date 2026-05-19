/**
 * Stage-aware date validators for the onboarding form.
 *
 * Returns null on valid; returns a user-friendly error message on invalid.
 * The error messages explicitly guide the user to flip the stage chip if
 * the date is in the wrong direction — better UX than just "invalid date".
 */

function parse(yyyyMmDd: string): Date | null {
  const d = new Date(yyyyMmDd + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

export function validateNewbornDob(yyyyMmDd: string): string | null {
  const d = parse(yyyyMmDd);
  if (!d) return 'Please pick a valid date.';
  const now = Date.now();
  const eighteenYears = 18 * 365 * 86400000;
  // Check 18-year bound before the year-2010 guard so "2005-01-01" hits the
  // age message rather than the year message (both are true, but the age
  // message is more actionable for a DOB validator).
  if (d.getTime() < now - eighteenYears) return 'That date is more than 18 years ago. Tap to pick a recent date.';
  if (d.getFullYear() < 2010) return 'Please pick a date — the year should be 2010 or later.';
  if (d.getTime() > now) {
    return "That date is in the future. If your baby hasn't arrived yet, switch to 'We're expecting' above.";
  }
  return null;
}

export function validatePregnantDueDate(yyyyMmDd: string): string | null {
  const d = parse(yyyyMmDd);
  if (!d) return 'Please pick a valid date.';
  if (d.getFullYear() < 2010) return 'Please pick a date — the year should be 2010 or later.';
  const now = Date.now();
  if (d.getTime() <= now) {
    return "That date is in the past. If your baby is already here, switch to 'Baby is here' above.";
  }
  const twelveMonths = 12 * 30.5 * 86400000;
  if (d.getTime() > now + twelveMonths) return 'That date is more than 12 months away. Tap to pick a closer date.';
  return null;
}
