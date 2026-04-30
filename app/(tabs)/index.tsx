import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
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
import { useFoodTrackerStore } from '../../store/useFoodTrackerStore';
import { useGrowthStore, sleepDurationMinutes, formatDuration } from '../../store/useGrowthStore';
import { useChatStore } from '../../store/useChatStore';
import { useCommunityStore } from '../../store/useCommunityStore';
import { useActiveKid } from '../../hooks/useActiveKid';
import { useVaccineSchedule } from '../../hooks/useVaccineSchedule';
import { TEETH } from '../../data/teeth';
import { BABY_FOODS, isAllowedForDiet } from '../../data/babyFoods';
import { type AppNotification, fetchRecentPosts } from '../../services/social';
import { saveUserProfile } from '../../services/firebase';
import { ARTICLES, type Article } from '../../data/articles';
import { GOVERNMENT_SCHEMES } from '../../data/schemes';
import { YOGA_SESSIONS } from '../../data/yogaSessions';
import { MILESTONES } from '../../data/milestones';
import { filterByAudience, parentGenderToAudience } from '../../data/audience';
import SettingsModal from '../../components/ui/SettingsModal';
import NotificationsSheet from '../../components/community/NotificationsSheet';
import ConversationsSheet from '../../components/community/ConversationsSheet';
import HelpSupportSheet from '../../components/ui/HelpSupportSheet';
import AppBannerStrip from '../../components/ui/AppBannerStrip';
import MicroSurveyModal from '../../components/feedback/MicroSurveyModal';
import { MICRO_SURVEYS, type MicroSurvey } from '../../lib/microSurveys';
import { submitMicroSurvey } from '../../services/feedback';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import AnimatedNumber from '../../components/ui/AnimatedNumber';
import { Illustration } from '../../components/ui/Illustration';
import type { IllustrationName } from '../../lib/illustrations';
import { affirmationForDate } from '../../data/affirmations';
import { getTimeOfDay } from '../../lib/timeOfDay';

// Quick-action card id → brand illustration. Cards without a mapping fall back
// to the existing Lucide/Ionicons glyph. Keep this small — over-illustrated
// quick-action grids feel busy.
const QUICK_ILLUS: Partial<Record<string, IllustrationName>> = {
  newborn: 'quickSleep',
  solids: 'quickDiet',
  foods: 'quickDiet',
  vaccine: 'quickVaccines',
  scheme: 'quickSchemes',
  milestone: 'quickMilestones',
  dev: 'quickMilestones',
};
import Reanimated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSequence,
  withTiming,
  withSpring,
  runOnJS,
  Easing as REasing,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useDMStore } from '../../store/useDMStore';
