import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Fonts } from '../../../constants/theme';
import { CUISINE_BY_ID } from '../../../data/cuisines';
import { Recipe } from '../../../data/recipes';

const INK = '#1C1033';
const STONE = '#6B7280';
const ROSE = Colors.primary;
const PLUM = Colors.primary;
const MIST = '#EDE9F6';

interface Props {
  recipe: Recipe | null;
  reasonOneLine: string;
  isPlanned: boolean;
  todayLabel: string; // e.g. "Thu, 22 May"
  onView: () => void;
  onSwap: () => void;
}

export default function TodaysPickCard({ recipe, reasonOneLine, isPlanned, todayLabel, onView, onSwap }: Props) {
  if (!recipe) {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>★ Today's pick</Text>
        <Text style={styles.emptyText}>{reasonOneLine}</Text>
      </View>
    );
  }
  const cuisine = CUISINE_BY_ID[recipe.cuisine];
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.label}>{isPlanned ? '✓ Planned today' : "★ Today's pick"}</Text>
        <Text style={styles.dayBadge}>{todayLabel}</Text>
      </View>
      <View style={styles.recipeRow}>
        <View style={[styles.iconBox, { backgroundColor: cuisine.tint }]}>
          <Ionicons name={cuisine.icon as any} size={28} color={INK} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.recipeName}>{recipe.name}</Text>
          <Text style={styles.recipeMeta}>
            {cuisine.label} · {recipe.timeMinutes} min · Serves {recipe.serves}
          </Text>
        </View>
      </View>
      <View style={styles.reasonBox}>
        <Text style={styles.reasonText}>{reasonOneLine}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={onView} activeOpacity={0.9}>
          <LinearGradient colors={[ROSE, PLUM]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryGrad}>
            <Text style={styles.primaryText}>View recipe</Text>
          </LinearGradient>
        </TouchableOpacity>
        {!isPlanned && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={onSwap} activeOpacity={0.85}>
            <Text style={styles.secondaryText}>Swap</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1, borderColor: '#F1EBF8',
    marginBottom: 12,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  label: { fontFamily: Fonts.sansBold, fontSize: 11, color: ROSE, letterSpacing: 1 },
  dayBadge: { fontFamily: Fonts.sansSemiBold, fontSize: 11, color: STONE },
  recipeRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  iconBox: {
    width: 56, height: 56, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  recipeName: { fontFamily: Fonts.sansBold, fontSize: 16, color: INK, marginBottom: 2 },
  recipeMeta: { fontFamily: Fonts.sansRegular, fontSize: 12, color: STONE },
  reasonBox: {
    marginTop: 10, paddingHorizontal: 11, paddingVertical: 9,
    backgroundColor: Colors.primaryAlpha05,
    borderLeftWidth: 3, borderLeftColor: PLUM,
    borderRadius: 8,
  },
  reasonText: { fontFamily: Fonts.sansMedium, fontSize: 12.5, color: '#4c1d95', lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  primaryBtn: { flex: 1, borderRadius: 11, overflow: 'hidden' },
  primaryGrad: { paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: Fonts.sansBold, color: '#fff', fontSize: 13.5 },
  secondaryBtn: {
    paddingVertical: 11, paddingHorizontal: 18, borderRadius: 11,
    backgroundColor: '#fff', borderWidth: 1, borderColor: MIST,
  },
  secondaryText: { fontFamily: Fonts.sansSemiBold, color: PLUM, fontSize: 13 },
  emptyText: { fontFamily: Fonts.sansRegular, fontSize: 13, color: STONE, marginTop: 8 },
});
