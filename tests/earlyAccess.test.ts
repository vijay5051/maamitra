import { describe, expect, it } from 'bun:test';

import { earlyAccessUntil, EARLY_ACCESS_DAYS } from '../lib/plans';

const DAY = 86400000;
const launch = Date.UTC(2026, 10, 1);

describe('early members', () => {
  it('accounts created before launch get 90 days from launch', () => {
    expect(earlyAccessUntil(launch, EARLY_ACCESS_DAYS, launch - DAY)).toBe(launch + 90 * DAY);
  });
  it('accounts created at or after launch are not early members', () => {
    expect(earlyAccessUntil(launch, EARLY_ACCESS_DAYS, launch)).toBeNull();
    expect(earlyAccessUntil(launch, EARLY_ACCESS_DAYS, launch + DAY)).toBeNull();
  });
  it('nothing until plans have launched', () => {
    expect(earlyAccessUntil(null, EARLY_ACCESS_DAYS, launch - DAY)).toBeNull();
    expect(earlyAccessUntil(launch, EARLY_ACCESS_DAYS, null)).toBeNull();
  });
});
