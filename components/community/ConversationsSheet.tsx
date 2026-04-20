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
import { Colors } from '../../constants/theme';

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
        {/* Light header — was a dark purple→plum gradient that clashed
            with the rest of the refreshed UI. Plain light section now. */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Messages</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        {isLoadingConversations ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
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
                <View style={styles.emptyIconBox}>
                  <Ionicons name="chatbubbles-outline" size={26} color={Colors.primary} />
                </View>
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
  container: { flex: 1, backgroundColor: '#FAFAFB' },
  header: {
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDF5',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    color: '#1C1033',
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F5F0FF',
    borderWidth: 1,
    borderColor: '#E5E1EE',
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
    backgroundColor: 'rgba(28, 16, 51, 0.024)',
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
    backgroundColor: Colors.primary,
    flexShrink: 0,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 16,
    color: '#1C1033',
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  emptySubtext: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
