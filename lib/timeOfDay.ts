export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

/** Returns the current time-of-day bucket based on local hour. */
export function getTimeOfDay(now: Date = new Date()): TimeOfDay {
  const h = now.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  return 'evening';
}
