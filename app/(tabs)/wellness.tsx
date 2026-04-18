import React, { useState, useCallback, useMemo } from 'react';
import {
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import Svg, {
  Path,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Circle,
} from 'react-native-svg';
import { useWellnessStore, MOOD_DATA, MOOD_RESPONSES } from '../../store/useWellnessStore';
import { useProfileStore } from '../../store/useProfileStore';
import { useAuthStore } from '../../store/useAuthStore';
import { syncWellnessData } from '../../services/firebase';
import Card from '../../components/ui/Card';
import GradientButton from '../../components/ui/GradientButton';
import { YOGA_SESSIONS, YogaSession } from '../../data/yogaSessions';
import YogaModalComponent from '../../components/wellness/YogaModal';
import ContextualAskChip from '../../components/ui/ContextualAskChip';
import { Fonts } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Mood tints ────────────────────────────────────────────────────────────────

const MOOD_TINTS: Record<number, string> = {
  5: 'rgba(52,211,153,0.08)',   // Great — sage
  4: 'rgba(96,165,250,0.08)',   // Good  — sky
  3: 'rgba(245,158,11,0.08)',   // Okay  — gold
  2: 'rgba(124,58,237,0.08)',   // Low   — plum
  1: 'rgba(232,72,122,0.08)',   // Tough — rose
};

// ─── MoodEmojiItem ─────────────────────────────────────────────────────────────

function MoodEmojiItem({
  item,
  isSelected,
  onPress,
}: {
  item: { score: 1 | 2 | 3 | 4 | 5; emoji: string; label: string };
  isSelected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(isSelected ? 1.3 : 0.85);

  const handlePress = useCallback(() => {
    scale.value = withSpring(1.3, { damping: 10, stiffness: 200 });
    onPress();
  }, [onPress, scale]);

  // Keep scale in sync when isSelected changes from outside
  React.useEffect(() => {
    scale.value = withSpring(isSelected ? 1.3 : 0.85, { damping: 12, stiffness: 180 });
  }, [isSelected, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: isSelected ? 1 : 0.5,
  }));

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      style={moodStyles.moodBtn}
    >
      <Animated.View style={[moodStyles.emojiContainer, animStyle]}>
        <Text style={moodStyles.moodEmoji}>{item.emoji}</Text>
      </Animated.View>
      <Text style={[moodStyles.moodLabel, isSelected && moodStyles.moodLabelSelected]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── MoodSelector ─────────────────────────────────────────────────────────────

function MoodSelector({
  selectedScore,
  onSelect,
}: {
  selectedScore: number | null;
  onSelect: (score: 1 | 2 | 3 | 4 | 5) => void;
}) {
  return (
    <View style={moodStyles.row}>
      {MOOD_DATA.map((m) => (
        <MoodEmojiItem
          key={m.score}
          item={m}
          isSelected={selectedScore === m.score}
          onPress={() => onSelect(m.score)}
        />
      ))}
    </View>
  );
}

const moodStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  moodBtn: {
    alignItems: 'center',
    gap: 6,
  },
  emojiContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodEmoji: {
    fontSize: 34,
    lineHeight: 42,
  },
  moodLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: '#9CA3AF',
  },
  moodLabelSelected: {
    color: '#E8487A',
    fontFamily: Fonts.sansBold,
  },
});

// ─── MoodChart ────────────────────────────────────────────────────────────────

