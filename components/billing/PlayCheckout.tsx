import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Fonts } from '../../constants/theme';
import { useAuthStore } from '../../store/useAuthStore';
import { BillingSettings } from '../../services/billing';
import { buyOnPlay, loadPlayOptions, PlayOption, PlayPurchaseCancelled } from '../../services/playBilling';
import { BillingInterval, PaidPlanId, PLAN_NAMES, TRIAL_DAYS } from '../../lib/plans';

const longDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

const friendly = (e: unknown) => {
  const msg = (e as { message?: string })?.message;
  return msg && !/firebase|functions\//i.test(msg) ? msg : 'Something went wrong. You have not been charged. Please try again.';
};

/**
 * Android only: buy Plus or Family through Google Play. Prices come from
 * Google (localised, tax included). Google decides trial eligibility.
 */
export function PlayCheckout({
  settings,
  earlyAccessUntil = null,
  onDone,
}: {
  settings: BillingSettings;
  earlyAccessUntil?: number | null;
  onDone?: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const [options, setOptions] = useState<PlayOption[] | null>(null);
  const [period, setPeriod] = useState<BillingInterval>('yearly');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    loadPlayOptions()
      .then((o) => alive && setOptions(o))
      .catch(() => alive && setOptions([]));
    return () => {
      alive = false;
    };
  }, []);

  if (!user) return null;
  if (options === null) {
    return (
      <View style={s.box}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }
  if (options.length === 0) {
    return (
      <View style={s.box}>
        <Text style={s.boxText}>Plans could not be loaded from Google Play. Check that you are signed in to the Play Store and try again later.</Text>
      </View>
    );
  }
  if (done) {
    return (
      <View style={s.box}>
        <Text style={s.boxTitle}>Thank you!</Text>
        <Text style={s.boxText}>Your plan is active. It also works on maamitra.co.in with the same account.</Text>
      </View>
    );
  }

  const foundingLeft = Math.max(0, settings.foundingLimit - settings.foundingCount);
  const find = (plan: PaidPlanId, interval: BillingInterval, founding = false) =>
    options.find((o) => o.plan === plan && o.interval === interval && o.founding === founding);
  const founding = settings.foundingOfferEnabled && foundingLeft > 0 && period === 'yearly' ? find('plus', 'yearly', true) : undefined;

  const buy = async (o: PlayOption) => {
    const key = `${o.plan}-${o.interval}-${o.founding}`;
    setBusy(key);
    setError(null);
    try {
      await buyOnPlay(o, user.uid);
      setDone(true);
      onDone?.();
    } catch (e) {
      if (!(e instanceof PlayPurchaseCancelled)) setError(friendly(e));
    } finally {
      setBusy(null);
    }
  };

  const PlanButton = ({ plan }: { plan: PaidPlanId }) => {
    const o = find(plan, period);
    if (!o) return null;
    const key = `${o.plan}-${o.interval}-false`;
    return (
      <TouchableOpacity
        style={[s.primary, plan === 'family' && s.secondary]}
        onPress={() => buy(o)}
        disabled={busy !== null}
        accessibilityRole="button"
      >
        {busy === key ? (
          <ActivityIndicator color={plan === 'family' ? Colors.primary : Colors.white} />
        ) : (
          <Text style={[s.primaryText, plan === 'family' && s.secondaryText]}>
            {o.trial ? `Start ${TRIAL_DAYS}-day free trial · Plus` : `Choose ${PLAN_NAMES[plan]}`} · {o.displayPrice}/{period === 'yearly' ? 'yr' : 'mo'}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const anyTrial = options.some((o) => o.trial);

  return (
    <View style={s.box}>
      {earlyAccessUntil !== null ? (
        <Text style={s.early}>
          You are an early member: every feature is free until {longDate(earlyAccessUntil)}. Google Play starts charging the day you subscribe, so you may prefer to wait.
        </Text>
      ) : null}
      <View style={s.toggle}>
        {(['yearly', 'monthly'] as BillingInterval[]).map((i) => (
          <TouchableOpacity
            key={i}
            style={[s.toggleBtn, period === i && s.toggleOn]}
            onPress={() => setPeriod(i)}
            accessibilityRole="button"
            accessibilityState={{ selected: period === i }}
          >
            <Text style={[s.toggleText, period === i && s.toggleTextOn]}>{i === 'yearly' ? 'Yearly · save 44%' : 'Monthly'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {founding ? (
        <TouchableOpacity style={s.founding} onPress={() => buy(founding)} disabled={busy !== null} accessibilityRole="button">
          {busy === 'plus-yearly-true' ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Text style={s.foundingTitle}>Founding Mothers · Plus for {founding.displayPrice}/yr</Text>
              <Text style={s.foundingText}>{foundingLeft.toLocaleString('en-IN')} places left · price locked while you stay subscribed</Text>
            </>
          )}
        </TouchableOpacity>
      ) : null}

      <PlanButton plan="plus" />
      <PlanButton plan="family" />

      {anyTrial ? (
        <Text style={s.small}>The free trial is for Plus. Google Play charges you only after {TRIAL_DAYS} days. Cancel before then in the Play Store and you pay nothing.</Text>
      ) : null}
      <Text style={s.small}>Billed by Google Play. Plans renew automatically; cancel any time in the Play Store → Payments & subscriptions.</Text>
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
  early: { fontFamily: Fonts.sansMedium, fontSize: 13, lineHeight: 19, color: Colors.primary },
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
});
