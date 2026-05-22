import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Fonts } from '../../../constants/theme';
import { DayKey, DAY_KEYS } from '../../../lib/weekKeys';
import { PlannedDay } from '../../../store/useMealPlannerStore';
import { RECIPE_BY_ID } from '../../../data/recipes';

const INK = '#1C1033';
const STONE = '#6B7280';
const MIST = '#EDE9F6';
const ROSE = Colors.primary;
const BLUSH = '#F9E4E0';
const SAGE = '#34D399';

const DAY_LETTERS: Record<DayKey, string> = {
  mon: 'MON', tue: 'TUE', wed: 'WED', thu: 'THU', fri: 'FRI', sat: 'SAT', sun: 'SUN',
};

interface Props {
  weekStartDate: string; // YYYY-MM-DD
  days: Partial<Record<DayKey, PlannedDay>>;
  todayDayKey: DayKey;
  onTapDay: (dayKey: DayKey) => void;
}

export default function WeekStrip({ days, todayDayKey, onTapDay }: Props) {
  return (
    <View style={styles.row}>
      {DAY_KEYS.map((dk) => {
        const planned = days[dk];
        const isToday = dk === todayDayKey;
        const recipe = planned?.recipeId ? RECIPE_BY_ID[planned.recipeId] : null;
        const label = recipe?.name ?? planned?.freeText ?? null;
        return (
          <TouchableOpacity
            key={dk}
            onPress={() => onTapDay(dk)}
            activeOpacity={0.85}
            style={[styles.cell, isToday && styles.cellToday]}
          >
            <Text style={[styles.dayLetter, isToday && styles.dayLetterToday]}>{DAY_LETTERS[dk]}</Text>
            {label ? (
              <>
                <Text style={styles.dayName} numberOfLines={1}>{label}</Text>
                {!isToday && <View style={styles.dot} />}
              </>
            ) : (
              <>
                <Ionicons name="add" size={16} color={STONE} style={{ opacity: 0.5, marginVertical: 6 }} />
                <Text style={[styles.dayName, { opacity: 0.5 }]}>Plan</Text>
              </>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  cell: {
    flex: 1, minHeight: 78,
    paddingVertical: 8, paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: MIST,
    alignItems: 'center',
    position: 'relative',
  },
  cellToday: { backgroundColor: BLUSH, borderColor: ROSE, borderWidth: 1.5 },
  dayLetter: { fontFamily: Fonts.sansBold, fontSize: 9.5, color: STONE, letterSpacing: 0.5 },
  dayLetterToday: { color: ROSE },
  dayName: {
    fontFamily: Fonts.sansSemiBold, fontSize: 9, color: INK,
    textAlign: 'center', marginTop: 4, paddingHorizontal: 2,
  },
  dot: {
    position: 'absolute', top: 6, right: 6,
    width: 5, height: 5, borderRadius: 5,
    backgroundColor: SAGE,
  },
});
