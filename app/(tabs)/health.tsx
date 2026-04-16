import React, { useEffect, useRef, useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useVaccineSchedule } from '../../hooks/useVaccineSchedule';
import { GOVERNMENT_SCHEMES } from '../../data/schemes';
import { useActiveKid } from '../../hooks/useActiveKid';
import { useProfileStore } from '../../store/useProfileStore';
import Card from '../../components/ui/Card';
import VaccineCardComponent from '../../components/health/VaccineCard';
import { TabIcon } from '../../components/ui/AppIcon';
import { Fonts } from '../../constants/theme';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const ROSE   = '#E8487A';
const PLUM   = '#7C3AED';
const GOLD   = '#F59E0B';
const SAGE   = '#34D399';
const MIST   = '#EDE9F6';
const INK    = '#1C1033';
const STONE  = '#6B7280';

type SubTab = 'vaccines' | 'schemes' | 'myhealth';

const TABS: { key: SubTab; label: string; icon: string }[] = [
  { key: 'vaccines', label: 'Vaccines',  icon: 'shield-checkmark-outline' },
  { key: 'schemes',  label: 'Schemes',   icon: 'ribbon-outline' },
  { key: 'myhealth', label: 'My Health', icon: 'heart-outline' },
];

// ─── Sub-tab selector with animated sliding pill ───────────────────────────────

function SubTabSelector({
  active,
  onChange,
}: {
  active: SubTab;
  onChange: (t: SubTab) => void;
}) {
  const activeIndex = TABS.findIndex((t) => t.key === active);
  const pillX = useSharedValue(0);
  const tabWidth = useSharedValue(0);
  const prevIndexRef = useRef(activeIndex);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    // Each tab is flex:1 so pill width = total/3, gap=6 so effective slot = (total - 2*6) / 3
    tabWidth.value = (w - 12) / 3; // 2 gaps of 6
  };

  useEffect(() => {
    if (tabWidth.value === 0) return;
    const slotW = tabWidth.value + 6; // slot width + gap
    pillX.value = withTiming(activeIndex * slotW, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
    prevIndexRef.current = activeIndex;
  }, [activeIndex, tabWidth.value]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: tabWidth.value,
  }));

  return (
    <View style={subTabStyles.container} onLayout={handleLayout}>
      {/* Animated pill behind labels */}
      <Animated.View style={[subTabStyles.slidingPill, pillStyle]} pointerEvents="none">
        <LinearGradient
          colors={[ROSE, PLUM]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Tab buttons */}
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <TouchableOpacity
            key={t.key}
            onPress={() => onChange(t.key)}
            activeOpacity={0.8}
            style={subTabStyles.tab}
          >
            <TabIcon name={t.icon} active={isActive} />
            <Text style={[subTabStyles.tabText, isActive && subTabStyles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const subTabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF8FC',
    borderBottomWidth: 1,
    borderBottomColor: MIST,
    position: 'relative',
  },
  slidingPill: {
    position: 'absolute',
    top: 12,
    left: 16,
    height: 38, // matches paddingVertical 9 * 2 + ~20 content
    borderRadius: 20,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: MIST,
    backgroundColor: 'transparent',
  },
  tabText: {
    fontFamily: Fonts.sansMedium,
    color: '#A78BCA',
    fontSize: 12.5,
    zIndex: 2,
  },
  tabTextActive: {
    fontFamily: Fonts.sansBold,
    color: '#ffffff',
  },
});

// ─── Pulsing overdue ring for vaccine timeline dot ─────────────────────────────

function OverduePulseRing() {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 600, easing: Easing.out(Easing.ease) }),
        withTiming(1.0, { duration: 600, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(scale.value, [1.0, 1.5], [0.75, 0]),
  }));

  return (
    <Animated.View
      style={[vStyles.pulseRing, ringStyle]}
      pointerEvents="none"
    />
  );
}

// ─── Enhanced VaccineCard with premium timeline dots ──────────────────────────
// Wraps VaccineCardComponent and overlays a premium dot on top of the
// existing timeline column (position: absolute, top-left of the wrapper).

