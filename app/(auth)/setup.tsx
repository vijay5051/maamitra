import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, {
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';
import { saveFullProfile } from '../../services/firebase';
import SuccessCheck from '../../components/ui/SuccessCheck';
import GradientButton from '../../components/ui/GradientButton';
import { Colors, Fonts } from '../../constants/theme';
import { requestNotificationPermission } from '../../lib/requestNotificationPermission';

/**
 * Post-onboarding setup screen.
 *
 * Owns the Firestore persistence step that used to live inline in the
 * onboarding submit handler. Why a dedicated screen:
 *   1. Gives the network write a guaranteed UI window so a slow connection
 *      never silently fails behind a router.replace().
 *   2. Lets us flip the local `onboardingComplete` flag ONLY after Firestore
 *      confirms — keeping local + remote in lockstep so the dreaded
 *      "onboarding form re-appears on every cold start" loop can't recur
 *      even if the write is slow.
 *   3. Surfaces failures with a real Retry button instead of a swallowed
 *      .catch().
 *
 * The onboarding form has already mutated the Zustand stores (motherName,
 * profile, kids…) before navigating here, so this screen just reads from
 * useProfileStore.getState() and persists.
 */

const STATUS_MESSAGES = [
  'Saving your profile…',
  'Building your ecosystem…',
  'Personalising your experience…',
  'Almost ready…',
];

type Phase = 'saving' | 'success' | 'notify' | 'error';

export default function SetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('saving');
  const [statusIdx, setStatusIdx] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const startedRef = useRef(false);

  const runSave = async () => {
    setPhase('saving');
    setErrorMsg('');
    setStatusIdx(0);
    try {
      const authUser = useAuthStore.getState().user;
      if (!authUser?.uid) {
        throw new Error('You appear to be signed out — please sign in again.');
      }
      const st = useProfileStore.getState();
      // 15s ceiling so a stalled Firestore write surfaces a real Retry
      // button instead of an indefinite spinner. Common on poor mobile
      // connections during onboarding.
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('Slow connection — your profile didn\'t save in time. Tap Retry.')),
          15000,
        );
      });
      await Promise.race([
        saveFullProfile(authUser.uid, {
          motherName: st.motherName,
          profile: st.profile,
          kids: st.kids,
          completedVaccines: st.completedVaccines,
          onboardingComplete: true,
          parentGender: st.parentGender,
          bio: st.bio,
          expertise: st.expertise,
          photoUrl: st.photoUrl,
          visibilitySettings: st.visibilitySettings,
        }),
        timeoutPromise,
      ]);
      // Local flag flips ONLY after Firestore confirms.
      useProfileStore.getState().setOnboardingComplete(true);
      setPhase('success');
      // Brief success moment, then transition to the reminders opt-in.
      // Phone OTP is no longer a hard gate — users can add and verify
      // their number later from Profile → Settings.
      setTimeout(() => setPhase('notify'), 900);
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Something went wrong while saving.');
      setPhase('error');
    }
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    runSave();
  }, []);

  // Cycle status messages while saving so the user knows we're still working.
  useEffect(() => {
    if (phase !== 'saving') return;
    const t = setInterval(() => {
      setStatusIdx((i) => Math.min(i + 1, STATUS_MESSAGES.length - 1));
    }, 1400);
    return () => clearInterval(t);
  }, [phase]);

  const goBackToOnboarding = () => {
    (router.replace as any)('/(auth)/onboarding');
  };

  // Compute a friendly, concrete preview of what we'd remind them about.
  // Falls back to a generic line if we don't yet have a kid name on file
  // (e.g. expecting parent without a chosen name).
  const reminderPreview = (() => {
    const kids = useProfileStore.getState().kids ?? [];
    const firstKidName = kids.find((k) => k?.name && !k.isExpecting)?.name?.trim();
    if (firstKidName) return `daily routine and milestone reminders for ${firstKidName}`;
    return 'daily routine and milestone reminders';
  })();

  const handleEnableReminders = async () => {
    const uid = useAuthStore.getState().user?.uid;
    setPhase('notify'); // keep phase, the helper is async
    try {
      await requestNotificationPermission(uid);
    } catch {}
    (router.replace as any)('/(tabs)');
  };

  const handleSkipReminders = () => {
    (router.replace as any)('/(tabs)');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        {phase === 'saving' && (
          <Reanimated.View entering={FadeIn.duration(300)} style={styles.center}>
            <View style={styles.iconCircle}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
            <Text style={styles.heading}>Setting things up</Text>
            <Reanimated.Text
              key={statusIdx}
              entering={FadeIn.duration(220)}
              exiting={FadeOut.duration(160)}
              style={styles.status}
            >
              {STATUS_MESSAGES[statusIdx]}
            </Reanimated.Text>
            <Text style={styles.helper}>
              This usually takes a few seconds. Please keep the app open.
            </Text>
          </Reanimated.View>
        )}

        {phase === 'success' && (
          <Reanimated.View entering={FadeIn.duration(280)} style={styles.center}>
            <SuccessCheck size={88} />
            <Text style={styles.heading}>All set!</Text>
            <Text style={styles.status}>Welcome to MaaMitra ✨</Text>
          </Reanimated.View>
        )}

        {phase === 'notify' && (
          <Reanimated.View entering={FadeIn.duration(280)} style={styles.center}>
            <View style={styles.iconCircle}>
              <Ionicons name="notifications-outline" size={36} color={Colors.primary} />
            </View>
            <Text style={styles.heading}>Stay on top of the little things</Text>
            <Text style={styles.notifyBody}>
              Allow notifications and we'll send {reminderPreview} so you never
              miss a vaccine date or feeding window.
            </Text>
            <View style={styles.errorBtns}>
              <GradientButton
                title="Yes, remind me"
                onPress={handleEnableReminders}
                style={styles.retryBtn}
              />
              <TouchableOpacity onPress={handleSkipReminders} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Not now</Text>
              </TouchableOpacity>
            </View>
          </Reanimated.View>
        )}

        {phase === 'error' && (
          <Reanimated.View entering={FadeIn.duration(280)} style={styles.center}>
            <View style={[styles.iconCircle, styles.iconCircleError]}>
              <Ionicons name="cloud-offline-outline" size={36} color="#ef4444" />
            </View>
            <Text style={styles.heading}>Couldn't save your profile</Text>
            <Text style={styles.status}>{errorMsg}</Text>
            <Text style={styles.helper}>
              Your answers are still here. Tap Retry to try again, or go back
              to review them.
            </Text>
            <View style={styles.errorBtns}>
              <GradientButton title="Retry" onPress={runSave} style={styles.retryBtn} />
              <TouchableOpacity onPress={goBackToOnboarding} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Back to my answers</Text>
              </TouchableOpacity>
            </View>
          </Reanimated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAFAFB',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconCircleError: {
    backgroundColor: '#FEE2E2',
  },
  heading: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    color: '#1C1033',
    letterSpacing: -0.4,
    marginBottom: 6,
    textAlign: 'center',
  },
  status: {
    fontFamily: Fonts.sansMedium,
    fontSize: 15,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 18,
  },
  helper: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 320,
  },
  notifyBody: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 340,
    marginBottom: 22,
  },
  errorBtns: {
    width: '100%',
    marginTop: 8,
    alignItems: 'center',
    gap: 6,
  },
  retryBtn: {
    width: '100%',
    maxWidth: 320,
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  secondaryBtnText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: '#6b7280',
  },
});
