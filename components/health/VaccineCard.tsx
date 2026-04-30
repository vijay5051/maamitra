import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DatePickerField from '../ui/DatePickerField';
import { VaccineWithDate } from '../../hooks/useVaccineSchedule';
import { useProfileStore } from '../../store/useProfileStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useActiveKid } from '../../hooks/useActiveKid';
import { syncCompletedVaccines } from '../../services/firebase';
import { Colors, Fonts } from '../../constants/theme';
import { successBump } from '../../lib/haptics';

interface VaccineCardProps {
  vaccine: VaccineWithDate;
}

function statusColor(status: VaccineWithDate['status']): string {
  if (status === 'done') return '#22c55e';
  if (status === 'overdue') return '#ef4444';
  if (status === 'due-soon') return '#f97316';
  return Colors.textMuted;
}

export default function VaccineCard({ vaccine }: VaccineCardProps) {
  const { markVaccineDone, unmarkVaccineDone } = useProfileStore();
  const { activeKid } = useActiveKid();
  const kidId = activeKid?.id ?? '';
  const isDone = vaccine.status === 'done';
  const isOverdue = vaccine.status === 'overdue';
  const isDueSoon = vaccine.status === 'due-soon';
  const canMark = isDone || isOverdue || isDueSoon;
  const color = statusColor(vaccine.status);

  const [showDateInput, setShowDateInput] = useState(false);
  const [pendingDate, setPendingDate] = useState('');
  const [dateError, setDateError] = useState('');

  const syncToCloud = () => {
    const uid = useAuthStore.getState().user?.uid;
    if (!uid) return;
    const { completedVaccines } = useProfileStore.getState();
    syncCompletedVaccines(uid, completedVaccines).catch(console.error);
  };

  const handleToggle = () => {
    if (!canMark) return;
    if (isDone) {
      unmarkVaccineDone(vaccine.id, kidId);
      syncToCloud();
      return;
    }
    setShowDateInput(true);
    setPendingDate(new Date().toISOString().split('T')[0]);
  };

  const handleConfirmDate = () => {
    if (!pendingDate || isDone) return;
    const chosen = new Date(pendingDate + 'T00:00:00');
    if (chosen > new Date()) {
      setDateError('Pick today or a past date — future dates are not allowed.');
      return;
    }
    setDateError('');
    markVaccineDone(vaccine.id, kidId, chosen.toISOString());
    successBump();
    setShowDateInput(false);
    syncToCloud();
  };

  const today = new Date().toISOString().split('T')[0];

  const doneDateStr = vaccine.doneDate
    ? new Date(vaccine.doneDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  const rightLabel = isDone
    ? doneDateStr ? `Given · ${doneDateStr}` : 'Given'
    : isOverdue
      ? 'Overdue'
      : isDueSoon
        ? 'Due soon'
        : vaccine.formattedDate;

  return (
    <View style={[styles.row, isDone && styles.rowDone]}>
      <TouchableOpacity
        onPress={handleToggle}
        activeOpacity={canMark ? 0.6 : 1}
        disabled={!canMark}
        style={styles.main}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isDone, disabled: !canMark }}
        accessibilityLabel={`${vaccine.name}, ${rightLabel}`}
      >
        <View style={[
          styles.checkbox,
          isDone && styles.checkboxDone,
          !canMark && styles.checkboxDisabled,
        ]}>
          {isDone && <Ionicons name="checkmark" size={13} color="#fff" />}
        </View>

        <View style={styles.textCol}>
          <Text style={[styles.name, isDone && styles.nameDone]} numberOfLines={1}>
            {vaccine.name}
          </Text>
          {!!vaccine.description && !isDone && (
            <Text style={styles.desc} numberOfLines={1}>{vaccine.description}</Text>
          )}
        </View>

        <Text style={[styles.right, { color }]} numberOfLines={1}>
          {rightLabel}
        </Text>
      </TouchableOpacity>

      {showDateInput && (
        <View style={styles.dateWrap}>
          <Text style={styles.dateLabel}>Date given</Text>
          <DatePickerField
            value={pendingDate}
            onChange={(d) => { setPendingDate(d); setDateError(''); }}
            maxDate={today}
            placeholder="Select date given"
          />
          {!!dateError && <Text style={styles.dateError}>⚠️ {dateError}</Text>}
          <View style={styles.dateBtns}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setShowDateInput(false); setPendingDate(''); setDateError(''); }}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, !pendingDate && styles.confirmBtnDisabled]}
              onPress={handleConfirmDate}
              disabled={!pendingDate}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  rowDone: {
    backgroundColor: '#FAFDFB',
    borderColor: '#E4F4EA',
  },
  main: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxDone: {
    borderColor: '#22c55e',
    backgroundColor: '#22c55e',
  },
  checkboxDisabled: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13.5,
    color: Colors.textDark,
  },
  nameDone: {
    color: Colors.textLight,
  },
  desc: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11.5,
    color: Colors.textMuted,
    marginTop: 1,
  },
  right: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    maxWidth: 110,
    textAlign: 'right',
  },
  dateWrap: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
    gap: 6,
  },
  dateLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11.5,
    color: Colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  dateError: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11.5,
    color: '#ef4444',
  },
  dateBtns: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: Colors.textLight,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#22c55e',
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#A7F3C3',
  },
  confirmBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
    color: '#fff',
  },
});
