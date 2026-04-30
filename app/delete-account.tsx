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

const EFFECTIVE = '29 April 2026';

export default function DeleteAccountScreen() {
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

        <Text style={styles.h1}>Delete your MaaMitra account</Text>
        <Text style={styles.meta}>Last updated: {EFFECTIVE}</Text>

        <P>
          You can request deletion of your MaaMitra account and the personal data associated with
          it at any time. This page explains the two ways to do that, what gets removed, and what
          (if anything) is retained.
        </P>

        <H2>Option 1 — Delete in the app (recommended)</H2>
        <LI>Open MaaMitra and sign in.</LI>
        <LI>Go to <B>Profile → Settings</B>.</LI>
        <LI>Scroll to the bottom and tap <B>Delete account</B>.</LI>
        <LI>Confirm. Your account is deleted immediately and you are signed out.</LI>

        <H2>Option 2 — Email request (if you can't sign in)</H2>
        <P>
          If you no longer have access to your account (lost phone, forgotten password, locked out),
          email us from the address registered with your account:
        </P>
        <LI><B>Email:</B> info@maamitra.co.in</LI>
        <LI><B>Subject:</B> Delete my account</LI>
        <LI><B>Include:</B> the phone number or email used to sign up.</LI>
        <P>
          We will verify the request and delete your account within <B>30 days</B>.
        </P>

        <H2>What gets deleted</H2>
        <LI>Your profile (name, email, phone number, profile photo).</LI>
        <LI>Your children's profiles and any health, growth, mood, vaccine, and routine logs you entered.</LI>
        <LI>Your community posts, comments, reactions, and direct messages.</LI>
        <LI>Your AI chat history.</LI>
        <LI>Your push notification tokens and notification preferences.</LI>
        <LI>Uploaded photos in your account and posts.</LI>

        <H2>What is retained</H2>
        <P>
          We may retain a limited amount of data for a short period after deletion where we are
          legally required to (e.g., fraud investigation, abuse reports, tax records) or where it
          is necessary to protect MaaMitra and other users (e.g., a record that a banned account
          existed). Such records are minimised and access-restricted, and are removed once the
          retention obligation ends — typically within 30 to 180 days.
        </P>

        <H2>Questions</H2>
        <P>
          For anything related to your data or this process, write to <B>info@maamitra.co.in</B>.
          Read our full <B>Privacy Policy</B> at{' '}
          <Text style={styles.bold}>https://maamitra.co.in/privacy</Text> for details on how we
          handle your data.
        </P>

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
