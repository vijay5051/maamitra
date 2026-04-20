import React, { useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '../../constants/theme';

interface Option {
  label: string;
  value: string;
}

interface ChipSelectorProps {
  options: Option[];
  onSelect: (value: string) => void;
  selected?: string;
  multi?: boolean;
}

interface ChipItemProps {
  option: Option;
  isSelected: boolean;
  onPress: () => void;
}

function ChipItem({ option, isSelected, onPress }: ChipItemProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 0.92,
        useNativeDriver: true,
        speed: 30,
        bounciness: 2,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 8,
      }),
    ]).start();
    onPress();
  };

  return (
    <TouchableWithoutFeedback onPress={handlePress}>
      <Animated.View style={{ transform: [{ scale }] }}>
        {isSelected ? (
          <LinearGradient
            colors={Gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.chip}
          >
            <Text style={styles.selectedText}>{option.label}</Text>
          </LinearGradient>
        ) : (
          <View style={styles.chipUnselected}>
            <Text style={styles.unselectedText}>{option.label}</Text>
          </View>
        )}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

export default function ChipSelector({
  options,
  onSelect,
  selected,
  multi = false,
}: ChipSelectorProps) {
  return (
    <View style={styles.wrap}>
      {options.map((option) => (
        <ChipItem
          key={option.value}
          option={option}
          isSelected={selected === option.value}
          onPress={() => onSelect(option.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  chipUnselected: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectedText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  unselectedText: {
    color: '#1a1a2e',
    fontWeight: '500',
    fontSize: 14,
  },
});
