/**
 * Admin · Marketing brand kit editor.
 *
 * Single Firestore doc at marketing_brand/main. Drives every rendered
 * post (logo overlay, palette, fonts) and every AI-generated caption
 * (voice attributes, words to avoid, weekly theme calendar). Editing
 * here changes the next post the cron generates — no re-deploy needed.
 *
 * Logo upload is URL-paste in Phase 1 (the asset pipeline integrates
 * with Firebase Storage in Phase 2 alongside the renderer). Everything
 * else is fully editable today.
 */
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';
import { AdminPage, EmptyState, ToolbarButton } from '../../../components/admin/ui';
import { fetchBrandKit, saveBrandKit } from '../../../services/marketing';
import {
  BrandKit,
  BrandPalette,
  DEFAULT_HASHTAGS,
  defaultBrandKit,
  WeekDay,
} from '../../../lib/marketingTypes';
import { useAuthStore } from '../../../store/useAuthStore';

const WEEKDAY_ORDER: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const WEEKDAY_LABELS: Record<WeekDay, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

const BILINGUAL_OPTIONS: { value: BrandKit['voice']['bilingual']; label: string; hint: string }[] = [
  { value: 'english_only',       label: 'English only',         hint: 'Captions in English. Good for global brand feel.' },
  { value: 'hinglish',            label: 'Hinglish (default)',   hint: 'English with Hindi words mixed in. What most Indian moms speak.' },
  { value: 'devanagari_accents',  label: 'English + Devanagari', hint: 'English captions with select हिंदी words for emotional moments.' },
];

