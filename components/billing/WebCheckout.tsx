import React, { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Fonts } from '../../constants/theme';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';
import {
  BillingSettings,
  cancelWebSubscription,
  CheckoutDismissed,
  Entitlement,
  startWebCheckout,
} from '../../services/billing';
import {
  BillingInterval,
  FOUNDING_PLUS_YEARLY,
  PaidPlanId,
  PLAN_NAMES,
  PLAN_PRICES,
  PLAY_PRODUCTS,
  TRIAL_DAYS,
} from '../../lib/plans';
import { SUPPORT_EMAIL } from '../legal/LegalPage';
import { openPlaySubscriptions, playBillingSupported } from '../../services/playBilling';

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const longDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

const GENERIC_ERROR = 'Something went wrong. You have not been charged. Please try again.';
const OPAQUE_CODES = new Set(['functions/internal', 'functions/unavailable', 'functions/unknown', 'functions/deadline-exceeded']);

// Server errors (HttpsError) carry messages written for customers; anything else
// (SDK, network) is replaced with a plain retry message.
function errorText(e: unknown): string {
  const { code, message } = (e ?? {}) as { code?: string; message?: string };
  if (!message) return GENERIC_ERROR;
  if (code?.startsWith('functions/')) return OPAQUE_CODES.has(code) ? GENERIC_ERROR : message;
  if (code || /firebase/i.test(message)) return GENERIC_ERROR;
  return message;
}

