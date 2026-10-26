import React from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts, Colors } from '../../constants/theme';

export const OPERATOR_NAME = 'Divya Shekhawat';
export const OPERATOR_PLACE = 'Jaipur, Rajasthan, India';
export const SUPPORT_EMAIL = 'info@maamitra.co.in';
export const LEGAL_UPDATED = '26 October 2026';

const LEGAL_LINKS: { label: string; href: Href }[] = [
  { label: 'Terms', href: '/terms' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Refunds', href: '/refund' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Contact', href: '/contact' },
];

export function LegalPage({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
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
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={styles.back}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={18} color={Colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.h1}>{title}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : <View style={{ height: 18 }} />}

        {children}

        <View style={styles.footer}>
          {LEGAL_LINKS.map((l, i) => (
            <React.Fragment key={l.label}>
              {i > 0 && <Text style={styles.footerDot}>·</Text>}
              <TouchableOpacity onPress={() => router.push(l.href)} accessibilityRole="link" hitSlop={8}>
                <Text style={styles.footerLink}>{l.label}</Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
        <Text style={styles.footerMeta}>© {new Date().getFullYear()} MaaMitra · {OPERATOR_NAME} (sole proprietor) · {OPERATOR_PLACE}</Text>
      </View>
    </ScrollView>
  );
}

export const P = ({ children }: { children: React.ReactNode }) => <Text style={styles.p}>{children}</Text>;
export const LI = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.liRow}><Text style={styles.liDot}>•</Text><Text style={styles.li}>{children}</Text></View>
);
export const H2 = ({ children }: { children: React.ReactNode }) => <Text style={styles.h2}>{children}</Text>;
export const B = ({ children }: { children: React.ReactNode }) => <Text style={styles.bold}>{children}</Text>;

export function A({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  const external = /^(https?:|mailto:)/.test(href);
  return (
    <Text
      style={styles.link}
      accessibilityRole="link"
      onPress={() => (external ? Linking.openURL(href) : router.push(href as Href))}
    >
      {children}
    </Text>
  );
}

export const legalStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    padding: 16,
    marginBottom: 12,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgLight },
  scroll: { flexGrow: 1 },
  container: { paddingHorizontal: 22, alignSelf: 'stretch' },
  containerWide: { maxWidth: 760, alignSelf: 'center', width: '100%', paddingHorizontal: 32 },

  back: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, marginBottom: 8 },
  backText: { fontFamily: Fonts.sansBold, fontSize: 13, color: Colors.primary },

  h1: { fontFamily: Fonts.sansBold, fontSize: 28, color: Colors.textDark, letterSpacing: -0.4, marginTop: 4 },
  meta: { fontFamily: Fonts.sansRegular, fontSize: 12, color: Colors.textMuted, marginTop: 6, marginBottom: 18 },
  h2: { fontFamily: Fonts.sansBold, fontSize: 15, color: Colors.textDark, marginTop: 20, marginBottom: 8 },
  p: { fontFamily: Fonts.sansRegular, fontSize: 14, color: '#374151', lineHeight: 22, marginBottom: 8 },
  bold: { fontFamily: Fonts.sansBold, color: Colors.textDark },
  link: { fontFamily: Fonts.sansBold, color: Colors.primary, textDecorationLine: 'underline' },
  liRow: { flexDirection: 'row', marginBottom: 6, paddingLeft: 4 },
  liDot: { fontFamily: Fonts.sansRegular, color: Colors.primary, width: 16, fontSize: 14, lineHeight: 22 },
  li: { flex: 1, fontFamily: Fonts.sansRegular, fontSize: 14, color: '#374151', lineHeight: 22 },

  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 36 },
  footerLink: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.primary },
  footerDot: { color: Colors.textMuted, fontSize: 13 },
  footerMeta: { fontFamily: Fonts.sansRegular, fontSize: 12, color: Colors.textMuted, marginTop: 8 },
});
