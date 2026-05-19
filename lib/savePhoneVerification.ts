/**
 * savePhoneVerification — shared post-OTP-verify work.
 *
 * Called by both:
 *   - SmartInputCard (phone-primary path: welcome → inline OTP)
 *   - phone.tsx (Google → phone link path)
 *
 * Writes phone + phoneVerified to local Zustand state and Firestore,
 * then returns the correct destination for the caller to router.replace into.
 */

import { useProfileStore } from '../store/useProfileStore';
import { saveUserProfile } from '../services/firebase';

export type PhoneVerificationDestination = '/(tabs)' | '/(auth)/onboarding';

export async function savePhoneVerification(args: {
  uid: string;
  e164: string;
  verified: boolean;
}): Promise<PhoneVerificationDestination> {
  const { uid, e164, verified } = args;

  // Update Zustand immediately so gate reads are current before navigation.
  useProfileStore.getState().setPhone(e164);
  useProfileStore.getState().setPhoneVerified(verified);

  try {
    await saveUserProfile(uid, { phone: e164, phoneVerified: verified });
  } catch (err) {
    console.error('savePhoneVerification: saveUserProfile failed:', err);
  }

  const onboardingComplete = useProfileStore.getState().onboardingComplete;
  return onboardingComplete ? '/(tabs)' : '/(auth)/onboarding';
}
