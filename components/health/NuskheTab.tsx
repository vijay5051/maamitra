import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Card from '../ui/Card';
import { NUSKHE_CATEGORIES, NuskheCategory, Remedy, TOTAL_NUSKHE_COUNT } from '../../data/nuskhe';
import { useActiveKid } from '../../hooks/useActiveKid';
import { calculateAgeInMonths } from '../../store/useProfileStore';
import { Fonts, Colors } from '../../constants/theme';

const INK = '#1C1033';
const STONE = '#6B7280';
const MIST = '#EDE9F6';

// ─── Remedy card ────────────────────────────────────────────────────────────────

function RemedyCard({
  remedy,
  accent,
  ageOk,
}: {
  remedy: Remedy;
  accent: string;
  ageOk: boolean;
}) {
  return (
    <View style={[remStyles.card, !ageOk && remStyles.cardLocked]}>
      <View style={remStyles.headerRow}>
        <Text style={remStyles.name}>{remedy.name}</Text>
        {!ageOk && (
          <View style={[remStyles.lockChip, { backgroundColor: `${accent}15` }]}>
            <Ionicons name="time-outline" size={10} color={accent} />
            <Text style={[remStyles.lockText, { color: accent }]}>
              {remedy.minAgeMonths}mo+
            </Text>
          </View>
        )}
      </View>

      <View style={remStyles.section}>
        <Text style={remStyles.sectionLabel}>Ingredients</Text>
        <Text style={remStyles.sectionBody}>{remedy.ingredients}</Text>
      </View>

      <View style={remStyles.section}>
        <Text style={remStyles.sectionLabel}>Method</Text>
        <Text style={remStyles.sectionBody}>{remedy.method}</Text>
      </View>

      <View style={[remStyles.note, { backgroundColor: `${accent}12`, borderLeftColor: accent }]}>
        <Ionicons name="information-circle-outline" size={13} color={accent} />
        <Text style={[remStyles.noteText, { color: accent }]}>{remedy.note}</Text>
      </View>
    </View>
  );
}

const remStyles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: MIST,
  },
  cardLocked: {
    opacity: 0.7,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  name: {
    flex: 1,
    fontFamily: Fonts.sansBold,
    fontSize: 14.5,
    color: INK,
  },
  lockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  lockText: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  section: {
    marginBottom: 8,
  },
  sectionLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    color: STONE,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  sectionBody: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: '#374151',
    lineHeight: 19,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: 9,
    paddingLeft: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    marginTop: 4,
  },
  noteText: {
    flex: 1,
    fontFamily: Fonts.sansMedium,
    fontSize: 11.5,
    lineHeight: 16,
  },
});

// ─── Category accordion ─────────────────────────────────────────────────────────

