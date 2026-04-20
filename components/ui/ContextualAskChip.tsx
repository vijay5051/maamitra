import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Colors, Fonts, FontSize, Gradients, Radius, Shadow, Spacing } from '../../constants/theme';

// Small pill shown at the top of Family / Wellness / Community / etc. that gives
// the user a one-tap way to ask Maamitra about what they're currently looking
// at. The prompt passes through to chat via a query param so chat.tsx can
// prefill the input. Design goal: make the AI feel omnipresent — users should
// never have to remember where the Chat tab is.
export default function ContextualAskChip({
  prompt,
  icon = 'sparkles',
}: {
  prompt: string;
  icon?: string;
}) {
  const router = useRouter();

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() =>
        router.push({ pathname: '/(tabs)/chat', params: { prefill: prompt } })
      }
      style={styles.wrap}
    >
      <LinearGradient
        colors={Gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.border}
      >
        <View style={styles.inner}>
          <View style={styles.iconWrap}>
            <LinearGradient colors={Gradients.avatar} style={styles.iconGrad}>
              <Ionicons name={icon as any} size={12} color="#fff" />
            </LinearGradient>
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {prompt}
          </Text>
          <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    borderRadius: Radius.full,
    ...Shadow.sm,
  },
  border: {
    padding: 1.2,
    borderRadius: Radius.full,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#fff',
    borderRadius: Radius.full,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  iconWrap: { width: 24, height: 24 },
  iconGrad: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.sm,
    color: Colors.textDark,
  },
});
