import React, { useEffect, useState } from 'react';
import {
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
import { useVaccineSchedule, useKidVaccineSchedulePreference } from '../../hooks/useVaccineSchedule';
import { GOVERNMENT_SCHEMES } from '../../data/schemes';
import { filterByAudience, parentGenderToAudience } from '../../data/audience';
import { SCHEDULE_INFO, VaccineScheduleType } from '../../data/vaccines';
import { useActiveKid } from '../../hooks/useActiveKid';
import { useProfileStore } from '../../store/useProfileStore';
import { useAuthStore } from '../../store/useAuthStore';
import { syncHealthTracking, saveFullProfile } from '../../services/firebase';
import Card from '../../components/ui/Card';
import VaccineCardComponent from '../../components/health/VaccineCard';
import VaccineScheduleChooser from '../../components/health/VaccineScheduleChooser';
import TeethTab from '../../components/health/TeethTab';
import FoodTrackerTab from '../../components/health/FoodTrackerTab';
import GrowthTab, { RoutineTab } from '../../components/health/GrowthTab';
import NuskheTab from '../../components/health/NuskheTab';
import { Fonts, Gradients } from '../../constants/theme';
import { Colors } from '../../constants/theme';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const ROSE   = Colors.primary;
const PLUM   = Colors.primary;
const GOLD   = '#F59E0B';
const SAGE   = '#34D399';
const MIST   = '#EDE9F6';
const INK    = '#1C1033';
const STONE  = '#6B7280';

type SubTab = 'vaccines' | 'teeth' | 'foods' | 'growth' | 'routine' | 'schemes' | 'myhealth' | 'nuskhe';

// ─── Landing-grid categories ──────────────────────────────────────────────────
// Seven trackers is too many for a horizontal pill bar. Group them by who the
// section is for: baby · mother · benefits. Each entry drills into the
// corresponding sub-screen; deep links (?tab=…) still land on the target
// directly, skipping the landing page.

type CategoryKey = 'baby' | 'mother' | 'benefits';

interface SubTabMeta {
  key: SubTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  category: CategoryKey;
}

// Each card renders in the app's brand accent — icon + soft background both
// read from `Colors` at render time, so swapping the accent colour in
// Settings re-skins the whole landing grid without code changes. Category
// differentiation is conveyed by the icon and the section header, not the
// fill colour.
const SUB_TABS: SubTabMeta[] = [
  { key: 'vaccines', label: 'Vaccines',   icon: 'shield-checkmark-outline', description: 'IAP 2023 schedule · due & upcoming', category: 'baby'     },
  { key: 'growth',   label: 'Growth',     icon: 'trending-up-outline',      description: 'Weight, height & head circumference', category: 'baby'     },
  { key: 'teeth',    label: 'Teeth',      icon: 'happy-outline',            description: 'Eruption & shedding tracker',         category: 'baby'     },
  { key: 'foods',    label: 'Foods',      icon: 'restaurant-outline',       description: '3-day rule for new foods',             category: 'baby'     },
  { key: 'routine',  label: 'Routine',    icon: 'time-outline',             description: 'Diaper & sleep log',                   category: 'baby'     },
  { key: 'nuskhe',   label: 'Dadi Maa\u2019s Nuskhe', icon: 'flower-outline',  description: 'Traditional home remedies for common ailments', category: 'baby' },
  { key: 'myhealth', label: 'My Health',  icon: 'heart-outline',            description: 'FOGSI checklist for mother',           category: 'mother'   },
  { key: 'schemes',  label: 'Schemes',    icon: 'ribbon-outline',           description: 'Government benefits for you',          category: 'benefits' },
];

const CATEGORY_ORDER: { key: CategoryKey; title: string; subtitle: string }[] = [
  { key: 'baby',     title: "Your baby",     subtitle: 'Track everything day-to-day' },
  { key: 'mother',   title: 'You',           subtitle: 'Recurring checks for mother' },
  { key: 'benefits', title: 'Benefits',      subtitle: 'Schemes you may qualify for' },
];

// ─── Landing grid ─────────────────────────────────────────────────────────────
// Replaces the old horizontal pill bar. Groups trackers by who the section is
// for, so the Health screen opens to a scannable category page instead of a
// cramped 7-across tab strip. Each card drills into the existing sub-screen.

function CategoryGrid({ onPick }: { onPick: (t: SubTab) => void }) {
  return (
    <View>
      {CATEGORY_ORDER.map((cat) => {
        const items = SUB_TABS.filter((t) => t.category === cat.key);
        if (items.length === 0) return null;
        return (
          <View key={cat.key} style={gridStyles.section}>
            <View style={gridStyles.sectionHeader}>
              <Text style={gridStyles.sectionTitle}>{cat.title}</Text>
              <Text style={gridStyles.sectionSub}>{cat.subtitle}</Text>
            </View>
            <View style={gridStyles.cardsRow}>
              {items.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => onPick(item.key)}
                  activeOpacity={0.85}
                  style={gridStyles.card}
                >
                  <View style={[gridStyles.iconWrap, { backgroundColor: Colors.primaryAlpha08 }]}>
                    <Ionicons name={item.icon} size={22} color={Colors.primary} />
                  </View>
                  <Text style={gridStyles.cardLabel}>{item.label}</Text>
                  <Text style={gridStyles.cardDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const gridStyles = StyleSheet.create({
  section: { marginBottom: 18 },
  sectionHeader: { marginBottom: 10 },
  sectionTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
    color: INK,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  cardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 150,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: MIST,
    shadowColor: PLUM,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    // @ts-ignore — web-only
    boxShadow: '0px 2px 8px rgba(28,16,51,0.05)',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: INK,
  },
  cardDesc: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11.5,
    color: '#9CA3AF',
    marginTop: 3,
    lineHeight: 16,
  },
});

// ─── In-drill-down breadcrumb header ─────────────────────────────────────────

function SubTabHeader({
  meta,
  onBack,
}: {
  meta: SubTabMeta;
  onBack: () => void;
}) {
  return (
    <View style={headerStyles.wrapper}>
      <TouchableOpacity onPress={onBack} style={headerStyles.backBtn} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={18} color={Colors.primary} />
        <Text style={headerStyles.backText}>Health</Text>
      </TouchableOpacity>
      <View style={[headerStyles.iconChip, { backgroundColor: Colors.primaryAlpha08 }]}>
        <Ionicons name={meta.icon} size={14} color={Colors.primary} />
        <Text style={[headerStyles.iconChipText, { color: Colors.primary }]}>{meta.label}</Text>
      </View>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBF8',
    backgroundColor: '#FAFAFB',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingRight: 6,
  },
  backText: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: Colors.primary,
  },
  iconChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  iconChipText: {
    fontFamily: Fonts.sansBold,
    fontSize: 11.5,
  },
});

// ─── Vaccine age-group ─────────────────────────────────────────────────────────
// The 2023 IAP schedule recommends several vaccines at the same visit. In
// practice parents often split them across different days, so each vaccine
// is its own row with its own date. Rows are grouped under the age they're
// recommended at to keep the list scannable.

type VaccineRow = ReturnType<typeof useVaccineSchedule>[0];

interface VaccineGroup {
  ageLabel: string;
  formattedDate: string;
  items: VaccineRow[];
  doneCount: number;
  total: number;
  status: 'done' | 'overdue' | 'due-soon' | 'upcoming';
}

function groupVaccinesByAge(rows: VaccineRow[]): VaccineGroup[] {
  const order: string[] = [];
  const map = new Map<string, VaccineRow[]>();
  for (const r of rows) {
    if (!map.has(r.ageLabel)) {
      order.push(r.ageLabel);
      map.set(r.ageLabel, []);
    }
    map.get(r.ageLabel)!.push(r);
  }
  return order.map((ageLabel) => {
    const items = map.get(ageLabel)!;
    const doneCount = items.filter((i) => i.status === 'done').length;
    const total = items.length;
    let status: VaccineGroup['status'] = 'upcoming';
    if (doneCount === total) status = 'done';
    else if (items.some((i) => i.status === 'overdue')) status = 'overdue';
    else if (items.some((i) => i.status === 'due-soon')) status = 'due-soon';
    return {
      ageLabel,
      formattedDate: items[0]?.formattedDate ?? '',
      items,
      doneCount,
      total,
      status,
    };
  });
}

function groupDotColor(status: VaccineGroup['status']): string {
  if (status === 'done') return SAGE;
  if (status === 'overdue') return GOLD;
  if (status === 'due-soon') return Colors.primary;
  return MIST;
}

function OverduePulseRing({ color }: { color: string }) {
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
    opacity: interpolate(scale.value, [1.0, 1.5], [0.7, 0]),
  }));

  return (
    <Animated.View
      style={[vStyles.pulseRing, { borderColor: color }, ringStyle]}
      pointerEvents="none"
    />
  );
}

function VaccineAgeGroup({ group }: { group: VaccineGroup }) {
  const [expanded, setExpanded] = useState(
    group.status === 'overdue' || group.status === 'due-soon' || group.doneCount < group.total,
  );
  const dotColor = groupDotColor(group.status);
  const progressColor =
    group.status === 'done'
      ? SAGE
      : group.status === 'overdue'
      ? GOLD
      : group.status === 'due-soon'
      ? Colors.primary
      : STONE;

  return (
    <View style={vStyles.group}>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => setExpanded((e) => !e)}
        style={vStyles.groupHeader}
      >
        <View style={vStyles.groupDotWrap}>
          {group.status === 'overdue' && <OverduePulseRing color={dotColor} />}
          <View
            style={[
              vStyles.groupDot,
              { backgroundColor: dotColor, borderColor: dotColor },
            ]}
          >
            {group.status === 'done' && <Ionicons name="checkmark" size={9} color="#fff" />}
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={vStyles.groupAge}>{group.ageLabel}</Text>
          <Text style={vStyles.groupDate}>{group.formattedDate}</Text>
        </View>
        <View style={[vStyles.progressChip, { backgroundColor: `${progressColor}15` }]}>
          <Text style={[vStyles.progressText, { color: progressColor }]}>
            {group.doneCount}/{group.total}
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={STONE}
          style={{ marginLeft: 6 }}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={vStyles.groupBody}>
          {group.items.map((v) => (
            <VaccineCardComponent key={v.id} vaccine={v} />
          ))}
        </View>
      )}
    </View>
  );
}

