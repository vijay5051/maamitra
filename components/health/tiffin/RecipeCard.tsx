import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Fonts } from '../../../constants/theme';
import { CUISINE_BY_ID } from '../../../data/cuisines';
import { Recipe } from '../../../data/recipes';

const INK = '#1C1033';
const STONE = '#6B7280';
const MIST = '#EDE9F6';
const WARN_BG = '#FEF3C7';
const WARN_FG = '#92400E';
const WARN_BORDER = '#FCD34D';

interface Props {
  recipe: Recipe;
  /** IDs from babyFoods.ts that triggered an uncleared rash/vomit for this kid. */
  flaggedFoodIds?: Set<string>;
  onPress: () => void;
}

export default function RecipeCard({ recipe, flaggedFoodIds, onPress }: Props) {
  const cuisine = CUISINE_BY_ID[recipe.cuisine];
  const flagged = flaggedFoodIds
    ? recipe.containsFoodIds.filter((id) => flaggedFoodIds.has(id))
    : [];
  const tagsLine = recipe.tags
    .filter((t) => t === 'tiffin' || t === 'breakfast' || t === 'quick' || t === 'festive')
    .slice(0, 2)
    .map((t) => t[0].toUpperCase() + t.slice(1))
    .join(' · ');

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.card}>
      <View style={[styles.iconBox, { backgroundColor: cuisine.tint }]}>
        <Ionicons name={cuisine.icon as any} size={20} color={INK} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.name} numberOfLines={1}>{recipe.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {cuisine.label} · {recipe.timeMinutes} min{tagsLine ? ` · ${tagsLine}` : ''}
        </Text>
        {flagged.length > 0 && (
          <View style={styles.warnChip}>
            <Ionicons name="warning-outline" size={11} color={WARN_FG} />
            <Text style={styles.warnText}>
              Contains {flagged.length} watch ingredient{flagged.length === 1 ? '' : 's'}
            </Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={14} color="#C5BDD3" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#ffffff',
    borderRadius: 13,
    padding: 11,
    borderWidth: 1,
    borderColor: MIST,
    marginBottom: 8,
  },
  iconBox: {
    width: 44, height: 44, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontFamily: Fonts.sansSemiBold, fontSize: 13.5, color: INK, marginBottom: 2 },
  meta: { fontFamily: Fonts.sansRegular, fontSize: 11, color: STONE },
  warnChip: {
    alignSelf: 'flex-start',
    marginTop: 4,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 7,
    backgroundColor: WARN_BG,
    borderWidth: 1, borderColor: WARN_BORDER,
  },
  warnText: { fontFamily: Fonts.sansSemiBold, fontSize: 10, color: WARN_FG },
});
