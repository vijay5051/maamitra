import { describe, expect, it } from 'bun:test';

import { birthdayCardKey, birthdayNote, birthdayToday, ordinal } from '../lib/birthday';

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 10, 0, 0);

describe('birthdayToday', () => {
  it('returns the age on the birthday', () => {
    expect(birthdayToday('2025-10-26', at(2026, 10, 26))).toBe(1);
    expect(birthdayToday('2021-03-05T00:00:00.000Z', at(2026, 3, 5))).toBe(5);
  });
  it('is null on other days, before the first birthday, and for bad input', () => {
    expect(birthdayToday('2025-10-26', at(2026, 10, 25))).toBeNull();
    expect(birthdayToday('2026-10-26', at(2026, 10, 26))).toBeNull();
    expect(birthdayToday('', at(2026, 10, 26))).toBeNull();
    expect(birthdayToday(undefined, at(2026, 10, 26))).toBeNull();
  });
  it('celebrates Feb 29 babies on Feb 28 in non-leap years', () => {
    expect(birthdayToday('2024-02-29', at(2025, 2, 28))).toBe(1);
    expect(birthdayToday('2024-02-29', at(2028, 2, 29))).toBe(4);
    expect(birthdayToday('2024-02-29', at(2028, 2, 28))).toBeNull();
  });
});

describe('wording', () => {
  it('ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
  });
  it('uses the name and age', () => {
    const n = birthdayNote('Aarav', 1);
    expect(n.heading).toBe('Happy 1st Birthday');
    expect(n.note).toContain('Aarav');
    expect(birthdayNote('  ', 3).note).toContain('little one');
  });
  it('dedup key is per child per year', () => {
    expect(birthdayCardKey('k1', at(2026, 10, 26))).toBe('birthdayCard-k1-2026');
  });
});
