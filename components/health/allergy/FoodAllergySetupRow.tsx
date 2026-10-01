import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../../constants/theme';
import { KidFoodAllergies, summarizeAllergies } from '../../../lib/foodAllergies';
import FoodAllergySheet from './FoodAllergySheet';

/**
 * Optional "Food allergies & reactions" field for the add-child, onboarding
 * and edit-child forms. Holds nothing itself — the form owns the draft and
 * saves it with the child.
 */
export default function FoodAllergySetupRow({
  kidName,
  value,
  onChange,
}: {
  kidName: string;
  value: KidFoodAllergies;
  onChange: (next: KidFoodAllergies) => void;
}) {
  const [open, setOpen] = useState(false);
  const touched = value.entries.length > 0 || !!value.notSure;
  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={styles.row}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Food allergies and reactions, optional. ${summarizeAllergies(value)}`}
      >
        <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.value} numberOfLines={2}>
            {touched ? summarizeAllergies(value) : 'Add any foods to avoid, or skip'}
          </Text>
        </View>
        <Text style={styles.action}>{value.entries.length ? 'Edit' : 'Add'}</Text>
      </TouchableOpacity>
      <FoodAllergySheet
        visible={open}
        kidName={kidName}
        value={value}
        onClose={() => setOpen(false)}
        onSave={(next) => { onChange(next); setOpen(false); }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F9F7FD', borderColor: Colors.border, borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, minHeight: 48,
  },
  value: { fontFamily: Fonts.sansRegular, fontSize: 14, color: Colors.textDark },
  action: { fontFamily: Fonts.sansBold, fontSize: 13, color: Colors.primary },
});