export function WebCheckout({
  settings,
  entitlement,
  earlyAccessUntil = null,
}: {
  settings: BillingSettings;
  entitlement: Entitlement;
  /** Early member still in the free period: no trial, first payment when it ends. */
  earlyAccessUntil?: number | null;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const phone = useProfileStore((s) => s.phone);
  const [period, setPeriod] = useState<BillingInterval>('yearly');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  const trialOffered = earlyAccessUntil === null && settings.trialEnabled && !entitlement.trialUsed;
  const foundingLeft = Math.max(0, settings.foundingLimit - settings.foundingCount);
  const foundingOpen = settings.foundingOfferEnabled && foundingLeft > 0;

  if (!user) {
    return (
      <View style={s.box}>
        <Text style={s.boxTitle}>Sign in to choose a plan</Text>
        <Text style={s.boxText}>Your plan is linked to your MaaMitra account, so it works on the website and in the app.</Text>
        <TouchableOpacity style={s.primary} onPress={() => router.push('/(auth)/welcome')} accessibilityRole="button">
          <Text style={s.primaryText}>Sign in or create an account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (activating) {
    return (
      <View style={s.box}>
        <ActivityIndicator color={Colors.primary} />
        <Text style={[s.boxTitle, { marginTop: 10 }]}>Payment received</Text>
        <Text style={s.boxText}>We're activating your plan. This usually takes a few seconds; you can keep using MaaMitra meanwhile.</Text>
      </View>
    );
  }

  const buy = async (plan: PaidPlanId, chosen: BillingInterval, founding: boolean) => {
    const key = `${plan}-${chosen}-${founding}`;
    setBusy(key);
    setError(null);
    try {
      const price = founding ? FOUNDING_PLUS_YEARLY : PLAN_PRICES[plan][chosen];
      await startWebCheckout({
        plan,
        interval: chosen,
        founding,
        description: `${PLAN_NAMES[plan]} · ${rupees(price)} / ${chosen === 'yearly' ? 'year' : 'month'}`,
        prefill: { name: user.name || undefined, email: user.email || undefined, contact: phone || undefined },
      });
      setActivating(true);
    } catch (e) {
      if (!(e instanceof CheckoutDismissed)) setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const PlanButton = ({ plan }: { plan: PaidPlanId }) => {
    const key = `${plan}-${period}-false`;
    const price = PLAN_PRICES[plan][period];
    const trial = plan === 'plus' && trialOffered;
    return (
      <TouchableOpacity
        style={[s.primary, plan === 'family' && s.secondary]}
        onPress={() => buy(plan, period, false)}
        disabled={busy !== null}
        accessibilityRole="button"
      >
        {busy === key ? (
          <ActivityIndicator color={plan === 'family' ? Colors.primary : Colors.white} />
        ) : (
          <Text style={[s.primaryText, plan === 'family' && s.secondaryText]}>
            {trial ? `Start ${TRIAL_DAYS}-day free trial · Plus` : `Choose ${PLAN_NAMES[plan]}`} · {rupees(price)}/{period === 'yearly' ? 'yr' : 'mo'}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.box}>
      <View style={s.toggle}>
        {(['yearly', 'monthly'] as BillingInterval[]).map((i) => (
          <TouchableOpacity
            key={i}
            style={[s.toggleBtn, period === i && s.toggleOn]}
            onPress={() => setPeriod(i)}
            accessibilityRole="button"
            accessibilityState={{ selected: period === i }}
          >
            <Text style={[s.toggleText, period === i && s.toggleTextOn]}>
              {i === 'yearly' ? 'Yearly · save 44%' : 'Monthly'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {foundingOpen && period === 'yearly' ? (
        <TouchableOpacity
          style={s.founding}
          onPress={() => buy('plus', 'yearly', true)}
          disabled={busy !== null}
          accessibilityRole="button"
        >
          {busy === 'plus-yearly-true' ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Text style={s.foundingTitle}>Founding Mothers · Plus for {rupees(FOUNDING_PLUS_YEARLY)}/yr</Text>
              <Text style={s.foundingText}>
                {foundingLeft.toLocaleString('en-IN')} places left · price locked while you stay subscribed
              </Text>
            </>
          )}
        </TouchableOpacity>
      ) : null}

      <PlanButton plan="plus" />
      <PlanButton plan="family" />

      {earlyAccessUntil !== null ? (
        <Text style={s.small}>
          You are an early member, so you pay nothing now. You authorise payment today and your first payment is on {longDate(earlyAccessUntil)}, when your free period ends. Cancel before then and you pay nothing.
        </Text>
      ) : null}
      {trialOffered ? (
        <Text style={s.small}>
          The free trial is for Plus. You authorise payment now and are charged only after {TRIAL_DAYS} days. Cancel before then and you pay nothing.
        </Text>
      ) : null}
      <Text style={s.small}>Plans renew automatically. Cancel any time from this page.</Text>
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

export function YourPlanCard({ entitlement }: { entitlement: Entitlement }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = Date.now();
  const inTrial = !!entitlement.trialEndsAt && entitlement.trialEndsAt > now && entitlement.status === 'authenticated';
  // Early member who subscribed during the free period: first charge on activeUntil.
  const inEarlyFree = entitlement.earlyAccessDeferred && entitlement.status === 'authenticated' && (entitlement.activeUntil ?? 0) > now;
  const until = entitlement.activeUntil ?? now;
  const price =
    entitlement.plan === 'free' || !entitlement.interval
      ? null
      : entitlement.founding
        ? FOUNDING_PLUS_YEARLY
        : PLAN_PRICES[entitlement.plan][entitlement.interval];

  let line: string;
  if (entitlement.cancelAtPeriodEnd) {
    line = inTrial
      ? `Cancelled. Your free trial runs until ${longDate(until)} and you won't be charged.`
      : inEarlyFree
        ? `Cancelled. Everything stays free until ${longDate(until)} and you won't be charged.`
        : `Cancelled. Your plan stays active until ${longDate(until)}.`;
  } else if (inEarlyFree) {
    line = `Free as an early member until ${longDate(until)}. Your first payment${price ? ` of ${rupees(price)}` : ''} is on that day.`;
  } else if (inTrial) {
    line = `Free trial until ${longDate(until)}. Your first payment${price ? ` of ${rupees(price)}` : ''} is on that day.`;
  } else if (entitlement.status === 'pending' || entitlement.status === 'in_grace_period') {
    line = entitlement.source === 'play'
      ? "Google Play couldn't take your last payment. Update your payment method in the Play Store; your plan stays active meanwhile."
      : "We couldn't take your last payment. Razorpay will try again, and your plan stays active meanwhile.";
  } else {
    line = `Renews on ${longDate(until)}${price ? ` · ${rupees(price)}` : ''}.`;
  }

  const cancel = async () => {
    const ok = typeof window !== 'undefined' && typeof window.confirm === 'function'
      ? window.confirm('Cancel your plan? You keep it until the end of the period you have paid for, and you will not be charged again.')
      : true;
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await cancelWebSubscription();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.box}>
      <View style={s.planHead}>
        <Ionicons name="star" size={18} color={Colors.primary} />
        <Text style={s.boxTitle}>
          Your plan: {PLAN_NAMES[entitlement.plan]}
          {entitlement.interval ? ` (${entitlement.interval})` : ''}
          {entitlement.founding ? ' · Founding Mother' : ''}
        </Text>
      </View>
      <Text style={s.boxText}>{line}</Text>
      {Platform.OS === 'web' && entitlement.source === 'razorpay' && !entitlement.cancelAtPeriodEnd ? (
        <TouchableOpacity style={s.link} onPress={cancel} disabled={busy} accessibilityRole="button">
          {busy ? <ActivityIndicator color={Colors.primary} /> : <Text style={s.linkText}>Cancel renewal</Text>}
        </TouchableOpacity>
      ) : null}
      {entitlement.source === 'play' ? (
        playBillingSupported ? (
          <TouchableOpacity style={s.link} onPress={() => openPlaySubscriptions(PLAY_PRODUCTS[entitlement.plan as PaidPlanId])} accessibilityRole="button">
            <Text style={s.linkText}>Manage in Google Play</Text>
          </TouchableOpacity>
        ) : (
          <Text style={s.small}>Bought in the Android app: change or cancel it in the Google Play Store → Payments & subscriptions.</Text>
        )
      ) : null}
      {entitlement.source === 'razorpay' && Platform.OS !== 'web' ? (
        <Text style={s.small}>To change or cancel your plan, email {SUPPORT_EMAIL}.</Text>
      ) : null}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  boxTitle: { fontFamily: Fonts.sansBold, fontSize: 16, color: Colors.textDark },
  boxText: { fontFamily: Fonts.sansRegular, fontSize: 14, lineHeight: 21, color: '#374151' },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggle: { flexDirection: 'row', backgroundColor: Colors.bgLight, borderRadius: 999, padding: 4, gap: 4 },
  toggleBtn: { flex: 1, borderRadius: 999, paddingVertical: 9, alignItems: 'center' },
  toggleOn: { backgroundColor: Colors.primary },
  toggleText: { fontFamily: Fonts.sansBold, fontSize: 13, color: Colors.textDark },
  toggleTextOn: { color: Colors.white },
  founding: { backgroundColor: '#5E4680', borderRadius: 16, padding: 14, alignItems: 'center' },
  foundingTitle: { fontFamily: Fonts.sansBold, fontSize: 15, color: Colors.white, textAlign: 'center' },
  foundingText: { fontFamily: Fonts.sansRegular, fontSize: 12, color: '#E9DFF6', marginTop: 3, textAlign: 'center' },
  primary: { backgroundColor: Colors.primary, borderRadius: 999, paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center' },
  primaryText: { fontFamily: Fonts.sansBold, fontSize: 14, color: Colors.white, textAlign: 'center' },
  secondary: { backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.primary },
  secondaryText: { color: Colors.primary },
  small: { fontFamily: Fonts.sansRegular, fontSize: 12, lineHeight: 18, color: Colors.textMuted },
  error: { fontFamily: Fonts.sansMedium, fontSize: 13, color: '#B42318' },
  link: { alignSelf: 'flex-start', paddingVertical: 4 },
  linkText: { fontFamily: Fonts.sansBold, fontSize: 14, color: Colors.primary, textDecorationLine: 'underline' },
});
