import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import GradientAvatar from '../ui/GradientAvatar';
import { Fonts } from '../../constants/theme';
import { useSocialStore } from '../../store/useSocialStore';
import { type AppNotification } from '../../services/social';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  onViewProfile: (uid: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(date: Date | string | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function truncate(text: string | undefined, maxLen = 40): string {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}

function notifText(notif: AppNotification): string {
  const name = notif.fromName ?? 'Someone';
  switch (notif.type) {
    case 'reaction':
      return `${name} reacted ${notif.emoji ?? '❤️'} to your post: '${truncate(notif.postText)}'`;
    case 'comment':
      return `${name} commented on your post: '${truncate(notif.postText)}'`;
    case 'follow_request':
      return `${name} wants to follow you`;
    case 'follow_accepted':
      return `${name} accepted your follow request 🎉`;
    default:
      return `${name} interacted with you`;
  }
}

// ─── Notification Row ─────────────────────────────────────────────────────────

interface NotifRowProps {
  notif: AppNotification;
  handled: 'accepted' | 'declined' | undefined;
  onAccept: () => void;
  onDecline: () => void;
  onPress: () => void;
}

function NotifRow({ notif, handled, onAccept, onDecline, onPress }: NotifRowProps) {
  const isUnread = !notif.read;
  const isRequest = notif.type === 'follow_request';

  return (
    <TouchableOpacity
      style={[styles.notifRow, isUnread && styles.notifRowUnread]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Avatar */}
      <GradientAvatar name={notif.fromName ?? '?'} size={44} />

      {/* Content */}
      <View style={styles.notifContent}>
        <Text style={styles.notifText}>{notifText(notif)}</Text>
        <Text style={styles.notifTime}>{relativeTime(notif.createdAt)}</Text>

        {/* Follow request action buttons or result */}
        {isRequest && (
          handled ? (
            <View style={styles.handledBadge}>
              <Text style={styles.handledText}>
                {handled === 'accepted' ? 'Accepted ✓' : 'Declined'}
              </Text>
            </View>
          ) : (
            <View style={styles.requestButtons}>
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={(e) => { e.stopPropagation?.(); onAccept(); }}
              >
                <Text style={styles.acceptBtnText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.declineBtn}
                onPress={(e) => { e.stopPropagation?.(); onDecline(); }}
              >
                <Text style={styles.declineBtnText}>Decline</Text>
              </TouchableOpacity>
            </View>
          )
        )}
      </View>

      {/* Unread dot */}
      {isUnread && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NotificationsSheet({ visible, onClose, onViewProfile }: Props) {
  const {
    notifications,
    unreadCount,
    isLoadingNotifs,
    loadNotifications,
    markAllRead,
    acceptRequest,
    declineRequest,
  } = useSocialStore();

  const [handledRequests, setHandledRequests] = useState<Record<string, 'accepted' | 'declined'>>({});
  const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      // Clear timer when sheet closes
      if (markReadTimerRef.current) {
        clearTimeout(markReadTimerRef.current);
        markReadTimerRef.current = null;
      }
      return;
    }

    loadNotifications();
    // Mark all read after 1.5s so user briefly sees unread state
    markReadTimerRef.current = setTimeout(() => {
      markAllRead();
    }, 1500);

    return () => {
      if (markReadTimerRef.current) {
        clearTimeout(markReadTimerRef.current);
        markReadTimerRef.current = null;
      }
    };
  }, [visible]);

  const handleAccept = (notif: AppNotification) => {
    if (!notif.requestId) return;
    acceptRequest(notif.requestId, notif.fromUid, notif.fromName ?? '', notif.fromPhotoUrl);
    setHandledRequests((prev) => ({ ...prev, [notif.id]: 'accepted' }));
  };

  const handleDecline = (notif: AppNotification) => {
    if (!notif.requestId) return;
    declineRequest(notif.requestId);
    setHandledRequests((prev) => ({ ...prev, [notif.id]: 'declined' }));
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>🔔</Text>
      <Text style={styles.emptyTitle}>No notifications yet</Text>
      <Text style={styles.emptySubtext}>When people interact with your posts or send follow requests, they'll show up here.</Text>
    </View>
  );

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
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>Notifications</Text>
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Content */}
        {isLoadingNotifs ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#E8487A" />
          </View>
        ) : (
          <FlatList
            data={(notifications ?? []) as AppNotification[]}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <NotifRow
                notif={item}
                handled={handledRequests[item.id]}
                onAccept={() => handleAccept(item)}
                onDecline={() => handleDecline(item)}
                onPress={() => {
                  if (item.fromUid) {
                    onViewProfile(item.fromUid);
                  }
                }}
              />
            )}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={
              (!notifications || notifications.length === 0)
                ? styles.emptyListContent
                : styles.listContent
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8FC',
  },
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    color: '#ffffff',
  },
  badge: {
    backgroundColor: '#E8487A',
    borderRadius: 999,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyListContent: {
    flex: 1,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  notifRowUnread: {
    backgroundColor: 'rgba(232,72,122,0.05)',
  },
  notifContent: {
    flex: 1,
    gap: 4,
  },
  notifText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#1C1033',
    lineHeight: 20,
  },
  notifTime: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: '#9ca3af',
  },
  requestButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  acceptBtn: {
    backgroundColor: '#E8487A',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  acceptBtnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: '#ffffff',
  },
  declineBtn: {
    borderWidth: 1,
    borderColor: '#EDE9F6',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  declineBtnText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#6b7280',
  },
  handledBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  handledText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#22c55e',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E8487A',
    marginTop: 6,
    flexShrink: 0,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 48,
  },
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
