import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TagPill from '../ui/TagPill';
import { Illustration } from '../ui/Illustration';
import type { IllustrationName } from '../../lib/illustrations';
import { YogaSession, YogaPose } from '../../data/yogaSessions';
import { Fonts } from '../../constants/theme';
import { Colors } from '../../constants/theme';

interface YogaCardProps {
  session: YogaSession;
  onPress: () => void;
}

function poseToIllustration(name: string): IllustrationName | null {
  const n = (name || '').toLowerCase();
  if (n.includes('cat') && n.includes('cow')) return 'yogaCatCow';
  if (n.includes('child')) return 'yogaChildsPose';
  if (n.includes('seated forward') || n.includes('seated fold')) return 'yogaSeatedForward';
  if (n.includes('bridge')) return 'yogaBridge';
  if (n.includes('pelvic')) return 'yogaPelvicTilt';
  if (n.includes('supine') && n.includes('twist')) return 'yogaSupineTwist';
  if (n.includes('legs') && n.includes('wall')) return 'yogaLegsUpWall';
  if (n.includes('savasana') || n.includes('corpse')) return 'yogaSavasana';
  return null;
}

function illustrationForSession(session: YogaSession): IllustrationName | null {
  for (const pose of session.poses as YogaPose[]) {
    const match = poseToIllustration(pose.name);
    if (match) return match;
  }
  return null;
}

function iconForSession(session: YogaSession): keyof typeof Ionicons.glyphMap {
  const name = (session.name || '').toLowerCase();
  if (name.includes('morning') || name.includes('stretch')) return 'sunny-outline';
  if (name.includes('postpartum') || name.includes('core')) return 'body-outline';
  if (name.includes('baby') || name.includes('bonding')) return 'happy-outline';
  if (name.includes('stress') || name.includes('calm')) return 'flower-outline';
  if (name.includes('sleep')) return 'moon-outline';
  if (name.includes('dad') || name.includes('father') || name.includes('strength')) return 'barbell-outline';
  if (name.includes('reset') || name.includes('tired')) return 'leaf-outline';
  return 'leaf-outline';
}

export default function YogaCard({ session, onPress }: YogaCardProps) {
  const totalDuration = session.poses.reduce(
    (sum: number, p: import('../../data/yogaSessions').YogaPose) => sum + p.durationSeconds,
    0,
  );
  const minutes = Math.ceil(totalDuration / 60);
  const illustration = illustrationForSession(session);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.card}>
      <View style={styles.topRow}>
        {illustration ? (
          <View style={styles.illusBox}>
            <Illustration name={illustration} style={styles.illusImg} contentFit="contain" />
          </View>
        ) : (
          <View style={styles.iconBox}>
            <Ionicons name={iconForSession(session)} size={22} color={Colors.primary} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{session.name}</Text>
          <Text style={styles.level}>{session.level}</Text>
        </View>
      </View>

      <Text style={styles.description} numberOfLines={2}>
        {session.description}
      </Text>

      <View style={styles.tagsRow}>
        <TagPill label={`${minutes} min`} color={Colors.primary} />
        <TagPill label={`${session.poses.length} poses`} color={Colors.primary} />
      </View>

      <View style={styles.startBtn}>
        <Text style={styles.startText}>Start session</Text>
        <Ionicons name="arrow-forward" size={16} color="#ffffff" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    marginBottom: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#F0EDF5',
    padding: 16,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  illusBox: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#FFFCF7',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  illusImg: {
    width: 60,
    height: 60,
  },
  name: {
    fontFamily: Fonts.sansBold,
    color: '#1C1033',
    fontSize: 16,
    letterSpacing: -0.1,
  },
  level: {
    fontFamily: Fonts.sansRegular,
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 2,
  },
  description: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 19,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 2,
  },
  startText: {
    color: '#ffffff',
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    letterSpacing: 0.2,
  },
});
