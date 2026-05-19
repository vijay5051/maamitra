import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../constants/theme';
import { useProfileStore } from '../../store/useProfileStore';

interface Props {
  /**
   * Stable dedup key — e.g. 'diet', 'state', 'kidName', 'kidGender'.
   * Once a user answers or dismisses, this key is added to
   * useProfileStore.dismissedPrompts and the prompt never appears again
   * (until they edit the underlying value via Settings).
   */
  promptKey: string;

  /** Headline question, e.g. "Quick — what works for your home?" */
  question: string;

  /** Sub-line explaining WHY we're asking. Always visible. */
  reason: string;

  /**
   * Owner-controlled visibility. The owner (e.g. FoodsTab) checks
   * `!profile.diet && !isPromptDismissed('diet')` and passes `true` here.
   * If false, the component returns null.
   */
  visible: boolean;

  /** The input or chip group. Renders inside the prompt card. */
  children: React.ReactNode;

  /** Optional override for what happens on skip. Defaults to dismissPrompt only. */
  onSkip?: () => void;
}

export default function JustInTimePrompt({
  promptKey, question, reason, visible, children, onSkip,
}: Props) {
  const dismissed = useProfileStore((s) => s.dismissedPrompts[promptKey] ?? false);
  const dismiss = useProfileStore((s) => s.dismissPrompt);

  if (!visible || dismissed) return null;

  const handleSkip = () => {
    dismiss(promptKey);
    onSkip?.();
  };

  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <Pressable
        style={styles.closeBtn}
        onPress={handleSkip}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss this prompt"
      >
        <Ionicons name="close" size={16} color={Colors.textLight} />
      </Pressable>
      <Text style={styles.q}>{question}</Text>
      <Text style={styles.r}>{reason}</Text>
      {children}
      <Pressable
        onPress={handleSkip}
        style={styles.skipBtn}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Skip"
      >
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderColor: Colors.primarySoft,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 4,
  },
  q: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: Colors.textDark,
    paddingRight: 28,
    marginBottom: 4,
  },
  r: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 10,
    lineHeight: 17,
  },
  skipBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    minHeight: 32,
    justifyContent: 'center',
  },
  skipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: Colors.textLight,
    textDecorationLine: 'underline',
  },
});
