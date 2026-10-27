import React from 'react';
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LegalPage, P, H2, A, LEGAL_UPDATED } from '../components/legal/LegalPage';
import { WebCheckout, YourPlanCard } from '../components/billing/WebCheckout';
import { PlayCheckout } from '../components/billing/PlayCheckout';
import { playBillingSupported } from '../services/playBilling';
import { useBillingSettings, useEntitlement } from '../hooks/useBilling';
import { activeEarlyAccess } from '../hooks/usePlanAccess';
import { usePlanStore } from '../store/usePlanStore';

const longDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
import type { PaidPlanId } from '../lib/plans';
import { Colors, Fonts } from '../constants/theme';

const PLAY_URL = 'https://play.google.com/store/apps/details?id=in.maamitra.app';

interface Plan {
  id: 'free' | PaidPlanId;
  name: string;
  price: string;
  alt: string;
  tint: string;
  badge?: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '₹0',
    alt: 'Free forever',
    tint: Colors.white,
    features: [
      '5 AI questions a day (text)',
      'Ask by voice',
      'Vaccine schedule (IAP 2023)',
      'Growth, teeth, sleep & diaper logs',
      'First foods & allergy tracking (174 foods)',
      '18 core milestones with red-flag alerts',
      '1 child',
      '16 tiffin recipes · this week\'s meal planner',
      '10 travel meals · 10 Dadi Maa\'s nuskhe',
      '3 yoga sessions · mood tracker',
      'Community, articles & government schemes',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    price: '₹999 / year',
    alt: 'or ₹149 / month',
    tint: '#EFE7FB',
    badge: 'Most popular',
    features: [
      'Everything in Free, plus:',
      '40 AI questions a day',
      'Ask with a photo · hear answers read aloud',
      'Vaccine due-date reminders',
      'Vaccine record as PDF',
      'All 68 milestones + Journey timeline',
      'Up to 2 children',
      '40 tiffin recipes · full meal planner & history',
      '25 travel meals + My Travel Pack',
      '25 Dadi Maa\'s nuskhe · all 9 yoga sessions',
    ],
  },
  {
    id: 'family',
    name: 'Family',
    price: '₹1,799 / year',
    alt: 'or ₹249 / month',
    tint: '#E2EEF8',
    features: [
      'Everything in Plus, plus:',
      'Unlimited AI questions (fair use)',
      '3 or more children',
      'All tiffin recipes',
      'All travel meals',
      'All Dadi Maa\'s nuskhe',
    ],
  },
];

