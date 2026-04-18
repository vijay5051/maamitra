import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DatePickerField from '../ui/DatePickerField';
import { eruptionWindowLabel, shedWindowLabel, ToothRef } from '../../data/teeth';
import { ToothEntry, ToothState } from '../../store/useTeethStore';
import { Fonts } from '../../constants/theme';

const ROSE = '#E8487A';
const PLUM = '#7C3AED';
const SAGE = '#34D399';
const GOLD = '#F59E0B';
const MIST = '#EDE9F6';
const INK  = '#1C1033';
const STONE = '#6B7280';

interface Props {
  visible: boolean;
  tooth: ToothRef | null;
  entry: ToothEntry | null;
  /** Baby's age in months — drives default state and whether shed is offered. */
  kidAgeMonths: number;
  onSave: (entry: ToothEntry) => void;
  onClear: () => void;
  onClose: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function ToothDetailSheet({
  visible,
  tooth,
  entry,
  kidAgeMonths,
  onSave,
  onClear,
  onClose,
}: Props) {
  const [state, setState] = useState<ToothState>('not-erupted');
  const [eruptDate, setEruptDate] = useState<string>('');
  const [shedDate, setShedDate] = useState<string>('');

  useEffect(() => {
    if (!visible || !tooth) return;
    setState(entry?.state ?? 'not-erupted');
    setEruptDate(entry?.eruptDate ?? '');
    setShedDate(entry?.shedDate ?? '');
  }, [visible, tooth, entry]);

  if (!tooth) return null;

  const ageYears = kidAgeMonths / 12;
  const shedAllowed = ageYears >= 5; // primary teeth start shedding around year 5–6
  const ageDelta = kidAgeMonths < tooth.eruptMinMo
    ? `Baby is ${kidAgeMonths} mo — typical eruption is ${tooth.eruptMinMo}–${tooth.eruptMaxMo} mo. Plenty of time.`
    : kidAgeMonths > tooth.eruptMaxMo && !entry?.eruptDate
      ? `Baby is ${kidAgeMonths} mo — most kids have this tooth by ${tooth.eruptMaxMo} mo. Many are still on track; mention to your doctor at the next visit if concerned.`
      : `Typical eruption: ${eruptionWindowLabel(tooth)}.`;

  const handleSave = () => {
    if (state === 'not-erupted') {
      onClear();
      onClose();
      return;
    }
    const safeErupt = eruptDate || today();
    const next: ToothEntry = {
      state,
      eruptDate: safeErupt,
      ...(state === 'shed' ? { shedDate: shedDate || today() } : {}),
    };
    onSave(next);
    onClose();
  };

  const segOptions: { key: ToothState; label: string; disabled?: boolean }[] = [
    { key: 'not-erupted', label: 'Not yet' },
    { key: 'erupted',     label: 'Erupted' },
    { key: 'shed',        label: 'Shed', disabled: !shedAllowed },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => { /* swallow taps */ }}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toothName}>{tooth.name}</Text>
              <Text style={styles.toothSub}>
                {tooth.shortName} · Position #{tooth.position} · FDI {tooth.id}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={STONE} />
            </TouchableOpacity>
          </View>

          {/* Reference */}
          <View style={styles.refBox}>
            <Ionicons name="information-circle-outline" size={15} color={PLUM} />
            <Text style={styles.refText}>{ageDelta}</Text>
          </View>
          <Text style={styles.metaLine}>
            Typical shed: {shedWindowLabel(tooth)}
          </Text>

          {/* State selector */}
          <Text style={styles.sectionLabel}>Status</Text>
          <View style={styles.segWrap}>
            {segOptions.map((opt) => {
              const active = state === opt.key;
              const tint = opt.key === 'erupted' ? SAGE : opt.key === 'shed' ? GOLD : MIST;
              const textColor = opt.disabled ? '#C9C2DA' : active ? '#ffffff' : INK;
              const bg = active ? tint : '#FFF8FC';
              const border = active ? tint : '#E5DCEF';
              return (
                <TouchableOpacity
                  key={opt.key}
                  disabled={opt.disabled}
                  onPress={() => setState(opt.key)}
                  activeOpacity={0.85}
                  style={[
                    styles.segBtn,
                    { backgroundColor: bg, borderColor: border, opacity: opt.disabled ? 0.55 : 1 },
                  ]}
                >
                  <Text style={[styles.segText, { color: textColor }]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {!shedAllowed && state !== 'shed' && (
            <Text style={styles.disabledHint}>
              Shedding usually starts after age 5. Hidden until then.
            </Text>
          )}

          {/* Date pickers */}
          {state !== 'not-erupted' && (
            <View style={styles.dateBlock}>
              <Text style={styles.dateLabel}>When did it erupt?</Text>
              <DatePickerField
                value={eruptDate}
                onChange={setEruptDate}
                placeholder="Tap to pick eruption date"
                maxDate={today()}
              />
            </View>
          )}
          {state === 'shed' && (
            <View style={styles.dateBlock}>
              <Text style={styles.dateLabel}>When did it shed?</Text>
              <DatePickerField
                value={shedDate}
                onChange={setShedDate}
                placeholder="Tap to pick shed date"
                minDate={eruptDate || undefined}
                maxDate={today()}
              />
            </View>
          )}

          {/* Actions */}
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
              <Text style={styles.clearBtnText}>Clear this tooth</Text>
            </TouchableOpacity>
          )}
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
  toothName: {
    fontFamily: Fonts.sansBold,
    fontSize: 16,
    color: INK,
  },
  toothSub: {
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
  },
  refText: {
    fontFamily: Fonts.sansMedium,
    flex: 1,
    fontSize: 12.5,
    color: '#4c1d95',
    lineHeight: 18,
  },
  metaLine: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11.5,
    color: STONE,
    marginTop: 6,
    marginBottom: 14,
  },
  sectionLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  segWrap: {
    flexDirection: 'row',
    gap: 8,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  segText: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
  },
  disabledHint: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: STONE,
    marginTop: 6,
    fontStyle: 'italic',
  },
  dateBlock: {
    marginTop: 14,
  },
  dateLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12.5,
    color: '#374151',
    marginBottom: 6,
  },
  saveBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 18,
  },
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
