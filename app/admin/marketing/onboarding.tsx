/**
 * Marketing Studio — first-visit onboarding wizard.
 *
 * Forced once per account when `marketing_brand/main.onboardedAt` is null.
 * 90-second 3-step flow:
 *   1. Welcome — what the studio does, plain English
 *   2. Brand vibe — name + voice line + accent colour
 *   3. Done — sets onboardedAt, drops admin into Today
 *
 * Meta connection isn't a wizard step today — IG and FB are pre-wired
 * server-side via the System User token (see HANDOFF), so showing a
 * "connect" step would either lie or confuse. Once user-driven OAuth
 * lands, insert it as step 2.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  ActivityIndicator,
  Platform,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';
import { fetchBrandKit, saveBrandKit } from '../../../services/marketing';
import { BrandKit, DEFAULT_VOICE } from '../../../lib/marketingTypes';
import { useAuthStore } from '../../../store/useAuthStore';

type Step = 1 | 2 | 3;

const TOTAL_STEPS = 3;

// Small set of suggested accent colours so the admin doesn't have to think.
// Each pair is name → hex. Values come from the existing illustration set
// so any pick stays on-brand.
const ACCENT_OPTIONS: { name: string; hex: string }[] = [
  { name: 'Brand purple', hex: '#7C3AED' },
  { name: 'Warm peach',   hex: '#F8C8DC' },
  { name: 'Sage green',   hex: '#B7D8B5' },
  { name: 'Soft ochre',   hex: '#F4C97A' },
  { name: 'Lavender',     hex: '#C9B6F2' },
  { name: 'Rose pink',    hex: '#E91E63' },
];

export default function MarketingOnboardingScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 700;

  const [step, setStep] = useState<Step>(1);
  const [brand, setBrand] = useState<BrandKit | null>(null);
  const [name, setName] = useState('MaaMitra');
  const [voiceLine, setVoiceLine] = useState('warm, gentle, evidence-based');
  const [accent, setAccent] = useState('#7C3AED');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchBrandKit().then((k) => {
      if (k) {
        setBrand(k);
        setName(k.brandName);
        if (k.palette?.primary) setAccent(k.palette.primary);
        if (k.voice?.attributes?.length) setVoiceLine(k.voice.attributes.join(', '));
      }
    });
  }, []);

  async function finish() {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const attrs = voiceLine
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5);

      await saveBrandKit(
        { uid: user.uid, email: user.email },
        {
          brandName: name.trim() || 'MaaMitra',
          palette: {
            ...(brand?.palette ?? { background: '#FFF8F2', text: '#1F1F2C', accent: '#F8C8DC' }),
            primary: accent,
          },
          voice: {
            ...DEFAULT_VOICE,
            ...(brand?.voice ?? {}),
            attributes: attrs.length > 0 ? attrs : DEFAULT_VOICE.attributes,
          },
          // Sentinel: services/marketing converts any non-empty string to
          // serverTimestamp on write.
          onboardedAt: 'now' as any,
        },
      );
      router.replace('/admin/marketing' as any);
    } catch (e: any) {
      setError("Couldn't save — try again. Your internet may be off.");
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Welcome to Marketing Studio' }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.bgLight }}
        contentContainerStyle={[styles.body, isWide && styles.bodyWide]}
      >
        <View style={[styles.card, isWide && styles.cardWide]}>
          {/* Progress bar */}
          <View style={styles.progressRow}>
            {[1, 2, 3].map((s) => (
              <View
                key={s}
                style={[
                  styles.progressDot,
                  s <= step && styles.progressDotActive,
                  s === step && styles.progressDotCurrent,
                ]}
              />
            ))}
            <View style={{ flex: 1 }} />
            <Text style={styles.progressLabel}>Step {step} of {TOTAL_STEPS}</Text>
          </View>

          {step === 1 ? (
            <Step1Welcome onNext={() => setStep(2)} />
          ) : step === 2 ? (
            <Step2BrandVibe
              name={name} setName={setName}
              voiceLine={voiceLine} setVoiceLine={setVoiceLine}
              accent={accent} setAccent={setAccent}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          ) : (
            <Step3Done
              name={name}
              accent={accent}
              voiceLine={voiceLine}
              saving={saving}
              error={error}
              onBack={() => setStep(2)}
              onFinish={() => void finish()}
            />
          )}
        </View>
      </ScrollView>
    </>
  );
}