function PremiumVaccineWrapper({
  vaccine,
  isLast,
}: {
  vaccine: ReturnType<typeof useVaccineSchedule>[0];
  isLast: boolean;
}) {
  const isOverdue  = vaccine.status === 'overdue';
  const isDone     = vaccine.status === 'done';
  const isDueSoon  = vaccine.status === 'due-soon';
  const isUpcoming = vaccine.status === 'upcoming';

  const dotBg = isDone
    ? SAGE
    : isOverdue
    ? GOLD
    : isDueSoon
    ? ROSE
    : 'transparent';

  const dotBorder = isUpcoming ? MIST : 'transparent';

  return (
    // position: relative container so the overlay dot can be absolutely placed
    <View style={vStyles.wrapper}>
      {/* VaccineCard renders its own timeline dot at left ~6px, top ~18px */}
      <VaccineCardComponent vaccine={vaccine} isLast={isLast} />

      {/* Premium dot overlay — sits directly over the original dot */}
      <View style={vStyles.dotOverlay} pointerEvents="none">
        {isOverdue && <OverduePulseRing />}
        <View
          style={[
            vStyles.dot,
            {
              backgroundColor: dotBg,
              borderColor: isOverdue ? GOLD : dotBorder,
              borderWidth: isUpcoming || isOverdue ? 2 : 0,
            },
          ]}
        >
          {isDone && <Ionicons name="checkmark" size={8} color="#ffffff" />}
        </View>
      </View>
    </View>
  );
}

const vStyles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  dotOverlay: {
    position: 'absolute',
    // VaccineCard timeline column is 24px wide, dot top: paddingTop(14) + centered in dot area
    // dot is 12px dia at top:14; center = 14 + 6 = 20px. Our 13px dot: top = 14 + 6 - 6 = ~14
    top: 14,
    left: 6,
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  dot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: GOLD,
    backgroundColor: 'transparent',
  },
});

// ─── SchemeCard — animated accordion ─────────────────────────────────────────

const SCHEME_ICONS: Record<string, string> = {
  gs01: 'cash-outline',
  gs02: 'heart-outline',
  gs03: 'medkit-outline',
  gs04: 'nutrition-outline',
  gs05: 'ribbon-outline',
  gs06: 'water-outline',
};

function buildPersonalMessage(
  scheme: (typeof GOVERNMENT_SCHEMES)[0],
  kid: any,
  motherName: string,
): string | null {
  const name = kid?.name ?? 'your baby';
  const isExpecting = kid?.isExpecting ?? false;
  const isGirl = kid?.gender === 'girl';
  const ageMonths = kid?.ageInMonths ?? 0;

  switch (scheme.id) {
    case 'gs01':
      return isExpecting
        ? `You're expecting — register at your nearest PHC now to claim ₹1,400 at delivery. Don't miss this!`
        : null;
    case 'gs02':
      return isExpecting
        ? `As an expecting mother, you may be eligible for ₹5,000 across 3 instalments. Register in your first trimester.`
        : ageMonths <= 6
        ? `${motherName}, if you haven't claimed PMMVY for ${name}'s birth, check with your Anganwadi — you may still be eligible.`
        : null;
    case 'gs03':
      return ageMonths <= 72
        ? `${name} (${ageMonths}mo) qualifies for free developmental screening at your nearest Anganwadi centre.`
        : null;
    case 'gs04':
      return isExpecting
        ? `You're pregnant — visit your Anganwadi centre to get free Iron & Folic Acid supplements and nutritional support now.`
        : ageMonths < 72
        ? `${name} is under 6 — register at your Anganwadi for free nutritional meals, growth monitoring, and supplements.`
        : null;
    case 'gs05':
      return isGirl
        ? `You have a daughter! Open an SSY account for her now and earn 8.2% interest tax-free until she turns 21.`
        : null;
    case 'gs06':
      return isExpecting
        ? `Free IFA tablets during pregnancy are available at every government hospital. Ask your doctor or ASHA worker.`
        : `Free Iron & Folic Acid supplements for ${name} are available at your nearest PHC or Anganwadi — no paperwork needed.`;
    default:
      return null;
  }
}

