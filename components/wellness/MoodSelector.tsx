import React, { useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { MOOD_DATA } from '../../store/useWellnessStore';
import { Colors } from '../../constants/theme';

interface MoodSelectorProps {
  selected?: number;
  onSelect: (score: number) => void;
}

interface MoodButtonProps {
  emoji: string;
  label: string;
  score: number;
  isSelected: boolean;
  onPress: () => void;
}

function MoodButton({ emoji, label, score, isSelected, onPress }: MoodButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 0.88,
        useNativeDriver: true,
        speed: 30,
        bounciness: 2,
      }),
      Animated.spring(scale, {
        toValue: isSelected ? 1 : 1.2,
        useNativeDriver: true,
        speed: 20,
        bounciness: 10,
      }),
    ]).start(() => {
      if (!isSelected) {
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 15,
          bounciness: 4,
        }).start();
      }
    });
    onPress();
  };

  return (
    <TouchableWithoutFeedback onPress={handlePress}>
      <View style={styles.moodItem}>
        <Animated.View
          style={[
            styles.emojiWrapper,
            isSelected && styles.emojiWrapperSelected,
            { transform: [{ scale: isSelected ? scale : new Animated.Value(1) }] },
          ]}
        >
          <Animated.Text style={[styles.emoji, { transform: [{ scale }] }]}>
            {emoji}
          </Animated.Text>
        </Animated.View>
        <Text style={[styles.label, isSelected && styles.labelSelected]}>
          {label}
        </Text>
      </View>
    </TouchableWithoutFeedback>
  );
}

export default function MoodSelector({ selected, onSelect }: MoodSelectorProps) {
  return (
    <View style={styles.row}>
      {MOOD_DATA.map((mood) => (
        <MoodButton
          key={mood.score}
          emoji={mood.emoji}
          label={mood.label}
          score={mood.score}
          isSelected={selected === mood.score}
          onPress={() => onSelect(mood.score)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-end',
    paddingVertical: 8,
  },
  moodItem: {
    alignItems: 'center',
    gap: 6,
  },
  emojiWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiWrapperSelected: {
    backgroundColor: '#ffffff',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    boxShadow: '0px 4px 10px rgba(28, 16, 51, 0.09)',
  },
  emoji: {
    fontSize: 28,
  },
  label: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
    textAlign: 'center',
  },
  labelSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
