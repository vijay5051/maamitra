/**
 * Smoke test: GenderChip's option-shape logic varies by stage.
 *
 * The visible-options derivation is pure logic — we test it directly
 * without rendering RN components in the Bun env.
 */
import { describe, expect, test } from 'bun:test';

// The same option shape as the component. Kept in sync via copy — if the
// component's options change, this test must update too. (TODO: when we
// can render RN components in tests, replace with render-based assertions.)

function genderOptionsForStage(stage: 'pregnant' | 'newborn') {
  return stage === 'pregnant'
    ? ['boy', 'girl', 'surprise']
    : ['boy', 'girl'];
}

describe('Gender chip options by stage', () => {
  test('pregnant stage exposes 3 chips including Surprise', () => {
    expect(genderOptionsForStage('pregnant')).toEqual(['boy', 'girl', 'surprise']);
  });
  test('newborn stage exposes only Boy and Girl', () => {
    expect(genderOptionsForStage('newborn')).toEqual(['boy', 'girl']);
  });
  test("'surprise' is NOT in newborn options (newborn skip → 'not-set', not 'surprise')", () => {
    expect(genderOptionsForStage('newborn')).not.toContain('surprise');
  });
});