function isRelevant(scheme: (typeof GOVERNMENT_SCHEMES)[0], kid: any): boolean {
  if (!kid) return true;
  const { tags } = scheme;
  if (tags.includes('all')) return true;
  if (tags.includes('pregnant') && kid.isExpecting) return true;
  if (tags.includes('newborn') && !kid.isExpecting) return true;
  if (tags.includes('all-kids') && !kid.isExpecting) return true;
  if (tags.includes('girl') && kid.gender === 'girl') return true;
  return false;
}

function SchemeCard({
  scheme,
  kid,
  motherName,
}: {
  scheme: (typeof GOVERNMENT_SCHEMES)[0];
  kid: any;
  motherName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [bodyHeight, setBodyHeight] = useState(0);
  const animHeight = useSharedValue(0);
  const animOpacity = useSharedValue(0);

  const relevant = isRelevant(scheme, kid);
  const personalMsg = buildPersonalMessage(scheme, kid, motherName);
  const schemeIcon = (SCHEME_ICONS[scheme.id] ?? 'document-text-outline') as any;

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    animHeight.value = withTiming(next ? bodyHeight : 0, {
      duration: 250,
      easing: Easing.out(Easing.cubic),
    });
    animOpacity.value = withTiming(next ? 1 : 0, { duration: 200 });
  };

  const bodyAnimStyle = useAnimatedStyle(() => ({
    height: animHeight.value,
    opacity: animOpacity.value,
  }));

  return (
    <View style={[scStyles.card, relevant && scStyles.cardRelevant]}>
      {/* Eligibility badge */}
      {relevant && (
        <View style={scStyles.eligibleBadge}>
          <Text style={scStyles.eligibleBadgeText}>Eligible ✓</Text>
        </View>
      )}
      {!relevant && (
        <View style={scStyles.checkBadge}>
          <Text style={scStyles.checkBadgeText}>Check eligibility</Text>
        </View>
      )}

      {/* Accordion header */}
      <TouchableOpacity onPress={toggle} activeOpacity={0.8} style={scStyles.header}>
        <View style={scStyles.iconWrap}>
          <Ionicons name={schemeIcon} size={22} color={PLUM} />
        </View>
        <View style={scStyles.headerInfo}>
          <Text style={scStyles.name}>{scheme.name}</Text>
          <Text style={scStyles.shortDesc}>{scheme.shortDesc}</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color="#9ca3af"
        />
      </TouchableOpacity>

      {/* Personalised callout — always visible if relevant */}
      {personalMsg && (
        <View style={scStyles.personalCallout}>
          <Ionicons name="person-circle-outline" size={15} color={PLUM} />
          <Text style={scStyles.personalText}>{personalMsg}</Text>
        </View>
      )}

      {/* Accordion body — animated height */}
      <Animated.View style={[{ overflow: 'hidden' }, bodyAnimStyle]}>
        <View
          style={scStyles.accordionBody}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0 && h !== bodyHeight) {
              setBodyHeight(h);
              if (expanded) animHeight.value = h;
            }
          }}
        >
          <Text style={scStyles.desc}>{scheme.description}</Text>

          <View style={scStyles.detailBlock}>
            <View style={scStyles.detailLabelRow}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#16a34a" />
              <Text style={scStyles.detailLabel}>Who can apply</Text>
            </View>
            <Text style={scStyles.detailText}>{scheme.eligibility}</Text>
          </View>

          <View style={scStyles.detailBlock}>
            <View style={scStyles.detailLabelRow}>
              <Ionicons name="gift-outline" size={14} color="#ec4899" />
              <Text style={scStyles.detailLabel}>What you get</Text>
            </View>
            <Text style={scStyles.detailText}>{scheme.benefit}</Text>
          </View>

          <View style={scStyles.detailBlock}>
            <View style={scStyles.detailLabelRow}>
              <Ionicons name="navigate-outline" size={14} color={PLUM} />
              <Text style={scStyles.detailLabel}>How to apply</Text>
            </View>
            <Text style={scStyles.detailText}>{scheme.howToApply}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Know More button — always visible */}
      <TouchableOpacity
        style={scStyles.linkBtn}
        onPress={() => Linking.openURL(scheme.url)}
        activeOpacity={0.8}
      >
        <Ionicons name="globe-outline" size={15} color={PLUM} />
        <Text style={scStyles.linkBtnText}>Know More & Apply</Text>
        <Ionicons name="arrow-forward" size={13} color={PLUM} />
      </TouchableOpacity>
    </View>
  );
}

