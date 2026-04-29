// Hook that resolves the signed-in user's admin role.
//
// Pulls users/{uid}.adminRole from Firestore (cached for the session) and
// falls back to the email allow-list (= 'super'). Returns null if the user
// isn't an admin at all.

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { AdminRole, isAdminEmail, resolveAdminRole } from './admin';

export function useAdminRole(): AdminRole | null {
  const { user } = useAuthStore();
  const [role, setRole] = useState<AdminRole | null>(() => {
    return user && isAdminEmail(user.email) ? 'super' : null;
  });

  useEffect(() => {
    if (!user || !db) {
      setRole(null);
      return;
    }
    if (isAdminEmail(user.email)) {
      // Founder allow-list — always super, no need to read Firestore.
      setRole('super');
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => setRole(resolveAdminRole(user.email, snap.data() as any)),
      () => setRole(null),
    );
    return () => unsub();
  }, [user]);

  return role;
}
