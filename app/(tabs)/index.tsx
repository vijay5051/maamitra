import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
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
import { useTeethStore } from '../../store/useTeethStore';
import { useChatStore } from '../../store/useChatStore';
import { useCommunityStore } from '../../store/useCommunityStore';
import { useActiveKid } from '../../hooks/useActiveKid';
import { useVaccineSchedule } from '../../hooks/useVaccineSchedule';
import { TEETH } from '../../data/teeth';
import { type AppNotification, fetchRecentPosts, countProfilesInState } from '../../services/social';
import { saveUserProfile } from '../../services/firebase';
import { ARTICLES, type Article } from '../../data/articles';
import { GOVERNMENT_SCHEMES } from '../../data/schemes';
import { YOGA_SESSIONS } from '../../data/yogaSessions';
import { MILESTONES } from '../../data/milestones';
import SettingsModal from '../../components/ui/SettingsModal';
import NotificationsSheet from '../../components/community/NotificationsSheet';
import ConversationsSheet from '../../components/community/ConversationsSheet';
import HelpSupportSheet from '../../components/ui/HelpSupportSheet';
import { useDMStore } from '../../store/useDMStore';

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
  // Avatar tap opens a quick-access profile hub with shortcuts to
  // Edit Profile, Library, Health records, Notifications, Privacy,
  // Help & Support. Distinct from the header's gear icon which opens
  // the full Settings modal.
  const [profileOpen, setProfileOpen] = useState(false);
  const [firstRunOpen, setFirstRunOpen] = useState(false);

  // Shared sheets — same components the Community tab uses, so users see
  // the same UI for notifications/messages regardless of which tab they
  // access them from. Previously Home had its own bespoke Inbox modal
  // that merged social notifs + vaccine reminders — we dropped it so the
  // user only ever sees one notification surface in the app.
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<
    null | 'main' | 'edit-profile' | 'privacy'
  >(null);

  const { motherName, parentGender, photoUrl, profile, kids } = useProfileStore();
  const { activeKid, ageLabel } = useActiveKid();
  const moodHistory = useWellnessStore((s) => s.moodHistory);

  // Threads + saved answers — drive the Continue-chat and Saved-answers cards
  // without costing a Firestore read. Both already hydrated on login.
  const chatThreads = useChatStore((s) => s.threads);
  const savedAnswers = useChatStore((s) => s.savedAnswers);
  const switchThread = useChatStore((s) => s.switchThread);

  // Community posts cache — used for the "Your Week" digest to count my posts
  // and reactions received. Just reads cached state, no extra fetch.
  const cachedPosts = useCommunityStore((s) => s.posts);
  // Subscribe to the per-kid teeth map so the home Quick Action card stays
  // in sync the moment the user logs a tooth in Health → Teeth.
  const teethByKid = useTeethStore((s) => s.byKid);
  // Derive todayMood from moodHistory reactively — the store's `todayMood`
  // field is only set when logMood is called in the current session, so it's
  // stale after a fresh login / page reload.
  const todayMood = useMemo(() => {
    const t = new Date();
    const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    return moodHistory.find((m: any) => m.date === todayStr) ?? null;
  }, [moodHistory]);
  const { user } = useAuthStore();

  // Real notifications from Firestore (reactions, comments, follow
  // requests, messages). Drives the unread badge on the bell icon.
  const notifications = useSocialStore((s) => s.notifications);
  const socialUnread = useSocialStore((s) => s.unreadCount);
  const loadNotifications = useSocialStore((s) => s.loadNotifications);
  const markNotifRead = useSocialStore((s) => s.markRead);

  // Direct message unread count — drives the badge on the messages icon.
  const unreadDMs = useDMStore((s) => s.unreadTotal);
  const loadDMUnreadCount = useDMStore((s) => s.loadUnreadCount);
  useEffect(() => {
    if (user?.uid) loadDMUnreadCount();
  }, [user?.uid]);

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

  // "Moms near you" count — hits Firestore once, capped at 50. Hidden
  // if the user hasn't set their state yet or no one else is there.
  const [momsInState, setMomsInState] = useState<number>(0);
  useEffect(() => {
    if (!profile?.state || !user?.uid) return;
    let cancelled = false;
    countProfilesInState(profile.state, user.uid)
      .then((n) => { if (!cancelled) setMomsInState(n); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [profile?.state, user?.uid]);

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

  // "Recommended reads" — three age-matched articles (excludes the one
  // shown in the main Suggested card to avoid duplication). Diet field
  // isn't present on articles yet; we use topic as a soft filter: if the
  // user is vegetarian/vegan we deprioritise posts tagged with things like
  // "Non-veg" (currently none in the data, but ready for future content).
  const recommendedArticles = useMemo<Article[]>(() => {
    let ageMonths = 0;
    if (activeKid && !activeKid.isExpecting && activeKid.dob) {
      ageMonths = Math.max(
        0,
        Math.floor((Date.now() - new Date(activeKid.dob).getTime()) / (1000 * 60 * 60 * 24 * 30.44)),
      );
    }
    const diet = profile?.diet;
    const matches = ARTICLES.filter((a) => ageMonths >= a.ageMin && ageMonths <= a.ageMax)
      .filter((a) => a.id !== suggestedArticle?.id);
    // Diet deprioritisation — vegetarian/vegan parents shouldn't see egg/
    // meat weaning content pushed first.
    const tagPriority = (a: Article) => {
      const t = (a.topic || '').toLowerCase();
      if (diet === 'vegetarian' && /non[-\s]?veg|meat|egg/.test(t)) return 1;
      if (diet === 'vegan' && /non[-\s]?veg|meat|egg|dairy|milk/.test(t)) return 1;
      return 0;
    };
    return matches.slice().sort((a, b) => tagPriority(a) - tagPriority(b)).slice(0, 5);
  }, [activeKid, profile?.diet, suggestedArticle?.id]);

  // "Your Week" digest — low-cost client-side aggregation of existing
  // stores. No extra Firestore read.
  const weeklyDigest = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const moodsThisWeek = (moodHistory || []).filter((m: any) => {
      const t = m.date ? new Date(m.date + 'T00:00:00').getTime() : 0;
      return t >= weekAgo;
    });
    const moodAvg = moodsThisWeek.length
      ? moodsThisWeek.reduce((s: number, m: any) => s + (m.score || 0), 0) / moodsThisWeek.length
      : null;
    const vaccinesDone = vaccineSchedule.filter((v) => v.status === 'done').length;
    const vaccinesPending = vaccineSchedule.filter(
      (v) => v.status === 'overdue' || v.status === 'due-soon',
    ).length;
    const myUid = user?.uid;
    const myPostsThisWeek = (cachedPosts || []).filter((p: any) => {
      if (p.authorUid !== myUid) return false;
      const t = p.createdAt instanceof Date ? p.createdAt.getTime() : new Date(p.createdAt).getTime();
      return t >= weekAgo;
    }).length;
    return {
      moodLoggedDays: moodsThisWeek.length,
      moodAvg,
      vaccinesDone,
      vaccinesPending,
      myPostsThisWeek,
      newNotifs: socialUnread,
    };
  }, [moodHistory, vaccineSchedule, cachedPosts, user?.uid, socialUnread]);

  const handleContinueChat = (threadId: string) => {
    switchThread(threadId);
    router.push('/(tabs)/chat');
  };

  const todayCards = useMemo(
    () =>
      buildTodayCards({
        activeKid,
        ageLabel,
        todayMood,
        moodHistory,
        vaccineSchedule,
        teethByKid,
        router,
        chatThreads,
        savedAnswers,
        onContinueChat: handleContinueChat,
        profileState: profile?.state,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeKid, ageLabel, todayMood, moodHistory, vaccineSchedule, teethByKid, router, chatThreads, savedAnswers, profile?.state]
  );

  // Vaccine reminders continue to render inline on the Home body (as
  // Today/Quick-Action cards). We no longer merge them into a bespoke
  // Inbox modal — the bell icon opens the shared NotificationsSheet used
  // everywhere in the app.

  // Intro popup is disabled while we debug sign-in issues. It never auto-opens.
  const setHasSeenIntro = useProfileStore((s) => s.setHasSeenIntro);

  const dismissFirstRun = async () => {
    setFirstRunOpen(false);
    if (!user?.uid) return;
    setHasSeenIntro(true);
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
        {/* Header row. Tapping the avatar takes you to Edit Profile
            (fast path for "change my name/photo"). The right cluster is
            the same triplet used on every tab with a header:
            🔔 Notifications · 💬 Messages · ⚙️ Settings. */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => setProfileOpen(true)}
            accessibilityLabel="Profile menu"
          >
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.avatarPhoto} />
            ) : (
              <LinearGradient colors={Gradients.avatar} style={styles.avatarInner}>
                <Text style={styles.avatarTxt}>
                  {firstName.charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetSmall}>Good morning</Text>
            <Text style={styles.greetBig}>{greetingTitle}</Text>
          </View>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setNotifsOpen(true)}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={22} color={Colors.textDark} />
            {socialUnread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{socialUnread > 9 ? '9+' : socialUnread}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconBtn, { marginLeft: 8 }]}
            onPress={() => setMessagesOpen(true)}
            accessibilityLabel="Messages"
          >
            <Ionicons name="chatbubbles-outline" size={20} color={Colors.textDark} />
            {unreadDMs > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{unreadDMs > 9 ? '9+' : unreadDMs}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconBtn, { marginLeft: 8 }]}
            onPress={() => setSettingsView('main')}
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={22} color={Colors.textDark} />
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
                  {latestPost.authorPhotoUrl ? (
                    <Image
                      source={{ uri: latestPost.authorPhotoUrl }}
                      style={styles.commAvatar}
                    />
                  ) : (
                    <View style={styles.commAvatar}>
                      <Text style={styles.commInitial}>
                        {(latestPost.authorName ?? '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
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

        {/* ── Your week — compact digest of real signals from the past 7d.
            Every tile taps to the matching deep tab. Hidden if everything
            is zero (no meaningful story to tell yet). */}
        {(weeklyDigest.moodLoggedDays > 0 ||
          weeklyDigest.vaccinesDone > 0 ||
          weeklyDigest.vaccinesPending > 0 ||
          weeklyDigest.myPostsThisWeek > 0 ||
          weeklyDigest.newNotifs > 0) && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your week</Text>
            </View>
            <View style={styles.weekGrid}>
              <TouchableOpacity
                style={styles.weekTile}
                activeOpacity={0.85}
                onPress={() => router.push('/(tabs)/wellness')}
              >
                <Text style={styles.weekTileValue}>
                  {weeklyDigest.moodLoggedDays}/7
                </Text>
                <Text style={styles.weekTileLabel}>Mood logged</Text>
                {weeklyDigest.moodAvg !== null && (
                  <Text style={styles.weekTileSub}>
                    Avg {weeklyDigest.moodAvg.toFixed(1)}/5
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.weekTile}
                activeOpacity={0.85}
                onPress={() => router.push('/(tabs)/health')}
              >
                <Text
                  style={[
                    styles.weekTileValue,
                    weeklyDigest.vaccinesPending > 0 && { color: Colors.error },
                  ]}
                >
                  {weeklyDigest.vaccinesDone}
                </Text>
                <Text style={styles.weekTileLabel}>Vaccines done</Text>
                <Text style={styles.weekTileSub}>
                  {weeklyDigest.vaccinesPending > 0
                    ? `${weeklyDigest.vaccinesPending} pending`
                    : 'All caught up'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.weekTile}
                activeOpacity={0.85}
                onPress={() => router.push('/(tabs)/community')}
              >
                <Text style={styles.weekTileValue}>
                  {weeklyDigest.myPostsThisWeek}
                </Text>
                <Text style={styles.weekTileLabel}>Your posts</Text>
                <Text style={styles.weekTileSub}>
                  {weeklyDigest.newNotifs > 0
                    ? `${weeklyDigest.newNotifs} new activity`
                    : 'Share your week'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── Moms near you — only shown when state is set and there's
            at least one other user in that state. */}
        {profile?.state && momsInState > 0 && (
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.nearbyCard}
            onPress={() => router.push('/(tabs)/community')}
          >
            <View style={styles.nearbyIconWrap}>
              <Ionicons name="people-outline" size={22} color="#7C3AED" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nearbyTitle}>
                {momsInState >= 50 ? '50+' : momsInState} {momsInState === 1 ? 'mom' : 'moms'} in {profile.state}
              </Text>
              <Text style={styles.nearbySub}>
                Tap to connect with parents near you
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#b5a9d5" />
          </TouchableOpacity>
        )}

        {/* ── Recommended reads — 3–5 age + diet-filtered articles. */}
        {recommendedArticles.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recommended reads</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/library')}>
                <Text style={styles.sectionLink}>Library</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recReadsScroll}
            >
              {recommendedArticles.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={styles.recReadCard}
                  activeOpacity={0.9}
                  onPress={() => router.push('/(tabs)/library')}
                >
                  <Text style={styles.recReadEmoji}>{a.emoji || '📖'}</Text>
                  <Text style={styles.recReadTitle} numberOfLines={2}>
                    {a.title}
                  </Text>
                  <Text style={styles.recReadMeta}>
                    {(a.readTime || '5 min')} · {a.topic || 'Article'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* ── Quick Jump — icon grid to reach the most commonly-buried
            surfaces in one tap. Every icon is a real destination; if a
            feature doesn't exist yet (e.g. user search needs the
            community sheet), we open the parent tab. */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick jump</Text>
        </View>
        <View style={styles.jumpGrid}>
          <JumpTile
            icon="book-outline"
            label="Library"
            bg="#FFF0F5"
            tint="#E8487A"
            onPress={() => router.push('/(tabs)/library')}
          />
          <JumpTile
            icon="bookmark-outline"
            label="Saved"
            bg="#EDE9F6"
            tint="#7C3AED"
            onPress={() => router.push('/(tabs)/library')}
          />
          <JumpTile
            icon="ribbon-outline"
            label="Schemes"
            bg="#F0FDF4"
            tint="#16A34A"
            onPress={() => router.push({ pathname: '/(tabs)/health', params: { tab: 'schemes' } })}
          />
          <JumpTile
            icon="leaf-outline"
            label="Yoga"
            bg="#F0FDF4"
            tint="#047857"
            onPress={() => router.push('/(tabs)/wellness')}
          />
          <JumpTile
            icon="checkmark-done-outline"
            label="My health"
            bg="#FFF7ED"
            tint="#EA580C"
            onPress={() => router.push({ pathname: '/(tabs)/health', params: { tab: 'my-health' } })}
          />
          <JumpTile
            icon="search-outline"
            label="Find moms"
            bg="#FDF2F8"
            tint="#E8487A"
            onPress={() => router.push('/(tabs)/community')}
          />
        </View>
      </ScrollView>

      {/* Profile hub — quick-access menu opened from the avatar. Grouped
          by intent (You / Content / Activity / Support) for less scanning.
          Edit Profile, Privacy and Notifications still live in Settings
          too; this is the shortcut surface, not a duplicate. */}
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
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.sheetAvatarPhoto} />
              ) : (
                <LinearGradient colors={Gradients.avatar} style={styles.sheetAvatar}>
                  <Text style={styles.avatarTxt}>
                    {firstName.charAt(0).toUpperCase()}
                  </Text>
                </LinearGradient>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetName}>{motherName || firstName}</Text>
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

            {/* You */}
            <Text style={styles.sheetSectionLabel}>You</Text>
            <ProfileRow
              icon="person-outline"
              label="Edit profile"
              sub="Name, photo, bio, children"
              onPress={() => {
                setProfileOpen(false);
                setTimeout(() => setSettingsView('edit-profile'), 120);
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

            {/* Content */}
            <Text style={styles.sheetSectionLabel}>Content</Text>
            <ProfileRow
              icon="book-outline"
              label="Library"
              sub="Articles & guides"
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

            {/* Activity */}
            <Text style={styles.sheetSectionLabel}>Activity</Text>
            <ProfileRow
              icon="notifications-outline"
              label="Notifications"
              sub={
                socialUnread > 0
                  ? `${socialUnread} new notification${socialUnread === 1 ? '' : 's'}`
                  : 'Reactions, comments, follows'
              }
              onPress={() => {
                setProfileOpen(false);
                setTimeout(() => setNotifsOpen(true), 120);
              }}
            />
            <ProfileRow
              icon="chatbubbles-outline"
              label="Messages"
              sub={unreadDMs > 0 ? `${unreadDMs} unread` : 'Direct messages'}
              onPress={() => {
                setProfileOpen(false);
                setTimeout(() => setMessagesOpen(true), 120);
              }}
            />

            {/* Support */}
            <Text style={styles.sheetSectionLabel}>Support</Text>
            <ProfileRow
              icon="help-circle-outline"
              label="Help & support"
              sub="FAQ, email us, send a message"
              onPress={() => {
                setProfileOpen(false);
                setTimeout(() => setHelpOpen(true), 120);
              }}
            />
            <ProfileRow
              icon="settings-outline"
              label="All settings"
              sub="Full settings, sign out, delete account"
              onPress={() => {
                setProfileOpen(false);
                setTimeout(() => setSettingsView('main'), 120);
              }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Messages sheet — shared with Community tab so users see the
          same DM list regardless of entry point. */}
      <ConversationsSheet
        visible={messagesOpen}
        onClose={() => setMessagesOpen(false)}
      />

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
  teethByKid,
  router,
  chatThreads,
  savedAnswers,
  onContinueChat,
  profileState,
}: {
  activeKid: ReturnType<typeof useActiveKid>['activeKid'];
  ageLabel: string;
  todayMood: any;
  moodHistory: any[];
  vaccineSchedule: ReturnType<typeof useVaccineSchedule>;
  teethByKid: Record<string, Record<string, { state: string; eruptDate?: string; shedDate?: string }>>;
  router: ReturnType<typeof useRouter>;
  chatThreads: Array<{ id: string; title: string; messages: any[]; lastMessageAt: Date | string }>;
  savedAnswers: any[];
  onContinueChat: (threadId: string) => void;
  profileState: string | undefined;
}): TodayCard[] {
  const cards: TodayCard[] = [];
  const goWellness = () => router.push('/(tabs)/wellness');
  const goFamily = () => router.push('/(tabs)/family');
  const goLibrary = () => router.push('/(tabs)/library');
  const goHealth = () => router.push('/(tabs)/health');
  const goTeeth = () => router.push({ pathname: '/(tabs)/health', params: { tab: 'teeth' } });

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

  // ── Teething card (personalised per kid) ───────────────────────────
  // Only appears when there's something useful to surface for this kid:
  //   • 4-7 mo with no teeth logged → "Watch for first tooth" prompt
  //   • 8-15 mo with no teeth logged → "Log first tooth?" prompt
  //   • some teeth erupted, not all 20 → live progress with next-tooth hint
  //   • ≥15 mo with zero teeth → late-eruption nudge (warning tint)
  //   • ≥5 yr → shedding focus (uses shed count)
  //   • all 20 erupted, none shed, age <5yr → silent (don't add card)
  if (activeKid && !activeKid.isExpecting && activeKid.dob) {
    const months = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(activeKid.dob).getTime()) /
          (1000 * 60 * 60 * 24 * 30.44),
      ),
    );
    const kidTeeth = teethByKid[activeKid.id] ?? {};
    const eruptedCount = Object.values(kidTeeth).filter((e) => e?.state === 'erupted').length;
    const shedCount = Object.values(kidTeeth).filter((e) => e?.state === 'shed').length;
    const ageYears = months / 12;

    let teethCard: TodayCard | null = null;

    if (months >= 4 && months < 8 && eruptedCount === 0) {
      teethCard = {
        id: 'teeth',
        icon: 'happy-outline',
        tint: Colors.primary,
        bg: '#FFF0F5',
        value: 'First tooth soon',
        label: `${activeKid.name} · ${ageLabel}`,
        onPress: goTeeth,
      };
    } else if (months >= 8 && months < 15 && eruptedCount === 0) {
      teethCard = {
        id: 'teeth',
        icon: 'happy-outline',
        tint: Colors.primary,
        bg: '#FFF0F5',
        value: 'Log first tooth',
        label: `${activeKid.name} · ${ageLabel}`,
        onPress: goTeeth,
      };
    } else if (months >= 15 && eruptedCount === 0 && ageYears < 5) {
      // Late-eruption nudge (mention to paediatrician at next visit).
      teethCard = {
        id: 'teeth',
        icon: 'alert-circle-outline',
        tint: Colors.error,
        bg: '#FFF7ED',
        value: 'Late tooth?',
        label: `${activeKid.name} · ${ageLabel}`,
        onPress: goTeeth,
      };
    } else if (eruptedCount > 0 && eruptedCount < TEETH.length && ageYears < 5) {
      // Mid-journey: show live progress; surface the next typical tooth so
      // it feels personal, not just a counter.
      const nextTooth = TEETH
        .filter((t) => !kidTeeth[t.id] || kidTeeth[t.id]?.state === 'not-erupted')
        .sort((a, b) => a.eruptMinMo - b.eruptMinMo)[0];
      teethCard = {
        id: 'teeth',
        icon: 'happy-outline',
        tint: Colors.primary,
        bg: '#FFF0F5',
        value: `${eruptedCount}/${TEETH.length} teeth`,
        label: nextTooth ? `Next: ${nextTooth.shortName.toLowerCase()}` : `${activeKid.name} · ${ageLabel}`,
        onPress: goTeeth,
      };
    } else if (ageYears >= 5 && shedCount === 0 && eruptedCount > 0) {
      // First baby tooth shedding window opens around 5-6.
      teethCard = {
        id: 'teeth',
        icon: 'sparkles-outline',
        tint: Colors.primary,
        bg: '#FFF0F5',
        value: 'Shedding soon',
        label: `${activeKid.name} · ${ageLabel}`,
        onPress: goTeeth,
      };
    } else if (ageYears >= 5 && shedCount > 0 && shedCount < TEETH.length) {
      teethCard = {
        id: 'teeth',
        icon: 'sparkles-outline',
        tint: Colors.primary,
        bg: '#FFF0F5',
        value: `${shedCount}/${TEETH.length} shed`,
        label: `${activeKid.name} · ${ageLabel}`,
        onPress: goTeeth,
      };
    }

    if (teethCard) cards.push(teethCard);
  }

  // ── Continue AI chat ────────────────────────────────────────────────
  // Surface the most-recently-active thread if the user has at least one
  // with real conversation. Skips empty "new chat" placeholders.
  const liveThreads = (chatThreads || [])
    .filter((t) => (t.messages?.length ?? 0) > 1) // >1 to skip lone greeting
    .slice()
    .sort((a, b) => {
      const at = a.lastMessageAt ? new Date(a.lastMessageAt as any).getTime() : 0;
      const bt = b.lastMessageAt ? new Date(b.lastMessageAt as any).getTime() : 0;
      return bt - at;
    });
  if (liveThreads[0]) {
    const t = liveThreads[0];
    const title = (t.title || 'Recent chat').slice(0, 28);
    cards.push({
      id: 'continue-chat',
      icon: 'chatbubble-ellipses-outline',
      tint: Colors.primary,
      bg: '#EDE9F6',
      value: 'Continue',
      label: title,
      onPress: () => onContinueChat(t.id),
    });
  }

  // ── Saved answers ──────────────────────────────────────────────────
  // Only show when there's something to return to. Routes to Library
  // where the Saved sub-tab lives.
  if ((savedAnswers?.length ?? 0) > 0) {
    cards.push({
      id: 'saved',
      icon: 'bookmark-outline',
      tint: Colors.primary,
      bg: '#FFF0F5',
      value: `${savedAnswers.length} saved`,
      label: 'AI answers',
      onPress: goLibrary,
    });
  }

  // ── Scheme for you ─────────────────────────────────────────────────
  // State × stage matcher. Prefers the scheme whose tags overlap with
  // the user's current life stage. Falls back to a generic maternal
  // scheme when no kid is set yet.
  const stageTag = activeKid?.isExpecting
    ? 'pregnant'
    : activeKid && !activeKid.isExpecting
    ? 'newborn'
    : 'pregnant';
  const girlTag = activeKid?.gender === 'girl' ? 'girl' : null;
  const candidateScheme =
    GOVERNMENT_SCHEMES.find((s) => girlTag && s.tags.includes(girlTag)) ??
    GOVERNMENT_SCHEMES.find((s) => s.tags.includes(stageTag)) ??
    GOVERNMENT_SCHEMES.find((s) => s.tags.includes('all'));
  if (candidateScheme) {
    cards.push({
      id: 'scheme',
      icon: 'ribbon-outline',
      tint: Colors.textDark,
      bg: '#F0FDF4',
      value: candidateScheme.shortName,
      label: profileState ? `Scheme · ${profileState}` : 'A scheme for you',
      onPress: () => router.push({ pathname: '/(tabs)/health', params: { tab: 'schemes' } }),
    });
  }

  // ── Yoga pick ──────────────────────────────────────────────────────
  // Mood dip → Stress Relief. New mom (<6mo kid) → Baby & Me Bonding.
  // Pregnant → Morning Stretch. Otherwise → Sleep Better.
  if (YOGA_SESSIONS.length > 0) {
    const recentForYoga = (moodHistory || []).slice(0, 3);
    const avgMood = recentForYoga.length >= 2
      ? recentForYoga.reduce((s: number, m: any) => s + m.score, 0) / recentForYoga.length
      : null;
    const kidMonths = activeKid && !activeKid.isExpecting && activeKid.dob
      ? Math.max(0, Math.floor((Date.now() - new Date(activeKid.dob).getTime()) / (1000 * 60 * 60 * 24 * 30.44)))
      : null;
    let pickId = 'y01';
    if (avgMood !== null && avgMood <= 2.5) pickId = 'y04';         // Stress Relief
    else if (activeKid?.isExpecting) pickId = 'y01';                 // Morning Stretch
    else if (kidMonths !== null && kidMonths < 12) pickId = 'y03';   // Baby & Me
    else pickId = 'y05';                                             // Sleep Better
    const pick = YOGA_SESSIONS.find((y) => y.id === pickId) ?? YOGA_SESSIONS[0];
    if (pick) {
      cards.push({
        id: 'yoga',
        icon: 'leaf-outline',
        tint: '#047857',
        bg: '#F0FDF4',
        value: pick.name.length > 20 ? pick.name.slice(0, 18) + '…' : pick.name,
        label: `${pick.duration} min · ${pick.level}`,
        onPress: goWellness,
      });
    }
  }

  // ── Today's milestone ──────────────────────────────────────────────
  // Nearest upcoming milestone for the active kid based on age in months.
  if (activeKid && !activeKid.isExpecting && activeKid.dob) {
    const months = Math.max(0, Math.floor((Date.now() - new Date(activeKid.dob).getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
    const upcoming = MILESTONES.find((m) => m.ageMonths >= months && m.ageMonths <= months + 3);
    if (upcoming) {
      cards.push({
        id: 'milestone',
        icon: 'sparkles-outline',
        tint: Colors.primary,
        bg: '#FFF0F5',
        value: upcoming.title.length > 22 ? upcoming.title.slice(0, 20) + '…' : upcoming.title,
        label: `${upcoming.emoji} ${upcoming.ageLabel}`,
        onPress: goFamily,
      });
    }
  }

  // moodHistory is sorted newest-first in the store, so slice(0, 3) gets the
  // 3 most recent entries (previous slice(-3) was returning the OLDEST 3
  // — wrong signal for the "take a breath" check-in).
  const recent = (moodHistory || []).slice(0, 3);
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

// ─── Jump Tile ───────────────────────────────────────────────────────
// Small tappable square used by the "Quick jump" grid at the bottom of
// Home. Each tile is a shortcut to a surface that previously required
// 2–3 taps to reach (Library → Saved, Health → Schemes, etc.).
function JumpTile({
  icon,
  label,
  bg,
  tint,
  onPress,
}: {
  icon: string;
  label: string;
  bg: string;
  tint: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.jumpTile, { backgroundColor: bg }]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <Ionicons name={icon as any} size={22} color={tint} />
      <Text style={[styles.jumpTileLabel, { color: tint }]}>{label}</Text>
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
  avatarPhoto: { width: 44, height: 44, borderRadius: 22 },
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

  // ─── Your Week digest ────────────────────────────────────────────
  weekGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: Spacing.md,
  },
  weekTile: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 88,
  },
  weekTileValue: {
    fontFamily: Fonts.sansBold,
    fontSize: 22,
    color: Colors.textDark,
    letterSpacing: -0.5,
  },
  weekTileLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: Colors.textDark,
    marginTop: 4,
  },
  weekTileSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },

  // ─── Moms near you ───────────────────────────────────────────────
  nearbyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#ede9fe',
  },
  nearbyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#faf5ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    color: Colors.textDark,
  },
  nearbySub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },

  // ─── Recommended reads ───────────────────────────────────────────
  recReadsScroll: {
    paddingVertical: 4,
    paddingRight: 16,
    gap: 10,
  },
  recReadCard: {
    width: 170,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 10,
  },
  recReadEmoji: {
    fontSize: 22,
    marginBottom: 6,
  },
  recReadTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: Colors.textDark,
    lineHeight: 18,
    minHeight: 36,
  },
  recReadMeta: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 8,
  },

  // ─── Quick Jump grid ─────────────────────────────────────────────
  jumpGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: Spacing.md,
  },
  jumpTile: {
    width: '31%',
    aspectRatio: 1.3,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  jumpTileLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    textAlign: 'center',
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
  sheetAvatarPhoto: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  sheetSectionLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
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