const scStyles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: MIST,
    shadowColor: PLUM,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    boxShadow: '0px 2px 8px rgba(124,58,237,0.06)',
  } as any,
  cardRelevant: {
    borderColor: 'rgba(124,58,237,0.25)',
    backgroundColor: '#FFF8FC',
  },
  eligibleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: GOLD,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 10,
  },
  eligibleBadgeText: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    color: '#ffffff',
  },
  checkBadge: {
    alignSelf: 'flex-start',
    backgroundColor: MIST,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 10,
  },
  checkBadgeText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: STONE,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(124,58,237,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  name: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: INK,
    lineHeight: 19,
  },
  shortDesc: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  personalCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(124,58,237,0.06)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: PLUM,
  },
  personalText: {
    fontFamily: Fonts.sansMedium,
    flex: 1,
    fontSize: 13,
    color: '#4c1d95',
    lineHeight: 18,
  },
  accordionBody: {
    gap: 12,
    paddingBottom: 12,
  },
  desc: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
  detailBlock: { gap: 4 },
  detailLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detailLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 19,
    paddingLeft: 19,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(124,58,237,0.25)',
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 4,
    backgroundColor: 'rgba(124,58,237,0.04)',
  },
  linkBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: PLUM,
  },
});

// ─── Circular Progress Ring ────────────────────────────────────────────────────

