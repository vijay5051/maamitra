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
import GradientHeader from '../../components/ui/GradientHeader';
import Card from '../../components/ui/Card';
import GradientButton from '../../components/ui/GradientButton';
import { YOGA_SESSIONS, YogaSession } from '../../data/yogaSessions';
import YogaModalComponent from '../../components/wellness/YogaModal';

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
  moodEmoji: { fontSize: 30 },
  moodLabel: { fontSize: 11, color: '#6b7280', fontWeight: '500' },
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
  label: { fontSize: 12, color: '#9ca3af', fontWeight: '600', marginBottom: 10 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  bar: { width: '100%', borderRadius: 4 },
  emptyBar: { backgroundColor: '#e5e7eb' },
  dayLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '500' },
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
        <Text style={yogaCardStyles.emoji}>{session.emoji}</Text>
      </View>
      <View style={yogaCardStyles.info}>
        <Text style={yogaCardStyles.title}>{session.name}</Text>
        <View style={yogaCardStyles.meta}>
          <Text style={yogaCardStyles.metaText}>⏱ {session.duration} min</Text>
          <Text style={yogaCardStyles.metaText}>• {session.level}</Text>
        </View>
        <Text style={yogaCardStyles.desc} numberOfLines={2}>{session.description}</Text>
      </View>
      <Ionicons name="play-circle-outline" size={28} color="#ec4899" />
    </TouchableOpacity>
  );
}

const yogaCardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3e8ff',
    boxShadow: '0px 2px 8px rgba(236, 72, 153, 0.07)',
  },
  left: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fdf2f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
  info: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: '#1a1a2e', marginBottom: 3 },
  meta: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  metaText: { fontSize: 11, color: '#8b5cf6', fontWeight: '500' },
  desc: { fontSize: 12, color: '#6b7280', lineHeight: 17 },
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 44,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a2e', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 20, lineHeight: 20 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  chip: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#f9fafb',
  },
  chipSelected: { borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.08)' },
  chipText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  chipTextSelected: { color: '#8b5cf6', fontWeight: '700' },
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
      <GradientHeader title="Wellness 🌿" subtitle="Your mind & body, every day" />

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
        <Text style={styles.sectionTitle}>Yoga & Movement 🧘</Text>

        {healthConditions === null ? (
          <Card style={styles.condCard} shadow="sm">
            <Text style={styles.condEmoji}>🧘</Text>
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
        <Text style={styles.sectionTitle}>Mental Wellness 🌈</Text>
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
  container: { flex: 1, backgroundColor: '#fdf6ff' },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  moodCard: { marginBottom: 24 },
  moodTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e', marginBottom: 12 },
  moodResponse: {
    backgroundColor: 'rgba(139,92,246,0.08)',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#8b5cf6',
  },
  moodResponseText: { fontSize: 14, color: '#374151', lineHeight: 21 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 12,
    marginTop: 8,
  },
  condCard: { alignItems: 'center', paddingVertical: 28, marginBottom: 8 },
  condEmoji: { fontSize: 40, marginBottom: 10 },
  condTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e', marginBottom: 6 },
  condSubtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 21, maxWidth: 260 },
  changeCondBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    marginBottom: 10,
  },
  changeCondText: { fontSize: 12, color: '#8b5cf6', fontWeight: '600' },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#f3e8ff',
    boxShadow: '0px 1px 6px rgba(236, 72, 153, 0.05)',
  },
  tipEmoji: { fontSize: 20, marginTop: 1 },
  tipText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 21 },
});
