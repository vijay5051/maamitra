import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';

import JustInTimePrompt from '../jit/JustInTimePrompt';
import { useAuthStore } from '../../store/useAuthStore';
import { usePlanStore } from '../../store/usePlanStore';
import { activeEarlyAccess } from '../../hooks/usePlanAccess';
import { isEntitlementActive } from '../../services/billing';
import { Colors, Fonts, Spacing } from '../../constants/theme';

const longDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Home-screen card announcing paid plans, shown once plans are on sale on this
 * platform to everyone without a paid plan, until they tap See plans or close it.
 */
export function PlansLaunchBanner() {
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const settings = usePlanStore((s) => s.settings);
  const entitlement = usePlanStore((s) => s.entitlement);
  const accountCreatedAt = usePlanStore((s) => s.accountCreatedAt);

  const onSale = Platform.OS === 'web' ? settings.webCheckoutEnabled : settings.playBillingEnabled;
  const visible = !!uid && onSale && !isEntitlementActive(entitlement);
  const early = activeEarlyAccess(settings, accountCreatedAt);

  return (
    <JustInTimePrompt
      promptKey="plansLaunch-2026-11"
      question="MaaMitra Plus is here 💜"
      reason={
        early !== null
          ? `As a thank-you for being with us early, every feature stays free for you until ${longDate(early)}. After that, choose Free, Plus or Family.`
          : 'Get more AI answers, vaccine reminders, every recipe and more. Compare Free, Plus and Family.'
      }
      visible={visible}
    >
      <Pressable style={styles.button} onPress={() => router.push('/pricing')} accessibilityRole="button">
        <Text style={styles.buttonText}>See plans</Text>
      </Pressable>
    </JustInTimePrompt>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
  },
  buttonText: { fontFamily: Fonts.sansBold, fontSize: 14, color: Colors.white },
});
