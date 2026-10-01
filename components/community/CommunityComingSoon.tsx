import { Platform, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import GradientButton from '../ui/GradientButton';
import { Illustration } from '../ui/Illustration';
import { Colors, Fonts } from '../../constants/theme';
import { COMMUNITY_DOWNLOAD_GOAL } from '../../lib/communityGate';

const APP_URL = 'https://maamitra.co.in';

async function inviteFriend() {
  const message = `I’m using MaaMitra for vaccines, growth, food and more for my little one. Try it: ${APP_URL}`;
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      if ((navigator as any).share) await (navigator as any).share({ text: message, url: APP_URL });
      else await (navigator as any).clipboard?.writeText(message);
      return;
    }
    await Share.share({ message });
  } catch {
    // user dismissed the share sheet — nothing to do
  }
}

/**
 * Shown in place of the Community tab (and any screen that leads into it)
 * while the feature is switched off. A clear "not open yet" state — no
 * sample posts, no fake numbers.
 */
export default function CommunityComingSoon() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      <Text style={styles.header}>Community</Text>
      <View style={styles.body}>
        <Illustration name="emptyCommunity" style={styles.art} contentFit="contain" />
        <View style={styles.badge}>
          <Ionicons name="time-outline" size={14} color={Colors.primary} />
          <Text style={styles.badgeText}>COMING SOON</Text>
        </View>
        <Text style={styles.title}>A circle of parents, opening soon</Text>
        <Text style={styles.text}>
          We’re getting Community ready — a warm space to ask questions, share wins and support each other.
          It opens when MaaMitra reaches {COMMUNITY_DOWNLOAD_GOAL.toLocaleString('en-IN')} downloads, so there are
          enough parents here to make it lively.
        </Text>
        <GradientButton title="Invite a friend to MaaMitra" onPress={inviteFriend} style={styles.cta} />
        <Text style={styles.note}>Until then, ask MaaMitra anything from the ✨ button below.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight, paddingHorizontal: 20 },
  header: { fontFamily: Fonts.serif, fontSize: 28, color: Colors.textDark, letterSpacing: -0.3 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
  art: { width: 220, height: 180, marginBottom: 14 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primaryAlpha08, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 12,
  },
  badgeText: { fontFamily: Fonts.sansBold, fontSize: 11.5, letterSpacing: 1.5, color: Colors.primary },
  title: { fontFamily: Fonts.serif, fontSize: 24, color: Colors.textDark, textAlign: 'center', marginBottom: 10 },
  text: { fontFamily: Fonts.sansRegular, fontSize: 14.5, lineHeight: 22, color: Colors.textLight, textAlign: 'center', maxWidth: 340 },
  cta: { marginTop: 22, alignSelf: 'stretch' },
  note: { fontFamily: Fonts.sansRegular, fontSize: 12.5, color: Colors.textLight, textAlign: 'center', marginTop: 14 },
});
