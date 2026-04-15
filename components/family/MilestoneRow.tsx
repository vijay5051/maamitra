import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TagPill from '../ui/TagPill';

export interface Milestone {
  id: string;
  ageMonths: number;
  ageLabel: string;
  emoji: string;
  title: string;
  description: string;
  category: string;
}

interface MilestoneRowProps {
  milestone: Milestone;
  isReached: boolean;
}

export default function MilestoneRow({ milestone, isReached }: MilestoneRowProps) {
  return (
    <View style={styles.row}>
      {/* Emoji circle */}
      <View style={[styles.emojiCircle, isReached ? styles.emojiCircleReached : styles.emojiCircleUpcoming]}>
        <Text style={styles.emoji}>{milestone.emoji}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, isReached && styles.titleReached]}>
            {milestone.title}
          </Text>
          <TagPill label={milestone.ageLabel} color={isReached ? '#22c55e' : '#ec4899'} />
        </View>
        <Text style={styles.description}>{milestone.description}</Text>
        {!isReached && (
          <Text style={styles.upcomingLabel}>upcoming</Text>
        )}
      </View>

      {/* Right: checkmark or nothing */}
      <View style={styles.right}>
        {isReached ? (
          <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    gap: 12,
  },
  emojiCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  emojiCircleReached: {
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  emojiCircleUpcoming: {
    backgroundColor: 'rgba(236,72,153,0.1)',
  },
  emoji: {
    fontSize: 20,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a2e',
    flexShrink: 1,
  },
  titleReached: {
    color: '#16a34a',
  },
  description: {
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 17,
  },
  upcomingLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 3,
    fontStyle: 'italic',
  },
  right: {
    width: 28,
    alignItems: 'center',
    paddingTop: 8,
  },
});
