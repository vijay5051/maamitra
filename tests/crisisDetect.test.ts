import { describe, expect, it } from 'bun:test';
import { detectCrisis } from '../lib/crisisDetect';

describe('detectCrisis — positive matches', () => {
  it('flags suicidal ideation', () => {
    const r = detectCrisis('I am feeling suicidal lately');
    expect(r?.severity).toBe('critical');
    expect(r?.categories).toContain('self_harm');
  });

  it('flags "kill myself" mid-sentence', () => {
    const r = detectCrisis("Sometimes I just want to kill myself, I can't cope");
    expect(r?.severity).toBe('critical');
  });

  it('flags "can\'t eat"', () => {
    const r = detectCrisis("I can't eat anything since the baby came");
    expect(r?.severity).not.toBeUndefined();
    expect(r?.categories).toContain('eating_disorder');
  });

  it('escalates when two categories hit', () => {
    // PPD (high) + abuse (high) → both high, distinct categories → critical
    const r = detectCrisis('I hate my baby and my husband hits me');
    expect(r?.severity).toBe('critical');
    expect(r?.categories.length).toBeGreaterThanOrEqual(2);
  });

  it('case-insensitive match', () => {
    const r = detectCrisis('SUICIDAL');
    expect(r?.severity).toBe('critical');
  });
});

describe('detectCrisis — word-boundary safety (regression for audit finding)', () => {
  it('does NOT match "ppd" inside another word', () => {
    // Word "happdown" / "rappdown" don't exist but the principle is the
    // substring "ppd" inside a larger token must not trigger.
    const r = detectCrisis('We rappdown the streets at sundown');
    expect(r).toBeNull();
  });

  it('does match "ppd" as its own word', () => {
    const r = detectCrisis('My doctor mentioned PPD might be a possibility.');
    expect(r?.categories).toContain('ppd');
  });

  it('does not flag academic discussion of suicidal patterns inside another token', () => {
    // "suicidality" should not match "suicidal" — different word.
    const r = detectCrisis('researchers studying suicidality in mothers');
    // We expect this NOT to match — "suicidal" is a substring of "suicidality"
    // but a different word. Word-boundary regex stops the substring hit.
    expect(r).toBeNull();
  });
});

describe('detectCrisis — empty/edge', () => {
  it('returns null for empty input', () => {
    expect(detectCrisis('')).toBeNull();
    expect(detectCrisis(null)).toBeNull();
    expect(detectCrisis(undefined)).toBeNull();
  });

  it('returns null for benign text', () => {
    expect(detectCrisis('My baby smiled for the first time today!')).toBeNull();
  });
});
