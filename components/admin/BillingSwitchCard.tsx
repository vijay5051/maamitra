import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from '../../services/firebase';
import { logAdminAction } from '../../services/audit';
import { BillingSettings, DEFAULT_BILLING_SETTINGS, subscribeBillingSettings } from '../../services/billing';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors, Fonts } from '../../constants/theme';

type Key = 'webCheckoutEnabled' | 'trialEnabled' | 'foundingOfferEnabled';

export function BillingSwitchCard() {
  const user = useAuthStore((s) => s.user);
  const [settings, setSettings] = useState<BillingSettings>(DEFAULT_BILLING_SETTINGS);
  const [saving, setSaving] = useState<Key | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeBillingSettings(setSettings), []);

  const toggle = async (key: Key, value: boolean) => {
    if (!db || !user) return;
    setSaving(key);
    setError(null);
    try {
      const patch =
        key === 'foundingOfferEnabled'
          ? { foundingOffer: { enabled: value, limit: settings.foundingLimit } }
          : { [key]: value };
      await setDoc(doc(db, 'app_settings/billing'), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
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
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

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
});
