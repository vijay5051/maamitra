/**
 * Admin · Audience segments.
 *
 * Wave 5. Save audience definitions for reuse across pushes / lifecycle
 * flows / banners. Each segment is a set of filters resolved against the
 * user table at fan-out time; the preview button counts current matches.
 */
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import {
  AdminPage,
  Column,
  ConfirmDialog,
  DataTable,
  StatCard,
  StatusBadge,
  Toolbar,
  ToolbarButton,
} from '../../components/admin/ui';
import {
  AudienceSegment,
  AudiencePreview,
  SegmentFilters,
  createSegment,
  deleteSegment,
  listSegments,
  previewSegment,
  updateSegment,
} from '../../services/segments';
import { useAuthStore } from '../../store/useAuthStore';

const PARENT_GENDERS: Array<'mother' | 'father' | 'other'> = ['mother', 'father', 'other'];
const COMMON_BUCKETS = ['pregnant', 'newborn', 'infant', 'toddler', 'preschool', 'school'];
const COMMON_STATES = [
  'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Delhi', 'Gujarat',
  'Uttar Pradesh', 'West Bengal', 'Rajasthan', 'Telangana', 'Kerala',
];

export default function SegmentsScreen() {
  const { user: actor } = useAuthStore();

  const [segments, setSegments] = useState<AudienceSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AudienceSegment | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDel, setConfirmDel] = useState<AudienceSegment | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setSegments(await listSegments());
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return segments;
    return segments.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.description ?? '').toLowerCase().includes(q),
    );
  }, [segments, search]);

  async function handleSave(payload: { name: string; description?: string; filters: SegmentFilters }) {
    if (!actor) return;
    try {
      if (editing) {
        await updateSegment(actor, editing.id, payload);
      } else {
        await createSegment(actor, payload);
      }
      await load();
      setEditing(null);
      setCreating(false);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  async function handleDelete(s: AudienceSegment) {
    if (!actor) return;
    try {
      await deleteSegment(actor, s.id);
      setSegments((prev) => prev.filter((x) => x.id !== s.id));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setConfirmDel(null);
    }
  }

  const columns: Column<AudienceSegment>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (s) => (
        <View>
          <Text style={styles.cellPrimary} numberOfLines={1}>{s.name}</Text>
          {s.description ? <Text style={styles.cellMeta} numberOfLines={1}>{s.description}</Text> : null}
        </View>
      ),
      sort: (s) => s.name.toLowerCase(),
    },
    {
      key: 'filters',
      header: 'Filters',
      render: (s) => <FilterChips filters={s.filters} />,
    },
    {
      key: 'createdAt',
      header: 'Created',
      width: 130,
      align: 'right',
      render: (s) => (
        <Text style={styles.cellMeta}>
          {s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
        </Text>
      ),
      sort: (s) => s.createdAt ?? '',
    },
  ];

  return (
    <>
      <Stack.Screen options={{ title: 'Audience segments' }} />
      <AdminPage
        title="Audience segments"
        description="Saved filter sets used to target pushes, lifecycle flows, banners. Defining a segment once means future sends pick it from a dropdown instead of redefining filters every time."
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Segments' }]}
        headerActions={
          <>
            <ToolbarButton label="Refresh" icon="refresh" onPress={load} />
            <ToolbarButton label="New segment" icon="add" variant="primary" onPress={() => { setEditing(null); setCreating(true); }} />
          </>
        }
        toolbar={
          <Toolbar
            search={{
              value: search,
              onChange: setSearch,
              placeholder: 'Search segment name or description…',
            }}
            leading={<Text style={styles.countText}>{filtered.length} of {segments.length}</Text>}
          />
        }
        error={error}
      >
        <View style={styles.statsRow}>
          <StatCard label="Total segments" value={segments.length} icon="layers-outline" />
        </View>

        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(s) => s.id}
          loading={loading}
          onRowPress={(s) => { setEditing(s); setCreating(false); }}
          emptyTitle={search ? 'No segments match' : 'No segments yet'}
          emptyBody={search ? 'Try a different search.' : 'Define your first reusable audience with the "New segment" button.'}
        />
      </AdminPage>

      <SegmentEditorModal
        visible={creating || !!editing}
        segment={editing}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSave={handleSave}
        onDelete={editing ? () => setConfirmDel(editing) : undefined}
      />

      <ConfirmDialog
        visible={!!confirmDel}
        title="Delete segment?"
        body={confirmDel ? `Remove "${confirmDel.name}". Existing pushes that referenced it will fall back to no audience.` : ''}
        destructive
        confirmLabel="Delete"
        onCancel={() => setConfirmDel(null)}
        onConfirm={async () => { if (confirmDel) await handleDelete(confirmDel); }}
      />
    </>
  );
}

