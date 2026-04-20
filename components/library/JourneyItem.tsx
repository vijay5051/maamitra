import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface JourneyEvent {
  emoji: string;
  title: string;
  date: Date;
  isPast: boolean;
}

interface JourneyItemProps {
  event: JourneyEvent;
  isLast: boolean;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function JourneyItem({ event, isLast }: JourneyItemProps) {
  return (
    <View style={styles.wrapper}>
      {/* Left: timeline */}
      <View style={styles.timelineCol}>
        {event.isPast ? (
          <View style={styles.circlePast}>
            <Text style={styles.circleEmoji}>{event.emoji}</Text>
          </View>
        ) : (
          <LinearGradient
            colors={['#7C3AED', '#7C3AED']}
            style={styles.circleGradient}
          >
            <Text style={styles.circleEmoji}>{event.emoji}</Text>
          </LinearGradient>
        )}
        {!isLast && <View style={styles.connectorLine} />}
      </View>

      {/* Right: content */}
      <View style={styles.contentCol}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{event.title}</Text>
          {event.isPast ? (
            <Text style={styles.checkMark}>✓</Text>
          ) : (
            <Text style={styles.calIcon}>📅</Text>
          )}
        </View>
        <Text style={[styles.date, event.isPast ? styles.datePast : styles.dateUpcoming]}>
          {formatDate(event.date)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 60,
  },
  timelineCol: {
    width: 48,
    alignItems: 'center',
    marginRight: 14,
  },
  circlePast: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleEmoji: {
    fontSize: 22,
  },
  connectorLine: {
    width: 2,
    flex: 1,
    minHeight: 20,
    backgroundColor: '#e5e7eb',
    marginTop: 4,
    marginBottom: 4,
    borderRadius: 1,
  },
  contentCol: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
    flex: 1,
  },
  checkMark: {
    fontSize: 16,
    color: '#22c55e',
    fontWeight: '700',
  },
  calIcon: {
    fontSize: 16,
  },
  date: {
    fontSize: 13,
    marginTop: 3,
    fontWeight: '500',
  },
  datePast: {
    color: '#9ca3af',
  },
  dateUpcoming: {
    color: '#7C3AED',
  },
});
