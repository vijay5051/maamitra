import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Colors,
  Fonts,
  FontSize,
  Gradients,
  Radius,
  Shadow,
  Spacing,
} from '../../constants/theme';
import { useProfileStore } from '../../store/useProfileStore';
import { useWellnessStore } from '../../store/useWellnessStore';
import { useSocialStore } from '../../store/useSocialStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useActiveKid } from '../../hooks/useActiveKid';
import { useVaccineSchedule } from '../../hooks/useVaccineSchedule';
import { type AppNotification, fetchRecentPosts } from '../../services/social';
import { getUserProfile, saveUserProfile } from '../../services/firebase';
import { ARTICLES, type Article } from '../../data/articles';
import SettingsModal from '../../components/ui/SettingsModal';
import NotificationsSheet from '../../components/community/NotificationsSheet';
import HelpSupportSheet from '../../components/ui/HelpSupportSheet';

// ─── Home (landing) tab ───────────────────────────────────────────────
// Replaces Chat as the post-login landing. AI Chat is the hero (top bar
// + center FAB via the tab layout). Everything else is a scroll section.
//
// Bottom bar + center FAB are rendered by app/(tabs)/_layout.tsx — this
// screen only owns the scrollable content.

const FIRST_RUN_KEY = 'maamitra-home-first-run-v1';