export default function PricingScreen() {
  const settings = useBillingSettings();
  const { entitlement, isActive } = useEntitlement();
  const accountCreatedAt = usePlanStore((st) => st.accountCreatedAt);
  const earlyUntil = activeEarlyAccess(settings, accountCreatedAt);
  // Purchases are web-only: Google Play does not allow selling or linking to
  // web purchases inside the Android app.
  const canBuyHere = Platform.OS === 'web' && settings.webCheckoutEnabled;
  // Android app: Google Play Billing only (Play policy forbids Razorpay in the app).
  const canBuyOnPlay = playBillingSupported && settings.playBillingEnabled;

  return (
    <LegalPage title="Pricing" meta={`Last updated: ${LEGAL_UPDATED}`}>
      {isActive ? (
        <YourPlanCard entitlement={entitlement} />
      ) : (
        <View style={s.notice}>
          <Ionicons name="sparkles-outline" size={18} color={Colors.primary} />
          <Text style={s.noticeText}>
            {earlyUntil !== null && !canBuyOnPlay
              ? `You are an early member: every feature is free until ${longDate(earlyUntil)}. After that, Free-plan limits apply unless you choose a plan. Choose one now and your first payment is on ${longDate(earlyUntil)}.`
              : canBuyOnPlay
              ? 'Choose a plan below. You pay through Google Play, and your plan also works on maamitra.co.in.'
              : canBuyHere
              ? 'Choose a plan below. You pay securely through Razorpay with UPI, card, net banking or a wallet, and your plan works in the app too.'
              : 'MaaMitra is free today, with every feature included. The paid plans below are launching soon; we will tell you in the app before anything changes.'}
          </Text>
        </View>
      )}

      {canBuyHere && !isActive ? <WebCheckout settings={settings} entitlement={entitlement} earlyAccessUntil={earlyUntil} /> : null}
      {canBuyOnPlay && !isActive ? <PlayCheckout settings={settings} earlyAccessUntil={earlyUntil} /> : null}

      {PLANS.map((p) => (
        <View key={p.name} style={[s.plan, { backgroundColor: p.tint }]}>
          {p.badge ? <Text style={s.badge}>{p.badge}</Text> : null}
          <Text style={s.planName}>{p.name}</Text>
          <Text style={s.price}>{p.price}</Text>
          <Text style={s.alt}>{p.alt}</Text>
          <View style={s.divider} />
          {p.features.map((f) => (
            <View key={f} style={s.featRow}>
              <Ionicons name="checkmark" size={16} color="#55663A" style={{ marginTop: 3 }} />
              <Text style={s.feat}>{f}</Text>
            </View>
          ))}
        </View>
      ))}

      <H2>Launch offers</H2>
      <View style={s.offerRow}>
        <View style={[s.offer, { backgroundColor: '#EFE7FB' }]}>
          <Text style={s.offerTitle}>Founding Mothers · ₹699 / year</Text>
          <Text style={s.offerText}>
            Plus for the first {settings.foundingLimit.toLocaleString('en-IN')} mothers, price locked while you stay subscribed.
            {settings.webCheckoutEnabled ? ` ${Math.max(0, settings.foundingLimit - settings.foundingCount).toLocaleString('en-IN')} places left.` : ''}
          </Text>
        </View>
        <View style={[s.offer, { backgroundColor: '#FFF1D6' }]}>
          <Text style={s.offerTitle}>Already with us? 3 months free</Text>
          <Text style={s.offerText}>
            {settings.earlyAccessStart !== null
              ? `Everyone who joined before ${longDate(settings.earlyAccessStart)} gets every feature free until ${longDate(settings.earlyAccessStart + settings.earlyAccessDays * 86400000)}.`
              : 'Everyone who joins before paid plans launch gets every feature free for 3 months from launch day.'}
          </Text>
        </View>
        <View style={[s.offer, { backgroundColor: '#E6EDD9' }]}>
          <Text style={s.offerTitle}>7-day free trial</Text>
          <Text style={s.offerText}>Try Plus free. Cancel before the trial ends and you won't be charged.</Text>
        </View>
      </View>

      <H2>Good to know</H2>
      <P>Prices are in Indian rupees and include GST. Yearly plans save about 44% compared with paying monthly.</P>
      <P>Paid plans renew automatically until you cancel. You can cancel any time and keep your plan until the end of the period you paid for.</P>
      {Platform.OS === 'web' ? (
        <P>On the website, payments go through Razorpay (cards, UPI, net banking and wallets). A plan bought on the website works in the app on the same account.</P>
      ) : (
        <P>In the Android app, plans are billed by Google Play and managed in the Play Store → Payments & subscriptions. Your plan works on every device where you sign in with the same account.</P>
      )}
      <P>
        See our <A href="/refund">Refund & Cancellation Policy</A> and <A href="/terms">Terms & Conditions</A>.
        MaaMitra never shows ads. AI answers are guidance, not medical advice.
      </P>

      <TouchableOpacity
        onPress={() => Linking.openURL(PLAY_URL)}
        style={s.cta}
        activeOpacity={0.85}
        accessibilityRole="link"
        accessibilityLabel="Get MaaMitra on Google Play"
      >
        <Ionicons name="logo-google-playstore" size={18} color={Colors.white} />
        <Text style={s.ctaText}>Get MaaMitra on Google Play</Text>
      </TouchableOpacity>
    </LegalPage>
  );
}

const s = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  noticeText: { flex: 1, fontFamily: Fonts.sansMedium, fontSize: 14, lineHeight: 21, color: Colors.textDark },
  plan: { borderRadius: 20, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: Colors.borderSoft },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    color: Colors.white,
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  planName: { fontFamily: Fonts.serif, fontSize: 22, color: Colors.textDark },
  price: { fontFamily: Fonts.sansBold, fontSize: 26, color: Colors.textDark, marginTop: 4 },
  alt: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: 'rgba(28,16,51,0.08)', marginVertical: 14 },
  featRow: { flexDirection: 'row', gap: 8, marginBottom: 7 },
  feat: { flex: 1, fontFamily: Fonts.sansRegular, fontSize: 14, lineHeight: 21, color: '#374151' },
  offerRow: { gap: 12 },
  offer: { borderRadius: 16, padding: 16 },
  offerTitle: { fontFamily: Fonts.sansBold, fontSize: 15, color: Colors.textDark, marginBottom: 4 },
  offerText: { fontFamily: Fonts.sansRegular, fontSize: 13, lineHeight: 19, color: '#4B5563' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingVertical: 15,
    marginTop: 18,
  },
  ctaText: { fontFamily: Fonts.sansBold, fontSize: 15, color: Colors.white },
});
