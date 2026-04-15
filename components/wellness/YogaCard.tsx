import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import TagPill from '../ui/TagPill';
import { YogaSession } from '../../data/yogaSessions';

interface YogaCardProps {
  session: YogaSession;
  onPress: () => void;
}

export default function YogaCard({ session, onPress }: YogaCardProps) {
  const totalDuration = session.poses.reduce((sum: number, p: import('../../data/yogaSessions').YogaPose) => sum + p.durationSeconds, 0);
  const minutes = Math.ceil(totalDuration / 60);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={styles.card}>
      {/* Gradient strip */}
      <LinearGradient
        colors={['#1e1b4b', '#4c1d95']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.strip}
      >
        <Text style={styles.stripEmoji}>{session.emoji}</Text>
        <View style={styles.stripText}>
          <Text style={styles.stripName}>{session.name}</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>{session.level}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* White body */}
      <View style={styles.body}>
        <Text style={styles.description} numberOfLines={2}>
          {session.description}
        </Text>
        <View style={styles.tagsRow}>
          <TagPill label={`${minutes} min`} color="#8b5cf6" />
          <TagPill label={`${session.poses.length} poses`} color="#ec4899" />
        </View>
        <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.startBtn}>
          <LinearGradient
            colors={['#ec4899', '#8b5cf6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.startGradient}
          >
            <Text style={styles.startText}>Start Session →</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#4c1d95',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
    boxShadow: '0px 4px 12px rgba(76, 29, 149, 0.15)',
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 16,
  },
  stripEmoji: {
    fontSize: 48,
  },
  stripText: {
    flex: 1,
    gap: 8,
  },
  stripName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  levelBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  levelText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  body: {
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 12,
  },
  description: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 20,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  startBtn: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  startGradient: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 999,
  },
  startText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});
