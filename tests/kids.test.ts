import { describe, expect, it } from 'bun:test';

import { dobDay, duplicateNameMessage, findKidWithName, twinsOf } from '../lib/kids';
import { dobDateIst, monthBirthday } from '../functions/src/notifications/growthReminderCron';

const kids = [
  { id: 'a', name: 'Aayat', dob: '2026-05-10T18:30:00.000Z', isExpecting: false },
  { id: 'b', name: 'Little one', dob: '2027-01-02', isExpecting: true },
];

describe('duplicate names', () => {
  it('matches ignoring case and spaces', () => {
    expect(findKidWithName(kids, '  aayat ')?.id).toBe('a');
    expect(findKidWithName(kids, 'Aayat', 'a')).toBeNull();
    expect(findKidWithName(kids, 'Zoya')).toBeNull();
    expect(findKidWithName(kids, '')).toBeNull();
  });
  it('mentions twins when the birthday matches', () => {
    expect(duplicateNameMessage('Aayat', true)).toContain('Twins?');
    expect(duplicateNameMessage('Aayat', false)).not.toContain('Twins?');
  });
});

describe('twins', () => {
  it('same day (stored instant or plain date) counts as twins', () => {
    // How the app stores a DOB: the instant of local midnight.
    const twin = { id: 'c', name: 'Zara', dob: new Date(2026, 4, 11).toISOString(), isExpecting: false };
    expect(dobDay(twin.dob)).toBe('2026-05-11');
    expect(twinsOf([twin], '2026-05-11', false).map((k) => k.id)).toEqual(['c']);
    expect(twinsOf([twin], '2026-05-12', false)).toEqual([]);
    expect(twinsOf(kids, '2027-01-02', true).map((k) => k.id)).toEqual(['b']);
    expect(twinsOf(kids, '2027-01-02', false)).toEqual([]);
  });
});

describe('server DOB reading (IST)', () => {
  it('reads local-midnight instants as the Indian date', () => {
    expect(dobDateIst('2026-05-10T18:30:00.000Z')).toEqual({ y: 2026, m: 5, d: 11 });
    expect(dobDateIst('2026-05-11')).toEqual({ y: 2026, m: 5, d: 11 });
    expect(monthBirthday('2026-05-10T18:30:00.000Z', { y: 2026, m: 10, d: 11 })).toBe(5);
    expect(monthBirthday('2026-05-10T18:30:00.000Z', { y: 2026, m: 10, d: 10 })).toBeNull();
  });
});