function VaccineSourceFooter({ schedule }: { schedule: VaccineScheduleType }) {
  const info = SCHEDULE_INFO[schedule];
  return (
    <View style={vStyles.source}>
      <Ionicons name="document-text-outline" size={14} color={STONE} />
      <Text style={vStyles.sourceText}>
        Schedule based on{' '}
        <Text style={vStyles.sourceEmph}>{info.fullName}</Text> ·{' '}
        <Text style={vStyles.sourceEmph}>{info.authority}</Text>. {info.source}.
        {' '}Always confirm doses with your paediatrician.
      </Text>
    </View>
  );
}

// ─── VaccinesSection ───────────────────────────────────────────────────────────
// One place that resolves the four states the vaccines tab can be in:
//   1. No active kid → CTA to add a baby
//   2. Pregnant kid → pregnancy vaccines list (FOGSI)
//   3. Live kid, no schedule chosen yet → VaccineScheduleChooser
//   4. Live kid with schedule → grouped tracker with a "change schedule" link

function VaccinesSection({
  activeKid,
  vaccines,
  schedulePref,
  onPickSchedule,
  router,
}: {
  activeKid: ReturnType<typeof useActiveKid>['activeKid'];
  vaccines: VaccineRow[];
  schedulePref: ReturnType<typeof useKidVaccineSchedulePreference>;
  onPickSchedule: (t: VaccineScheduleType) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [changeOpen, setChangeOpen] = useState(false);

  if (!activeKid) {
    return (
      <Card style={styles.noKidCard} shadow="sm">
        <Ionicons name="heart-outline" size={40} color={Colors.primary} style={{ marginBottom: 12, opacity: 0.8 }} />
        <Text style={styles.noKidText}>
          Add your baby to see their personalised vaccine schedule.
        </Text>
        <TouchableOpacity
          style={styles.noKidBtn}
          onPress={() => router.push('/(tabs)/family')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.primary]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.noKidBtnGrad}
          >
            <Ionicons name="add-circle-outline" size={16} color="#fff" />
            <Text style={styles.noKidBtnText}>Add your baby</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Card>
    );
  }

  if (activeKid.isExpecting) {
    return (
      <View style={{ marginTop: 8 }}>
        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: '#1C1033', marginBottom: 12 }}>
          Recommended Vaccines During Pregnancy
        </Text>
        {[
          { name: 'Tdap (Tetanus, Diphtheria, Pertussis)', timing: 'Between 27–36 weeks', note: 'Protects your baby from whooping cough after birth' },
          { name: 'Influenza (Flu) Vaccine', timing: 'Any trimester', note: 'Reduces risk of flu-related complications in pregnancy' },
          { name: 'COVID-19 Booster', timing: 'Consult your doctor', note: 'Recommended if due for booster — safe in all trimesters' },
        ].map((v) => (
          <View key={v.name} style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#EDE9F6' }}>
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13, color: '#1C1033' }}>{v.name}</Text>
            <Text style={{ fontFamily: Fonts.sansRegular, fontSize: 12, color: Colors.primary, marginTop: 2 }}>When: {v.timing}</Text>
            <Text style={{ fontFamily: Fonts.sansRegular, fontSize: 12, color: '#6b7280', marginTop: 2 }}>{v.note}</Text>
          </View>
        ))}
        <Text style={{ fontFamily: Fonts.sansRegular, fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
          As per FOGSI 2024 guidelines · Always confirm with your OB-GYN
        </Text>
      </View>
    );
  }

  // Schedule not chosen yet — show the chooser. No info banner / tracker yet.
  if (!schedulePref.hasChosen) {
    return (
      <VaccineScheduleChooser
        currentSchedule={null}
        onConfirm={onPickSchedule}
      />
    );
  }

  // Schedule locked-in — render the tracker.
  const info = SCHEDULE_INFO[schedulePref.schedule];
  const groups = groupVaccinesByAge(vaccines);

  return (
    <>
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerEmoji}>💉</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.infoBannerText}>{info.fullName}</Text>
          <Text style={styles.infoBannerSub}>
            Tap each vaccine to log the exact date it was given.
          </Text>
        </View>
        <View style={vStyles.scheduleBadge}>
          <Text style={vStyles.scheduleBadgeText}>{info.name}</Text>
        </View>
      </View>

      {groups.map((group) => (
        <VaccineAgeGroup key={group.ageLabel} group={group} />
      ))}

      <VaccineSourceFooter schedule={schedulePref.schedule} />

      <TouchableOpacity
        onPress={() => setChangeOpen(true)}
        style={vStyles.changeBtn}
        activeOpacity={0.7}
      >
        <Ionicons name="swap-horizontal-outline" size={14} color={Colors.primary} />
        <Text style={vStyles.changeBtnText}>Change schedule</Text>
      </TouchableOpacity>

      <Modal
        visible={changeOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setChangeOpen(false)}
      >
        <View style={vStyles.changeHeader}>
          <TouchableOpacity onPress={() => setChangeOpen(false)} style={{ padding: 6 }}>
            <Ionicons name="close" size={22} color={Colors.textLight} />
          </TouchableOpacity>
          <Text style={vStyles.changeHeaderTitle}>Change schedule</Text>
          <View style={{ width: 32 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <VaccineScheduleChooser
            currentSchedule={schedulePref.schedule}
            isChange
            title="Switch to a different schedule"
            subtitle="Your previously logged dates stay saved. Vaccines that exist in the new schedule will still show as done."
            onConfirm={(t) => {
              onPickSchedule(t);
              setChangeOpen(false);
            }}
          />
        </ScrollView>
      </Modal>
    </>
  );
}

