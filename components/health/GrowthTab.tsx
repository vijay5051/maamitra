import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Card from '../ui/Card';
import DatePickerField from '../ui/DatePickerField';
import { Colors, Fonts, Gradients } from '../../constants/theme';
import { useActiveKid } from '../../hooks/useActiveKid';
import {
  DiaperKind,
  GrowthEntry,
  GrowthTracker,
  cmToInches,
  formatDuration,
  sleepDurationMinutes,
  useGrowthStore,
} from '../../store/useGrowthStore';

// ─── Tracker metadata ─────────────────────────────────────────────────────────

type Mode = 'growth' | 'routine';

interface TrackerMeta {
  key: GrowthTracker;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  unit?: string; // canonical unit for numeric trackers
}

// Tracker tints used to be a rainbow (purple/indigo/teal/amber/blue) which
// made the Health section look off-brand. They now all render in the app's
// brand accent — icons + tiny backgrounds read directly from `Colors` so
// switching the accent colour in Settings re-skins the whole Health tab.
const GROWTH_TRACKERS: TrackerMeta[] = [
  { key: 'weight', label: 'Weight',             icon: 'scale-outline',    unit: 'kg' },
  { key: 'height', label: 'Height',             icon: 'resize-outline',   unit: 'cm' },
  { key: 'head',   label: 'Head circumference', icon: 'ellipse-outline',  unit: 'cm' },
];

const ROUTINE_TRACKERS: TrackerMeta[] = [
  { key: 'diaper', label: 'Diaper',              icon: 'sync-outline' },
  { key: 'sleep',  label: 'Sleep',               icon: 'moon-outline' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateTimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDateTimeLocalValue(v: string): string {
  // Treat the browser's local datetime input as local time.
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Cross-platform datetime input ────────────────────────────────────────────
// Uses <input type="datetime-local"> on web; falls back to a plain text input on
// native (MaaMitra is web-first today — native build ships later).

function DateTimeField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (iso: string) => void;
  label?: string;
}) {
  if (Platform.OS === 'web') {
    return (
      <View style={inputStyles.fieldBlock}>
        {label ? <Text style={inputStyles.fieldLabel}>{label}</Text> : null}
        <View style={inputStyles.fieldRow}>
          <Ionicons name="time-outline" size={18} color={Colors.primary} />
          {/* @ts-ignore — web-only input */}
          <input
            type="datetime-local"
            value={toDateTimeLocalValue(value)}
            onChange={(e: any) => onChange(fromDateTimeLocalValue(e.target.value))}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontFamily: Fonts.sansRegular,
              fontSize: 14,
              color: Colors.textDark,
              background: 'transparent',
              padding: 0,
            }}
          />
        </View>
      </View>
    );
  }

  // Native fallback: separate calendar (date) + HH:MM number inputs.
  // Avoids dumping a raw ISO string in a TextInput which Android users can't
  // intuitively edit.
  const d = new Date(value);
  const valid = !isNaN(d.getTime());
  const isoDate = valid
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : '';
  const hh = valid ? String(d.getHours()).padStart(2, '0') : '00';
  const mm = valid ? String(d.getMinutes()).padStart(2, '0') : '00';

  const updateParts = (newDate: string, newHH: string, newMM: string) => {
    if (!newDate) return;
    const h = Math.min(23, Math.max(0, parseInt(newHH, 10) || 0));
    const m = Math.min(59, Math.max(0, parseInt(newMM, 10) || 0));
    const [y, mo, da] = newDate.split('-').map((n) => parseInt(n, 10));
    if (!y || !mo || !da) return;
    const next = new Date(y, mo - 1, da, h, m, 0, 0);
    if (!isNaN(next.getTime())) onChange(next.toISOString());
  };

  return (
    <View style={inputStyles.fieldBlock}>
      {label ? <Text style={inputStyles.fieldLabel}>{label}</Text> : null}
      <DatePickerField
        value={isoDate}
        onChange={(d) => updateParts(d, hh, mm)}
        maxDate={new Date().toISOString().split('T')[0]}
      />
      <View style={[inputStyles.fieldRow, { marginTop: 8 }]}>
        <Ionicons name="time-outline" size={18} color={Colors.primary} />
        <Text style={inputStyles.fieldSuffix}>Time</Text>
        <View style={{ flex: 1 }} />
        <TextInput
          value={hh}
          onChangeText={(t) => updateParts(isoDate, t, mm)}
          placeholder="HH"
          keyboardType="number-pad"
          maxLength={2}
          placeholderTextColor={Colors.textMuted}
          style={[inputStyles.fieldInput, { textAlign: 'center', maxWidth: 40 }]}
        />
        <Text style={inputStyles.fieldSuffix}>:</Text>
        <TextInput
          value={mm}
          onChangeText={(t) => updateParts(isoDate, hh, t)}
          placeholder="MM"
          keyboardType="number-pad"
          maxLength={2}
          placeholderTextColor={Colors.textMuted}
          style={[inputStyles.fieldInput, { textAlign: 'center', maxWidth: 40 }]}
        />
      </View>
    </View>
  );
}

