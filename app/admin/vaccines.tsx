/**
 * Admin — Vaccine Schedule Manager.
 *
 * Wave 3 rebuild. View, edit, and add to the IAP vaccine schedule. Edits
 * are saved to Firestore and override the static data/vaccines.ts defaults.
 *
 * Note: clinical safety. Every edit is audit-logged via the existing
 * services/firebase content helpers. Wave 7 will add two-person signoff
 * + version history; for now this remains a single-admin edit surface.
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import {
  AdminPage,
  ConfirmDialog,
  EmptyState,
  StatCard,
  StatusBadge,
  Toolbar,
  ToolbarButton,
} from '../../components/admin/ui';
import { VACCINE_SCHEDULE } from '../../data/vaccines';
import {
  createContent,
  deleteContent,
  getContent,
  setContentById,
  updateContent,
} from '../../services/firebase';

interface VaccineItem {
  id: string;
  name: string;
  shortName: string;
  description: string;
  daysFromBirth: number;
  ageLabel: string;
  category: string;
  isCustom?: boolean;
  isOverridden?: boolean;
}

const CATEGORIES = ['Birth', 'Primary Series', 'Boosters', 'Seasonal', 'Adolescent', 'Nutrition', 'Optional', 'Catch-up'];

const CATEGORY_COLORS: Record<string, string> = {
  'Birth': Colors.primary,
  'Primary Series': '#8b5cf6',
  'Boosters': Colors.success,
  'Seasonal': '#0ea5e9',
  'Adolescent': '#ec4899',
  'Nutrition': '#84cc16',
  'Optional': Colors.warning,
  'Catch-up': '#06b6d4',
};

export default function VaccinesScreen() {
  const [firestoreVaccines, setFirestoreVaccines] = useState<VaccineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VaccineItem | null>(null);
  const [confirmDel, setConfirmDel] = useState<VaccineItem | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getContent('vaccines');
      setFirestoreVaccines(data as VaccineItem[]);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  // Static vaccines + Firestore overrides + pure-custom additions, merged.
  const merged = useMemo(() => {
    const staticItems: VaccineItem[] = VACCINE_SCHEDULE.map((v) => ({
      id: v.id,
      name: v.name,
      shortName: v.shortName,
      description: v.description,
      daysFromBirth: v.daysFromBirth,
      ageLabel: v.ageLabel,
      category: v.category,
      isCustom: false,
    }));
    const staticIds = new Set(staticItems.map((v) => v.id));
    const overrides = Object.fromEntries(
      firestoreVaccines.filter((v) => staticIds.has(v.id)).map((v) => [v.id, v]),
    );
    const pureCustom = firestoreVaccines.filter((v) => !staticIds.has(v.id));
    const mergedStatic = staticItems.map((v) =>
      overrides[v.id] ? { ...overrides[v.id], isCustom: false, isOverridden: true } : v,
    );
    return [...mergedStatic, ...pureCustom.map((v) => ({ ...v, isCustom: true }))]
      .sort((a, b) => a.daysFromBirth - b.daysFromBirth);
  }, [firestoreVaccines]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return merged;
    return merged.filter((v) =>
      v.name.toLowerCase().includes(q) ||
      v.shortName.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q) ||
      v.ageLabel.toLowerCase().includes(q),
    );
  }, [merged, search]);

  const counts = useMemo(() => {
    const total = merged.length;
    const overridden = merged.filter((v) => v.isOverridden).length;
    const custom = merged.filter((v) => v.isCustom).length;
    const iap = total - custom;
    return { total, iap, overridden, custom };
  }, [merged]);

  async function handleSave(data: Omit<VaccineItem, 'id' | 'isCustom' | 'isOverridden'>) {
    try {
      if (editing) {
        const isExistingFirestore = firestoreVaccines.some((v) => v.id === editing.id);
        if (isExistingFirestore) {
          await updateContent('vaccines', editing.id, data as any);
        } else {
          // Static vaccine being overridden for the first time
          await setContentById('vaccines', editing.id, data as any);
        }
        setFirestoreVaccines((prev) =>
          prev.some((v) => v.id === editing.id)
            ? prev.map((v) => v.id === editing.id ? { ...v, ...data } : v)
            : [...prev, { ...data, id: editing.id }],
        );
      } else {
        const newId = await createContent('vaccines', data as any);
        setFirestoreVaccines((prev) => [...prev, { ...data, id: newId ?? Date.now().toString(), isCustom: true }]);
      }
      setModalOpen(false);
      setEditing(null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  async function handleDelete(v: VaccineItem) {
    try {
      await deleteContent('vaccines', v.id);
      setFirestoreVaccines((prev) => prev.filter((x) => x.id !== v.id));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setConfirmDel(null);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Vaccine schedule' }} />
      <AdminPage
        title="Vaccine schedule"
        description="IAP-aligned schedule. Edits override the bundled defaults; new vaccines append to the end. Clinical safety: every change is audit-logged."
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Vaccine schedule' }]}
        headerActions={
          <>
            <ToolbarButton label="Refresh" icon="refresh" onPress={load} />
            <ToolbarButton
              label="Add custom"
              icon="add"
              variant="primary"
              onPress={() => { setEditing(null); setModalOpen(true); }}
            />
          </>
        }
        toolbar={
          <Toolbar
            search={{
              value: search,
              onChange: setSearch,
              placeholder: 'Search name, age, category…',
            }}
            leading={<Text style={styles.countText}>{filtered.length} of {merged.length}</Text>}
          />
        }
        error={error}
      >
        <View style={styles.statsRow}>
          <StatCard label="Total"      value={counts.total}      icon="medkit-outline" />
          <StatCard label="IAP (base)" value={counts.iap}        icon="shield-checkmark-outline" />
          <StatCard label="Edited"     value={counts.overridden} icon="create-outline" />
          <StatCard label="Custom"     value={counts.custom}     icon="add-circle-outline" />
        </View>

        {loading && firestoreVaccines.length === 0 ? (
          <EmptyState kind="loading" title="Loading schedule…" />
        ) : filtered.length === 0 ? (
          <EmptyState kind="empty" title="No vaccines match" body="Try a different search." />
        ) : (
          <View style={{ gap: Spacing.sm }}>
            {filtered.map((v) => (
              <View
                key={`${v.id}-${v.isCustom ? 'c' : v.isOverridden ? 'o' : 's'}`}
                style={[
                  styles.card,
                  v.isCustom && styles.cardCustom,
                  v.isOverridden && styles.cardOverridden,
                ]}
              >
                <View style={[styles.categoryDot, { backgroundColor: CATEGORY_COLORS[v.category] ?? Colors.textMuted }]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{v.name}</Text>
                    {v.isCustom ? <StatusBadge label="Custom" color={Colors.primary} /> : null}
                    {v.isOverridden ? <StatusBadge label="Edited" color={Colors.warning} /> : null}
                  </View>
                  <Text style={styles.sub}>{v.ageLabel} · {v.category}</Text>
                  {v.description ? <Text style={styles.desc} numberOfLines={2}>{v.description}</Text> : null}
                </View>
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => { setEditing(v); setModalOpen(true); }}
                    style={styles.actionBtn}
                    accessibilityLabel="Edit"
                  >
                    <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
                  </Pressable>
                  {v.isCustom ? (
                    <Pressable
                      onPress={() => setConfirmDel(v)}
                      style={styles.actionBtn}
                      accessibilityLabel="Delete"
                    >
                      <Ionicons name="trash-outline" size={16} color={Colors.error} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}
      </AdminPage>

      <VaccineFormModal
        visible={modalOpen}
        vaccine={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={handleSave}
      />

      <ConfirmDialog
        visible={!!confirmDel}
        title="Delete vaccine?"
        body={confirmDel ? `Remove "${confirmDel.name}" from the custom schedule?` : ''}
        destructive
        confirmLabel="Delete"
        onCancel={() => setConfirmDel(null)}
        onConfirm={async () => { if (confirmDel) await handleDelete(confirmDel); }}
      />
    </>
  );
}

// ─── Form modal ───────────────────────────────────────────────────────────
function VaccineFormModal({ visible, vaccine, onClose, onSave }: {
  visible: boolean;
  vaccine: VaccineItem | null;
  onClose: () => void;
  onSave: (data: Omit<VaccineItem, 'id' | 'isCustom' | 'isOverridden'>) => Promise<void>;
}) {
  const isEdit = !!vaccine;
  const [form, setForm] = useState({
    name: '', shortName: '', description: '',
    daysFromBirth: '', ageLabel: '', category: 'Primary Series',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (vaccine) {
      setForm({
        name: vaccine.name ?? '',
        shortName: vaccine.shortName ?? '',
        description: vaccine.description ?? '',
        daysFromBirth: String(vaccine.daysFromBirth ?? ''),
        ageLabel: vaccine.ageLabel ?? '',
        category: vaccine.category ?? 'Primary Series',
      });
    } else {
      setForm({ name: '', shortName: '', description: '', daysFromBirth: '', ageLabel: '', category: 'Primary Series' });
    }
  }, [vaccine, visible]);

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: form.name.trim(),
        shortName: form.shortName.trim(),
        description: form.description.trim(),
        daysFromBirth: parseInt(form.daysFromBirth) || 0,
        ageLabel: form.ageLabel.trim(),
        category: form.category,
      });
    } finally {
      setSaving(false);
    }
  }

  const isValid = form.name.trim().length > 0;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isEdit ? 'Edit vaccine' : 'Add custom vaccine'}</Text>
            <Pressable onPress={onClose} style={styles.modalClose} hitSlop={6}>
              <Ionicons name="close" size={20} color={Colors.textDark} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Field label="Vaccine name *" hint="e.g. OPV1 + Pentavalent Dose 1"
              value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
            <Field label="Short name" hint="e.g. OPV1+Penta1"
              value={form.shortName} onChange={(v) => setForm((p) => ({ ...p, shortName: v }))} />
            <Field label="Description" multiline
              value={form.description} onChange={(v) => setForm((p) => ({ ...p, description: v }))} />
            <Field label="Days from birth" numeric hint="0 = birth, 42 = 6 weeks, 270 = 9 months"
              value={form.daysFromBirth} onChange={(v) => setForm((p) => ({ ...p, daysFromBirth: v }))} />
            <Field label="Age label" hint="e.g. 6 Weeks, 9 Months"
              value={form.ageLabel} onChange={(v) => setForm((p) => ({ ...p, ageLabel: v }))} />

            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setForm((p) => ({ ...p, category: c }))}
                  style={[styles.catChip, c === form.category && { backgroundColor: CATEGORY_COLORS[c], borderColor: CATEGORY_COLORS[c] }]}
                >
                  <Text style={[styles.catChipText, c === form.category && { color: Colors.white }]}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </ScrollView>
          <View style={styles.modalFooter}>
            <ToolbarButton label="Cancel" variant="ghost" onPress={onClose} disabled={saving} />
            <ToolbarButton
              label={saving ? 'Saving…' : (isEdit ? 'Update' : 'Add')}
              variant="primary"
              icon="save-outline"
              onPress={handleSave}
              disabled={!isValid || saving}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Field({ label, hint, value, onChange, multiline, numeric }: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  numeric?: boolean;
}) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      <TextInput
        style={[styles.fieldInput, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={numeric ? 'number-pad' : 'default'}
        placeholderTextColor={Colors.textMuted}
        placeholder={label.replace(' *', '')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  countText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.4 },

  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.borderSoft,
    ...Shadow.sm,
  },
  cardCustom: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  cardOverridden: { borderColor: Colors.warning, backgroundColor: '#FFFBEB' },
  categoryDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  sub: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 4 },
  desc: { fontSize: FontSize.sm, color: Colors.textDark, marginTop: 6, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'flex-start' },
  actionBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bgLight,
    borderWidth: 1, borderColor: Colors.borderSoft,
    alignItems: 'center', justifyContent: 'center',
  },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(28,16,51,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: Spacing.lg,
  },
  modalCard: {
    width: '100%', maxWidth: 560,
    maxHeight: '90%',
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.lg,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSoft,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textDark },
  modalClose: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bgLight,
    alignItems: 'center', justifyContent: 'center',
  },
  modalBody: { padding: Spacing.xl, gap: 4 },
  modalFooter: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.borderSoft,
  },

  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textLight,
    letterSpacing: 0.6, textTransform: 'uppercase',
    marginBottom: 4,
  },
  fieldHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 4 },
  fieldInput: {
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: FontSize.sm, color: Colors.textDark,
    borderWidth: 1, borderColor: Colors.border,
  },

  catChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgLight,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  catChipText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDark },
});
