/**
 * Admin · In-app banner.
 *
 * Persists to app_settings/config.banner. Every signed-in user reads
 * app_settings/config on app open; a non-null banner renders above the
 * home content until they dismiss it (dismissal is stored locally).
 *
 * One banner at a time — keep the surface minimal.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '../../constants/theme';
import { useAuthStore } from '../../store/useAuthStore';
import { useAdminRole } from '../../lib/useAdminRole';
import { can } from '../../lib/admin';
import { AppBanner, clearBanner, publishBanner } from '../../services/admin';
import { getAppSettings } from '../../services/firebase';
import { confirmAction, infoAlert } from '../../lib/cross-platform-alerts';

const TONES: Array<{ key: AppBanner['tone']; label: string; from: string; to: string }> = [
  { key: 'info',      label: 'Info',      from: '#DBEAFE', to: '#BFDBFE' },
  { key: 'celebrate', label: 'Celebrate', from: '#FCE7F3', to: '#F9A8D4' },
  { key: 'warn',      label: 'Warn',      from: '#FEF3C7', to: '#FDE68A' },
];

export default function BannerScreen() {
  const insets = useSafeAreaInsets();
  const { user: actor } = useAuthStore();
  const role = useAdminRole();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaHref, setCtaHref] = useState('');
  const [tone, setTone] = useState<AppBanner['tone']>('info');
  const [expiresAt, setExpiresAt] = useState('');
  const [current, setCurrent] = useState<AppBanner | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const s = await getAppSettings();
      const b = (s as any)?.banner ?? null;
      setCurrent(b);
      if (b) {
        setTitle(b.title ?? '');
        setBody(b.body ?? '');
        setCtaLabel(b.cta?.label ?? '');
        setCtaHref(b.cta?.href ?? '');
        setTone((b.tone ?? 'info') as AppBanner['tone']);
        setExpiresAt(b.expiresAt ? new Date(b.expiresAt).toISOString().slice(0, 16).replace('T', ' ') : '');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish() {
    if (!actor) return;
    if (!can(role, 'manage_banner')) {
      infoAlert('Not allowed', 'Your role does not allow banner management.');
      return;
    }
    if (!title.trim() || !body.trim()) {
      infoAlert('Missing fields', 'Title and message are required.');
      return;
    }
    let expiresIso: string | undefined;
    if (expiresAt.trim()) {
      const t = Date.parse(expiresAt.trim().replace(' ', 'T'));
      if (isNaN(t) || t < Date.now()) {
        infoAlert('Invalid expiry', 'Use YYYY-MM-DD HH:MM and pick a time in the future.');
        return;
      }
      expiresIso = new Date(t).toISOString();
    }
    const banner: AppBanner = {
      title: title.trim(),
      body: body.trim(),
      tone,
      publishedAt: new Date().toISOString(),
      expiresAt: expiresIso,
    };
    if (ctaLabel.trim() && ctaHref.trim()) {
      banner.cta = { label: ctaLabel.trim(), href: ctaHref.trim() };
    }
    setBusy(true);
    try {
      await publishBanner(actor, banner);
      setCurrent(banner);
      infoAlert('Published', 'The banner is live for every signed-in user.');
    } catch (e: any) {
      infoAlert('Failed', e?.message ?? '');
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    if (!actor) return;
    if (!can(role, 'manage_banner')) {
      infoAlert('Not allowed', 'Your role does not allow banner management.');
      return;
    }
    const ok = await confirmAction('Clear banner', 'Take the current banner down?');
    if (!ok) return;
    setBusy(true);
    try {
      await clearBanner(actor);
      setCurrent(null);
      setTitle(''); setBody(''); setCtaLabel(''); setCtaHref(''); setExpiresAt('');
      infoAlert('Cleared', 'No banner is showing now.');
    } catch (e: any) {
      infoAlert('Failed', e?.message ?? '');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color={Colors.primary} /></View>;
  }

  const previewTone = TONES.find((t) => t.key === tone) ?? TONES[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
      <LinearGradient colors={['#F5F0FF', '#EDE4FF']} style={styles.headerCard}>
        <Text style={styles.headerEyebrow}>Admin · Comms</Text>
        <Text style={styles.headerTitle}>In-app banner</Text>
        <Text style={styles.headerSub}>Shows above the home page for every signed-in user. Useful for outages, launches, urgent notices.</Text>
      </LinearGradient>

      {current ? (
        <View style={styles.currentBlock}>
          <Text style={styles.currentLabel}>Currently live</Text>
          <LinearGradient colors={[previewTone.from, previewTone.to]} style={styles.bannerPreview}>
            <Text style={styles.previewTitle}>{current.title}</Text>
            <Text style={styles.previewBody}>{current.body}</Text>
            {current.cta ? <Text style={styles.previewCta}>{current.cta.label} →</Text> : null}
          </LinearGradient>
          <Text style={styles.currentMeta}>
            Published {new Date(current.publishedAt).toLocaleString('en-IN')}
            {current.expiresAt ? ` · expires ${new Date(current.expiresAt).toLocaleString('en-IN')}` : ''}
          </Text>
        </View>
      ) : (
        <View style={styles.currentBlock}>
          <Text style={styles.currentLabel}>No banner is live.</Text>
          <Text style={styles.currentMeta}>Compose below and publish.</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Compose</Text>
      <View style={styles.card}>
        <TextInput style={styles.input} placeholder="Title" placeholderTextColor="#9CA3AF" value={title} onChangeText={setTitle} maxLength={80} />
        <TextInput style={[styles.input, styles.textArea]} placeholder="Body (1–2 sentences)" placeholderTextColor="#9CA3AF" value={body} onChangeText={setBody} maxLength={240} multiline />
        <View style={styles.toneRow}>
          {TONES.map((t) => (
            <TouchableOpacity key={t.key} style={[styles.toneChip, tone === t.key && styles.toneChipActive]} onPress={() => setTone(t.key)}>
              <Text style={[styles.toneChipText, tone === t.key && { color: '#fff' }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={styles.input} placeholder="CTA label (optional, e.g. 'Read more')" placeholderTextColor="#9CA3AF" value={ctaLabel} onChangeText={setCtaLabel} maxLength={40} />
        <TextInput style={styles.input} placeholder="CTA href (optional, /community or https://…)" placeholderTextColor="#9CA3AF" value={ctaHref} onChangeText={setCtaHref} maxLength={200} autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="Expires at (optional, YYYY-MM-DD HH:MM)" placeholderTextColor="#9CA3AF" value={expiresAt} onChangeText={setExpiresAt} maxLength={20} autoCapitalize="none" />
      </View>

      <Text style={styles.sectionTitle}>Preview</Text>
      <LinearGradient colors={[previewTone.from, previewTone.to]} style={styles.bannerPreview}>
        <Text style={styles.previewTitle}>{title || 'Title goes here'}</Text>
        <Text style={styles.previewBody}>{body || 'Message body goes here.'}</Text>
        {ctaLabel ? <Text style={styles.previewCta}>{ctaLabel} →</Text> : null}
      </LinearGradient>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} disabled={busy} onPress={handlePublish}>
          <Ionicons name="megaphone-outline" size={14} color="#fff" />
          <Text style={[styles.btnText, { color: '#fff' }]}>{busy ? 'Working…' : (current ? 'Update banner' : 'Publish banner')}</Text>
        </TouchableOpacity>
        {current ? (
          <TouchableOpacity style={[styles.btn, styles.btnDanger]} disabled={busy} onPress={handleClear}>
            <Ionicons name="close" size={14} color="#EF4444" />
            <Text style={[styles.btnText, { color: '#EF4444' }]}>Take down</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  content: { padding: 16, gap: 12 },

  headerCard: { borderRadius: 16, padding: 16 },
  headerEyebrow: { fontSize: 11, fontWeight: '800', color: Colors.primary, letterSpacing: 1.2, textTransform: 'uppercase' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1a1a2e', marginTop: 2 },
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 4 },

  currentBlock: { gap: 6 },
  currentLabel: { fontSize: 11, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase' },
  currentMeta: { fontSize: 11, color: '#9CA3AF' },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#1a1a2e', marginTop: 4 },

  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, gap: 10, borderWidth: 1, borderColor: '#F0EDF5' },
  input: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, fontSize: 13, color: '#1a1a2e', borderWidth: 1, borderColor: '#E5E7EB' },
  textArea: { minHeight: 70, textAlignVertical: 'top' as any },

  toneRow: { flexDirection: 'row', gap: 6 },
  toneChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  toneChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toneChipText: { fontSize: 11, fontWeight: '700', color: '#1a1a2e' },

  bannerPreview: { borderRadius: 14, padding: 14, gap: 6 },
  previewTitle: { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  previewBody: { fontSize: 12, color: '#1a1a2e' },
  previewCta: { fontSize: 12, fontWeight: '800', color: Colors.primary, marginTop: 4 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10, borderWidth: 1 },
  btnPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  btnDanger: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  btnText: { fontSize: 13, fontWeight: '700' },
});