export default function BrandKitScreen() {
  const { user: actor } = useAuthStore();

  const [kit, setKit] = useState<BrandKit>(() => defaultBrandKit());
  const [originalKit, setOriginalKit] = useState<BrandKit | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const k = await fetchBrandKit();
      const seed = k ?? defaultBrandKit();
      setKit(seed);
      setOriginalKit(seed);
      setSavedAt(seed.updatedAt);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!actor) return;
    setSaving(true);
    setError(null);
    try {
      await saveBrandKit(actor, {
        brandName: kit.brandName,
        logoUrl: kit.logoUrl,
        palette: kit.palette,
        fonts: kit.fonts,
        voice: kit.voice,
        themeCalendar: kit.themeCalendar,
        hashtags: kit.hashtags,
        defaultPostTime: kit.defaultPostTime,
      });
      await load();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    if (originalKit) setKit(originalKit);
  }

  const dirty =
    !!originalKit && JSON.stringify(stripMeta(kit)) !== JSON.stringify(stripMeta(originalKit));

  return (
    <>
      <Stack.Screen options={{ title: 'Brand kit' }} />
      <AdminPage
        title="Brand kit"
        description="Locks the look and voice of every auto-generated post. Edits take effect on the next draft the cron produces."
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Marketing', href: '/admin/marketing' },
          { label: 'Brand kit' },
        ]}
        headerActions={
          <>
            <ToolbarButton label="Reset" icon="refresh" onPress={reset} disabled={!dirty || saving} />
            <ToolbarButton
              label={saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
              icon="checkmark"
              variant="primary"
              onPress={save}
              disabled={!dirty || saving}
            />
          </>
        }
        loading={loading && !originalKit}
        error={error}
      >
        {savedAt ? (
          <Text style={styles.savedLine}>
            Last updated {new Date(savedAt).toLocaleString('en-IN')}
            {kit.updatedBy ? ` · by ${kit.updatedBy}` : ''}
          </Text>
        ) : (
          <EmptyState kind="empty" title="Not saved yet" body="Configure the kit and hit Save — the daily generator will start using these the next time it runs." compact />
        )}

        {/* ── Identity ──────────────────────────────────────────────────── */}
        <Section title="Identity">
          <Field
            label="Brand name *"
            hint="Shown on rendered posts and in the AI's signature."
            value={kit.brandName}
            onChange={(brandName) => setKit({ ...kit, brandName })}
          />
          <Field
            label="Logo URL"
            hint="Public URL to a square PNG/SVG. Best results: 1080×1080, transparent background. Drag-and-drop upload ships in Phase 2."
            value={kit.logoUrl ?? ''}
            onChange={(v) => setKit({ ...kit, logoUrl: v.trim() || null })}
          />
          {kit.logoUrl ? (
            <View style={styles.logoPreview}>
              <Image source={{ uri: kit.logoUrl }} style={styles.logoImg} resizeMode="contain" />
              <Text style={styles.logoCaption}>Preview · stamped on every rendered asset</Text>
            </View>
          ) : null}
        </Section>

        {/* ── Palette ──────────────────────────────────────────────────── */}
        <Section title="Palette" description="Used by every template. Stick to brand colours moms associate with you.">
          <View style={styles.swatchRow}>
            {(['primary', 'background', 'text', 'accent'] as (keyof BrandPalette)[]).map((key) => (
              <Swatch
                key={key}
                label={key}
                value={kit.palette[key]}
                onChange={(hex) => setKit({ ...kit, palette: { ...kit.palette, [key]: hex } })}
              />
            ))}
          </View>
          <View style={[styles.paletteSample, { backgroundColor: kit.palette.background, borderColor: kit.palette.accent }]}>
            <Text style={[styles.paletteSampleHead, { color: kit.palette.primary }]}>Tip Tuesday</Text>
            <Text style={[styles.paletteSampleBody, { color: kit.palette.text }]}>
              Place baby on their back to sleep — एक छोटी आदत जो SIDS का खतरा कम करती है।
            </Text>
          </View>
        </Section>

        {/* ── Fonts ───────────────────────────────────────────────────── */}
        <Section title="Fonts" description="Both must be loadable by Satori in the renderer (Phase 2). Inter ships with the engine — anything else needs a font file added.">
          <Field
            label="Heading font"
            value={kit.fonts.heading}
            onChange={(heading) => setKit({ ...kit, fonts: { ...kit.fonts, heading } })}
          />
          <Field
            label="Body font"
            value={kit.fonts.body}
            onChange={(body) => setKit({ ...kit, fonts: { ...kit.fonts, body } })}
          />
        </Section>

        {/* ── Voice ───────────────────────────────────────────────────── */}
        <Section title="Voice" description="Steers every AI-generated caption.">
          <ChipField
            label="Voice attributes"
            hint="3–5 short adjectives the AI keeps in mind."
            values={kit.voice.attributes}
            onChange={(attributes) => setKit({ ...kit, voice: { ...kit.voice, attributes } })}
            placeholder="e.g. warm"
          />
          <ChipField
            label="Words to avoid"
            hint="Banned words / phrases. Caught by the safety screen before a draft enters the queue."
            values={kit.voice.avoid}
            onChange={(avoid) => setKit({ ...kit, voice: { ...kit.voice, avoid } })}
            placeholder="e.g. miracle"
          />
          <Text style={styles.fieldLabel}>Bilingual mix</Text>
          <View style={{ gap: Spacing.xs }}>
            {BILINGUAL_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setKit({ ...kit, voice: { ...kit.voice, bilingual: opt.value } })}
                style={[styles.radioRow, kit.voice.bilingual === opt.value && styles.radioRowActive]}
              >
                <View style={[styles.radioDot, kit.voice.bilingual === opt.value && styles.radioDotActive]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.radioLabel}>{opt.label}</Text>
                  <Text style={styles.radioHint}>{opt.hint}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </Section>

        {/* ── Theme calendar ──────────────────────────────────────────── */}
        <Section title="Weekly theme calendar" description="One theme per weekday. Disabled days produce no drafts — useful if you want to skip Sundays, for instance.">
          <View style={{ gap: Spacing.sm }}>
            {WEEKDAY_ORDER.map((day) => (
              <ThemeRow
                key={day}
                day={day}
                value={kit.themeCalendar[day]}
                onChange={(t) => setKit({ ...kit, themeCalendar: { ...kit.themeCalendar, [day]: t } })}
              />
            ))}
          </View>
        </Section>

        {/* ── Hashtags + posting time ─────────────────────────────────── */}
        <Section title="Defaults">
          <ChipField
            label="Default hashtags"
            hint="Appended to every caption (you can still override per-draft). Aim for 8–12 — Instagram caps at 30."
            values={kit.hashtags}
            onChange={(hashtags) => setKit({ ...kit, hashtags })}
            placeholder="#MaaMitra"
          />
          {kit.hashtags.length === 0 ? (
            <Pressable onPress={() => setKit({ ...kit, hashtags: DEFAULT_HASHTAGS })}>
              <Text style={styles.linkText}>Use the suggested set</Text>
            </Pressable>
          ) : null}
          <Field
            label="Default post time (IST, 24h)"
            hint="The cron schedules new drafts for this slot unless you override per-post. Format HH:mm."
            value={kit.defaultPostTime}
            onChange={(defaultPostTime) => setKit({ ...kit, defaultPostTime })}
          />
        </Section>
      </AdminPage>
    </>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description ? <Text style={styles.sectionDesc}>{description}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Field({ label, hint, value, onChange }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChange}
        placeholder={label.replace(' *', '')}
        placeholderTextColor={Colors.textMuted}
        autoCapitalize="none"
      />
    </View>
  );
}