// ─── Filter summary chips ─────────────────────────────────────────────────
function FilterChips({ filters }: { filters: SegmentFilters }) {
  const chips: string[] = [];
  if (filters.states?.length) chips.push(`${filters.states.length} state${filters.states.length === 1 ? '' : 's'}`);
  if (filters.parentGenders?.length) chips.push(filters.parentGenders.join(' · '));
  if (filters.audienceBuckets?.length) chips.push(filters.audienceBuckets.join(' · '));
  if (typeof filters.kidsCountMin === 'number') chips.push(`kids ≥ ${filters.kidsCountMin}`);
  if (typeof filters.kidsCountMax === 'number') chips.push(`kids ≤ ${filters.kidsCountMax}`);
  if (typeof filters.daysSinceActiveMin === 'number') chips.push(`active ≥ ${filters.daysSinceActiveMin}d ago`);
  if (typeof filters.daysSinceActiveMax === 'number') chips.push(`active ≤ ${filters.daysSinceActiveMax}d ago`);
  if (filters.requirePushToken) chips.push('push only');
  if (filters.includeUids?.length) chips.push(`+${filters.includeUids.length} forced`);
  if (filters.excludeUids?.length) chips.push(`-${filters.excludeUids.length} excluded`);
  if (chips.length === 0) return <Text style={styles.cellMeta}>No filters · matches everyone</Text>;
  return (
    <View style={styles.chipRow}>
      {chips.map((c, i) => (
        <View key={i} style={styles.chip}><Text style={styles.chipText}>{c}</Text></View>
      ))}
    </View>
  );
}

// ─── Editor modal ─────────────────────────────────────────────────────────
function SegmentEditorModal({ visible, segment, onClose, onSave, onDelete }: {
  visible: boolean;
  segment: AudienceSegment | null;
  onClose: () => void;
  onSave: (payload: { name: string; description?: string; filters: SegmentFilters }) => Promise<void>;
  onDelete?: () => void;
}) {
  const isEdit = !!segment;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [filters, setFilters] = useState<SegmentFilters>({});
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(segment?.name ?? '');
    setDescription(segment?.description ?? '');
    setFilters(segment?.filters ?? {});
    setPreview(null);
    setSaving(false);
  }, [segment, visible]);

  async function runPreview() {
    setPreviewing(true);
    try { setPreview(await previewSegment(filters)); }
    finally { setPreviewing(false); }
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try { await onSave({ name: name.trim(), description: description.trim(), filters }); }
    finally { setSaving(false); }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isEdit ? 'Edit segment' : 'New segment'}</Text>
            <Pressable onPress={onClose} hitSlop={6} style={styles.modalClose}>
              <Text style={{ fontSize: 18, color: Colors.textDark }}>×</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Field label="Name *" value={name} onChange={setName} />
            <Field label="Description" value={description} onChange={setDescription} multiline />

            <SectionLabel>States (any of)</SectionLabel>
            <ChipMultiSelect
              options={COMMON_STATES}
              values={filters.states ?? []}
              onChange={(v) => setFilters((f) => ({ ...f, states: v.length ? v : undefined }))}
            />

            <SectionLabel>Parent role</SectionLabel>
            <ChipMultiSelect
              options={PARENT_GENDERS}
              values={filters.parentGenders ?? []}
              onChange={(v) => setFilters((f) => ({ ...f, parentGenders: v.length ? (v as any[]) : undefined }))}
            />

            <SectionLabel>Audience buckets</SectionLabel>
            <ChipMultiSelect
              options={COMMON_BUCKETS}
              values={filters.audienceBuckets ?? []}
              onChange={(v) => setFilters((f) => ({ ...f, audienceBuckets: v.length ? v : undefined }))}
            />

            <View style={styles.numRow}>
              <NumberField
                label="Kids min"
                value={filters.kidsCountMin}
                onChange={(n) => setFilters((f) => ({ ...f, kidsCountMin: n }))}
              />
              <NumberField
                label="Kids max"
                value={filters.kidsCountMax}
                onChange={(n) => setFilters((f) => ({ ...f, kidsCountMax: n }))}
              />
            </View>

            <View style={styles.numRow}>
              <NumberField
                label="Active ≥ days ago"
                value={filters.daysSinceActiveMin}
                onChange={(n) => setFilters((f) => ({ ...f, daysSinceActiveMin: n }))}
              />
              <NumberField
                label="Active ≤ days ago"
                value={filters.daysSinceActiveMax}
                onChange={(n) => setFilters((f) => ({ ...f, daysSinceActiveMax: n }))}
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Push-token only</Text>
                <Text style={styles.fieldHint}>Drop users without a registered FCM token (they wouldn't get the push anyway).</Text>
              </View>
              <Switch
                value={!!filters.requirePushToken}
                onValueChange={(v) => setFilters((f) => ({ ...f, requirePushToken: v ? true : undefined }))}
                thumbColor={Colors.white}
                trackColor={{ false: Colors.border, true: Colors.primary }}
              />
            </View>

            {/* Preview card */}
            <View style={styles.previewCard}>
              <View style={styles.previewHead}>
                <Text style={styles.fieldLabel}>Audience preview</Text>
                <ToolbarButton
                  label={previewing ? 'Counting…' : 'Run preview'}
                  icon="people-outline"
                  variant="secondary"
                  onPress={runPreview}
                  disabled={previewing}
                />
              </View>
              {preview ? (
                <View style={{ gap: 4 }}>
                  <Text style={styles.previewBig}>{preview.total.toLocaleString('en-IN')} users match</Text>
                  <Text style={styles.fieldHint}>
                    {preview.withPushToken.toLocaleString('en-IN')} with push tokens
                  </Text>
                  {preview.sample.length > 0 ? (
                    <Text style={styles.fieldHint} numberOfLines={2}>
                      Sample: {preview.sample.map((s) => s.name).join(', ')}
                      {preview.total > preview.sample.length ? '…' : ''}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.fieldHint}>Tap "Run preview" to count matching users with the current filters.</Text>
              )}
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            {onDelete ? (
              <ToolbarButton label="Delete" icon="trash-outline" variant="danger" onPress={onDelete} />
            ) : null}
            <View style={{ flex: 1 }} />
            <ToolbarButton label="Cancel" variant="ghost" onPress={onClose} disabled={saving} />
            <ToolbarButton
              label={saving ? 'Saving…' : (isEdit ? 'Update' : 'Create')}
              variant="primary"
              icon="save-outline"
              onPress={handleSave}
              disabled={!name.trim() || saving}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Sub-fields ───────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>{children}</Text>;
}

function Field({ label, value, onChange, multiline }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && { minHeight: 60, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholder={label.replace(' *', '')}
        placeholderTextColor={Colors.textMuted}
      />
    </View>
  );
}

function NumberField({ label, value, onChange }: {
  label: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
}) {
  const [draft, setDraft] = useState<string>(value == null ? '' : String(value));
  useEffect(() => { setDraft(value == null ? '' : String(value)); }, [value]);
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={draft}
        onChangeText={(v) => {
          setDraft(v);
          if (v.trim() === '') return onChange(undefined);
          const n = parseInt(v, 10);
          onChange(Number.isFinite(n) ? n : undefined);
        }}
        keyboardType="number-pad"
        placeholder="—"
        placeholderTextColor={Colors.textMuted}
      />
    </View>
  );
}

