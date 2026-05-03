/**
 * Admin · Marketing strategy editor (M1).
 *
 * Single editor for the four pieces that drive everything below them:
 *   - Audience personas
 *   - Content pillars
 *   - Cultural calendar
 *   - Compliance rules (forbidden words, disclaimers, blocked topics)
 *   - Cost caps
 *
 * All five live on the same `marketing_brand/main` doc as the visual
 * brand kit (palette, fonts, voice). Saving here patches only the
 * fields the user touched; the rest stay as-is.
 */

import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';
import { AdminPage, ToolbarButton } from '../../../components/admin/ui';
import { fetchBrandKit, saveBrandKit } from '../../../services/marketing';
import {
  AudiencePersona,
  BrandKit,
  ComplianceRules,
  ContentPillar,
  CostCaps,
  CulturalEvent,
  defaultBrandKit,
  DisclaimerRule,
} from '../../../lib/marketingTypes';
import { useAuthStore } from '../../../store/useAuthStore';

export default function MarketingStrategyScreen() {
  const user = useAuthStore((s) => s.user);
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const k = await fetchBrandKit();
      setKit(k ?? defaultBrandKit());
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!kit || !user) return;
    setSaving(true);
    setError(null);
    setSavedToast(null);
    try {
      await saveBrandKit(
        { uid: user.uid, email: user.email },
        {
          personas: kit.personas,
          pillars: kit.pillars,
          culturalCalendar: kit.culturalCalendar,
          compliance: kit.compliance,
          costCaps: kit.costCaps,
        },
      );
      setSavedToast('Saved.');
      setTimeout(() => setSavedToast(null), 3000);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Strategy' }} />
      <AdminPage
        title="Marketing strategy"
        description="Personas, pillars, calendar and compliance — the strategic foundation that shapes every draft. Saved here, applied everywhere."
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Marketing', href: '/admin/marketing' },
          { label: 'Strategy' },
        ]}
        headerActions={
          <ToolbarButton
            label={saving ? 'Saving…' : 'Save'}
            icon="save"
            variant="primary"
            onPress={save}
            disabled={saving || !kit}
          />
        }
        loading={loading && !kit}
        error={error}
      >
        {savedToast ? <Text style={styles.savedToast}>{savedToast}</Text> : null}
        {kit ? (
          <View style={{ gap: Spacing.lg }}>
            <PersonasSection
              personas={kit.personas}
              onChange={(personas) => setKit({ ...kit, personas })}
            />
            <PillarsSection
              pillars={kit.pillars}
              onChange={(pillars) => setKit({ ...kit, pillars })}
            />
            <CalendarSection
              events={kit.culturalCalendar}
              pillars={kit.pillars}
              onChange={(culturalCalendar) => setKit({ ...kit, culturalCalendar })}
            />
            <ComplianceSection
              compliance={kit.compliance}
              onChange={(compliance) => setKit({ ...kit, compliance })}
            />
            <CostCapsSection
              caps={kit.costCaps}
              onChange={(costCaps) => setKit({ ...kit, costCaps })}
            />
          </View>
        ) : null}
      </AdminPage>
    </>
  );
}

// ── Personas ────────────────────────────────────────────────────────────────

function PersonasSection({ personas, onChange }: { personas: AudiencePersona[]; onChange: (next: AudiencePersona[]) => void }) {
  function add() {
    onChange([
      ...personas,
      { id: `persona_${personas.length + 1}`, label: 'New persona', description: '', enabled: true },
    ]);
  }
  function update(idx: number, patch: Partial<AudiencePersona>) {
    onChange(personas.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }
  function remove(idx: number) {
    onChange(personas.filter((_, i) => i !== idx));
  }
  return (
    <Section
      title="Audience personas"
      description="Who you're talking to. Each persona's description goes into the AI's system prompt — be specific."
      action={<AddButton label="Add persona" onPress={add} />}
    >
      {personas.length === 0 ? (
        <Text style={styles.empty}>No personas yet. Click "Add persona".</Text>
      ) : null}
      <View style={{ gap: Spacing.md }}>
        {personas.map((p, idx) => (
          <View key={`${p.id}_${idx}`} style={styles.row}>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.rowHead}>
                <TextInput
                  style={[styles.input, styles.inputBold]}
                  value={p.label}
                  onChangeText={(label) => update(idx, { label })}
                  placeholder="e.g. Newborn mom (0-3 months)"
                  placeholderTextColor={Colors.textMuted}
                />
                <Switch
                  value={p.enabled}
                  onValueChange={(enabled) => update(idx, { enabled })}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                />
                <RemoveButton onPress={() => remove(idx)} />
              </View>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                value={p.description}
                onChangeText={(description) => update(idx, { description })}
                placeholder="Brief — fed into AI prompt to keep drafts on-persona"
                placeholderTextColor={Colors.textMuted}
                multiline
              />
            </View>
          </View>
        ))}
      </View>
    </Section>
  );
}

