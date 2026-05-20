import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '../../components/settings/ScreenHeader';
import { Card, SectionHeader, SettingsRow } from '../../components/settings/SettingsPrimitives';
import { Colors, Fonts, Spacing } from '../../constants/theme';

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="About & legal" />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}>
        <SectionHeader title="Legal" />
        <Card>
          <SettingsRow
            icon="document-text-outline"
            label="Terms of service"
            onPress={() => router.push('/terms')}
          />
          <View style={s.divider} />
          <SettingsRow
            icon="lock-closed-outline"
            label="Privacy policy"
            onPress={() => router.push('/privacy')}
          />
        </Card>

        <SectionHeader title="About MaaMitra" />
        <View style={s.aboutCard}>
          <Text style={s.disclaimer}>
            MaaMitra is a parenting companion, not a medical service. The AI, articles, and trackers provide information only — always consult a doctor for anything urgent or specific to your child.
          </Text>
          <Text style={s.version}>MaaMitra v1.0</Text>
          <Text style={s.madeIn}>Made in India</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl },
  divider: { height: 1, backgroundColor: Colors.borderSoft, marginLeft: 60 },
  aboutCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  disclaimer: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Fonts.sansRegular,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  version: {
    fontSize: 13,
    fontFamily: Fonts.sansBold,
    color: Colors.textDark,
    letterSpacing: 0.2,
    marginTop: Spacing.sm,
  },
  madeIn: {
    fontSize: 11,
    fontFamily: Fonts.sansRegular,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
