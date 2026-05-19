import { describe, expect, test, beforeEach, afterEach, spyOn } from 'bun:test';
import { logAuthEvent, AuthEvent } from '../lib/authObservability';

describe('logAuthEvent', () => {
  let warnSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    warnSpy = spyOn(console, 'warn');
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test('emits structured event with type prefix', () => {
    logAuthEvent({ type: 'auth:transition', from: 'UNAUTHED', to: 'PHONE_GATE' });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[auth:transition]'),
      expect.objectContaining({ from: 'UNAUTHED', to: 'PHONE_GATE' })
    );
  });

  test('includes timestamp in payload', () => {
    logAuthEvent({ type: 'auth:signout-started' });
    const call = warnSpy.mock.calls[0];
    expect(call[1]).toHaveProperty('ts');
    expect(typeof call[1].ts).toBe('number');
  });

  test('strips PII from email field', () => {
    logAuthEvent({ type: 'auth:google-success', uid: 'abc', email: 'priya@example.com' });
    const call = warnSpy.mock.calls[0];
    expect(call[1].email).toBe('p***@example.com');
  });
});
