/**
 * useFeedbackStore — tracks local state for the tester-feedback survey.
 *
 * We store:
 *   - `installedAt`: ISO string set on first app open. Lets us gate the
 *     auto-prompt to users who've had the app for N days, so the survey
 *     arrives after they've actually formed an opinion.
 *   - `submittedAt`: set once a user submits. Prevents re-asking.
 *   - `dismissedAt`: set when a user taps "later". We re-ask after a
 *     cooldown (7 days) rather than never again — most ignored prompts
 *     just weren't the right moment.
 *
 * Firestore doc write is a one-shot call into services/firebase.ts; this
 * store is local-only (AsyncStorage via zustand/persist), matching the
 * useProfileStore pattern.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTO_PROMPT_AFTER_DAYS = 3;
const DISMISS_COOLDOWN_DAYS = 7;

// Allowlisted tester emails bypass the install-age and dismiss cooldown
// gates so we can exercise the survey flow on demand during beta. The
// submittedAt block still applies — once they've submitted, subsequent
// opens must go through the manual entry in profile sheet → Share
// feedback. Clear localStorage (`maamitra-feedback`) to re-test.
const TESTER_EMAILS = new Set<string>([
  'rocking.vsr@gmail.com',
]);

export function isTester(email?: string | null): boolean {
  return !!email && TESTER_EMAILS.has(email.toLowerCase());
}

interface FeedbackState {
  installedAt: string | null;
  submittedAt: string | null;
  dismissedAt: string | null;
  /** Non-persisted flag. Setting it true asks the root layout to mount the
   *  survey modal — lets any screen request the survey without prop-drilling. */
  manualOpen: boolean;
  markInstalledIfNeeded: () => void;
  markSubmitted: () => void;
  markDismissed: () => void;
  openSurvey: () => void;
  closeSurvey: () => void;
  shouldAutoPrompt: (email?: string | null) => boolean;
}

function daysSince(iso: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return 0;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

export const useFeedbackStore = create<FeedbackState>()(
  persist(
    (set, get) => ({
      installedAt: null,
      submittedAt: null,
      dismissedAt: null,
      manualOpen: false,

      markInstalledIfNeeded: () => {
        if (!get().installedAt) set({ installedAt: new Date().toISOString() });
      },

      markSubmitted: () => set({ submittedAt: new Date().toISOString(), manualOpen: false }),

      markDismissed: () => set({ dismissedAt: new Date().toISOString() }),

      openSurvey: () => set({ manualOpen: true }),
      closeSurvey: () => set({ manualOpen: false }),

      shouldAutoPrompt: (email) => {
        const s = get();
        if (s.submittedAt) return false;
        // Testers skip the install-age and dismiss cooldown entirely so we
        // can re-trigger the modal on demand during beta.
        if (isTester(email)) return true;
        if (daysSince(s.installedAt) < AUTO_PROMPT_AFTER_DAYS) return false;
        if (s.dismissedAt && daysSince(s.dismissedAt) < DISMISS_COOLDOWN_DAYS) return false;
        return true;
      },
    }),
    {
      name: 'maamitra-feedback',
      storage: createJSONStorage(() => AsyncStorage),
      // manualOpen is session-only — never persist it or the survey would
      // pop up every cold start if a user force-quit during display.
      partialize: (state) => ({
        installedAt: state.installedAt,
        submittedAt: state.submittedAt,
        dismissedAt: state.dismissedAt,
      }) as any,
    },
  ),
);
