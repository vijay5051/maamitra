import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import Svg, {
  Path,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Circle,
} from 'react-native-svg';
import { useWellnessStore, MOOD_DATA, MOOD_RESPONSES } from '../../store/useWellnessStore';
import { useProfileStore } from '../../store/useProfileStore';
import { useAuthStore } from '../../store/useAuthStore';
import { syncWellnessData } from '../../services/firebase';
import Card from '../../components/ui/Card';
import GradientButton from '../../components/ui/GradientButton';
import { YOGA_SESSIONS, YogaSession } from '../../data/yogaSessions';
import { filterByAudience, parentGenderToAudience } from '../../data/audience';
import YogaModalComponent from '../../components/wellness/YogaModal';
import ContextualAskChip from '../../components/ui/ContextualAskChip';
import { Illustration } from '../../components/ui/Illustration';
import { AppIcon } from '../../components/ui/AppIcon';
import { Confetti } from '../../components/ui/Confetti';
import type { IllustrationName } from '../../lib/illustrations';
import { successBump } from '../../lib/haptics';
import { Fonts } from '../../constants/theme';
import { Colors } from '../../constants/theme';

// Score → illustration mapping. Score 5 (best) → glowing, score 1 (lowest) → overwhelmed.
const MOOD_ILLUSTRATION: Record<number, IllustrationName> = {
  5: 'mood1',
  4: 'mood2',
  3: 'mood3',
  2: 'mood4',
  1: 'mood5',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Mood tints ────────────────────────────────────────────────────────────────

const MOOD_TINTS: Record<number, string> = {
  5: 'rgba(52,211,153,0.08)',   // Great — sage
  4: 'rgba(96,165,250,0.08)',   // Good  — sky
  3: 'rgba(245,158,11,0.08)',   // Okay  — gold
  2: Colors.primaryAlpha08,   // Low   — plum
  1: 'rgba(28, 16, 51, 0.048)',   // Tough — rose
};

// ─── MoodEmojiItem ─────────────────────────────────────────────────────────────

function MoodEmojiItem({
  item,
  isSelected,
  onPress,
}: {
  item: { score: 1 | 2 | 3 | 4 | 5; emoji: string; label: string };
  isSelected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(isSelected ? 1.3 : 0.85);

  const handlePress = useCallback(() => {
    scale.value = withSpring(1.3, { damping: 10, stiffness: 200 });
    onPress();
  }, [onPress, scale]);

  // Keep scale in sync when isSelected changes from outside
  React.useEffect(() => {
    scale.value = withSpring(isSelected ? 1.3 : 0.85, { damping: 12, stiffness: 180 });
  }, [isSelected, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: isSelected ? 1 : 0.5,
  }));

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      style={moodStyles.moodBtn}
    >
      <Animated.View style={[moodStyles.emojiContainer, animStyle]}>
        <Illustration
          name={MOOD_ILLUSTRATION[item.score]}
          style={moodStyles.moodImg}
          contentFit="contain"
          accessibilityLabel={item.label}
        />
      </Animated.View>
      <Text style={[moodStyles.moodLabel, isSelected && moodStyles.moodLabelSelected]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── MoodSelector ─────────────────────────────────────────────────────────────

function MoodSelector({
  selectedScore,
  onSelect,
}: {
  selectedScore: number | null;
  onSelect: (score: 1 | 2 | 3 | 4 | 5) => void;
}) {
  return (
    <View style={moodStyles.row}>
      {MOOD_DATA.map((m) => (
        <MoodEmojiItem
          key={m.score}
          item={m}
          isSelected={selectedScore === m.score}
          onPress={() => onSelect(m.score)}
        />
      ))}
    </View>
  );
}

const moodStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  moodBtn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  emojiContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodImg: {
    width: 48,
    height: 48,
  },
  moodLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  moodLabelSelected: {
    color: Colors.primary,
    fontFamily: Fonts.sansBold,
  },
});

// ─── MoodChart ────────────────────────────────────────────────────────────────

function MoodChart() {
  const maxScore = 5;
  const barMaxHeight = 72;
  const getWeekHistoryFor = useWellnessStore((s) => s.getWeekHistoryFor);
  const getMonthHistoryFor = useWellnessStore((s) => s.getMonthHistoryFor);
  // Subscribe to moodHistory so the chart re-renders when entries change
  const moodHistory = useWellnessStore((s) => s.moodHistory);

  // ── Week view anchor ──────────────────────────────────────────────────
  // Anchored on Monday of the currently-viewed week. ← / → shift by 7 days.
  const today = useMemo(() => new Date(), []);
  const thisMonday = useMemo(() => {
    const d = new Date(today);
    const dow = d.getDay();
    d.setDate(d.getDate() - ((dow + 6) % 7));
    d.setHours(0, 0, 0, 0);
    return d;
  }, [today]);

  const [weekAnchor, setWeekAnchor] = useState<Date>(thisMonday);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calMonthAnchor, setCalMonthAnchor] = useState<Date>(() => {
    const d = new Date(today);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const weekHistory = useMemo(() => getWeekHistoryFor(weekAnchor), [getWeekHistoryFor, weekAnchor, moodHistory]);

  // Day columns (abbr + day-of-month + isToday) derived from weekAnchor
  const dayColumns = useMemo(() => {
    const abbr = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekAnchor);
      d.setDate(weekAnchor.getDate() + i);
      const isToday =
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate();
      return { abbr: abbr[i], day: d.getDate(), isToday };
    });
  }, [weekAnchor, today]);

  // Week range title — "Apr 15 – 21" or "Apr 29 – May 5"
  const weekRangeLabel = useMemo(() => {
    const start = new Date(weekAnchor);
    const end = new Date(weekAnchor);
    end.setDate(start.getDate() + 6);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const sameMonth = start.getMonth() === end.getMonth();
    const sameYear = start.getFullYear() === end.getFullYear();
    if (sameMonth) return `${months[start.getMonth()]} ${start.getDate()} – ${end.getDate()}`;
    return `${months[start.getMonth()]} ${start.getDate()} – ${months[end.getMonth()]} ${end.getDate()}${sameYear ? '' : `, ${end.getFullYear()}`}`;
  }, [weekAnchor]);

  const isThisWeek = weekAnchor.getTime() === thisMonday.getTime();

  const shiftWeek = (deltaDays: number) => {
    const d = new Date(weekAnchor);
    d.setDate(d.getDate() + deltaDays);
    setWeekAnchor(d);
  };

  // Weekly summary
  const nonNull = weekHistory.filter(Boolean) as Array<{ score: number; emoji: string; date: string }>;
  let summaryText = '';
  if (nonNull.length > 0) {
    const best = nonNull.reduce((a, b) => (b.score > a.score ? b : a));
    const bestMoodData = MOOD_DATA.find((m) => m.score === best.score);
    const count = nonNull.filter((e) => e.score === best.score).length;
    summaryText = `You felt ${bestMoodData?.label.toLowerCase() ?? 'well'} ${count} out of 7 days`;
  } else {
    summaryText = isThisWeek
      ? 'Tap a mood above to start tracking ✨'
      : 'No moods logged for this week';
  }

  // ── Month calendar ───────────────────────────────────────────────────
  const calMonthLabel = useMemo(() => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[calMonthAnchor.getMonth()]} ${calMonthAnchor.getFullYear()}`;
  }, [calMonthAnchor]);

  const monthDays = useMemo(
    () => getMonthHistoryFor(calMonthAnchor.getFullYear(), calMonthAnchor.getMonth()),
    [getMonthHistoryFor, calMonthAnchor, moodHistory],
  );

  // Leading blanks so the 1st lands on the right day column (Mon = 0)
  const firstDayOffset = useMemo(() => {
    const dow = new Date(calMonthAnchor.getFullYear(), calMonthAnchor.getMonth(), 1).getDay();
    return (dow + 6) % 7; // 0 = Mon .. 6 = Sun
  }, [calMonthAnchor]);

  const shiftCalMonth = (deltaMonths: number) => {
    const d = new Date(calMonthAnchor);
    d.setMonth(d.getMonth() + deltaMonths);
    setCalMonthAnchor(d);
  };

  const isFutureMonth =
    calMonthAnchor.getFullYear() > today.getFullYear() ||
    (calMonthAnchor.getFullYear() === today.getFullYear() &&
      calMonthAnchor.getMonth() >= today.getMonth());

  return (
    <View style={chartStyles.container}>
      {/* Header row: label + nav */}
      <View style={chartStyles.headerRow}>
        <Text style={chartStyles.label}>{weekRangeLabel}</Text>
        <View style={chartStyles.navRow}>
          <TouchableOpacity
            onPress={() => shiftWeek(-7)}
            style={chartStyles.navBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AppIcon name="nav.back" size={16} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => shiftWeek(7)}
            disabled={isThisWeek}
            style={[chartStyles.navBtn, isThisWeek && { opacity: 0.3 }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AppIcon name="nav.forward" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bar chart — shown only if there's at least one mood logged this week.
          When empty, the chart was visually heavy + meaningless; the summary
          card below covers the empty state cleanly. */}
      {nonNull.length > 0 && (
        <View style={chartStyles.barsRow}>
          {weekHistory.map((entry, i) => {
            const { abbr, day, isToday } = dayColumns[i];
            const heightPct = entry ? (entry.score / maxScore) : 0;
            return (
              <View key={i} style={chartStyles.barCol}>
                <View style={[chartStyles.barTrack, { height: barMaxHeight }]}>
                  {entry ? (
                    <LinearGradient
                      colors={isToday ? [Colors.primary, Colors.primary] : ['#F4B3CC', '#C9A8E0']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={[
                        chartStyles.barFill,
                        { height: Math.max(8, barMaxHeight * heightPct) },
                      ]}
                    />
                  ) : (
                    <View style={[chartStyles.barEmpty, { height: 6 }]} />
                  )}
                  {entry && (
                    <Text style={chartStyles.barEmoji}>{entry.emoji}</Text>
                  )}
                </View>
                <Text style={[chartStyles.barDayLabel, isToday && chartStyles.barDayLabelToday]}>
                  {abbr}
                </Text>
                <Text style={[chartStyles.barDateLabel, isToday && chartStyles.barDateLabelToday]}>
                  {isToday ? 'Today' : day}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Summary */}
      <View style={chartStyles.summaryCard}>
        <View style={chartStyles.summaryBorder} />
        <Text style={chartStyles.summaryText}>{summaryText}</Text>
      </View>

      {/* Calendar toggle */}
      <TouchableOpacity
        onPress={() => setShowCalendar((v) => !v)}
        activeOpacity={0.75}
        style={chartStyles.calToggle}
      >
        <AppIcon name="object.calendar" size={14} color={Colors.primary} />
        <Text style={chartStyles.calToggleText}>
          {showCalendar ? 'Hide full history' : 'View full history'}
        </Text>
        <AppIcon
          name={showCalendar ? 'action.collapse' : 'action.expand'}
          size={14}
          color={Colors.primary}
        />
      </TouchableOpacity>

      {showCalendar && (
        <View style={chartStyles.calendarWrap}>
          {/* Month header */}
          <View style={chartStyles.calHeaderRow}>
            <TouchableOpacity onPress={() => shiftCalMonth(-1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <AppIcon name="nav.back" size={18} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={chartStyles.calMonthLabel}>{calMonthLabel}</Text>
            <TouchableOpacity
              onPress={() => shiftCalMonth(1)}
              disabled={isFutureMonth}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppIcon name="nav.forward" size={18} color={isFutureMonth ? '#D1D5DB' : Colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Weekday header */}
          <View style={chartStyles.calWeekdaysRow}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <Text key={i} style={chartStyles.calWeekday}>{d}</Text>
            ))}
          </View>

          {/* Days grid */}
          <View style={chartStyles.calGrid}>
            {Array.from({ length: firstDayOffset }).map((_, i) => (
              <View key={`blank-${i}`} style={chartStyles.calCell} />
            ))}
            {monthDays.map(({ date, entry }) => {
              const dayNum = parseInt(date.slice(-2), 10);
              const isToday = date === (() => {
                const t = new Date();
                return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
              })();
              const bg = entry ? MOOD_TINTS[entry.score as 1 | 2 | 3 | 4 | 5] : '#F3F0FA';
              return (
                <View
                  key={date}
                  style={[
                    chartStyles.calCell,
                    chartStyles.calCellFilled,
                    { backgroundColor: bg },
                    isToday && chartStyles.calCellToday,
                  ]}
                >
                  <Text style={[chartStyles.calCellDay, isToday && chartStyles.calCellDayToday]}>
                    {dayNum}
                  </Text>
                  {entry ? (
                    <Text style={chartStyles.calCellEmoji}>{entry.emoji}</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: { marginTop: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  label: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    color: '#C4B5D4',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  navRow: {
    flexDirection: 'row',
    gap: 6,
  },
  navBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primaryAlpha08,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
  },
  calToggleText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: Colors.primary,
  },
  calendarWrap: {
    marginTop: 8,
    padding: 14,
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EDE9F6',
  },
  calHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calMonthLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    color: '#1C1033',
  },
  calWeekdaysRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  calWeekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Fonts.sansSemiBold,
    fontSize: 10,
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 2,
  },
  calCellFilled: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F0FA',
  },
  calCellToday: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  calCellDay: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: '#6B7280',
  },
  calCellDayToday: {
    color: Colors.primary,
    fontFamily: Fonts.sansBold,
  },
  calCellEmoji: {
    fontSize: 14,
    lineHeight: 16,
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  barTrack: {
    width: '62%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
  },
  barFill: {
    width: '100%',
    borderRadius: 8,
    alignItems: 'center',
  },
  barEmpty: {
    width: '60%',
    backgroundColor: '#EDE9F6',
    borderRadius: 4,
  },
  barEmoji: {
    position: 'absolute',
    top: -18,
    fontSize: 14,
  },
  barDayLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 10,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  barDayLabelToday: {
    color: Colors.primary,
    fontFamily: Fonts.sansBold,
  },
  barDateLabel: {
    fontFamily: Fonts.sansRegular,
    fontSize: 10,
    color: '#9CA3AF',
  },
  barDateLabelToday: {
    color: Colors.primary,
    fontFamily: Fonts.sansBold,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F4FF',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    overflow: 'hidden',
  },
  summaryBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  summaryText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#1C1033',
    marginLeft: 10,
  },
});

// ─── YogaGallery ──────────────────────────────────────────────────────────────

// Flattened from a rotating rose/purple/green/blue palette to a single
// tonal brand-purple. Every card reads consistently now.
const YOGA_CARD_GRADIENTS: [string, string][] = [
  [Colors.primary, '#6d28d9'],
  [Colors.primary, '#6d28d9'],
  [Colors.primary, '#6d28d9'],
  ['#F59E0B', Colors.primary],
];

function poseToYogaIllustration(name: string): IllustrationName | null {
  const n = (name || '').toLowerCase();
  if (n.includes('cat') && n.includes('cow')) return 'yogaCatCow';
  if (n.includes('child')) return 'yogaChildsPose';
  if (n.includes('butterfly')) return 'yogaButterfly';
  if (n.includes('pelvic floor') && n.includes('breath')) return 'yogaPelvicFloorBreathing';
  if (n.includes('heel slide')) return 'yogaHeelSlides';
  if (n.includes('dead bug')) return 'yogaDeadBug';
  if (n.includes('clamshell')) return 'yogaClamshell';
  if (n.includes('seated twist') || (n.includes('gentle') && n.includes('twist'))) return 'yogaSeatedTwist';
  if (n.includes('om') && n.includes('baby')) return 'yogaSeatedOmBaby';
  if (n.includes('bicycle') && n.includes('baby')) return 'yogaBabyBicycle';
  if ((n.includes('mama') || n.includes('bear')) && n.includes('plank')) return 'yogaMamaPlank';
  if (n.includes('baby cobra')) return 'yogaBabyCobra';
  if (n.includes('rolling hug')) return 'yogaRollingHug';
  if (n.includes('4-7-8') || (n.includes('478') && n.includes('breath'))) return 'yogaBreathing478';
  if (n.includes('standing forward fold')) return 'yogaStandingForwardFold';
  if (n.includes('wide-legged') || n.includes('wide legged')) return 'yogaWideLeggedFold';
  if (n.includes('seated meditation')) return 'yogaSeatedMeditation';
  if (n.includes('nidra')) return 'yogaNidra';
  if (n.includes('happy baby')) return 'yogaHappyBaby';
  if (n.includes('downward dog')) return 'yogaDownwardDog';
  if (n.includes('warrior ii') || n.includes('warrior 2')) return 'yogaWarrior2';
  if (n.includes('eagle arms')) return 'yogaEagleArms';
  if (n.includes('thread the needle')) return 'yogaThreadTheNeedle';
  if (n.includes('seated forward') || n.includes('seated fold')) return 'yogaSeatedForward';
  if (n.includes('bridge')) return 'yogaBridge';
  if (n.includes('pelvic tilt')) return 'yogaPelvicTilt';
  if (n.includes('pelvic')) return 'yogaPelvicTilt';
  if (n.includes('supine') && n.includes('twist')) return 'yogaSupineTwist';
  if (n.includes('legs') && n.includes('wall')) return 'yogaLegsUpWall';
  if (n.includes('savasana') || n.includes('corpse')) return 'yogaSavasana';
  return null;
}

function illustrationForYogaSession(session: YogaSession): IllustrationName {
  for (const pose of session.poses) {
    const match = poseToYogaIllustration(pose.name);
    if (match) return match;
  }
  // Reasonable visual fallback when no specific pose matches yet — savasana
  // reads as "calm yoga" and is the closest universal motif.
  return 'yogaSavasana';
}

function YogaGallery({
  sessions,
  onPress,
}: {
  sessions: YogaSession[];
  onPress: (session: YogaSession) => void;
}) {
  return (
    <View style={yogaGalleryStyles.wrapper}>
      <ScrollView
        horizontal
        pagingEnabled={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={yogaGalleryStyles.scrollContent}
      >
        {sessions.map((session, index) => {
          const cardWidth = 220;
          const illus = illustrationForYogaSession(session);

          return (
            <TouchableOpacity
              key={session.id}
              activeOpacity={0.85}
              onPress={() => onPress(session)}
              style={[
                yogaGalleryStyles.card,
                { width: cardWidth },
                index < sessions.length - 1 && { marginRight: 12 },
              ]}
            >
              <Illustration
                name={illus}
                style={yogaGalleryStyles.cardIllus}
                contentFit="cover"
              />
              {/* Soft scrim so the cream illustration tone reads against
                  white text and pills, without visually muddying the
                  pose drawing. */}
              <View style={yogaGalleryStyles.cardScrim} pointerEvents="none" />

              <View style={yogaGalleryStyles.pillsRow}>
                <View style={yogaGalleryStyles.pill}>
                  <AppIcon name="object.history" size={11} color="#1C1033" />
                  <Text style={yogaGalleryStyles.pillText}>{session.duration} min</Text>
                </View>
                <View style={yogaGalleryStyles.pill}>
                  <Text style={yogaGalleryStyles.pillText}>{session.level}</Text>
                </View>
              </View>

              <View style={yogaGalleryStyles.bottomRow}>
                <Text style={yogaGalleryStyles.sessionName} numberOfLines={2}>
                  {session.name}
                </Text>
                <View style={yogaGalleryStyles.playBtn}>
                  <AppIcon name="object.play" size={20} color="#ffffff" />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={yogaGalleryStyles.rightFade} pointerEvents="none">
        <LinearGradient
          colors={['transparent', '#FAFAFB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
}

const yogaGalleryStyles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  card: {
    height: 240,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'space-between',
    backgroundColor: '#FFFCF7',
    borderWidth: 1,
    borderColor: '#F0EDF5',
    padding: 14,
  },
  cardIllus: {
    ...StyleSheet.absoluteFillObject,
  },
  cardScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28, 16, 51, 0.0)',
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  pillText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: '#1C1033',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  sessionName: {
    fontFamily: Fonts.sansBold,
    fontSize: 16,
    color: '#1C1033',
    flex: 1,
    lineHeight: 22,
    textShadowColor: 'rgba(255, 252, 247, 0.85)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2, // optical centering for play icon
    boxShadow: '0px 4px 12px rgba(109, 26, 122, 0.28)',
  },
  rightFade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 4,
    width: 40,
  },
});

// ─── HealthCondModal ───────────────────────────────────────────────────────────

function HealthCondModal({
  visible,
  onDone,
}: {
  visible: boolean;
  onDone: (conditions: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const HEALTH_CONDITION_OPTIONS = [
    'Recent C-Section', 'High Blood Pressure', 'Gestational Diabetes',
    'Placenta Previa', 'Back Pain', 'Diastasis Recti',
    'Anxiety/Depression', 'None of the above',
  ];

  const CONDITION_KEY_MAP: Record<string, string> = {
    'Recent C-Section': 'C-section recovery',
    'High Blood Pressure': 'Hypertension',
    'Gestational Diabetes': 'Gestational diabetes',
    'Placenta Previa': 'Placenta previa',
    'Back Pain': 'Severe back pain',
    'Diastasis Recti': 'Diastasis recti',
    'Anxiety/Depression': 'Anxiety',
  };

  const toggle = (item: string) => {
    if (item === 'None of the above') {
      setSelected(['None of the above']);
      return;
    }
    setSelected((prev) =>
      prev.includes(item)
        ? prev.filter((a) => a !== item)
        : [...prev.filter((a) => a !== 'None of the above'), item]
    );
  };

  const handleDone = () => {
    const keys = selected
      .filter((s) => s !== 'None of the above')
      .map((s) => CONDITION_KEY_MAP[s])
      .filter(Boolean);
    onDone(keys);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={condStyles.overlay}>
        <View style={condStyles.sheet}>
          <View style={condStyles.handle} />
          <Text style={condStyles.title}>Any health conditions? 🌿</Text>
          <Text style={condStyles.subtitle}>
            This helps us suggest safe yoga sessions for you
          </Text>
          <View style={condStyles.chipsWrap}>
            {HEALTH_CONDITION_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[condStyles.chip, selected.includes(opt) && condStyles.chipSelected]}
                onPress={() => toggle(opt)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    condStyles.chipText,
                    selected.includes(opt) && condStyles.chipTextSelected,
                  ]}
                >
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <GradientButton title="Save & See Sessions" onPress={handleDone} />
        </View>
      </View>
    </Modal>
  );
}

const condStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bgLight,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 44,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#EDE9F6',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: { fontFamily: Fonts.sansBold, fontSize: 20, color: '#1C1033', marginBottom: 6 },
  subtitle: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 20,
    lineHeight: 20,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  chip: {
    borderWidth: 1.5,
    borderColor: '#EDE9F6',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: Colors.cardBg,
  },
  chipSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryAlpha05 },
  chipText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: '#9CA3AF' },
  chipTextSelected: { fontFamily: Fonts.sansBold, color: Colors.primary },
});

// ─── Mental Tips ──────────────────────────────────────────────────────────────
// Emojis swapped for outline Ionicons. Content is now derived from the
// viewer's role + stage + active kid age so the tips speak to THIS
// parent, not a generic postpartum mother.

type MentalTip = { icon: keyof typeof Ionicons.glyphMap; text: string };

interface TipContext {
  parentGender: 'mother' | 'father' | 'other' | '';
  stage?: 'pregnant' | 'newborn' | null;
  // Primary-kid first name (for natural-sounding copy) and age bucket.
  kidName?: string;
  ageBucket?: 'expecting' | 'newborn' | 'infant' | 'toddler' | 'older' | 'none';
}

function ageBucketFor(dob?: string | null, isExpecting?: boolean): TipContext['ageBucket'] {
  if (!dob) return 'none';
  if (isExpecting) return 'expecting';
  const diffMs = Date.now() - new Date(dob).getTime();
  const months = diffMs / (1000 * 60 * 60 * 24 * 30.44);
  if (months < 0) return 'expecting';
  if (months < 3) return 'newborn';
  if (months < 12) return 'infant';
  if (months < 36) return 'toddler';
  return 'older';
}

/**
 * Build a context-aware list of mental-wellness tips. Tips are tailored on
 * three axes:
 *   - Parent role (mother / father / other caregiver)
 *   - Stage bucket (expecting vs post-arrival)
 *   - Kid's age (newborn, infant, toddler, older)
 * Uses the kid's first name when available so the copy reads personal.
 */
function buildMentalTips(ctx: TipContext): MentalTip[] {
  const { parentGender, ageBucket, kidName } = ctx;
  const who = kidName && kidName !== 'Little one' ? kidName : 'your baby';
  const isExpecting = ageBucket === 'expecting';
  const isNewborn = ageBucket === 'newborn';
  const isInfant = ageBucket === 'infant' || isNewborn;
  const isToddler = ageBucket === 'toddler';
  const isOlder = ageBucket === 'older';

  // Father-specific library
  if (parentGender === 'father') {
    if (isExpecting) {
      return [
        { icon: 'heart-outline', text: 'Your partner\'s hormones are doing heavy work — your calm presence lowers her stress more than you think' },
        { icon: 'walk-outline', text: '20 minutes of walking 3x/week keeps paternal anxiety lower in the months before birth' },
        { icon: 'moon-outline', text: 'Sleep-bank now — protect your own sleep for the last month. You\'ll need it.' },
        { icon: 'chatbubbles-outline', text: 'Talk to one other dad who\'s a step ahead. The normalisation is gold.' },
        { icon: 'book-outline', text: 'Read one article about paternal postpartum depression — 1 in 10 dads get it and it\'s easier to spot early' },
      ];
    }
    if (isNewborn) {
      return [
        { icon: 'bed-outline', text: 'Split night duty in 5-hour shifts — "helping" isn\'t enough, splitting saves marriages' },
        { icon: 'body-outline', text: `Skin-to-skin with ${who}: shirt off, 20 minutes daily. Drops your cortisol, raises your oxytocin.` },
        { icon: 'alert-circle-outline', text: 'Watch yourself for irritability, withdrawal, or over-work — those are male PPD signs' },
        { icon: 'people-outline', text: 'Protect your partner\'s sleep aggressively. One 5-hour block is her daily medicine.' },
        { icon: 'barbell-outline', text: 'Exercise 3x/week — strongest buffer against new-dad burnout the research has found' },
      ];
    }
    if (isToddler || isOlder) {
      return [
        { icon: 'basketball-outline', text: `Rough-and-tumble play with ${who} builds their emotional regulation — and yours` },
        { icon: 'moon-outline', text: 'Claim bedtime routine as yours — stories, songs, lights out. It\'s the strongest daily bond there is.' },
        { icon: 'walk-outline', text: 'A daily 20-min walk, phone in your pocket, clears more than any productivity hack' },
        { icon: 'chatbubbles-outline', text: 'One close dad friend you see monthly — not optional, it\'s mental infrastructure' },
        { icon: 'cafe-outline', text: 'Protect one weekly "me" slot — gym, chai, driving alone. You return better for everyone.' },
      ];
    }
    // Fallback (no kid yet / planning)
    return [
      { icon: 'leaf-outline', text: '5 minutes of deep breathing daily rewires your nervous system — works for men too' },
      { icon: 'walk-outline', text: 'A 20-minute walk most days is the single best mood intervention there is' },
      { icon: 'chatbubbles-outline', text: 'Men talk about feelings 3x less than women — one honest conversation a week changes this' },
      { icon: 'moon-outline', text: 'Sleep quality is the biggest predictor of your daily mental state. Treat it as non-negotiable.' },
      { icon: 'people-outline', text: 'Two friendships you actively maintain is the minimum viable male mental-health setup' },
    ];
  }

  // "Other" caregiver — generic but present-tense
  if (parentGender === 'other') {
    return [
      { icon: 'leaf-outline', text: '5 minutes of deep breathing daily — it rewires your nervous system' },
      { icon: 'water-outline', text: 'Hydration affects mood — aim for 8 glasses of water a day' },
      { icon: 'moon-outline', text: `Rest when ${who} rests — your recovery matters too` },
      { icon: 'people-outline', text: 'Caregiving is isolating. One conversation a day with another adult is medicine.' },
      { icon: 'heart-outline', text: 'Your own check-in matters. Set a daily phone reminder to ask: how am I actually?' },
    ];
  }

  // Default: mother
  if (isExpecting) {
    return [
      { icon: 'leaf-outline', text: '5 minutes of deep breathing daily — lowers cortisol for both you and baby' },
      { icon: 'water-outline', text: 'Hydration changes mood quickly — aim for 8–10 glasses a day in pregnancy' },
      { icon: 'moon-outline', text: 'Sleep on your left side with a pillow between your knees — best circulation for both of you' },
      { icon: 'chatbubbles-outline', text: 'Talk to one other pregnant woman this week — shared experience is half the healing' },
      { icon: 'book-outline', text: 'Spend 10 minutes learning one thing about birth each day — less fear, more agency' },
    ];
  }
  if (isNewborn) {
    return [
      { icon: 'moon-outline', text: `Sleep when ${who} sleeps is real advice — rest is medicine, not laziness` },
      { icon: 'water-outline', text: 'Keep a water bottle next to wherever you feed — dehydration tanks milk supply and mood together' },
      { icon: 'people-outline', text: 'Isolation is the #1 risk factor for postpartum depression — one call, one visit, one walk with a friend' },
      { icon: 'leaf-outline', text: '4-7-8 breathing during night feeds regulates your nervous system in 2 minutes' },
      { icon: 'alert-circle-outline', text: 'If the sadness lasts past week 3, it\'s not "baby blues" anymore — call your doctor' },
    ];
  }
  if (isInfant) {
    return [
      { icon: 'leaf-outline', text: '5 minutes of deep breathing daily — it rewires your nervous system' },
      { icon: 'water-outline', text: 'Hydration affects mood — aim for 8 glasses of water daily' },
      { icon: 'moon-outline', text: `Rest when ${who} rests — your recovery still matters at this stage` },
      { icon: 'people-outline', text: 'Share what you\'re feeling — isolation still makes the fourth trimester harder' },
      { icon: 'musical-notes-outline', text: 'Calm music during feeding soothes both of you' },
    ];
  }
  if (isToddler || isOlder) {
    return [
      { icon: 'cafe-outline', text: 'One protected hour a week that\'s yours — chai, book, nothing else. Non-negotiable.' },
      { icon: 'chatbubbles-outline', text: `Talking to ${who} about your feelings (simply) models emotional regulation — it rubs off` },
      { icon: 'moon-outline', text: 'Sleep quality drives your patience more than anything else at this age' },
      { icon: 'leaf-outline', text: '3 slow breaths before reacting to a tantrum — that pause is the whole parenting skill' },
      { icon: 'people-outline', text: 'One close mom friend you see regularly is the real daily-mental-health tool' },
    ];
  }
  // Fallback: planning / no kid
  return [
    { icon: 'leaf-outline', text: '5 minutes of deep breathing daily — it rewires your nervous system' },
    { icon: 'water-outline', text: 'Hydration affects mood — aim for 8 glasses of water daily' },
    { icon: 'moon-outline', text: 'Sleep quality is the biggest predictor of your daily mental state' },
    { icon: 'people-outline', text: 'One honest conversation a week is medicine — isolation is the real risk' },
    { icon: 'book-outline', text: '10 minutes of reading (anything not your phone) lowers stress measurably' },
  ];
}

function PullQuoteTip({ tip }: { tip: { icon: keyof typeof Ionicons.glyphMap; text: string } }) {
  return (
    <View style={tipStyles.card}>
      <View style={tipStyles.iconBox}>
        <Ionicons name={tip.icon} size={18} color={Colors.primary} />
      </View>
      <Text style={tipStyles.tipText}>{tip.text}</Text>
    </View>
  );
}

const tipStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#F0EDF5',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#1C1033',
    lineHeight: 19,
    flex: 1,
  },
});

// ─── Mood Divider Line ────────────────────────────────────────────────────────

function MoodDividerLine() {
  return (
    <LinearGradient
      colors={[Colors.primary, 'transparent']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={dividerStyles.line}
    />
  );
}

const dividerStyles = StyleSheet.create({
  line: { height: 1, borderRadius: 1, marginTop: 10, marginBottom: 2 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function WellnessScreen() {
  const insets = useSafeAreaInsets();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const scrollRef = useRef<any>(null);
  const moodSectionYRef = useRef<number>(0);
  const consumedFocusRef = useRef<string>('');
  const {
    logMood,
    healthConditions,
    setHealthConditions,
  } = useWellnessStore();
  const profile = useProfileStore((s) => s.profile);
  const { user } = useAuthStore();

  // Deep-link target: scroll the screen to the requested section once the
  // section's onLayout has fired. Re-attempts every 80 ms for ~600 ms in
  // case content above (hero illustration, condition banner) finishes
  // measuring after the param arrives.
  useEffect(() => {
    if (typeof focus !== 'string' || !focus) return;
    if (consumedFocusRef.current === focus) return;
    let attempts = 0;
    const tryScroll = () => {
      attempts++;
      const y = focus === 'mood' ? moodSectionYRef.current : 0;
      if (y > 0 || attempts > 8) {
        scrollRef.current?.scrollTo?.({ y: Math.max(0, y - 12), animated: true });
        consumedFocusRef.current = focus;
        return;
      }
      setTimeout(tryScroll, 80);
    };
    setTimeout(tryScroll, 80);
  }, [focus]);

  // Subscribe to moodHistory so we re-compute today's mood on rehydrate.
  // Zustand persist is async; useState-with-init would freeze the value to
  // whatever moodHistory was at first paint (empty), hiding saved moods.
  const moodHistory = useWellnessStore((s) => s.moodHistory);
  const todayMood = useMemo(() => {
    const today = (() => {
      const t = new Date();
      return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    })();
    return moodHistory.find((m: any) => m.date === today) ?? null;
  }, [moodHistory]);
  const selectedMoodScore = todayMood?.score ?? null;
  const moodResponse = todayMood ? MOOD_RESPONSES[todayMood.score] : null;

  const [showCondModal, setShowCondModal] = useState(false);
  const [selectedYogaSession, setSelectedYogaSession] = useState<YogaSession | null>(null);
  const [showYogaModal, setShowYogaModal] = useState(false);
  const [showMoodConfetti, setShowMoodConfetti] = useState(false);

  const handleMoodSelect = (score: 1 | 2 | 3 | 4 | 5) => {
    // Only celebrate the *first* mood log of the day — repeated taps shouldn't
    // re-fire confetti (would feel spammy if a user is just adjusting). The
    // selector below stays null until logMood completes its first write.
    const isFirstLogToday = selectedMoodScore == null;
    logMood(score);
    if (user?.uid) {
      const { moodHistory: latest } = useWellnessStore.getState();
      syncWellnessData(user.uid, latest, healthConditions);
    }
    if (isFirstLogToday) {
      setShowMoodConfetti(true);
      successBump();
    }
  };

  // First filter by audience (role-adaptive), then by health conditions.
  // When ENABLE_ROLE_ADAPTIVE_CONTENT is false in data/audience.ts the
  // audience filter is a no-op, so behaviour is unchanged until content
  // starts getting tagged.
  const parentGenderForAudience = useProfileStore((s) => s.parentGender);
  const kids = useProfileStore((s) => s.kids);
  const primaryKid = kids.find((k) => k.isExpecting) || kids[0] || null;
  const audienceFiltered = filterByAudience(
    YOGA_SESSIONS,
    parentGenderToAudience(parentGenderForAudience),
  );

  // Mental tips are generated per-user from role + stage + kid age so
  // they actually speak to THIS parent (previously a single hard-coded
  // "postpartum mother" list regardless of who was reading).
  const mentalTips = useMemo(
    () =>
      buildMentalTips({
        parentGender: ((parentGenderForAudience === 'father' ? 'mother' : parentGenderForAudience) as TipContext['parentGender']) || '',
        stage: profile?.stage ?? null,
        kidName: primaryKid?.name,
        ageBucket: ageBucketFor(primaryKid?.dob, primaryKid?.isExpecting),
      }),
    [parentGenderForAudience, profile?.stage, primaryKid?.name, primaryKid?.dob, primaryKid?.isExpecting],
  );

  // Copy strings that change with role + stage + kid.
  const mentalSectionTitle = useMemo(() => {
    return 'Mental wellness';
  }, [parentGenderForAudience]);

  const moodPromptCopy = useMemo(() => {
    const firstName = primaryKid?.name && primaryKid.name !== 'Little one' ? primaryKid.name : '';
    if (firstName && profile?.stage !== 'pregnant') return `How are you feeling today${firstName ? `, with ${firstName}` : ''}?`;
    if (profile?.stage === 'pregnant') return 'How are you feeling today, mama?';
    return 'How are you feeling today?';
  }, [parentGenderForAudience, profile?.stage, primaryKid?.name]);

  const headerSub = useMemo(() => {
    if (profile?.stage === 'pregnant') {
      return 'Pregnancy wellness for you';
    }
    return 'Postpartum care & recovery';
  }, [parentGenderForAudience, profile?.stage]);
  const conditionFiltered = healthConditions !== null
    ? audienceFiltered.filter(
        (s) => !s.contraindications.some((c) => healthConditions.includes(c))
      )
    : audienceFiltered;

  // Time-of-day priority. The first card in the gallery becomes the
  // hero; we don't want a "Morning Stretch" reading 11 PM. Score each
  // session by how well its name fits the current part of day; stable
  // sort so the rest of the original order is preserved.
  const filteredSessions = useMemo(() => {
    const hour = new Date().getHours();
    const isMorning = hour >= 5 && hour < 12;
    const isAfternoon = hour >= 12 && hour < 17;
    const isEvening = hour >= 17 && hour < 21;
    const isNight = hour >= 21 || hour < 5;

    function score(name: string): number {
      const n = name.toLowerCase();
      if (isNight) {
        if (n.includes('sleep')) return 100;
        if (n.includes('stress') || n.includes('calm') || n.includes('reset') || n.includes('tired')) return 90;
        if (n.includes('morning')) return 0;
        return 50;
      }
      if (isMorning) {
        if (n.includes('morning')) return 100;
        if (n.includes('postpartum') || n.includes('core')) return 85;
        if (n.includes('strength') || n.includes('dad')) return 80;
        if (n.includes('sleep')) return 0;
        return 60;
      }
      if (isAfternoon) {
        if (n.includes('postpartum') || n.includes('strength') || n.includes('baby') || n.includes('bonding')) return 90;
        if (n.includes('reset') || n.includes('tired')) return 80;
        if (n.includes('morning')) return 30;
        if (n.includes('sleep')) return 10;
        return 60;
      }
      if (isEvening) {
        if (n.includes('stress') || n.includes('calm')) return 95;
        if (n.includes('reset') || n.includes('tired')) return 90;
        if (n.includes('sleep')) return 80;
        if (n.includes('morning')) return 10;
        return 55;
      }
      return 50;
    }

    return [...conditionFiltered]
      .map((s, i) => ({ s, i, score: score(s.name) }))
      .sort((a, b) => (b.score - a.score) || (a.i - b.i))
      .map((x) => x.s);
  }, [conditionFiltered]);

  const moodCardTint = selectedMoodScore ? MOOD_TINTS[selectedMoodScore] : 'transparent';

  return (
    <View style={styles.container}>
      {/* ── Dark Gradient Header ── */}
      <LinearGradient
        colors={['#FFFFFF', '#FFFFFF', '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 14 }]}
      >
        <View style={styles.glowTopRight} pointerEvents="none" />
        <View style={styles.glowBottomLeft} pointerEvents="none" />
        <Text style={styles.headerTitle}>Wellness</Text>
        <Text style={styles.headerSub}>{headerSub}</Text>
      </LinearGradient>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.wellnessHeroWrap}>
          <Illustration name="wellnessHero" style={styles.wellnessHeroImg} contentFit="cover" />
        </View>

        <ContextualAskChip
          prompt={
            profile?.stage === 'pregnant'
              ? 'Ask about my energy and mood during pregnancy'
              : 'Ask about postpartum recovery and self-care'
          }
        />

        {/* Yoga section — moved above mood so sessions are visible without
            scrolling past the mood + chart on small screens. */}
        <Text style={styles.sectionTitle}>Yoga &amp; Movement</Text>

        <TouchableOpacity
          style={styles.condBanner}
          onPress={() => setShowCondModal(true)}
          activeOpacity={0.8}
        >
          <View style={styles.condBannerLeft}>
            <AppIcon name="object.options" size={14} color={Colors.primary} />
            <Text style={styles.condBannerText}>
              {healthConditions === null
                ? 'Personalise sessions for your health conditions'
                : 'Update health conditions'}
            </Text>
          </View>
          <AppIcon name="nav.forward" size={14} color="#A78BCA" />
        </TouchableOpacity>

        <YogaGallery
          sessions={filteredSessions}
          onPress={(session) => {
            setSelectedYogaSession(session);
            setShowYogaModal(true);
          }}
        />

        {/* Mood check-in */}
        <Card
          onLayout={(e: any) => {
            moodSectionYRef.current = e?.nativeEvent?.layout?.y ?? 0;
          }}
          style={{ ...styles.moodCard, backgroundColor: '#ffffff', marginTop: 20 }}
          shadow="md"
        >
          <Text style={styles.moodTitle}>{moodPromptCopy}</Text>
          <MoodSelector selectedScore={selectedMoodScore} onSelect={handleMoodSelect} />

          {moodResponse && (
            <>
              <MoodDividerLine />
              <View style={styles.moodResponse}>
                <Text style={styles.moodResponseText}>{moodResponse}</Text>
              </View>
            </>
          )}

          <MoodChart />
        </Card>

        {/* Mental Wellness tips — role + stage + kid-age tailored */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>{mentalSectionTitle}</Text>
        {mentalTips.map((tip, i) => (
          <PullQuoteTip key={i} tip={tip} />
        ))}
      </ScrollView>

      <HealthCondModal
        visible={showCondModal}
        onDone={(conditions) => {
          setHealthConditions(conditions);
          setShowCondModal(false);
          if (user?.uid) {
            const { moodHistory } = useWellnessStore.getState();
            syncWellnessData(user.uid, moodHistory, conditions);
          }
        }}
      />

      <YogaModalComponent
        session={selectedYogaSession}
        visible={showYogaModal}
        onClose={() => setShowYogaModal(false)}
      />

      <Confetti show={showMoodConfetti} onDone={() => setShowMoodConfetti(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  // Dark header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDF5',
  },
  glowTopRight: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'transparent',
    top: -60,
    right: -40,
  },
  glowBottomLeft: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'transparent',
    bottom: -40,
    left: -20,
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    color: '#1C1033',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  headerSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: '#6b7280',
  },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  wellnessHeroWrap: {
    marginBottom: 14,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#FFF8F1',
    aspectRatio: 12 / 5,
  },
  wellnessHeroImg: { width: '100%', height: '100%' },
  moodCard: { marginBottom: 24 },
  moodTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 16,
    color: '#1C1033',
    marginBottom: 12,
  },
  moodResponse: {
    backgroundColor: Colors.primaryAlpha05,
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  moodResponseText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#374151',
    lineHeight: 21,
  },
  sectionTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 18,
    color: '#1C1033',
    marginBottom: 12,
    marginTop: 8,
  },
  condCard: { alignItems: 'center', paddingVertical: 28, marginBottom: 8 },
  condIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(28, 16, 51, 0.054)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    alignSelf: 'center',
  },
  condTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 17,
    color: '#1C1033',
    marginBottom: 6,
  },
  condSubtitle: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 260,
  },
  condBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primaryAlpha05,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
  },
  condBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  condBannerText: { fontFamily: Fonts.sansRegular, fontSize: 12, color: Colors.primary, flex: 1 },
});