// ── Step 1: Welcome ─────────────────────────────────────────────────────────

function Step1Welcome({ onNext }: { onNext: () => void }) {
  return (
    <>
      <View style={styles.heroBubble}>
        <Ionicons name="sparkles" size={36} color={Colors.primary} />
      </View>
      <Text style={styles.title}>Welcome to Marketing Studio</Text>
      <Text style={styles.subtitle}>
        Plan, post, and reply across Instagram and Facebook — all from here. No more switching apps.
      </Text>

      <View style={styles.featureList}>
        <Feature icon="add-circle-outline" title="Make posts in minutes" body="Pick an image, write a caption, schedule. We'll keep it on-brand." />
        <Feature icon="calendar-outline" title="See everything on a calendar" body="Drag and drop to reschedule. Spot empty days at a glance." />
        <Feature icon="chatbubbles-outline" title="One inbox for all replies" body="Comments and DMs from Instagram and Facebook in one place." />
        <Feature icon="bar-chart-outline" title="Know what's working" body="Reach, engagement, top posts — explained in plain English." />
      </View>

      <Pressable onPress={onNext} style={styles.primaryBtn} accessibilityRole="button">
        <Text style={styles.primaryBtnLabel}>Let's set up your brand</Text>
        <Ionicons name="arrow-forward" size={18} color={Colors.white} />
      </Pressable>

      <Text style={styles.helper}>Takes about 90 seconds.</Text>
    </>
  );
}

