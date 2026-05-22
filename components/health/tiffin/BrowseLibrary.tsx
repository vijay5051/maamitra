import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../../constants/theme';
import { CUISINES, Cuisine } from '../../../data/cuisines';
import { AGE_BANDS, AgeBand, filterRecipes, Recipe } from '../../../data/recipes';
import { FoodDiet } from '../../../data/babyFoods';
import RecipeCard from './RecipeCard';

const INK = '#1C1033';
const STONE = '#6B7280';
const MIST = '#EDE9F6';
const PLUM = Colors.primary;

interface Props {
  kidAgeBand: AgeBand;
  diet: FoodDiet | undefined;
  flaggedFoodIds?: Set<string>;
  onPickRecipe: (r: Recipe) => void;
}

export default function BrowseLibrary({ kidAgeBand, diet, flaggedFoodIds, onPickRecipe }: Props) {
  const [cuisine, setCuisine] = useState<Cuisine | 'all'>('all');
  const [search, setSearch] = useState('');

  // Age band is locked to the active kid's actual band. No toggle —
  // the kid's age is the source of truth. If a parent wants to browse
  // recipes for a different kid, they switch the active kid in the
  // family picker.
  const recipes = useMemo(
    () => filterRecipes({ diet, ageBand: kidAgeBand, cuisine, search }),
    [diet, kidAgeBand, cuisine, search],
  );

  const currentBand = AGE_BANDS.find((b) => b.id === kidAgeBand);

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Browse recipes</Text>
        <View style={styles.ageLabel}>
          <Text style={styles.ageLabelText}>
            {currentBand?.label} · {currentBand?.range}
          </Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
        <Pill label="All" active={cuisine === 'all'} onPress={() => setCuisine('all')} />
        {CUISINES.map((c) => (
          <Pill key={c.id} label={c.label} active={cuisine === c.id} onPress={() => setCuisine(c.id)} />
        ))}
      </ScrollView>

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={STONE} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search paneer, dosa, paratha…"
          placeholderTextColor="#9ca3af"
          style={styles.searchInput}
        />
      </View>

      <View style={{ marginTop: 10 }}>
        {recipes.length === 0 ? (
          <Text style={styles.empty}>No recipes match. Try a different cuisine or age band.</Text>
        ) : (
          recipes.slice(0, 60).map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              flaggedFoodIds={flaggedFoodIds}
              onPress={() => onPickRecipe(r)}
            />
          ))
        )}
      </View>
    </View>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontFamily: Fonts.sansBold, fontSize: 14.5, color: INK },
  ageLabel: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, backgroundColor: Colors.primaryAlpha05,
    borderWidth: 1, borderColor: Colors.primaryAlpha08,
  },
  ageLabelText: { fontFamily: Fonts.sansSemiBold, fontSize: 11.5, color: PLUM },
  pillsRow: { flexDirection: 'row', gap: 6, paddingBottom: 4 },
  pill: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14,
    backgroundColor: '#fff', borderWidth: 1, borderColor: MIST,
  },
  pillActive: { backgroundColor: Colors.primaryAlpha08, borderColor: PLUM },
  pillText: { fontFamily: Fonts.sansSemiBold, fontSize: 11.5, color: STONE },
  pillTextActive: { color: PLUM },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 10, padding: 10,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: MIST,
  },
  searchInput: { flex: 1, fontFamily: Fonts.sansRegular, fontSize: 13.5, color: INK },
  empty: { fontFamily: Fonts.sansRegular, fontSize: 12.5, color: STONE, textAlign: 'center', paddingVertical: 20 },
});
