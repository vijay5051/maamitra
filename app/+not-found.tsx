import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import GradientButton from '../components/ui/GradientButton';
import { Illustration } from '../components/ui/Illustration';
import { Colors, Fonts } from '../constants/theme';
import { useAuthStore } from '../store/useAuthStore';

export default function NotFoundScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Authed users should land back on home, not the marketing welcome.
  // Unauthed (or still-loading) users get welcome, same as before.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const homeHref = isAuthenticated ? '/(tabs)' : '/(auth)/welcome';

  return (
    <>
      <Stack.Screen options={{ title: 'Page not found · MaaMitra' }} />
      <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.content}>
          <Illustration name="onboardingWelcome" style={styles.illus} contentFit="contain" />
          <Text style={styles.title}>This page took a little nap.</Text>
          <Text style={styles.body}>
            We couldn't find what you were looking for. The link may be old or
            mistyped. Let's get you back to MaaMitra.
          </Text>
          <View style={styles.cta}>
            <GradientButton
              title="Back to MaaMitra"
              onPress={() => router.replace(homeHref)}
            />
          </View>
          <View style={styles.links}>
            <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.helpText}>
              If you came from a MaaMitra link and keep hitting this page, please
              email <Text style={styles.email}>info@maamitra.co.in</Text>.
            </Text>
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bgLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  illus: { width: 200, height: 200, marginBottom: 8 },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    color: Colors.textDark,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 32,
  },
  body: {
    fontFamily: Fonts.sansRegular,
    fontSize: 15,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  cta: { width: '100%', maxWidth: 320 },
  links: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 18,
    paddingHorizontal: 8,
  },
  helpText: {
    flex: 1,
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  email: {
    fontFamily: Fonts.sansBold,
    color: Colors.primary,
  },
});
