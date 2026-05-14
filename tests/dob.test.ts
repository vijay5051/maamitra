/**
 * Smoke tests for kid-DOB plausibility + age math + display helpers.
 *
 * These exist because the "Shiv · 2002 years old" cascade shipped on
 * 2026-05-14 — a user's onboarding picker persisted year 23 AD and 12
 * screens rendered the garbage value. Regression coverage now lives here.
 *
 * Run with: bun test
 */
import { describe, expect, test } from 'bun:test';
import {
  isPlausibleDob,
  calculateAgeInMonths,
  calculateAgeInWeeks,
  formatKidAge,
  formatKidAgeCompact,
} from '../lib/dob';

describe('isPlausibleDob', () => {
  test('accepts a normal recent DOB', () => {
    expect(isPlausibleDob('2024-06-01')).toBe(true);
  });

  test('accepts a near-future DOB (pregnancy due date)', () => {
    const next = new Date();
    next.setMonth(next.getMonth() + 6);
    expect(isPlausibleDob(next.toISOString().slice(0, 10))).toBe(true);
  });

  test('rejects null / undefined / empty', () => {
    expect(isPlausibleDob(null)).toBe(false);
    expect(isPlausibleDob(undefined)).toBe(false);
    expect(isPlausibleDob('')).toBe(false);
  });

  test('rejects garbage strings', () => {
    expect(isPlausibleDob('not-a-date')).toBe(false);
    expect(isPlausibleDob('foo')).toBe(false);
  });

  test('rejects the "0023-10-11" cascade trigger', () => {
    // The original bug — Android date picker persisted year 23 AD.
    expect(isPlausibleDob('0023-10-11')).toBe(false);
  });

  test('rejects years before 2010', () => {
    expect(isPlausibleDob('2009-12-31')).toBe(false);
    expect(isPlausibleDob('1985-01-01')).toBe(false);
  });

  test('rejects dates more than 2 years in the future', () => {
    const far = new Date();
    far.setFullYear(far.getFullYear() + 5);
    expect(isPlausibleDob(far.toISOString().slice(0, 10))).toBe(false);
  });
});

describe('calculateAgeInMonths', () => {
  test('returns 0 for implausible DOB instead of huge garbage', () => {
    // Regression: '0023-10-11' used to return ~24,000+ months.
    expect(calculateAgeInMonths('0023-10-11')).toBe(0);
    expect(calculateAgeInMonths('not-a-date')).toBe(0);
  });

  test('clamps to MAX_AGE_MONTHS (300) even if math goes wild', () => {
    // No plausible kid is over 25, so the clamp is a safety net.
    expect(calculateAgeInMonths('2024-06-01')).toBeLessThanOrEqual(300);
  });

  test('returns plausible value for a recent DOB', () => {
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    const months = calculateAgeInMonths(lastYear.toISOString().slice(0, 10));
    expect(months).toBeGreaterThanOrEqual(11);
    expect(months).toBeLessThanOrEqual(13);
  });
});

describe('calculateAgeInWeeks', () => {
  test('returns 0 for implausible DOB', () => {
    expect(calculateAgeInWeeks('0023-10-11')).toBe(0);
  });

  test('clamps to 25y * 52w', () => {
    expect(calculateAgeInWeeks('2024-06-01')).toBeLessThanOrEqual(25 * 52);
  });
});

describe('formatKidAge — display helpers must never leak garbage', () => {
  test('expecting → "Expecting"', () => {
    expect(formatKidAge({ isExpecting: true })).toBe('Expecting');
  });

  test('missing DOB → "Set birthdate" (not "NaN years old")', () => {
    expect(formatKidAge({})).toBe('Set birthdate');
    expect(formatKidAge({ dob: '' })).toBe('Set birthdate');
  });

  test('implausible DOB → "Set birthdate" (closes the 2002-years-old cascade)', () => {
    expect(formatKidAge({ dob: '0023-10-11' })).toBe('Set birthdate');
    expect(formatKidAge({ dob: '0023-10-11', ageInMonths: 24000 })).toBe('Set birthdate');
  });

  test('newborn (<1m)', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(formatKidAge({ dob: today })).toBe('Newborn');
  });

  test('month string singular vs plural', () => {
    expect(formatKidAge({ dob: '2024-06-01', ageInMonths: 1 })).toBe('1 month old');
    expect(formatKidAge({ dob: '2024-06-01', ageInMonths: 8 })).toBe('8 months old');
  });

  test('year string singular vs plural (boundary: months>=24 switches to years)', () => {
    expect(formatKidAge({ dob: '2024-06-01', ageInMonths: 12 })).toBe('12 months old'); // still in months range
    expect(formatKidAge({ dob: '2024-06-01', ageInMonths: 24 })).toBe('2 years old');
    expect(formatKidAge({ dob: '2022-06-01', ageInMonths: 36 })).toBe('3 years old');
  });
});

describe('formatKidAgeCompact — tight-UI variant', () => {
  test('missing DOB → "Set DOB"', () => {
    expect(formatKidAgeCompact({})).toBe('Set DOB');
  });

  test('implausible DOB → "Set DOB"', () => {
    expect(formatKidAgeCompact({ dob: '0023-10-11', ageInMonths: 24000 })).toBe('Set DOB');
  });

  test('formats m / y compact (boundary: months>=24 switches to years)', () => {
    expect(formatKidAgeCompact({ dob: '2024-06-01', ageInMonths: 12 })).toBe('12m');
    expect(formatKidAgeCompact({ dob: '2024-06-01', ageInMonths: 8 })).toBe('8m');
    expect(formatKidAgeCompact({ dob: '2024-06-01', ageInMonths: 24 })).toBe('2y');
  });
});
