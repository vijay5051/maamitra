import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GradientButton from '../ui/GradientButton';

interface AllergyModalProps {
  visible: boolean;
  onClose: (allergies: string[]) => void;
}

const ALLERGIES = [
  { label: 'Milk / Dairy', emoji: '🥛' },
  { label: 'Eggs', emoji: '🥚' },
  { label: 'Peanuts', emoji: '🥜' },
  { label: 'Tree nuts', emoji: '🌰' },
  { label: 'Wheat / Gluten', emoji: '🌾' },
  { label: 'Soy', emoji: '🫘' },
  { label: 'Fish', emoji: '🐟' },
  { label: 'Shellfish', emoji: '🦐' },
  { label: 'Sesame', emoji: '🌿' },
  { label: 'Mustard', emoji: '🌼' },
  { label: 'None known', emoji: '✅' },
  { label: 'Other', emoji: '❓' },
];

export default function AllergyModal({ visible, onClose }: AllergyModalProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (label: string) => {
    if (label === 'None known') {
      setSelected((prev) =>
        prev.includes('None known') ? [] : ['None known']
      );
      return;
    }
    setSelected((prev) => {
      const withoutNone = prev.filter((s) => s !== 'None known');
      if (withoutNone.includes(label)) {
        return withoutNone.filter((s) => s !== label);
      }
      return [...withoutNone, label];
    });
  };

  const handleContinue = () => {
    onClose(selected);
    setSelected([]);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => onClose(selected)}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handle} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={styles.title}>Any Food Allergies? 🥗</Text>
            <Text style={styles.subtitle}>
              This helps me give safer nutrition advice for you and your baby
            </Text>

            {ALLERGIES.map(({ label, emoji }) => {
              const isSelected = selected.includes(label);
              return (
                <TouchableOpacity
                  key={label}
                  onPress={() => toggle(label)}
                  activeOpacity={0.75}
                  style={styles.row}
                >
                  <View style={styles.emojiCircle}>
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </View>
                  <Text style={styles.allergyLabel}>{label}</Text>
                  <View
                    style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected,
                    ]}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={14} color="#ffffff" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}

            <GradientButton
              title="Continue with advice →"
              onPress={handleContinue}
              style={styles.button}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginBottom: 16,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 20,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  emojiCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fdf2f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emojiText: {
    fontSize: 18,
  },
  allergyLabel: {
    flex: 1,
    fontSize: 15,
    color: '#1a1a2e',
    fontWeight: '500',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#ec4899',
    borderColor: '#ec4899',
  },
  button: {
    marginTop: 28,
  },
});
