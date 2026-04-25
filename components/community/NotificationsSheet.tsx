import React, { useEffect, useRef, useState } from 'react';
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
import { useSocialStore } from '../../store/useSocialStore';
import { type AppNotification, getPublicProfiles } from '../../services/social';
import { Colors } from '../../constants/theme';

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
    case 'message':
      return `${name} sent you a message 💬`;
    case 'moderation':
      // postText is set by hidePost() to the reason citing the breached
      // community guideline. Surface it directly so the author knows
      // exactly why their post was hidden.
      return `🛡️ Your post was hidden by moderation: ${truncate(notif.postText, 140)}`;
    default:
      return `${name} interacted with you`;
  }
}

// ─── Notification Row ─────────────────────────────────────────────────────────

interface NotifRowProps {
  notif: AppNotification;
  handled: 'accepted' | 'declined' | undefined;
  freshName?: string;          // live name from publicProfiles (overrides stored fromName)
  freshPhotoUrl?: string;      // live photo from publicProfiles
  onAccept: () => void;
  onDecline: () => void;
  onPress: () => void;
}

function NotifRow({ notif, handled, freshName, freshPhotoUrl, onAccept, onDecline, onPress }: NotifRowProps) {
  const isUnread = !notif.read;
  const isRequest = notif.type === 'follow_request';
  // Prefer live data from publicProfiles so deleted/recreated accounts show current identity
  const displayName = freshName ?? notif.fromName ?? '?';
  const displayPhoto = freshPhotoUrl ?? notif.fromPhotoUrl;
  // Build a version of the notif with the fresh name so the sentence text is correct too
  const displayNotif = { ...notif, fromName: displayName };

  return (
    <TouchableOpacity
      style={[styles.notifRow, isUnread && styles.notifRowUnread]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Avatar */}
      {displayPhoto ? (
        <Image source={{ uri: displayPhoto }} style={styles.notifAvatar} />
      ) : (
        <GradientAvatar name={displayName} size={44} />
      )}

      {/* Content */}
      <View style={styles.notifContent}>
        <Text style={styles.notifText}>{notifText(displayNotif)}</Text>
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
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    isLoadingNotifs,
    loadNotifications,
    markRead,
    markAllRead,
    acceptRequest,
    declineRequest,
    blockedUids,
  } = useSocialStore();

  // Filter out notifications from blocked users
  const filteredNotifications = (notifications ?? []).filter(
    (n) => !blockedUids.includes(n.fromUid)
  );

  const [handledRequests, setHandledRequests] = useState<Record<string, 'accepted' | 'declined'>>({});
  // Map of uid → {name, photoUrl} fetched live from publicProfiles so stale snapshots
  // (old name/photo frozen at notification-create time) are replaced with current data.
  const [freshProfiles, setFreshProfiles] = useState<Record<string, { name: string; photoUrl: string }>>({});
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

    // Reset handled state so old Accept/Decline badges don't persist
    setHandledRequests({});
    loadNotifications();
    setFreshProfiles({});
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

  // Whenever notifications update, batch-refresh their senders' publicProfiles so the
  // row shows the CURRENT name/photo, not the snapshot frozen at notification-create
  // time. This prevents stale identities (e.g., after a user changed their name/photo
  // or recreated their account on the same UID) from being shown to the recipient.
  useEffect(() => {
    if (!visible || filteredNotifications.length === 0) return;
    const uids = Array.from(new Set(
      filteredNotifications.map((n) => n.fromUid).filter((u) => !!u)
    ));
    if (uids.length === 0) return;
    let cancelled = false;
    getPublicProfiles(uids).then((profs) => {
      if (cancelled) return;
      const map: Record<string, { name: string; photoUrl: string }> = {};
      profs.forEach((p: any) => {
        if (p?.uid) map[p.uid] = { name: p.name ?? '', photoUrl: p.photoUrl ?? '' };
      });
      setFreshProfiles(map);
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, notifications?.length]);

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
      <View style={styles.emptyIconBox}>
        <Ionicons name="notifications-outline" size={26} color={Colors.primary} />
      </View>
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
        {/* Light header — was a dark purple→plum gradient. */}
        <View style={styles.header}>
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
              <Ionicons name="close" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        {isLoadingNotifs ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={filteredNotifications as AppNotification[]}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <NotifRow
                notif={item}
                handled={handledRequests[item.id]}
                freshName={freshProfiles[item.fromUid]?.name || undefined}
                freshPhotoUrl={freshProfiles[item.fromUid]?.photoUrl || undefined}
                onAccept={() => handleAccept(item)}
                onDecline={() => handleDecline(item)}
                onPress={() => {
                  // Mark this specific notification as read immediately on tap
                  // (previous behaviour was to batch mark-all-read on a 1.5s
                  // timer, which meant new notifications arriving after open
                  // weren't marked and the unread dot flickered).
                  if (!item.read) markRead(item.id);
                  if (!item.fromUid || item.fromUid.trim().length === 0) return;

                  // Route by notification type:
                  //   message        → open the conversation thread
                  //   everything else → open the sender's profile
                  if (item.type === 'message') {
                    onClose();
                    router.push({
                      pathname: '/conversation/[uid]',
                      params: { uid: item.fromUid },
                    });
                  } else {
                    onViewProfile(item.fromUid);
                  }
                }}
              />
            )}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={
              filteredNotifications.length === 0
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
    backgroundColor: '#FAFAFB',
  },
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    color: '#1C1033',
    letterSpacing: -0.3,
  },
  badge: {
    backgroundColor: Colors.primary,
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
    borderRadius: 10,
    backgroundColor: '#F5F0FF',
    borderWidth: 1,
    borderColor: '#E5E1EE',
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
  notifAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  notifRowUnread: {
    backgroundColor: 'rgba(28, 16, 51, 0.03)',
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
    backgroundColor: Colors.primary,
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
    backgroundColor: Colors.primary,
    marginTop: 6,
    flexShrink: 0,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 10,
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
