import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../../constants/theme';
import { TravelRecipe, CATEGORY_BY_KEY, GEAR_LABELS } from '../../../data/travelRecipes';

const INK = Colors.textDark;
const STONE = Colors.textMuted;

interface Props {
  recipe: TravelRecipe;
  isBookmarked?: boolean;
  hotWeather?: boolean;
  onPress: () => void;
  onBookmark?: () => void;
}

export default function TravelRecipeCard({ recipe, isBookmarked, hotWeather, onPress, onBookmark }: Props) {
  const cat = CATEGORY_BY_KEY[recipe.category];

  // Effective shelf life — halved in hot weather
  const bestHours = Math.max(
    recipe.roomTempHours,
    recipe.insulatedBagHours,
    recipe.thermosHours,
  );
  const displayHours = hotWeather ? Math.ceil(bestHours / 2) : bestHours;
  const shelfLabel = displayHours >= 24
    ? `${Math.floor(displayHours / 24)}d`
    : displayHours > 0 ? `${displayHours}h` : null;

  const needsFridge = recipe.requiresRefrigeration;
  const needsThermos = recipe.gearRequired.includes('vacuum_flask_thermos');

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.card}>
      {/* Category icon chip */}
      <View style={styles.iconRow}>
        <View style={[styles.catChip, { backgroundColor: Colors.primaryAlpha08 }]}>
          <Text style={styles.catIcon}>{cat.icon}</Text>
        </View>
        {onBookmark && (
          <TouchableOpacity onPress={onBookmark} hitSlop={10} style={styles.bookmarkBtn}>
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={17}
              color={isBookmarked ? Colors.primary : STONE}
            />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.title} numberOfLines={2}>{recipe.title}</Text>
      <Text style={styles.subtitle} numberOfLines={1}>{recipe.subtitle}</Text>

      {/* Badge row */}
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{recipe.stageBadge}</Text>
        </View>
        {shelfLabel && (
          <View style={[styles.badge, hotWeather && styles.badgeWarn]}>
            <Ionicons name="time-outline" size={10} color={hotWeather ? '#92400E' : STONE} />
            <Text style={[styles.badgeText, hotWeather && { color: '#92400E' }]}>
              {shelfLabel}{hotWeather ? ' ☀️' : ''}
            </Text>
          </View>
        )}
        {needsThermos && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>🌡️ Thermos</Text>
          </View>
        )}
        {needsFridge && (
          <View style={[styles.badge, styles.badgeCool]}>
            <Text style={[styles.badgeText, { color: '#1e40af' }]}>❄️ Keep cool</Text>
          </View>
        )}
        {!needsFridge && !needsThermos && (
          <View style={[styles.badge, styles.badgeGreen]}>
            <Text style={[styles.badgeText, { color: '#166534' }]}>✅ No gear</Text>
          </View>
        )}
      </View>

      {/* Top allergen */}
      {recipe.allergenContains.length > 0 && (
        <Text style={styles.allergen} numberOfLines={1}>
          ⚠️ {recipe.allergenContains.slice(0, 2).map((a) => a.replace('_', ' ')).join(', ')}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  catChip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catIcon: { fontSize: 18 },
  bookmarkBtn: { padding: 2 },
  title: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: Colors.textDark,
    marginBottom: 3,
  },
  subtitle: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11.5,
    color: Colors.textMuted,
    marginBottom: 8,
    lineHeight: 15,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.bgTint,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeWarn: { backgroundColor: '#FEF3C7' },
  badgeCool: { backgroundColor: '#DBEAFE' },
  badgeGreen: { backgroundColor: '#DCFCE7' },
  badgeText: {
    fontFamily: Fonts.sansSemiBold ?? Fonts.sansBold,
    fontSize: 10.5,
    color: Colors.textMuted,
  },
  allergen: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: '#92400E',
    marginTop: 2,
  },
});