function Feature({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  return (
    <View style={styles.feature}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={18} color={Colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureBody}>{body}</Text>
      </View>
    </View>
  );
}

// ── Step 2: Brand vibe ──────────────────────────────────────────────────────

function Step2BrandVibe({
  name, setName, voiceLine, setVoiceLine, accent, setAccent, onBack, onNext,
}: {
  name: string; setName: (v: string) => void;
  voiceLine: string; setVoiceLine: (v: string) => void;
  accent: string; setAccent: (v: string) => void;
  onBack: () => void; onNext: () => void;
}) {
  const valid = name.trim().length > 0 && voiceLine.trim().length > 0;
  return (
    <>
      <Text style={styles.title}>Your brand vibe</Text>
      <Text style={styles.subtitle}>
        These shape every post we generate. Change anytime in Settings.
      </Text>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Brand name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="MaaMitra"
          style={styles.input}
          maxLength={60}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>How does your brand sound?</Text>
        <Text style={styles.fieldHint}>3 short words, comma-separated.</Text>
        <TextInput
          value={voiceLine}
          onChangeText={setVoiceLine}
          placeholder="warm, gentle, evidence-based"
          style={styles.input}
          maxLength={120}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Pick an accent colour</Text>
        <Text style={styles.fieldHint}>Used for buttons, badges, and highlights on your posts.</Text>
        <View style={styles.swatchGrid}>
          {ACCENT_OPTIONS.map((opt) => {
            const selected = opt.hex.toLowerCase() === accent.toLowerCase();
            return (
              <Pressable
                key={opt.hex}
                onPress={() => setAccent(opt.hex)}
                style={[styles.swatch, selected && styles.swatchSelected]}
                accessibilityLabel={`Pick ${opt.name}`}
                accessibilityState={{ selected }}
              >
                <View style={[styles.swatchDot, { backgroundColor: opt.hex }]} />
                <Text style={[styles.swatchName, selected && styles.swatchNameSelected]}>{opt.name}</Text>
                {selected ? <Ionicons name="checkmark" size={14} color={Colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Pressable onPress={onBack} style={styles.ghostBtn}>
          <Ionicons name="arrow-back" size={18} color={Colors.textDark} />
          <Text style={styles.ghostBtnLabel}>Back</Text>
        </Pressable>
        <Pressable
          onPress={valid ? onNext : undefined}
          disabled={!valid}
          style={[styles.primaryBtn, !valid && styles.primaryBtnDisabled, { flex: 1 }]}
        >
          <Text style={styles.primaryBtnLabel}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color={Colors.white} />
        </Pressable>
      </View>
    </>
  );
}

// ── Step 3: Done ────────────────────────────────────────────────────────────

function Step3Done({
  name, accent, voiceLine, saving, error, onBack, onFinish,
}: {
  name: string; accent: string; voiceLine: string;
  saving: boolean; error: string | null;
  onBack: () => void; onFinish: () => void;
}) {
  return (
    <>
      <View style={[styles.heroBubble, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
        <Ionicons name="checkmark-circle" size={36} color={Colors.success} />
      </View>
      <Text style={styles.title}>You're all set, {name}</Text>
      <Text style={styles.subtitle}>
        We'll use these to keep every post on-brand. Tweak anytime in Settings.
      </Text>

      <View style={styles.summaryCard}>
        <SummaryRow label="Brand" value={name} />
        <SummaryRow label="Voice" value={voiceLine} />
        <SummaryRow
          label="Accent"
          value={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[styles.swatchDot, { backgroundColor: accent }]} />
              <Text style={styles.summaryValue}>{accent.toUpperCase()}</Text>
            </View>
          }
        />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        <Pressable onPress={onBack} disabled={saving} style={styles.ghostBtn}>
          <Ionicons name="arrow-back" size={18} color={Colors.textDark} />
          <Text style={styles.ghostBtnLabel}>Back</Text>
        </Pressable>
        <Pressable
          onPress={saving ? undefined : onFinish}
          disabled={saving}
          style={[styles.primaryBtn, { flex: 1 }, saving && styles.primaryBtnDisabled]}
        >
          {saving ? (
            <>
              <ActivityIndicator size="small" color={Colors.white} />
              <Text style={styles.primaryBtnLabel}>Saving…</Text>
            </>
          ) : (
            <>
              <Text style={styles.primaryBtnLabel}>Open Marketing Studio</Text>
              <Ionicons name="rocket-outline" size={18} color={Colors.white} />
            </>
          )}
        </Pressable>
      </View>
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      {typeof value === 'string' ? <Text style={styles.summaryValue}>{value}</Text> : value}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  body: {
    padding: Spacing.md,
    paddingTop: Spacing.xxl,
    paddingBottom: 80,
    alignItems: 'center',
  },
  bodyWide: { paddingHorizontal: Spacing.xxxl },

  card: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1, borderColor: Colors.borderSoft,
    gap: Spacing.lg,
    ...Shadow.sm,
  },
  cardWide: { padding: Spacing.xxxl },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.borderSoft },
  progressDotActive: { backgroundColor: Colors.primary },
  progressDotCurrent: { width: 24, borderRadius: 4 },
  progressLabel: { fontSize: FontSize.xs, color: Colors.textLight, fontWeight: '600' },

  heroBubble: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center',
  },

  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textDark, letterSpacing: -0.4, textAlign: 'center' },
  subtitle: { fontSize: FontSize.md, color: Colors.textLight, lineHeight: 22, textAlign: 'center' },

  featureList: { gap: Spacing.md },
  feature: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  featureIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  featureTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  featureBody: { fontSize: FontSize.sm, color: Colors.textLight, lineHeight: 18 },

  field: { gap: 6 },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  fieldHint: { fontSize: FontSize.xs, color: Colors.textLight, marginBottom: 4 },
  input: {
    backgroundColor: Colors.bgLight,
    borderWidth: 1, borderColor: Colors.borderSoft,
    borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: FontSize.md, color: Colors.textDark,
    outlineStyle: 'none' as any,
  },

  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.bgLight,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  swatchSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  swatchDot: { width: 16, height: 16, borderRadius: 8 },
  swatchName: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textDark },
  swatchNameSelected: { color: Colors.primary, fontWeight: '700' },

  actionsRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14, paddingHorizontal: 20,
    borderRadius: Radius.md,
  },
  primaryBtnDisabled: { backgroundColor: Colors.textMuted },
  primaryBtnLabel: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
    backgroundColor: Colors.cardBg,
  },
  ghostBtnLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },

  helper: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: -Spacing.sm },

  summaryCard: {
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
    gap: 10,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  summaryValue: { fontSize: FontSize.sm, color: Colors.textDark, fontWeight: '600' },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: Spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.error,
  },
  errorText: { fontSize: FontSize.xs, color: Colors.error, fontWeight: '600' },
});