function CategoryAccordion({
  category,
  ageMonths,
  totalForAge,
  expanded,
  onToggle,
}: {
  category: NuskheCategory;
  ageMonths: number | null;
  /** Count of age-appropriate remedies in the unfiltered category (for the
   *  header chip). When age is unknown this equals total. */
  totalForAge: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  // Body fade + chevron rotation, no measured height. RN flex re-flows when
  // children render so the accordion stays clean even when copy wraps.
  const opacity = useSharedValue(expanded ? 1 : 0);
  const rotate = useSharedValue(expanded ? 1 : 0);

  React.useEffect(() => {
    opacity.value = withTiming(expanded ? 1 : 0, { duration: 180 });
    rotate.value = withTiming(expanded ? 1 : 0, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [expanded]);

  const bodyStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value * 180}deg` }],
  }));

  return (
    <View style={catStyles.wrap}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onToggle}
        style={[catStyles.header, { backgroundColor: category.tint }]}
      >
        <View style={[catStyles.iconWrap, { backgroundColor: `${category.accent}1A` }]}>
          <Ionicons name={category.icon} size={20} color={category.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={catStyles.title}>{category.title}</Text>
          <Text style={catStyles.hindi}>
            {category.hindi} · {ageMonths !== null && totalForAge !== category.remedies.length
              ? `${totalForAge} of ${category.remedies.length} safe now`
              : `${category.remedies.length} remedies`}
          </Text>
        </View>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={18} color={category.accent} />
        </Animated.View>
      </TouchableOpacity>

      {expanded && (
        <Animated.View style={[catStyles.body, bodyStyle]}>
          {category.remedies.map((r) => (
            <RemedyCard
              key={r.id}
              remedy={r}
              accent={category.accent}
              ageOk={ageMonths === null || ageMonths >= r.minAgeMonths}
            />
          ))}
        </Animated.View>
      )}
    </View>
  );
}

const catStyles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    color: INK,
  },
  hindi: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11.5,
    color: STONE,
    marginTop: 2,
  },
  body: {
    paddingTop: 10,
    paddingHorizontal: 2,
  },
});

// ─── Main tab ──────────────────────────────────────────────────────────────────

export default function NuskheTab() {
  const { activeKid } = useActiveKid();
  const ageMonths = useMemo(() => {
    if (!activeKid || activeKid.isExpecting || !activeKid.dob) return null;
    return calculateAgeInMonths(activeKid.dob);
  }, [activeKid]);

  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [openId, setOpenId] = useState<string | null>(NUSKHE_CATEGORIES[0]?.id ?? null);

  // ── Age-appropriate counts (used for the header chip + "safe now" totals).
  //    When age is null (no kid / expecting / no DOB) every remedy counts.
  const safeForAgeCount = useMemo(() => {
    if (ageMonths === null) return TOTAL_NUSKHE_COUNT;
    return NUSKHE_CATEGORIES.reduce(
      (sum, cat) =>
        sum + cat.remedies.filter((r) => ageMonths >= r.minAgeMonths).length,
      0,
    );
  }, [ageMonths]);

  const trimmed = query.trim().toLowerCase();

  // ── Apply age filter first, then text search. Age filter is bypassed when
  //    age is unknown OR when the user has explicitly tapped "Show all".
  const filteredCategories = useMemo(() => {
    const ageFilter = (r: Remedy) =>
      showAll || ageMonths === null ? true : ageMonths >= r.minAgeMonths;

    return NUSKHE_CATEGORIES.map((cat) => {
      const ageRemedies = cat.remedies.filter(ageFilter);
      if (ageRemedies.length === 0) return null;

      if (!trimmed) return { ...cat, remedies: ageRemedies };

      const matchesCat =
        cat.title.toLowerCase().includes(trimmed) ||
        cat.hindi.toLowerCase().includes(trimmed);
      const textMatched = ageRemedies.filter(
        (r) =>
          r.name.toLowerCase().includes(trimmed) ||
          r.ingredients.toLowerCase().includes(trimmed) ||
          r.method.toLowerCase().includes(trimmed),
      );
      if (matchesCat) return { ...cat, remedies: ageRemedies };
      if (textMatched.length > 0) return { ...cat, remedies: textMatched };
      return null;
    }).filter((c): c is NuskheCategory => c !== null);
  }, [trimmed, ageMonths, showAll]);

  const ageLabel = ageMonths === null
    ? null
    : ageMonths < 24
    ? `${ageMonths}mo`
    : `${Math.floor(ageMonths / 12)}y`;

  const isExpecting = !!activeKid?.isExpecting;
  const hiddenByAge =
    ageMonths !== null && !showAll
      ? TOTAL_NUSKHE_COUNT - safeForAgeCount
      : 0;

  return (
    <View>
      {/* Hero intro card */}
      <Card style={styles.heroCard} shadow="sm">
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <Ionicons name="flower-outline" size={22} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Dadi Maa ke Nuskhe</Text>
            <Text style={styles.heroSub}>
              {ageMonths !== null
                ? `Personalised for ${activeKid?.name || 'your baby'} · ${ageLabel}`
                : isExpecting
                ? `Saved for after ${activeKid?.name || 'baby'} arrives`
                : `${TOTAL_NUSKHE_COUNT} time-tested remedies across ${NUSKHE_CATEGORIES.length} ailments`}
            </Text>
          </View>
        </View>
        {ageMonths !== null && (
          <View style={styles.ageBanner}>
            <Ionicons name="shield-checkmark-outline" size={13} color={Colors.primary} />
            <Text style={styles.ageBannerText}>
              <Text style={styles.ageBannerStrong}>{safeForAgeCount}</Text>
              {' of '}
              <Text style={styles.ageBannerStrong}>{TOTAL_NUSKHE_COUNT}</Text>
              {' remedies safe at '}
              {ageLabel}
            </Text>
            {showAll ? (
              <TouchableOpacity onPress={() => setShowAll(false)} hitSlop={8}>
                <Text style={styles.ageBannerLink}>Safe-only</Text>
              </TouchableOpacity>
            ) : hiddenByAge > 0 ? (
              <TouchableOpacity onPress={() => setShowAll(true)} hitSlop={8}>
                <Text style={styles.ageBannerLink}>Show all</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
        {isExpecting && (
          <View style={styles.ageBanner}>
            <Ionicons name="heart-outline" size={13} color={Colors.primary} />
            <Text style={styles.ageBannerText}>
              These remedies are for after baby arrives. Bookmark this page —
              we'll auto-personalise it once you set {activeKid?.name || 'baby'}'s birthday.
            </Text>
          </View>
        )}
      </Card>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search remedies (e.g. ajwain, fever, hing)"
          placeholderTextColor="#9CA3AF"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Disclaimer banner — required by content source */}
      <View style={styles.disclaimer}>
        <Ionicons name="warning-outline" size={14} color="#B45309" />
        <Text style={styles.disclaimerText}>
          Traditional suggestions only — not medical advice. Always consult your
          pediatrician, especially for babies under 6 months.
        </Text>
      </View>

      {/* Categories */}
      {filteredCategories.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={32} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No remedies found</Text>
          <Text style={styles.emptyText}>
            Try a different word, or browse all 10 categories.
          </Text>
        </View>
      ) : (
        filteredCategories.map((cat) => {
          const fullCat = NUSKHE_CATEGORIES.find((c) => c.id === cat.id)!;
          const totalForAge =
            ageMonths === null
              ? fullCat.remedies.length
              : fullCat.remedies.filter((r) => ageMonths >= r.minAgeMonths).length;
          return (
            <CategoryAccordion
              key={cat.id}
              category={cat}
              ageMonths={ageMonths}
              totalForAge={totalForAge}
              expanded={trimmed.length > 0 ? true : openId === cat.id}
              onToggle={() => setOpenId((id) => (id === cat.id ? null : cat.id))}
            />
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    marginBottom: 12,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primaryAlpha08,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 16,
    color: INK,
  },
  heroSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: STONE,
    marginTop: 2,
    lineHeight: 17,
  },
  ageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryAlpha05,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10,
  },
  ageBannerText: {
    flex: 1,
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: '#374151',
    lineHeight: 16,
  },
  ageBannerStrong: {
    fontFamily: Fonts.sansBold,
    color: Colors.primary,
  },
  ageBannerLink: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    color: Colors.primary,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: MIST,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.sansRegular,
    fontSize: 13.5,
    color: INK,
    padding: 0,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 14,
  },
  disclaimerText: {
    flex: 1,
    fontFamily: Fonts.sansMedium,
    fontSize: 11.5,
    color: '#92400E',
    lineHeight: 16,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    color: INK,
    marginTop: 4,
  },
  emptyText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12.5,
    color: STONE,
    textAlign: 'center',
  },
});