// ── Pillars ─────────────────────────────────────────────────────────────────

function PillarsSection({ pillars, onChange }: { pillars: ContentPillar[]; onChange: (next: ContentPillar[]) => void }) {
  function add() {
    onChange([
      ...pillars,
      { id: `pillar_${pillars.length + 1}`, label: 'New pillar', description: '', emoji: '', enabled: true },
    ]);
  }
  function update(idx: number, patch: Partial<ContentPillar>) {
    onChange(pillars.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }
  function remove(idx: number) {
    onChange(pillars.filter((_, i) => i !== idx));
  }
  return (
    <Section
      title="Content pillars"
      description="The 5-7 themes you stand for. Every draft is tagged with one. Pillars also shape which illustrations and stock queries the cron picks."
      action={<AddButton label="Add pillar" onPress={add} />}
    >
      <View style={{ gap: Spacing.md }}>
        {pillars.map((p, idx) => (
          <View key={`${p.id}_${idx}`} style={styles.row}>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.rowHead}>
                <TextInput
                  style={[styles.input, styles.emojiInput]}
                  value={p.emoji ?? ''}
                  onChangeText={(emoji) => update(idx, { emoji })}
                  placeholder="🌸"
                  placeholderTextColor={Colors.textMuted}
                  maxLength={4}
                />
                <TextInput
                  style={[styles.input, styles.inputBold, { flex: 1 }]}
                  value={p.label}
                  onChangeText={(label) => update(idx, { label })}
                  placeholder="e.g. Health & Safety"
                  placeholderTextColor={Colors.textMuted}
                />
                <Switch
                  value={p.enabled}
                  onValueChange={(enabled) => update(idx, { enabled })}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                />
                <RemoveButton onPress={() => remove(idx)} />
              </View>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                value={p.description}
                onChangeText={(description) => update(idx, { description })}
                placeholder="What this pillar covers — fed into the AI prompt"
                placeholderTextColor={Colors.textMuted}
                multiline
              />
            </View>
          </View>
        ))}
      </View>
    </Section>
  );
}

// ── Cultural calendar ───────────────────────────────────────────────────────

function CalendarSection({
  events,
  pillars,
  onChange,
}: {
  events: CulturalEvent[];
  pillars: ContentPillar[];
  onChange: (next: CulturalEvent[]) => void;
}) {
  const sorted = useMemo(() => [...events].sort((a, b) => a.date.localeCompare(b.date)), [events]);
  function add() {
    onChange([
      ...events,
      {
        id: `event_${Date.now()}`,
        label: 'New event',
        date: new Date().toISOString().slice(0, 10),
        recurrence: 'yearly',
      },
    ]);
  }
  function update(idx: number, patch: Partial<CulturalEvent>) {
    const target = sorted[idx];
    onChange(events.map((e) => (e.id === target.id ? { ...e, ...patch } : e)));
  }
  function remove(idx: number) {
    const target = sorted[idx];
    onChange(events.filter((e) => e.id !== target.id));
  }
  return (
    <Section
      title="Cultural calendar"
      description="Dates the system should respect — Indian festivals, mom moments, mental-health days. The cron auto-suggests posts on these days."
      action={<AddButton label="Add event" onPress={add} />}
    >
      <View style={{ gap: Spacing.md }}>
        {sorted.map((e, idx) => (
          <View key={e.id} style={styles.row}>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.rowHead}>
                <TextInput
                  style={[styles.input, styles.dateInput]}
                  value={e.date}
                  onChangeText={(date) => update(idx, { date })}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                />
                <TextInput
                  style={[styles.input, styles.inputBold, { flex: 1 }]}
                  value={e.label}
                  onChangeText={(label) => update(idx, { label })}
                  placeholder="e.g. Diwali"
                  placeholderTextColor={Colors.textMuted}
                />
                <RemoveButton onPress={() => remove(idx)} />
              </View>
              <View style={styles.rowSub}>
                <SegmentedControl
                  options={[{ value: 'yearly', label: 'Yearly' }, { value: 'one_off', label: 'One-off' }]}
                  value={e.recurrence}
                  onChange={(v) => update(idx, { recurrence: v as CulturalEvent['recurrence'] })}
                />
                <PillarPicker
                  value={e.pillarHint ?? ''}
                  pillars={pillars}
                  onChange={(pillarHint) => update(idx, { pillarHint: pillarHint || undefined })}
                />
              </View>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                value={e.promptHint ?? ''}
                onChangeText={(promptHint) => update(idx, { promptHint })}
                placeholder="Tone hint for the AI on this day"
                placeholderTextColor={Colors.textMuted}
                multiline
              />
            </View>
          </View>
        ))}
      </View>
    </Section>
  );
}

