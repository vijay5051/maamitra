import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

interface DatePickerFieldProps {
  value: string; // ISO date string YYYY-MM-DD, or ''
  onChange: (isoDate: string) => void; // Returns YYYY-MM-DD
  placeholder?: string;
  label?: string;
  minDate?: string; // YYYY-MM-DD
  maxDate?: string; // YYYY-MM-DD
}

/**
 * Cross-platform date picker field.
 * Web: native <input type="date"> overlay (mobile Safari date wheel).
 * Native (Android/iOS): pure-JS month-grid modal — no native module so it
 * ships via OTA without an EAS rebuild.
 */
export default function DatePickerField({
  value,
  onChange,
  placeholder = 'Select date',
  label,
  minDate,
  maxDate,
}: DatePickerFieldProps) {
  const displayValue = useMemo(() => {
    if (!value) return '';
    const d = new Date(value + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }, [value]);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.wrapper}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <View style={styles.inputRow}>
          <Ionicons name="calendar-outline" size={20} color={Colors.primary} style={styles.icon} />
          <Text style={[styles.displayText, !value && styles.placeholder]}>
            {displayValue || placeholder}
          </Text>
          {/* @ts-ignore — JSX HTML element used on web only */}
          <input
            type="date"
            value={value || ''}
            min={minDate}
            max={maxDate}
            onChange={(e: any) => onChange(e.target.value)}
            style={webInputStyle}
          />
        </View>
      </View>
    );
  }

  return (
    <NativeDatePickerField
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      label={label}
      minDate={minDate}
      maxDate={maxDate}
      displayValue={displayValue}
    />
  );
}

