import { describe, expect, it } from 'bun:test';
import { getMondayOf, dayKeyForDate, isSameWeek, addDays } from '../../lib/weekKeys';

describe('getMondayOf', () => {
  it('returns the same date when given a Monday', () => {
    expect(getMondayOf(new Date('2026-05-18'))).toEqual(new Date('2026-05-18T00:00:00'));
  });
  it('returns the previous Monday for a Wednesday', () => {
    // 2026-05-20 is a Wednesday → Monday is 2026-05-18
    expect(getMondayOf(new Date('2026-05-20'))).toEqual(new Date('2026-05-18T00:00:00'));
  });
  it('returns the previous Monday for a Sunday', () => {
    // 2026-05-24 is a Sunday → Monday is 2026-05-18
    expect(getMondayOf(new Date('2026-05-24'))).toEqual(new Date('2026-05-18T00:00:00'));
  });
  it('handles month boundaries', () => {
    // 2026-06-01 is a Monday — should return itself
    expect(getMondayOf(new Date('2026-06-01'))).toEqual(new Date('2026-06-01T00:00:00'));
    // 2026-06-02 is a Tuesday — Monday is 2026-06-01
    expect(getMondayOf(new Date('2026-06-02'))).toEqual(new Date('2026-06-01T00:00:00'));
  });
  it('handles year boundaries', () => {
    // 2027-01-01 is a Friday — Monday is 2026-12-28
    expect(getMondayOf(new Date('2027-01-01'))).toEqual(new Date('2026-12-28T00:00:00'));
  });
});

describe('dayKeyForDate', () => {
  it('returns "mon" for Monday', () => {
    expect(dayKeyForDate(new Date('2026-05-18'))).toBe('mon');
  });
  it('returns "sun" for Sunday', () => {
    expect(dayKeyForDate(new Date('2026-05-24'))).toBe('sun');
  });
  it('returns "thu" for Thursday', () => {
    expect(dayKeyForDate(new Date('2026-05-21'))).toBe('thu');
  });
});

describe('isSameWeek', () => {
  it('returns true for two dates in the same Mon-Sun week', () => {
    expect(isSameWeek(new Date('2026-05-18'), new Date('2026-05-24'))).toBe(true);
  });
  it('returns false for dates in different weeks', () => {
    expect(isSameWeek(new Date('2026-05-24'), new Date('2026-05-25'))).toBe(false);
  });
});

describe('addDays', () => {
  it('handles month rollover', () => {
    expect(addDays(new Date('2026-05-30'), 3)).toEqual(new Date('2026-06-02T00:00:00'));
  });
});
