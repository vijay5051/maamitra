import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Card from '../ui/Card';
import FoodCategoryAccordion from './FoodCategoryAccordion';
import FoodDetailSheet from './FoodDetailSheet';
import {
  babyFoodsForDiet,
  FOOD_BY_ID,
  FOOD_CATEGORIES,
  FoodCategory,
  FoodRef,
  foodsByCategory,
} from '../../data/babyFoods';
import { useFoodTrackerStore } from '../../store/useFoodTrackerStore';
import { useActiveKid } from '../../hooks/useActiveKid';
import { calculateAgeInMonths, useProfileStore } from '../../store/useProfileStore';
import { Fonts } from '../../constants/theme';

const ROSE = '#E8487A';
const PLUM = '#7C3AED';
const SAGE = '#34D399';
const GOLD = '#F59E0B';
const MIST = '#EDE9F6';
const INK  = '#1C1033';
const STONE = '#6B7280';

export default function FoodTrackerTab() {
  const router = useRouter();
  const { activeKid, ageLabel } = useActiveKid();
  const parentDiet = useProfileStore((s) => s.profile?.diet);
  const byKid = useFoodTrackerStore((s) => s.byKid);
  const setEntry = useFoodTrackerStore((s) => s.setEntry);
  const clearFood = useFoodTrackerStore((s) => s.clearFood);

  const [selected, setSelected] = useState<FoodRef | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<FoodCategory | 'all'>('all');

  const kidId = activeKid?.id ?? '';
  const kidFoods = kidId ? byKid[kidId] ?? {} : {};

  const ageMonths = useMemo(() => {
    if (!activeKid || activeKid.isExpecting || !activeKid.dob) return null;
    return calculateAgeInMonths(activeKid.dob);
  }, [activeKid]);

  // Diet-filtered food list — drives totals, search, and category render.
  // Kept as a ref so the same array is used throughout this render.
  const visibleFoods = useMemo(() => babyFoodsForDiet(parentDiet), [parentDiet]);
  const visibleFoodIds = useMemo(() => new Set(visibleFoods.map((f) => f.id)), [visibleFoods]);

  // Counts only span foods this user can actually feed — so the percentage
  // reflects "how much of MY allowed list have I tried" rather than the
  // full master list.
  const clearedCount = Object.entries(kidFoods).filter(
    ([id, e]) => visibleFoodIds.has(id) && e.cleared,
  ).length;
  const inProgressCount = Object.entries(kidFoods).filter(
    ([id, e]) => visibleFoodIds.has(id) && !e.cleared && (e.d1Date || e.d2Date || e.d3Date),
  ).length;
  const reactionCount = Object.entries(kidFoods).filter(
    ([id, e]) => visibleFoodIds.has(id) && (e.reaction === 'rash' || e.reaction === 'vomit'),
  ).length;
  const pct = visibleFoods.length === 0 ? 0 : Math.round((clearedCount / visibleFoods.length) * 100);

  // ── No active kid ─────────────────────────────────────────────
  if (!activeKid) {
    return (
      <Card style={styles.emptyCard} shadow="sm">
        <Ionicons name="restaurant-outline" size={40} color={ROSE} style={{ marginBottom: 12, opacity: 0.85 }} />
        <Text style={styles.emptyTitle}>Add your baby first</Text>
        <Text style={styles.emptyText}>
          Add a child in your family profile to start tracking their first foods.
        </Text>
        <TouchableOpacity
          style={styles.emptyBtn}
          onPress={() => router.push('/(tabs)/family')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[ROSE, PLUM]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.emptyBtnGrad}
          >
            <Ionicons name="add-circle-outline" size={16} color="#fff" />
            <Text style={styles.emptyBtnText}>Add a child</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Card>
    );
  }

  // ── Expecting ─────────────────────────────────────────────────
  if (activeKid.isExpecting) {
    return (
      <Card style={styles.emptyCard} shadow="sm">
        <Ionicons name="heart-outline" size={40} color={PLUM} style={{ marginBottom: 12, opacity: 0.85 }} />
        <Text style={styles.emptyTitle}>Solids start later 💛</Text>
        <Text style={styles.emptyText}>
          Babies usually start solids around 6 months. We'll be ready to track when {activeKid.name || 'your baby'} arrives.
        </Text>
      </Card>
    );
  }

  // ── Under 6 months ────────────────────────────────────────────
  if (ageMonths !== null && ageMonths < 6) {
    return (
      <Card style={styles.emptyCard} shadow="sm">
        <Ionicons name="time-outline" size={40} color={GOLD} style={{ marginBottom: 12 }} />
        <Text style={styles.emptyTitle}>Just a little longer</Text>
        <Text style={styles.emptyText}>
          {activeKid.name} is {ageMonths} months old. The IAP recommends exclusive breastfeeding until 6 months — solids start then.
          {'\n\n'}We'll unlock the food tracker the day {activeKid.name} turns 6 months.
        </Text>
      </Card>
    );
  }

  const handleAskAI = () => {
    const cleared = visibleFoods
      .filter((f) => kidFoods[f.id]?.cleared)
      .map((f) => f.name.toLowerCase())
      .slice(0, 8)
      .join(', ');
    const inProg = visibleFoods
      .filter((f) => {
        const e = kidFoods[f.id];
        return e && !e.cleared && (e.d1Date || e.d2Date || e.d3Date);
      })
      .map((f) => f.name.toLowerCase())
      .join(', ');
    const reactions = visibleFoods
      .filter((f) => {
        const r = kidFoods[f.id]?.reaction;
        return r === 'rash' || r === 'vomit';
      })
      .map((f) => f.name.toLowerCase())
      .join(', ');

    const parts: string[] = [`My baby ${activeKid.name} is ${ageLabel}.`];
    if (parentDiet) parts.push(`We're a ${parentDiet} family — please only suggest foods we eat.`);
    if (clearedCount > 0) parts.push(`Foods we've successfully introduced: ${cleared || `${clearedCount} foods`}.`);
    if (inProg) parts.push(`Currently introducing: ${inProg}.`);
    if (reactions) parts.push(`Reactions to: ${reactions}.`);
    parts.push('What food should I try next, and any meal-idea suggestions for this age?');

    router.push({ pathname: '/(tabs)/chat', params: { prefill: parts.join(' ') } });
  };

  // Drop categories that have no foods left after the diet filter — e.g.
  // a vegetarian profile shouldn't see "Meat" / "Fish & Seafood" headers.
  const dietCategories = useMemo(
    () => FOOD_CATEGORIES.filter((c) => foodsByCategory(c.id, parentDiet).length > 0),
    [parentDiet],
  );
  const visibleCategories = activeCategory === 'all'
    ? dietCategories
    : dietCategories.filter((c) => c.id === activeCategory);
  const searchLower = search.trim().toLowerCase();

  return (
    <View>
      {/* Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryIconBox}>
            <Ionicons name="restaurant-outline" size={20} color={ROSE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryTitle}>{activeKid.name}'s food journey</Text>
            <Text style={styles.summarySubtitle}>
              {clearedCount} cleared
              {inProgressCount > 0 ? ` · ${inProgressCount} in progress` : ''}
              {reactionCount > 0 ? ` · ${reactionCount} reaction${reactionCount === 1 ? '' : 's'}` : ''}
            </Text>
          </View>
          <Text style={styles.summaryPct}>{pct}%</Text>
        </View>
        <View style={styles.bar}>
          <LinearGradient
            colors={[ROSE, PLUM]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.barFill, { width: `${pct}%` as any }]}
          />
        </View>
      </View>

      {/* 3-day rule explainer */}
      <View style={styles.ruleBox}>
        <Ionicons name="information-circle-outline" size={15} color={PLUM} />
        <Text style={styles.ruleText}>
          The 3-day rule: introduce ONE new food, feed for 3 days, watch for rash / tummy / vomiting / fussiness, then try the next.
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={STONE} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search foods (apple, paneer, ragi…)"
          placeholderTextColor="#9ca3af"
          style={styles.searchInput}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={6}>
            <Ionicons name="close-circle" size={16} color={STONE} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category pills */}
      {searchLower.length === 0 && (
        <View style={styles.pillsWrap}>
          <TouchableOpacity
            onPress={() => setActiveCategory('all')}
            activeOpacity={0.85}
            style={[styles.pill, activeCategory === 'all' && styles.pillActive]}
          >
            <Text style={[styles.pillText, activeCategory === 'all' && styles.pillTextActive]}>All</Text>
          </TouchableOpacity>
          {dietCategories.map((c) => (
            <TouchableOpacity
              key={c.id}
              onPress={() => setActiveCategory(c.id)}
              activeOpacity={0.85}
              style={[styles.pill, activeCategory === c.id && styles.pillActive]}
            >
              <Text style={[styles.pillText, activeCategory === c.id && styles.pillTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* AI suggest */}
      <TouchableOpacity onPress={handleAskAI} activeOpacity={0.9} style={styles.askBtn}>
        <LinearGradient
          colors={[ROSE, PLUM]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.askBtnGrad}
        >
          <Ionicons name="sparkles" size={16} color="#fff" />
          <Text style={styles.askBtnText}>Ask MaaMitra what to try next</Text>
          <Ionicons name="arrow-forward" size={14} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Search results */}
      {searchLower.length > 0 ? (
        <View style={{ marginTop: 12 }}>
          {visibleFoods
            .filter((f) => f.name.toLowerCase().includes(searchLower))
            .slice(0, 30)
            .map((f) => {
              const entry = kidFoods[f.id];
              const cleared = entry?.cleared;
              const inProg = entry && !entry.cleared && (entry.d1Date || entry.d2Date || entry.d3Date);
              const dotColor = cleared ? SAGE : inProg ? GOLD : MIST;
              return (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => setSelected(FOOD_BY_ID[f.id])}
                  activeOpacity={0.7}
                  style={styles.searchRow2}
                >
                  <View style={[styles.searchDot, { backgroundColor: dotColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchName}>{f.name}</Text>
                    <Text style={styles.searchMeta}>
                      {FOOD_CATEGORIES.find((c) => c.id === f.category)?.label} · From {f.minAgeMonths} mo
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#9ca3af" />
                </TouchableOpacity>
              );
            })}
          {visibleFoods.filter((f) => f.name.toLowerCase().includes(searchLower)).length === 0 && (
            <Text style={styles.searchEmpty}>
              No food matches "{search}". Try another spelling or browse a category.
            </Text>
          )}
        </View>
      ) : (
        <View style={{ marginTop: 12 }}>
          {visibleCategories.map((cat) => (
            <FoodCategoryAccordion
              key={cat.id}
              category={cat}
              foods={foodsByCategory(cat.id, parentDiet)}
              kidFoods={kidFoods}
              kidAgeMonths={ageMonths ?? 0}
              onSelect={(f) => setSelected(f)}
              defaultOpen={activeCategory === cat.id}
            />
          ))}
        </View>
      )}

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={14} color={PLUM} />
        <Text style={styles.disclaimerText}>
          Age guidance follows IAP / AAP weaning recommendations. Every baby is different — check with your paediatrician for any concerns.
        </Text>
      </View>

      <FoodDetailSheet
        visible={!!selected}
        food={selected}
        entry={selected ? kidFoods[selected.id] ?? null : null}
        kidAgeMonths={ageMonths ?? 0}
        kidName={activeKid.name}
        onSave={(entry) => {
          if (selected) setEntry(kidId, selected.id, entry);
        }}
        onClear={() => {
          if (selected) clearFood(kidId, selected.id);
        }}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  emptyCard: { alignItems: 'center', paddingVertical: 32 },
  emptyTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 16,
    color: INK,
    marginBottom: 6,
  },
  emptyText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13.5,
    color: STONE,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 290,
  },
  emptyBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 16 },
  emptyBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  emptyBtnText: { fontFamily: Fonts.sansBold, color: '#fff', fontSize: 14 },

  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: MIST,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  summaryIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(232,72,122,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 14.5,
    color: INK,
  },
  summarySubtitle: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: STONE,
    marginTop: 1,
  },
  summaryPct: {
    fontFamily: Fonts.sansBold,
    fontSize: 16,
    color: ROSE,
  },
  bar: {
    height: 8,
    backgroundColor: MIST,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },

  ruleBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(124,58,237,0.06)',
    borderLeftWidth: 3,
    borderLeftColor: PLUM,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  ruleText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12.5,
    color: '#4c1d95',
    flex: 1,
    lineHeight: 18,
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MIST,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.sansRegular,
    fontSize: 13.5,
    color: INK,
    paddingVertical: 4,
  },

  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  pill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#FFF8FC',
    borderWidth: 1,
    borderColor: MIST,
  },
  pillActive: {
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderColor: PLUM,
  },
  pillText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11.5,
    color: STONE,
  },
  pillTextActive: {
    color: PLUM,
  },

  askBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  askBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  askBtnText: { fontFamily: Fonts.sansBold, color: '#ffffff', fontSize: 14 },

  searchRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MIST,
    marginBottom: 6,
  },
  searchDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#D9D2EA',
  },
  searchName: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: INK,
  },
  searchMeta: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: STONE,
    marginTop: 1,
  },
  searchEmpty: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12.5,
    color: STONE,
    textAlign: 'center',
    paddingVertical: 14,
  },

  disclaimer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginTop: 14,
    padding: 12,
    backgroundColor: 'rgba(124,58,237,0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.1)',
  },
  disclaimerText: {
    fontFamily: Fonts.sansRegular,
    flex: 1,
    fontSize: 12,
    color: STONE,
    lineHeight: 17,
  },
});
