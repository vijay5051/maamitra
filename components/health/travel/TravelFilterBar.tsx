import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Fonts } from '../../../constants/theme';
import { TravelFilter } from '../../../store/useTravelRecipeStore';
import { TravelCategory, TravelAllergen, TRAVEL_CATEGORIES } from '../../../data/travelRecipes';

const PURPLE = Colors.primary;
const CHIP_BG = Colors.primaryAlpha08;
const CHIP_ACTIVE_BG = Colors.primary;

interface Props {
  filter: TravelFilter;
  onSetFilter: (patch: Partial<TravelFilter>) => void;
  onReset: () => void;
}

interface Chip {
  id: string;
  label: string;
  group: 'category' | 'storage' | 'allergen' | 'tripType';
}

const STORAGE_CHIPS: Chip[] = [
  { id: 'no_fridge', label: '🌡️ No Fridge', group: 'storage' },
  { id: 'thermos', label: '🌡️ Thermos', group: 'storage' },
];

const ALLERGEN_CHIPS: { id: TravelAllergen; label: string }[] = [
  { id: 'milk',      label: '🥛 Dairy-Free' },
  { id: 'gluten',    label: '🌾 Gluten-Free' },
  { id: 'tree_nuts', label: '🥜 Nut-Free' },
  { id: 'egg',       label: '🥚 Egg-Free' },
];

const TRIP_CHIPS: { id: string; label: string }[] = [
  { id: 'flight_short', label: '✈️ Short Flight' },
  { id: 'flight_long',  label: '✈️ Long Flight' },
  { id: 'train',        label: '🚂 Train' },
  { id: 'road_trip',    label: '🚗 Road Trip' },
  { id: 'vacation',     label: '🏖️ Vacation' },
];

export default function TravelFilterBar({ filter, onSetFilter, onReset }: Props) {
  const activeCount =
    filter.categories.length +
    (filter.noFridge ? 1 : 0) +
    filter.allergenFreeOf.length +
    (filter.travelType ? 1 : 0);

  function toggleCategory(key: TravelCategory) {
    const next = filter.categories.includes(key)
      ? filter.categories.filter((c) => c !== key)
      : [...filter.categories, key];
    onSetFilter({ categories: next });
  }

  function toggleAllergen(key: TravelAllergen) {
    const next = filter.allergenFreeOf.includes(key)
      ? filter.allergenFreeOf.filter((a) => a !== key)
      : [...filter.allergenFreeOf, key];
    onSetFilter({ allergenFreeOf: next });
  }

  function toggleTripType(id: string) {
    onSetFilter({ travelType: filter.travelType === id ? null : (id as any) });
  }

  return (
    <View style={styles.wrapper}>
      {/* Row 1 — categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {TRAVEL_CATEGORIES.map((cat) => {
          const active = filter.categories.includes(cat.key);
          return (
            <TouchableOpacity
              key={cat.key}
              onPress={() => toggleCategory(cat.key)}
              style={[styles.chip, active && styles.chipActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {cat.icon} {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Row 2 — trip type + storage + allergen */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {TRIP_CHIPS.map((c) => {
          const active = filter.travelType === c.id;
          return (
            <TouchableOpacity
              key={c.id}
              onPress={() => toggleTripType(c.id)}
              style={[styles.chip, active && styles.chipActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          onPress={() => onSetFilter({ noFridge: !filter.noFridge })}
          style={[styles.chip, filter.noFridge && styles.chipActive]}
          activeOpacity={0.8}
        >
          <Text style={[styles.chipText, filter.noFridge && styles.chipTextActive]}>🚫 No Fridge</Text>
        </TouchableOpacity>
        {ALLERGEN_CHIPS.map((c) => {
          const active = filter.allergenFreeOf.includes(c.id);
          return (
            <TouchableOpacity
              key={c.id}
              onPress={() => toggleAllergen(c.id)}
              style={[styles.chip, active && styles.chipActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          onPress={() => onSetFilter({ hotWeather: !filter.hotWeather })}
          style={[styles.chip, filter.hotWeather && styles.chipWarn]}
          activeOpacity={0.8}
        >
          <Text style={[styles.chipText, filter.hotWeather && styles.chipTextWarn]}>☀️ Hot Weather</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Reset bar — only when filters active */}
      {activeCount > 0 && (
        <View style={styles.resetRow}>
          <Text style={styles.resetCount}>{activeCount} filter{activeCount > 1 ? 's' : ''} active</Text>
          <TouchableOpacity onPress={onReset} hitSlop={8}>
            <Text style={styles.resetBtn}>Clear all</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { backgroundColor: Colors.bgLight, paddingTop: 8 },
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  chip: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: CHIP_ACTIVE_BG,
    borderColor: CHIP_ACTIVE_BG,
  },
  chipWarn: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  chipText: {
    fontFamily: Fonts.sansSemiBold ?? Fonts.sansBold,
    fontSize: 12.5,
    color: Colors.textDark,
  },
  chipTextActive: {
    color: Colors.white,
  },
  chipTextWarn: {
    color: '#92400E',
  },
  resetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  resetCount: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: Colors.textMuted,
  },
  resetBtn: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    color: PURPLE,
  },
});
