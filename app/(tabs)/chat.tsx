import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore } from '../../store/useChatStore';
import { useProfileStore, calculateAgeInMonths } from '../../store/useProfileStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useWellnessStore } from '../../store/useWellnessStore';
import { useTeethStore } from '../../store/useTeethStore';
import { syncAllergies } from '../../services/firebase';
import { useActiveKid } from '../../hooks/useActiveKid';
import { useVaccineSchedule } from '../../hooks/useVaccineSchedule';
import { detectIsFood } from '../../services/claude';
import { INDIAN_LANGUAGES } from '../../services/voice';
import { TEETH } from '../../data/teeth';
import ChatBubble from '../../components/chat/ChatBubble';
import ChatInput from '../../components/chat/ChatInput';
import QuickChips from '../../components/chat/QuickChips';
import ChatHistorySheet from '../../components/chat/ChatHistorySheet';
import TypingIndicator from '../../components/ui/TypingIndicator';
import GradientAvatar from '../../components/ui/GradientAvatar';
import SettingsModal from '../../components/ui/SettingsModal';
import { Fonts } from '../../constants/theme';
import { Colors } from '../../constants/theme';

// ─── Allergy Modal ─────────────────────────────────────────────────────────────

const COMMON_ALLERGENS = [
  'Peanuts', 'Tree Nuts', 'Milk', 'Eggs', 'Wheat/Gluten',
  'Soy', 'Fish', 'Shellfish', 'Sesame', 'None',
];

