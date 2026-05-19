import { describe, expect, test, beforeEach } from 'bun:test';
import { useProfileStore } from '../store/useProfileStore';

describe('dismissedPrompts', () => {
  beforeEach(() => {
    useProfileStore.getState().resetProfile();
  });

  test('starts empty', () => {
    expect(useProfileStore.getState().dismissedPrompts).toEqual({});
  });

  test('dismissPrompt(key) sets the key to true', () => {
    useProfileStore.getState().dismissPrompt('diet');
    expect(useProfileStore.getState().dismissedPrompts.diet).toBe(true);
  });

  test('isPromptDismissed(key) reads the map', () => {
    useProfileStore.getState().dismissPrompt('state');
    expect(useProfileStore.getState().isPromptDismissed('state')).toBe(true);
    expect(useProfileStore.getState().isPromptDismissed('diet')).toBe(false);
  });

  test('resetProfile clears dismissedPrompts', () => {
    useProfileStore.getState().dismissPrompt('diet');
    useProfileStore.getState().resetProfile();
    expect(useProfileStore.getState().dismissedPrompts).toEqual({});
  });
});
