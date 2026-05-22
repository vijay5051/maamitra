// Week math for the Mon-Sun meal planner. All operations work in LOCAL
// time so a parent in IST sees the same week boundaries regardless of UTC.

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** Returns local midnight of the Monday of the week containing `d`. */
export function getMondayOf(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate()); // local midnight, copy
  const dow = out.getDay(); // 0=Sun .. 6=Sat
  // Shift back to Monday: Mon=1 → 0, Tue=2 → 1, ..., Sun=0 → 6
  const shift = dow === 0 ? 6 : dow - 1;
  out.setDate(out.getDate() - shift);
  return out;
}

/** Returns the planner's DayKey for a date (mon..sun). */
export function dayKeyForDate(d: Date): DayKey {
  const dow = d.getDay(); // 0=Sun .. 6=Sat
  // Map: Sun=0 → 'sun' (index 6), Mon=1 → 'mon' (index 0), ...
  const idx = dow === 0 ? 6 : dow - 1;
  return DAY_KEYS[idx];
}

/** True if two dates fall in the same Mon-Sun week. */
export function isSameWeek(a: Date, b: Date): boolean {
  return getMondayOf(a).getTime() === getMondayOf(b).getTime();
}

/** Adds N days to a date (negative ok). Returns a fresh local-midnight copy. */
export function addDays(d: Date, n: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + n);
  return out;
}

/** YYYY-MM-DD format for the local date — used as the planner's week key. */
export function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export { DAY_KEYS };
