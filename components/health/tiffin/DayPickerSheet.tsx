import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../../constants/theme';
import { DayKey } from '../../../lib/weekKeys';
import { AgeBand, filterRecipes, RECIPE_BY_ID } from '../../../data/recipes';
import { CUISINE_BY_ID } from '../../../data/cuisines';
import { FoodDiet } from '../../../data/babyFoods';
import { PlannedDay } from '../../../store/useMealPlannerStore';
import RecipeCard from './RecipeCard';

const INK = '#1C1033';
const STONE = '#6B7280';
const MIST = '#EDE9F6';
const PLUM = Colors.primary;
const ROSE = Colors.primary;
const SAGE = '#34D399';

interface Props {
  visible: boolean;
  dayKey: DayKey | null;
  ageBand: AgeBand;
  diet: FoodDiet | undefined;
  flaggedFoodIds?: Set<string>;
  /** Current plan for the open day, if any. Drives the "Currently planned" header. */
  currentPlanned?: PlannedDay;
  onClose: () => void;
  onPick: (payload: { recipeId?: string; freeText?: string }) => void;
  /** Clear the existing plan for the open day. */
  onClear: () => void;
}

const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

export default function DayPickerSheet({
  visible, dayKey, ageBand, diet, flaggedFoodIds, currentPlanned, onClose, onPick, onClear,
}: Props) {
  const [search, setSearch] = useState('');
  const [freeText, setFreeText] = useState('');

  const recipes = useMemo(
    () => filterRecipes({ diet, ageBand, search }),
    [diet, ageBand, search],
  );

  // Resolve the currently-planned recipe (if any) for the "Currently planned" card.
  const currentRecipe = currentPlanned?.recipeId ? RECIPE_BY_ID[currentPlanned.recipeId] ?? null : null;
  const currentCuisine = currentRecipe ? CUISINE_BY_ID[currentRecipe.cuisine] : null;
  const hasCurrent = !!(currentRecipe || currentPlanned?.freeText);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={INK} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {hasCurrent ? `Edit ${dayKey ? DAY_LABELS[dayKey] : ''}` : `Plan ${dayKey ? DAY_LABELS[dayKey] : ''}`}
          </Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* Currently planned card — only when a plan exists for this day */}
          {hasCurrent && (
            <View style={styles.currentCard}>
              <View style={styles.currentTopRow}>
                <View style={styles.currentDot} />
                <Text style={styles.currentLabel}>Currently planned</Text>
              </View>
              <View style={styles.currentRecipeRow}>
                {currentCuisine && (
                  <View style={[styles.currentIcon, { backgroundColor: currentCuisine.tint }]}>
                    <Ionicons name={currentCuisine.icon as any} size={22} color={INK} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.currentName}>
                    {currentRecipe?.name ?? currentPlanned?.freeText}
                  </Text>
                  {currentRecipe && currentCuisine && (
                    <Text style={styles.currentMeta}>
                      {currentCuisine.label} · {currentRecipe.timeMinutes} min · Serves {currentRecipe.serves}
                    </Text>
                  )}
                  {!currentRecipe && currentPlanned?.freeText && (
                    <Text style={styles.currentMeta}>Custom note</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => { onClear(); onClose(); }}
                activeOpacity={0.85}
              >
                <Ionicons name="trash-outline" size={14} color={ROSE} />
                <Text style={styles.clearBtnText}>Clear this day</Text>
              </TouchableOpacity>
              <Text style={styles.swapHint}>Tap any recipe below to swap.</Text>
            </View>
          )}

          {/* Search */}
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color={STONE} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search dosa, paratha…"
              placeholderTextColor="#9ca3af"
              style={styles.searchInput}
            />
          </View>

          {/* Recipe list */}
          {recipes.slice(0, 50).map((rec) => {
            const isCurrent = currentPlanned?.recipeId === rec.id;
            return (
              <View key={rec.id} style={isCurrent ? styles.recipeWrapCurrent : undefined}>
                <RecipeCard
                  recipe={rec}
                  flaggedFoodIds={flaggedFoodIds}
                  onPress={() => { onPick({ recipeId: rec.id }); onClose(); }}
                />
              </View>
            );
          })}

          {/* Free-text fallback */}
          <Text style={styles.orLabel}>Or type something custom</Text>
          <View style={styles.freeRow}>
            <TextInput
              value={freeText}
              onChangeText={setFreeText}
              placeholder="e.g. leftover dal-rice"
              placeholderTextColor="#9ca3af"
              style={styles.freeInput}
            />
            <TouchableOpacity
              style={[styles.addBtn, freeText.trim().length === 0 && styles.addBtnDisabled]}
              disabled={freeText.trim().length === 0}
              onPress={() => {
                onPick({ freeText: freeText.trim() });
                setFreeText('');
                onClose();
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF9F0' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: MIST,
  },
  headerTitle: { fontFamily: Fonts.sansBold, fontSize: 15, color: INK, flex: 1, textAlign: 'center' },

  currentCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1, borderColor: '#F1EBF8',
    marginBottom: 16,
  },
  currentTopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 10,
  },
  currentDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: SAGE },
  currentLabel: {
    fontFamily: Fonts.sansBold, fontSize: 10.5, color: PLUM,
    letterSpacing: 1, textTransform: 'uppercase',
  },
  currentRecipeRow: { flexDirection: 'row', gap: 11, alignItems: 'center' },
  currentIcon: {
    width: 44, height: 44, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  currentName: { fontFamily: Fonts.sansBold, fontSize: 15, color: INK, marginBottom: 2 },
  currentMeta: { fontFamily: Fonts.sansRegular, fontSize: 12, color: STONE },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 11, paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#FFF1F2',
    borderWidth: 1, borderColor: '#FECDD3',
  },
  clearBtnText: { fontFamily: Fonts.sansSemiBold, fontSize: 12, color: ROSE },
  swapHint: {
    fontFamily: Fonts.sansRegular, fontSize: 11.5, color: STONE,
    marginTop: 8, fontStyle: 'italic',
  },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, marginBottom: 12,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: MIST,
  },
  searchInput: { flex: 1, fontFamily: Fonts.sansRegular, fontSize: 13.5, color: INK },

  recipeWrapCurrent: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: SAGE,
    marginBottom: 4,
  },

  orLabel: {
    fontFamily: Fonts.sansBold, fontSize: 12, color: STONE,
    textAlign: 'center', marginTop: 16, marginBottom: 8, letterSpacing: 0.5,
  },
  freeRow: { flexDirection: 'row', gap: 8 },
  freeInput: {
    flex: 1, fontFamily: Fonts.sansRegular, fontSize: 13.5, color: INK,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: MIST,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  addBtn: {
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 11,
    backgroundColor: PLUM,
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { fontFamily: Fonts.sansBold, color: '#fff', fontSize: 13 },
});