const vStyles = StyleSheet.create({
  group: {
    marginBottom: 12,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  groupDotWrap: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  groupAge: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: INK,
  },
  groupDate: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11.5,
    color: STONE,
    marginTop: 1,
  },
  progressChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  progressText: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  groupBody: {
    paddingLeft: 24,
    paddingTop: 2,
  },
  source: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  sourceText: {
    flex: 1,
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: STONE,
    lineHeight: 16,
  },
  sourceEmph: {
    fontFamily: Fonts.sansSemiBold,
    color: INK,
  },
  scheduleBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  scheduleBadgeText: {
    fontFamily: Fonts.sansBold,
    fontSize: 10.5,
    letterSpacing: 0.5,
    color: '#fff',
    textTransform: 'uppercase',
  },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primaryAlpha20,
    backgroundColor: '#fff',
  },
  changeBtnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12.5,
    color: Colors.primary,
  },
  changeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
    backgroundColor: '#fff',
  },
  changeHeaderTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    color: INK,
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

type EligibilityStatus = 'eligible' | 'ineligible' | 'check';

function getEligibility(scheme: (typeof GOVERNMENT_SCHEMES)[0], kid: any): EligibilityStatus {
  if (!kid) return 'check';
  const { tags } = scheme;
  if (tags.includes('all')) return 'eligible';
  if (tags.includes('pregnant') && kid.isExpecting) return 'eligible';
  if (tags.includes('newborn') && !kid.isExpecting) return 'eligible';
  if (tags.includes('all-kids') && !kid.isExpecting) return 'eligible';
  if (tags.includes('girl')) {
    if (kid.gender === 'girl') return 'eligible';
    if (kid.gender === 'boy') return 'ineligible'; // definitively not eligible
    return 'check'; // surprise/unknown
  }
  return 'check';
}

