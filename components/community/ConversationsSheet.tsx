import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import GradientAvatar from '../ui/GradientAvatar';
import { Fonts } from '../../constants/theme';
import { useAuthStore } from '../../store/useAuthStore';
import { useDMStore } from '../../store/useDMStore';
import type { DMConversation } from '../../services/messages';

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(date: Date | string | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ─── Conversation Row ────────────────────────────────────────────────────────

function ConversationRow({
  conv,
  myUid,
  onPress,
}: {
  conv: DMConversation;
  myUid: string;
  onPress: () => void;
}) {
  const otherUid = conv.participants.find((p) => p !== myUid) ?? '';
  const otherName = conv.participantNames?.[otherUid] ?? 'User';
  const otherPhoto = conv.participantPhotos?.[otherUid];
  const isUnread = conv.unreadBy?.includes(myUid);
  const isMySend = conv.lastMessageSenderUid === myUid;

  return (
    <TouchableOpacity
      style={[styles.row, isUnread && styles.rowUnread]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {otherPhoto ? (
        <Image source={{ uri: otherPhoto }} style={styles.avatar} />
      ) : (
        <GradientAvatar name={otherName} size={48} />
      )}

      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={[styles.name, isUnread && styles.nameBold]} numberOfLines={1}>
            {otherName}
          </Text>
          <Text style={styles.time}>{relativeTime(conv.lastMessageTime)}</Text>
        </View>
        <Text
          style={[styles.preview, isUnread && styles.previewBold]}
          numberOfLines={1}
        >
          {isMySend ? 'You: ' : ''}{conv.lastMessage || 'Start a conversation'}
        </Text>
      </View>

      {isUnread && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ConversationsSheet({ visible, onClose }: Props) {
  const router = useRouter();
  const { user } = useAuthStore();
  const myUid = user?.uid ?? '';
  const {
    conversations,
    isLoadingConversations,
    loadConversations,
  } = useDMStore();

  useEffect(() => {
    if (visible && myUid) {
      loadConversations();
    }
  }, [visible, myUid]);

  const handleOpenConversation = (conv: DMConversation) => {
    const otherUid = conv.participants.find((p) => p !== myUid) ?? '';
    if (!otherUid) return;
    onClose();
    router.push({ pathname: '/conversation/[uid]', params: { uid: otherUid } });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <LinearGradient
          colors={['#1C1033', '#3b1060', '#6d1a7a']}
          style={styles.header}
        >
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Messages</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Content */}
        {isLoadingConversations ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#E8487A" />
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ConversationRow
                conv={item}
                myUid={myUid}
                onPress={() => handleOpenConversation(item)}
              />
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>💬</Text>
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptySubtext}>
                  Visit a user's profile and tap Message to start a conversation.
                </Text>
              </View>
            }
            contentContainerStyle={
              conversations.length === 0 ? styles.emptyList : styles.list
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8FC' },
  header: {
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    color: '#ffffff',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingVertical: 4 },
  emptyList: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  rowUnread: {
    backgroundColor: 'rgba(232,72,122,0.04)',
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  rowContent: { flex: 1, gap: 3 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontFamily: Fonts.sansMedium,
    fontSize: 15,
    color: '#1C1033',
    flex: 1,
  },
  nameBold: { fontFamily: Fonts.sansBold },
  time: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: '#9ca3af',
    marginLeft: 8,
  },
  preview: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: '#9ca3af',
  },
  previewBold: {
    fontFamily: Fonts.sansMedium,
    color: '#1C1033',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E8487A',
    flexShrink: 0,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 17,
    color: '#1C1033',
    textAlign: 'center',
  },
  emptySubtext: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
});