// ─── Native (Android/iOS) — pure-JS calendar modal ──────────────────────────
function NativeDatePickerField({
  value,
  onChange,
  placeholder,
  label,
  minDate,
  maxDate,
  displayValue,
}: DatePickerFieldProps & { displayValue: string }) {
  const [open, setOpen] = useState(false);
  const today = useMemo(() => new Date(), []);
  const initial = useMemo(() => parseIso(value) ?? today, [value, today]);
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth()); // 0-11
  const [mode, setMode] = useState<'days' | 'years'>('days');
  const yearScrollRef = useRef<ScrollView | null>(null);

  const minDt = useMemo(() => parseIso(minDate), [minDate]);
  const maxDt = useMemo(() => parseIso(maxDate), [maxDate]);

  const yearRange = useMemo(() => {
    const maxYear = maxDt ? maxDt.getFullYear() : today.getFullYear();
    const minYear = minDt ? minDt.getFullYear() : maxYear - 100;
    const arr: number[] = [];
    for (let y = maxYear; y >= minYear; y--) arr.push(y);
    return arr;
  }, [minDt, maxDt, today]);

  const openPicker = () => {
    const seed = parseIso(value) ?? today;
    setViewYear(seed.getFullYear());
    setViewMonth(seed.getMonth());
    setMode('days');
    setOpen(true);
  };

  // When switching to years view, scroll the selected year into the middle.
  useEffect(() => {
    if (mode !== 'years' || !yearScrollRef.current) return;
    const idx = yearRange.indexOf(viewYear);
    if (idx < 0) return;
    const ROW_HEIGHT = 44;
    const offset = Math.max(0, idx * ROW_HEIGHT - 120);
    requestAnimationFrame(() => {
      yearScrollRef.current?.scrollTo({ y: offset, animated: false });
    });
  }, [mode, viewYear, yearRange]);

  const pick = (day: number) => {
    const iso = formatIso(viewYear, viewMonth, day);
    onChange(iso);
    setOpen(false);
  };

  const goPrev = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };
  const goNext = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const cells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const selectedIso = value;
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        style={styles.inputRow}
        activeOpacity={0.7}
        onPress={openPicker}
        accessibilityLabel={label ?? 'Pick a date'}
      >
        <Ionicons name="calendar-outline" size={20} color={Colors.primary} style={styles.icon} />
        <Text style={[styles.displayText, !value && styles.placeholder]}>
          {displayValue || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#9ca3af" />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <TouchableOpacity
                onPress={mode === 'days' ? goPrev : undefined}
                hitSlop={8}
                style={[styles.navBtn, mode === 'years' && styles.navBtnHidden]}
                disabled={mode === 'years'}
              >
                <Ionicons name="chevron-back" size={20} color="#1a1a2e" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMode((m) => (m === 'days' ? 'years' : 'days'))}
                hitSlop={6}
                style={styles.titleBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.sheetTitle}>{monthLabel}</Text>
                <Ionicons
                  name={mode === 'years' ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={Colors.primary}
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={mode === 'days' ? goNext : undefined}
                hitSlop={8}
                style={[styles.navBtn, mode === 'years' && styles.navBtnHidden]}
                disabled={mode === 'years'}
              >
                <Ionicons name="chevron-forward" size={20} color="#1a1a2e" />
              </TouchableOpacity>
            </View>

            {mode === 'years' ? (
              <ScrollView
                ref={yearScrollRef}
                style={styles.yearList}
                showsVerticalScrollIndicator
              >
                {yearRange.map((y) => {
                  const isSelected = y === viewYear;
                  return (
                    <TouchableOpacity
                      key={y}
                      style={[styles.yearRow, isSelected && styles.yearRowSelected]}
                      onPress={() => {
                        setViewYear(y);
                        setMode('days');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.yearText, isSelected && styles.yearTextSelected]}>
                        {y}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <>
            <View style={styles.weekRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <Text key={i} style={styles.weekDay}>
                  {d}
                </Text>
              ))}
            </View>

            <View style={styles.gridWrap}>
              {cells.map((cell, idx) => {
                if (cell == null) {
                  return <View key={idx} style={styles.dayCell} />;
                }
                const iso = formatIso(viewYear, viewMonth, cell);
                const dt = new Date(viewYear, viewMonth, cell);
                const disabled =
                  (minDt && dt < stripTime(minDt)) || (maxDt && dt > stripTime(maxDt));
                const isSelected = selectedIso === iso;
                const isToday =
                  dt.getFullYear() === today.getFullYear() &&
                  dt.getMonth() === today.getMonth() &&
                  dt.getDate() === today.getDate();
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.dayCell,
                      isSelected && styles.dayCellSelected,
                      !isSelected && isToday && styles.dayCellToday,
                      disabled && styles.dayCellDisabled,
                    ]}
                    onPress={() => !disabled && pick(cell)}
                    disabled={!!disabled}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isSelected && styles.dayTextSelected,
                        disabled && styles.dayTextDisabled,
                      ]}
                    >
                      {cell}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
              </>
            )}

            <View style={styles.sheetFooter}>
              <TouchableOpacity onPress={() => setOpen(false)} style={styles.footerBtn}>
                <Text style={styles.footerBtnTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const t = new Date();
                  const iso = formatIso(t.getFullYear(), t.getMonth(), t.getDate());
                  onChange(iso);
                  setOpen(false);
                }}
                style={styles.footerBtn}
              >
                <Text style={[styles.footerBtnTxt, { color: Colors.primary, fontWeight: '700' }]}>
                  Today
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function parseIso(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}
function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function formatIso(y: number, m0: number, day: number): string {
  const m = String(m0 + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
// 6 rows × 7 cols, padded with nulls so columns align under S/M/T/W/T/F/S.
function buildMonthGrid(y: number, m0: number): (number | null)[] {
  const first = new Date(y, m0, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(y, m0 + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const webInputStyle = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100%',
  height: '100%',
  minHeight: 44,
  opacity: 0.01,
  cursor: 'pointer',
  touchAction: 'manipulation',
  zIndex: 1,
};

const styles = StyleSheet.create({
  wrapper: { width: '100%' },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: 'relative',
    minHeight: 48,
  },
  icon: { marginRight: 10 },
  displayText: {
    flex: 1,
    fontSize: 15,
    color: '#1a1a2e',
    fontWeight: '500',
  },
  placeholder: {
    color: '#9ca3af',
    fontWeight: '400',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 8, 30, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  titleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  navBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  navBtnHidden: {
    opacity: 0,
  },
  yearList: {
    maxHeight: 280,
    marginVertical: 4,
  },
  yearRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderRadius: 10,
    marginVertical: 2,
  },
  yearRowSelected: {
    backgroundColor: Colors.primary,
  },
  yearText: {
    fontSize: 16,
    color: '#1a1a2e',
    fontWeight: '500',
  },
  yearTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 2,
    paddingTop: 4,
    paddingBottom: 6,
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  dayCellSelected: {
    backgroundColor: Colors.primary,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  dayCellDisabled: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 14,
    color: '#1a1a2e',
    fontWeight: '500',
  },
  dayTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  dayTextDisabled: {
    color: '#c4b5d4',
  },
  sheetFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 6,
    paddingHorizontal: 4,
  },
  footerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  footerBtnTxt: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
});
