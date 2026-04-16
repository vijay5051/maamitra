import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { useDMStore } from '../../store/useDMStore';
import { getPublicProfile, type UserPublicProfile } from '../../services/social';
import GradientAvatar from '../../components/ui/GradientAvatar';
import { Fonts, Colors } from '../../constants/theme';

// ─── Message Bubble ──────────────────────────────────────────────────────────

function MessageBubble({ text, isMine, time }: { text: string; isMine: boolean; time: Date }) {
  const timeStr = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  if (isMine) {
    return (
      <View style={bubbleStyles.myRow}>
        <LinearGradient
          colors={['#E8487A', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={bubbleStyles.myBubble}
        >
          <Text style={bubbleStyles.myText}>{text}</Text>
          <Text style={bubbleStyles.myTime}>{timeStr}</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={bubbleStyles.otherRow}>
      <View style={bubbleStyles.otherBubble}>
        <Text style={bubbleStyles.otherText}>{text}</Text>
        <Text style={bubbleStyles.otherTime}>{timeStr}</Text>
      </View>
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  myRow: { alignSelf: 'flex-end', maxWidth: '78%', marginVertical: 3, marginRight: 12 },
  myBubble: { borderRadius: 18, borderBottomRightRadius: 4, paddingVertical: 10, paddingHorizontal: 14 },
  myText: { fontFamily: Fonts.sansRegular, fontSize: 15, color: '#ffffff', lineHeight: 21 },
  myTime: { fontFamily: Fonts.sansRegular, fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 4, alignSelf: 'flex-end' },
  otherRow: { alignSelf: 'flex-start', maxWidth: '78%', marginVertical: 3, marginLeft: 12 },
  otherBubble: { backgroundColor: '#ffffff', borderRadius: 18, borderBottomLeftRadius: 4, paddingVertical: 10, paddingHorizontal: 14, shadowColor: '#E8487A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 },
  otherText: { fontFamily: Fonts.sansRegular, fontSize: 15, color: '#1C1033', lineHeight: 21 },
  otherTime: { fontFamily: Fonts.sansRegular, fontSize: 10, color: '#9ca3af', marginTop: 4, alignSelf: 'flex-end' },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ConversationScreen() {
  const { uid: otherUid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const myUid = user?.uid ?? '';

  const {
    activeMessages,
    isLoadingMessages,
    isSending,
    loadMessages,
    sendMessage,
    markRead,
  } = useDMStore();

  const [text, setText] = useState('');
  const [profile, setProfile] = useState<UserPublicProfile | null>(null);
  const listRef = useRef<FlatList>(null);

  // Load other user's profile + messages
  useEffect(() => {
    if (!otherUid) return;
    getPublicProfile(otherUid).then(setProfile);
    loadMessages(otherUid);
    markRead(otherUid);
  }, [otherUid]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (activeMessages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [activeMessages.length]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isSending || !otherUid) return;
    sendMessage(otherUid, profile?.name || 'User', profile?.photoUrl || '', trimmed);
    setText('');
  }, [text, isSending, otherUid, profile, sendMessage]);

  const otherName = profile?.name || 'User';
  const otherPhoto = profile?.photoUrl;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient
        colors={['#1C1033', '#3b1060', '#6d1a7a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
        <View style={styles.headerProfile}>
          {otherPhoto ? (
            <Image source={{ uri: otherPhoto }} style={styles.headerAvatar} />
          ) : (
            <GradientAvatar name={otherName} size={38} />
          )}
          <View>
            <Text style={styles.headerName} numberOfLines={1}>{otherName}</Text>
            {profile?.badge ? (
              <Text style={styles.headerBadge} numberOfLines={1}>{profile.badge}</Text>
            ) : null}
          </View>
        </View>
      </LinearGradient>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 60}
      >
        {isLoadingMessages ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#E8487A" />
          </View>
        ) : activeMessages.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyTitle}>Start the conversation</Text>
            <Text style={styles.emptySubtext}>Say hi to {otherName}!</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={activeMessages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble
                text={item.text}
                isMine={item.senderUid === myUid}
                time={item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt)}
              />
            )}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Input */}
        <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={2000}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!text.trim() || isSending}
            style={[styles.sendBtn, (!text.trim() || isSending) && { opacity: 0.4 }]}
          >
            <LinearGradient
              colors={['#E8487A', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sendBtnGrad}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color="#ffffff" />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8FC' },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerProfile: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  headerName: { fontFamily: Fonts.sansBold, fontSize: 16, color: '#ffffff' },
  headerBadge: { fontFamily: Fonts.sansRegular, fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontFamily: Fonts.sansSemiBold, fontSize: 17, color: '#1C1033' },
  emptySubtext: { fontFamily: Fonts.sansRegular, fontSize: 14, color: '#9ca3af' },
  messageList: { paddingVertical: 12 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#EDE9F6',
    backgroundColor: '#FFF8FC',
  },
  input: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: Fonts.sansRegular,
    color: '#1C1033',
    borderWidth: 1.5,
    borderColor: '#EDE9F6',
    maxHeight: 100,
  },
  sendBtn: { marginBottom: 2 },
  sendBtnGrad: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
