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
} from '../constants/theme';
import { useProfileStore } from '../store/useProfileStore';
import { useWellnessStore } from '../store/useWellnessStore';
import { useActiveKid } from '../hooks/useActiveKid';

// ─── Demo: proposed new Home with AI Chat as hero + 4-tab bottom bar ───
// Standalone route — open /demo-home to preview. Current tabs untouched.

const FIRST_RUN_KEY = 'maamitra-demo-home-first-run-v1';

export default function DemoHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [firstRunOpen, setFirstRunOpen] = useState(false);

  const { motherName, parentGender } = useProfileStore();
  const { activeKid, ageLabel } = useActiveKid();
  const { todayMood, moodHistory } = useWellnessStore();

  const firstName = (motherName || 'there').split(' ')[0];
  const greetingTitle = firstName === 'there' ? 'Hello' : firstName;
  const parentSalutation =
    parentGender === 'father' ? 'dad' : parentGender === 'other' ? 'parent' : 'mama';

  // Dynamic Today strip — reacts to real profile + wellness state.
  const todayCards = useMemo(
    () => buildTodayCards({ activeKid, ageLabel, todayMood, moodHistory }),
    [activeKid, ageLabel, todayMood, moodHistory]
  );

  // Inbox items — in production these come from notifications/community/vaccine stores.
  const inboxItems = useMemo<InboxItem[]>(
    () => [
      {
        id: '1',
        kind: 'community',
        title: 'Priya replied to your post',
        body: '"Thanks! We tried ragi porridge and it worked wonders."',
        time: '12m',
        unread: true,
      },
      {
        id: '2',
        kind: 'vaccine',
        title: activeKid?.name
          ? `${activeKid.name}'s 9-month vaccine is due in 12 days`
          : '9-month vaccine reminder',
        body: 'Book a slot when you\'re ready.',
        time: '2h',
        unread: true,
      },
      {
        id: '3',
        kind: 'ai',
        title: 'Maamitra followed up on last chat',
        body: 'Did the teething tips help? Tap to continue.',
        time: '1d',
      },
      {
        id: '4',
        kind: 'system',
        title: 'New article in Library',
        body: 'Introducing solids: a gentle 6-week roadmap',
        time: '2d',
      },
    ],
    [activeKid?.name]
  );

  const unreadCount = inboxItems.filter((i) => i.unread).length;

  // First-run hero animation — shown once per install/demo.
  useEffect(() => {
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(FIRST_RUN_KEY);
        if (!seen) setFirstRunOpen(true);
      } catch {}
    })();
  }, []);

  const dismissFirstRun = async () => {
    setFirstRunOpen(false);
    try {
      await AsyncStorage.setItem(FIRST_RUN_KEY, '1');
    } catch {}
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: 160,
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

        {/* HERO: Ask Maamitra AI bar (MMT pattern) */}
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

        {/* Today strip — dynamic */}
        <Text style={styles.sectionLabel}>TODAY</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.todayScroll}
        >
          {todayCards.map((c) => (
            <View
              key={c.id}
              style={[styles.todayCard, { backgroundColor: c.bg }]}
            >
              <Ionicons name={c.icon as any} size={20} color={c.tint} />
              <Text style={styles.todayVal}>{c.value}</Text>
              <Text style={styles.todaySub}>{c.label}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Family snapshot */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Family</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/family')}>
            <Text style={styles.sectionLink}>See all</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          <View style={styles.familyRow}>
            <LinearGradient colors={Gradients.childRose} style={styles.kidAvatar}>
              <Text style={styles.kidInitial}>
                {activeKid?.name?.charAt(0).toUpperCase() ?? 'A'}
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
        </View>

        {/* Community highlight */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>From the community</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/community')}>
            <Text style={styles.sectionLink}>Open</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          <View style={styles.commRow}>
            <View style={styles.commAvatar}>
              <Text style={styles.commInitial}>P</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.commName}>Priya · 2h</Text>
              <Text style={styles.commText} numberOfLines={2}>
                First teeth finally showed up! Any tips for the night wakings that
                came with it? 🦷
              </Text>
              <View style={styles.commMeta}>
                <Ionicons name="heart-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.commMetaTxt}>24</Text>
                <Ionicons
                  name="chatbubble-outline"
                  size={14}
                  color={Colors.textMuted}
                  style={{ marginLeft: 12 }}
                />
                <Text style={styles.commMetaTxt}>8 replies</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Suggested read (Library surfaced as card, no longer a tab) */}
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
              <Text style={styles.readBadgeTxt}>5 MIN READ</Text>
            </View>
            <Text style={styles.readTitle}>
              Introducing solids: a gentle 6-week roadmap
            </Text>
            <Text style={styles.readSub}>From the Maamitra Library</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* ─── Bottom bar: 4 tabs + centered Chat FAB ───────────────────── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom || 10 }]}>
        <TabBtn icon="home" label="Home" active />
        <TabBtn icon="people-outline" label="Family" />
        <View style={{ width: 72 }} />
        <TabBtn icon="heart-circle-outline" label="Connect" />
        <TabBtn icon="leaf-outline" label="Wellness" />
      </View>

      {/* FAB: Ask Maamitra — the hero action */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.fab, { bottom: (insets.bottom || 10) + 18 }]}
        onPress={() => router.push('/(tabs)/chat')}
      >
        <LinearGradient colors={Gradients.primary} style={styles.fabGrad}>
          <Ionicons name="sparkles" size={26} color="#fff" />
        </LinearGradient>
        <Text style={styles.fabLabel}>Ask</Text>
      </TouchableOpacity>

      {/* Profile sheet — opened via avatar tap (no tab needed) */}
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
            <ProfileRow icon="person-outline" label="Edit profile" />
            <ProfileRow icon="notifications-outline" label="Notifications" />
            <ProfileRow icon="lock-closed-outline" label="Privacy" />
            <ProfileRow
              icon="book-outline"
              label="Library"
              sub="All articles & guides"
            />
            <ProfileRow
              icon="medical-outline"
              label="Health records"
              sub="Reports, prescriptions"
            />
            <ProfileRow icon="help-circle-outline" label="Help & support" />
            <ProfileRow icon="log-out-outline" label="Sign out" danger />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Inbox sheet — unified notifications */}
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
              {inboxItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.inboxRow}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.inboxIconWrap,
                      { backgroundColor: inboxIconBg(item.kind) },
                    ]}
                  >
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
              ))}
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
    </View>
  );
}

