import React from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore, type ChatThread } from '../../store/useChatStore';
import { Fonts } from '../../constants/theme';

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

function previewText(thread: ChatThread): string {
  const last = thread.messages[thread.messages.length - 1];
  if (!last) return 'No messages yet';
  const prefix = last.role === 'user' ? 'You: ' : '';
  return prefix + last.content.replace(/\s+/g, ' ');
}

// ─── Thread Row ──────────────────────────────────────────────────────────────

function ThreadRow({
  thread,
  isActive,
  onPress,
  onRename,
  onDelete,
}: {
  thread: ChatThread;
  isActive: boolean;
  onPress: () => void;
  onRename: (newTitle: string) => void;
  onDelete: () => void;
}) {
  const confirmDelete = () => {
    if (typeof window !== 'undefined') {
      if (window.confirm(`Delete "${thread.title}"?\n\nThis removes all messages in this chat.`)) {
        onDelete();
      }
    } else {
      Alert.alert(
        'Delete chat',
        `Delete "${thread.title}"? This removes all messages in this chat.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: onDelete },
        ]
      );
    }
  };

  const promptRename = () => {
    if (typeof window !== 'undefined') {
      const next = window.prompt('Rename chat', thread.title);
      if (next !== null && next.trim().length > 0) {
        onRename(next.trim());
      }
    } else {
      Alert.prompt?.(
        'Rename chat',
        'Enter a new title',
        (next?: string) => {
          if (next && next.trim().length > 0) onRename(next.trim());
        },
        'plain-text',
        thread.title,
      );
    }
  };

  return (
    <TouchableOpacity
      style={[styles.row, isActive && styles.rowActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.rowIcon}>
        <Ionicons
          name={isActive ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
          size={20}
          color={isActive ? '#7C3AED' : '#7C3AED'}
        />
      </View>

      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={[styles.title, isActive && styles.titleActive]} numberOfLines={1}>
            {thread.title}
          </Text>
          <Text style={styles.time}>{relativeTime(thread.lastMessageAt)}</Text>
        </View>
        <Text style={styles.preview} numberOfLines={1}>
          {previewText(thread)}
        </Text>
      </View>

      <TouchableOpacity
        onPress={promptRename}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.iconBtn}
      >
        <Ionicons name="pencil-outline" size={15} color="#9ca3af" />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={confirmDelete}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.iconBtn}
      >
        <Ionicons name="trash-outline" size={16} color="#d1d5db" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ChatHistorySheet({ visible, onClose }: Props) {
  const {
    threads,
    activeThreadId,
    createThread,
    switchThread,
    deleteThread,
    renameThread,
  } = useChatStore();

  const handleNewChat = () => {
    createThread('New chat');
    onClose();
  };

  const handleOpenThread = (threadId: string) => {
    switchThread(threadId);
    onClose();
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
            <Text style={styles.headerTitle}>Chat History</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* New chat button */}
        <TouchableOpacity style={styles.newChatBtn} onPress={handleNewChat} activeOpacity={0.85}>
          <LinearGradient
            colors={['#7C3AED', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.newChatGrad}
          >
            <Ionicons name="add" size={18} color="#ffffff" />
            <Text style={styles.newChatText}>New chat</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Threads list */}
        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
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
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>No chats yet</Text>
              <Text style={styles.emptySubtext}>
                Tap "New chat" above to start a fresh conversation with MaaMitra.
              </Text>
            </View>
          }
          contentContainerStyle={
            threads.length === 0 ? styles.emptyList : styles.list
          }
          showsVerticalScrollIndicator={false}
        />
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFB' },
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

  newChatBtn: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },
  newChatGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  newChatText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15,
    color: '#ffffff',
  },

  list: { paddingVertical: 4 },
  emptyList: { flex: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  rowActive: {
    backgroundColor: 'rgba(28, 16, 51, 0.03)',
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3EBFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: { flex: 1, gap: 3 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: Fonts.sansMedium,
    fontSize: 15,
    color: '#1C1033',
    flex: 1,
  },
  titleActive: {
    fontFamily: Fonts.sansBold,
    color: '#7C3AED',
  },
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
  deleteBtn: {
    padding: 6,
    marginLeft: 4,
  },
  iconBtn: {
    padding: 6,
    marginLeft: 2,
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