import { useFeedbackStore } from '../../store/useFeedbackStore';

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
  // Quick Actions cap at 6 by default — collapses long card lists so the
  // home screen doesn't get pushed too far down. "Show all" reveals the
  // rest. Resets when the underlying card list shrinks back to ≤6.
  const [quickActionsExpanded, setQuickActionsExpanded] = useState(false);

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
  const activeKidId = useProfileStore((s) => s.activeKidId);
  const setActiveKidId = useProfileStore((s) => s.setActiveKidId);
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
  // Same for the per-kid food tracker (Health → Foods sub-tab).
  const foodsByKid = useFoodTrackerStore((s) => s.byKid);
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
  const greetingSalutation = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);
  const parentSalutation =
    parentGender === 'father' ? 'dad' : parentGender === 'other' ? 'parent' : 'mama';

  // Daily affirmation — rotates once per local day via day-of-year index.
  // Stable for the entire session so it doesn't flicker on re-render.
  const affirmationToday = useMemo(() => affirmationForDate(), []);

  // Time-of-day hero — picks one of three home-hero variants based on the
  // local hour. Computed once at mount; stable for the session so a user
  // who keeps the app open through dusk doesn't see the hero swap mid-use.
  const heroName = useMemo<IllustrationName>(() => {
    const tod = getTimeOfDay();
    if (tod === 'morning') return 'homeHeroMorning';
    if (tod === 'afternoon') return 'homeHeroAfternoon';
    return 'homeHeroEvening';
  }, []);

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

  // The "moms in state" count + tile lives on the Community tab now.
  // (Removed from Home so users encounter it where the action lands.)

  // Suggested article — personalised by stage × age × recent mood. The
  // previous implementation just picked the first article whose ageMin/
  // ageMax bracketed the kid's age, which meant a pregnant user with
  // ageMonths=0 got whatever happened to be first in the list (often
  // a newborn sleep piece). Now we score each candidate and pick the
  // best match for the parent's current life moment.
  const suggestedArticle = useMemo<Article | null>(() => {
    let ageMonths = 0;
    let isExpecting = false;
    if (activeKid) {
      isExpecting = !!activeKid.isExpecting;
      if (!isExpecting && activeKid.dob) {
        ageMonths = Math.max(
          0,
          Math.floor((Date.now() - new Date(activeKid.dob).getTime()) / (1000 * 60 * 60 * 24 * 30.44)),
        );
      }
    }

    // Topic priorities for the parent's current life stage. Higher is
    // better. Topics not listed get score 0 (still eligible as fallback).
    let priority: Record<string, number> = {};
    if (isExpecting) {
      priority = { Pregnancy: 10, Nutrition: 6, 'Mental Health': 5, Sleep: 3 };
    } else if (ageMonths < 6) {
      priority = { Sleep: 10, Feeding: 8, Development: 6, 'Mental Health': 5 };
    } else if (ageMonths < 12) {
      priority = { Feeding: 10, Development: 7, Sleep: 6, Nutrition: 6 };
    } else if (ageMonths < 24) {
      priority = { Development: 10, Nutrition: 7, Feeding: 6, Behaviour: 6 };
    } else if (ageMonths < 60) {
      priority = { Development: 10, Behaviour: 9, Nutrition: 6, Feeding: 4 };
    } else {
      priority = { Development: 9, Behaviour: 9, Nutrition: 5 };
    }

    // If the parent's recent mood is low, surface a Mental Health piece.
    // Same signal the "Take a breath" Quick Action uses.
    const recentMoods = (moodHistory || []).slice(0, 3);
    if (recentMoods.length >= 2) {
      const avg = recentMoods.reduce((s: number, m: any) => s + (m.score || 0), 0) / recentMoods.length;
      if (avg <= 2.5) priority['Mental Health'] = 11; // bumps above all else
    }

    // Deprioritise diet-inappropriate content.
    const diet = profile?.diet;
    const isIncompatibleDiet = (a: Article): boolean => {
      const t = `${a.topic} ${a.tag} ${a.title}`.toLowerCase();
      if (diet === 'vegetarian' && /non[-\s]?veg|meat|chicken|fish|mutton/.test(t)) return true;
      if (diet === 'vegan' && /non[-\s]?veg|meat|chicken|fish|mutton|dairy|paneer|ghee/.test(t)) return true;
      return false;
    };

    // Candidates must fit the age range AND the viewer's audience (role).
    // filterByAudience is a no-op while ENABLE_ROLE_ADAPTIVE_CONTENT is off
    // in data/audience.ts, so behaviour is unchanged until content starts
    // getting tagged and the flag flips.
    const audienceOk = filterByAudience(
      ARTICLES,
      parentGenderToAudience(useProfileStore.getState().parentGender),
    );
    const candidates = audienceOk.filter(
      (a) => ageMonths >= a.ageMin && ageMonths <= a.ageMax,
    );
    // No age-appropriate article? Return null so the Discover card is hidden
    // entirely. Previously we fell back to ARTICLES[0], which surfaced
    // unrelated content (e.g. a newborn-sleep piece for a 4-year-old) and
    // also explains why tapping it landed in an empty Library — that
    // article id was filtered out by Library's own age gate.
    if (candidates.length === 0) return null;

    // Score and pick the best. Ties broken by narrower age range (more
    // specific = more personalised). Diet-incompatible articles take a
    // big penalty but aren't eliminated entirely.
    const scored = candidates.map((a) => {
      const topicScore = priority[a.topic] ?? 0;
      const rangeWidth = a.ageMax - a.ageMin;
      const specificity = Math.max(0, 36 - rangeWidth) / 10; // narrower = better
      const dietPenalty = isIncompatibleDiet(a) ? -5 : 0;
      return { a, score: topicScore + specificity + dietPenalty };
    });
    scored.sort((x, y) => y.score - x.score);
    return scored[0].a;
  }, [activeKid, moodHistory, profile?.diet]);

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
    // Role-adaptive: only recommend content for the viewer's audience.
    const audienceOk = filterByAudience(
      ARTICLES,
      parentGenderToAudience(useProfileStore.getState().parentGender),
    );
    const matches = audienceOk
      .filter((a) => ageMonths >= a.ageMin && ageMonths <= a.ageMax)
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

  // ─── Profile sheet swipe-down-to-dismiss ──────────────────────────────
  // Shared value drives the sheet's translateY. Reset to 0 whenever the
  // sheet is opened so it slides in cleanly. A vertical pan gesture drags
  // it; releasing past 100px or with velocity >500 dismisses, otherwise
  // springs back.
  const profileSheetY = useSharedValue(0);
  useEffect(() => {
    if (profileOpen) profileSheetY.value = 0;
  }, [profileOpen]);
  const profileSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: profileSheetY.value }],
  }));
  const dismissProfileSheet = () => setProfileOpen(false);
  const profileSheetPan = Gesture.Pan()
    // Only respond to a clearly downward drag — tapping a ProfileRow
    // should not get captured. failOffsetX prevents horizontal swipes
    // from stealing the gesture.
    .activeOffsetY(12)
    .failOffsetX([-20, 20])
    .onUpdate((e) => {
      // Clamp to downward only — no rubber-banding upward.
      profileSheetY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      const shouldClose = e.translationY > 100 || e.velocityY > 500;
      if (shouldClose) {
        profileSheetY.value = withTiming(600, { duration: 180 }, () => {
          runOnJS(dismissProfileSheet)();
        });
      } else {
        profileSheetY.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });

  // Avatar pulse — a one-time welcome scale pop on first mount. Runs on
  // the UI thread, doesn't block anything, and stops at identity. Skipped
  // on re-focus (only fires when the component first mounts in a session).
  const avatarScale = useSharedValue(1);
  useEffect(() => {
    avatarScale.value = withDelay(
      250,
      withSequence(
        withTiming(1.08, { duration: 260, easing: REasing.out(REasing.quad) }),
        withTiming(1, { duration: 320, easing: REasing.out(REasing.cubic) }),
      ),
    );
  }, []);
  const avatarPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: avatarScale.value }],
  }));

  const todayCards = useMemo(
    () =>
      buildTodayCards({
        activeKid,
        ageLabel,
        todayMood,
        moodHistory,
        vaccineSchedule,
        teethByKid,
        foodsByKid,
        router,
        chatThreads,
        savedAnswers,
        onContinueChat: handleContinueChat,
        profileState: profile?.state,
        parentDiet: profile?.diet,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeKid, ageLabel, todayMood, moodHistory, vaccineSchedule, teethByKid, foodsByKid, router, chatThreads, savedAnswers, profile?.state, profile?.diet]
  );

  // ─── Baby health at-a-glance ──────────────────────────────────────────
  // Reads the new useGrowthStore (weight/height/head/diaper/sleep) and the
  // vaccine schedule to surface the most recent real data for the active
  // kid. Returns up to five mini-cards; each deep-links to the right
  // sub-tab in Health. Empty values render as an "Add" CTA.
  const growthByKid = useGrowthStore((s) => s.byKid);
  const babyHealthStrip = useMemo(() => {
    if (!activeKid || activeKid.isExpecting) return [] as Array<{
      key: string; icon: string; label: string; value: string; tint: string; tintBg: string;
      empty?: boolean; onPress: () => void;
    }>;
    const kid = growthByKid[activeKid.id] ?? {};
    const latest = (arr?: any[]) => (arr && arr.length > 0 ? arr[0] : null);

    const w = latest(kid.weight);
    const h = latest(kid.height);
    const hd = latest(kid.head);
    const sleeps = kid.sleep ?? [];
    const diapers = kid.diaper ?? [];

    // "Today" window for routine metrics — counts diapers since midnight,
    // sleep hours from events that OVERLAP today.
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const diapersToday = diapers.filter((d: any) => new Date(d.at).getTime() >= startOfToday.getTime()).length;
    const sleepTodayMins = sleeps.reduce((sum: number, e: any) => {
      const endT = new Date(e.sleepEnd ?? e.at).getTime();
      if (endT < startOfToday.getTime()) return sum;
      return sum + sleepDurationMinutes(e);
    }, 0);
    const lastSleep = latest(sleeps);

    // Vaccine summary — first overdue or due-soon wins; else "up to date".
    const overdue = vaccineSchedule.filter((v) => v.status === 'overdue');
    const dueSoon = vaccineSchedule.filter((v) => v.status === 'due-soon');
    const vaccineLabel =
      overdue.length > 0 ? `${overdue.length} overdue`
      : dueSoon.length > 0 ? `${dueSoon.length} due soon`
      : 'Up to date';
    const vaccineTint = overdue.length > 0 ? Colors.error : dueSoon.length > 0 ? Colors.warning : Colors.success;

    const goGrowth  = () => router.push({ pathname: '/(tabs)/health', params: { tab: 'growth' } });
    const goRoutine = () => router.push({ pathname: '/(tabs)/health', params: { tab: 'routine' } });
    const goVacc    = () => router.push({ pathname: '/(tabs)/health', params: { tab: 'vaccines' } });

    // Tracker tints used to be a rainbow (purple/indigo/teal/amber/blue).
    // They now all render in the brand accent — icon + soft tile bg both
    // read through Colors.* so switching the accent colour in Settings
    // re-skins the whole strip. Vaccines is the one exception: it uses
    // semantic status colours (overdue=red, due-soon=amber, ok=green)
    // because those convey meaning beyond the brand.
    const brandTint = Colors.primary;
    const brandTintBg = Colors.primaryAlpha08;
    return [
      {
        key: 'weight',
        icon: 'scale-outline',
        label: 'Weight',
        value: w ? `${(w.value ?? 0).toFixed(2)} kg` : 'Log now',
        tint: brandTint,
        tintBg: brandTintBg,
        empty: !w,
        onPress: goGrowth,
      },
      {
        key: 'height',
        icon: 'resize-outline',
        label: 'Height',
        value: h ? `${(h.value ?? 0).toFixed(1)} cm` : 'Log now',
        tint: brandTint,
        tintBg: brandTintBg,
        empty: !h,
        onPress: goGrowth,
      },
      {
        key: 'head',
        icon: 'ellipse-outline',
        label: 'Head',
        value: hd ? `${(hd.value ?? 0).toFixed(1)} cm` : 'Log now',
        tint: brandTint,
        tintBg: brandTintBg,
        empty: !hd,
        onPress: goGrowth,
      },
      {
        key: 'sleep',
        icon: 'moon-outline',
        label: 'Sleep today',
        value: sleepTodayMins > 0 ? formatDuration(sleepTodayMins) : lastSleep ? 'No entry today' : 'Log sleep',
        tint: brandTint,
        tintBg: brandTintBg,
        empty: sleepTodayMins === 0,
        onPress: goRoutine,
      },
      {
        key: 'diaper',
        icon: 'sync-outline',
        label: 'Diapers today',
        value: diapersToday > 0 ? `${diapersToday}` : 'Log diaper',
        tint: brandTint,
        tintBg: brandTintBg,
        empty: diapersToday === 0,
        onPress: goRoutine,
      },
      {
        key: 'vaccines',
        icon: 'shield-checkmark-outline',
        label: 'Vaccines',
        value: vaccineLabel,
        tint: vaccineTint,
        tintBg: `${vaccineTint}1A`,
        onPress: goVacc,
      },
    ];
  }, [activeKid, growthByKid, vaccineSchedule, router]);

  // Vaccine reminders continue to render inline on the Home body (as
  // Today/Quick-Action cards). We no longer merge them into a bespoke
  // Inbox modal — the bell icon opens the shared NotificationsSheet used
  // everywhere in the app.

  // Day 1/3/7 micro-surveys for the closed beta. Anchored on the user's
  // first home visit (stored once in AsyncStorage). The modal pops at most
  // once per launch, only after FirstRunHero is done, and never repeats
  // a survey once submitted or dismissed.
  const [activeSurvey, setActiveSurvey] = useState<MicroSurvey | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    if (firstRunOpen) return; // don't stack on top of the intro
    let cancelled = false;
    const ANCHOR_KEY = `maamitra-first-home-at-${user.uid}`;
    const SEEN_PREFIX = `maamitra-survey-done-${user.uid}-`;
    (async () => {
      try {
        let anchor = await AsyncStorage.getItem(ANCHOR_KEY);
        if (!anchor) {
          anchor = String(Date.now());
          await AsyncStorage.setItem(ANCHOR_KEY, anchor);
        }
        const ageDays = (Date.now() - Number(anchor)) / (1000 * 60 * 60 * 24);
        // Walk surveys newest-first so a Day-7 user doesn't get hit with
        // the Day-1 question if they skipped it.
        const candidates = [...MICRO_SURVEYS].sort(
          (a, b) => b.daysAfterFirstVisit - a.daysAfterFirstVisit,
        );
        for (const s of candidates) {
          if (ageDays < s.daysAfterFirstVisit) continue;
          const seen = await AsyncStorage.getItem(`${SEEN_PREFIX}${s.key}`);
          if (seen) continue;
          if (!cancelled) setActiveSurvey(s);
          return;
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [user?.uid, firstRunOpen]);

  const handleSurveySubmit = async (answer: string, freeText: string) => {
    const survey = activeSurvey;
    if (!survey || !user?.uid) return;
    try {
      await submitMicroSurvey({
        uid: user.uid,
        surveyKey: survey.key,
        question: survey.question,
        answer,
        freeText: freeText || undefined,
        platform: Platform.OS,
      });
    } catch (err) {
      console.warn('[micro-survey] submit failed', err);
    }
    try {
      await AsyncStorage.setItem(`maamitra-survey-done-${user.uid}-${survey.key}`, '1');
    } catch {}
    setActiveSurvey(null);
  };

  const handleSurveyDismiss = async () => {
    const survey = activeSurvey;
    setActiveSurvey(null);
    if (!survey || !user?.uid) return;
    // "Maybe later" — record it so we don't reopen this exact survey on
    // every home visit. The next survey in the schedule will still fire.
    try {
      await AsyncStorage.setItem(`maamitra-survey-done-${user.uid}-${survey.key}`, '1');
    } catch {}
  };

  // First-run intro: auto-opens once per user on the first home visit.
  // Gate is double — Firestore `hasSeenIntro` (cross-device) AND a local
  // AsyncStorage key (offline + brand-new install before profile sync).
  const setHasSeenIntro = useProfileStore((s) => s.setHasSeenIntro);
  const hasSeenIntro = useProfileStore((s) => s.hasSeenIntro);

  useEffect(() => {
    let cancelled = false;
    if (!user?.uid) return;
    if (hasSeenIntro) return;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(`${FIRST_RUN_KEY}-${user.uid}`);
        if (!cancelled && !seen) setFirstRunOpen(true);
      } catch {
        if (!cancelled) setFirstRunOpen(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid, hasSeenIntro]);

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
        {/* Admin-published banner — only renders if app_settings/config.banner is set. */}
        <AppBannerStrip />

        {/* Header row. Tapping the avatar takes you to Edit Profile
            (fast path for "change my name/photo"). The right cluster is
            the same triplet used on every tab with a header:
            🔔 Notifications · 💬 Messages · ⚙️ Settings. */}
        <View style={styles.headerRow}>
          <Reanimated.View style={[avatarPulseStyle]}>
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
          </Reanimated.View>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetSmall} allowFontScaling={false}>{greetingSalutation}</Text>
            <Text
              style={styles.greetBig}
              allowFontScaling={false}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {greetingTitle}
            </Text>
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

        <View style={styles.homeHeroWrap}>
          <Illustration name={heroName} style={styles.homeHeroImg} />
        </View>

        {/* HERO: Ask Maamitra AI bar — flat lilac card, brand-purple icon.
            Previously a gradient-bordered card with a gradient icon tile;
            simplified to match the rest of the refreshed UI. */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.heroWrap}
          onPress={() => router.push('/(tabs)/chat')}
        >
          <View style={styles.heroInner}>
            <View style={styles.heroIconGrad}>
              <Ionicons name="sparkles" size={16} color="#ffffff" />
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
        </TouchableOpacity>

        {/* ═══ DAILY AFFIRMATION ═══ A gentle Lora-italic line that rotates
            once a day. Sits between the AI bar and the action grid so the
            user gets a moment of warmth before scanning what's "due". */}
        <View style={styles.affirmationCard}>
          <Text style={styles.affirmationQuoteMark}>“</Text>
          <Text style={styles.affirmationText}>{affirmationToday}</Text>
        </View>

        {/* ═══ TODAY'S FOCUS ═══ The most-prioritized card from todayCards
            promoted to a hero treatment — personalised "Today for <kid>"
            heading, full-width, larger illustration. Pure visual emphasis,
            same data + onPress as the underlying card. The remaining cards
            stay in the grid below. */}
        {todayCards.length > 0 && (() => {
          const hero = todayCards[0];
          const heroLabel = activeKid?.name && activeKid.name !== 'Little one'
            ? `Today for ${activeKid.name}`
            : 'Today';
          return (
            <Reanimated.View
              entering={FadeInDown.duration(360).springify().damping(15)}
              style={styles.todayHeroWrap}
            >
              <AnimatedPressable
                onPress={hero.onPress}
                style={[styles.todayHeroCard, { backgroundColor: hero.bg }]}
              >
                {QUICK_ILLUS[hero.id] ? (
                  <Illustration
                    name={QUICK_ILLUS[hero.id]!}
                    style={styles.todayHeroIllus}
                    contentFit="contain"
                  />
                ) : (
                  <View style={[styles.todayHeroIconWrap, { backgroundColor: '#ffffff' }]}>
                    <Ionicons name={hero.icon as any} size={22} color={hero.tint} />
                  </View>
                )}
                <View style={styles.todayHeroContent}>
                  <Text style={styles.todayHeroLabel} numberOfLines={1}>{heroLabel}</Text>
                  <Text style={styles.todayHeroValue} numberOfLines={2}>{hero.value}</Text>
                  <Text style={styles.todayHeroSub} numberOfLines={1}>{hero.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
              </AnimatedPressable>
            </Reanimated.View>
          );
        })()}

        {/* ═══ QUICK ACTIONS ═══ Remaining urgent/actionable cards (index 1+). */}
        <Text style={styles.groupLabel}>Quick actions</Text>
        <View style={styles.todayGrid}>
          {(quickActionsExpanded ? todayCards.slice(1) : todayCards.slice(1, 7)).map((c, i) => (
            // Outer wrapper handles the mount animation (fade + slide up,
            // staggered by 60ms per card so the grid reveals itself in
            // sequence). Inner Pressable drives the press-scale via
            // shared value — the two transforms don't conflict because
            // the outer settles to identity after mount.
            <Reanimated.View
              key={c.id}
              entering={FadeInDown.delay(i * 60).duration(340).springify().damping(15)}
              style={styles.todayCardWrap}
            >
              <AnimatedPressable
                onPress={c.onPress}
                style={[styles.todayCard, { backgroundColor: c.bg }]}
              >
                {QUICK_ILLUS[c.id] ? (
                  <Illustration
                    name={QUICK_ILLUS[c.id]!}
                    style={styles.todayCardIllus}
                    contentFit="contain"
                  />
                ) : (
                  <Ionicons name={c.icon as any} size={16} color={c.tint} />
                )}
                <Text style={styles.todayVal} numberOfLines={2}>{c.value}</Text>
                <Text style={styles.todaySub} numberOfLines={1}>{c.label}</Text>
              </AnimatedPressable>
            </Reanimated.View>
          ))}
        </View>
        {todayCards.length > 7 && (
          <TouchableOpacity
            onPress={() => setQuickActionsExpanded((v) => !v)}
            activeOpacity={0.75}
            style={styles.quickActionsExpander}
          >
            <Ionicons
              name={quickActionsExpanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={Colors.primary}
            />
            <Text style={styles.quickActionsExpanderText}>
              {quickActionsExpanded ? 'Show less' : `Show all (+${todayCards.length - 7})`}
            </Text>
          </TouchableOpacity>
        )}

        {/* ═══ YOUR BABY ═══ Family snapshot + health-at-a-glance strip.
            Grouped under one label so it's the single place on Home where
            you see the active kid and their latest measurements. Tapping
            any stat deep-links into the matching Health sub-tab. */}
        <Text style={styles.groupLabel}>{activeKid ? `${activeKid.name}'s corner` : 'Your baby'}</Text>
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

        {/* Health at a glance — horizontal scroll of mini stat cards.
            Empty-state values ("Log now") are visually muted so they don't
            masquerade as real data. Hidden for expecting kids (no baby
            measurements yet). */}
        {babyHealthStrip.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.babyHealthScroll}
            style={{ marginTop: 10, marginHorizontal: -Spacing.md }}
          >
            {babyHealthStrip.map((stat) => (
              <TouchableOpacity
                key={stat.key}
                activeOpacity={0.85}
                onPress={stat.onPress}
                style={[styles.babyHealthCard, stat.empty && styles.babyHealthCardEmpty]}
              >
                <View style={[styles.babyHealthIcon, { backgroundColor: stat.tintBg }]}>
                  <Ionicons name={stat.icon as any} size={16} color={stat.tint} />
                </View>
                <Text style={[styles.babyHealthValue, stat.empty && styles.babyHealthValueEmpty]} numberOfLines={1}>
                  {stat.value}
                </Text>
                <Text style={styles.babyHealthLabel} numberOfLines={1}>{stat.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ═══ COMMUNITY ═══ Latest post if any, else a seed CTA pulling
            users into making the first post. The local-parents tile lives
            on the Community tab now — no longer gates this header. */}
        <Text style={styles.groupLabel}>Community</Text>
        {!latestPost && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push('/(tabs)/community')}
            style={styles.card}
          >
            <View style={styles.commEmptyRow}>
              <View style={styles.commEmptyIcon}>
                <Ionicons name="sparkles-outline" size={18} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.commEmptyTitle}>Be the first to share</Text>
                <Text style={styles.commEmptyText}>
                  Your post will reach 20 fellow parents in this beta 🌱
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </View>
          </TouchableOpacity>
        )}
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

        {/* ═══ DISCOVER ═══ Reading picks — the hero suggested article +
            a horizontal carousel of age/diet-filtered reads. Only rendered
            when there's at least one article to show. */}
        {(suggestedArticle || recommendedArticles.length > 0) && (
          <Text style={styles.groupLabel}>Discover</Text>
        )}
        {suggestedArticle && (
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.readCard}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/library',
                params: { tab: 'read', articleId: suggestedArticle.id },
              })
            }
          >
            <LinearGradient
              colors={['#FAFAFB', '#F5F0FF']}
              style={styles.readInner}
            >
              <View style={styles.readBadge}>
                <Text style={styles.readBadgeTxt}>
                  {(suggestedArticle.readTime || '5 min').toUpperCase()} READ
                </Text>
              </View>
              <Text style={styles.readTitle}>{suggestedArticle.title}</Text>
              <Text style={styles.readSub}>Hand-picked for you · from the Library</Text>
            </LinearGradient>
          </TouchableOpacity>
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
            <Reanimated.View
              style={styles.weekGrid}
              entering={FadeInUp.duration(420).springify().damping(16)}
            >
              <AnimatedPressable
                style={styles.weekTile}
                onPress={() => router.push('/(tabs)/wellness')}
              >
                <AnimatedNumber
                  value={weeklyDigest.moodLoggedDays}
                  style={styles.weekTileValue}
                  suffix="/7"
                />
                <Text style={styles.weekTileLabel}>Mood logged</Text>
                {weeklyDigest.moodAvg !== null && (
                  <Text style={styles.weekTileSub}>
                    Avg {weeklyDigest.moodAvg.toFixed(1)}/5
                  </Text>
                )}
              </AnimatedPressable>
              <AnimatedPressable
                style={styles.weekTile}
                onPress={() => router.push('/(tabs)/health')}
              >
                <AnimatedNumber
                  value={weeklyDigest.vaccinesDone}
                  style={[
                    styles.weekTileValue,
                    weeklyDigest.vaccinesPending > 0 && { color: Colors.error },
                  ]}
                />
                <Text style={styles.weekTileLabel}>Vaccines done</Text>
                <Text style={styles.weekTileSub}>
                  {weeklyDigest.vaccinesPending > 0
                    ? `${weeklyDigest.vaccinesPending} pending`
                    : 'All caught up'}
                </Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={styles.weekTile}
                onPress={() => router.push('/(tabs)/community')}
              >
                <AnimatedNumber
                  value={weeklyDigest.myPostsThisWeek}
                  style={styles.weekTileValue}
                />
                <Text style={styles.weekTileLabel}>Your posts</Text>
                <Text style={styles.weekTileSub}>
                  {weeklyDigest.newNotifs > 0
                    ? `${weeklyDigest.newNotifs} new activity`
                    : 'Share your week'}
                </Text>
              </AnimatedPressable>
            </Reanimated.View>
          </>
        )}

        {/* Recommended reads — 3–5 age + diet-filtered articles. Sits
            under the "Discover" group label above alongside the hero
            suggested article. */}
        {recommendedArticles.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>More reads for you</Text>
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
                  activeOpacity={0.85}
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/library',
                      params: { tab: 'read', articleId: a.id },
                    })
                  }
                >
                  <View style={styles.recReadIconBox}>
                    <Ionicons name="book-outline" size={16} color={Colors.primary} />
                  </View>
                  <Text style={styles.recReadTopic} numberOfLines={1}>
                    {(a.topic || 'Article').toUpperCase()}
                  </Text>
                  <Text style={styles.recReadTitle} numberOfLines={3}>
                    {a.title}
                  </Text>
                  <View style={styles.recReadFooter}>
                    <Ionicons name="time-outline" size={12} color="#9ca3af" />
                    <Text style={styles.recReadMeta}>{a.readTime || '5 min'}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* ═══ EXPLORE ═══ Shortcut grid for buried surfaces. Trimmed from
            six tiles to four — "Articles" and "Saved" dropped because they
            duplicate the Library tab which is always one tap away via the
            profile sheet. Remaining tiles reach places that don't live on
            the bottom bar at all. */}
        <Text style={styles.groupLabel}>Explore</Text>
        <View style={styles.jumpGrid}>
          <JumpTile
            icon="ribbon-outline"
            label="Schemes"
            onPress={() =>
              router.push({ pathname: '/(tabs)/health', params: { tab: 'schemes' } })
            }
          />
          <JumpTile
            icon="leaf-outline"
            label="Yoga"
            onPress={() =>
              router.push({ pathname: '/(tabs)/wellness', params: { section: 'yoga' } })
            }
          />
          <JumpTile
            icon="flower-outline"
            label="Dadi's Nuskhe"
            onPress={() =>
              router.push({ pathname: '/(tabs)/health', params: { tab: 'nuskhe' } })
            }
          />
          <JumpTile
            icon="heart-outline"
            label="My health"
            onPress={() =>
              router.push({ pathname: '/(tabs)/health', params: { tab: 'myhealth' } })
            }
          />
          <JumpTile
            icon="search-outline"
            label="Find moms"
            onPress={() =>
              // Community tab reads ?search=1 and auto-opens UserSearchSheet.
              router.push({ pathname: '/(tabs)/community', params: { search: '1' } })
            }
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
          <GestureDetector gesture={profileSheetPan}>
            <Reanimated.View style={[styles.sheet, profileSheetStyle]}>
            <View style={styles.sheetHandle} />
            {/* Sheet grew past a phone's viewport once "Your family" was
                added. Wrap the scrolling sections so content can reach past
                the screen edge without being clipped — the handle + pan-to-
                dismiss live OUTSIDE the scroller so dragging down still
                closes the sheet regardless of scroll position. */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetScrollContent}
              keyboardShouldPersistTaps="handled"
            >
            {/* Identity card — richer than a flat row. Avatar + name, then a
                dense stat rail (kids · threads · saved). Makes the sheet
                header feel substantial instead of empty. */}
            <View style={styles.sheetIdentityCard}>
              <View style={styles.sheetIdentityTop}>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.sheetAvatarPhoto} />
                ) : (
                  <View style={styles.sheetAvatarFallback}>
                    <Text style={styles.sheetAvatarFallbackTxt}>
                      {(motherName || firstName).charAt(0).toUpperCase() || 'M'}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetName}>{motherName || firstName || 'Welcome'}</Text>
                  <Text style={styles.sheetEmail}>
                    {parentGender === 'father'
                      ? 'Dad'
                      : parentGender === 'other'
                      ? 'Parent'
                      : 'Mom'}
                    {activeKid ? ` · ${activeKid.name}` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setProfileOpen(false);
                    setTimeout(() => setSettingsView('edit-profile'), 120);
                  }}
                  style={styles.sheetEditBtn}
                  activeOpacity={0.7}
                  accessibilityLabel="Edit profile"
                >
                  <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.sheetStatRow}>
                <View style={styles.sheetStat}>
                  <Text style={styles.sheetStatValue}>{kids.length}</Text>
                  <Text style={styles.sheetStatLabel}>
                    {kids.length === 1 ? 'child' : 'children'}
                  </Text>
                </View>
                <View style={styles.sheetStatDivider} />
                <View style={styles.sheetStat}>
                  <Text style={styles.sheetStatValue}>{chatThreads.length}</Text>
                  <Text style={styles.sheetStatLabel}>chats</Text>
                </View>
                <View style={styles.sheetStatDivider} />
                <View style={styles.sheetStat}>
                  <Text style={styles.sheetStatValue}>{savedAnswers.length}</Text>
                  <Text style={styles.sheetStatLabel}>saved</Text>
                </View>
              </View>
            </View>

            {/* Your family — quick child switcher + manage. Moved out of the
                bottom tab bar so the primary slots belong to the most-used
                surfaces (Home, Health, Ask, Community, Wellness). Picking a
                child here drives which baby's data the rest of the app
                personalises against (vaccines, teeth, foods, growth, etc.). */}
            <Text style={styles.sheetSectionLabel}>Your family</Text>
            {kids.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.kidChipRow}
              >
                {kids.map((k) => {
                  const isActive = k.id === activeKidId;
                  const initial = (k.name || '?').charAt(0).toUpperCase();
                  return (
                    <TouchableOpacity
                      key={k.id}
                      onPress={() => setActiveKidId(k.id)}
                      activeOpacity={0.8}
                      style={[styles.kidChip, isActive && styles.kidChipActive]}
                    >
                      <View style={[styles.kidChipAvatar, isActive && styles.kidChipAvatarActive]}>
                        <Text style={[styles.kidChipInitial, isActive && styles.kidChipInitialActive]}>
                          {initial}
                        </Text>
                      </View>
                      <View>
                        <Text style={[styles.kidChipName, isActive && styles.kidChipNameActive]} numberOfLines={1}>
                          {k.name}
                        </Text>
                        <Text style={[styles.kidChipMeta, isActive && styles.kidChipMetaActive]} numberOfLines={1}>
                          {k.isExpecting
                            ? 'Expecting'
                            : k.dob
                            ? (() => {
                                const m = Math.max(
                                  0,
                                  Math.floor((Date.now() - new Date(k.dob).getTime()) / (1000 * 60 * 60 * 24 * 30.44)),
                                );
                                return m < 24 ? `${m}mo` : `${Math.floor(m / 12)}y`;
                              })()
                            : ''}
                        </Text>
                      </View>
                      {isActive ? (
                        <Ionicons name="checkmark-circle" size={14} color="#ffffff" />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <Text style={styles.kidEmptyLine}>No children added yet.</Text>
            )}
            <ProfileRow
              icon="people-outline"
              label={kids.length > 0 ? 'Manage family' : 'Add your first child'}
              sub={kids.length > 0 ? `${kids.length} ${kids.length === 1 ? 'child' : 'children'} · add, edit, remove` : 'Set up your family profile'}
              onPress={() => {
                setProfileOpen(false);
                router.push('/(tabs)/family');
              }}
            />

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
              icon="chatbubble-ellipses-outline"
              label="Share feedback"
              sub="Tell us what you love and what to fix"
              onPress={() => {
                setProfileOpen(false);
                setTimeout(() => useFeedbackStore.getState().openSurvey(), 120);
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
            <ProfileRow
              icon="settings-outline"
              label="All settings"
              sub="Full settings, sign out, delete account"
              onPress={() => {
                setProfileOpen(false);
                setTimeout(() => setSettingsView('main'), 120);
              }}
            />
            </ScrollView>
            </Reanimated.View>
          </GestureDetector>
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

      {/* Closed-beta micro-surveys (Day 1 / 3 / 7) */}
      <MicroSurveyModal
        visible={!!activeSurvey}
        survey={activeSurvey}
        onSubmit={handleSurveySubmit}
        onDismiss={handleSurveyDismiss}
      />

      {/* Settings (used for both Edit profile and Privacy). Single source
          of truth for profile editing + privacy toggles — no duplication. */}
      <SettingsModal
        visible={settingsView !== null}
        onClose={() => setSettingsView(null)}
        initialView={settingsView === 'edit-profile' ? 'edit-profile' : 'main'}
        scrollToPrivacy={settingsView === 'privacy'}
      />

      {/* Community notifications — same sheet used in the Community tab. */}
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
  foodsByKid,
  router,
  chatThreads,
  savedAnswers,
  onContinueChat,
  profileState,
  parentDiet,
}: {
  activeKid: ReturnType<typeof useActiveKid>['activeKid'];
  ageLabel: string;
  todayMood: any;
  moodHistory: any[];
  vaccineSchedule: ReturnType<typeof useVaccineSchedule>;
  teethByKid: Record<string, Record<string, { state: string; eruptDate?: string; shedDate?: string }>>;
  foodsByKid: Record<string, Record<string, { cleared?: boolean; d1Date?: string; d2Date?: string; d3Date?: string; reaction?: string }>>;
  router: ReturnType<typeof useRouter>;
  chatThreads: Array<{ id: string; title: string; messages: any[]; lastMessageAt: Date | string }>;
  savedAnswers: any[];
  onContinueChat: (threadId: string) => void;
  profileState: string | undefined;
  parentDiet: string | undefined;
}): TodayCard[] {
  const cards: TodayCard[] = [];
  const goWellness = () => router.push('/(tabs)/wellness');
  const goFamily = () => router.push('/(tabs)/family');
  const goLibrary = () => router.push('/(tabs)/library');
  const goLibraryTopic = (topic: string) =>
    router.push({ pathname: '/(tabs)/library', params: { tab: 'read', topic } });
  const goSavedAnswers = () =>
    router.push({ pathname: '/(tabs)/library', params: { tab: 'saved' } });
  const goHealth = () => router.push('/(tabs)/health');
  const goSchemes = () =>
    router.push({ pathname: '/(tabs)/health', params: { tab: 'schemes' } });
  const goTeeth = () =>
    router.push({ pathname: '/(tabs)/health', params: { tab: 'teeth' } });
  const goFoods = () =>
    router.push({ pathname: '/(tabs)/health', params: { tab: 'foods' } });
  const goVaccines = () =>
    router.push({ pathname: '/(tabs)/health', params: { tab: 'vaccines' } });

  if (!todayMood) {
    cards.push({
      id: 'mood',
      icon: 'happy-outline',
      tint: Colors.primary,
      bg: '#F5F0FF',
      value: 'Log mood',
      label: 'Not logged yet',
      onPress: goWellness,
    });
  } else {
    cards.push({
      id: 'mood',
      icon: 'happy-outline',
      tint: Colors.primary,
      bg: '#F5F0FF',
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
      bg: '#F5F0FF',
      value: 'Pregnancy tips',
      label: 'For this trimester',
      onPress: () => goLibraryTopic('Pregnancy'),
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
        onPress: () => goLibraryTopic('Sleep'),
      });
    } else if (months < 9) {
      cards.push({
        id: 'solids',
        icon: 'nutrition-outline',
        tint: Colors.primary,
        bg: Colors.bgPink,
        value: 'Start solids',
        label: `${activeKid.name} · ${ageLabel}`,
        // 'a01' = "Starting Solid Foods the Right Way" — auto-expands on
        // open; falls back to the Feeding topic filter if the exact id
        // can't be found (e.g. id rotation).
        onPress: () => router.push({
          pathname: '/(tabs)/library',
          params: { tab: 'read', articleId: 'a01', topic: 'Feeding' },
        }),
      });
    } else if (months < 24) {
      // Skip a generic "Milestones" tile here — the personalised
      // "next milestone" card below (with the actual title + age) already
      // covers this age window. Two milestone tiles read as duplicates.
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
      onPress: goVaccines,
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
        bg: '#F5F0FF',
        value: 'First tooth soon',
        label: `${activeKid.name} · ${ageLabel}`,
        onPress: goTeeth,
      };
    } else if (months >= 8 && months < 15 && eruptedCount === 0) {
      teethCard = {
        id: 'teeth',
        icon: 'happy-outline',
        tint: Colors.primary,
        bg: '#F5F0FF',
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
        bg: '#F5F0FF',
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
        bg: '#F5F0FF',
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
        bg: '#F5F0FF',
        value: 'Shedding soon',
        label: `${activeKid.name} · ${ageLabel}`,
        onPress: goTeeth,
      };
    } else if (ageYears >= 5 && shedCount > 0 && shedCount < TEETH.length) {
      teethCard = {
        id: 'teeth',
        icon: 'sparkles-outline',
        tint: Colors.primary,
        bg: '#F5F0FF',
        value: `${shedCount}/${TEETH.length} shed`,
        label: `${activeKid.name} · ${ageLabel}`,
        onPress: goTeeth,
      };
    }

    if (teethCard) cards.push(teethCard);
  }

  // ── First-foods card (personalised per kid, 3-day rule) ────────────
  // Only meaningful for kids 4 mo and up:
  //   • 4-5 mo               → "Solids soon" anticipation
  //   • 6 mo, nothing tried  → "Start solids" prompt (key milestone)
  //   • In-progress 3-day    → "Day X/3: <food>" — keep momentum
  //   • Cleared >0, age-window → "X foods cleared · Try next" with progress
  //   • Recent reaction      → flag with warning tint
  //   • > 24 mo and lots cleared → silent (graduated)
  if (activeKid && !activeKid.isExpecting && activeKid.dob) {
    const months = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(activeKid.dob).getTime()) /
          (1000 * 60 * 60 * 24 * 30.44),
      ),
    );
    const kidFoods = foodsByKid[activeKid.id] ?? {};
    // Only consider foods this family actually eats — a vegetarian
    // parent shouldn't get prompted about chicken progress.
    const allowedFoods = BABY_FOODS.filter((f) => isAllowedForDiet(f, parentDiet));
    const clearedFoods = allowedFoods.filter((f) => kidFoods[f.id]?.cleared).length;
    const inProgress = allowedFoods.find((f) => {
      const e = kidFoods[f.id];
      return e && !e.cleared && (e.d1Date || e.d2Date || e.d3Date);
    });
    const recentReaction = allowedFoods.find((f) => {
      const r = kidFoods[f.id]?.reaction;
      return r === 'rash' || r === 'vomit';
    });

    let foodsCard: TodayCard | null = null;

    if (months >= 4 && months < 6) {
      foodsCard = {
        id: 'foods',
        icon: 'restaurant-outline',
        tint: Colors.primary,
        bg: '#F5F0FF',
        value: 'Solids soon',
        label: `${activeKid.name} · ${ageLabel}`,
        onPress: goFoods,
      };
    } else if (months >= 6 && clearedFoods === 0 && !inProgress) {
      foodsCard = {
        id: 'foods',
        icon: 'restaurant-outline',
        tint: Colors.primary,
        bg: '#F5F0FF',
        value: 'Start first foods',
        label: `${activeKid.name} · ${ageLabel}`,
        onPress: goFoods,
      };
    } else if (recentReaction) {
      foodsCard = {
        id: 'foods',
        icon: 'alert-circle-outline',
        tint: Colors.error,
        bg: '#F5F0FF',
        value: `Reaction: ${recentReaction.name.toLowerCase()}`,
        label: 'Tap to review',
        onPress: goFoods,
      };
    } else if (inProgress) {
      const e = kidFoods[inProgress.id]!;
      const day = [e.d1Date, e.d2Date, e.d3Date].filter(Boolean).length;
      foodsCard = {
        id: 'foods',
        icon: 'restaurant-outline',
        tint: Colors.primary,
        bg: '#F5F0FF',
        value: `Day ${day}/3: ${inProgress.name.split(' ')[0]}`,
        label: `${activeKid.name} · keep going`,
        onPress: goFoods,
      };
    } else if (clearedFoods > 0 && months <= 24) {
      foodsCard = {
        id: 'foods',
        icon: 'restaurant-outline',
        tint: Colors.primary,
        bg: '#F5F0FF',
        value: `${clearedFoods} foods cleared`,
        label: 'Try next?',
        onPress: goFoods,
      };
    }

    if (foodsCard) cards.push(foodsCard);
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
      bg: '#F5F0FF',
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
      bg: '#F5F0FF',
      value: `${savedAnswers.length} saved`,
      label: 'AI answers',
      onPress: goSavedAnswers,
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
      bg: '#F5F0FF',
      value: candidateScheme.shortName,
      label: profileState ? `Scheme · ${profileState}` : 'A scheme for you',
      onPress: goSchemes,
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
        tint: Colors.primary,
        bg: '#F5F0FF',
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
        bg: '#F5F0FF',
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
        bg: '#F5F0FF',
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
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  // Single-style tile — was four different bg/tint combos (lilac, lavender,
  // mint, amber). Now a flat white card with a lilac icon chip and a
  // brand-purple icon. Label sits below in dark ink.
  return (
    <AnimatedPressable style={styles.jumpTile} onPress={onPress}>
      <View style={styles.jumpIconChip}>
        <Ionicons name={icon as any} size={18} color={Colors.primary} />
      </View>
      <Text style={styles.jumpTileLabel}>{label}</Text>
    </AnimatedPressable>
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

  homeHeroWrap: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFF8F1',
    aspectRatio: 2,
  },
  homeHeroImg: {
    width: '100%',
    height: '100%',
  },

  // Daily affirmation card — soft cream surface, Lora italic line, gentle
  // brand-purple opening quote mark. Sits between the AI bar and the action
  // grid; aim is "moment of warmth before triage", not another action prompt.
  affirmationCard: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.creamWarm,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  affirmationQuoteMark: {
    fontFamily: Fonts.serif,
    fontSize: 36,
    lineHeight: 28,
    color: Colors.lavenderMild,
    marginBottom: 4,
  },
  affirmationText: {
    fontFamily: Fonts.serifMedium,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.textDark,
    fontStyle: 'italic',
  },

  heroWrap: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
    borderRadius: 14,
  },
  heroInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroIconGrad: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  heroLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: FontSize.md,
    color: Colors.textDark,
    letterSpacing: 0.1,
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
    backgroundColor: Colors.primarySoft,
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
  // Group-level label — sits above a cluster of related cards to make it
  // obvious which section-header belongs to which bucket. Heavier weight
  // and darker colour than the old all-caps `sectionLabel`.
  groupLabel: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    color: Colors.textDark,
    letterSpacing: -0.2,
    marginTop: Spacing.xxl,
    marginBottom: Spacing.sm,
    marginHorizontal: Spacing.xl,
  },
  // Baby health at-a-glance — horizontal strip of mini cards that each
  // drill into a Health sub-tab. Cards have a soft lilac border and a
  // tinted icon chip whose colour matches the corresponding tracker.
  babyHealthScroll: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: 4,
    gap: 8,
  },
  babyHealthCard: {
    width: 120,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    gap: 6,
    // @ts-ignore — web-only
    boxShadow: '0px 2px 6px rgba(28,16,51,0.04)',
  },
  babyHealthCardEmpty: {
    backgroundColor: Colors.bgLight,
    borderStyle: 'dashed',
    borderColor: Colors.border,
  },
  babyHealthIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  babyHealthValue: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: Colors.textDark,
    letterSpacing: -0.2,
  },
  babyHealthValueEmpty: {
    color: Colors.textLight,
    fontFamily: Fonts.sansSemiBold,
  },
  babyHealthLabel: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: Colors.textMuted,
  },
  todayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  todayCardWrap: {
    // 2-column grid. width:'48.5%' + gap:Spacing.sm (8) on a 360dp screen
    // leaves the small inter-card gap room — fits cleanly without overflow.
    width: '48.5%',
  },
  todayCard: {
    width: '100%',
    minHeight: 78,
    borderRadius: 12,
    padding: Spacing.md,
    gap: 3,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  todayCardIllus: { width: 32, height: 32, marginBottom: 2 },

  // Today-for-<kid> hero card — promoted from todayCards[0]. Full-width,
  // larger illustration on the left, content stack in the middle, chevron
  // on the right. Soft brand-purple shadow, generous padding for breathing
  // room. Same `bg` as the underlying card so the colour signal still maps.
  todayHeroWrap: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
  },
  todayHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  todayHeroIllus: { width: 64, height: 64 },
  todayHeroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayHeroContent: {
    flex: 1,
    gap: 2,
  },
  todayHeroLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  todayHeroValue: {
    fontFamily: Fonts.serif,
    fontSize: FontSize.lg,
    color: Colors.textDark,
    marginTop: 2,
  },
  todayHeroSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: FontSize.sm,
    color: Colors.textLight,
    marginTop: 2,
  },
  todayVal: {
    fontFamily: Fonts.sansBold,
    fontSize: FontSize.sm,
    color: Colors.textDark,
    marginTop: 2,
    lineHeight: 17,
  },
  todaySub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 10,
    color: Colors.textMuted,
    lineHeight: 13,
  },
  quickActionsExpander: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    borderRadius: 18,
    backgroundColor: 'rgba(28, 16, 51, 0.048)',
  },
  quickActionsExpanderText: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    color: Colors.primary,
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
  commEmptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  commEmptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F0FF',
  },
  commEmptyTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.md,
    color: Colors.textDark,
    marginBottom: 2,
  },
  commEmptyText: {
    fontFamily: Fonts.sansRegular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: 18,
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

  // ─── Recommended reads ───────────────────────────────────────────
  recReadsScroll: {
    paddingVertical: 4,
    paddingRight: 16,
    gap: 10,
  },
  recReadCard: {
    width: 180,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 10,
    gap: 8,
  },
  recReadIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recReadTopic: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    color: Colors.primary,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  recReadTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: Colors.textDark,
    lineHeight: 19,
    letterSpacing: -0.1,
  },
  recReadFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  recReadMeta: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: Colors.textMuted,
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
    aspectRatio: 1.25,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  jumpIconChip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F0FF',
  },
  jumpTileLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    textAlign: 'center',
    color: Colors.textDark,
    letterSpacing: 0.1,
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
    paddingHorizontal: Spacing.xl,
    // Cap at 88% of viewport so tall content scrolls inside the sheet
    // rather than pushing the top of the sheet off-screen.
    maxHeight: '88%',
  },
  sheetScrollContent: {
    paddingBottom: 30,
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
  sheetIdentityCard: {
    backgroundColor: '#F5F0FF',
    borderRadius: 14,
    padding: 14,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#EDE9F6',
  },
  sheetIdentityTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  sheetAvatarPhoto: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  sheetAvatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  sheetAvatarFallbackTxt: {
    fontFamily: Fonts.sansBold,
    fontSize: 20,
    color: '#ffffff',
  },
  sheetAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetEditBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E5E1EE',
  },
  sheetStatRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#F0EDF5',
  },
  sheetStat: {
    flex: 1,
    alignItems: 'center',
  },
  sheetStatValue: {
    fontFamily: Fonts.sansBold,
    fontSize: 17,
    color: Colors.textDark,
    letterSpacing: -0.2,
  },
  sheetStatLabel: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    textTransform: 'lowercase',
  },
  sheetStatDivider: {
    width: 1,
    backgroundColor: '#F0EDF5',
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
  kidChipRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    gap: 8,
  },
  kidChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#ffffff',
    maxWidth: 200,
  },
  kidChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  kidChipAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primarySoft,
  },
  kidChipAvatarActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  kidChipInitial: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
    color: Colors.primary,
  },
  kidChipInitialActive: { color: '#ffffff' },
  kidChipName: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
    color: Colors.textDark,
    maxWidth: 110,
  },
  kidChipNameActive: { color: '#ffffff' },
  kidChipMeta: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  kidChipMetaActive: { color: 'rgba(255,255,255,0.85)' },
  kidEmptyLine: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: Colors.textMuted,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    fontStyle: 'italic',
  },
  sheetName: {
    fontFamily: Fonts.sansBold,
    fontSize: 18,
    color: Colors.textDark,
    letterSpacing: -0.2,
  },
  sheetEmail: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
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
    borderRadius: 10,
    backgroundColor: '#F5F0FF',
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
