import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TagPill from '../ui/TagPill';
import { VaccineWithDate } from '../../hooks/useVaccineSchedule';
import { useProfileStore } from '../../store/useProfileStore';

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
  const isDone = vaccine.status === 'done';
  const isOverdue = vaccine.status === 'overdue';
  const isDueSoon = vaccine.status === 'due-soon';
  const statusColor = getStatusColor(vaccine.status);

  const handleToggle = () => {
    if (isDone) {
      unmarkVaccineDone(vaccine.id);
    } else {
      markVaccineDone(vaccine.id, new Date().toISOString());
    }
  };

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

        {/* Mark as done checkbox */}
        <TouchableOpacity style={styles.checkRow} onPress={handleToggle} activeOpacity={0.7}>
          <View style={[styles.checkbox, isDone && styles.checkboxDone]}>
            {isDone && <Ionicons name="checkmark" size={13} color="#fff" />}
          </View>
          <Text style={[styles.checkLabel, isDone && styles.checkLabelDone]}>
            {isDone ? 'Vaccine given — tap to undo' : 'Mark as given'}
          </Text>
        </TouchableOpacity>
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
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
    boxShadow: '0px 2px 6px rgba(236, 72, 153, 0.07)',
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
});
