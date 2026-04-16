import React, { useState } from 'react';
import {
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
import { useWellnessStore, MOOD_DATA, MOOD_RESPONSES } from '../../store/useWellnessStore';
import Card from '../../components/ui/Card';
import GradientButton from '../../components/ui/GradientButton';
import { YOGA_SESSIONS, YogaSession } from '../../data/yogaSessions';
import YogaModalComponent from '../../components/wellness/YogaModal';
import { Fonts } from '../../constants/theme';

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

// ─── MoodSelector ─────────────────────────────────────────────────────────────

function MoodSelector({ onSelect }: { onSelect: (score: 1 | 2 | 3 | 4 | 5) => void }) {
  return (
    <View style={moodStyles.row}>
      {MOOD_DATA.map((m) => (
        <TouchableOpacity
          key={m.score}
          onPress={() => onSelect(m.score)}
          activeOpacity={0.75}
          style={moodStyles.moodBtn}
        >
          <Text style={moodStyles.moodEmoji}>{m.emoji}</Text>
          <Text style={moodStyles.moodLabel}>{m.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const moodStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8 },
  moodBtn: { alignItems: 'center', gap: 4 },
  moodEmoji: { fontSize: 36 },
  moodLabel: { fontFamily: Fonts.sansMedium, fontSize: 11, color: '#9CA3AF' },
});

// ─── MoodChart ────────────────────────────────────────────────────────────────

function MoodChart({ weekHistory }: { weekHistory: Array<{ score: number; emoji: string; date: string } | null> }) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const maxScore = 5;

  return (
    <View style={chartStyles.container}>
      <Text style={chartStyles.label}>7-Day Mood Trend</Text>
      <View style={chartStyles.bars}>
        {weekHistory.map((entry, i) => {
          const height = entry ? (entry.score / maxScore) * 60 : 4;
          return (
            <View key={i} style={chartStyles.barCol}>
              {entry ? (
                <LinearGradient
                  colors={['#ec4899', '#8b5cf6']}
                  style={[chartStyles.bar, { height }]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                />
              ) : (
                <View style={[chartStyles.bar, chartStyles.emptyBar, { height }]} />
              )}
              <Text style={chartStyles.dayLabel}>{days[i]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: { marginTop: 16 },
  label: { fontFamily: Fonts.sansSemiBold, fontSize: 11, color: '#C4B5D4', letterSpacing: 0.8, marginBottom: 10 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  bar: { width: '100%', borderRadius: 4 },
  emptyBar: { backgroundColor: '#EDE9F6' },
  dayLabel: { fontFamily: Fonts.sansMedium, fontSize: 10, color: '#C4B5D4' },
});

// ─── YogaCard ─────────────────────────────────────────────────────────────────

function YogaCard({
  session,
  onPress,
}: {
  session: YogaSession;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={yogaCardStyles.card}>
      <View style={yogaCardStyles.left}>
        <Ionicons name="body-outline" size={22} color="#E8487A" />
      </View>
      <View style={yogaCardStyles.info}>
        <Text style={yogaCardStyles.title}>{session.name}</Text>
        <View style={yogaCardStyles.meta}>
          <Ionicons name="time-outline" size={11} color="#A78BCA" />
          <Text style={yogaCardStyles.metaText}>{session.duration} min</Text>
          <Text style={yogaCardStyles.metaText}>• {session.level}</Text>
        </View>
        <Text style={yogaCardStyles.desc} numberOfLines={2}>{session.description}</Text>
      </View>
      <Ionicons name="play-circle-outline" size={28} color="#E8487A" />
    </TouchableOpacity>
  );
}

const yogaCardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#E8487A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#EDE9F6',
    boxShadow: '0px 2px 8px rgba(232, 72, 122, 0.07)',
  } as any,
  left: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(232,72,122,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  title: { fontFamily: Fonts.sansBold, fontSize: 14, color: '#1C1033', marginBottom: 3 },
  meta: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  metaText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: '#7C3AED' },
  desc: { fontFamily: Fonts.sansRegular, fontSize: 12, color: '#9CA3AF', lineHeight: 17 },
});

// YogaModal is imported from components/wellness/YogaModal

// ─── HealthCondModal ───────────────────────────────────────────────────────────

function HealthCondModal({
  visible,
  onDone,
}: {
  visible: boolean;
  onDone: (conditions: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

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
  handle: { width: 36, height: 4, backgroundColor: '#EDE9F6', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title: { fontFamily: Fonts.sansBold, fontSize: 20, color: '#1C1033', marginBottom: 6 },
  subtitle: { fontFamily: Fonts.sansRegular, fontSize: 14, color: '#9CA3AF', marginBottom: 20, lineHeight: 20 },
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

const MENTAL_TIPS = [
  { emoji: '🌸', text: 'Practice 5 minutes of deep breathing daily — it rewires your nervous system' },
  { emoji: '💧', text: 'Hydration affects mood — aim for 8 glasses of water daily' },
  { emoji: '🌙', text: 'Sleep when baby sleeps is real advice — rest is medicine' },
  { emoji: '👥', text: 'Share your feelings — isolation makes postpartum harder' },
  { emoji: '🎵', text: 'Play calm music during feeding — it soothes both of you' },
];

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

  const [selectedMoodScore, setSelectedMoodScore] = useState<number | null>(() => {
    const todayMood = getTodayMood();
    return todayMood?.score ?? null;
  });
  const [moodResponse, setMoodResponse] = useState<string | null>(() => {
    const todayMood = getTodayMood();
    return todayMood ? MOOD_RESPONSES[todayMood.score] : null;
  });

  const [showCondModal, setShowCondModal] = useState(false);
  const [selectedYogaSession, setSelectedYogaSession] = useState<YogaSession | null>(null);
  const [showYogaModal, setShowYogaModal] = useState(false);

  const weekHistory = getWeekHistory();

  const handleMoodSelect = (score: 1 | 2 | 3 | 4 | 5) => {
    logMood(score);
    setSelectedMoodScore(score);
    setMoodResponse(MOOD_RESPONSES[score]);
  };

  const filteredSessions = healthConditions !== null
    ? YOGA_SESSIONS.filter(
        (s) => !s.contraindications.some((c) => healthConditions.includes(c))
      )
    : YOGA_SESSIONS;

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
        <Text style={styles.headerSub}>Your mind & body, every day</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Mood check-in */}
        <Card style={styles.moodCard} shadow="md">
          <Text style={styles.moodTitle}>How are you feeling today? 💙</Text>
          <MoodSelector onSelect={handleMoodSelect} />
          {moodResponse && (
            <View style={styles.moodResponse}>
              <Text style={styles.moodResponseText}>{moodResponse}</Text>
            </View>
          )}
          <MoodChart weekHistory={weekHistory} />
        </Card>

        {/* Yoga section */}
        <Text style={styles.sectionTitle}>Yoga & Movement</Text>

        {healthConditions === null ? (
          <Card style={styles.condCard} shadow="sm">
            <View style={styles.condIconBox}>
              <Ionicons name="body-outline" size={28} color="#E8487A" />
            </View>
            <Text style={styles.condTitle}>Before we start...</Text>
            <Text style={styles.condSubtitle}>
              Tell us about any health conditions so we can suggest the safest sessions for you.
            </Text>
            <GradientButton
              title="Set Health Conditions"
              onPress={() => setShowCondModal(true)}
              style={{ marginTop: 12 }}
            />
          </Card>
        ) : (
          <>
            <TouchableOpacity
              style={styles.changeCondBtn}
              onPress={() => setShowCondModal(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="settings-outline" size={14} color="#8b5cf6" />
              <Text style={styles.changeCondText}>Update health conditions</Text>
            </TouchableOpacity>
            {filteredSessions.map((session) => (
              <YogaCard
                key={session.id}
                session={session}
                onPress={() => {
                  setSelectedYogaSession(session);
                  setShowYogaModal(true);
                }}
              />
            ))}
          </>
        )}

        {/* Mental Wellness tips */}
        <Text style={styles.sectionTitle}>Mental Wellness</Text>
        {MENTAL_TIPS.map((tip, i) => (
          <View key={i} style={styles.tipRow}>
            <Text style={styles.tipEmoji}>{tip.emoji}</Text>
            <Text style={styles.tipText}>{tip.text}</Text>
          </View>
        ))}
      </ScrollView>

      <HealthCondModal
        visible={showCondModal}
        onDone={(conditions) => {
          setHealthConditions(conditions);
          setShowCondModal(false);
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
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(232,72,122,0.22)', top: -60, right: -40,
  },
  glowBottomLeft: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(124,58,237,0.18)', bottom: -40, left: -20,
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
  moodTitle: { fontFamily: Fonts.sansBold, fontSize: 16, color: '#1C1033', marginBottom: 12 },
  moodResponse: {
    backgroundColor: 'rgba(124,58,237,0.06)',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#7C3AED',
  },
  moodResponseText: { fontFamily: Fonts.sansRegular, fontSize: 14, color: '#374151', lineHeight: 21 },
  sectionTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 18,
    color: '#1C1033',
    marginBottom: 12,
    marginTop: 8,
  },
  condCard: { alignItems: 'center', paddingVertical: 28, marginBottom: 8 },
  condIconBox: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(232,72,122,0.09)', alignItems: 'center', justifyContent: 'center', marginBottom: 10, alignSelf: 'center' },
  condTitle: { fontFamily: Fonts.sansBold, fontSize: 17, color: '#1C1033', marginBottom: 6 },
  condSubtitle: { fontFamily: Fonts.sansRegular, fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 21, maxWidth: 260 },
  changeCondBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    marginBottom: 10,
  },
  changeCondText: { fontFamily: Fonts.sansSemiBold, fontSize: 12, color: '#7C3AED' },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#E8487A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#EDE9F6',
    boxShadow: '0px 1px 6px rgba(232, 72, 122, 0.05)',
  } as any,
  tipEmoji: { fontSize: 20, marginTop: 1 },
  tipText: { fontFamily: Fonts.sansRegular, flex: 1, fontSize: 14, color: '#374151', lineHeight: 21 },
});