function Swatch({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  return (
    <View style={styles.swatchCol}>
      <View style={[styles.swatchSquare, { backgroundColor: value }]} />
      <Text style={styles.swatchLabel}>{label}</Text>
      <TextInput
        style={styles.swatchInput}
        value={value}
        onChangeText={(v) => {
          const trimmed = v.trim();
          if (trimmed.startsWith('#') && trimmed.length === 7) onChange(trimmed);
          else if (!trimmed.startsWith('#') && trimmed.length === 6) onChange(`#${trimmed}`);
          else onChange(trimmed); // sanitiser will catch invalid on save
        }}
        autoCapitalize="characters"
        maxLength={7}
      />
    </View>
  );
}

function ChipField({ label, hint, values, onChange, placeholder }: {
  label: string; hint?: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  function commit() {
    const t = draft.trim();
    if (!t || values.includes(t)) { setDraft(''); return; }
    onChange([...values, t]);
    setDraft('');
  }
  function remove(i: number) {
    onChange(values.filter((_, idx) => idx !== i));
  }
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      <View style={styles.chipsRow}>
        {values.map((v, i) => (
          <Pressable key={`${v}-${i}`} onPress={() => remove(i)} style={styles.chip}>
            <Text style={styles.chipText}>{v}</Text>
            <Text style={styles.chipX}>×</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.fieldInput}
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={commit}
        onBlur={commit}
        returnKeyType="done"
        placeholder={placeholder ?? 'Add and press enter'}
        placeholderTextColor={Colors.textMuted}
        autoCapitalize="none"
      />
    </View>
  );
}

function ThemeRow({ day, value, onChange }: {
  day: WeekDay;
  value: BrandKit['themeCalendar'][WeekDay];
  onChange: (t: BrandKit['themeCalendar'][WeekDay]) => void;
}) {
  return (
    <View style={[styles.themeCard, !value.enabled && styles.themeCardDisabled]}>
      <View style={styles.themeHead}>
        <Text style={styles.themeDay}>{WEEKDAY_LABELS[day]}</Text>
        <View style={{ flex: 1 }}>
          <TextInput
            style={styles.themeLabelInput}
            value={value.label}
            onChangeText={(label) => onChange({ ...value, label })}
            placeholder="Theme name"
            placeholderTextColor={Colors.textMuted}
          />
        </View>
        <Switch
          value={value.enabled}
          onValueChange={(enabled) => onChange({ ...value, enabled })}
          trackColor={{ true: Colors.primary, false: Colors.border }}
        />
      </View>
      <TextInput
        style={[styles.fieldInput, { minHeight: 60, textAlignVertical: 'top' }]}
        value={value.prompt}
        onChangeText={(prompt) => onChange({ ...value, prompt })}
        multiline
        placeholder="Brief for the AI — what kind of post should this day produce?"
        placeholderTextColor={Colors.textMuted}
      />
    </View>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function stripMeta(k: BrandKit): Omit<BrandKit, 'updatedAt' | 'updatedBy'> {
  const { updatedAt: _ua, updatedBy: _ub, ...rest } = k;
  return rest;
}

const styles = StyleSheet.create({
  savedLine: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.lg },

  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textDark, marginBottom: 4 },
  sectionDesc: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.md, lineHeight: 18 },
  sectionBody: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    ...Shadow.sm,
  },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 },
  fieldHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 6, lineHeight: 18 },
  fieldInput: {
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: FontSize.sm,
    color: Colors.textDark,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  logoPreview: {
    marginTop: Spacing.sm,
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  logoImg: { width: 96, height: 96, borderRadius: Radius.md },
  logoCaption: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 6 },

  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.md },
  swatchCol: { width: 100, gap: 4 },
  swatchSquare: { height: 56, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderSoft },
  swatchLabel: { fontSize: 11, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.6, textTransform: 'uppercase' },
  swatchInput: {
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    fontFamily: 'monospace',
    color: Colors.textDark,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  paletteSample: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: 4,
  },
  paletteSampleHead: { fontSize: FontSize.lg, fontWeight: '800' },
  paletteSampleBody: { fontSize: FontSize.sm, lineHeight: 22 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: {
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  chipX: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '700' },

  radioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgLight,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  radioRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  radioDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: Colors.border, marginTop: 2 },
  radioDotActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  radioLabel: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  radioHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, lineHeight: 16 },

  themeCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgLight,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    gap: Spacing.sm,
  },
  themeCardDisabled: { opacity: 0.55 },
  themeHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  themeDay: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    width: 36,
  },
  themeLabelInput: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textDark,
    paddingVertical: 6,
    paddingHorizontal: 0,
  },

  linkText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600', marginTop: -8, marginBottom: Spacing.sm },
});
