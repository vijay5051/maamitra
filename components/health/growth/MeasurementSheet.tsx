import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientButton from '../../ui/GradientButton';
import DatePickerField from '../../ui/DatePickerField';
import { Colors, Fonts } from '../../../constants/theme';
import { confirmAction } from '../../../lib/cross-platform-alerts';
import {
  ageMonthsAt,
  dateKey,
  isoFromDateKey,
  LengthMode,
  MeasurePlace,
  parseMeasure,
  validateVisit,
  Visit,
  VisitErrors,
} from '../../../lib/growth';
import { useGrowthStore } from '../../../store/useGrowthStore';

const INK = Colors.textDark;
const STONE = Colors.textLight;

interface Props {
  visible: boolean;
  kidId: string;
  kidName: string;
  dob: string;
  /** Existing visit when editing. */
  initial?: Visit | null;
  /** Suggested date for a new entry (e.g. tapped an empty timeline marker). */
  presetDate?: string;
  onClose: () => void;
}

/**
 * One form for a day's measurements: weight, length/height, head — any
 * subset — plus how/where it was measured and a note. Works for birth
 * measurements, past dates, edits and deletion.
 */
export default function MeasurementSheet({ visible, kidId, kidName, dob, initial, presetDate, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const saveVisit = useGrowthStore((s) => s.saveVisit);
  const deleteVisit = useGrowthStore((s) => s.deleteVisit);
  const today = dateKey(new Date());
  const dobKey = dateKey(dob);

  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState('');
  const [length, setLength] = useState('');
  const [head, setHead] = useState('');
  const [mode, setMode] = useState<LengthMode | null>(null);
  const [place, setPlace] = useState<MeasurePlace | null>(null);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<VisitErrors>({});

  useEffect(() => {
    if (!visible) return;
    setDate(initial?.date ?? presetDate ?? today);
    setWeight(initial?.weightKg != null ? String(initial.weightKg) : '');
    setLength(initial?.lengthCm != null ? String(initial.lengthCm) : '');
    setHead(initial?.headCm != null ? String(initial.headCm) : '');
    setMode(initial?.lengthMode ?? null);
    setPlace(initial?.place ?? null);
    setNote(initial?.note ?? '');
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Suggested (not forced) measuring position: lying under 2 years, standing after.
  const ageAtDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? ageMonthsAt(dob, isoFromDateKey(date)) : 0;
  const effectiveMode: LengthMode = mode ?? (ageAtDate < 24 ? 'lying' : 'standing');

  const handleSave = () => {
    const errs = validateVisit({ date, weight, length, head }, dob, today);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    const lengthCm = parseMeasure(length);
    saveVisit(
      kidId,
      {
        date,
        weightKg: parseMeasure(weight),
        lengthCm,
        headCm: parseMeasure(head),
        lengthMode: lengthCm != null ? effectiveMode : undefined,
        place: place ?? undefined,
        note: note.trim() || undefined,
      },
      initial?.date,
    );
    onClose();
  };

  const handleDelete = async () => {
    if (!initial) return;
    const ok = await confirmAction('Delete this measurement?', `This removes everything recorded for ${kidName} on this date.`, {
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    deleteVisit(kidId, initial.date);
    onClose();
  };

  const field = (
    label: string,
    unit: string,
    value: string,
    set: (v: string) => void,
    error: string | undefined,
    placeholder: string,
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, !!error && styles.inputErr]}>
        <TextInput
          value={value}
          onChangeText={(t) => { set(t.replace(/[^0-9.,]/g, '').slice(0, 7)); }}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType="decimal-pad"
          inputMode="decimal"
          style={styles.input}
          accessibilityLabel={`${label} in ${unit}`}
        />
        <Text style={styles.unit}>{unit}</Text>
      </View>
      {!!error && <Text style={styles.err}>{error}</Text>}
    </View>
  );

  const pill = <T extends string>(current: T | null, value: T, label: string, set: (v: T | null) => void, selected?: boolean) => {
    const on = selected ?? current === value;
    return (
      <TouchableOpacity
        key={value}
        onPress={() => set(current === value ? null : value)}
        style={[styles.pill, on && styles.pillOn]}
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
      >
        <Text style={[styles.pillText, on && styles.pillTextOn]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close without saving">
            <Ionicons name="close" size={22} color={INK} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{initial ? 'Edit measurement' : 'Add measurement'}</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Fill in whatever you have for {kidName} — one, two or all three. You can add older readings too.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Date measured</Text>
            <DatePickerField value={date} onChange={setDate} minDate={dobKey} maxDate={today} placeholder="Pick a date" />
            {!!errors.date && <Text style={styles.err}>{errors.date}</Text>}
            {date !== dobKey && (
              <TouchableOpacity onPress={() => setDate(dobKey)} style={{ marginTop: 8 }} accessibilityRole="button">
                <Text style={styles.link}>These are birth measurements</Text>
              </TouchableOpacity>
            )}
          </View>

          {field('Weight', 'kg', weight, setWeight, errors.weight, 'e.g. 7.2')}
          {field(effectiveMode === 'lying' ? 'Length' : 'Height', 'cm', length, setLength, errors.length, 'e.g. 68')}

          <View style={styles.field}>
            <Text style={styles.subLabel}>How was it measured?</Text>
            <View style={styles.pills}>
              {pill<LengthMode>(mode, 'lying', 'Lying down (length)', setMode, effectiveMode === 'lying')}
              {pill<LengthMode>(mode, 'standing', 'Standing (height)', setMode, effectiveMode === 'standing')}
            </View>
          </View>

          {field('Head circumference', 'cm', head, setHead, errors.head, 'e.g. 43')}

          <View style={styles.field}>
            <Text style={styles.label}>Where? (optional)</Text>
            <View style={styles.pills}>
              {pill<MeasurePlace>(place, 'home', 'At home', setPlace)}
              {pill<MeasurePlace>(place, 'clinic', 'Clinic / hospital', setPlace)}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              value={note}
              onChangeText={(t) => setNote(t.slice(0, 300))}
              placeholder="Anything worth remembering"
              placeholderTextColor={Colors.textMuted}
              style={[styles.inputRow, styles.noteInput]}
              multiline
              accessibilityLabel="Notes"
            />
          </View>

          {!!errors.form && <Text style={[styles.err, { marginBottom: 6 }]}>{errors.form}</Text>}

          {initial && (
            <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn} accessibilityRole="button">
              <Ionicons name="trash-outline" size={15} color={Colors.error} />
              <Text style={styles.deleteText}>Delete this measurement</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <GradientButton title={initial ? 'Save changes' : 'Save measurement'} onPress={handleSave} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14, backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSoft,
  },
  headerTitle: { fontFamily: Fonts.sansBold, fontSize: 15, color: INK },
  scroll: { padding: 18, paddingBottom: 30 },
  intro: { fontFamily: Fonts.sansRegular, fontSize: 13.5, color: STONE, lineHeight: 20, marginBottom: 16 },
  field: { marginBottom: 16 },
  label: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: INK, marginBottom: 8 },
  subLabel: { fontFamily: Fonts.sansMedium, fontSize: 12.5, color: STONE, marginBottom: 8, marginTop: -6 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9F7FD', borderColor: Colors.border, borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, minHeight: 48,
  },
  inputErr: { borderColor: Colors.error },
  input: { flex: 1, fontFamily: Fonts.sansRegular, fontSize: 16, color: INK, paddingVertical: 12 },
  unit: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: STONE },
  noteInput: { minHeight: 72, paddingVertical: 12, fontFamily: Fonts.sansRegular, fontSize: 15, color: INK, textAlignVertical: 'top' },
  err: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.error, marginTop: 6 },
  link: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: Colors.primary },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white },
  pillOn: { backgroundColor: Colors.primaryAlpha08, borderColor: Colors.primary },
  pillText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: STONE },
  pillTextOn: { color: Colors.primary, fontFamily: Fonts.sansSemiBold },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  deleteText: { fontFamily: Fonts.sansSemiBold, fontSize: 13.5, color: Colors.error },
  footer: { paddingHorizontal: 18, paddingTop: 10, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.borderSoft },
});
