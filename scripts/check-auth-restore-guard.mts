import assert from 'node:assert/strict';

import {
  canTrustKnownProfileSnapshot,
  shouldAssumeExistingAccountFromAuth,
} from '../lib/returningUserAuthGuard.ts';

const now = Date.parse('2026-05-01T12:00:00.000Z');

assert.equal(
  canTrustKnownProfileSnapshot({ onboardingComplete: true, motherName: 'Asha' }),
  true,
  'A known onboarded uid must stay out of onboarding during a flaky restore.'
);

assert.equal(
  canTrustKnownProfileSnapshot({ onboardingComplete: false }),
  false,
  'A truly incomplete profile must not skip onboarding.'
);

assert.equal(
  shouldAssumeExistingAccountFromAuth({
    status: 'error',
    currentAuthUid: 'uid-1',
    targetUid: 'uid-1',
    creationTime: '2026-05-01T11:30:00.000Z',
    now,
  }),
  true,
  'An older account with a transient Firestore error should be treated as returning.'
);

assert.equal(
  shouldAssumeExistingAccountFromAuth({
    status: 'missing',
    currentAuthUid: 'uid-1',
    targetUid: 'uid-1',
    creationTime: '2026-05-01T11:30:00.000Z',
    now,
  }),
  false,
  'A definitively missing doc must still flow to onboarding.'
);

assert.equal(
  shouldAssumeExistingAccountFromAuth({
    status: 'error',
    currentAuthUid: 'uid-1',
    targetUid: 'uid-1',
    creationTime: '2026-05-01T11:59:30.000Z',
    now,
  }),
  false,
  'Fresh accounts must not be misclassified as returning users.'
);

assert.equal(
  shouldAssumeExistingAccountFromAuth({
    status: 'error',
    currentAuthUid: 'uid-2',
    targetUid: 'uid-1',
    creationTime: '2026-05-01T11:30:00.000Z',
    now,
  }),
  false,
  'A mismatch between auth uid and target uid must not unlock the fallback.'
);

console.log('Auth restore guard checks passed.');
