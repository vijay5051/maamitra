import { useProfileStore } from '../../../store/useProfileStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { saveFullProfile } from '../../../services/firebase';
import type { KidFoodAllergies } from '../../../lib/foodAllergies';

/**
 * Save one child's allergy list: local store first (persisted), then the
 * same full-profile write the rest of the app uses so it syncs to Firebase.
 */
export function saveKidAllergies(kidId: string, value: KidFoodAllergies): void {
  useProfileStore.getState().updateKid(kidId, { foodAllergies: value });
  const uid = useAuthStore.getState().user?.uid;
  if (!uid) return;
  const s = useProfileStore.getState();
  saveFullProfile(uid, {
    motherName: s.motherName,
    profile: s.profile,
    kids: s.kids,
    completedVaccines: s.completedVaccines,
    onboardingComplete: s.onboardingComplete,
    photoUrl: s.photoUrl || '',
    parentGender: s.parentGender || '',
    bio: s.bio || '',
    expertise: s.expertise || [],
    visibilitySettings: s.visibilitySettings,
  }).catch((err) => console.warn('saveFullProfile (food allergies) failed:', err));
}
