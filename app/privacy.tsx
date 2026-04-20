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

export default function PrivacyScreen() {
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

        <Text style={styles.h1}>Privacy Policy</Text>
        <Text style={styles.meta}>Effective: {EFFECTIVE}  ·  Last updated: {EFFECTIVE}</Text>

        <P>
          MaaMitra ("we," "us," "our") is operated by <B>Maamitra Pvt. Ltd.</B>, India. This policy
          explains what personal data we collect when you use the MaaMitra app and website
          (together, "MaaMitra"), how we use it, and your rights under India's Digital Personal
          Data Protection Act, 2023 (DPDP Act) and other applicable laws.
        </P>

        <H2>1. Data we collect</H2>
        <LI><B>Account data:</B> name, email, phone number, password (hashed), profile photo.</LI>
        <LI><B>Family data you choose to add:</B> your pregnancy due date, your children's names, dates of birth, and milestones. You decide what to enter.</LI>
        <LI><B>Chat & content data:</B> messages you send to the AI companion, posts, comments, and reactions you create in the community.</LI>
        <LI><B>Device & usage data:</B> device type, OS, app version, crash logs, approximate region, and interaction events used to improve the product.</LI>
        <LI><B>Cookies / local storage:</B> used for sign-in and preferences on the web app.</LI>
        <P>We do not knowingly collect data directly from children. MaaMitra is intended for parents and caregivers aged 18+.</P>

        <H2>2. How we use your data</H2>
        <LI>Provide and personalise MaaMitra (remember your baby's age, tailor content).</LI>
        <LI>Power the AI companion (send your messages to our AI providers — see §4).</LI>
        <LI>Keep you signed in, send push notifications you opt into, and respond to support requests.</LI>
        <LI>Keep the community safe (moderation of posts and comments).</LI>
        <LI>Detect fraud, abuse, and violations of our Terms.</LI>
        <LI>Comply with legal obligations.</LI>
        <P>
          We process your data on the lawful grounds of your <B>consent</B> (account creation,
          notifications, optional features) and our <B>legitimate use</B> (security, fraud
          prevention, service operation) under the DPDP Act.
        </P>

        <H2>3. Sharing</H2>
        <P>We do not sell your personal data. We share limited data only with:</P>
        <LI><B>Service providers</B> who host and operate MaaMitra: Google Firebase (authentication, database, storage, hosting, messaging) and our AI model providers (for generating chat responses).</LI>
        <LI><B>Law enforcement / regulators</B> where required by law.</LI>
        <LI><B>A successor entity</B> in the event of a merger, acquisition, or restructuring, with notice to you.</LI>

        <H2>4. AI processing</H2>
        <P>
          When you chat with the MaaMitra AI mitra, your messages and the context we store about
          your family may be sent to our AI model provider(s) to generate a response. Providers
          are contractually required not to train their general models on your data. Responses
          are stored in your account so you can see your chat history.
        </P>

        <H2>5. Storage & transfer</H2>
        <P>
          Data is stored on Google Cloud infrastructure, primarily in the <B>asia-south1 (Mumbai)</B> region.
          Some processing (e.g., AI generation) may occur outside India; in such cases we rely on
          contractual safeguards permitted under the DPDP Act.
        </P>

        <H2>6. Retention</H2>
        <P>
          We retain your account data for as long as your account is active. On deletion, we
          remove your personal data within 30 days, except where we are required to retain
          specific records for legal or security reasons (e.g., fraud investigation, tax).
        </P>

        <H2>7. Your rights (DPDP Act 2023)</H2>
        <P>
          You have the right to access your data, correct it, erase it, withdraw consent, and
          nominate another person to exercise your rights in the event of your death or
          incapacity. You can exercise most rights directly in the app (Profile → Settings), or
          by writing to <B>info@maamitra.co.in</B>.
        </P>

        <H2>8. Security</H2>
        <P>
          We use industry-standard safeguards — TLS in transit, encryption at rest via our cloud
          provider, hashed passwords, Firebase App Check, and role-based access controls. No
          system is 100% secure; please use a strong, unique password.
        </P>

        <H2>9. Children's data</H2>
        <P>
          MaaMitra is designed for parents. Any data you enter about your child (name, DOB,
          milestones) is treated as sensitive personal data. You are the data principal for that
          information as their legal guardian, and you can delete it at any time.
        </P>

        <H2>10. Changes</H2>
        <P>
          We'll update this policy when our practices change. Material changes will be notified
          in-app or by email at least 7 days before they take effect.
        </P>

        <H2>11. Grievance Officer (DPDP Act 2023)</H2>
        <P><B>Name:</B> Vijay Singh Rathore</P>
        <P><B>Email:</B> info@maamitra.co.in</P>
        <P><B>Address:</B> Maamitra Pvt. Ltd., Jaipur, Rajasthan, India</P>
        <P>We will respond to grievances within 30 days.</P>

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
  root: { flex: 1, backgroundColor: '#FAFAFB' },
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
