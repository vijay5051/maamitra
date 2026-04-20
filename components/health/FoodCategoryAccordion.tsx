import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FoodCategoryInfo, FoodRef } from '../../data/babyFoods';
import { FoodEntry, KidFoodMap } from '../../store/useFoodTrackerStore';
import { Fonts } from '../../constants/theme';

const SAGE = '#34D399';
const GOLD = '#F59E0B';
const MIST = '#EDE9F6';
const INK  = '#1C1033';
const STONE = '#6B7280';

interface Props {
  category: FoodCategoryInfo;
  foods: FoodRef[];
  kidFoods: KidFoodMap;
  kidAgeMonths: number;
  onSelect: (food: FoodRef) => void;
  defaultOpen?: boolean;
}

function statusFor(entry: FoodEntry | undefined): { color: string; label: string; icon: string } {
  if (!entry) return { color: MIST, label: 'Not tried', icon: '' };
  if (entry.reaction === 'rash' || entry.reaction === 'vomit') {
    return { color: '#ef4444', label: 'Reaction', icon: 'warning' };
  }
  const filled = [entry.d1Date, entry.d2Date, entry.d3Date].filter(Boolean).length;
  if (filled === 3 && (entry.reaction === 'none' || !entry.reaction)) {
    return { color: SAGE, label: 'Cleared', icon: 'checkmark-circle' };
  }
  if (filled > 0) return { color: GOLD, label: `Day ${filled}/3`, icon: 'time' };
  return { color: MIST, label: 'Not tried', icon: '' };
}

export default function FoodCategoryAccordion({
  category,
  foods,
  kidFoods,
  kidAgeMonths,
  onSelect,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const cleared = foods.filter((f) => kidFoods[f.id]?.cleared).length;
  const inProgress = foods.filter((f) => {
    const e = kidFoods[f.id];
    return e && !e.cleared && (e.d1Date || e.d2Date || e.d3Date);
  }).length;

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.85}
        style={[styles.header, { backgroundColor: category.tint }]}
      >
        <Ionicons name={category.icon as any} size={18} color={INK} />
        <Text style={styles.headerLabel}>{category.label}</Text>
        <View style={styles.headerMeta}>
          <Text style={styles.headerCount}>
            {cleared}/{foods.length}
          </Text>
          {inProgress > 0 && (
            <View style={styles.inProgressDot}>
              <Text style={styles.inProgressText}>{inProgress}</Text>
            </View>
          )}
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={STONE}
          />
        </View>
      </TouchableOpacity>

      {open && (
        <View style={styles.list}>
          {foods.map((food) => {
            const entry = kidFoods[food.id];
            const status = statusFor(entry);
            const tooYoung = kidAgeMonths < food.minAgeMonths;
            return (
              <TouchableOpacity
                key={food.id}
                onPress={() => onSelect(food)}
                activeOpacity={0.7}
                style={styles.row}
              >
                <View style={styles.rowLeft}>
                  <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.foodName, tooYoung && styles.foodNameMuted]}>
                      {food.name}
                    </Text>
                    {(tooYoung || food.warning) && (
                      <Text style={styles.foodMeta} numberOfLines={1}>
                        {tooYoung
                          ? `From ${food.minAgeMonths} mo`
                          : food.warning?.split('—')[0]?.trim()}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.rowRight}>
                  {entry ? (
                    <Text style={[styles.statusLabel, { color: status.color }]}>
                      {status.label}
                    </Text>
                  ) : (
                    <Text style={styles.statusLabelMuted}>Tap to log</Text>
                  )}
                  <Ionicons name="chevron-forward" size={14} color="#9ca3af" />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: MIST,
    marginBottom: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: INK,
    flex: 1,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerCount: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    color: STONE,
  },
  inProgressDot: {
    backgroundColor: GOLD,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inProgressText: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    color: '#ffffff',
  },
  list: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F4EEFA',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#D9D2EA',
  },
  foodName: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13.5,
    color: INK,
  },
  foodNameMuted: {
    color: STONE,
  },
  foodMeta: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: STONE,
    marginTop: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 11.5,
  },
  statusLabelMuted: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11.5,
    color: '#9ca3af',
  },
});
