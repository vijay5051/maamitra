import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts, Colors } from '../constants/theme';

const EFFECTIVE = '20 April 2026';

export default function TermsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.container, isWide && styles.containerWide]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={18} color={Colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.h1}>Terms of Service</Text>
        <Text style={styles.meta}>Effective: {EFFECTIVE}</Text>

        <P>By creating an account or using MaaMitra, you agree to these Terms. If you don't agree, don't use the service.</P>

        <H2>1. Who can use MaaMitra</H2>
        <P>You must be 18 or older and legally able to enter a contract in India. MaaMitra is for personal, non-commercial use.</P>

        <H2>2. Your account</H2>
        <P>You are responsible for everything that happens under your account. Keep your password safe; notify us immediately if you suspect unauthorised access.</P>

        <H2>3. Not medical advice</H2>
        <P>
          MaaMitra is an <B>information and support tool, not a substitute for professional
          medical advice, diagnosis, or treatment</B>. The AI mitra and community content are not
          medical advice. For any medical concern — including emergencies, symptoms during
          pregnancy, or your child's health — always consult a qualified doctor. Call your
          nearest hospital or <B>108 / 102</B> in an emergency.
        </P>

        <H2>4. Acceptable use</H2>
        <P>You agree not to:</P>
        <LI>post content that is unlawful, abusive, hateful, sexually explicit, or infringes anyone's rights;</LI>
        <LI>impersonate another person or misrepresent your relationship with a child;</LI>
        <LI>attempt to probe, scan, or test the vulnerability of the service;</LI>
        <LI>scrape, automate access, or resell the service;</LI>
        <LI>use MaaMitra to provide medical services to others.</LI>
        <P>We may remove content and suspend or terminate accounts that violate these Terms.</P>

        <H2>5. Your content</H2>
        <P>
          You retain ownership of the content you post. You grant us a worldwide, non-exclusive,
          royalty-free licence to host, display, and process your content strictly to operate
          MaaMitra (including moderating it and showing it to the audience you chose).
        </P>

        <H2>6. AI output</H2>
        <P>
          AI responses are generated automatically and may be inaccurate or incomplete. Verify
          anything important with a professional before acting on it. You are responsible for
          how you use AI output.
        </P>

        <H2>7. Payments</H2>
        <P>
          MaaMitra is currently free. If we introduce paid features, separate terms will apply
          and we'll notify you before any charge.
        </P>

        <H2>8. Intellectual property</H2>
        <P>
          MaaMitra, its logos, and its software are owned by Vijay Singh Rathore (operator of MaaMitra) and protected by
          law. Nothing here transfers our IP to you.
        </P>

        <H2>9. Termination</H2>
        <P>
          You can delete your account at any time from Profile → Settings. We may suspend or
          terminate access for violations of these Terms, security risks, or legal reasons.
        </P>

        <H2>10. Disclaimers</H2>
        <P>MaaMitra is provided "as is" and "as available" without warranties of any kind, to the fullest extent permitted by law.</P>

        <H2>11. Limitation of liability</H2>
        <P>
          To the maximum extent permitted by law, Vijay Singh Rathore (operator of MaaMitra) is not liable for indirect,
          incidental, or consequential damages. Our total liability for any claim is limited to
          ₹1,000 or the amount you paid us in the 12 months before the claim, whichever is higher.
        </P>

        <H2>12. Indemnity</H2>
        <P>You agree to indemnify Vijay Singh Rathore (operator of MaaMitra) against claims arising from your misuse of the service or violation of these Terms.</P>

        <H2>13. Governing law & disputes</H2>
        <P>These Terms are governed by the laws of India. Courts at Jaipur, Rajasthan have exclusive jurisdiction, subject to applicable consumer protection laws.</P>

        <H2>14. Changes</H2>
        <P>We may update these Terms. Material changes will be notified in-app or by email at least 7 days before they take effect.</P>

        <H2>15. Contact</H2>
        <P>info@maamitra.co.in · Vijay Singh Rathore, Jaipur, Rajasthan, India</P>

        <View style={{ height: 24 }} />
      </View>
    </ScrollView>
  );
}

const P  = ({ children }: { children: React.ReactNode }) => <Text style={styles.p}>{children}</Text>;
const LI = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.liRow}><Text style={styles.liDot}>•</Text><Text style={styles.li}>{children}</Text></View>
);
const H2 = ({ children }: { children: React.ReactNode }) => <Text style={styles.h2}>{children}</Text>;
const B  = ({ children }: { children: React.ReactNode }) => <Text style={styles.bold}>{children}</Text>;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgLight },
  scroll: { flexGrow: 1 },
  container: { paddingHorizontal: 22, alignSelf: 'stretch' },
  containerWide: { maxWidth: 760, alignSelf: 'center', width: '100%', paddingHorizontal: 32 },

  back: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, marginBottom: 8 },
  backText: { fontFamily: Fonts.sansBold, fontSize: 13, color: Colors.primary },

  h1: { fontFamily: 'DMSans_700Bold', fontSize: 28, color: '#1C1033', letterSpacing: -0.4, marginTop: 4 },
  meta: { fontFamily: Fonts.sansRegular, fontSize: 12, color: '#9ca3af', marginTop: 6, marginBottom: 18 },
  h2: { fontFamily: Fonts.sansBold, fontSize: 15, color: '#1C1033', marginTop: 20, marginBottom: 8 },
  p: { fontFamily: Fonts.sansRegular, fontSize: 14, color: '#374151', lineHeight: 22, marginBottom: 8 },
  bold: { fontFamily: Fonts.sansBold, color: '#1C1033' },
  liRow: { flexDirection: 'row', marginBottom: 6, paddingLeft: 4 },
  liDot: { fontFamily: Fonts.sansRegular, color: Colors.primary, width: 16, fontSize: 14, lineHeight: 22 },
  li: { flex: 1, fontFamily: Fonts.sansRegular, fontSize: 14, color: '#374151', lineHeight: 22 },
});