function AllergyModal({
  visible,
  onDone,
}: {
  visible: boolean;
  onDone: (allergies: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (item: string) => {
    if (item === 'None') {
      setSelected(['None']);
      return;
    }
    setSelected((prev) =>
      prev.includes(item) ? prev.filter((a) => a !== item) : [...prev.filter((a) => a !== 'None'), item]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={allergyStyles.overlay}>
        <View style={allergyStyles.sheet}>
          <View style={allergyStyles.handle} />
          <Text style={allergyStyles.title}>Any known allergies? 🌿</Text>
          <Text style={allergyStyles.subtitle}>
            This helps me give you safe food recommendations for your family
          </Text>
          <View style={allergyStyles.chipsWrap}>
            {COMMON_ALLERGENS.map((a) => (
              <TouchableOpacity
                key={a}
                style={[
                  allergyStyles.chip,
                  selected.includes(a) && allergyStyles.chipSelected,
                ]}
                onPress={() => toggle(a)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    allergyStyles.chipText,
                    selected.includes(a) && allergyStyles.chipTextSelected,
                  ]}
                >
                  {a}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={allergyStyles.doneBtn}
            onPress={() => onDone(selected.length > 0 ? selected : ['None'])}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={allergyStyles.doneBtnGrad}
            >
              <Text style={allergyStyles.doneBtnText}>Save & Continue</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const allergyStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FAFAFB',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  handle: { width: 36, height: 4, backgroundColor: '#EDE9F6', borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
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
  chipSelected: { borderColor: Colors.primary, backgroundColor: 'rgba(28, 16, 51, 0.048)' },
  chipText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: '#9CA3AF' },
  chipTextSelected: { color: Colors.primary, fontFamily: Fonts.sansBold },
  doneBtn: { borderRadius: 18, overflow: 'hidden' },
  doneBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  doneBtnText: { fontFamily: Fonts.sansBold, color: '#ffffff', fontSize: 16 },
});

// ─── TODAY Separator with gradient lines ──────────────────────────────────────

function TodaySeparator() {
  return (
    <View style={sepStyles.container}>
      {/* Left gradient line */}
      <View style={sepStyles.lineWrap}>
        <LinearGradient
          colors={['transparent', 'rgba(28, 16, 51, 0.12)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={sepStyles.gradLine}
        />
      </View>
      <Text style={sepStyles.label}>TODAY</Text>
      {/* Right gradient line */}
      <View style={sepStyles.lineWrap}>
        <LinearGradient
          colors={['transparent', 'rgba(28, 16, 51, 0.12)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={sepStyles.gradLine}
        />
      </View>
    </View>
  );
}

const sepStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    width: '100%',
  },
  lineWrap: {
    flex: 1,
    height: 1,
    overflow: 'hidden',
  },
  gradLine: {
    flex: 1,
    height: 1,
  },
  label: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: '#6B7280',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginHorizontal: 12,
  },
});

// ─── Chat Screen ──────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  // Prefill arrives when the user tapped a contextual "Ask Maamitra" chip on
  // another tab. We just stage it in the input; we don't auto-send so the user
  // stays in control.
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const {
    isTyping,
    allergies,
    sendMessage,
    saveAnswer,
    setAllergies,
    loadThreadsFromFirestore,
  } = useChatStore();
  // Subscribe to threads + activeThreadId so messages re-render on thread switch
  const activeThreadId = useChatStore((s) => s.activeThreadId);
  const threads = useChatStore((s) => s.threads);
  const messages = React.useMemo(() => {
    return threads.find((t) => t.id === activeThreadId)?.messages ?? [];
  }, [threads, activeThreadId]);
  const { motherName, profile, parentGender } = useProfileStore();
  const { user } = useAuthStore();
  const { activeKid, ageLabel } = useActiveKid();

  const healthConditions = useWellnessStore((s) => s.healthConditions);

  const [allergyModalVisible, setAllergyModalVisible] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Load chat threads from Firestore on login
  useEffect(() => {
    if (user?.uid) loadThreadsFromFirestore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const flatListRef = useRef<FlatList>(null);

  // ── Rich context builders — every extra signal makes the AI's answer
  // more specific to this parent. All lookups read cached store values;
  // no extra Firestore reads per turn.
  const completedVaccines = useProfileStore((s) => s.completedVaccines);
  const moodHistory = useWellnessStore((s) => s.moodHistory);
  const teethByKid = useTeethStore((s) => s.byKid);
  const savedAnswers = useChatStore((s) => s.savedAnswers);
  const voiceLanguage = useChatStore((s) => s.voiceLanguage);
  const vaccineSchedule = useVaccineSchedule();

  const buildContext = useCallback(() => {
    const ageMo = activeKid && !activeKid.isExpecting ? calculateAgeInMonths(activeKid.dob) : 0;

    // Vaccines — count done + find next pending on the schedule.
    let completedCount = 0;
    if (activeKid) {
      const kidDone = completedVaccines[activeKid.id] ?? {};
      completedCount = Object.values(kidDone).filter((v: any) => v?.done).length;
    }
    const nextVaccine =
      vaccineSchedule.find((v) => v.status === 'overdue') ??
      vaccineSchedule.find((v) => v.status === 'due-soon') ??
      vaccineSchedule.find((v) => v.status === 'upcoming');
    let nextVaccineDueInDays: number | undefined;
    if (nextVaccine?.dueDate) {
      nextVaccineDueInDays = Math.round(
        (nextVaccine.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
    }

    // Teeth — count erupted + figure out typical next tooth for this age.
    let teethErupted: number | undefined;
    let nextToothName: string | undefined;
    if (activeKid && !activeKid.isExpecting) {
      const kidTeeth = teethByKid[activeKid.id] ?? {};
      teethErupted = Object.values(kidTeeth).filter((e: any) => e?.state === 'erupted').length;
      const nextTooth = TEETH
        .filter((t) => !kidTeeth[t.id] || kidTeeth[t.id]?.state === 'not-erupted')
        .sort((a, b) => a.eruptMinMo - b.eruptMinMo)[0];
      nextToothName = nextTooth?.shortName;
    }

    // Mood — average of the last 3 entries (already sorted newest-first).
    let recentMoodAvg: number | undefined;
    let recentMoodTrend: 'low' | 'ok' | 'good' | undefined;
    const recent = (moodHistory || []).slice(0, 3);
    if (recent.length >= 2) {
      recentMoodAvg = recent.reduce((s: number, m: any) => s + (m.score || 0), 0) / recent.length;
      recentMoodTrend = recentMoodAvg <= 2.5 ? 'low' : recentMoodAvg >= 4 ? 'good' : 'ok';
    }

    // Saved-answer topics — show interests as a handful of unique labels.
    const savedAnswerTopics = Array.from(
      new Set(
        (savedAnswers || [])
          .slice(0, 10)
          .map((a: any) => (a.tag?.tag ?? '').replace(/^\W+\s*/, '')) // strip leading emoji
          .filter(Boolean),
      ),
    );

    return {
      motherName: motherName || (parentGender === 'father' ? 'Dad' : 'Mom'),
      stage: profile?.stage ?? 'newborn',
      state: profile?.state ?? 'India',
      diet: profile?.diet ?? 'vegetarian',
      familyType: profile?.familyType ?? 'nuclear',
      kidName: activeKid?.name ?? 'your baby',
      kidAgeMonths: ageMo,
      kidDOB: activeKid?.dob,
      kidGender: activeKid?.gender,
      isExpecting: activeKid?.isExpecting ?? false,
      allergies,
      healthConditions,
      parentGender,
      // Pass 2 signals
      completedVaccinesCount: completedCount,
      nextVaccineName: nextVaccine?.name,
      nextVaccineDueInDays,
      teethErupted,
      teethTotal: TEETH.length,
      nextToothName,
      recentMoodAvg,
      recentMoodTrend,
      savedAnswerTopics,
      // Explicit language preference from the chat → language picker.
      // The system prompt uses these to force replies in the chosen
      // language regardless of the input text.
      preferredLanguageCode: voiceLanguage,
      preferredLanguageLabel: INDIAN_LANGUAGES.find((l) => l.code === voiceLanguage)?.label,
      preferredLanguageNative: INDIAN_LANGUAGES.find((l) => l.code === voiceLanguage)?.native,
    };
  }, [
    motherName, profile, activeKid, allergies, healthConditions, parentGender,
    completedVaccines, vaccineSchedule, teethByKid, moodHistory, savedAnswers,
    voiceLanguage,
  ]);

  const handleSend = useCallback(
    async (text: string, attachment?: { dataUrl: string; mimeType: string }) => {
      setShowSuggestions(false);
      // Only trigger the allergy-picker guard on food questions that don't
      // have an image (an image + food text is likely 'what's in this
      // dish' — the user has already seen the food). Keeps the modal from
      // getting in the way of vision queries.
      const isFood = !attachment && detectIsFood(text);

      if (isFood && allergies === null) {
        setPendingMessage(text);
        setAllergyModalVisible(true);
        return;
      }

      await sendMessage(text, buildContext(), attachment);
    },
    [allergies, sendMessage, buildContext]
  );

  const handleAllergyDone = useCallback(
    async (selected: string[]) => {
      setAllergies(selected);
      if (user?.uid) syncAllergies(user.uid, selected);
      setAllergyModalVisible(false);
      if (pendingMessage) {
        await sendMessage(pendingMessage, { ...buildContext(), allergies: selected });
        setPendingMessage(null);
      }
    },
    [pendingMessage, sendMessage, buildContext, setAllergies, user]
  );

  const handleSave = useCallback(
    (messageId: string) => saveAnswer(messageId),
    [saveAnswer]
  );

  const data = [...messages];

  return (
    <View style={styles.container}>
      {/* ── Dark Gradient Header ── */}
      <LinearGradient
        colors={['#FFFFFF', '#FFFFFF', '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        {/* Glow blobs */}
        <View style={styles.glowTopRight} pointerEvents="none" />
        <View style={styles.glowBottomLeft} pointerEvents="none" />

        <View style={styles.headerInner}>
          {/* Left: Avatar + info */}
          <View style={styles.headerLeft}>
            <View style={styles.avatarWrap}>
              <GradientAvatar emoji="🤱" size={40} />
              <View style={styles.onlineDot} />
            </View>
            <View style={styles.headerInfo}>
              <View style={styles.headerNameRow}>
                <Text style={styles.headerName}>MaaMitra</Text>
              </View>
              <Text style={styles.headerSub}>Always here for you ✨</Text>
            </View>
          </View>

          {/* Right: Kid pill + history + settings */}
          <View style={styles.headerRight}>
            {activeKid ? (
              <View style={styles.kidPill}>
                <Text style={styles.kidPillText}>
                  {activeKid.name}{activeKid.ageInMonths !== undefined ? ` · ${ageLabel}` : ''}
                </Text>
              </View>
            ) : null}
            <TouchableOpacity
              onPress={() => setShowHistory(true)}
              style={styles.gearBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSettingsVisible(true)}
              style={styles.gearBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* ── Chat Body ── */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' || Platform.OS === 'web' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Radial glow bloom behind message list */}
        <View style={styles.radialGlow} pointerEvents="none" />

        {messages.length === 0 && !isTyping ? (
          <View style={styles.emptyState}>
            <GradientAvatar emoji="🤱" size={64} style={styles.emptyAvatar} />
            <Text style={styles.emptyGreet}>Namaste{motherName ? `, ${motherName.split(' ')[0]}` : ''}! 🙏</Text>
            <Text style={styles.emptyDesc}>I'm MaaMitra, your personal companion.{'\n'}Ask me anything about your pregnancy, baby, health, or wellbeing.</Text>
            <View style={styles.emptySeparator}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>TODAY</Text>
              <View style={styles.separatorLine} />
            </View>
            <QuickChips onSelect={handleSend} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={data}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.chatContent}
            renderItem={({ item, index }) => {
              const prevMessage = index > 0 ? data[index - 1] : null;
              const isFirstInGroup =
                !prevMessage || prevMessage.role !== item.role;
              return (
                <ChatBubble
                  message={item}
                  isFirstInGroup={isFirstInGroup}
                  onSave={item.role === 'assistant' && !item.saved ? handleSave : undefined}
                />
              );
            }}
            ListFooterComponent={
              isTyping ? (
                <View style={styles.typingWrap}>
                  <GradientAvatar emoji="🤱" size={32} style={styles.typingAvatar} />
                  <TypingIndicator />
                </View>
              ) : null
            }
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Suggestions chips above input when conversation is active */}
        {messages.length > 0 && showSuggestions && (
          <QuickChips onSelect={handleSend} />
        )}

        <Text style={styles.medDisclaimer}>
          MaaMitra shares information, not medical advice. For urgent concerns, please consult a doctor.
        </Text>

        <View style={styles.inputRow}>
          {messages.length > 0 && (
            <TouchableOpacity
              style={styles.suggestBtn}
              onPress={() => setShowSuggestions((v) => !v)}
              activeOpacity={0.75}
            >
              <Ionicons
                name="bulb-outline"
                size={18}
                color={showSuggestions ? Colors.primary : '#A78BCA'}
              />
            </TouchableOpacity>
          )}
          <View style={styles.inputFlex}>
            <ChatInput
              onSend={handleSend}
              disabled={isTyping}
              prefill={typeof prefill === 'string' ? prefill : undefined}
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Allergy modal */}
      <AllergyModal visible={allergyModalVisible} onDone={handleAllergyDone} />

      {/* Settings modal */}
      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
      <ChatHistorySheet visible={showHistory} onClose={() => setShowHistory(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFB' },
  flex: { flex: 1 },

  // ── Header ──
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDF5',
  },
  glowTopRight: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'transparent', top: -60, right: -40,
  },
  glowBottomLeft: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'transparent', bottom: -40, left: -20,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  avatarWrap: { position: 'relative' },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#22c55e',
    borderWidth: 2, borderColor: '#1C1033',
  },

  headerInfo: {},
  headerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerName: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: '#6b7280',
    marginTop: 1,
  },

  kidPill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  kidPillText: {
    fontFamily: Fonts.sansSemiBold,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
  },
  gearBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Radial glow bloom ──
  radialGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    backgroundColor: 'rgba(28, 16, 51, 0.024)',
    borderBottomLeftRadius: 200,
    borderBottomRightRadius: 200,
    zIndex: 0,
  },

  // ── Chat content ──
  chatContent: {
    paddingHorizontal: 4,
    paddingTop: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },

  // ── Empty state ──
  emptyState: { flex: 1, paddingTop: 32, paddingBottom: 8 },
  emptyAvatar: { alignSelf: 'center', marginBottom: 12 },
  emptyGreet: { fontFamily: Fonts.sansBold, fontSize: 18, color: '#1C1033', textAlign: 'center', marginBottom: 6 },
  emptyDesc: { fontFamily: Fonts.sansRegular, fontSize: 13, color: '#9ca3af', textAlign: 'center', lineHeight: 20, paddingHorizontal: 32, marginBottom: 20 },
  emptySeparator: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 16, gap: 10 },
  separatorLine: { flex: 1, height: 1, backgroundColor: 'rgba(28, 16, 51, 0.072)' },
  separatorText: { fontFamily: Fonts.sansSemiBold, fontSize: 10, color: '#C4B5D4', letterSpacing: 1 },

  // ── Medical-advice disclaimer (persistent, above input) ──
  // Present on every chat view to make clear MaaMitra is an informational
  // companion — not a medical service. Required for Play Store clarity
  // since AI chat can be read as health guidance.
  medDisclaimer: {
    fontFamily: Fonts.sansRegular,
    fontSize: 10,
    lineHeight: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 4,
  },

  // ── Input row with suggestions toggle ──
  inputRow: { flexDirection: 'row', alignItems: 'flex-end' },
  inputFlex: { flex: 1 },
  suggestBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(28, 16, 51, 0.048)',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 8, marginBottom: 10,
  },

  // ── Typing indicator ──
  typingWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingLeft: 8,
    paddingVertical: 4,
  },
  typingAvatar: {},
});