// ─── Dynamic Today card builder ──────────────────────────────────────
type TodayCard = {
  id: string;
  icon: string;
  tint: string;
  bg: string;
  value: string;
  label: string;
};

function buildTodayCards({
  activeKid,
  ageLabel,
  todayMood,
  moodHistory,
}: {
  activeKid: ReturnType<typeof useActiveKid>['activeKid'];
  ageLabel: string;
  todayMood: any;
  moodHistory: any[];
}): TodayCard[] {
  const cards: TodayCard[] = [];

  // 1. Mood check-in — leads if not logged, or gentle if low recent average
  if (!todayMood) {
    cards.push({
      id: 'mood',
      icon: 'happy-outline',
      tint: Colors.primary,
      bg: '#FFF0F5',
      value: 'Log mood',
      label: 'Not logged yet',
    });
  } else {
    cards.push({
      id: 'mood',
      icon: 'happy-outline',
      tint: Colors.primary,
      bg: '#FFF0F5',
      value: `${todayMood.emoji} ${todayMood.label}`,
      label: 'Today\'s mood',
    });
  }

  // 2. Context-aware kid card based on age
  if (activeKid?.isExpecting) {
    cards.push({
      id: 'pregnancy',
      icon: 'heart-outline',
      tint: Colors.primary,
      bg: '#FFF0F5',
      value: 'Pregnancy tips',
      label: 'For this trimester',
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
      });
    } else if (months < 9) {
      cards.push({
        id: 'solids',
        icon: 'nutrition-outline',
        tint: Colors.primary,
        bg: Colors.bgPink,
        value: 'Start solids',
        label: `${activeKid.name} · ${ageLabel}`,
      });
    } else if (months < 24) {
      cards.push({
        id: 'milestones',
        icon: 'footsteps-outline',
        tint: Colors.primary,
        bg: Colors.bgPink,
        value: 'Milestones',
        label: `${activeKid.name} · ${ageLabel}`,
      });
    } else {
      cards.push({
        id: 'dev',
        icon: 'ribbon-outline',
        tint: Colors.primary,
        bg: Colors.bgPink,
        value: 'Development',
        label: `${activeKid.name} · ${ageLabel}`,
      });
    }
  }

  // 3. Upcoming vaccine (placeholder — in real app, derive from vaccine store)
  cards.push({
    id: 'vaccine',
    icon: 'calendar-outline',
    tint: Colors.textDark,
    bg: Colors.border,
    value: '9mo vaccine',
    label: 'Due in 12 days',
  });

  // 4. Low-mood check-in (only if recent average is low)
  const recent = (moodHistory || []).slice(-3);
  if (recent.length >= 2) {
    const avg = recent.reduce((s, m) => s + m.score, 0) / recent.length;
    if (avg <= 2.5) {
      cards.unshift({
        id: 'gentle',
        icon: 'heart-circle-outline',
        tint: Colors.primary,
        bg: '#FFE7EF',
        value: 'Take a breath',
        label: 'A gentle check-in',
      });
    }
  }

  return cards;
}

