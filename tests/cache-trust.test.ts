import { describe, expect, test, beforeEach } from 'bun:test';
import { useProfileStore } from '../store/useProfileStore';

describe('isCacheTrustedFor', () => {
  beforeEach(() => {
    useProfileStore.getState().resetProfile();
  });

  test('returns false when cachedProfileUid is empty', () => {
    expect(useProfileStore.getState().isCacheTrustedFor('user-a')).toBe(false);
  });

  test('returns true when cache matches uid', () => {
    useProfileStore.setState({ cachedProfileUid: 'user-a' });
    expect(useProfileStore.getState().isCacheTrustedFor('user-a')).toBe(true);
  });

  test('returns false when cache uid differs', () => {
    useProfileStore.setState({ cachedProfileUid: 'user-a' });
    expect(useProfileStore.getState().isCacheTrustedFor('user-b')).toBe(false);
  });

  test('returns false after resetProfile clears the cache', () => {
    useProfileStore.setState({ cachedProfileUid: 'user-a' });
    useProfileStore.getState().resetProfile();
    expect(useProfileStore.getState().isCacheTrustedFor('user-a')).toBe(false);
  });
});
