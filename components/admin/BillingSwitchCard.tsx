import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import { doc, onSnapshot, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';

import { db } from '../../services/firebase';
import { logAdminAction } from '../../services/audit';
import { BillingSettings, DEFAULT_BILLING_SETTINGS, subscribeBillingSettings } from '../../services/billing';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors, Fonts } from '../../constants/theme';
import { EARLY_ACCESS_DAYS } from '../../lib/plans';

type Key = 'webCheckoutEnabled' | 'trialEnabled' | 'foundingOfferEnabled' | 'locksWeb' | 'locksApp' | 'playBillingEnabled';

export function BillingSwitchCard() {
  const user = useAuthStore((s) => s.user);
  const [settings, setSettings] = useState<BillingSettings>(DEFAULT_BILLING_SETTINGS);
  const [saving, setSaving] = useState<Key | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeBillingSettings(setSettings), []);

  // Last Razorpay webhook call (written by the server), so a wrong secret is visible here.
  const [webhook, setWebhook] = useState<{ outcome: string; event: string | null; at: number | null; lastOkAt: number | null; detail: string | null } | null>(null);
  useEffect(() => {
    if (!db) return;
    return onSnapshot(
      doc(db, 'billing_meta/webhook_status'),
      (snap) => {
        const d = snap.data();
        const ms = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : null);
        setWebhook(d ? { outcome: String(d.outcome ?? ''), event: d.event ?? null, at: ms(d.at), lastOkAt: ms(d.lastOkAt), detail: d.detail ?? null } : null);
      },
      () => setWebhook(null),
    );
  }, []);

  const toggle = async (key: Key, value: boolean) => {
    if (!db || !user) return;
    setSaving(key);
    setError(null);
    try {
      const patch =
        key === 'foundingOfferEnabled'
          ? { foundingOffer: { enabled: value, limit: settings.foundingLimit } }
          : key === 'locksWeb'
            ? { locks: { web: value } }
            : key === 'locksApp'
              ? { locks: { app: value } }
              : key === 'playBillingEnabled'
                ? { playBilling: { enabled: value } }
                : { [key]: value };
      // The first time plan locks go on, stamp the launch: every account created
      // before it is an early member with everything free for EARLY_ACCESS_DAYS.
      const startsEarlyAccess = (key === 'locksWeb' || key === 'locksApp') && value && settings.earlyAccessStart === null;
      const early = startsEarlyAccess ? { earlyAccess: { start: serverTimestamp(), days: EARLY_ACCESS_DAYS } } : {};
      await setDoc(doc(db, 'app_settings/billing'), { ...patch, ...early, updatedAt: serverTimestamp() }, { merge: true });
      await logAdminAction({ uid: user.uid, email: user.email }, 'integration.update', { label: `billing.${key}` }, { value }).catch(() => {});
    } catch (e: any) {
      setError(e?.message ?? 'Could not save.');
    } finally {
      setSaving(null);
    }
  };

  const Row = ({ k, label, hint }: { k: Key; label: string; hint: string }) => (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <Text style={s.label}>{label}</Text>
        <Text style={s.hint}>{hint}</Text>
      </View>
      {saving === k ? (
        <ActivityIndicator color={Colors.primary} />
      ) : (
        <Switch value={settings[k]} onValueChange={(v) => toggle(k, v)} />
      )}
    </View>
  );

  return (
    <View style={s.card}>
      <Text style={s.title}>Paid plans · website checkout</Text>
      <Row
        k="webCheckoutEnabled"
        label={settings.webCheckoutEnabled ? 'Checkout is ON' : 'Checkout is OFF'}
        hint="Shows Choose Plus / Family on maamitra.co.in/pricing. Turn on only after a full test purchase in Razorpay test mode."
      />
      <Row k="trialEnabled" label="7-day free trial for Plus" hint="New Plus subscribers are charged after 7 days. One trial per account." />
      <Row
        k="foundingOfferEnabled"
        label="Founding Mothers offer"
        hint={`Plus yearly at ₹699. ${settings.foundingCount.toLocaleString('en-IN')} of ${settings.foundingLimit.toLocaleString('en-IN')} places taken.`}
      />
      <Row
        k="locksWeb"
        label={settings.locksWeb ? 'Plan locks ON (website)' : 'Plan locks OFF (website)'}
        hint="Free users on maamitra.co.in get Free-plan limits. Turn on together with checkout."
      />
      <Row
        k="playBillingEnabled"
        label={settings.playBillingEnabled ? 'Android in-app purchases ON' : 'Android in-app purchases OFF'}
        hint="Google Play Billing in the Android app (needs the new app build and the Play Console subscriptions). Test with a Play licence tester first."
      />
      <Row
        k="locksApp"
        label={settings.locksApp ? 'Plan locks ON (app)' : 'Plan locks OFF (app)'}
        hint="Turn on only after Android in-app purchases work. Otherwise app users lose features with no way to pay."
      />
      <Text style={s.hint}>
        {settings.earlyAccessStart !== null
          ? `Early members: accounts created before ${longDate(settings.earlyAccessStart)} have every feature free until ${longDate(settings.earlyAccessStart + settings.earlyAccessDays * 86400000)}.`
          : `Early members: the first time you turn plan locks on, everyone who already has an account gets every feature free for ${EARLY_ACCESS_DAYS / 30} months from that moment.`}
      </Text>
      <Text style={[s.hint, webhook && webhook.outcome !== 'ok' ? s.webhookBad : null]}>
        {webhookLine(webhook)}
      </Text>
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

const WEBHOOK_OUTCOMES: Record<string, string> = {
  ok: 'received and applied',
  'invalid-signature': 'REJECTED: the Webhook Secret here does not match the secret on the webhook in Razorpay',
  'no-secret': 'REJECTED: no Webhook Secret saved here yet',
  'no-signature': 'REJECTED: the request had no Razorpay signature',
  error: 'received but could not be applied',
};

function webhookLine(w: { outcome: string; event: string | null; at: number | null; lastOkAt: number | null; detail: string | null } | null): string {
  if (!w || !w.at) return 'Razorpay webhook: nothing received yet. Razorpay sends one after each subscription payment or change.';
  const when = new Date(w.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const what = WEBHOOK_OUTCOMES[w.outcome] ?? w.outcome;
  const last = w.outcome !== 'ok' && w.lastOkAt ? ` Last success: ${new Date(w.lastOkAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.` : '';
  return `Last Razorpay webhook (${when}${w.event ? `, ${w.event}` : ''}): ${what}.${w.detail ? ` ${w.detail}` : ''}${last}`;
}

const longDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    padding: 14,
    marginTop: -4,
    marginBottom: 12,
    gap: 12,
  },
  title: { fontFamily: Fonts.sansBold, fontSize: 14, color: Colors.textDark },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { fontFamily: Fonts.sansBold, fontSize: 13, color: Colors.textDark },
  hint: { fontFamily: Fonts.sansRegular, fontSize: 12, lineHeight: 17, color: Colors.textMuted, marginTop: 2 },
  error: { fontFamily: Fonts.sansMedium, fontSize: 12, color: '#B42318' },
  webhookBad: { color: '#B42318', fontFamily: Fonts.sansMedium },
});
