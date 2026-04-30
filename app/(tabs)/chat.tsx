import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  FlatList,
  Image,
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
import ChatHistorySheet, { ThreadRow } from '../../components/chat/ChatHistorySheet';
import TypingIndicator from '../../components/ui/TypingIndicator';
import GradientAvatar from '../../components/ui/GradientAvatar';
import { Illustration } from '../../components/ui/Illustration';
import { AppIcon } from '../../components/ui/AppIcon';
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
    backgroundColor: Colors.bgLight,
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
    backgroundColor: Colors.cardBg,
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
  const { prefill, threadId: routeThreadId } = useLocalSearchParams<{ prefill?: string; threadId?: string }>();
  const consumedRouteRef = useRef<string>('');
  const {
    isTyping,
    allergies,
    sendMessage,
    saveAnswer,
    setAllergies,
    loadThreadsFromFirestore,
    createThread,
    switchThread,
    deleteThread,
    renameThread,
  } = useChatStore();
  const streamingId = useChatStore((s) => s.streamingId);
  const streamingContent = useChatStore((s) => s.streamingContent);
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
  // WhatsApp-style nav: tab opens to threads list; tap a thread or "New
  // chat" to enter the conversation; back arrow returns to the list.
  const [view, setView] = useState<'list' | 'conversation'>('list');

  // Load chat threads from Firestore on login
  useEffect(() => {
    if (user?.uid) loadThreadsFromFirestore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const flatListRef = useRef<FlatList>(null);

  // Deep-link entry handling. Two params drive this:
  //   prefill   → user tapped a "Ask Maamitra: <example>" CTA somewhere.
  //               We start a NEW thread so their question doesn't dump
  //               into an unrelated old conversation, then jump to the
  //               conversation view with the prompt staged in the input.
  //   threadId  → user tapped a "Continue chat" card. Switch to that
  //               thread and jump straight into the conversation view.
  // A ref guards against re-firing on every prop change of the same params.
  useEffect(() => {
    const key = `${typeof prefill === 'string' ? prefill : ''}|${typeof routeThreadId === 'string' ? routeThreadId : ''}`;
    if (!key.replace('|', '')) return;
    if (consumedRouteRef.current === key) return;
    consumedRouteRef.current = key;

    if (typeof prefill === 'string' && prefill.length > 0) {
      const trimmed = prefill.trim().replace(/\s+/g, ' ');
      const title = trimmed.length > 40 ? trimmed.slice(0, 40) + '…' : trimmed;
      createThread(title || 'New chat');
      setView('conversation');
    } else if (typeof routeThreadId === 'string' && routeThreadId.length > 0) {
      switchThread(routeThreadId);
      setView('conversation');
    }
  }, [prefill, routeThreadId, createThread, switchThread]);

  const handleNewChat = useCallback(() => {
    createThread('New chat');
    setView('conversation');
  }, [createThread]);

  const handleOpenThread = useCallback(
    (threadId: string) => {
      switchThread(threadId);
      setView('conversation');
    },
    [switchThread],
  );

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
      motherName: motherName || 'Mom',
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

  // ── Thread list view (WhatsApp-style chat list) ──────────────────────
  if (view === 'list') {
    const sortedThreads = [...threads].sort((a, b) => {
      const aT = new Date(a.lastMessageAt).getTime();
      const bT = new Date(b.lastMessageAt).getTime();
      return bT - aT;
    });
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#FFFFFF', '#FFFFFF', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 12 }]}
        >
          <View style={styles.glowTopRight} pointerEvents="none" />
          <View style={styles.glowBottomLeft} pointerEvents="none" />
          <View style={styles.headerInner}>
            <View style={styles.headerLeft}>
              <View style={styles.headerInfo}>
                <Text style={styles.headerName}>Chats</Text>
                <Text style={styles.headerSub}>Your conversations with MaaMitra</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                onPress={handleNewChat}
                style={[styles.gearBtn, { backgroundColor: Colors.primary }]}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
        <FlatList
          data={sortedThreads}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <ThreadRow
              thread={item}
              isActive={item.id === activeThreadId}
              onPress={() => handleOpenThread(item.id)}
              onRename={(newTitle) => renameThread(item.id, newTitle)}
              onDelete={() => deleteThread(item.id)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Illustration name="chatMascot" style={styles.emptyMascot} contentFit="contain" />
              <Text style={styles.emptyGreet}>
                Namaste{motherName ? `, ${motherName.split(' ')[0]}` : ''}! 🙏
              </Text>
              <Text style={styles.emptyDesc}>
                Tap the + button above to start your first chat with MaaMitra.
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 24 }}
        />
      </View>
    );
  }

  // ── Conversation view ────────────────────────────────────────────────
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
          {/* Left: Back arrow + Logo + info */}
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => setView('list')}
              style={styles.gearBtn}
              activeOpacity={0.7}
              accessibilityLabel="Back to chats"
            >
              <Ionicons name="chevron-back" size={22} color={Colors.primary} />
            </TouchableOpacity>
            <View style={styles.avatarWrap}>
              <View style={styles.logoCircle}>
                <Image
                  source={require('../../assets/logo.png')}
                  style={styles.logoImg}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.onlineDot} />
            </View>
            <View style={styles.headerInfo} />
          </View>

          {/* Right: Kid pill + settings (history is the back arrow now) */}
          <View style={styles.headerRight}>
            {activeKid ? (
              <View style={styles.kidPill}>
                <Text style={styles.kidPillText} numberOfLines={1} ellipsizeMode="tail">
                  {activeKid.name}{activeKid.ageInMonths !== undefined ? ` · ${ageLabel}` : ''}
                </Text>
              </View>
            ) : null}
            <TouchableOpacity
              onPress={() => setSettingsVisible(true)}
              style={styles.gearBtn}
              activeOpacity={0.7}
            >
              <AppIcon name="nav.settings" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* ── Chat Body ── */}
      <KeyboardAvoidingView
        style={styles.flex}
        // app.json sets android.softwareKeyboardLayoutMode="resize" so
        // the OS shrinks the window when the keyboard opens. On top of
        // that we use behavior="padding" to add bottom padding equal
        // to the keyboard height — together this reliably lifts the
        // input above the keyboard on iOS, Android, and web. We
        // previously tried behavior="height" on Android and it fought
        // the OS resize, causing a Gboard wobble on Galaxy Note 20;
        // padding doesn't have that problem.
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {/* Radial glow bloom behind message list */}
        <View style={styles.radialGlow} pointerEvents="none" />

        {messages.length === 0 && !isTyping ? (
          <View style={styles.emptyState}>
            <Illustration name="chatMascot" style={styles.emptyMascot} contentFit="contain" />
            <Text style={styles.emptyGreet}>Namaste{motherName ? `, ${motherName.split(' ')[0]}` : ''}! 🙏</Text>
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
              const displayMessage =
                item.id === streamingId
                  ? { ...item, content: streamingContent }
                  : item;
              return (
                <ChatBubble
                  message={displayMessage}
                  isFirstInGroup={isFirstInGroup}
                  onSave={item.role === 'assistant' && !item.saved && item.id !== streamingId ? handleSave : undefined}
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
              <AppIcon
                name="object.idea"
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
  container: { flex: 1, backgroundColor: Colors.bgLight },
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },

  avatarWrap: { position: 'relative' },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F0EDF5',
    overflow: 'hidden',
  },
  logoImg: {
    width: 30,
    height: 30,
  },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#22c55e',
    borderWidth: 2, borderColor: '#ffffff',
  },

  headerInfo: { flex: 1, minWidth: 0 },
  headerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerName: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    color: '#1C1033',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: '#6b7280',
    marginTop: 1,
  },

  kidPill: {
    backgroundColor: '#F5F0FF',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E5DAF5',
    maxWidth: 130,
  },
  kidPillText: {
    fontFamily: Fonts.sansSemiBold,
    color: Colors.primary,
    fontSize: 12,
  },
  gearBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#F5F0FF',
    borderWidth: 1, borderColor: '#E5DAF5',
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
  emptyState: { flex: 1, paddingTop: 24, paddingBottom: 8 },
  emptyAvatar: { alignSelf: 'center', marginBottom: 12 },
  emptyMascot: { width: 160, height: 160, alignSelf: 'center', marginBottom: 8 },
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
