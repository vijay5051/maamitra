import { useEffect, useState, useCallback } from 'react';
import {
  FlatList,
  SectionList,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../../constants/theme';
import { useTravelRecipeStore } from '../../../store/useTravelRecipeStore';
import { useActiveKid } from '../../../hooks/useActiveKid';
import { calculateAgeInMonths, isPlausibleDob } from '../../../lib/dob';
import { TravelRecipe, TRAVEL_CATEGORIES, CATEGORY_BY_KEY } from '../../../data/travelRecipes';
import TravelFilterBar from './TravelFilterBar';
import TravelRecipeCard from './TravelRecipeCard';
import TravelRecipeDetail from './TravelRecipeDetail';

interface Section {
  title: string;
  icon: string;
  data: TravelRecipe[];
}

export default function TravelRecipeHub() {
  const { activeKid } = useActiveKid();
  const ageMonths =
    activeKid && !activeKid.isExpecting && activeKid.dob && isPlausibleDob(activeKid.dob)
      ? calculateAgeInMonths(activeKid.dob)
      : undefined;

  const {
    filter,
    setFilter,
    resetFilter,
    isLoading,
    fetchRecipes,
    getFiltered,
    isBookmarked,
    toggleBookmark,
    bookmarks,
    getBookmarkedRecipes,
  } = useTravelRecipeStore();

  const [selectedRecipe, setSelectedRecipe] = useState<TravelRecipe | null>(null);
  const [showPackOnly, setShowPackOnly] = useState(false);

  useEffect(() => {
    fetchRecipes();
  }, []);

  const filtered = getFiltered(ageMonths);
  const bookmarkedRecipes = getBookmarkedRecipes();
  const displayRecipes = showPackOnly ? bookmarkedRecipes : filtered;

  const sections: Section[] = TRAVEL_CATEGORIES.map((cat) => ({
    title: cat.label,
    icon: cat.icon,
    data: displayRecipes.filter((r) => r.category === cat.key),
  })).filter((s) => s.data.length > 0);

  const packCount = Object.keys(bookmarks).length;

  const renderItem = useCallback(
    ({ item }: { item: TravelRecipe }) => (
      <View style={styles.cardWrap}>
        <TravelRecipeCard
          recipe={item}
          isBookmarked={isBookmarked(item.id)}
          hotWeather={filter.hotWeather}
          onPress={() => setSelectedRecipe(item)}
          onBookmark={() => toggleBookmark(item.id)}
        />
      </View>
    ),
    [filter.hotWeather, isBookmarked, toggleBookmark],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionIcon}>{section.icon}</Text>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Text style={styles.sectionCount}>{section.data.length}</Text>
      </View>
    ),
    [],
  );

  return (
    <View style={styles.container}>
      {/* Pack toggle row */}
      <View style={styles.packRow}>
        <TouchableOpacity
          onPress={() => setShowPackOnly(false)}
          style={[styles.packTab, !showPackOnly && styles.packTabActive]}
          activeOpacity={0.8}
        >
          <Ionicons
            name="search-outline"
            size={14}
            color={!showPackOnly ? Colors.white : Colors.textMuted}
          />
          <Text style={[styles.packTabText, !showPackOnly && styles.packTabTextActive]}>
            Browse
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowPackOnly(true)}
          style={[styles.packTab, showPackOnly && styles.packTabActive]}
          activeOpacity={0.8}
        >
          <Ionicons
            name="bag-outline"
            size={14}
            color={showPackOnly ? Colors.white : Colors.textMuted}
          />
          <Text style={[styles.packTabText, showPackOnly && styles.packTabTextActive]}>
            My Pack {packCount > 0 ? `(${packCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter bar — only in browse mode */}
      {!showPackOnly && (
        <TravelFilterBar filter={filter} onSetFilter={setFilter} onReset={resetFilter} />
      )}

      {/* Loading state */}
      {isLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      )}

      {/* Empty pack state */}
      {showPackOnly && bookmarkedRecipes.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎒</Text>
          <Text style={styles.emptyTitle}>Your travel pack is empty</Text>
          <Text style={styles.emptyBody}>
            Browse recipes and tap the bookmark icon to save them here for your next trip.
          </Text>
          <TouchableOpacity onPress={() => setShowPackOnly(false)} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>Browse recipes</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Empty browse state */}
      {!showPackOnly && sections.length === 0 && !isLoading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>No recipes match your filters</Text>
          <TouchableOpacity onPress={resetFilter} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>Clear filters</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Recipe list */}
      {sections.length > 0 && (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Detail modal */}
      {selectedRecipe && (
        <TravelRecipeDetail
          recipe={selectedRecipe}
          hotWeather={filter.hotWeather}
          onHotWeatherChange={(v) => setFilter({ hotWeather: v })}
          isBookmarked={isBookmarked(selectedRecipe.id)}
          onBookmark={() => toggleBookmark(selectedRecipe.id)}
          onClose={() => setSelectedRecipe(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgLight,
  },
  packRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.bgLight,
  },
  packTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  packTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  packTabText: {
    fontFamily: Fonts.sansSemiBold ?? Fonts.sansBold,
    fontSize: 13,
    color: Colors.textMuted,
  },
  packTabTextActive: {
    color: Colors.white,
  },
  loadingRow: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionIcon: { fontSize: 16 },
  sectionTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: Colors.textDark,
    flex: 1,
  },
  sectionCount: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: Colors.textMuted,
  },
  cardWrap: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  listContent: {
    paddingBottom: 32,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 10,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 16,
    color: Colors.textDark,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13.5,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 9,
  },
  emptyBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
    color: Colors.white,
  },
});
