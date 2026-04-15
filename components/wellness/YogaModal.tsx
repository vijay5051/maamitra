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
            // Advance to next pose or complete
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
    if (poseIndex > 0) {
      setPoseIndex((pi) => pi - 1);
    }
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

  const overallProgress = poses.length > 0 ? (poseIndex + 1) / poses.length : 0;

  if (completed) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <LinearGradient
          colors={['#1e1b4b', '#4c1d95']}
          style={styles.flex}
        >
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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <LinearGradient colors={['#1e1b4b', '#4c1d95']} style={styles.flex}>
        <SafeAreaView style={styles.flex}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.sessionName}>{session.name}</Text>
            </View>
            <Text style={styles.stepLabel}>
              Step {poseIndex + 1} / {poses.length}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* Progress bar */}
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

          {/* Main content */}
          <View style={styles.poseContainer}>
            <Text style={styles.poseEmoji}>{currentPose?.emoji}</Text>

            <View style={styles.poseCard}>
              <Text style={styles.poseName}>{currentPose?.name}</Text>
              <Text style={styles.poseInstruction}>{currentPose?.instruction}</Text>
              <View style={styles.breathingRow}>
                <Text style={styles.breathingText}>🌿 {currentPose?.breathCue}</Text>
              </View>
            </View>

            {/* Timer */}
            <Text style={styles.timer}>{formatTime(timeLeft)}</Text>

            {/* Controls */}
            <View style={styles.controls}>
              <TouchableOpacity
                onPress={handlePrev}
                disabled={poseIndex === 0}
                style={[styles.controlBtn, poseIndex === 0 && styles.controlBtnDisabled]}
              >
                <Ionicons name="play-back" size={24} color="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity onPress={handlePlayPause} style={styles.playBtn}>
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={32}
                  color="#1e1b4b"
                />
              </TouchableOpacity>

              <TouchableOpacity onPress={handleNext} style={styles.controlBtn}>
                <Ionicons name="play-forward" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Step indicators */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stepsScroll}
          >
            {poses.map((pose: YogaPose, i: number) => (
              <TouchableOpacity
                key={pose.name}
                onPress={() => setPoseIndex(i)}
                style={[
                  styles.stepIndicator,
                  i === poseIndex && styles.stepIndicatorActive,
                ]}
              >
                <Text style={styles.stepEmoji}>{pose.emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  headerLeft: { flex: 1 },
  sessionName: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  stepLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
  closeBtn: {
    padding: 4,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    backgroundColor: '#ec4899',
    borderRadius: 2,
  },
  poseContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  poseEmoji: {
    fontSize: 100,
  },
  poseCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    gap: 10,
  },
  poseName: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  poseInstruction: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  breathingRow: {
    alignItems: 'center',
  },
  breathingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontStyle: 'italic',
  },
  timer: {
    color: '#ec4899',
    fontSize: 52,
    fontWeight: '700',
    letterSpacing: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
  },
  controlBtn: {
    opacity: 1,
  },
  controlBtnDisabled: {
    opacity: 0.35,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    boxShadow: '0px 4px 12px rgba(236, 72, 153, 0.30)',
  },
  stepsScroll: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  stepIndicator: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  stepIndicatorActive: {
    borderWidth: 2,
    borderColor: '#ec4899',
    backgroundColor: 'rgba(236,72,153,0.2)',
  },
  stepEmoji: {
    fontSize: 22,
  },
  // Completion screen
  completedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  completedEmoji: {
    fontSize: 80,
  },
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
  completedBtn: {
    width: '100%',
  },
});
