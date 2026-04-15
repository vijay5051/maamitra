import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface QuickChipsProps {
  onSelect: (text: string) => void;
}

const CHIPS = [
  "When is the next vaccination? 💉",
  "Baby won't sleep at night 😴",
  "How to start solid foods? 🥣",
  "I'm feeling overwhelmed 💙",
  "Recommend safe baby products 🛍️",
  "Postpartum yoga for me 🧘",
  "Baby has mild fever 🌡️",
  "Breastfeeding tips 🤱",
];

export default function QuickChips({ onSelect }: QuickChipsProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Try asking:</Text>
      <View style={styles.chipWrap}>
        {CHIPS.map((chip) => (
          <TouchableOpacity
            key={chip}
            onPress={() => onSelect(chip)}
            activeOpacity={0.75}
            style={styles.chip}
          >
            <Text style={styles.chipText}>{chip}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  header: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 10,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ec4899',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipText: {
    color: '#ec4899',
    fontSize: 13,
    fontWeight: '500',
  },
});