// ─── Add-entry sheet ─────────────────────────────────────────────────────────
// Single modal that adapts to the active tracker. Keeps state local and calls
// onSave with the payload, leaving the store call to the parent so we can add
// analytics / toasts in one place later.

type Draft = {
  at: string;
  value: string; // free-text while typing; parsed on save
  diaperKind: DiaperKind;
  sleepStart: string;
  sleepEnd: string;
  note: string;
  // Height-only: user picks cm, inches, or feet+inches; we persist cm.
  heightUnit: 'cm' | 'in' | 'ft';
  heightFeet: string;   // when heightUnit === 'ft'
  heightInches: string; // when heightUnit === 'ft'
};

function blankDraft(): Draft {
  const now = new Date().toISOString();
  return {
    at: now,
    value: '',
    diaperKind: 'wet',
    sleepStart: now,
    sleepEnd: now,
    note: '',
    heightUnit: 'cm',
    heightFeet: '',
    heightInches: '',
  };
}

function AddEntrySheet({
  visible,
  tracker,
  onClose,
  onSave,
}: {
  visible: boolean;
  tracker: TrackerMeta | null;
  onClose: () => void;
  onSave: (entry: Omit<GrowthEntry, 'id'>) => void;
}) {
  const [draft, setDraft] = useState<Draft>(blankDraft());

  // Reset the draft every time the sheet opens for a different tracker, so an
  // abandoned weight draft doesn't pre-fill a diaper log.
  React.useEffect(() => {
    if (visible) setDraft(blankDraft());
  }, [visible, tracker?.key]);

  if (!tracker) return null;

  const handleSave = () => {
    const base: Omit<GrowthEntry, 'id'> = { at: draft.at };
    if (draft.note.trim()) base.note = draft.note.trim();

    if (tracker.key === 'weight') {
      const n = parseFloat(draft.value);
      if (!isFinite(n) || n <= 0) return;
      onSave({ ...base, value: n });
    } else if (tracker.key === 'height') {
      let cm = 0;
      if (draft.heightUnit === 'ft') {
        const ft = parseFloat(draft.heightFeet) || 0;
        const inch = parseFloat(draft.heightInches) || 0;
        const totalInches = ft * 12 + inch;
        if (totalInches <= 0) return;
        cm = totalInches * 2.54;
      } else {
        const n = parseFloat(draft.value);
        if (!isFinite(n) || n <= 0) return;
        cm = draft.heightUnit === 'in' ? n * 2.54 : n;
      }
      onSave({ ...base, value: Number(cm.toFixed(2)) });
    } else if (tracker.key === 'head') {
      const n = parseFloat(draft.value);
      if (!isFinite(n) || n <= 0) return;
      onSave({ ...base, value: n });
    } else if (tracker.key === 'diaper') {
      onSave({ ...base, diaperKind: draft.diaperKind });
    } else if (tracker.key === 'sleep') {
      const s = new Date(draft.sleepStart).getTime();
      const e = new Date(draft.sleepEnd).getTime();
      if (!isFinite(s) || !isFinite(e) || e <= s) return;
      onSave({
        ...base,
        at: draft.sleepStart,
        sleepStart: draft.sleepStart,
        sleepEnd: draft.sleepEnd,
      });
    }
    onClose();
  };

  const canSave = (() => {
    if (tracker.key === 'sleep') {
      const s = new Date(draft.sleepStart).getTime();
      const e = new Date(draft.sleepEnd).getTime();
      return isFinite(s) && isFinite(e) && e > s;
    }
    if (tracker.key === 'diaper') return !!draft.diaperKind;
    const n = parseFloat(draft.value);
    return isFinite(n) && n > 0;
  })();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Pressable style={sheetStyles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={sheetStyles.handle} />
          <View style={sheetStyles.headerRow}>
            <View style={[sheetStyles.iconWrap, { backgroundColor: Colors.primaryAlpha08 }]}>
              <Ionicons name={tracker.icon} size={20} color={Colors.primary} />
            </View>
            <Text style={sheetStyles.title}>Log {tracker.label.toLowerCase()}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
            {/* Numeric trackers — weight / height / head */}
            {(tracker.key === 'weight' || tracker.key === 'head') && (
              <View style={inputStyles.fieldBlock}>
                <Text style={inputStyles.fieldLabel}>Value ({tracker.unit})</Text>
                <View style={inputStyles.fieldRow}>
                  <Ionicons name={tracker.icon} size={18} color={Colors.primary} />
                  <TextInput
                    value={draft.value}
                    onChangeText={(t) => setDraft({ ...draft, value: t })}
                    placeholder={tracker.key === 'weight' ? 'e.g. 7.8' : 'e.g. 42.5'}
                    keyboardType="decimal-pad"
                    placeholderTextColor={Colors.textMuted}
                    style={inputStyles.fieldInput}
                  />
                  <Text style={inputStyles.fieldSuffix}>{tracker.unit}</Text>
                </View>
              </View>
            )}

            {tracker.key === 'height' && (
              <>
                <View style={inputStyles.fieldBlock}>
                  <Text style={inputStyles.fieldLabel}>Value</Text>
                  {/* Unit toggle row — three options: cm / in / ft+in */}
                  <View style={[inputStyles.unitToggle, { alignSelf: 'flex-start', marginBottom: 8 }]}>
                    {(['cm', 'in', 'ft'] as const).map((u) => {
                      const active = draft.heightUnit === u;
                      const label = u === 'ft' ? 'ft + in' : u;
                      return (
                        <TouchableOpacity
                          key={u}
                          onPress={() => setDraft({ ...draft, heightUnit: u })}
                          style={[inputStyles.unitChip, active && inputStyles.unitChipActive]}
                        >
                          <Text style={[inputStyles.unitChipText, active && inputStyles.unitChipTextActive]}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {draft.heightUnit === 'ft' ? (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={[inputStyles.fieldRow, { flex: 1 }]}>
                        <Ionicons name="resize-outline" size={18} color={Colors.primary} />
                        <TextInput
                          value={draft.heightFeet}
                          onChangeText={(t) => setDraft({ ...draft, heightFeet: t })}
                          placeholder="2"
                          keyboardType="decimal-pad"
                          placeholderTextColor={Colors.textMuted}
                          style={inputStyles.fieldInput}
                        />
                        <Text style={inputStyles.fieldSuffix}>ft</Text>
                      </View>
                      <View style={[inputStyles.fieldRow, { flex: 1 }]}>
                        <TextInput
                          value={draft.heightInches}
                          onChangeText={(t) => setDraft({ ...draft, heightInches: t })}
                          placeholder="4"
                          keyboardType="decimal-pad"
                          placeholderTextColor={Colors.textMuted}
                          style={inputStyles.fieldInput}
                        />
                        <Text style={inputStyles.fieldSuffix}>in</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={inputStyles.fieldRow}>
                      <Ionicons name="resize-outline" size={18} color={Colors.primary} />
                      <TextInput
                        value={draft.value}
                        onChangeText={(t) => setDraft({ ...draft, value: t })}
                        placeholder={draft.heightUnit === 'cm' ? 'e.g. 68' : 'e.g. 27'}
                        keyboardType="decimal-pad"
                        placeholderTextColor={Colors.textMuted}
                        style={inputStyles.fieldInput}
                      />
                      <Text style={inputStyles.fieldSuffix}>{draft.heightUnit}</Text>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Diaper */}
            {tracker.key === 'diaper' && (
              <View style={inputStyles.fieldBlock}>
                <Text style={inputStyles.fieldLabel}>Type</Text>
                <View style={inputStyles.diaperRow}>
                  {(
                    [
                      { key: 'wet',   label: 'Wet',   icon: 'water-outline' as const },
                      { key: 'dirty', label: 'Dirty', icon: 'leaf-outline' as const },
                      { key: 'mixed', label: 'Mixed', icon: 'swap-horizontal-outline' as const },
                    ] satisfies { key: DiaperKind; label: string; icon: keyof typeof Ionicons.glyphMap }[]
                  ).map((d) => {
                    const active = draft.diaperKind === d.key;
                    return (
                      <TouchableOpacity
                        key={d.key}
                        onPress={() => setDraft({ ...draft, diaperKind: d.key })}
                        style={[inputStyles.diaperChip, active && inputStyles.diaperChipActive]}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name={d.icon}
                          size={16}
                          color={active ? '#fff' : Colors.primary}
                        />
                        <Text style={[inputStyles.diaperChipText, active && inputStyles.diaperChipTextActive]}>
                          {d.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Sleep */}
            {tracker.key === 'sleep' && (
              <>
                <DateTimeField
                  label="Sleep started"
                  value={draft.sleepStart}
                  onChange={(iso) => setDraft({ ...draft, sleepStart: iso })}
                />
                <DateTimeField
                  label="Sleep ended"
                  value={draft.sleepEnd}
                  onChange={(iso) => setDraft({ ...draft, sleepEnd: iso })}
                />
                {(() => {
                  const s = new Date(draft.sleepStart).getTime();
                  const e = new Date(draft.sleepEnd).getTime();
                  if (!isFinite(s) || !isFinite(e) || e <= s) return null;
                  return (
                    <Text style={inputStyles.hintText}>
                      Duration · {formatDuration(Math.round((e - s) / 60000))}
                    </Text>
                  );
                })()}
              </>
            )}

            {/* Measured-at — not shown for sleep (implied by start/end) */}
            {tracker.key !== 'sleep' && (
              <DateTimeField
                label="When"
                value={draft.at}
                onChange={(iso) => setDraft({ ...draft, at: iso })}
              />
            )}

            {/* Note */}
            <View style={inputStyles.fieldBlock}>
              <Text style={inputStyles.fieldLabel}>Note (optional)</Text>
              <View style={[inputStyles.fieldRow, { alignItems: 'flex-start' }]}>
                <Ionicons name="create-outline" size={18} color={Colors.primary} style={{ marginTop: 2 }} />
                <TextInput
                  value={draft.note}
                  onChangeText={(t) => setDraft({ ...draft, note: t })}
                  placeholder="Anything notable…"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  style={[inputStyles.fieldInput, { minHeight: 42, textAlignVertical: 'top' }]}
                />
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSave}
            disabled={!canSave}
            style={{ borderRadius: 12, overflow: 'hidden', opacity: canSave ? 1 : 0.5 }}
          >
            <LinearGradient
              colors={Gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={sheetStyles.saveBtn}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
              <Text style={sheetStyles.saveBtnText}>Save entry</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Per-tracker card ─────────────────────────────────────────────────────────

function TrackerCard({
  meta,
  entries,
  onAdd,
  onDelete,
  heightUnit,
  onToggleHeightUnit,
}: {
  meta: TrackerMeta;
  entries: GrowthEntry[];
  onAdd: () => void;
  onDelete: (entryId: string) => void;
  heightUnit?: 'cm' | 'in';
  onToggleHeightUnit?: () => void;
}) {
  const latest = entries[0];

  const renderValue = (e: GrowthEntry): string => {
    if (meta.key === 'weight')  return `${(e.value ?? 0).toFixed(2)} kg`;
    if (meta.key === 'head')    return `${(e.value ?? 0).toFixed(1)} cm`;
    if (meta.key === 'height') {
      const cm = e.value ?? 0;
      return heightUnit === 'in' ? `${cmToInches(cm).toFixed(1)} in` : `${cm.toFixed(1)} cm`;
    }
    if (meta.key === 'diaper')  {
      const k = e.diaperKind ?? 'wet';
      return k.charAt(0).toUpperCase() + k.slice(1);
    }
    if (meta.key === 'sleep')   return formatDuration(sleepDurationMinutes(e));
    return '—';
  };

  const trendNote = (() => {
    if (entries.length < 2) return null;
    if (meta.key !== 'weight' && meta.key !== 'height' && meta.key !== 'head') return null;
    const a = entries[0].value ?? 0;
    const b = entries[1].value ?? 0;
    const diff = a - b;
    if (diff === 0) return null;
    const sign = diff > 0 ? '+' : '';
    const unit = meta.key === 'weight' ? 'kg' : 'cm';
    const shown = meta.key === 'height' && heightUnit === 'in'
      ? `${sign}${cmToInches(diff).toFixed(1)} in`
      : `${sign}${diff.toFixed(meta.key === 'weight' ? 2 : 1)} ${unit}`;
    return `${shown} vs previous`;
  })();

  return (
    <Card style={styles.card} shadow="sm">
      <View style={styles.cardHeader}>
        <View style={[styles.iconWrap, { backgroundColor: Colors.primaryAlpha08 }]}>
          <Ionicons name={meta.icon} size={20} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{meta.label}</Text>
          <Text style={styles.cardSub}>
            {entries.length === 0
              ? 'No entries yet'
              : `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`}
          </Text>
        </View>
        {meta.key === 'height' && onToggleHeightUnit ? (
          <TouchableOpacity onPress={onToggleHeightUnit} style={styles.unitSwitch} activeOpacity={0.8}>
            <Text style={styles.unitSwitchText}>{heightUnit === 'in' ? 'inch' : 'cm'}</Text>
            <Ionicons name="swap-horizontal" size={12} color={Colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {latest ? (
        <View style={styles.latestBlock}>
          <Text style={styles.latestValue}>{renderValue(latest)}</Text>
          <Text style={styles.latestMeta}>
            {meta.key === 'sleep'
              ? `${formatDateShort(latest.sleepStart ?? latest.at)} · started ${new Date(latest.sleepStart ?? latest.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`
              : formatDateTime(latest.at)}
          </Text>
          {trendNote ? <Text style={[styles.latestMeta, { color: Colors.primary, marginTop: 2 }]}>{trendNote}</Text> : null}
        </View>
      ) : (
        <Text style={styles.emptyLine}>Tap “Add entry” to record your first {meta.label.toLowerCase()} reading.</Text>
      )}

      {entries.length > 1 && (
        <View style={styles.historyBlock}>
          <Text style={styles.historyHeader}>History</Text>
          {entries.slice(1, 6).map((e) => (
            <View key={e.id} style={styles.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyValue}>{renderValue(e)}</Text>
                <Text style={styles.historyMeta}>
                  {meta.key === 'sleep'
                    ? formatDateTime(e.sleepStart ?? e.at)
                    : formatDateTime(e.at)}
                </Text>
                {e.note ? <Text style={styles.historyNote}>“{e.note}”</Text> : null}
              </View>
              <TouchableOpacity onPress={() => onDelete(e.id)} hitSlop={8} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={15} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
          {entries.length > 6 ? (
            <Text style={styles.moreNote}>+{entries.length - 6} more older entries</Text>
          ) : null}
        </View>
      )}

      <TouchableOpacity onPress={onAdd} activeOpacity={0.85} style={styles.addBtn}>
        <LinearGradient
          colors={Gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.addBtnGrad}
        >
          <Ionicons name="add-circle-outline" size={16} color="#fff" />
          <Text style={styles.addBtnText}>Add entry</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Card>
  );
}

// ─── Main tab (shared by Growth + Routine) ───────────────────────────────────

function TrackerTab({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { activeKid } = useActiveKid();
  const byKid = useGrowthStore((s) => s.byKid);
  const addEntry = useGrowthStore((s) => s.addEntry);
  const deleteEntry = useGrowthStore((s) => s.deleteEntry);

  const [sheetTracker, setSheetTracker] = useState<TrackerMeta | null>(null);
  const [heightUnit, setHeightUnit] = useState<'cm' | 'in'>('cm');

  const trackers = mode === 'growth' ? GROWTH_TRACKERS : ROUTINE_TRACKERS;
  const kidId = activeKid?.id ?? '';

  const entriesByTracker = useMemo(() => {
    const out: Record<GrowthTracker, GrowthEntry[]> = {
      weight: [], height: [], head: [], diaper: [], sleep: [],
    };
    if (!kidId) return out;
    const map = byKid[kidId] ?? {};
    for (const t of trackers) {
      out[t.key] = map[t.key] ?? [];
    }
    return out;
  }, [byKid, kidId, trackers]);

  // ── No active kid ─────────────────────────────────────────────
  if (!activeKid) {
    return (
      <Card style={emptyStyles.card} shadow="sm">
        <Ionicons
          name={mode === 'growth' ? 'trending-up-outline' : 'time-outline'}
          size={40}
          color={Colors.primary}
          style={{ marginBottom: 12, opacity: 0.85 }}
        />
        <Text style={emptyStyles.title}>Add your baby first</Text>
        <Text style={emptyStyles.text}>
          {mode === 'growth'
            ? 'Track weight, height, and head circumference once your baby is added.'
            : 'Log diapers and sleep once your baby is added.'}
        </Text>
        <TouchableOpacity
          style={emptyStyles.btn}
          onPress={() => router.push('/(tabs)/family')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={emptyStyles.btnGrad}
          >
            <Ionicons name="add-circle-outline" size={16} color="#fff" />
            <Text style={emptyStyles.btnText}>Add your baby</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Card>
    );
  }

  if (activeKid.isExpecting) {
    return (
      <Card style={emptyStyles.card} shadow="sm">
        <Ionicons name="heart-outline" size={40} color={Colors.primary} style={{ marginBottom: 12, opacity: 0.85 }} />
        <Text style={emptyStyles.title}>Available after birth</Text>
        <Text style={emptyStyles.text}>
          {mode === 'growth'
            ? 'Growth tracking starts once your baby arrives. We’ll unlock this section automatically.'
            : 'Diaper and sleep logging starts once your baby arrives.'}
        </Text>
      </Card>
    );
  }

  return (
    <>
      <View style={styles.introBanner}>
        <Ionicons
          name={mode === 'growth' ? 'trending-up-outline' : 'time-outline'}
          size={18}
          color={Colors.primary}
        />
        <Text style={styles.introText}>
          {mode === 'growth'
            ? `Log ${activeKid.name}'s weight, height, and head circumference. Each entry is stored privately and synced across your devices.`
            : `Log ${activeKid.name}'s diaper changes and sleep. Spot patterns over the week at a glance.`}
        </Text>
      </View>

      {trackers.map((meta) => (
        <TrackerCard
          key={meta.key}
          meta={meta}
          entries={entriesByTracker[meta.key]}
          onAdd={() => setSheetTracker(meta)}
          onDelete={(entryId) => deleteEntry(kidId, meta.key, entryId)}
          heightUnit={meta.key === 'height' ? heightUnit : undefined}
          onToggleHeightUnit={meta.key === 'height' ? () => setHeightUnit((u) => (u === 'cm' ? 'in' : 'cm')) : undefined}
        />
      ))}

      <AddEntrySheet
        visible={!!sheetTracker}
        tracker={sheetTracker}
        onClose={() => setSheetTracker(null)}
        onSave={(entry) => {
          if (!sheetTracker) return;
          addEntry(kidId, sheetTracker.key, entry);
        }}
      />
    </>
  );
}

export default function GrowthTab() {
  return <TrackerTab mode="growth" />;
}

export function RoutineTab() {
  return <TrackerTab mode="routine" />;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  introBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.primaryAlpha05,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.primaryAlpha12,
  },
  introText: {
    fontFamily: Fonts.sansRegular,
    flex: 1,
    fontSize: 12.5,
    color: Colors.textLight,
    lineHeight: 18,
  },
  card: { marginBottom: 14, padding: 14 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    color: Colors.textDark,
  },
  cardSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  unitSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primarySoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.primaryAlpha20,
  },
  unitSwitchText: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    color: Colors.primary,
  },
  latestBlock: {
    backgroundColor: Colors.bgTint,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  latestValue: {
    fontFamily: Fonts.sansBold,
    fontSize: 22,
    color: Colors.textDark,
    letterSpacing: -0.3,
  },
  latestMeta: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
  },
  emptyLine: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 10,
    lineHeight: 19,
  },
  historyBlock: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
    paddingTop: 10,
    marginBottom: 10,
  },
  historyHeader: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    color: Colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  historyValue: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: Colors.textDark,
  },
  historyMeta: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  historyNote: {
    fontFamily: Fonts.sansRegular,
    fontStyle: 'italic',
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
  },
  deleteBtn: { padding: 4 },
  moreNote: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 6,
  },
  addBtn: { borderRadius: 10, overflow: 'hidden', marginTop: 2 },
  addBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  addBtnText: {
    fontFamily: Fonts.sansBold,
    color: '#fff',
    fontSize: 13,
  },
});

const inputStyles = StyleSheet.create({
  fieldBlock: { marginBottom: 12 },
  fieldLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    color: Colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  fieldInput: {
    flex: 1,
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: Colors.textDark,
    padding: 0,
  },
  fieldSuffix: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
    color: Colors.textLight,
  },
  hintText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: Colors.primary,
    marginTop: -4,
    marginBottom: 10,
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.primarySoft,
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  unitChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unitChipActive: { backgroundColor: Colors.primary },
  unitChipText: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    color: Colors.primary,
  },
  unitChipTextActive: { color: '#fff' },
  diaperRow: { flexDirection: 'row', gap: 8 },
  diaperChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  diaperChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  diaperChipText: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    color: Colors.textDark,
  },
  diaperChipTextActive: { color: '#fff' },
});

const sheetStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 22,
    maxHeight: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontFamily: Fonts.sansBold,
    fontSize: 16,
    color: Colors.textDark,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  saveBtnText: {
    fontFamily: Fonts.sansBold,
    color: '#fff',
    fontSize: 14,
  },
});

const emptyStyles = StyleSheet.create({
  card: { alignItems: 'center', paddingVertical: 32 },
  title: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    color: Colors.textDark,
    marginBottom: 6,
  },
  text: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  btn: { borderRadius: 12, overflow: 'hidden', marginTop: 14 },
  btnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  btnText: {
    fontFamily: Fonts.sansBold,
    color: '#fff',
    fontSize: 13,
  },
});
