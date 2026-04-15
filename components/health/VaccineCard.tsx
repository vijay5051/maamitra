import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TagPill from '../ui/TagPill';
import { VaccineWithDate } from '../../hooks/useVaccineSchedule';

interface VaccineCardProps {
  vaccine: VaccineWithDate;
  isLast: boolean;
}

function getStatusColor(status: VaccineWithDate['status']): string {
  if (status === 'overdue') return '#ef4444';
  if (status === 'due-soon') return '#f97316';
  return '#8b5cf6';
}

function getDotColor(status: VaccineWithDate['status']): string {
  return getStatusColor(status);
}

export default function VaccineCard({ vaccine, isLast }: VaccineCardProps) {
  const statusColor = getStatusColor(vaccine.status);
  const isOverdue = vaccine.status === 'overdue';
  const isDueSoon = vaccine.status === 'due-soon';

  return (
    <View style={styles.wrapper}>
      {/* Timeline left column */}
      <View style={styles.timeline}>
        <View style={[styles.dot, { backgroundColor: getDotColor(vaccine.status) }]} />
        {!isLast && <View style={styles.line} />}
      </View>

      {/* Card */}
      <View style={[styles.card, { borderLeftColor: statusColor }]}>
        <View style={styles.headerRow}>
          <Text style={styles.vaccineName}>{vaccine.name}</Text>
          {(isOverdue || isDueSoon) && (
            <View style={[styles.badge, { backgroundColor: `${statusColor}20` }]}>
              <Text style={[styles.badgeText, { color: statusColor }]}>
                {isOverdue ? 'Overdue ⚠️' : 'Due Soon 🔔'}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.description}>{vaccine.description}</Text>

        <View style={styles.footerRow}>
          <TagPill label={vaccine.ageLabel} color={statusColor} />
          <Text style={styles.date}>{vaccine.formattedDate}</Text>
        </View>
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
  },
  date: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
});
