export type ProfileLoadStatus = 'ok' | 'missing' | 'error';

export interface ReturningUserSnapshot {
  onboardingComplete: boolean;
  motherName?: string;
  phone?: string;
  phoneVerified?: boolean;
}

export interface ExistingAccountFallbackInput {
  status: ProfileLoadStatus;
  currentAuthUid?: string | null;
  targetUid: string;
  creationTime?: string | null;
  now?: number;
}

/**
 * Single source of truth for whether a persisted per-uid snapshot is strong
 * enough to keep a returning user out of onboarding during a flaky restore.
 */
export function canTrustKnownProfileSnapshot(
  snapshot?: ReturningUserSnapshot | null
): boolean {
  return !!snapshot?.onboardingComplete;
}

/**
 * When Firestore still errors after retries, treat obviously old accounts as
 * existing users rather than routing them into onboarding again. This is a
 * last-resort fallback for auth/session restore races.
 */
export function shouldAssumeExistingAccountFromAuth(
  input: ExistingAccountFallbackInput
): boolean {
  if (input.status !== 'error') return false;
  if (!input.currentAuthUid || input.currentAuthUid !== input.targetUid) return false;
  if (!input.creationTime) return false;

  const createdAt = new Date(input.creationTime).getTime();
  if (!Number.isFinite(createdAt)) return false;

  const now = input.now ?? Date.now();
  return now - createdAt > 2 * 60 * 1000;
}
