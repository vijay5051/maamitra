import { useEffect, useState } from 'react';
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
import { adultToothWindowLabel, eruptionWindowLabel, shedWindowLabel, ToothRef } from '../../data/teeth';
import { ToothEntry, ToothState } from '../../store/useTeethStore';
import { Fonts } from '../../constants/theme';
import { Colors } from '../../constants/theme';

const ROSE = Colors.primary;
const PLUM = Colors.primary;
const SAGE = '#34D399';
const GOLD = '#F59E0B';
const SKY  = '#60A5FA';
const MIST = '#EDE9F6';
const INK  = '#1C1033';
const STONE = '#6B7280';

interface Props {
  visible: boolean;
  tooth: ToothRef | null;
  entry: ToothEntry | null;
  /** Child's age in months — drives default state and the reference copy. */
  kidAgeMonths: number;
  /** Used in copy instead of the generic "Baby". */
  kidName?: string;
  /** 5y+ mode: Milk tooth / Fell out / Adult tooth in. */
  bigKid?: boolean;
  onSave: (entry: ToothEntry) => void;
  onClear: () => void;
  onClose: () => void;
}

/**
 * Local-calendar YYYY-MM-DD. Using toISOString() returns UTC, which is one
 * day behind IST after 18:30 UTC — that lets the date picker allow what
 * looks like "tomorrow" to the user.
 */
function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Clamp a YYYY-MM-DD string to ≤ today (local). Empty / invalid → today. */
function clampToToday(date: string | undefined): string {
  const t = todayLocal();
  if (!date) return t;
  return date > t ? t : date;
}

function ageText(months: number): string {
  if (months < 24) return `${months} mo`;
  const y = Math.floor(months / 12);
  return `${y} ${y === 1 ? 'yr' : 'yrs'}`;
}

