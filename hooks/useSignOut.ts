/**
 * useSignOut — the ONE allowed way to sign out anywhere in the app.
 *
 * Owns: confirmation modal, loading overlay, atomic state reset,
 * success overlay, explicit redirect. Replaces every raw
 * `useAuthStore.signOut()` callsite.
 *
 * Grep test in tests/grep-signout.test.ts enforces that no other
 * file calls `signOut()` from `useAuthStore` directly.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';

type Stage = 'idle' | 'confirm-open' | 'signing-out' | 'signed-out';

export function useSignOut() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const open = useCallback(() => setStage('confirm-open'), []);
  const cancel = useCallback(() => setStage('idle'), []);

  const performSignOut = useCallback(async () => {
    setStage('signing-out');
    try {
      await useAuthStore.getState().signOut();
      setStage('signed-out');
      // Hold the success overlay 1200ms so any in-flight tab renders
      // settle before we navigate. Prevents the historical "onboarding
      // form flashes during signout" bug.
      timerRef.current = setTimeout(() => {
        setStage('idle');
        router.replace('/(auth)/welcome');
      }, 1200);
    } catch (err) {
      console.error('useSignOut error:', err);
      setStage('idle');
      throw err;
    }
  }, [router]);

  return {
    stage,
    isConfirmOpen: stage === 'confirm-open',
    overlayState: stage === 'signing-out' ? 'signing-out' as const : stage === 'signed-out' ? 'signed-out' as const : 'idle' as const,
    open,
    cancel,
    confirm: performSignOut,
  } as const;
}
