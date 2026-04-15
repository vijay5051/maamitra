import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore } from '../../store/useChatStore';
import { useProfileStore } from '../../store/useProfileStore';
import { useActiveKid } from '../../hooks/useActiveKid';
import { detectIsFood } from '../../services/claude';
import ChatBubble from '../../components/chat/ChatBubble';
import ChatInput from '../../components/chat/ChatInput';
import QuickChips from '../../components/chat/QuickChips';
import TypingIndicator from '../../components/ui/TypingIndicator';
import GradientAvatar from '../../components/ui/GradientAvatar';
import SettingsModal from '../../components/ui/SettingsModal';

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
              colors={['#ec4899', '#8b5cf6']}
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
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
  chipSelected: { borderColor: '#ec4899', backgroundColor: 'rgba(236,72,153,0.08)' },
  chipText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  chipTextSelected: { color: '#ec4899', fontWeight: '700' },
  doneBtn: { borderRadius: 999, overflow: 'hidden' },
  doneBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  doneBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
});

// ─── Chat Screen ──────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { messages, isTyping, allergies, sendMessage, saveAnswer, setAllergies } = useChatStore();
  const { motherName, profile } = useProfileStore();
  const { activeKid, ageLabel } = useActiveKid();

  const [allergyModalVisible, setAllergyModalVisible] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  const buildContext = useCallback(() => ({
    motherName: motherName || 'Mom',
    stage: profile?.stage ?? 'newborn',
    state: profile?.state ?? 'India',
    diet: profile?.diet ?? 'vegetarian',
    kidName: activeKid?.name,
    kidAgeMonths: activeKid?.ageInMonths,
    kidDOB: activeKid?.dob,
    allergies,
  }), [motherName, profile, activeKid, allergies]);

  const handleSend = useCallback(
    async (text: string) => {
      const isFood = detectIsFood(text);

      if (isFood && allergies === null) {
        setPendingMessage(text);
        setAllergyModalVisible(true);
        return;
      }

      await sendMessage(text, buildContext());
    },
    [allergies, sendMessage, buildContext]
  );

  const handleAllergyDone = useCallback(
    async (selected: string[]) => {
      setAllergies(selected);
      setAllergyModalVisible(false);
      if (pendingMessage) {
        await sendMessage(pendingMessage, { ...buildContext(), allergies: selected });
        setPendingMessage(null);
      }
    },
    [pendingMessage, sendMessage, buildContext, setAllergies]
  );

  const handleSave = useCallback(
    (messageId: string) => saveAnswer(messageId),
    [saveAnswer]
  );

  const data = [...messages];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerLeft}>
          <GradientAvatar emoji="🤱" size={40} />
          <View style={styles.headerInfo}>
            <View style={styles.headerNameRow}>
              <Text style={styles.headerName}>MaaMitra</Text>
              <View style={styles.onlineIndicator} />
            </View>
            <Text style={styles.headerSub}>Always here for you</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {activeKid ? (
            <View style={styles.kidPill}>
              <Text style={styles.kidPillText}>{activeKid.name}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            onPress={() => setSettingsVisible(true)}
            style={styles.gearBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' || Platform.OS === 'web' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chatContent}
          renderItem={({ item }) => (
            <ChatBubble
              message={item}
              onSave={item.role === 'assistant' && !item.saved ? handleSave : undefined}
            />
          )}
          ListHeaderComponent={
            messages.length === 0 && !isTyping ? (
              <View style={styles.welcomeSection}>
                <GradientAvatar emoji="🤱" size={64} style={styles.welcomeAvatar} />
                <Text style={styles.welcomeText}>
                  Namaste {motherName ? `, ${motherName}` : ''}! 🙏{'\n'}
                  I'm MaaMitra, your personal companion. Ask me anything about your pregnancy,
                  baby, health, or wellbeing.
                </Text>
              </View>
            ) : null
          }
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

        {/* Quick chips when empty */}
        {messages.length === 0 && !isTyping && (
          <QuickChips onSelect={handleSend} />
        )}

        <ChatInput onSend={handleSend} disabled={isTyping} />
      </KeyboardAvoidingView>

      {/* Allergy modal */}
      <AllergyModal visible={allergyModalVisible} onDone={handleAllergyDone} />

      {/* Settings modal */}
      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fdf6ff' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3e8ff',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    boxShadow: '0px 2px 8px rgba(139, 92, 246, 0.06)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gearBtn: { padding: 6 },
  headerInfo: {},
  headerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerName: { fontSize: 17, fontWeight: '700', color: '#1a1a2e' },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  headerSub: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  kidPill: {
    backgroundColor: 'rgba(236,72,153,0.1)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.2)',
  },
  kidPillText: { color: '#ec4899', fontSize: 13, fontWeight: '600' },
  chatContent: {
    paddingHorizontal: 4,
    paddingTop: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  welcomeSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
  },
  welcomeAvatar: { marginBottom: 16 },
  welcomeText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  typingWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingLeft: 8,
    paddingVertical: 4,
  },
  typingAvatar: {},
});
