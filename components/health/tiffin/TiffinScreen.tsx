import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Colors, Fonts } from '../../../constants/theme';
import { ageBandForMonths, AgeBand, RECIPE_BY_ID, Recipe } from '../../../data/recipes';
import { FoodDiet } from '../../../data/babyFoods';
import { useMealPlannerStore, getLast7DaysRecipeIds } from '../../../store/useMealPlannerStore';
import { useFoodTrackerStore } from '../../../store/useFoodTrackerStore';
import { pickDailyRecipe } from '../../../lib/dailyPick';
import { DayKey, dayKeyForDate } from '../../../lib/weekKeys';
import TodaysPickCard from './TodaysPickCard';
import WeekStrip from './WeekStrip';
import DayPickerSheet from './DayPickerSheet';
import BrowseLibrary from './BrowseLibrary';
import RecipeDetailSheet from './RecipeDetailSheet';

const ROSE = Colors.primary;
const PLUM = Colors.primary;
const INK = '#1C1033';
const STONE = '#6B7280';

interface Props {
  kidId: string;
  kidName: string;
  ageMonths: number;
  diet: FoodDiet | undefined;
}

const DAY_FORMATTER = new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short' });

export default function TiffinScreen({ kidId, kidName, ageMonths, diet }: Props) {
  const router = useRouter();
  const ageBand: AgeBand = ageBandForMonths(ageMonths);
  const byKid = useMealPlannerStore((s) => s.byKid);
  const setDay = useMealPlannerStore((s) => s.setDay);
  const rolloverIfStale = useMealPlannerStore((s) => s.rolloverIfStale);
  const kidPlanner = byKid[kidId];
  const foodEntries = useFoodTrackerStore((s) => s.byKid[kidId] ?? {});

  // Rollover on mount + when kid changes
  useEffect(() => {
    rolloverIfStale(kidId);
  }, [kidId, rolloverIfStale]);

  // Derive flagged food IDs from tracker reactions
  const flaggedFoodIds = useMemo(() => {
    const s = new Set<string>();
    for (const [foodId, entry] of Object.entries(foodEntries)) {
      if ((entry.reaction === 'rash' || entry.reaction === 'vomit') && !entry.cleared) {
        s.add(foodId);
      }
    }
    return s;
  }, [foodEntries]);

  const today = new Date();
  const todayDayKey = dayKeyForDate(today);
  const todayLabel = DAY_FORMATTER.format(today);
  const todayPlanned = kidPlanner?.current.days[todayDayKey];

  // Swap counter — incrementing this lets the user reroll today's pick
  const [swapCount, setSwapCount] = useState(0);

  const pick = useMemo(() => {
    return pickDailyRecipe({
      ageBand,
      diet: diet ?? 'nonveg',
      last7DaysRecipeIds: getLast7DaysRecipeIds(kidPlanner),
      reactionFlaggedFoodIds: flaggedFoodIds,
      todayISO: today.toISOString().slice(0, 10),
      dayOfWeek: today.getDay(),
      todayPlanned,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ageBand, diet, kidPlanner, flaggedFoodIds, todayPlanned, swapCount]);

  const pickedRecipe: Recipe | null = pick.recipeId ? RECIPE_BY_ID[pick.recipeId] ?? null : null;

  const [openRecipe, setOpenRecipe] = useState<Recipe | null>(null);
  const [openDay, setOpenDay] = useState<DayKey | null>(null);

  function handleAskAI() {
    const plannedThisWeek = kidPlanner
      ? Object.entries(kidPlanner.current.days)
          .map(([_dk, d]) => {
            const r = d?.recipeId ? RECIPE_BY_ID[d.recipeId] : null;
            return r ? r.name : d?.freeText;
          })
          .filter(Boolean)
          .join(', ')
      : '';
    const parts: string[] = [`My child ${kidName} is ${Math.floor(ageMonths / 12)} years old.`];
    if (diet) parts.push(`We're a ${diet} family — please only suggest foods we eat.`);
    if (plannedThisWeek) parts.push(`This week we've planned: ${plannedThisWeek}.`);
    parts.push('What should I cook or pack for school tiffin this week?');
    router.push({ pathname: '/(tabs)/chat', params: { prefill: parts.join(' ') } });
  }

  return (
    <View>
      {/* SECTION 1 — Today's pick */}
      <Text style={styles.eyebrow}>For today</Text>
      <TodaysPickCard
        recipe={pickedRecipe}
        reasonOneLine={pick.reasonOneLine}
        isPlanned={!!todayPlanned?.recipeId}
        todayLabel={todayLabel}
        onView={() => pickedRecipe && setOpenRecipe(pickedRecipe)}
        onSwap={() => setSwapCount((c) => c + 1)}
      />

      {/* SECTION 2 — Weekly planner */}
      <Text style={styles.eyebrow}>This week</Text>
      <WeekStrip
        weekStartDate={kidPlanner?.current.weekStartDate ?? ''}
        days={kidPlanner?.current.days ?? {}}
        todayDayKey={todayDayKey}
        onTapDay={(dk) => setOpenDay(dk)}
      />

      {/* Ask MaaMitra CTA */}
      <TouchableOpacity onPress={handleAskAI} activeOpacity={0.9} style={styles.askBtn}>
        <LinearGradient colors={[ROSE, PLUM]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.askGrad}>
          <Ionicons name="sparkles" size={16} color="#fff" />
          <Text style={styles.askText}>Ask MaaMitra what to cook this week</Text>
          <Ionicons name="arrow-forward" size={14} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* SECTION 3 — Browse */}
      <View style={{ marginTop: 18 }}>
        <BrowseLibrary
          kidAgeBand={ageBand}
          diet={diet}
          flaggedFoodIds={flaggedFoodIds}
          onPickRecipe={(r) => setOpenRecipe(r)}
        />
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={14} color={PLUM} />
        <Text style={styles.disclaimerText}>
          Recipes are guidance — adapt textures and portions to your child. Check with your paediatrician for any concerns.
        </Text>
      </View>

      <RecipeDetailSheet
        visible={!!openRecipe}
        recipe={openRecipe}
        flaggedFoodIds={flaggedFoodIds}
        onClose={() => setOpenRecipe(null)}
        onAddToDay={(dk) => {
          if (openRecipe) setDay(kidId, dk, { recipeId: openRecipe.id });
          setOpenRecipe(null);
        }}
      />

      <DayPickerSheet
        visible={!!openDay}
        dayKey={openDay}
        ageBand={ageBand}
        diet={diet}
        flaggedFoodIds={flaggedFoodIds}
        onClose={() => setOpenDay(null)}
        onPick={(payload) => {
          if (openDay) setDay(kidId, openDay, payload);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: Fonts.sansBold, fontSize: 10.5, color: PLUM,
    letterSpacing: 1, textTransform: 'uppercase',
    marginTop: 10, marginBottom: 6, marginLeft: 2,
  },
  askBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 14 },
  askGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12,
  },
  askText: { fontFamily: Fonts.sansBold, color: '#fff', fontSize: 13.5 },
  disclaimer: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    marginTop: 18, padding: 12,
    backgroundColor: Colors.primaryAlpha05, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.primaryAlpha08,
  },
  disclaimerText: {
    fontFamily: Fonts.sansRegular, flex: 1, fontSize: 12, color: STONE, lineHeight: 17,
  },
});
