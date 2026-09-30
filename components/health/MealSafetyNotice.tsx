import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../../constants/theme';
import { confirmAction } from '../../lib/cross-platform-alerts';
import type { MealSafety } from '../../hooks/useMealSafety';
import { shortFoodName } from '../../lib/mealSafety';

const RED = '#B91C1C';
const RED_BG = '#FEF2F2';
const RED_BORDER = '#FCA5A5';
const AMBER = '#92400E';
const AMBER_BG = '#FEF3C7';
const AMBER_BORDER = '#FCD34D';
const GREEN = '#166534';
const GREEN_BG = '#DCFCE7';

function list(names: string[], max = 3): string {
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} +${names.length - max}`;
}

/**
 * Allergy + 3-day-rule warnings for one meal.
 *   compact — small chips for recipe cards / lists.
 *   full    — banners for the recipe detail sheet.
 */
export default function MealSafetyNotice({
  safety,
  kidName,
  variant,
}: {
  safety: MealSafety;
  kidName?: string;
  variant: 'compact' | 'full';
}) {
  const { allergyHits, threeDay } = safety;
  const who = kidName || 'your child';
  const reacted = threeDay?.reacted.map(shortFoodName) ?? [];
  const untested = threeDay?.untested.map(shortFoodName) ?? [];

  if (variant === 'compact') {
    if (!allergyHits.length && !reacted.length && !untested.length) return null;
    return (
      <View style={styles.chipRow}>
        {allergyHits.length > 0 && (
          <View style={[styles.chip, { backgroundColor: RED_BG, borderColor: RED_BORDER }]}>
            <Ionicons name="alert-circle" size={11} color={RED} />
            <Text style={[styles.chipText, { color: RED }]} numberOfLines={1}>
              Allergy: {list(allergyHits, 2)}
            </Text>
          </View>
        )}
        {reacted.length > 0 && (
          <View style={[styles.chip, { backgroundColor: RED_BG, borderColor: RED_BORDER }]}>
            <Ionicons name="warning-outline" size={11} color={RED} />
            <Text style={[styles.chipText, { color: RED }]} numberOfLines={1}>
              Reacted: {list(reacted, 2)}
            </Text>
          </View>
        )}
        {untested.length > 0 && (
          <View style={[styles.chip, { backgroundColor: AMBER_BG, borderColor: AMBER_BORDER }]}>
            <Ionicons name="time-outline" size={11} color={AMBER} />
            <Text style={[styles.chipText, { color: AMBER }]} numberOfLines={1}>
              3-day test pending: {list(untested, 2)}
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={{ gap: 8, marginBottom: 12 }}>
      {allergyHits.length > 0 && (
        <View style={[styles.banner, { backgroundColor: RED_BG, borderColor: RED_BORDER }]}>
          <Ionicons name="alert-circle" size={18} color={RED} />
          <Text style={[styles.bannerText, { color: RED }]}>
            <Text style={styles.bold}>Not safe for {who}: </Text>
            contains {allergyHits.join(', ')}, which you listed as an allergy. Skip it or swap that ingredient.
          </Text>
        </View>
      )}
      {reacted.length > 0 && (
        <View style={[styles.banner, { backgroundColor: RED_BG, borderColor: RED_BORDER }]}>
          <Ionicons name="warning-outline" size={18} color={RED} />
          <Text style={[styles.bannerText, { color: RED }]}>
            {who} had a reaction to {reacted.join(', ')} in the food tracker. Check with your doctor before serving.
          </Text>
        </View>
      )}
      {threeDay && untested.length > 0 && (
        <View style={[styles.banner, { backgroundColor: AMBER_BG, borderColor: AMBER_BORDER }]}>
          <Ionicons name="time-outline" size={18} color={AMBER} />
          <Text style={[styles.bannerText, { color: AMBER }]}>
            <Text style={styles.bold}>3-day rule: </Text>
            {who} hasn’t finished the 3-day test for {untested.join(', ')}. Try each new food alone for 3 days
            (Health → Foods) before serving it in a mixed meal.
          </Text>
        </View>
      )}
      {threeDay?.allCleared && allergyHits.length === 0 && (
        <View style={[styles.banner, { backgroundColor: GREEN_BG, borderColor: '#86EFAC' }]}>
          <Ionicons name="checkmark-circle" size={18} color={GREEN} />
          <Text style={[styles.bannerText, { color: GREEN }]}>
            Every ingredient has passed the 3-day test for {who}.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
    borderWidth: 1,
    maxWidth: '100%',
  },
  chipText: { fontFamily: Fonts.sansSemiBold, fontSize: 10.5, flexShrink: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  bannerText: { fontFamily: Fonts.sansMedium, fontSize: 13, lineHeight: 19, flex: 1 },
  bold: { fontFamily: Fonts.sansBold },
});

export const mealSafetyColors = { RED, RED_BG, RED_BORDER };

/**
 * Pop-up before planning / packing a meal that contains one of the child's
 * allergens. Resolves true when the parent still wants to go ahead.
 */
export function confirmDespiteAllergy(kidName: string | undefined, hits: string[]): Promise<boolean> {
  if (hits.length === 0) return Promise.resolve(true);
  return confirmAction(
    `Allergy alert — ${hits.join(', ')}`,
    `This meal contains ${hits.join(', ')}, which you listed as an allergy for ${kidName || 'your child'}. Add it anyway?`,
    { confirmLabel: 'Add anyway', cancelLabel: 'Cancel', destructive: true },
  );
}
