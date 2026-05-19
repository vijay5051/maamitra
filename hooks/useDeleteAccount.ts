/**
 * useDeleteAccount — the ONE allowed way to delete an account anywhere.
 *
 * Owns: confirmation modal, loading overlay, atomic state reset (via
 * useAuthStore.deleteAccount), success overlay, explicit redirect.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { logAuthEvent } from '../lib/authObservability';

type Stage = 'idle' | 'confirm-open' | 'deleting' | 'deleted';

export function useDeleteAccount() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const open = useCallback(() => setStage('confirm-open'), []);
  const cancel = useCallback(() => setStage('idle'), []);

  const performDelete = useCallback(async () => {
    const uid = useAuthStore.getState().user?.uid;
    setStage('deleting');
    logAuthEvent({ type: 'auth:delete-started', uid });
    try {
      await useAuthStore.getState().deleteAccount();
      logAuthEvent({ type: 'auth:delete-completed', uid });
      setStage('deleted');
      timerRef.current = setTimeout(() => {
        setStage('idle');
        router.replace('/(auth)/welcome');
      }, 1200);
    } catch (err: any) {
      const errorMsg = String(err?.message ?? err);
      const code = err?.code ?? '';
      const reason: 'stale-session' | 'network' | 'unknown' =
        code === 'auth/requires-recent-login' || errorMsg.includes('requires-recent-login')
          ? 'stale-session'
          : code === 'auth/network-request-failed' || errorMsg.toLowerCase().includes('network')
          ? 'network'
          : 'unknown';
      logAuthEvent({ type: 'auth:delete-failed', uid, error: errorMsg, reason });
      console.error('useDeleteAccount error:', err);
      setStage('idle');
      // User-facing error via Alert.alert (cross-platform reliable since
      // it's coming from a JS event handler, not a layout/initial render)
      Alert.alert(
        'Could not delete account',
        reason === 'stale-session'
          ? 'For security, please sign out and sign back in, then try deleting your account again.'
          : reason === 'network'
          ? "We couldn't reach our servers. Check your connection and try again."
          : 'Something went wrong. Please try again, or email info@maamitra.co.in.',
      );
    }
  }, [router]);

  return {
    stage,
    isConfirmOpen: stage === 'confirm-open',
    overlayState: stage === 'deleting' ? 'deleting' as const : stage === 'deleted' ? 'deleted' as const : 'idle' as const,
    open,
    cancel,
    confirm: performDelete,
  } as const;
}
