import { useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../../constants/theme';
import { CUISINE_BY_ID } from '../../../data/cuisines';
import { Recipe } from '../../../data/recipes';
import { DAY_KEYS, DayKey } from '../../../lib/weekKeys';
import { FOOD_BY_ID } from '../../../data/babyFoods';

const INK = '#1C1033';
const STONE = '#6B7280';
const MIST = '#EDE9F6';
const PLUM = Colors.primary;
const WARN_BG = '#FEF3C7';
const WARN_FG = '#92400E';
const WARN_BORDER = '#FCD34D';

interface Props {
  visible: boolean;
  recipe: Recipe | null;
  flaggedFoodIds?: Set<string>;
  onClose: () => void;
  onAddToDay: (dayKey: DayKey) => void;
}

const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

export default function RecipeDetailSheet({ visible, recipe, flaggedFoodIds, onClose, onAddToDay }: Props) {
  const cuisine = recipe ? CUISINE_BY_ID[recipe.cuisine] : null;
  const flaggedNames = useMemo(() => {
    if (!recipe || !flaggedFoodIds) return [];
    return recipe.containsFoodIds
      .filter((id) => flaggedFoodIds.has(id))
      .map((id) => FOOD_BY_ID[id]?.name)
      .filter((n): n is string => !!n);
  }, [recipe, flaggedFoodIds]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={INK} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{recipe?.name ?? ''}</Text>
          <View style={{ width: 22 }} />
        </View>
        {recipe && cuisine && (
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={[styles.heroIcon, { backgroundColor: cuisine.tint }]}>
              <Ionicons name={cuisine.icon as any} size={36} color={INK} />
            </View>
            <Text style={styles.recipeName}>{recipe.name}</Text>
            <Text style={styles.recipeMeta}>{cuisine.label} · {recipe.timeMinutes} min · Serves {recipe.serves}</Text>

            {flaggedNames.length > 0 && (
              <View style={styles.warnBanner}>
                <Ionicons name="warning-outline" size={16} color={WARN_FG} />
                <Text style={styles.warnText}>
                  Contains {flaggedNames.join(', ')}. Your child has had a reaction to {flaggedNames.length === 1 ? 'this' : 'one of these'} — review in the tracker before serving.
                </Text>
              </View>
            )}

            <Text style={styles.sectionLabel}>Ingredients</Text>
            {recipe.ingredients.map((ing, i) => (
              <Text key={i} style={styles.bullet}>• {ing}</Text>
            ))}

            <Text style={styles.sectionLabel}>Steps</Text>
            {recipe.steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <Text style={styles.stepNum}>{i + 1}</Text>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}

            {recipe.tip && (
              <View style={styles.tipBox}>
                <Ionicons name="bulb-outline" size={15} color={PLUM} />
                <Text style={styles.tipText}>{recipe.tip}</Text>
              </View>
            )}

            <Text style={styles.sectionLabel}>Add to planner</Text>
            <View style={styles.dayRow}>
              {DAY_KEYS.map((d) => (
                <TouchableOpacity
                  key={d}
                  onPress={() => onAddToDay(d)}
                  style={styles.dayBtn}
                  activeOpacity={0.85}
                >
                  <Text style={styles.dayBtnText}>{DAY_LABELS[d]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF9F0' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: MIST,
  },
  headerTitle: { fontFamily: Fonts.sansBold, fontSize: 15, color: INK, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  scroll: { padding: 18, paddingBottom: 60 },
  heroIcon: {
    width: 64, height: 64, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-start', marginBottom: 12,
  },
  recipeName: { fontFamily: Fonts.sansBold, fontSize: 20, color: INK, marginBottom: 4 },
  recipeMeta: { fontFamily: Fonts.sansRegular, fontSize: 13, color: STONE, marginBottom: 14 },
  warnBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 10, borderRadius: 10,
    backgroundColor: WARN_BG, borderWidth: 1, borderColor: WARN_BORDER,
    marginBottom: 18,
  },
  warnText: { flex: 1, fontFamily: Fonts.sansMedium, fontSize: 12.5, color: WARN_FG, lineHeight: 18 },
  sectionLabel: { fontFamily: Fonts.sansBold, fontSize: 13, color: INK, marginTop: 16, marginBottom: 8 },
  bullet: { fontFamily: Fonts.sansRegular, fontSize: 13, color: INK, lineHeight: 20, marginBottom: 3 },
  stepRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  stepNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.primaryAlpha08, color: PLUM,
    fontFamily: Fonts.sansBold, fontSize: 12, textAlign: 'center', lineHeight: 22,
  },
  stepText: { flex: 1, fontFamily: Fonts.sansRegular, fontSize: 13, color: INK, lineHeight: 19 },
  tipBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.primaryAlpha05,
    borderLeftWidth: 3, borderLeftColor: PLUM,
    borderRadius: 10, padding: 11, marginTop: 14,
  },
  tipText: { flex: 1, fontFamily: Fonts.sansMedium, fontSize: 12.5, color: '#4c1d95', lineHeight: 18 },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  dayBtn: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 11,
    backgroundColor: Colors.primaryAlpha08,
  },
  dayBtnText: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: PLUM },
});