function PillarPicker({ value, pillars, onChange }: { value: string; pillars: ContentPillar[]; onChange: (next: string) => void }) {
  return (
    <View style={styles.chipRow}>
      <Pressable
        onPress={() => onChange('')}
        style={[styles.chip, !value && styles.chipActive]}
      >
        <Text style={[styles.chipLabel, !value && styles.chipLabelActive]}>Any pillar</Text>
      </Pressable>
      {pillars.filter((p) => p.enabled).map((p) => (
        <Pressable
          key={p.id}
          onPress={() => onChange(p.id)}
          style={[styles.chip, value === p.id && styles.chipActive]}
        >
          <Text style={[styles.chipLabel, value === p.id && styles.chipLabelActive]}>
            {p.emoji ? `${p.emoji} ` : ''}{p.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── Compliance ──────────────────────────────────────────────────────────────

function ComplianceSection({
  compliance,
  onChange,
}: {
  compliance: ComplianceRules;
  onChange: (next: ComplianceRules) => void;
}) {
  return (
    <Section
      title="Compliance rules"
      description="Guardrails the server enforces on every draft. Forbidden words block publication; disclaimers auto-attach when their trigger is mentioned; blocked topics need senior review."
    >
      <View style={{ gap: Spacing.lg }}>
        <ChipListField
          label="Forbidden words"
          hint="Whole-word, case-insensitive. Add words like ‘cure', ‘guaranteed', ‘miracle'."
          values={compliance.medicalForbiddenWords}
          onChange={(medicalForbiddenWords) => onChange({ ...compliance, medicalForbiddenWords })}
          placeholder="add a word…"
        />
        <DisclaimersField
          rules={compliance.requiredDisclaimers}
          onChange={(requiredDisclaimers) => onChange({ ...compliance, requiredDisclaimers })}
        />
        <ChipListField
          label="Blocked topics"
          hint="Drafts mentioning these phrases need senior admin review before publish."
          values={compliance.blockedTopics}
          onChange={(blockedTopics) => onChange({ ...compliance, blockedTopics })}
          placeholder="add a topic phrase…"
        />
      </View>
    </Section>
  );
}

function DisclaimersField({ rules, onChange }: { rules: DisclaimerRule[]; onChange: (next: DisclaimerRule[]) => void }) {
  function add() {
    onChange([...rules, { trigger: '', text: '' }]);
  }
  function update(idx: number, patch: Partial<DisclaimerRule>) {
    onChange(rules.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function remove(idx: number) {
    onChange(rules.filter((_, i) => i !== idx));
  }
  return (
    <View>
      <View style={styles.rowHead}>
        <Text style={styles.fieldLabel}>Required disclaimers</Text>
        <AddButton label="Add disclaimer" onPress={add} subtle />
      </View>
      <Text style={styles.fieldHint}>
        When a caption contains the trigger word, the disclaimer text is appended automatically.
      </Text>
      <View style={{ gap: Spacing.sm, marginTop: 8 }}>
        {rules.map((r, idx) => (
          <View key={idx} style={styles.disclaimerRow}>
            <TextInput
              style={[styles.input, { width: 140 }]}
              value={r.trigger}
              onChangeText={(trigger) => update(idx, { trigger })}
              placeholder="trigger"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, styles.inputMulti, { flex: 1 }]}
              value={r.text}
              onChangeText={(text) => update(idx, { text })}
              placeholder="*This is not medical advice. Consult your paediatrician.*"
              placeholderTextColor={Colors.textMuted}
              multiline
            />
            <RemoveButton onPress={() => remove(idx)} />
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Cost caps ───────────────────────────────────────────────────────────────

function CostCapsSection({ caps, onChange }: { caps: CostCaps; onChange: (next: CostCaps) => void }) {
  return (
    <Section
      title="Cost caps"
      description="Hard ceilings on AI image + caption spend. The renderer refuses past the limit and falls back to free providers."
    >
      <View style={styles.capsGrid}>
        <CapField
          label="Daily cap (₹)"
          value={caps.dailyInr}
          onChange={(dailyInr) => onChange({ ...caps, dailyInr })}
          hint="Resets at IST midnight."
        />
        <CapField
          label="Monthly cap (₹)"
          value={caps.monthlyInr}
          onChange={(monthlyInr) => onChange({ ...caps, monthlyInr })}
          hint="Resets on the 1st of each calendar month."
        />
        <CapField
          label="Alert at (%)"
          value={caps.alertAtPct}
          onChange={(alertAtPct) => onChange({ ...caps, alertAtPct })}
          hint="Surfaces an admin warning when usage crosses this threshold."
        />
      </View>
    </Section>
  );
}

function CapField({ label, value, onChange, hint }: { label: string; value: number; onChange: (n: number) => void; hint?: string }) {
  return (
    <View style={styles.capField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, { fontSize: FontSize.lg, fontWeight: '700' }]}
        value={String(value)}
        onChangeText={(t) => {
          const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        keyboardType="numeric"
      />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

// ── Shared UI ───────────────────────────────────────────────────────────────

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {description ? <Text style={styles.sectionDesc}>{description}</Text> : null}
        </View>
        {action}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function AddButton({ label, onPress, subtle }: { label: string; onPress: () => void; subtle?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.addBtn, subtle && styles.addBtnSubtle]}>
      <Ionicons name="add" size={16} color={subtle ? Colors.primary : '#fff'} />
      <Text style={[styles.addBtnLabel, subtle && styles.addBtnLabelSubtle]}>{label}</Text>
    </Pressable>
  );
}

function RemoveButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.removeBtn} hitSlop={6}>
      <Ionicons name="close" size={16} color={Colors.textMuted} />
    </Pressable>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.segGroup}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          style={[styles.segOption, value === o.value && styles.segOptionActive]}
        >
          <Text style={[styles.segLabel, value === o.value && styles.segLabelActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ChipListField({
  label,
  hint,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  function add() {
    const v = draft.trim().toLowerCase();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft('');
  }
  function remove(idx: number) {
    onChange(values.filter((_, i) => i !== idx));
  }
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      <View style={[styles.chipRow, { marginTop: 8 }]}>
        {values.map((v, idx) => (
          <Pressable key={`${v}_${idx}`} onPress={() => remove(idx)} style={styles.chip}>
            <Text style={styles.chipLabel}>{v}</Text>
            <Ionicons name="close" size={12} color={Colors.textMuted} style={{ marginLeft: 6 }} />
          </Pressable>
        ))}
      </View>
      <View style={[styles.rowHead, { marginTop: 8 }]}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
        />
        <AddButton label="Add" onPress={add} subtle />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  savedToast: {
    backgroundColor: Colors.primarySoft,
    color: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    fontWeight: '700',
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },

  section: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    ...Shadow.sm,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textDark },
  sectionDesc: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4, lineHeight: 18 },
  sectionBody: { gap: Spacing.md },

  empty: { fontSize: FontSize.sm, color: Colors.textMuted, fontStyle: 'italic' },

  row: {
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowSub: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },

  input: {
    backgroundColor: '#fff',
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: FontSize.sm,
    color: Colors.textDark,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputBold: { fontWeight: '700', flex: 1 },
  inputMulti: { minHeight: 48, textAlignVertical: 'top' },
  emojiInput: { width: 56, textAlign: 'center', fontSize: FontSize.lg },
  dateInput: { width: 130, fontFamily: 'monospace' },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.6, textTransform: 'uppercase' },
  fieldHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, lineHeight: 18 },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  addBtnSubtle: { backgroundColor: Colors.primarySoft },
  addBtnLabel: { color: '#fff', fontSize: FontSize.xs, fontWeight: '700' },
  addBtnLabelSubtle: { color: Colors.primary },

  removeBtn: { padding: 4, borderRadius: Radius.sm },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.bgLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  chipLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },
  chipLabelActive: { color: Colors.primary, fontWeight: '700' },

  segGroup: {
    flexDirection: 'row',
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.sm,
    padding: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segOption: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.sm - 2 },
  segOptionActive: { backgroundColor: Colors.primary },
  segLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },
  segLabelActive: { color: '#fff' },

  disclaimerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },

  capsGrid: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  capField: { flex: 1, minWidth: 140, gap: 4 },
});
