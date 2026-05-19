import { describe, expect, test } from 'bun:test';
import { validateNewbornDob, validatePregnantDueDate } from '../lib/dateValidation';

describe('validateNewbornDob', () => {
  test('accepts a recent past DOB', () => {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    expect(validateNewbornDob(d.toISOString().slice(0, 10))).toBeNull();
  });
  test('rejects a future DOB with the stage-suggesting message', () => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    expect(validateNewbornDob(d.toISOString().slice(0, 10))).toContain('switch');
  });
  test('rejects a date > 18 years ago', () => {
    expect(validateNewbornDob('2005-01-01')).toContain('18 years');
  });
  test('rejects year < 2010', () => {
    expect(validateNewbornDob('2009-12-31')).toContain('2010');
  });
});

describe('validatePregnantDueDate', () => {
  test('accepts a date 6 months in the future', () => {
    const d = new Date(); d.setMonth(d.getMonth() + 6);
    expect(validatePregnantDueDate(d.toISOString().slice(0, 10))).toBeNull();
  });
  test('rejects a past due date with the stage-suggesting message', () => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    expect(validatePregnantDueDate(d.toISOString().slice(0, 10))).toContain('switch');
  });
  test('rejects a due date > 12 months in the future', () => {
    const d = new Date(); d.setMonth(d.getMonth() + 13);
    expect(validatePregnantDueDate(d.toISOString().slice(0, 10))).toContain('12 months');
  });
});
