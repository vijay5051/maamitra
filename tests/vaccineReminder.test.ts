import { describe, expect, test } from 'bun:test';
import { scheduleFor } from '../functions/src/vaccines/schedule';
import { OVERDUE_WINDOW_DAYS, pickRemindableVaccines, reminderMessage } from '../functions/src/vaccines/pick';

const DAY = 86400000;
const today = new Date(Date.UTC(2026, 9, 21));
const dobDaysAgo = (d: number) => new Date(today.getTime() - d * DAY);

describe('vaccine reminders — no flooding', () => {
  test('a 5-year-old with nothing logged gets reminded only about the last 30 days, not every old vaccine', () => {
    const picks = pickRemindableVaccines({ dob: dobDaysAgo(5 * 365), today, list: scheduleFor('iap'), completed: {} });
    expect(picks.every((p) => p.diffDays >= -OVERDUE_WINDOW_DAYS && p.diffDays <= 3)).toBe(true);
    expect(picks.length).toBeLessThan(4);
  });
  test('vaccines due within 3 days are included; logged ones never are', () => {
    const list = scheduleFor('iap');
    const v = list.find((x) => x.daysFromBirth > 40)!;
    const dob = new Date(today.getTime() - (v.daysFromBirth - 2) * DAY); // due in 2 days
    const picks = pickRemindableVaccines({ dob, today, list, completed: {} });
    expect(picks.some((p) => p.vaccine.id === v.id && p.status === 'due-soon' && p.diffDays === 2)).toBe(true);
    const none = pickRemindableVaccines({ dob, today, list, completed: { [v.id]: { done: true } } });
    expect(none.some((p) => p.vaccine.id === v.id)).toBe(false);
  });
  test('due today is "due-soon" (not overdue); yesterday is overdue', () => {
    const list = [{ id: 'x', name: 'Test', daysFromBirth: 10 } as any];
    expect(pickRemindableVaccines({ dob: dobDaysAgo(10), today, list, completed: {} })[0].status).toBe('due-soon');
    expect(pickRemindableVaccines({ dob: dobDaysAgo(11), today, list, completed: {} })[0].status).toBe('overdue');
    expect(pickRemindableVaccines({ dob: dobDaysAgo(10 + OVERDUE_WINDOW_DAYS + 1), today, list, completed: {} })).toEqual([]);
  });
  test('several due vaccines become ONE message', () => {
    const p = (name: string, diffDays: number) => ({ vaccine: { id: name, name, daysFromBirth: 0 } as any, dueDate: today, diffDays, status: diffDays < 0 ? ('overdue' as const) : ('due-soon' as const) });
    expect(reminderMessage('Aarav', [p('OPV', -2)]).title).toBe("Aarav's OPV is overdue");
    expect(reminderMessage('Aarav', [p('OPV', 0)]).title).toBe('OPV due today for Aarav');
    const many = reminderMessage('Aarav', [p('DTP', -3), p('IPV', -3), p('Hib', -3), p('Rota', -3)]);
    expect(many.title).toBe('4 vaccines need attention for Aarav');
    expect(many.body).toContain('DTP, IPV, Hib +1 more');
    expect(reminderMessage(undefined, [p('BCG', 1)]).title).toBe('BCG due in 1 day for your child');
  });
});