function SchemeCard({
  scheme,
  kid,
  motherName,
  userState,
  isLowPerformingState,
}: {
  scheme: (typeof GOVERNMENT_SCHEMES)[0];
  kid: any;
  motherName: string;
  userState: string;
  isLowPerformingState: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [bodyHeight, setBodyHeight] = useState(0);
  const animHeight = useSharedValue(0);
  const animOpacity = useSharedValue(0);

  const eligibility = getEligibility(scheme, kid);
  const relevant = eligibility === 'eligible';
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
      {eligibility === 'eligible' && (
        <View style={scStyles.eligibleBadge}>
          <Text style={scStyles.eligibleBadgeText}>Eligible ✓</Text>
        </View>
      )}
      {eligibility === 'ineligible' && (
        <View style={[scStyles.checkBadge, { backgroundColor: '#fee2e2' }]}>
          <Text style={[scStyles.checkBadgeText, { color: '#dc2626' }]}>Not eligible ✗</Text>
        </View>
      )}
      {eligibility === 'check' && (
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

      {/* State relevance notes */}
      {scheme.id === 'gs01' && isLowPerformingState && userState ? (
        <Text style={{ fontSize: 11, color: '#16a34a', marginTop: 4, marginBottom: 2, fontFamily: Fonts.sansRegular }}>
          ✓ {userState} residents: All pregnant women qualify regardless of BPL status
        </Text>
      ) : null}
      {userState ? (
        <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 2, marginBottom: 6, fontFamily: Fonts.sansRegular }}>
          Available in {userState} · Confirm at your nearest Anganwadi
        </Text>
      ) : null}

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
              <Ionicons name="gift-outline" size={14} color={Colors.primary} />
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
    boxShadow: `0px 2px 8px ${Colors.primaryAlpha05}`,
  } as any,
  cardRelevant: {
    borderColor: Colors.primaryAlpha25,
    backgroundColor: '#FAFAFB',
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
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDF5',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primaryAlpha08,
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
    backgroundColor: Colors.primaryAlpha05,
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
    borderColor: Colors.primaryAlpha25,
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 4,
    backgroundColor: Colors.primaryAlpha05,
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
  const parsed = new Date(lastDone);
  if (isNaN(parsed.getTime())) return 0; // corrupted date string — treat as never done
  const elapsed = (Date.now() - parsed.getTime()) / 864e5;
  const ratio = Math.max(0, Math.min(1, elapsed / freqDays));
  return 1 - ratio;
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
  const doneToday = lastDone
    ? new Date(lastDone).toDateString() === new Date().toDateString()
    : false;

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

      {!doneToday && (status === 'overdue' || status === 'due-soon' || !lastDone) && (
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
    backgroundColor: 'rgba(28, 16, 51, 0.054)',
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
  const router     = useRouter();
  // `?tab=teeth` (or schemes/myhealth/vaccines) opens the screen on that
  // sub-tab — used by the home Quick Actions deep-link.
  const params     = useLocalSearchParams<{ tab?: string }>();
  const validTabs: SubTab[] = ['vaccines', 'teeth', 'foods', 'growth', 'routine', 'schemes', 'myhealth', 'nuskhe'];
  // Null => show the category landing grid. A valid ?tab=… deep-links directly
  // into a sub-screen (used by home Quick Actions) and bypasses the grid.
  const initialTab: SubTab | null =
    params?.tab && (validTabs as string[]).includes(params.tab)
      ? (params.tab as SubTab)
      : null;
  const [subTab, setSubTab] = useState<SubTab | null>(initialTab);
  // If the param changes after mount (re-deep-link), follow it.
  useEffect(() => {
    if (params?.tab && (validTabs as string[]).includes(params.tab)) {
      setSubTab(params.tab as SubTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.tab]);

  const activeMeta = subTab ? SUB_TABS.find((t) => t.key === subTab) ?? null : null;
  const vaccines   = useVaccineSchedule();
  const schedulePref = useKidVaccineSchedulePreference();
  const { activeKid } = useActiveKid();
  const motherName = useProfileStore((s) => s.motherName);
  const profile    = useProfileStore((s) => s.profile);
  const setKidVaccineSchedule = useProfileStore((s) => s.setKidVaccineSchedule);
  const { user }   = useAuthStore();

  // Persist the parent's schedule pick locally + to Firestore. Lighter than
  // a full saveFullProfile but uses the same shape so the kids array stays
  // in sync across devices.
  const persistSchedulePick = (type: VaccineScheduleType) => {
    if (!activeKid) return;
    setKidVaccineSchedule(activeKid.id, type);
    if (user?.uid) {
      const s = useProfileStore.getState();
      saveFullProfile(user.uid, {
        motherName: s.motherName,
        profile: s.profile,
        kids: s.kids,
        completedVaccines: s.completedVaccines,
        onboardingComplete: s.onboardingComplete,
        photoUrl: s.photoUrl || '',
        parentGender: s.parentGender || '',
        bio: s.bio || '',
        expertise: s.expertise || [],
        visibilitySettings: s.visibilitySettings,
      }).catch(console.error);
    }
  };
  const [lastDone, setLastDone] = useState<Record<string, string>>({});

  const healthKey = `maamitra-health-${user?.uid ?? 'local'}`;

  const userState = profile?.state ?? '';
  const isLowPerformingState = ['Uttar Pradesh', 'Bihar', 'Madhya Pradesh', 'Rajasthan', 'Jharkhand', 'Uttarakhand', 'Orissa', 'Jammu & Kashmir', 'Chhattisgarh', 'Assam'].some(
    (s) => userState.toLowerCase().includes(s.toLowerCase())
  );

  useEffect(() => {
    AsyncStorage.getItem(healthKey).then((val) => {
      if (val) { try { setLastDone(JSON.parse(val)); } catch {} }
    });
  }, [healthKey]);

  const markDone = (id: string) => {
    const updated = { ...lastDone, [id]: new Date().toISOString() };
    setLastDone(updated);
    AsyncStorage.setItem(healthKey, JSON.stringify(updated));
    if (user?.uid) syncHealthTracking(user.uid, updated);
  };

  const undoDone = (id: string) => {
    const updated = { ...lastDone };
    delete updated[id];
    setLastDone(updated);
    AsyncStorage.setItem(healthKey, JSON.stringify(updated));
    if (user?.uid) syncHealthTracking(user.uid, updated);
  };

  const upToDateCount = HEALTH_ITEMS.filter(
    (item) => getStatus(lastDone[item.id] ?? null, item.freqDays) === 'up-to-date',
  ).length;
  const progressPct = (upToDateCount / HEALTH_ITEMS.length) * 100;

  const ageLabel = (() => {
    if (!activeKid || activeKid.isExpecting) return '';
    const m = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(activeKid.dob ?? '').getTime()) /
          (1000 * 60 * 60 * 24 * 30.44),
      ),
    );
    return m < 24 ? `${m}mo` : `${Math.floor(m / 12)}y`;
  })();

  const kidSubtitle = activeKid
    ? activeKid.isExpecting
      ? `${activeKid.name} · Due soon`
      : `${activeKid.name} · ${ageLabel}`
    : 'Personalised for your family';

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
        <Text style={styles.headerTitle}>Health</Text>
        <Text style={styles.headerSub}>{kidSubtitle}</Text>
      </LinearGradient>

      {activeMeta ? (
        <SubTabHeader meta={activeMeta} onBack={() => setSubTab(null)} />
      ) : null}

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── LANDING CATEGORY GRID ── */}
        {subTab === null && <CategoryGrid onPick={setSubTab} />}

        {/* ── VACCINES ── */}
        {subTab === 'vaccines' && (
          <VaccinesSection
            activeKid={activeKid}
            vaccines={vaccines}
            schedulePref={schedulePref}
            onPickSchedule={persistSchedulePick}
            router={router}
          />
        )}

        {/* ── TEETH ── */}
        {subTab === 'teeth' && <TeethTab />}

        {/* ── FOODS ── */}
        {subTab === 'foods' && <FoodTrackerTab />}

        {/* ── GROWTH (weight / height / head) ── */}
        {subTab === 'growth' && <GrowthTab />}

        {/* ── ROUTINE (diaper / sleep) ── */}
        {subTab === 'routine' && <RoutineTab />}

        {/* ── DADI MAA KE NUSKHE ── */}
        {subTab === 'nuskhe' && <NuskheTab />}

        {/* ── SCHEMES ── */}
        {subTab === 'schemes' && (
          <>
            <Text style={styles.schemesHeader}>Government Benefits for You 🇮🇳</Text>
            {filterByAudience(
              GOVERNMENT_SCHEMES,
              parentGenderToAudience(useProfileStore.getState().parentGender),
            ).map((s) => (
              <SchemeCard
                key={s.id}
                scheme={s}
                kid={activeKid}
                motherName={motherName}
                userState={userState}
                isLowPerformingState={isLowPerformingState}
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
                  colors={Gradients.primary}
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
  container: { flex: 1, backgroundColor: '#FAFAFB' },
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primaryAlpha05,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.primaryAlpha12,
  },
  infoBannerEmoji: { fontSize: 20 },
  infoBannerText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: PLUM,
  },
  infoBannerSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11.5,
    color: STONE,
    marginTop: 2,
  },
  noKidCard: { alignItems: 'center', paddingVertical: 32 },
  noKidText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 240,
  },
  noKidBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 16 },
  noKidBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 20 },
  noKidBtnText: { fontFamily: Fonts.sansBold, color: '#fff', fontSize: 14 },
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
    backgroundColor: Colors.primaryAlpha05,
    borderWidth: 1,
    borderColor: Colors.primaryAlpha08,
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