function ChipMultiSelect({ options, values, onChange }: {
  options: string[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(o: string) {
    if (values.includes(o)) onChange(values.filter((v) => v !== o));
    else onChange([...values, o]);
  }
  return (
    <View style={styles.chipPickerRow}>
      {options.map((o) => {
        const active = values.includes(o);
        return (
          <Pressable
            key={o}
            onPress={() => toggle(o)}
            style={[styles.pickerChip, active && styles.pickerChipActive]}
          >
            <Text style={[styles.pickerChipText, active && styles.pickerChipTextActive]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  countText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.4 },
  cellPrimary: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  cellMeta: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, backgroundColor: Colors.bgLight, borderWidth: 1, borderColor: Colors.borderSoft },
  chipText: { fontSize: 11, fontWeight: '600', color: Colors.textDark },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(28,16,51,0.55)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  modalCard: { width: '100%', maxWidth: 640, maxHeight: '92%', backgroundColor: Colors.cardBg, borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.lg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.borderSoft },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textDark },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.bgLight, alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: Spacing.xl, gap: 4 },
  modalFooter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.borderSoft },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 },
  fieldHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 4 },
  fieldInput: { backgroundColor: Colors.bgLight, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: FontSize.sm, color: Colors.textDark, borderWidth: 1, borderColor: Colors.border },

  numRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginVertical: Spacing.md },

  chipPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.md },
  pickerChip: { paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.bgLight, borderWidth: 1, borderColor: Colors.borderSoft },
  pickerChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pickerChipText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDark },
  pickerChipTextActive: { color: Colors.white },

  previewCard: { backgroundColor: Colors.primarySoft, borderRadius: Radius.lg, padding: Spacing.lg, gap: 6, borderWidth: 1, borderColor: Colors.primary },
  previewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  previewBig: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.primary },
});
