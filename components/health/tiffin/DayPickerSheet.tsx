import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../../constants/theme';
import { DayKey } from '../../../lib/weekKeys';
import { AgeBand, filterRecipes } from '../../../data/recipes';
import { FoodDiet } from '../../../data/babyFoods';
import RecipeCard from './RecipeCard';

const INK = '#1C1033';
const STONE = '#6B7280';
const MIST = '#EDE9F6';
const PLUM = Colors.primary;

interface Props {
  visible: boolean;
  dayKey: DayKey | null;
  ageBand: AgeBand;
  diet: FoodDiet | undefined;
  flaggedFoodIds?: Set<string>;
  onClose: () => void;
  onPick: (payload: { recipeId?: string; freeText?: string }) => void;
}

const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

export default function DayPickerSheet({ visible, dayKey, ageBand, diet, flaggedFoodIds, onClose, onPick }: Props) {
  const [search, setSearch] = useState('');
  const [freeText, setFreeText] = useState('');

  const recipes = useMemo(
    () => filterRecipes({ diet, ageBand, search }),
    [diet, ageBand, search],
  );

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
            Plan {dayKey ? DAY_LABELS[dayKey] : ''}
          </Text>
          <View style={{ width: 22 }} />
        </View>
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
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {recipes.slice(0, 50).map((rec) => (
            <RecipeCard
              key={rec.id}
              recipe={rec}
              flaggedFoodIds={flaggedFoodIds}
              onPress={() => { onPick({ recipeId: rec.id }); onClose(); }}
            />
          ))}
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
              style={styles.addBtn}
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
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 16, padding: 10,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: MIST,
  },
  searchInput: { flex: 1, fontFamily: Fonts.sansRegular, fontSize: 13.5, color: INK },
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
  addBtnText: { fontFamily: Fonts.sansBold, color: '#fff', fontSize: 13 },
});
