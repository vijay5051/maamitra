/**
 * Marketing Studio — Create route.
 *
 * Studio v2 Phase 1 stub: surfaces the three options the admin actually
 * has today (auto-generate from cron, manual generate-now, browse legacy
 * preview tool) while signalling what's coming. Phase 2 lands the full
 * canvas (image gen → caption → schedule) here in-place.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';

export default function StudioCreateScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  return (
    <>
      <Stack.Screen options={{ title: 'Create' }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.bgLight }}
        contentContainerStyle={[styles.body, isWide && styles.bodyWide]}
      >
        <View style={styles.heroBubble}>
          <Ionicons name="sparkles" size={36} color={Colors.primary} />
        </View>
        <Text style={styles.title}>How do you want to create?</Text>
        <Text style={styles.subtitle}>
          Pick a starting point. Every option ends up in your To-Review inbox so you can refine before publishing.
        </Text>

        <View style={{ gap: Spacing.md, marginTop: Spacing.md }}>
          <OptionCard
            icon="rocket-outline"
            title="Generate a new draft"
            body="The AI picks today's theme, writes a caption, and renders an on-brand image. Takes about 15 seconds."
            badge="Available now"
            onPress={() => router.push('/admin/marketing/drafts' as any)}
          />

          <OptionCard
            icon="image-outline"
            title="Browse template preview"
            body="Render a single template with custom inputs. Useful for testing layouts or making one-off posts."
            badge="Power tool"
            onPress={() => router.push('/admin/marketing/preview' as any)}
          />

          <OptionCard
            icon="cloud-upload-outline"
            title="Upload your own image"
            body="Coming soon — bring your own photo, AI writes the caption, you publish. Lands in the next Studio update."
            badge="Coming soon"
            disabled
          />

          <OptionCard
            icon="brush-outline"
            title="Custom AI image"
            body="Coming soon — describe what you want, the AI generates 4 variants in your brand style. Edit, then publish."
            badge="Coming soon"
            disabled
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            <Ionicons name="information-circle-outline" size={12} color={Colors.textMuted} /> Today's auto-cron runs at 6 AM IST when "Auto-post" is on.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

function OptionCard({
  icon, title, body, badge, onPress, disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  badge?: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[styles.option, disabled && styles.optionDisabled]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
    >
      <View style={[styles.optionIcon, disabled && { backgroundColor: Colors.bgTint }]}>
        <Ionicons name={icon} size={22} color={disabled ? Colors.textMuted : Colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.optionTitleRow}>
          <Text style={[styles.optionTitle, disabled && { color: Colors.textLight }]}>{title}</Text>
          {badge ? (
            <View style={[
              styles.badge,
              badge === 'Coming soon' && styles.badgeMuted,
              badge === 'Power tool' && styles.badgeAlt,
            ]}>
              <Text style={[
                styles.badgeLabel,
                badge === 'Coming soon' && { color: Colors.textLight },
                badge === 'Power tool' && { color: Colors.textDark },
              ]}>
                {badge}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.optionBody}>{body}</Text>
      </View>
      {!disabled ? (
        <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { padding: Spacing.md, paddingTop: Spacing.lg, paddingBottom: 80, alignItems: 'center' },
  bodyWide: { paddingHorizontal: Spacing.xxxl },

  heroBubble: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textDark, letterSpacing: -0.4, textAlign: 'center' },
  subtitle: { fontSize: FontSize.md, color: Colors.textLight, lineHeight: 22, textAlign: 'center', maxWidth: 480, marginTop: 6 },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
    width: '100%',
    maxWidth: 560,
    ...Shadow.sm,
  },
  optionDisabled: { opacity: 0.65, ...({} as any) },
  optionIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  optionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  optionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  optionBody: { fontSize: FontSize.xs, color: Colors.textLight, lineHeight: 16 },

  badge: { backgroundColor: Colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeMuted: { backgroundColor: Colors.bgTint },
  badgeAlt: { backgroundColor: Colors.borderSoft },
  badgeLabel: { fontSize: 9, fontWeight: '800', color: Colors.white, letterSpacing: 0.4 },

  footer: { marginTop: Spacing.xl },
  footerText: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
});