function MoodChart({
  weekHistory,
}: {
  weekHistory: Array<{ score: number; emoji: string; date: string; label?: string } | null>;
}) {
  const maxScore = 5;
  const barMaxHeight = 72;

  // Day labels derived from THIS week starting Monday (fixes the static
  // ['M','T','W','T','F','S','S'] confusion between Sat and Sun).
  const dayLabels = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
    const abbr = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const isToday =
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate();
      return { abbr: abbr[i], day: d.getDate(), isToday };
    });
  }, []);

  const hasData = weekHistory.some(Boolean);

  if (!hasData) {
    return (
      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 10, color: '#C4B5D4', letterSpacing: 1, marginBottom: 12 }}>
          7-DAY MOOD TREND
        </Text>
        <View style={{ height: 72, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(232,72,122,0.04)', borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(232,72,122,0.1)', borderStyle: 'dashed' }}>
          <Text style={{ fontFamily: Fonts.sansRegular, fontSize: 13, color: '#C4B5D4' }}>
            Tap a mood above to start tracking ✨
          </Text>
        </View>
      </View>
    );
  }

  // Weekly summary
  const nonNull = weekHistory.filter(Boolean) as Array<{ score: number; emoji: string; date: string }>;
  let summaryText = '';
  if (nonNull.length > 0) {
    const best = nonNull.reduce((a, b) => (b.score > a.score ? b : a));
    const bestMoodData = MOOD_DATA.find((m) => m.score === best.score);
    const count = nonNull.filter((e) => e.score === best.score).length;
    summaryText = `You felt ${bestMoodData?.label.toLowerCase() ?? 'well'} ${count} out of 7 days`;
  }

  return (
    <View style={chartStyles.container}>
      <Text style={chartStyles.label}>7-Day Mood Trend</Text>

      <View style={chartStyles.barsRow}>
        {weekHistory.map((entry, i) => {
          const { abbr, day, isToday } = dayLabels[i];
          const heightPct = entry ? (entry.score / maxScore) : 0;
          return (
            <View key={i} style={chartStyles.barCol}>
              <View style={[chartStyles.barTrack, { height: barMaxHeight }]}>
                {entry ? (
                  <LinearGradient
                    colors={isToday ? ['#E8487A', '#7C3AED'] : ['#F4B3CC', '#C9A8E0']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={[
                      chartStyles.barFill,
                      { height: Math.max(8, barMaxHeight * heightPct) },
                    ]}
                  />
                ) : (
                  <View style={[chartStyles.barEmpty, { height: 6 }]} />
                )}
                {entry && (
                  <Text style={chartStyles.barEmoji}>{entry.emoji}</Text>
                )}
              </View>
              <Text style={[chartStyles.barDayLabel, isToday && chartStyles.barDayLabelToday]}>
                {abbr}
              </Text>
              <Text style={[chartStyles.barDateLabel, isToday && chartStyles.barDateLabelToday]}>
                {isToday ? 'Today' : day}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Weekly Summary Card */}
      {summaryText ? (
        <View style={chartStyles.summaryCard}>
          <View style={chartStyles.summaryBorder} />
          <Text style={chartStyles.summaryText}>{summaryText}</Text>
        </View>
      ) : null}
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: { marginTop: 16 },
  label: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    color: '#C4B5D4',
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  barTrack: {
    width: '62%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
  },
  barFill: {
    width: '100%',
    borderRadius: 8,
    alignItems: 'center',
  },
  barEmpty: {
    width: '60%',
    backgroundColor: '#EDE9F6',
    borderRadius: 4,
  },
  barEmoji: {
    position: 'absolute',
    top: -18,
    fontSize: 14,
  },
  barDayLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 10,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  barDayLabelToday: {
    color: '#E8487A',
    fontFamily: Fonts.sansBold,
  },
  barDateLabel: {
    fontFamily: Fonts.sansRegular,
    fontSize: 10,
    color: '#9CA3AF',
  },
  barDateLabelToday: {
    color: '#E8487A',
    fontFamily: Fonts.sansBold,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F4FF',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    overflow: 'hidden',
  },
  summaryBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#E8487A',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  summaryText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#1C1033',
    marginLeft: 10,
  },
});

// ─── YogaGallery ──────────────────────────────────────────────────────────────

const YOGA_CARD_GRADIENTS: [string, string][] = [
  ['#E8487A', '#7C3AED'],
  ['#7C3AED', '#60A5FA'],
  ['#34D399', '#60A5FA'],
  ['#F59E0B', '#E8487A'],
];

function YogaGallery({
  sessions,
  onPress,
}: {
  sessions: YogaSession[];
  onPress: (session: YogaSession) => void;
}) {
  return (
    <View style={yogaGalleryStyles.wrapper}>
      <ScrollView
        horizontal
        pagingEnabled={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={yogaGalleryStyles.scrollContent}
      >
        {sessions.map((session, index) => {
          const isFirst = index === 0;
          const cardWidth = isFirst ? SCREEN_WIDTH - 32 : 220;
          const gradient = YOGA_CARD_GRADIENTS[index % YOGA_CARD_GRADIENTS.length];

          return (
            <TouchableOpacity
              key={session.id}
              activeOpacity={0.85}
              onPress={() => onPress(session)}
              style={[
                yogaGalleryStyles.card,
                { width: cardWidth },
                index < sessions.length - 1 && { marginRight: 12 },
              ]}
            >
              <LinearGradient
                colors={gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              {/* Top pills row */}
              <View style={yogaGalleryStyles.pillsRow}>
                <View style={yogaGalleryStyles.pill}>
                  <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.9)" />
                  <Text style={yogaGalleryStyles.pillText}>{session.duration} min</Text>
                </View>
                <View style={yogaGalleryStyles.pill}>
                  <Text style={yogaGalleryStyles.pillText}>{session.level}</Text>
                </View>
              </View>

              {/* Bottom row: name + play */}
              <View style={yogaGalleryStyles.bottomRow}>
                <Text style={yogaGalleryStyles.sessionName} numberOfLines={2}>
                  {session.name}
                </Text>
                <View style={yogaGalleryStyles.playBtn}>
                  <Ionicons name="play" size={20} color="#ffffff" />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Right edge fade */}
      <View style={yogaGalleryStyles.rightFade} pointerEvents="none">
        <LinearGradient
          colors={['transparent', '#FFF8FC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
}

const yogaGalleryStyles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  card: {
    height: 160,
    borderRadius: 20,
    overflow: 'hidden',
    padding: 16,
    justifyContent: 'space-between',
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  pillText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: '#ffffff',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  sessionName: {
    fontFamily: Fonts.sansBold,
    fontSize: 16,
    color: '#ffffff',
    flex: 1,
    lineHeight: 22,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2, // optical centering for play icon
  },
  rightFade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 4,
    width: 40,
  },
});

// ─── HealthCondModal ───────────────────────────────────────────────────────────

function HealthCondModal({
  visible,
  onDone,
}: {
  visible: boolean;
  onDone: (conditions: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const HEALTH_CONDITION_OPTIONS = [
    'Recent C-Section', 'High Blood Pressure', 'Gestational Diabetes',
    'Placenta Previa', 'Back Pain', 'Diastasis Recti',
    'Anxiety/Depression', 'None of the above',
  ];

  const CONDITION_KEY_MAP: Record<string, string> = {
    'Recent C-Section': 'C-section recovery',
    'High Blood Pressure': 'Hypertension',
    'Gestational Diabetes': 'Gestational diabetes',
    'Placenta Previa': 'Placenta previa',
    'Back Pain': 'Severe back pain',
    'Diastasis Recti': 'Diastasis recti',
    'Anxiety/Depression': 'Anxiety',
  };

  const toggle = (item: string) => {
    if (item === 'None of the above') {
      setSelected(['None of the above']);
      return;
    }
    setSelected((prev) =>
      prev.includes(item)
        ? prev.filter((a) => a !== item)
        : [...prev.filter((a) => a !== 'None of the above'), item]
    );
  };

  const handleDone = () => {
    const keys = selected
      .filter((s) => s !== 'None of the above')
      .map((s) => CONDITION_KEY_MAP[s])
      .filter(Boolean);
    onDone(keys);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={condStyles.overlay}>
        <View style={condStyles.sheet}>
          <View style={condStyles.handle} />
          <Text style={condStyles.title}>Any health conditions? 🌿</Text>
          <Text style={condStyles.subtitle}>
            This helps us suggest safe yoga sessions for you
          </Text>
          <View style={condStyles.chipsWrap}>
            {HEALTH_CONDITION_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[condStyles.chip, selected.includes(opt) && condStyles.chipSelected]}
                onPress={() => toggle(opt)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    condStyles.chipText,
                    selected.includes(opt) && condStyles.chipTextSelected,
                  ]}
                >
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <GradientButton title="Save & See Sessions" onPress={handleDone} />
        </View>
      </View>
    </Modal>
  );
}

const condStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFF8FC',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 44,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#EDE9F6',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: { fontFamily: Fonts.sansBold, fontSize: 20, color: '#1C1033', marginBottom: 6 },
  subtitle: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 20,
    lineHeight: 20,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  chip: {
    borderWidth: 1.5,
    borderColor: '#EDE9F6',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
  },
  chipSelected: { borderColor: '#7C3AED', backgroundColor: 'rgba(124,58,237,0.06)' },
  chipText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: '#9CA3AF' },
  chipTextSelected: { fontFamily: Fonts.sansBold, color: '#7C3AED' },
});

// ─── Mental Tips ──────────────────────────────────────────────────────────────

const MENTAL_TIPS = [
  { emoji: '🌸', text: 'Practice 5 minutes of deep breathing daily — it rewires your nervous system' },
  { emoji: '💧', text: 'Hydration affects mood — aim for 8 glasses of water daily' },
  { emoji: '🌙', text: 'Sleep when baby sleeps is real advice — rest is medicine' },
  { emoji: '👥', text: 'Share your feelings — isolation makes postpartum harder' },
  { emoji: '🎵', text: 'Play calm music during feeding — it soothes both of you' },
];

const TIP_BG = ['#F8F4FF', '#FFF0F5'];

function PullQuoteTip({ tip, index }: { tip: { emoji: string; text: string }; index: number }) {
  const bg = TIP_BG[index % 2];
  return (
    <View style={[tipStyles.card, { backgroundColor: bg }]}>
      <View style={tipStyles.emojiBox}>
        <Text style={tipStyles.emoji}>{tip.emoji}</Text>
      </View>
      <Text style={tipStyles.tipText}>{tip.text}</Text>
    </View>
  );
}

const tipStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emojiBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(232,72,122,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  emoji: {
    fontSize: 18,
  },
  tipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#1C1033',
    lineHeight: 19,
    flex: 1,
  },
});

// ─── Mood Divider Line ────────────────────────────────────────────────────────

function MoodDividerLine() {
  return (
    <LinearGradient
      colors={['#E8487A', 'transparent']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={dividerStyles.line}
    />
  );
}

const dividerStyles = StyleSheet.create({
  line: { height: 1, borderRadius: 1, marginTop: 10, marginBottom: 2 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function WellnessScreen() {
  const insets = useSafeAreaInsets();
  const {
    logMood,
    getTodayMood,
    getWeekHistory,
    healthConditions,
    setHealthConditions,
  } = useWellnessStore();
  const profile = useProfileStore((s) => s.profile);
  const { user } = useAuthStore();

  // Subscribe to moodHistory so we re-compute today's mood on rehydrate.
  // Zustand persist is async; useState-with-init would freeze the value to
  // whatever moodHistory was at first paint (empty), hiding saved moods.
  const moodHistory = useWellnessStore((s) => s.moodHistory);
  const todayMood = useMemo(() => {
    const today = (() => {
      const t = new Date();
      return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    })();
    return moodHistory.find((m: any) => m.date === today) ?? null;
  }, [moodHistory]);
  const selectedMoodScore = todayMood?.score ?? null;
  const moodResponse = todayMood ? MOOD_RESPONSES[todayMood.score] : null;

  const [showCondModal, setShowCondModal] = useState(false);
  const [selectedYogaSession, setSelectedYogaSession] = useState<YogaSession | null>(null);
  const [showYogaModal, setShowYogaModal] = useState(false);

  const weekHistory = getWeekHistory();

  const handleMoodSelect = (score: 1 | 2 | 3 | 4 | 5) => {
    logMood(score);
    // selectedMoodScore and moodResponse update automatically via the
    // moodHistory selector above — no local state to keep in sync.
    if (user?.uid) {
      const { moodHistory: latest } = useWellnessStore.getState();
      syncWellnessData(user.uid, latest, healthConditions);
    }
  };

  const filteredSessions = healthConditions !== null
    ? YOGA_SESSIONS.filter(
        (s) => !s.contraindications.some((c) => healthConditions.includes(c))
      )
    : YOGA_SESSIONS;

  const moodCardTint = selectedMoodScore ? MOOD_TINTS[selectedMoodScore] : 'transparent';

  return (
    <View style={styles.container}>
      {/* ── Dark Gradient Header ── */}
      <LinearGradient
        colors={['#1C1033', '#3b1060', '#6d1a7a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 14 }]}
      >
        <View style={styles.glowTopRight} pointerEvents="none" />
        <View style={styles.glowBottomLeft} pointerEvents="none" />
        <Text style={styles.headerTitle}>Wellness</Text>
        <Text style={styles.headerSub}>{profile?.stage === 'pregnant' ? 'Pregnancy wellness for you' : 'Postpartum care & recovery'}</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <ContextualAskChip
          prompt={
            profile?.stage === 'pregnant'
              ? 'Ask about my energy and mood during pregnancy'
              : 'Ask about postpartum recovery and self-care'
          }
        />

        {/* Mood check-in */}
        <Card
          style={{ ...styles.moodCard, backgroundColor: moodCardTint || '#ffffff' }}
          shadow="md"
        >
          <Text style={styles.moodTitle}>How are you feeling today? 💙</Text>
          <MoodSelector selectedScore={selectedMoodScore} onSelect={handleMoodSelect} />

          {moodResponse && (
            <>
              <MoodDividerLine />
              <View style={styles.moodResponse}>
                <Text style={styles.moodResponseText}>{moodResponse}</Text>
              </View>
            </>
          )}

          <MoodChart weekHistory={weekHistory} />
        </Card>

        {/* Yoga section */}
        <Text style={styles.sectionTitle}>Yoga &amp; Movement</Text>

        <TouchableOpacity
          style={styles.condBanner}
          onPress={() => setShowCondModal(true)}
          activeOpacity={0.8}
        >
          <View style={styles.condBannerLeft}>
            <Ionicons name="options-outline" size={14} color="#7C3AED" />
            <Text style={styles.condBannerText}>
              {healthConditions === null
                ? 'Personalise sessions for your health conditions'
                : 'Update health conditions'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color="#A78BCA" />
        </TouchableOpacity>

        <YogaGallery
          sessions={filteredSessions}
          onPress={(session) => {
            setSelectedYogaSession(session);
            setShowYogaModal(true);
          }}
        />

        {/* Mental Wellness tips */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Mental Wellness</Text>
        {MENTAL_TIPS.map((tip, i) => (
          <PullQuoteTip key={i} tip={tip} index={i} />
        ))}
      </ScrollView>

      <HealthCondModal
        visible={showCondModal}
        onDone={(conditions) => {
          setHealthConditions(conditions);
          setShowCondModal(false);
          if (user?.uid) {
            const { moodHistory } = useWellnessStore.getState();
            syncWellnessData(user.uid, moodHistory, conditions);
          }
        }}
      />

      <YogaModalComponent
        session={selectedYogaSession}
        visible={showYogaModal}
        onClose={() => setShowYogaModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8FC' },
  // Dark header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  glowTopRight: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(232,72,122,0.22)',
    top: -60,
    right: -40,
  },
  glowBottomLeft: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(124,58,237,0.18)',
    bottom: -40,
    left: -20,
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    color: '#ffffff',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  headerSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  moodCard: { marginBottom: 24 },
  moodTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 16,
    color: '#1C1033',
    marginBottom: 12,
  },
  moodResponse: {
    backgroundColor: 'rgba(124,58,237,0.06)',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#7C3AED',
  },
  moodResponseText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#374151',
    lineHeight: 21,
  },
  sectionTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 18,
    color: '#1C1033',
    marginBottom: 12,
    marginTop: 8,
  },
  condCard: { alignItems: 'center', paddingVertical: 28, marginBottom: 8 },
  condIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(232,72,122,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    alignSelf: 'center',
  },
  condTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 17,
    color: '#1C1033',
    marginBottom: 6,
  },
  condSubtitle: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 260,
  },
  condBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(124,58,237,0.06)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
  },
  condBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  condBannerText: { fontFamily: Fonts.sansRegular, fontSize: 12, color: '#7C3AED', flex: 1 },
});
