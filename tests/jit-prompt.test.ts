/**
 * Smoke tests for the JIT prompt dismissal contract.
 *
 * The full rendering is covered by manual QA — these tests assert the
 * persistent-state half: dismissPrompt(key) sets, isPromptDismissed(key)
 * reads, resetProfile clears.
 */
import { describe, expect, test, beforeEach } from 'bun:test';
import { useProfileStore } from '../store/useProfileStore';

describe('JIT prompt dismissal semantics', () => {
  beforeEach(() => useProfileStore.getState().resetProfile());

  test('shouldShow when key not yet answered/dismissed', () => {
    expect(useProfileStore.getState().isPromptDismissed('diet')).toBe(false);
  });
  test('shouldShow=false after dismiss', () => {
    useProfileStore.getState().dismissPrompt('diet');
    expect(useProfileStore.getState().isPromptDismissed('diet')).toBe(true);
  });
  test('dismissing one key does not affect another', () => {
    useProfileStore.getState().dismissPrompt('diet');
    expect(useProfileStore.getState().isPromptDismissed('state')).toBe(false);
  });
  test('resetProfile clears all dismissed prompts', () => {
    useProfileStore.getState().dismissPrompt('diet');
    useProfileStore.getState().dismissPrompt('state');
    useProfileStore.getState().resetProfile();
    expect(useProfileStore.getState().isPromptDismissed('diet')).toBe(false);
    expect(useProfileStore.getState().isPromptDismissed('state')).toBe(false);
  });
});
