import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HealthCheckItemData {
  emoji: string;
  title: string;
  frequency: string;
  done: boolean;
}

interface HealthCheckItemProps {
  item: HealthCheckItemData;
  onToggle: () => void;
}

export default function HealthCheckItem({ item, onToggle }: HealthCheckItemProps) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.8}
      style={[styles.row, item.done && styles.rowDone]}
    >
      {/* Checkbox */}
      <TouchableOpacity
        onPress={onToggle}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={[styles.checkbox, item.done && styles.checkboxDone]}
      >
        {item.done && (
          <Ionicons name="checkmark" size={14} color="#ffffff" />
        )}
      </TouchableOpacity>

      {/* Emoji */}
      <Text style={styles.emoji}>{item.emoji}</Text>

      {/* Text */}
      <View style={styles.textArea}>
        <Text style={[styles.title, item.done && styles.titleDone]}>
          {item.title}
        </Text>
      </View>

      {/* Frequency */}
      <Text style={styles.frequency}>{item.frequency}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    marginBottom: 8,
    gap: 10,
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
    boxShadow: '0px 1px 4px rgba(236, 72, 153, 0.06)',
  },
  rowDone: {
    backgroundColor: 'rgba(34,197,94,0.07)',
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
  checkboxDone: {
    backgroundColor: '#ec4899',
    borderColor: '#ec4899',
  },
  emoji: {
    fontSize: 20,
  },
  textArea: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  titleDone: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  frequency: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
});