export default function ToothDetailSheet({
  visible,
  tooth,
  entry,
  kidAgeMonths,
  kidName,
  bigKid = false,
  onSave,
  onClear,
  onClose,
}: Props) {
  const [state, setState] = useState<ToothState>('not-erupted');
  const [eruptDate, setEruptDate] = useState<string>('');
  const [shedDate, setShedDate] = useState<string>('');
  const [permanentDate, setPermanentDate] = useState<string>('');

  useEffect(() => {
    if (!visible || !tooth) return;
    // Big-kid mode: an unlogged tooth is a milk tooth that's still in.
    const fallback: ToothState = bigKid ? 'erupted' : 'not-erupted';
    const initial = entry?.state && entry.state !== 'not-erupted' ? entry.state : fallback;
    setState(initial);
    setEruptDate(entry?.eruptDate ?? '');
    setShedDate(entry?.shedDate ?? '');
    setPermanentDate(entry?.permanentDate ?? '');
  }, [visible, tooth, entry, bigKid]);

  if (!tooth) return null;

  const who = kidName?.trim() || (kidAgeMonths < 12 ? 'Baby' : 'Your child');
  const age = ageText(kidAgeMonths);
  const shedAllowed = bigKid; // milk teeth start falling out around year 5–6
  const ageYears = kidAgeMonths / 12;
  const ageDelta = bigKid
    ? ageYears < tooth.shedMinYr
      ? `Usually falls out at ${shedWindowLabel(tooth)}. ${who} is ${age} — not expected yet.`
      : ageYears <= tooth.shedMaxYr + 1
        ? `Usually falls out at ${shedWindowLabel(tooth)}. ${who} is ${age} — right in the window.`
        : `Usually falls out by ${tooth.shedMaxYr} years. ${who} is ${age} — a little later is common; mention it at the next dental check-up if you're unsure.`
    : kidAgeMonths < tooth.eruptMinMo
      ? `${who} is ${age} — typical eruption is ${tooth.eruptMinMo}–${tooth.eruptMaxMo} mo. Plenty of time.`
      : kidAgeMonths > tooth.eruptMaxMo && !entry?.eruptDate
        ? `${who} is ${age} — most kids have this tooth by ${tooth.eruptMaxMo} mo. Many are still on track; mention to your doctor at the next visit if concerned.`
        : `Typical eruption: ${eruptionWindowLabel(tooth)}.`;

  const handleSave = () => {
    if (state === 'not-erupted') {
      onClear();
      onClose();
      return;
    }
    if (bigKid) {
      // Big-kid mode never asks for an eruption date — the milk tooth came
      // in years ago. "Milk tooth" with nothing logged is the default, so
      // store nothing rather than a fake eruption date.
      if (state === 'erupted') {
        if (entry?.eruptDate) onSave({ state: 'erupted', eruptDate: entry.eruptDate });
        else onClear();
        onClose();
        return;
      }
      const safeShed = clampToToday(shedDate);
      let safePermanent: string | undefined;
      if (state === 'permanent') {
        safePermanent = clampToToday(permanentDate);
        if (safePermanent < safeShed) safePermanent = safeShed;
      }
      onSave({
        state,
        ...(entry?.eruptDate ? { eruptDate: entry.eruptDate } : {}),
        shedDate: safeShed,
        ...(safePermanent ? { permanentDate: safePermanent } : {}),
      });
      onClose();
      return;
    }
    // Hard-clamp to today regardless of what the picker / native fallback
    // returned — never persist a future date.
    const safeErupt = clampToToday(eruptDate);
    let safeShed: string | undefined;
    if (state === 'shed') {
      safeShed = clampToToday(shedDate);
      // Shed cannot be before eruption.
      if (safeShed < safeErupt) safeShed = safeErupt;
    }
    const next: ToothEntry = {
      state,
      eruptDate: safeErupt,
      ...(safeShed ? { shedDate: safeShed } : {}),
    };
    onSave(next);
    onClose();
  };

  const segOptions: { key: ToothState; label: string; disabled?: boolean }[] = bigKid
    ? [
        { key: 'erupted',   label: 'Milk tooth' },
        { key: 'shed',      label: 'Fell out' },
        { key: 'permanent', label: 'Adult tooth' },
      ]
    : [
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
            {bigKid
              ? `Adult tooth usually comes in: ${adultToothWindowLabel(tooth)}`
              : `Typical shed: ${shedWindowLabel(tooth)}`}
          </Text>

          {/* State selector */}
          <Text style={styles.sectionLabel}>Status</Text>
          <View style={styles.segWrap}>
            {segOptions.map((opt) => {
              const active = state === opt.key;
              const tint = opt.key === 'erupted' ? SAGE : opt.key === 'shed' ? GOLD : opt.key === 'permanent' ? SKY : MIST;
              const textColor = opt.disabled ? '#C9C2DA' : active ? '#ffffff' : INK;
              const bg = active ? tint : '#FAFAFB';
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

          {/* Date pickers — big-kid mode */}
          {bigKid && (state === 'shed' || state === 'permanent') && (
            <View style={styles.dateBlock}>
              <Text style={styles.dateLabel}>When did it fall out?</Text>
              <DatePickerField
                value={shedDate}
                onChange={(d) => setShedDate(clampToToday(d))}
                placeholder="Tap to pick the date"
                maxDate={todayLocal()}
              />
            </View>
          )}
          {bigKid && state === 'permanent' && (
            <View style={styles.dateBlock}>
              <Text style={styles.dateLabel}>When did the adult tooth come in?</Text>
              <DatePickerField
                value={permanentDate}
                onChange={(d) => {
                  const clamped = clampToToday(d);
                  setPermanentDate(shedDate && clamped < shedDate ? shedDate : clamped);
                }}
                placeholder="Tap to pick the date"
                minDate={shedDate || undefined}
                maxDate={todayLocal()}
              />
            </View>
          )}

          {/* Date pickers — baby mode */}
          {!bigKid && state !== 'not-erupted' && (
            <View style={styles.dateBlock}>
              <Text style={styles.dateLabel}>When did it erupt?</Text>
              <DatePickerField
                value={eruptDate}
                onChange={(d) => setEruptDate(clampToToday(d))}
                placeholder="Tap to pick eruption date"
                maxDate={todayLocal()}
              />
            </View>
          )}
          {!bigKid && state === 'shed' && (
            <View style={styles.dateBlock}>
              <Text style={styles.dateLabel}>When did it shed?</Text>
              <DatePickerField
                value={shedDate}
                onChange={(d) => {
                  const clamped = clampToToday(d);
                  // Don't let shed date precede eruption date.
                  setShedDate(eruptDate && clamped < eruptDate ? eruptDate : clamped);
                }}
                placeholder="Tap to pick shed date"
                minDate={eruptDate || undefined}
                maxDate={todayLocal()}
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
    backgroundColor: Colors.primaryAlpha05,
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
