import React, { useEffect, useState } from 'react';
import {
  Modal,
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
import DatePickerField from '../ui/DatePickerField';
import { FoodRef } from '../../data/babyFoods';
import { FoodEntry, FoodReaction } from '../../store/useFoodTrackerStore';
import { Fonts } from '../../constants/theme';
import { Colors } from '../../constants/theme';

const ROSE = Colors.primary;
const PLUM = Colors.primary;
const SAGE = '#34D399';
const GOLD = '#F59E0B';
const MIST = '#EDE9F6';
const INK  = '#1C1033';
const STONE = '#6B7280';

interface Props {
  visible: boolean;
  food: FoodRef | null;
  entry: FoodEntry | null;
  /** Baby's age in months — gates whether we can save and what reactions to surface. */
  kidAgeMonths: number;
  kidName: string;
  onSave: (entry: FoodEntry) => void;
  onClear: () => void;
  onClose: () => void;
}

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function clampToToday(date: string | undefined): string | undefined {
  if (!date) return undefined;
  const t = todayLocal();
  return date > t ? t : date;
}

const REACTION_OPTIONS: { key: FoodReaction; label: string; color: string }[] = [
  { key: 'none',  label: 'No reaction', color: SAGE },
  { key: 'rash',  label: 'Rash',        color: ROSE },
  { key: 'upset', label: 'Tummy upset', color: GOLD },
  { key: 'vomit', label: 'Vomiting',    color: ROSE },
  { key: 'fussy', label: 'Fussy',       color: GOLD },
  { key: 'other', label: 'Other',       color: STONE },
];

export default function FoodDetailSheet({
  visible,
  food,
  entry,
  kidAgeMonths,
  kidName,
  onSave,
  onClear,
  onClose,
}: Props) {
  const [d1Date, setD1Date] = useState<string>('');
  const [d2Date, setD2Date] = useState<string>('');
  const [d3Date, setD3Date] = useState<string>('');
  const [reaction, setReaction] = useState<FoodReaction>('none');
  const [reactionNote, setReactionNote] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (!visible || !food) return;
    setD1Date(entry?.d1Date ?? '');
    setD2Date(entry?.d2Date ?? '');
    setD3Date(entry?.d3Date ?? '');
    setReaction(entry?.reaction ?? 'none');
    setReactionNote(entry?.reactionNote ?? '');
    setNotes(entry?.notes ?? '');
  }, [visible, food, entry]);

  if (!food) return null;

  const tooYoung = kidAgeMonths < food.minAgeMonths;
  const isSerious = reaction === 'rash' || reaction === 'vomit';

  const handleSave = () => {
    const next: FoodEntry = {
      d1Date: clampToToday(d1Date) || undefined,
      d2Date: clampToToday(d2Date) || undefined,
      d3Date: clampToToday(d3Date) || undefined,
      reaction,
      reactionNote: reactionNote.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    onSave(next);
    onClose();
  };

  const stampToday = (slot: 1 | 2 | 3) => {
    const t = todayLocal();
    if (slot === 1) setD1Date(d1Date ? '' : t);
    if (slot === 2) setD2Date(d2Date ? '' : t);
    if (slot === 3) setD3Date(d3Date ? '' : t);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => { /* swallow */ }}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.foodName}>{food.name}</Text>
                <Text style={styles.foodSub}>
                  Safe from {food.minAgeMonths} months
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={22} color={STONE} />
              </TouchableOpacity>
            </View>

            {/* Age gate */}
            {tooYoung && (
              <View style={[styles.refBox, { backgroundColor: 'rgba(245,158,11,0.08)', borderLeftColor: GOLD }]}>
                <Ionicons name="time-outline" size={15} color="#d97706" />
                <Text style={[styles.refText, { color: '#92400e' }]}>
                  {kidName} is {kidAgeMonths} mo — typically safe from {food.minAgeMonths} mo. Best to wait a little longer.
                </Text>
              </View>
            )}

            {/* Warning */}
            {food.warning && (
              <View style={[styles.refBox, { backgroundColor: 'rgba(239,68,68,0.06)', borderLeftColor: '#ef4444' }]}>
                <Ionicons name="alert-circle-outline" size={15} color="#dc2626" />
                <Text style={[styles.refText, { color: '#7f1d1d' }]}>{food.warning}</Text>
              </View>
            )}

            {/* 3-day rule */}
            <Text style={styles.sectionLabel}>3-day rule</Text>
            <Text style={styles.help}>
              Feed for 3 days in a row before trying the next new food. Tap a day to stamp today, or pick a date.
            </Text>

            <View style={styles.daysRow}>
              {([1, 2, 3] as const).map((slot) => {
                const value = slot === 1 ? d1Date : slot === 2 ? d2Date : d3Date;
                const setter = slot === 1 ? setD1Date : slot === 2 ? setD2Date : setD3Date;
                const filled = !!value;
                return (
                  <View key={slot} style={styles.dayCol}>
                    <TouchableOpacity
                      onPress={() => stampToday(slot)}
                      activeOpacity={0.85}
                      style={[styles.dayChip, filled && styles.dayChipFilled]}
                    >
                      <Text style={[styles.dayChipText, filled && styles.dayChipTextFilled]}>
                        Day {slot}
                      </Text>
                      {filled && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </TouchableOpacity>
                    <DatePickerField
                      value={value}
                      onChange={(d) => setter(clampToToday(d) ?? '')}
                      placeholder="—"
                      maxDate={todayLocal()}
                    />
                  </View>
                );
              })}
            </View>

            {/* Reaction */}
            <Text style={styles.sectionLabel}>Reaction</Text>
            <View style={styles.reactionGrid}>
              {REACTION_OPTIONS.map((opt) => {
                const active = reaction === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setReaction(opt.key)}
                    activeOpacity={0.85}
                    style={[
                      styles.reactionChip,
                      {
                        backgroundColor: active ? opt.color : '#FAFAFB',
                        borderColor: active ? opt.color : '#E5DCEF',
                      },
                    ]}
                  >
                    <Text style={[styles.reactionText, { color: active ? '#fff' : INK }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {isSerious && (
              <View style={[styles.refBox, { backgroundColor: 'rgba(239,68,68,0.06)', borderLeftColor: '#ef4444' }]}>
                <Ionicons name="warning-outline" size={15} color="#dc2626" />
                <Text style={[styles.refText, { color: '#7f1d1d' }]}>
                  Stop this food and call your paediatrician. Note the timing and severity.
                </Text>
              </View>
            )}

            {reaction !== 'none' && (
              <TextInput
                value={reactionNote}
                onChangeText={setReactionNote}
                placeholder="What did you notice? (optional)"
                placeholderTextColor="#9ca3af"
                style={styles.noteInput}
                multiline
              />
            )}

            {/* Notes */}
            <Text style={styles.sectionLabel}>Notes (optional)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Texture, quantity, what worked, what didn't…"
              placeholderTextColor="#9ca3af"
              style={[styles.noteInput, { minHeight: 70 }]}
              multiline
            />

            {/* Save */}
            <TouchableOpacity onPress={handleSave} activeOpacity={0.9} style={styles.saveBtn}>
              <LinearGradient
                colors={[ROSE, PLUM]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveBtnGrad}
              >
                <Ionicons name="checkmark-circle-outline" size={17} color="#fff" />
                <Text style={styles.saveBtnText}>Save</Text>
              </LinearGradient>
            </TouchableOpacity>

            {entry && (
              <TouchableOpacity onPress={() => { onClear(); onClose(); }} activeOpacity={0.7} style={styles.clearBtn}>
                <Ionicons name="trash-outline" size={14} color={STONE} />
                <Text style={styles.clearBtnText}>Clear this food</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(28,16,51,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    maxHeight: '90%',
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5DCEF',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  foodName: {
    fontFamily: Fonts.sansBold,
    fontSize: 17,
    color: INK,
  },
  foodSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: STONE,
    marginTop: 2,
  },
  refBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(124,58,237,0.06)',
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: PLUM,
    marginBottom: 12,
  },
  refText: {
    fontFamily: Fonts.sansMedium,
    flex: 1,
    fontSize: 12.5,
    color: '#4c1d95',
    lineHeight: 18,
  },
  sectionLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 8,
  },
  help: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: STONE,
    marginBottom: 10,
    lineHeight: 17,
  },
  daysRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  dayCol: {
    flex: 1,
    gap: 8,
  },
  dayChip: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5DCEF',
    backgroundColor: '#FAFAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipFilled: {
    backgroundColor: SAGE,
    borderColor: SAGE,
  },
  dayChipText: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    color: INK,
  },
  dayChipTextFilled: {
    color: '#fff',
  },
  reactionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  reactionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1.5,
  },
  reactionText: {
    fontFamily: Fonts.sansBold,
    fontSize: 12.5,
  },
  noteInput: {
    backgroundColor: '#FAFAFB',
    borderWidth: 1,
    borderColor: MIST,
    borderRadius: 10,
    padding: 10,
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: INK,
    marginTop: 6,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  saveBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 18 },
  saveBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
  },
  saveBtnText: {
    fontFamily: Fonts.sansBold,
    color: '#ffffff',
    fontSize: 15,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
  },
  clearBtnText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12.5,
    color: STONE,
  },
});
