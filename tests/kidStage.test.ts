import { describe, expect, test } from 'bun:test';
import {
  isBigKidTeeth,
  kidNoun,
  showsRoutineTracker,
  showsTravelMeals,
  yourKid,
} from '../lib/kidStage';

describe('kidNoun', () => {
  test('baby under 12 months or unknown age', () => {
    expect(kidNoun(null)).toBe('baby');
    expect(kidNoun(undefined)).toBe('baby');
    expect(kidNoun(0)).toBe('baby');
    expect(kidNoun(11)).toBe('baby');
  });
  test('toddler 12–35 months, child from 36', () => {
    expect(kidNoun(12)).toBe('toddler');
    expect(kidNoun(35)).toBe('toddler');
    expect(kidNoun(36)).toBe('child');
    expect(yourKid(76)).toBe('your child');
  });
});

describe('age-gated tools', () => {
  test('routine (diaper + sleep) hidden from 2 years', () => {
    expect(showsRoutineTracker(null)).toBe(true);
    expect(showsRoutineTracker(23)).toBe(true);
    expect(showsRoutineTracker(24)).toBe(false);
  });
  test('travel meals hidden from 1.5 years', () => {
    expect(showsTravelMeals(null)).toBe(true);
    expect(showsTravelMeals(17)).toBe(true);
    expect(showsTravelMeals(18)).toBe(false);
  });
  test('big-kid teeth mode from 5 years', () => {
    expect(isBigKidTeeth(null)).toBe(false);
    expect(isBigKidTeeth(59)).toBe(false);
    expect(isBigKidTeeth(60)).toBe(true);
  });
});