const RING_DIAMETER = 64;
const STROKE_WIDTH  = 6;
const RADIUS        = (RING_DIAMETER - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type HealthStatus = 'overdue' | 'due-soon' | 'up-to-date';

function ringColor(status: HealthStatus): string {
  if (status === 'up-to-date') return SAGE;
  if (status === 'due-soon')   return GOLD;
  return ROSE;
}

function progressRatio(lastDone: string | null, freqDays: number): number {
  if (!lastDone) return 0;
  const elapsed = (Date.now() - new Date(lastDone).getTime()) / 864e5;
  // 0 = just done (full ring), 1 = fully elapsed (empty ring)
  const ratio = Math.max(0, Math.min(1, elapsed / freqDays));
  return 1 - ratio; // invert: 1 = full green, 0 = overdue empty
}

function CircularRing({
  progress,
  status,
}: {
  progress: number;
  status: HealthStatus;
}) {
  const color  = ringColor(status);
  const offset = CIRCUMFERENCE * (1 - progress);
  const pct    = Math.round(progress * 100);

  return (
    <View style={{ width: RING_DIAMETER, height: RING_DIAMETER, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={RING_DIAMETER} height={RING_DIAMETER} style={{ position: 'absolute' }}>
        {/* Track */}
        <Circle
          cx={RING_DIAMETER / 2}
          cy={RING_DIAMETER / 2}
          r={RADIUS}
          stroke={`${color}22`}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx={RING_DIAMETER / 2}
          cy={RING_DIAMETER / 2}
          r={RADIUS}
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE}`}
          strokeDashoffset={`${offset}`}
          strokeLinecap="round"
          rotation="-90"
          origin={`${RING_DIAMETER / 2}, ${RING_DIAMETER / 2}`}
        />
      </Svg>
      <Text style={[ringStyles.pct, { color }]}>{pct}%</Text>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  pct: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    textAlign: 'center',
  },
});

// ─── My Health recurring tracker ──────────────────────────────────────────────

const HEALTH_ITEMS = [
  { id: 'h01', label: 'Postpartum check-up', icon: 'person-outline',    freqDays: 30,  freqLabel: 'Every month' },
  { id: 'h02', label: 'Iron supplements',     icon: 'medical-outline',  freqDays: 1,   freqLabel: 'Daily' },
  { id: 'h03', label: 'Breast self-exam',     icon: 'hand-left-outline',freqDays: 30,  freqLabel: 'Every month' },
  { id: 'h04', label: 'Blood pressure check', icon: 'pulse-outline',    freqDays: 30,  freqLabel: 'Every month' },
  { id: 'h05', label: 'Haemoglobin level',    icon: 'water-outline',    freqDays: 90,  freqLabel: 'Every 3 months' },
  { id: 'h06', label: 'BMI & weight check',   icon: 'scale-outline',    freqDays: 90,  freqLabel: 'Every 3 months' },
  { id: 'h07', label: 'Thyroid check',        icon: 'leaf-outline',     freqDays: 180, freqLabel: 'Every 6 months' },
  { id: 'h08', label: 'Pap smear test',       icon: 'search-outline',   freqDays: 365, freqLabel: 'Annually' },
  { id: 'h09', label: 'Dental check-up',      icon: 'happy-outline',    freqDays: 365, freqLabel: 'Annually' },
  { id: 'h10', label: 'Eye screening',        icon: 'eye-outline',      freqDays: 365, freqLabel: 'Annually' },
];

const HEALTH_STORAGE_KEY = 'maamitra-health-tracker';

function getStatus(lastDone: string | null, freqDays: number): HealthStatus {
  if (!lastDone) return 'overdue';
  const nextDue = new Date(new Date(lastDone).getTime() + freqDays * 864e5);
  const daysLeft = Math.floor((nextDue.getTime() - Date.now()) / 864e5);
  if (daysLeft < 0)  return 'overdue';
  if (daysLeft <= 7) return 'due-soon';
  return 'up-to-date';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function nextDueLabel(lastDone: string, freqDays: number) {
  const nextDue  = new Date(new Date(lastDone).getTime() + freqDays * 864e5);
  const daysLeft = Math.floor((nextDue.getTime() - Date.now()) / 864e5);
  if (daysLeft <= 0) return 'Overdue';
  if (daysLeft === 1) return 'Due tomorrow';
  if (daysLeft < 30) return `Due in ${daysLeft} days`;
  if (daysLeft < 60) return 'Due next month';
  return `Due ${nextDue.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`;
}

function HealthCheckItem({
  item,
  lastDone,
  onMarkDone,
  onUndo,
}: {
  item: (typeof HEALTH_ITEMS)[0];
  lastDone: string | null;
  onMarkDone: () => void;
  onUndo: () => void;
}) {
  const status   = getStatus(lastDone, item.freqDays);
  const progress = progressRatio(lastDone, item.freqDays);
  const color    = ringColor(status);

  const statusColors: Record<HealthStatus, { bg: string; border: string; text: string; badge: string }> = {
    'overdue':    { bg: 'rgba(239,68,68,0.04)',  border: 'rgba(239,68,68,0.2)',   text: '#dc2626', badge: '#fef2f2' },
    'due-soon':   { bg: 'rgba(245,158,11,0.04)', border: 'rgba(245,158,11,0.25)', text: '#d97706', badge: '#fffbeb' },
    'up-to-date': { bg: 'rgba(34,197,94,0.04)',  border: 'rgba(34,197,94,0.2)',   text: '#16a34a', badge: '#f0fdf4' },
  };
  const c = statusColors[status];

  const statusIcon  = status === 'up-to-date' ? 'checkmark-circle' : status === 'due-soon' ? 'time-outline' : 'alert-circle-outline';
  const statusLabel = status === 'up-to-date' ? 'Up to date'       : status === 'due-soon' ? 'Due soon'     : 'Overdue';

  return (
    <View
      style={[
        hStyles.card,
        {
          backgroundColor: c.bg,
          borderColor: c.border,
          // inner glow matching ring color
          shadowColor: color,
          shadowRadius: 8,
          shadowOpacity: 0.15,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        },
      ]}
    >
      <View style={hStyles.cardHeader}>
        <View style={hStyles.iconBox}>
          <Ionicons name={item.icon as any} size={18} color={ROSE} />
        </View>
        <View style={hStyles.headerInfo}>
          <Text style={hStyles.itemLabel}>{item.label}</Text>
          <Text style={hStyles.freqLabel}>{item.freqLabel}</Text>
        </View>

        {/* Circular progress ring */}
        <CircularRing progress={progress} status={status} />
      </View>

      {/* Status badge row */}
      <View style={[hStyles.statusBadge, { backgroundColor: c.badge, alignSelf: 'flex-start', marginBottom: 8 }]}>
        <Ionicons name={statusIcon as any} size={12} color={c.text} />
        <Text style={[hStyles.statusText, { color: c.text }]}>{statusLabel}</Text>
      </View>

      {lastDone ? (
        <View style={hStyles.doneRow}>
          <View style={hStyles.doneInfo}>
            <Text style={hStyles.doneLabel}>
              Last done:{' '}
              <Text style={hStyles.doneDate}>{formatDate(lastDone)}</Text>
            </Text>
            {status !== 'overdue' && (
              <Text style={[hStyles.nextLabel, { color: c.text }]}>
                {nextDueLabel(lastDone, item.freqDays)}
              </Text>
            )}
            {status === 'overdue' && (
              <Text style={hStyles.overdueNote}>Overdue — tap to log it now</Text>
            )}
          </View>
          <TouchableOpacity style={hStyles.undoBtn} onPress={onUndo} activeOpacity={0.7}>
            <Ionicons name="refresh-outline" size={13} color="#9ca3af" />
            <Text style={hStyles.undoBtnText}>Undo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={hStyles.neverDone}>
          Never logged — tap to record your first check
        </Text>
      )}

      {(status === 'overdue' || status === 'due-soon' || !lastDone) && (
        <TouchableOpacity
          style={hStyles.markBtn}
          onPress={onMarkDone}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[ROSE, PLUM]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={hStyles.markBtnGrad}
          >
            <Ionicons name="checkmark-circle-outline" size={15} color="#fff" />
            <Text style={hStyles.markBtnText}>Mark as done today</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

const hStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(232,72,122,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  itemLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: INK,
  },
  freqLabel: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  doneInfo: { flex: 1 },
  doneLabel: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: '#9CA3AF',
  },
  doneDate: {
    fontFamily: Fonts.sansBold,
    color: '#374151',
  },
  nextLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    marginTop: 2,
  },
  overdueNote: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: '#dc2626',
    marginTop: 2,
  },
  neverDone: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    padding: 4,
  },
  undoBtnText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: '#9CA3AF',
  },
  markBtn: { borderRadius: 10, overflow: 'hidden', marginTop: 4 },
  markBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  markBtnText: {
    fontFamily: Fonts.sansBold,
    color: '#fff',
    fontSize: 13,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HealthScreen() {
  const insets     = useSafeAreaInsets();
  const [subTab, setSubTab] = useState<SubTab>('vaccines');
  const vaccines   = useVaccineSchedule();
  const { activeKid } = useActiveKid();
  const motherName = useProfileStore((s) => s.motherName);
  const [lastDone, setLastDone] = useState<Record<string, string>>({});

  useEffect(() => {
    AsyncStorage.getItem(HEALTH_STORAGE_KEY).then((val) => {
      if (val) { try { setLastDone(JSON.parse(val)); } catch {} }
    });
  }, []);

  const markDone = (id: string) => {
    const updated = { ...lastDone, [id]: new Date().toISOString() };
    setLastDone(updated);
    AsyncStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(updated));
  };

  const undoDone = (id: string) => {
    const updated = { ...lastDone };
    delete updated[id];
    setLastDone(updated);
    AsyncStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(updated));
  };

  const upToDateCount = HEALTH_ITEMS.filter(
    (item) => getStatus(lastDone[item.id] ?? null, item.freqDays) === 'up-to-date',
  ).length;
  const progressPct = (upToDateCount / HEALTH_ITEMS.length) * 100;

  const kidSubtitle = activeKid
    ? activeKid.isExpecting
      ? `${activeKid.name} · Due soon`
      : `${activeKid.name} · ${(() => {
          const m = Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(activeKid.dob ?? '').getTime()) /
                (1000 * 60 * 60 * 24 * 30.44),
            ),
          );
          return m < 24 ? `${m}mo` : `${Math.floor(m / 12)}y`;
        })()} · ${vaccines.filter((v) => v.status === 'due-soon' || v.status === 'overdue').length} vaccines due`
    : 'IAP & FOGSI guidelines';

  return (
    <View style={styles.container}>
      {/* ── Dark Gradient Header ── */}
      <LinearGradient
        colors={['#1C1033', '#3b1060', '#6d1a7a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 14 }]}
      >
        <View style={styles.glowTopRight} pointerEvents="none" />
        <View style={styles.glowBottomLeft} pointerEvents="none" />
        <Text style={styles.headerTitle}>Health</Text>
        <Text style={styles.headerSub}>{kidSubtitle}</Text>
      </LinearGradient>

      <SubTabSelector active={subTab} onChange={setSubTab} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── VACCINES ── */}
        {subTab === 'vaccines' && (
          <>
            <View style={styles.infoBanner}>
              <Text style={styles.infoBannerEmoji}>💉</Text>
              <Text style={styles.infoBannerText}>
                Based on IAP 2024 immunisation schedule
              </Text>
            </View>

            {!activeKid || activeKid.isExpecting ? (
              <Card style={styles.noKidCard} shadow="sm">
                <Text style={styles.noKidEmoji}>🤱</Text>
                <Text style={styles.noKidText}>
                  Your vaccine schedule will appear here after your baby arrives.
                </Text>
              </Card>
            ) : (
              vaccines.map((v, i) => (
                <PremiumVaccineWrapper
                  key={v.id}
                  vaccine={v}
                  isLast={i === vaccines.length - 1}
                />
              ))
            )}
          </>
        )}

        {/* ── SCHEMES ── */}
        {subTab === 'schemes' && (
          <>
            <Text style={styles.schemesHeader}>Government Benefits for You 🇮🇳</Text>
            {GOVERNMENT_SCHEMES.map((s) => (
              <SchemeCard
                key={s.id}
                scheme={s}
                kid={activeKid}
                motherName={motherName}
              />
            ))}
          </>
        )}

        {/* ── MY HEALTH ── */}
        {subTab === 'myhealth' && (
          <>
            {/* Progress bar */}
            <Card style={styles.progressCard} shadow="sm">
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>FOGSI Health Checklist</Text>
                <Text style={styles.progressCount}>
                  {upToDateCount}/{HEALTH_ITEMS.length} up to date
                </Text>
              </View>
              <View style={styles.progressBar}>
                <LinearGradient
                  colors={['#ec4899', '#8b5cf6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${progressPct}%` as any }]}
                />
              </View>
            </Card>

            {HEALTH_ITEMS.map((item) => (
              <HealthCheckItem
                key={item.id}
                item={item}
                lastDone={lastDone[item.id] ?? null}
                onMarkDone={() => markDone(item.id)}
                onUndo={() => undoDone(item.id)}
              />
            ))}

            {/* Disclaimer */}
            <Card style={styles.disclaimerCard} shadow="sm">
              <View style={styles.disclaimerRow}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={PLUM}
                />
                <Text style={styles.disclaimerText}>
                  Follows FOGSI guidelines. Always consult your doctor for
                  personalised medical advice.
                </Text>
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8FC' },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  glowTopRight: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(232,72,122,0.22)',
    top: -60,
    right: -40,
  },
  glowBottomLeft: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(124,58,237,0.18)',
    bottom: -40,
    left: -20,
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    color: '#ffffff',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  headerSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(124,58,237,0.06)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.12)',
  },
  infoBannerEmoji: { fontSize: 20 },
  infoBannerText: {
    fontFamily: Fonts.sansSemiBold,
    flex: 1,
    fontSize: 13,
    color: PLUM,
  },
  noKidCard: { alignItems: 'center', paddingVertical: 32 },
  noKidEmoji: { fontSize: 40, marginBottom: 12 },
  noKidText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 240,
  },
  schemesHeader: {
    fontFamily: Fonts.sansBold,
    fontSize: 18,
    color: INK,
    marginBottom: 14,
  },
  progressCard: { marginBottom: 16 },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    color: INK,
  },
  progressCount: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: ROSE,
  },
  progressBar: {
    height: 8,
    backgroundColor: MIST,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  disclaimerCard: {
    marginTop: 8,
    backgroundColor: 'rgba(124,58,237,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.1)',
  },
  disclaimerRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  disclaimerText: {
    fontFamily: Fonts.sansRegular,
    flex: 1,
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 19,
  },
});
