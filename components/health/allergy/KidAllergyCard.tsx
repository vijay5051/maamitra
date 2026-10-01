import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../../constants/theme';
import { useKidAllergies } from '../../../hooks/useKidAllergies';
import { summarizeAllergies } from '../../../lib/foodAllergies';
import FoodAllergySheet from './FoodAllergySheet';
import { saveKidAllergies } from './saveKidAllergies';

/**
 * "Food allergies & reactions" entry for the active child — shown at the
 * top of Health → Foods (babies and older kids) and Travel Meals.
 */
export default function KidAllergyCard() {
  const { activeKid, kidName, allergies } = useKidAllergies();
  const [open, setOpen] = useState(false);

  if (!activeKid || activeKid.isExpecting) return null;
  const count = allergies.entries.length;

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={`Food allergies and reactions for ${kidName}. ${summarizeAllergies(allergies)}. Tap to edit.`}
      >
        <View style={styles.icon}>
          <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Food allergies &amp; reactions</Text>
          <Text style={styles.sub} numberOfLines={2}>
            {count ? `${kidName}: ${summarizeAllergies(allergies)}` : allergies.notSure
              ? `${kidName}: not sure yet — add any time`
              : `Add foods ${kidName} must avoid — we’ll alert you on recipes.`}
          </Text>
        </View>
        <Text style={styles.edit}>{count ? 'Edit' : 'Add'}</Text>
        <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
      </TouchableOpacity>

      <FoodAllergySheet
        visible={open}
        kidName={kidName}
        value={allergies}
        onClose={() => setOpen(false)}
        onSave={(next) => {
          saveKidAllergies(activeKid.id, next);
          setOpen(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 12, marginBottom: 12,
  },
  icon: { width: 36, height: 36, borderRadius: 11, backgroundColor: Colors.primaryAlpha08, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: Fonts.sansBold, fontSize: 14, color: Colors.textDark },
  sub: { fontFamily: Fonts.sansRegular, fontSize: 12, color: Colors.textLight, marginTop: 1, lineHeight: 17 },
  edit: { fontFamily: Fonts.sansBold, fontSize: 13, color: Colors.primary },
});
