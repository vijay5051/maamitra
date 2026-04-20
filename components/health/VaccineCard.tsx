import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TagPill from '../ui/TagPill';
import DatePickerField from '../ui/DatePickerField';
import { VaccineWithDate } from '../../hooks/useVaccineSchedule';
import { useProfileStore } from '../../store/useProfileStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useActiveKid } from '../../hooks/useActiveKid';
import { syncCompletedVaccines } from '../../services/firebase';

interface VaccineCardProps {
  vaccine: VaccineWithDate;
  isLast: boolean;
}

function getStatusColor(status: VaccineWithDate['status']): string {
  if (status === 'done') return '#22c55e';
  if (status === 'overdue') return '#ef4444';
  if (status === 'due-soon') return '#f97316';
  return '#8b5cf6';
}

export default function VaccineCard({ vaccine, isLast }: VaccineCardProps) {
  const { markVaccineDone, unmarkVaccineDone } = useProfileStore();
  const { activeKid } = useActiveKid();
  const kidId = activeKid?.id ?? '';
  const isDone = vaccine.status === 'done';
  const isOverdue = vaccine.status === 'overdue';
  const isDueSoon = vaccine.status === 'due-soon';
  const statusColor = getStatusColor(vaccine.status);

  // Only allow marking done if already done (to undo), or if overdue/due-soon
  const canMark = isDone || isOverdue || isDueSoon;

  const [showDateInput, setShowDateInput] = useState(false);
  const [pendingDate, setPendingDate] = useState('');
  const [dateError, setDateError] = useState('');

  const handleToggle = () => {
    if (!canMark) return;
    if (isDone) {
      unmarkVaccineDone(vaccine.id, kidId);
      // Sync to Firestore
      const uid = useAuthStore.getState().user?.uid;
      if (uid) {
        const { completedVaccines } = useProfileStore.getState();
        syncCompletedVaccines(uid, completedVaccines).catch(console.error);
      }
      return;
    }
    // Show date picker
    setShowDateInput(true);
    setPendingDate(new Date().toISOString().split('T')[0]);
  };

  const handleConfirmDate = () => {
    if (!pendingDate) return;
    if (isDone) return;
    const chosen = new Date(pendingDate + 'T00:00:00');
    if (chosen > new Date()) {
      setDateError('Please select today or a past date — vaccines cannot be marked for future dates.');
      return;
    }
    setDateError('');
    markVaccineDone(vaccine.id, kidId, chosen.toISOString());
    setShowDateInput(false);
    const uid = useAuthStore.getState().user?.uid;
    if (uid) {
      const { completedVaccines } = useProfileStore.getState();
      syncCompletedVaccines(uid, completedVaccines).catch(console.error);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  const doneDateStr = vaccine.doneDate
    ? new Date(vaccine.doneDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  return (
    <View style={styles.wrapper}>
      {/* Timeline left column */}
      <View style={styles.timeline}>
        <View style={[styles.dot, { backgroundColor: statusColor }]} />
        {!isLast && <View style={styles.line} />}
      </View>

      {/* Card */}
      <View style={[styles.card, { borderLeftColor: statusColor }]}>
        <View style={styles.headerRow}>
          <Text style={styles.vaccineName}>{vaccine.name}</Text>
          <View style={styles.rightRow}>
            {isDone ? (
              <View style={[styles.badge, { backgroundColor: '#dcfce7' }]}>
                <Text style={[styles.badgeText, { color: '#16a34a' }]}>Done ✓</Text>
              </View>
            ) : isOverdue ? (
              <View style={[styles.badge, { backgroundColor: `${statusColor}20` }]}>
                <Text style={[styles.badgeText, { color: statusColor }]}>Overdue ⚠️</Text>
              </View>
            ) : isDueSoon ? (
              <View style={[styles.badge, { backgroundColor: `${statusColor}20` }]}>
                <Text style={[styles.badgeText, { color: statusColor }]}>Due Soon 🔔</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Text style={styles.description}>{vaccine.description}</Text>

        <View style={styles.footerRow}>
          <TagPill label={vaccine.ageLabel} color={statusColor} />
          <Text style={styles.date}>
            {isDone && doneDateStr ? `Given: ${doneDateStr}` : vaccine.formattedDate}
          </Text>
        </View>

        {/* Mark as done */}
        {showDateInput ? (
          <View style={styles.dateInputWrap}>
            <Text style={styles.dateInputLabel}>When was this vaccine given?</Text>
            <DatePickerField
              value={pendingDate}
              onChange={(d) => { setPendingDate(d); setDateError(''); }}
              maxDate={today}
              placeholder="Select date given"
            />
            {!!dateError && (
              <Text style={{ fontSize: 12, color: '#ef4444', marginTop: 4, fontWeight: '500' }}>
                ⚠️ {dateError}
              </Text>
            )}
            <View style={styles.dateInputBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setShowDateInput(false); setPendingDate(''); }}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, !pendingDate && styles.confirmBtnDisabled]}
                onPress={handleConfirmDate}
                disabled={!pendingDate}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmBtnText}>Confirm ✓</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.checkRow, !canMark && styles.checkRowDisabled]}
            onPress={handleToggle}
            activeOpacity={canMark ? 0.7 : 1}
            disabled={!canMark}
          >
            <View style={[styles.checkbox, isDone && styles.checkboxDone, !canMark && styles.checkboxDisabled]}>
              {isDone && <Ionicons name="checkmark" size={13} color="#fff" />}
            </View>
            <Text style={[styles.checkLabel, isDone && styles.checkLabelDone, !canMark && styles.checkLabelDisabled]}>
              {isDone ? 'Vaccine given — tap to undo' : canMark ? 'Mark as given' : 'Not yet due'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  timeline: {
    width: 24,
    alignItems: 'center',
    paddingTop: 14,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    zIndex: 1,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: '#e5e7eb',
    marginTop: 4,
    marginBottom: -4,
  },
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginLeft: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
    boxShadow: '0px 2px 6px rgba(28, 16, 51, 0.042)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  vaccineName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
    flex: 1,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  description: {
    fontSize: 13,
    color: '#9ca3af',
    lineHeight: 18,
    marginBottom: 10,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  date: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxDone: {
    borderColor: '#22c55e',
    backgroundColor: '#22c55e',
  },
  checkLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  checkLabelDone: {
    color: '#16a34a',
    fontWeight: '600',
  },
  checkRowDisabled: {
    opacity: 0.5,
  },
  checkboxDisabled: {
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  checkLabelDisabled: {
    color: '#9ca3af',
    fontWeight: '400',
  },
  dateInputWrap: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 8,
  },
  dateInputLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 4,
  },
  dateInputBtns: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#22c55e',
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#d1fae5',
  },
  confirmBtnText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '700',
  },
});
