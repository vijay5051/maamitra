import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MoodEntry } from '../../store/useWellnessStore';

interface MoodChartProps {
  history: MoodEntry[];
}

const MAX_BAR_HEIGHT = 60;
const MAX_SCORE = 5;
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function getMoodEmoji(score: number): string {
  if (score >= 5) return '😄';
  if (score >= 4) return '😊';
  if (score >= 3) return '😐';
  if (score >= 2) return '😔';
  return '😢';
}

export default function MoodChart({ history }: MoodChartProps) {
  // Build 7-day array (Mon to Sun of current week)
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  // Adjust so Monday = index 0
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + mondayOffset + i);
    return d;
  });

  const getEntry = (date: Date): MoodEntry | undefined => {
    return history.find((e) => {
      const ed = typeof e.date === 'string' ? new Date(e.date) : e.date;
      return (
        ed.getFullYear() === date.getFullYear() &&
        ed.getMonth() === date.getMonth() &&
        ed.getDate() === date.getDate()
      );
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.barsRow}>
        {days.map((date, index) => {
          const entry = getEntry(date);
          const score = entry?.score ?? 0;
          const barHeight = score > 0
            ? Math.max(8, (score / MAX_SCORE) * MAX_BAR_HEIGHT)
            : 8;
          const hasData = score > 0;
          const isToday =
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth();

          return (
            <View key={index} style={styles.barWrapper}>
              {/* Emoji above bar */}
              <Text style={styles.barEmoji}>
                {hasData ? getMoodEmoji(score) : ' '}
              </Text>

              {/* Bar */}
              <View style={[styles.barTrack, { height: MAX_BAR_HEIGHT }]}>
                {hasData ? (
                  <LinearGradient
                    colors={['#ec4899', '#8b5cf6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={[styles.bar, { height: barHeight }]}
                  />
                ) : (
                  <View style={[styles.barEmpty, { height: barHeight }]} />
                )}
              </View>

              {/* Day label */}
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                {DAY_LABELS[index]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  barEmoji: {
    fontSize: 14,
    height: 20,
    textAlign: 'center',
  },
  barTrack: {
    justifyContent: 'flex-end',
    width: 24,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  bar: {
    width: 24,
    borderRadius: 6,
  },
  barEmpty: {
    width: 24,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },
  dayLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '600',
    marginTop: 2,
  },
  dayLabelToday: {
    color: '#ec4899',
    fontWeight: '700',
  },
});
