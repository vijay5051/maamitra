/**
 * Gender type now includes 'not-set' — distinct from 'surprise'.
 * 'surprise' = user chose "we don't want to know" (pregnant).
 * 'not-set' = user skipped the gender chip on newborn signup.
 *
 * Both render the same downstream (generic "your baby"), but
 * 'not-set' triggers a one-time soft re-prompt in Family tab.
 */
import { describe, expect, test } from 'bun:test';
import type { Kid } from '../store/useProfileStore';

describe('Gender type', () => {
  test("accepts 'boy' | 'girl' | 'surprise' | 'not-set'", () => {
    const a: Kid['gender'] = 'boy';
    const b: Kid['gender'] = 'girl';
    const c: Kid['gender'] = 'surprise';
    const d: Kid['gender'] = 'not-set';
    expect([a, b, c, d]).toEqual(['boy', 'girl', 'surprise', 'not-set']);
  });
});
