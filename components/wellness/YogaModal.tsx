import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import GradientButton from '../ui/GradientButton';
import { YogaSession, YogaPose } from '../../data/yogaSessions';
import { Colors } from '../../constants/theme';

interface YogaModalProps {
  session: YogaSession | null;
  visible: boolean;
  onClose: () => void;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${pad(m)}:${pad(s)}`;
}

export default function YogaModal({ session, visible, onClose }: YogaModalProps) {
  const [poseIndex, setPoseIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [completed, setCompleted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const poses = session?.poses ?? [];
  const currentPose = poses[poseIndex];
  const totalDuration = currentPose?.durationSeconds ?? 0;

  // Reset when session/pose changes
  useEffect(() => {
    if (currentPose) {
      setTimeLeft(currentPose.durationSeconds);
      setIsPlaying(false);
      clearInterval(timerRef.current!);
    }
  }, [poseIndex, session]);

  // Reset everything on modal open/close
  useEffect(() => {
    if (visible && session) {
      setPoseIndex(0);
      setTimeLeft(session.poses[0]?.durationSeconds ?? 0);
      setIsPlaying(false);
      setCompleted(false);
    }
    if (!visible) {
      clearInterval(timerRef.current!);
      setIsPlaying(false);
    }
  }, [visible, session]);

  // Animate progress bar
  useEffect(() => {
    if (totalDuration > 0) {
      const progress = 1 - timeLeft / totalDuration;
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 500,
        useNativeDriver: false,
      }).start();
    }
  }, [timeLeft, totalDuration, progressAnim]);

  // Timer tick
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setTimeout(() => {
              setPoseIndex((pi) => {
                const nextIndex = pi + 1;
                if (nextIndex >= poses.length) {
                  setIsPlaying(false);
                  setCompleted(true);
                  return pi;
                }
                setTimeLeft(poses[nextIndex].durationSeconds);
                return nextIndex;
              });
            }, 0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current!);
    }
    return () => clearInterval(timerRef.current!);
  }, [isPlaying, poses]);

  const handlePrev = useCallback(() => {
    if (poseIndex > 0) setPoseIndex((pi) => pi - 1);
  }, [poseIndex]);

  const handleNext = useCallback(() => {
    if (poseIndex < poses.length - 1) {
      setPoseIndex((pi) => pi + 1);
    } else {
      setCompleted(true);
      setIsPlaying(false);
    }
  }, [poseIndex, poses.length]);

  const handlePlayPause = () => setIsPlaying((p) => !p);

  const handlePracticeAgain = () => {
    setPoseIndex(0);
    setTimeLeft(session?.poses[0]?.durationSeconds ?? 0);
    setIsPlaying(false);
    setCompleted(false);
  };

  if (!session) return null;

  // ── Completion screen ─────────────────────────────────────────────────────
  if (completed) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <LinearGradient colors={['#1e1b4b', '#4c1d95']} style={styles.flex}>
          <SafeAreaView style={[styles.flex, styles.completedContainer]}>
            <Text style={styles.completedEmoji}>🎉</Text>
            <Text style={styles.completedTitle}>Session Complete!</Text>
            <Text style={styles.completedMsg}>
              Amazing work! You showed up for yourself today — that's what matters most. 💜
            </Text>
            <View style={styles.completedButtons}>
              <GradientButton
                title="Practice Again"
                onPress={handlePracticeAgain}
                outline
                style={styles.completedBtn}
              />
              <GradientButton
                title="Done 💕"
                onPress={onClose}
                style={styles.completedBtn}
              />
            </View>
          </SafeAreaView>
        </LinearGradient>
      </Modal>
    );
  }

  // ── Main session screen ───────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <LinearGradient colors={['#1e1b4b', '#4c1d95']} style={styles.flex}>
        <SafeAreaView style={styles.flex}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.sessionName} numberOfLines={1}>{session.name}</Text>
              <Text style={styles.stepLabel}>Step {poseIndex + 1} of {poses.length}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* ── Step progress dots ── */}
          <View style={styles.stepDots}>
            {poses.map((_: YogaPose, i: number) => (
              <TouchableOpacity key={i} onPress={() => setPoseIndex(i)} style={styles.dotWrap}>
                <View style={[styles.dot, i === poseIndex && styles.dotActive, i < poseIndex && styles.dotDone]} />
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Thin progress bar ── */}
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>

          {/* ── Pose card (scrollable in case of long text) ── */}
          <ScrollView
            style={styles.poseScroll}
            contentContainerStyle={styles.poseScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Pose header row: emoji + name */}
            <View style={styles.poseHeader}>
              <Text style={styles.poseEmoji}>{currentPose?.emoji}</Text>
              <Text style={styles.poseName}>{currentPose?.name}</Text>
            </View>

            {/* Instructions card */}
            <View style={styles.poseCard}>
              <Text style={styles.poseInstruction}>{currentPose?.instruction}</Text>
              <View style={styles.breathingRow}>
                <Text style={styles.breathLeaf}>🌿</Text>
                <Text style={styles.breathingText}>{currentPose?.breathCue}</Text>
              </View>
            </View>
          </ScrollView>

          {/* ── Timer ── */}
          <View style={styles.timerRow}>
            <Text style={styles.timer}>{formatTime(timeLeft)}</Text>
          </View>

          {/* ── Controls ── */}
          <View style={styles.controls}>
            <TouchableOpacity
              onPress={handlePrev}
              disabled={poseIndex === 0}
              style={[styles.controlBtn, poseIndex === 0 && styles.controlBtnDisabled]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="play-back" size={26} color="#ffffff" />
            </TouchableOpacity>

            <TouchableOpacity onPress={handlePlayPause} style={styles.playBtn}>
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={34}
                color="#1e1b4b"
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleNext}
              style={styles.controlBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="play-forward" size={26} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* Bottom spacer */}
          <View style={styles.bottomSpacer} />

        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerLeft: { flex: 1, marginRight: 12 },
  sessionName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  stepLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Step dots
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  dotWrap: { padding: 4 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 20,
    borderRadius: 4,
  },
  dotDone: {
    backgroundColor: 'rgba(28, 16, 51, 0.2)',
  },

  // Progress bar
  progressTrack: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 20,
    borderRadius: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: 2,
    backgroundColor: Colors.primary,
    borderRadius: 1,
  },

  // Pose scroll area
  poseScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  poseScrollContent: {
    gap: 12,
    paddingBottom: 8,
  },

  // Pose header: emoji + name inline
  poseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  poseEmoji: {
    fontSize: 40,
  },
  poseName: {
    flex: 1,
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },

  // Instruction card
  poseCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  poseInstruction: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    lineHeight: 22,
  },
  breathingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    paddingTop: 10,
  },
  breathLeaf: { fontSize: 14, marginTop: 1 },
  breathingText: {
    flex: 1,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 20,
  },

  // Timer
  timerRow: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  timer: {
    color: Colors.primary,
    fontSize: 52,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 4,
  },

  // Controls
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 36,
    paddingBottom: 8,
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnDisabled: {
    opacity: 0.3,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 4px 16px rgba(28, 16, 51, 0.2)',
  },

  bottomSpacer: { height: 16 },

  // Completion screen
  completedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  completedEmoji: { fontSize: 72 },
  completedTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  completedMsg: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  completedButtons: {
    width: '100%',
    gap: 12,
    marginTop: 16,
  },
  completedBtn: { width: '100%' },
});
