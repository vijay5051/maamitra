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
import { Illustration } from '../ui/Illustration';
import { Confetti } from '../ui/Confetti';
import type { IllustrationName } from '../../lib/illustrations';
import { YogaSession, YogaPose } from '../../data/yogaSessions';
import { Colors } from '../../constants/theme';
import { successBump } from '../../lib/haptics';

// Pose name → brand illustration. Loose substring match; falls back to the
// pose's authored emoji if no match.
function poseToIllustration(name: string): IllustrationName | null {
  const n = name.toLowerCase();
  if (n.includes('cat') && n.includes('cow')) return 'yogaCatCow';
  if (n.includes("child")) return 'yogaChildsPose';
  if (n.includes('butterfly')) return 'yogaButterfly';
  if (n.includes('pelvic floor') && n.includes('breath')) return 'yogaPelvicFloorBreathing';
  if (n.includes('heel slide')) return 'yogaHeelSlides';
  if (n.includes('dead bug')) return 'yogaDeadBug';
  if (n.includes('clamshell')) return 'yogaClamshell';
  if (n.includes('seated twist') || (n.includes('gentle') && n.includes('twist'))) return 'yogaSeatedTwist';
  if ((n.includes('om') && n.includes('baby')) || (n.includes('seated om') && n.includes('baby'))) return 'yogaSeatedOmBaby';
  if (n.includes('bicycle') && n.includes('baby')) return 'yogaBabyBicycle';
  if ((n.includes('mama') || n.includes('bear')) && n.includes('plank')) return 'yogaMamaPlank';
  if (n.includes('baby cobra')) return 'yogaBabyCobra';
  if (n.includes('rolling hug')) return 'yogaRollingHug';
  if (n.includes('4-7-8') || (n.includes('478') && n.includes('breath'))) return 'yogaBreathing478';
  if (n.includes('standing forward fold')) return 'yogaStandingForwardFold';
  if (n.includes('wide-legged') || n.includes('wide legged')) return 'yogaWideLeggedFold';
  if (n.includes('seated meditation')) return 'yogaSeatedMeditation';
  if (n.includes('nidra')) return 'yogaNidra';
  if (n.includes('happy baby')) return 'yogaHappyBaby';
  if (n.includes('downward dog')) return 'yogaDownwardDog';
  if (n.includes('warrior ii') || n.includes('warrior 2')) return 'yogaWarrior2';
  if (n.includes('eagle arms')) return 'yogaEagleArms';
  if (n.includes('thread the needle')) return 'yogaThreadTheNeedle';
  if (n.includes('seated forward') || n.includes('seated fold')) return 'yogaSeatedForward';
  if (n.includes('bridge')) return 'yogaBridge';
  if (n.includes('pelvic tilt')) return 'yogaPelvicTilt';
  if (n.includes('supine') && n.includes('twist')) return 'yogaSupineTwist';
  if (n.includes('legs') && n.includes('wall')) return 'yogaLegsUpWall';
  if (n.includes('savasana') || n.includes('corpse')) return 'yogaSavasana';
  return null;
}

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
                  successBump();
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
      successBump();
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
        <LinearGradient colors={['#FFFCF7', '#F5F0FF']} style={styles.flex}>
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
          <Confetti show onDone={() => undefined} />
        </LinearGradient>
      </Modal>
    );
  }

  // ── Main session screen ───────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <LinearGradient colors={['#FFFCF7', '#F5F0FF']} style={styles.flex}>
        <SafeAreaView style={styles.flex}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.sessionName} numberOfLines={1}>{session.name}</Text>
              <Text style={styles.stepLabel}>Step {poseIndex + 1} of {poses.length}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color="#1C1033" />
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
            <View style={styles.poseHeader}>
              {(() => {
                const illusName = currentPose ? poseToIllustration(currentPose.name) : null;
                if (illusName) {
                  // Key by pose index so expo-image fully unmounts +
                  // remounts when we advance — older builds were sticking
                  // on the first pose's illustration even though the
                  // name prop updated.
                  return (
                    <Illustration
                      key={`pose-illus-${poseIndex}`}
                      name={illusName}
                      style={styles.poseIllus}
                      contentFit="contain"
                    />
                  );
                }
                return <Text style={styles.poseEmoji}>{currentPose?.emoji}</Text>;
              })()}
              <Text style={styles.poseName}>{currentPose?.name}</Text>
            </View>

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
              <Ionicons name="play-back" size={26} color={Colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity onPress={handlePlayPause} style={styles.playBtn}>
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={34}
                color="#ffffff"
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleNext}
              style={styles.controlBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="play-forward" size={26} color={Colors.primary} />
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
    color: '#1C1033',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  stepLabel: {
    color: 'rgba(28,16,51,0.55)',
    fontSize: 12,
    fontWeight: '500',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(28,16,51,0.06)',
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
    backgroundColor: 'rgba(28,16,51,0.14)',
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 20,
    borderRadius: 4,
  },
  dotDone: {
    backgroundColor: 'rgba(109, 26, 122, 0.45)',
  },

  // Progress bar
  progressTrack: {
    height: 2,
    backgroundColor: 'rgba(28,16,51,0.10)',
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

  // Pose header: hero illustration centered, name below
  poseHeader: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    marginTop: 4,
  },
  poseEmoji: {
    fontSize: 96,
    textAlign: 'center',
  },
  poseIllus: { width: 220, height: 220 },
  poseName: {
    color: '#1C1033',
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 26,
    letterSpacing: -0.2,
    textAlign: 'center',
    paddingHorizontal: 16,
  },

  // Instruction card
  poseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: '#F0EDF5',
    boxShadow: '0px 2px 12px rgba(28, 16, 51, 0.04)',
  },
  poseInstruction: {
    color: '#3F3553',
    fontSize: 14,
    lineHeight: 22,
  },
  breathingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(28,16,51,0.08)',
    paddingTop: 10,
  },
  breathLeaf: { fontSize: 14, marginTop: 1 },
  breathingText: {
    flex: 1,
    color: '#6b7280',
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
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#F0EDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnDisabled: {
    opacity: 0.35,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 6px 20px rgba(109, 26, 122, 0.28)',
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
    color: '#1C1033',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  completedMsg: {
    color: '#5b5470',
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
