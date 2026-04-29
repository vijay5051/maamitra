/**
 * AppBannerStrip — renders the active in-app banner from app_settings.
 *
 * Lives on the home tab so every signed-in user sees it on app open. Each
 * user dismisses individually; the dismissal is keyed to the banner's
 * publishedAt so a new banner reappears even after the previous one was
 * dismissed. Banner content comes from app_settings/config.banner — managed
 * at /admin/banner.
 *
 * Tappable CTA: if href starts with '/' we route in-app; otherwise we open
 * via Linking.openURL.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

import { Colors } from '../../constants/theme';
import { useAppSettingsStore } from '../../store/useAppSettingsStore';

const DISMISS_KEY = '@maamitra/dismissedBannerPublishedAt';

const TONE_GRADIENTS: Record<string, [string, string]> = {
  info:      ['#DBEAFE', '#BFDBFE'],
  celebrate: ['#FCE7F3', '#F9A8D4'],
  warn:      ['#FEF3C7', '#FDE68A'],
};

export default function AppBannerStrip() {
  const router = useRouter();
  const { settings } = useAppSettingsStore();
  const banner = (settings as any)?.banner ?? null;
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(DISMISS_KEY).then((v) => setDismissedAt(v));
  }, []);

  if (!banner || !banner.title || !banner.body) return null;
  // Expired banner — drop it.
  if (banner.expiresAt && Date.parse(banner.expiresAt) < Date.now()) return null;
  // Already dismissed (this exact publish moment) — drop it.
  if (dismissedAt && banner.publishedAt && dismissedAt === banner.publishedAt) return null;

  const colors = TONE_GRADIENTS[banner.tone ?? 'info'] ?? TONE_GRADIENTS.info;

  function dismiss() {
    if (!banner.publishedAt) return;
    AsyncStorage.setItem(DISMISS_KEY, banner.publishedAt).catch(() => {});
    setDismissedAt(banner.publishedAt);
  }

  function tapCta() {
    const href = banner.cta?.href;
    if (!href) return;
    if (href.startsWith('/')) {
      router.push(href as any);
    } else {
      Linking.openURL(href).catch(() => {});
    }
  }

  return (
    <LinearGradient colors={colors} style={styles.wrap}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={2}>{banner.title}</Text>
        <Text style={styles.body} numberOfLines={3}>{banner.body}</Text>
        {banner.cta?.label ? (
          <Pressable onPress={tapCta} style={styles.ctaWrap}>
            <Text style={styles.cta}>{banner.cta.label} →</Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable onPress={dismiss} style={styles.closeBtn} hitSlop={10}>
        <Ionicons name="close" size={16} color="#1a1a2e" />
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 14, padding: 14, marginHorizontal: 16, marginTop: 12,
  },
  title: { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  body: { fontSize: 12, color: '#1a1a2e', marginTop: 4, lineHeight: 17 },
  ctaWrap: { marginTop: 6 },
  cta: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  closeBtn: { padding: 4 },
});