export default function HomeTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [firstRunOpen, setFirstRunOpen] = useState(false);

  // Profile-sheet destinations. These open the existing SettingsModal
  // pre-positioned on the right sub-view, plus the community
  // NotificationsSheet and the new HelpSupportSheet.
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<
    null | 'edit-profile' | 'privacy'
  >(null);

  const { motherName, parentGender } = useProfileStore();
  const { activeKid, ageLabel } = useActiveKid();
  const { todayMood, moodHistory } = useWellnessStore();
  const { user } = useAuthStore();

  // Real notifications from Firestore (reactions, comments, follow
  // requests, messages). Drives both the Home inbox and the unread
  // badge on the mail icon.
  const notifications = useSocialStore((s) => s.notifications);
  const socialUnread = useSocialStore((s) => s.unreadCount);
  const loadNotifications = useSocialStore((s) => s.loadNotifications);
  const markNotifRead = useSocialStore((s) => s.markRead);

  // Vaccine reminders computed from the active kid's DOB + completed map.
  const vaccineSchedule = useVaccineSchedule();

  useEffect(() => {
    if (user?.uid) loadNotifications();
  }, [user?.uid, loadNotifications]);

  const firstName = (motherName || 'there').split(' ')[0];
  const greetingTitle = firstName === 'there' ? 'Hello' : firstName;
  const parentSalutation =
    parentGender === 'father' ? 'dad' : parentGender === 'other' ? 'parent' : 'mama';

  // Latest real community post for the "From the community" card.
  // Falls back to null if no posts exist — the card is hidden in that case.
  const [latestPost, setLatestPost] = useState<any | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchRecentPosts(1)
      .then((res) => {
        if (!cancelled) setLatestPost(res.posts[0] ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Age-personalized article for "Suggested for you". Uses the active kid's
  // age in months (or 0 if expecting) to match against ARTICLES ageMin/ageMax.
  const suggestedArticle = useMemo<Article | null>(() => {
    const now = Date.now();
    let ageMonths = 0;
    if (activeKid && !activeKid.isExpecting && activeKid.dob) {
      ageMonths = Math.max(
        0,
        Math.floor((now - new Date(activeKid.dob).getTime()) / (1000 * 60 * 60 * 24 * 30.44)),
      );
    }
    const match = ARTICLES.find((a) => ageMonths >= a.ageMin && ageMonths <= a.ageMax);
    return match ?? ARTICLES[0] ?? null;
  }, [activeKid]);

  const todayCards = useMemo(
    () => buildTodayCards({ activeKid, ageLabel, todayMood, moodHistory, vaccineSchedule, router }),
    [activeKid, ageLabel, todayMood, moodHistory, vaccineSchedule, router]
  );

  // Merged inbox — real community notifications + computed vaccine
  // reminders. No mocks, no dead clicks; every item has a navigation
  // target resolved in `openInboxItem` below.
  const inboxItems = useMemo<InboxItem[]>(
    () => buildInbox({ notifications, vaccineSchedule, kidName: activeKid?.name }),
    [notifications, vaccineSchedule, activeKid?.name]
  );

  const unreadCount = socialUnread + inboxItems.filter(
    (i) => i.kind === 'vaccine' && i.severity === 'overdue'
  ).length;

  // Route per inbox item. Community notifications navigate to the post
  // (community feed) or conversation; vaccine reminders open Health.
  const openInboxItem = async (item: InboxItem) => {
    setInboxOpen(false);
    if (item.kind === 'vaccine') {
      router.push('/(tabs)/health');
      return;
    }
    if (item.sourceNotif) {
      if (!item.sourceNotif.read && user?.uid) {
        await markNotifRead(item.sourceNotif.id);
      }
      const n = item.sourceNotif;
      if (n.type === 'message' && n.fromUid) {
        router.push({ pathname: '/conversation/[uid]', params: { uid: n.fromUid } });
        return;
      }
      // Reactions/comments/follow — land on the community feed. Opening a
      // specific post would require deeper plumbing; this is better than
      // a dead tap and matches NotificationsSheet's default behavior.
      router.push('/(tabs)/community');
    }
  };

  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        // Per-user check so it doesn't pop on every device. Firestore is the
        // source of truth; local AsyncStorage is a fast-path cache.
        const localKey = `${FIRST_RUN_KEY}-${user.uid}`;
        const seenLocal = await AsyncStorage.getItem(localKey);
        if (seenLocal === '1') return;
        const profile = await getUserProfile(user.uid);
        if (profile?.hasSeenIntro) {
          AsyncStorage.setItem(localKey, '1').catch(() => {});
          return;
        }
        setFirstRunOpen(true);
      } catch {}
    })();
  }, [user?.uid]);

  const dismissFirstRun = async () => {
    setFirstRunOpen(false);
    if (!user?.uid) return;
    try {
      await AsyncStorage.setItem(`${FIRST_RUN_KEY}-${user.uid}`, '1');
      await saveUserProfile(user.uid, { hasSeenIntro: true });
    } catch {}
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: 80,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header row */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => setProfileOpen(true)}
          >
            <LinearGradient colors={Gradients.avatar} style={styles.avatarInner}>
              <Text style={styles.avatarTxt}>
                {firstName.charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetSmall}>Good morning</Text>
            <Text style={styles.greetBig}>{greetingTitle}</Text>
          </View>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setInboxOpen(true)}
          >
            <Ionicons name="mail-outline" size={22} color={Colors.textDark} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* HERO: Ask Maamitra AI bar */}
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.heroWrap}
          onPress={() => router.push('/(tabs)/chat')}
        >
          <LinearGradient
            colors={Gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBorder}
          >
            <View style={styles.heroInner}>
              <View style={styles.heroIcon}>
                <LinearGradient colors={Gradients.avatar} style={styles.heroIconGrad}>
                  <Ionicons name="sparkles" size={16} color="#fff" />
                </LinearGradient>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroLabel}>Ask Maamitra</Text>
                <Text style={styles.heroHint}>
                  {activeKid?.isExpecting
                    ? '"What should I eat in trimester 2?"'
                    : activeKid
                    ? `"Is ${activeKid.name} ready for solids?"`
                    : '"What should I ask first?"'}
                </Text>
              </View>
              <View style={styles.micBtn}>
                <Ionicons name="mic" size={18} color={Colors.primary} />
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Quick actions strip */}
        <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.todayScroll}
        >
          {todayCards.map((c) => (
            <TouchableOpacity
              key={c.id}
              activeOpacity={0.85}
              onPress={c.onPress}
              style={[styles.todayCard, { backgroundColor: c.bg }]}
            >
              <Ionicons name={c.icon as any} size={20} color={c.tint} />
              <Text style={styles.todayVal} numberOfLines={2}>{c.value}</Text>
              <Text style={styles.todaySub} numberOfLines={2}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Family snapshot */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Family</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/family')}>
            <Text style={styles.sectionLink}>See all</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push('/(tabs)/family')}
          style={styles.card}
        >
          <View style={styles.familyRow}>
            <LinearGradient colors={Gradients.childRose} style={styles.kidAvatar}>
              <Text style={styles.kidInitial}>
                {activeKid?.name?.charAt(0).toUpperCase() ?? '+'}
              </Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.kidName}>
                {activeKid?.name ?? 'Add your first child'}
              </Text>
              <Text style={styles.kidSub}>
                {activeKid ? ageLabel : 'Tap to set up'}
              </Text>
            </View>
            {activeKid && (
              <View style={styles.milestonePill}>
                <Text style={styles.milestonePillTxt}>Milestones</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Community highlight — only shown when a real post exists */}
        {latestPost && (() => {
          const created = latestPost.createdAt instanceof Date
            ? latestPost.createdAt
            : new Date(latestPost.createdAt);
          const mins = Math.max(1, Math.floor((Date.now() - created.getTime()) / 60000));
          const ago = mins < 60
            ? `${mins}m`
            : mins < 1440
            ? `${Math.floor(mins / 60)}h`
            : `${Math.floor(mins / 1440)}d`;
          const reactionCount = Object.values(
            (latestPost.reactions ?? {}) as Record<string, number>,
          ).reduce((sum, n) => sum + (n as number), 0);
          const commentCount = latestPost.commentCount ?? 0;
          return (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>From the community</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/community')}>
                  <Text style={styles.sectionLink}>Open</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => router.push('/(tabs)/community')}
                style={styles.card}
              >
                <View style={styles.commRow}>
                  <View style={styles.commAvatar}>
                    <Text style={styles.commInitial}>
                      {(latestPost.authorName ?? '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.commName}>
                      {(latestPost.authorName ?? 'Community member')} · {ago}
                    </Text>
                    <Text style={styles.commText} numberOfLines={2}>
                      {latestPost.text ?? ''}
                    </Text>
                    <View style={styles.commMeta}>
                      <Ionicons name="heart-outline" size={14} color={Colors.textMuted} />
                      <Text style={styles.commMetaTxt}>{reactionCount}</Text>
                      <Ionicons
                        name="chatbubble-outline"
                        size={14}
                        color={Colors.textMuted}
                        style={{ marginLeft: 12 }}
                      />
                      <Text style={styles.commMetaTxt}>
                        {commentCount} {commentCount === 1 ? 'reply' : 'replies'}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </>
          );
        })()}

        {/* Suggested read — personalized by kid age */}
        {suggestedArticle && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Suggested for you</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.readCard}
              onPress={() => router.push('/(tabs)/library')}
            >
              <LinearGradient
                colors={['#FFF8FC', '#FFF0F5']}
                style={styles.readInner}
              >
                <View style={styles.readBadge}>
                  <Text style={styles.readBadgeTxt}>
                    {(suggestedArticle.readTime || '5 min').toUpperCase()} READ
                  </Text>
                </View>
                <Text style={styles.readTitle}>{suggestedArticle.title}</Text>
                <Text style={styles.readSub}>From the Maamitra Library</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Profile sheet */}
      <Modal
        visible={profileOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setProfileOpen(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.sheetOverlay}
          onPress={() => setProfileOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <LinearGradient colors={Gradients.avatar} style={styles.sheetAvatar}>
                <Text style={styles.avatarTxt}>
                  {firstName.charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetName}>{firstName}</Text>
                <Text style={styles.sheetEmail}>
                  {parentGender === 'father'
                    ? 'Dad'
                    : parentGender === 'other'
                    ? 'Parent'
                    : 'Mom'}
                  {activeKid ? ` · ${activeKid.name}` : ''}
                </Text>
              </View>
            </View>
            <ProfileRow
              icon="person-outline"
              label="Edit profile"
              onPress={() => {
                setProfileOpen(false);
                // Small delay so the profile sheet's dismiss animation
                // doesn't interrupt the next modal's open animation.
                setTimeout(() => setSettingsView('edit-profile'), 120);
              }}
            />
            <ProfileRow
              icon="book-outline"
              label="Library"
              sub="All articles & guides"
              onPress={() => {
                setProfileOpen(false);
                router.push('/(tabs)/library');
              }}
            />
            <ProfileRow
              icon="medical-outline"
              label="Health records"
              sub="Reports, prescriptions"
              onPress={() => {
                setProfileOpen(false);
                router.push('/(tabs)/health');
              }}
            />
            <ProfileRow
              icon="notifications-outline"
              label="Notifications"
              sub={
                socialUnread > 0
                  ? `${socialUnread} new notification${socialUnread === 1 ? '' : 's'}`
                  : undefined
              }
              onPress={() => {
                setProfileOpen(false);
                setTimeout(() => setNotifsOpen(true), 120);
              }}
            />
            <ProfileRow
              icon="lock-closed-outline"
              label="Privacy"
              sub="Control what others can see"
              onPress={() => {
                setProfileOpen(false);
                setTimeout(() => setSettingsView('privacy'), 120);
              }}
            />
            <ProfileRow
              icon="help-circle-outline"
              label="Help & support"
              sub="FAQ, email us, send a message"
              onPress={() => {
                setProfileOpen(false);
                setTimeout(() => setHelpOpen(true), 120);
              }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Inbox sheet */}
      <Modal
        visible={inboxOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setInboxOpen(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.sheetOverlay}
          onPress={() => setInboxOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.sheet, { maxHeight: '80%' }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.inboxHeader}>
              <Text style={styles.inboxTitle}>Inbox</Text>
              {unreadCount > 0 && (
                <View style={styles.inboxBadge}>
                  <Text style={styles.inboxBadgeTxt}>{unreadCount} new</Text>
                </View>
              )}
            </View>
            <ScrollView>
              {inboxItems.length === 0 ? (
                <View style={styles.inboxEmpty}>
                  <Ionicons
                    name="mail-open-outline"
                    size={36}
                    color={Colors.textMuted}
                  />
                  <Text style={styles.inboxEmptyTitle}>You're all caught up</Text>
                  <Text style={styles.inboxEmptyBody}>
                    We'll put reactions, replies, and vaccine reminders here as
                    they come in.
                  </Text>
                </View>
              ) : (
                inboxItems.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.inboxRow}
                    activeOpacity={0.7}
                    onPress={() => openInboxItem(item)}
                  >
                    <View style={styles.inboxIconWrap}>
                      <Ionicons
                        name={inboxIcon(item.kind) as any}
                        size={18}
                        color={Colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.inboxTitleRow}>
                        <Text
                          style={[
                            styles.inboxItemTitle,
                            item.unread && { color: Colors.textDark },
                          ]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <Text style={styles.inboxTime}>{item.time}</Text>
                      </View>
                      <Text style={styles.inboxBody} numberOfLines={2}>
                        {item.body}
                      </Text>
                    </View>
                    {item.unread && <View style={styles.inboxDot} />}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* First-run hero animation */}
      <FirstRunHero
        visible={firstRunOpen}
        onDone={dismissFirstRun}
        parentSalutation={parentSalutation}
        firstName={firstName === 'there' ? '' : firstName}
      />

      {/* Settings (used for both Edit profile and Privacy). Single source
          of truth for profile editing + privacy toggles — no duplication. */}
      <SettingsModal
        visible={settingsView !== null}
        onClose={() => setSettingsView(null)}
        initialView={settingsView === 'edit-profile' ? 'edit-profile' : 'main'}
        scrollToPrivacy={settingsView === 'privacy'}
      />

      {/* Community notifications — same sheet used in the Connect tab. */}
      <NotificationsSheet
        visible={notifsOpen}
        onClose={() => setNotifsOpen(false)}
        onViewProfile={(uid) => {
          setNotifsOpen(false);
          if (uid) router.push({ pathname: '/conversation/[uid]', params: { uid } });
        }}
      />

      {/* Help & Support — FAQ + contact form writing to Firestore. */}
      <HelpSupportSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
    </View>
  );
}

// ─── Inbox builder ───────────────────────────────────────────────────
// Merges social notifications (Firestore) with vaccine reminders
// (computed from IAP schedule + kid DOB) into a single feed sorted by
// recency. Called from the memo in HomeTab.

function buildInbox({
  notifications,
  vaccineSchedule,
  kidName,
}: {
  notifications: AppNotification[];
  vaccineSchedule: ReturnType<typeof useVaccineSchedule>;
  kidName: string | undefined;
}): InboxItem[] {
  const items: InboxItem[] = [];

  for (const n of notifications.slice(0, 20)) {
    items.push({
      id: `notif-${n.id}`,
      kind: notifTypeToKind(n.type),
      title: notifTitle(n),
      body: notifBody(n),
      time: relativeShort(n.createdAt),
      sortAt: new Date(n.createdAt).getTime(),
      unread: !n.read,
      sourceNotif: n,
    });
  }

  // Surface up to 3 most-relevant vaccine reminders: overdue + due-soon
  // + the next upcoming (for forward planning).
  const overdue = vaccineSchedule.filter((v) => v.status === 'overdue');
  const dueSoon = vaccineSchedule.filter((v) => v.status === 'due-soon');
  const upcomingNext = vaccineSchedule.find((v) => v.status === 'upcoming');

  const vaccinePicks = [...overdue, ...dueSoon, ...(upcomingNext ? [upcomingNext] : [])]
    .slice(0, 3);

  for (const v of vaccinePicks) {
    const now = new Date();
    const due = v.dueDate ? v.dueDate.getTime() : now.getTime();
    const diffDays = Math.round((due - now.getTime()) / (1000 * 60 * 60 * 24));
    let title = '';
    let body = '';
    if (v.status === 'overdue') {
      title = kidName
        ? `${kidName}'s ${v.name} is overdue`
        : `${v.name} is overdue`;
      body = `Was due ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} ago. Tap to book.`;
    } else if (v.status === 'due-soon') {
      title = kidName
        ? `${kidName}'s ${v.name} is due soon`
        : `${v.name} is due soon`;
      body = `Due in ${diffDays} day${diffDays === 1 ? '' : 's'} (${v.ageLabel}).`;
    } else {
      title = kidName
        ? `Upcoming: ${kidName}'s ${v.name}`
        : `Upcoming: ${v.name}`;
      body = `Around ${v.formattedDate} (${v.ageLabel}).`;
    }
    items.push({
      id: `vaccine-${v.id}`,
      kind: 'vaccine',
      title,
      body,
      time: v.status === 'overdue' ? 'Overdue' : v.formattedDate,
      sortAt: due,
      unread: v.status !== 'upcoming',
      severity: v.status === 'overdue' ? 'overdue' : undefined,
    });
  }

  // Sort by recency for social (descending time) but keep overdue vaccines
  // near the top by using their relative offset.
  return items.sort((a, b) => b.sortAt - a.sortAt);
}

function notifTypeToKind(t: AppNotification['type']): InboxItem['kind'] {
  if (t === 'message') return 'message';
  if (t === 'follow_request' || t === 'follow_accepted') return 'follow';
  return 'community';
}

function notifTitle(n: AppNotification): string {
  const name = n.fromName || 'Someone';
  switch (n.type) {
    case 'reaction':
      return `${name} reacted ${n.emoji ?? '❤️'} to your post`;
    case 'comment':
      return `${name} commented on your post`;
    case 'follow_request':
      return `${name} wants to follow you`;
    case 'follow_accepted':
      return `${name} accepted your follow request`;
    case 'message':
      return `${name} sent you a message`;
    default:
      return `${name} interacted with you`;
  }
}

function notifBody(n: AppNotification): string {
  if (n.type === 'reaction' || n.type === 'comment') {
    return n.postText ? `"${truncate(n.postText, 80)}"` : 'Open the post';
  }
  if (n.type === 'follow_request') return 'Tap to review in Notifications.';
  if (n.type === 'follow_accepted') return 'Say hi or check their profile.';
  if (n.type === 'message') return 'Open the conversation.';
  return '';
}

function truncate(t: string, max: number): string {
  return t.length > max ? t.slice(0, max).trim() + '…' : t;
}

function relativeShort(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ─── Today cards ─────────────────────────────────────────────────────
type TodayCard = {
  id: string;
  icon: string;
  tint: string;
  bg: string;
  value: string;
  label: string;
  onPress?: () => void;
};

function buildTodayCards({
  activeKid,
  ageLabel,
  todayMood,
  moodHistory,
  vaccineSchedule,
  router,
}: {
  activeKid: ReturnType<typeof useActiveKid>['activeKid'];
  ageLabel: string;
  todayMood: any;
  moodHistory: any[];
  vaccineSchedule: ReturnType<typeof useVaccineSchedule>;
  router: ReturnType<typeof useRouter>;
}): TodayCard[] {
  const cards: TodayCard[] = [];
  const goWellness = () => router.push('/(tabs)/wellness');
  const goFamily = () => router.push('/(tabs)/family');
  const goLibrary = () => router.push('/(tabs)/library');
  const goHealth = () => router.push('/(tabs)/health');

  if (!todayMood) {
    cards.push({
      id: 'mood',
      icon: 'happy-outline',
      tint: Colors.primary,
      bg: '#FFF0F5',
      value: 'Log mood',
      label: 'Not logged yet',
      onPress: goWellness,
    });
  } else {
    cards.push({
      id: 'mood',
      icon: 'happy-outline',
      tint: Colors.primary,
      bg: '#FFF0F5',
      value: `${todayMood.emoji} ${todayMood.label}`,
      label: "Today's mood",
      onPress: goWellness,
    });
  }

  if (activeKid?.isExpecting) {
    cards.push({
      id: 'pregnancy',
      icon: 'heart-outline',
      tint: Colors.primary,
      bg: '#FFF0F5',
      value: 'Pregnancy tips',
      label: 'For this trimester',
      onPress: goLibrary,
    });
  } else if (activeKid) {
    const months = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(activeKid.dob).getTime()) /
          (1000 * 60 * 60 * 24 * 30.44)
      )
    );
    if (months < 6) {
      cards.push({
        id: 'newborn',
        icon: 'moon-outline',
        tint: Colors.textDark,
        bg: Colors.border,
        value: 'Sleep tips',
        label: `${activeKid.name} · ${ageLabel}`,
        onPress: goLibrary,
      });
    } else if (months < 9) {
      cards.push({
        id: 'solids',
        icon: 'nutrition-outline',
        tint: Colors.primary,
        bg: Colors.bgPink,
        value: 'Start solids',
        label: `${activeKid.name} · ${ageLabel}`,
        onPress: goLibrary,
      });
    } else if (months < 24) {
      cards.push({
        id: 'milestones',
        icon: 'footsteps-outline',
        tint: Colors.primary,
        bg: Colors.bgPink,
        value: 'Milestones',
        label: `${activeKid.name} · ${ageLabel}`,
        onPress: goFamily,
      });
    } else {
      cards.push({
        id: 'dev',
        icon: 'ribbon-outline',
        tint: Colors.primary,
        bg: Colors.bgPink,
        value: 'Development',
        label: `${activeKid.name} · ${ageLabel}`,
        onPress: goFamily,
      });
    }
  }

  // Next vaccine reminder — uses real IAP schedule + kid DOB. Shows
  // overdue first, then due-soon, then the next upcoming one. Skipped
  // entirely when the kid is expecting or nothing is pending.
  const nextVaccine =
    vaccineSchedule.find((v) => v.status === 'overdue') ??
    vaccineSchedule.find((v) => v.status === 'due-soon') ??
    vaccineSchedule.find((v) => v.status === 'upcoming');
  if (nextVaccine && !activeKid?.isExpecting) {
    const now = Date.now();
    const due = nextVaccine.dueDate ? nextVaccine.dueDate.getTime() : now;
    const days = Math.round((due - now) / (1000 * 60 * 60 * 24));
    const label =
      nextVaccine.status === 'overdue'
        ? `Overdue by ${Math.abs(days)}d`
        : days <= 0
        ? 'Due today'
        : `Due in ${days}d`;
    cards.push({
      id: 'vaccine',
      icon: 'calendar-outline',
      tint: nextVaccine.status === 'overdue' ? Colors.error : Colors.textDark,
      bg: nextVaccine.status === 'overdue' ? '#FEE2E2' : Colors.border,
      value: nextVaccine.name,
      label,
      onPress: goHealth,
    });
  }

  const recent = (moodHistory || []).slice(-3);
  if (recent.length >= 2) {
    const avg = recent.reduce((s: number, m: any) => s + m.score, 0) / recent.length;
    if (avg <= 2.5) {
      cards.unshift({
        id: 'gentle',
        icon: 'heart-circle-outline',
        tint: Colors.primary,
        bg: '#FFE7EF',
        value: 'Take a breath',
        label: 'A gentle check-in',
        onPress: goWellness,
      });
    }
  }

  return cards;
}

// ─── Inbox types ─────────────────────────────────────────────────────
type InboxKind = 'community' | 'vaccine' | 'message' | 'follow' | 'system';
type InboxItem = {
  id: string;
  kind: InboxKind;
  title: string;
  body: string;
  time: string;
  /** Sort key (ms). Vaccine items use dueDate, notifications use createdAt. */
  sortAt: number;
  unread?: boolean;
  /** Present for items derived from a Firestore notification. */
  sourceNotif?: AppNotification;
  severity?: 'overdue';
};

function inboxIcon(kind: InboxKind): string {
  switch (kind) {
    case 'community': return 'chatbubbles-outline';
    case 'vaccine': return 'medkit-outline';
    case 'message': return 'mail-open-outline';
    case 'follow': return 'person-add-outline';
    case 'system': return 'newspaper-outline';
  }
}

function ProfileRow({
  icon,
  label,
  sub,
  danger,
  onPress,
}: {
  icon: string;
  label: string;
  sub?: string;
  danger?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.profileRow} onPress={onPress}>
      <View style={styles.profileIconWrap}>
        <Ionicons
          name={icon as any}
          size={20}
          color={danger ? Colors.error : Colors.primary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.profileLabel, danger && { color: Colors.error }]}>
          {label}
        </Text>
        {sub && <Text style={styles.profileSub}>{sub}</Text>}
      </View>
      {!danger && (
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

// ─── First-run hero ──────────────────────────────────────────────────
function FirstRunHero({
  visible,
  onDone,
  parentSalutation,
  firstName,
}: {
  visible: boolean;
  onDone: () => void;
  parentSalutation: string;
  firstName: string;
}) {
  const [typed, setTyped] = useState('');
  const [showReply, setShowReply] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;
  const fullQuestion = `Hi MaaMitra, is my baby ready for solids?`;

  useEffect(() => {
    if (!visible) {
      setTyped('');
      setShowReply(false);
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(fullQuestion.slice(0, i));
      if (i >= fullQuestion.length) {
        clearInterval(id);
        setTimeout(() => setShowReply(true), 500);
      }
    }, 38);

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();

    return () => clearInterval(id);
  }, [visible, fullQuestion, pulse]);

  const pulseStyle = {
    transform: [
      { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) },
    ],
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }),
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.firstRunBackdrop}>
        <View style={styles.firstRunCard}>
          <Text style={styles.firstRunKicker}>
            {firstName ? `WELCOME, ${firstName.toUpperCase()}` : 'WELCOME TO MAAMITRA'}
          </Text>
          <Text style={styles.firstRunHeadline}>
            Ask anything. Get warm, personal answers — instantly.
          </Text>

          <Animated.View style={[styles.firstRunDemo, pulseStyle]}>
            <View style={styles.firstRunBubbleUser}>
              <Text style={styles.firstRunUserTxt}>{typed || '\u00A0'}</Text>
              {typed.length < fullQuestion.length && <View style={styles.caret} />}
            </View>

            {showReply && (
              <View style={styles.firstRunBubbleAi}>
                <LinearGradient
                  colors={Gradients.avatar}
                  style={styles.firstRunAiIcon}
                >
                  <Ionicons name="sparkles" size={12} color="#fff" />
                </LinearGradient>
                <Text style={styles.firstRunAiTxt}>
                  Around 6 months is the sweet spot. Watch for head control,
                  curiosity when you eat, and losing the tongue-thrust reflex —
                  if two of those are there, you're good to start gently.
                </Text>
              </View>
            )}
          </Animated.View>

          <TouchableOpacity
            style={styles.firstRunCta}
            onPress={onDone}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={Gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.firstRunCtaInner}
            >
              <Text style={styles.firstRunCtaTxt}>Got it — let me try</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={onDone} style={{ marginTop: 10 }}>
            <Text style={styles.firstRunSkip}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgLight },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  avatarInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: {
    color: '#fff',
    fontFamily: Fonts.sansBold,
    fontSize: FontSize.lg,
  },
  greetSmall: {
    fontFamily: Fonts.sansRegular,
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  greetBig: {
    fontFamily: Fonts.serif,
    color: Colors.textDark,
    fontSize: FontSize.xxl,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTxt: { color: '#fff', fontFamily: Fonts.sansBold, fontSize: 10 },

  heroWrap: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
    borderRadius: Radius.xl,
    ...Shadow.md,
  },
  heroBorder: { padding: 1.5, borderRadius: Radius.xl },
  heroInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: Radius.xl - 1.5,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  heroIcon: { width: 32, height: 32 },
  heroIconGrad: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.md,
    color: Colors.textDark,
  },
  heroHint: {
    fontFamily: Fonts.sansRegular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bgPink,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginTop: Spacing.xxl,
    marginLeft: Spacing.xl,
  },
  todayScroll: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  todayCard: {
    width: 160,
    minHeight: 100,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: 6,
  },
  todayVal: {
    fontFamily: Fonts.sansBold,
    fontSize: FontSize.md,
    color: Colors.textDark,
    marginTop: 4,
    lineHeight: 20,
  },
  todaySub: {
    fontFamily: Fonts.sansRegular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xxl,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.lg,
    color: Colors.textDark,
    letterSpacing: -0.1,
  },
  sectionLink: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  card: {
    marginHorizontal: Spacing.xl,
    backgroundColor: '#fff',
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    ...Shadow.card,
  },

  familyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  kidAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kidInitial: {
    color: '#fff',
    fontFamily: Fonts.sansBold,
    fontSize: FontSize.lg,
  },
  kidName: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.base,
    color: Colors.textDark,
  },
  kidSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  milestonePill: {
    backgroundColor: Colors.bgPink,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  milestonePillTxt: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.xs,
    color: Colors.primary,
  },

  commRow: { flexDirection: 'row', gap: Spacing.md },
  commAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDE9F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commInitial: {
    fontFamily: Fonts.sansBold,
    color: Colors.textDark,
    fontSize: FontSize.md,
  },
  commName: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.sm,
    color: Colors.textDark,
  },
  commText: {
    fontFamily: Fonts.sansRegular,
    fontSize: FontSize.md,
    color: Colors.textDark,
    marginTop: 4,
    lineHeight: 20,
  },
  commMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.md,
  },
  commMetaTxt: {
    fontFamily: Fonts.sansRegular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginLeft: 3,
  },

  readCard: {
    marginHorizontal: Spacing.xl,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  readInner: { padding: Spacing.xl, gap: Spacing.sm },
  readBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  readBadgeTxt: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    color: Colors.primary,
    letterSpacing: 1,
  },
  readTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.lg,
    color: Colors.textDark,
    marginTop: 4,
    lineHeight: 24,
  },
  readSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },

  // ─── Sheets ──────────────────────────────────────────────────────
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(28,16,51,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingTop: 10,
    paddingBottom: 30,
    paddingHorizontal: Spacing.xl,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  sheetAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetName: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.xl,
    color: Colors.textDark,
  },
  sheetEmail: {
    fontFamily: Fonts.sansRegular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  profileIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bgPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.md,
    color: Colors.textDark,
  },
  profileSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },

  inboxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  inboxTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.xl,
    color: Colors.textDark,
    flex: 1,
  },
  inboxBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  inboxBadgeTxt: {
    color: '#fff',
    fontFamily: Fonts.sansBold,
    fontSize: 11,
  },
  inboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  inboxIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgPink,
  },
  inboxTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  inboxItemTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.sm,
    color: Colors.textDark,
    flex: 1,
  },
  inboxTime: {
    fontFamily: Fonts.sansRegular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  inboxBody: {
    fontFamily: Fonts.sansRegular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
    lineHeight: 18,
  },
  inboxDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 8,
  },
  inboxEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  inboxEmptyTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.md,
    color: Colors.textDark,
    marginTop: Spacing.sm,
  },
  inboxEmptyBody: {
    fontFamily: Fonts.sansRegular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ─── First-run ───────────────────────────────────────────────────
  firstRunBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(28,16,51,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  firstRunCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: Radius.xxl,
    padding: Spacing.xxl,
  },
  firstRunKicker: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  firstRunHeadline: {
    fontFamily: Fonts.serif,
    fontSize: FontSize.xxl,
    color: Colors.textDark,
    lineHeight: 32,
    marginBottom: Spacing.xl,
  },
  firstRunDemo: {
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    minHeight: 140,
  },
  firstRunBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    maxWidth: '85%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  firstRunUserTxt: {
    color: '#fff',
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.sm,
  },
  caret: {
    width: 2,
    height: 14,
    backgroundColor: '#fff',
    marginLeft: 2,
    opacity: 0.7,
  },
  firstRunBubbleAi: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    maxWidth: '90%',
    flexDirection: 'row',
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  firstRunAiIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  firstRunAiTxt: {
    flex: 1,
    fontFamily: Fonts.sansRegular,
    fontSize: FontSize.sm,
    color: Colors.textDark,
    lineHeight: 20,
  },
  firstRunCta: {
    marginTop: Spacing.xl,
    borderRadius: Radius.full,
    overflow: 'hidden',
    ...Shadow.md,
  },
  firstRunCtaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
  },
  firstRunCtaTxt: {
    color: '#fff',
    fontFamily: Fonts.sansBold,
    fontSize: FontSize.md,
  },
  firstRunSkip: {
    textAlign: 'center',
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
});