// ─── Inbox helpers ────────────────────────────────────────────────────
type InboxKind = 'community' | 'vaccine' | 'ai' | 'system';
type InboxItem = {
  id: string;
  kind: InboxKind;
  title: string;
  body: string;
  time: string;
  unread?: boolean;
};

function inboxIcon(kind: InboxKind): string {
  switch (kind) {
    case 'community': return 'chatbubbles-outline';
    case 'vaccine': return 'medkit-outline';
    case 'ai': return 'sparkles';
    case 'system': return 'newspaper-outline';
  }
}

function inboxIconBg(_kind: InboxKind): string {
  // Simplified palette: one accent bg for all inbox types.
  return Colors.bgPink;
}

function ProfileRow({
  icon,
  label,
  sub,
  danger,
}: {
  icon: string;
  label: string;
  sub?: string;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.profileRow}>
      <View style={styles.profileIconWrap}>
        <Ionicons
          name={icon as any}
          size={20}
          color={danger ? Colors.error : Colors.primary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[styles.profileLabel, danger && { color: Colors.error }]}
        >
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

function TabBtn({
  icon,
  label,
  active,
}: {
  icon: string;
  label: string;
  active?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.tabBtn}>
      <Ionicons
        name={icon as any}
        size={22}
        color={active ? Colors.primary : '#C4B5D4'}
      />
      <Text style={[styles.tabLbl, active && { color: Colors.primary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── First-run hero animation ─────────────────────────────────────────
// Plays a short "type → reply" demo so new users feel the AI magic
// within the first 5 seconds.
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
  const fullQuestion = firstName
    ? `Hi ${parentSalutation}, is my baby ready for solids?`
    : `Hi ${parentSalutation}, is my baby ready for solids?`;

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
      {
        scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }),
      },
    ],
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }),
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.firstRunBackdrop}>
        <View style={styles.firstRunCard}>
          <Text style={styles.firstRunKicker}>WELCOME TO MAAMITRA</Text>
          <Text style={styles.firstRunHeadline}>
            Ask anything. Get warm, personal answers — instantly.
          </Text>

          <Animated.View style={[styles.firstRunDemo, pulseStyle]}>
            <View style={styles.firstRunBubbleUser}>
              <Text style={styles.firstRunUserTxt}>{typed || '\u00A0'}</Text>
              {typed.length < fullQuestion.length && (
                <View style={styles.caret} />
              )}
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
  avatarInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  // Serif reserved for the single display moment on Home.
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
  badgeTxt: {
    color: '#fff',
    fontFamily: Fonts.sansBold,
    fontSize: 10,
  },

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
    width: 140,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: 6,
  },
  todayVal: {
    fontFamily: Fonts.sansBold,
    fontSize: FontSize.lg,
    color: Colors.textDark,
    marginTop: 4,
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
  // Was serif — switched to sans per typography rule (serif is display-only).
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

  // ─── Bottom bar ────────────────────────────────────────────────
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,248,252,0.98)',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
    paddingHorizontal: Spacing.sm,
  },
  tabBtn: { alignItems: 'center', gap: 4, flex: 1 },
  tabLbl: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    color: '#C4B5D4',
  },

  fab: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 2,
  },
  fabGrad: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.lg,
  },
  fabLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    color: Colors.primary,
    marginTop: 2,
  },

  // ─── Profile sheet ─────────────────────────────────────────────
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

  // ─── Inbox sheet ───────────────────────────────────────────────
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

  // ─── First-run hero ────────────────────────────────────────────
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
