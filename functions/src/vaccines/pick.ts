// Pure selection + wording for vaccine-reminder pushes. No Firebase imports,
// so it is unit-tested from the app's test suite (tests/vaccineReminder.test.ts).

import type { ScheduleVaccine } from './schedule';

/** Remind this many days before a vaccine falls due. */
export const LOOKAHEAD_DAYS = 3;
/**
 * Only nudge about vaccines that became due in the last 30 days. Older
 * unticked ones were most likely given but never logged in the app —
 * reminding about every one of them would flood the parent with alerts.
 */
export const OVERDUE_WINDOW_DAYS = 30;

export interface CompletedVaccineEntry {
  done?: boolean;
  doneDate?: string;
}

export interface RemindablePick {
  vaccine: ScheduleVaccine;
  dueDate: Date;
  /** Days until due: negative = overdue, 0 = due today. */
  diffDays: number;
  status: 'due-soon' | 'overdue';
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function pickRemindableVaccines({
  dob,
  today,
  list,
  completed,
}: {
  dob: Date;
  today: Date;
  list: ScheduleVaccine[];
  completed: Record<string, CompletedVaccineEntry>;
}): RemindablePick[] {
  const out: RemindablePick[] = [];
  for (const v of list) {
    if (completed[v.id]?.done) continue;
    const dueDate = new Date(dob.getTime() + v.daysFromBirth * DAY_MS);
    const diffDays = Math.round((dueDate.getTime() - today.getTime()) / DAY_MS);
    if (diffDays < -OVERDUE_WINDOW_DAYS || diffDays > LOOKAHEAD_DAYS) continue;
    out.push({ vaccine: v, dueDate, diffDays, status: diffDays < 0 ? 'overdue' : 'due-soon' });
  }
  return out.sort((a, b) => a.diffDays - b.diffDays);
}

function isoShort(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

/**
 * ONE notification per child per run. A single vaccine gets a specific
 * message; several are combined into one summary so a parent never gets a
 * burst of alerts.
 */
export function reminderMessage(kidName: string | undefined, picks: RemindablePick[]): { title: string; body: string } {
  const who = kidName?.trim() || 'your child';
  if (picks.length === 1) {
    const p = picks[0];
    if (p.status === 'overdue') {
      return {
        title: `${who}'s ${p.vaccine.name} is overdue`,
        body: `Was due ${isoShort(p.dueDate)}. Tap to view the schedule or log the visit.`,
      };
    }
    return {
      title: p.diffDays === 0
        ? `${p.vaccine.name} due today for ${who}`
        : `${p.vaccine.name} due in ${p.diffDays} day${p.diffDays === 1 ? '' : 's'} for ${who}`,
      body: `Due ${isoShort(p.dueDate)}. Tap to view the schedule or log it once given.`,
    };
  }
  const names = picks.map((p) => p.vaccine.name);
  const shown = names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3} more` : '');
  return {
    title: `${picks.length} vaccines need attention for ${who}`,
    body: `${shown}. Tap to view the schedule or log the ones already given.`,
  };
}
