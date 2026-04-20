import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GradientAvatar from '../ui/GradientAvatar';
import { Kid } from '../../store/useProfileStore';

interface ChildCardProps {
  kid: Kid;
  isActive: boolean;
  onPress: () => void;
}

function formatAge(dob: Date | string | null | undefined, stage: string): string {
  if (!dob) {
    if (stage === 'expecting') return 'Due soon 🤰';
    return '—';
  }
  const birth = typeof dob === 'string' ? new Date(dob) : dob;
  const now = new Date();
  const diffMs = now.getTime() - birth.getTime();
  if (diffMs < 0) {
    // Due date is in the future
    const weeksLeft = Math.round(Math.abs(diffMs) / (1000 * 60 * 60 * 24 * 7));
    return `Due in ~${weeksLeft} week${weeksLeft !== 1 ? 's' : ''} 🤰`;
  }
  const months = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));
  if (months < 1) {
    const weeks = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
    return `${weeks} week${weeks !== 1 ? 's' : ''} old`;
  }
  return `${months} month${months !== 1 ? 's' : ''} old`;
}

function formatDOB(dob: Date | string | null | undefined): string {
  if (!dob) return '—';
  const d = typeof dob === 'string' ? new Date(dob) : dob;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function genderIcon(gender?: string | null): string {
  if (gender === 'boy') return '♂️';
  if (gender === 'girl') return '♀️';
  return '🎁';
}

export default function ChildCard({ kid, isActive, onPress }: ChildCardProps) {
  const isExpecting = kid.isExpecting || kid.stage === 'pregnant';
  const avatarEmoji = isExpecting ? '🤰' : '🤱';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.card,
        isActive && styles.activeCard,
      ]}
    >
      {/* Active badge */}
      {isActive && (
        <View style={styles.activeBadge}>
          <View style={styles.activeDot} />
          <Text style={styles.activeBadgeText}>Active</Text>
        </View>
      )}

      <View style={styles.row}>
        <GradientAvatar emoji={avatarEmoji} size={52} style={styles.avatar} />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{kid.name || 'Baby'}</Text>
            <Text style={styles.genderIcon}>{genderIcon(kid.gender)}</Text>
          </View>
          <Text style={styles.ageLabel}>
            {formatAge(kid.dob, kid.stage ?? '')}
          </Text>
          <Text style={styles.dob}>{formatDOB(kid.dob)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    boxShadow: '0px 2px 8px rgba(28, 16, 51, 0.048)',
  },
  activeCard: {
    borderColor: '#7C3AED',
  },
  activeBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  activeBadgeText: {
    color: '#16a34a',
    fontSize: 11,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    marginRight: 14,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  genderIcon: {
    fontSize: 14,
  },
  ageLabel: {
    fontSize: 13,
    color: '#7C3AED',
    fontWeight: '500',
    marginTop: 3,
  },
  dob: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
});
