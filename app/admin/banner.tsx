/**
 * Admin · In-app banner.
 *
 * Wave 3 rebuild. Persists to app_settings/config.banner. Every signed-in
 * user reads app_settings/config on app open; a non-null banner renders
 * above the home content until they dismiss it. One banner at a time —
 * keep the surface minimal.
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import {
  AdminPage,
  ConfirmDialog,
  EmptyState,
  StatusBadge,
  ToolbarButton,
} from '../../components/admin/ui';
import { useAuthStore } from '../../store/useAuthStore';
import { useAdminRole } from '../../lib/useAdminRole';
import { can } from '../../lib/admin';
import { AppBanner, clearBanner, publishBanner } from '../../services/admin';
import { getAppSettings } from '../../services/firebase';

const TONES: Array<{ key: AppBanner['tone']; label: string; from: string; to: string }> = [
  { key: 'info',      label: 'Info',      from: '#DBEAFE', to: '#BFDBFE' },
  { key: 'celebrate', label: 'Celebrate', from: '#FCE7F3', to: '#F9A8D4' },
  { key: 'warn',      label: 'Warn',      from: '#FEF3C7', to: '#FDE68A' },
];

export default function BannerScreen() {
  const { user: actor } = useAuthStore();
  const role = useAdminRole();
  const canEdit = can(role, 'manage_banner');

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaHref, setCtaHref] = useState('');
  const [tone, setTone] = useState<AppBanner['tone']>('info');
  const [expiresAt, setExpiresAt] = useState('');
  const [current, setCurrent] = useState<AppBanner | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
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
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish() {
    if (!actor || !canEdit) return;
    if (!title.trim() || !body.trim()) {
      setError('Title and message are required.');
      return;
    }
    let expiresIso: string | undefined;
    if (expiresAt.trim()) {
      const t = Date.parse(expiresAt.trim().replace(' ', 'T'));
      if (isNaN(t) || t < Date.now()) {
        setError('Invalid expiry — use YYYY-MM-DD HH:MM and pick a time in the future.');
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
    setError(null);
    try {
      await publishBanner(actor, banner);
      setCurrent(banner);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    if (!actor || !canEdit) return;
    setConfirmClear(false);
    setBusy(true);
    setError(null);
    try {
      await clearBanner(actor);
      setCurrent(null);
      setTitle(''); setBody(''); setCtaLabel(''); setCtaHref(''); setExpiresAt('');
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const previewTone = TONES.find((t) => t.key === tone) ?? TONES[0];

  return (
    <>
      <Stack.Screen options={{ title: 'In-app banner' }} />
      <AdminPage
        title="In-app banner"
        description="Shows above the home page for every signed-in user. Useful for outages, launches, urgent notices. One banner at a time."
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'In-app banner' }]}
        headerActions={
          canEdit ? (
            <>
              <ToolbarButton
                label={busy ? 'Working…' : (current ? 'Update' : 'Publish')}
                icon="megaphone-outline"
                variant="primary"
                onPress={handlePublish}
                disabled={busy}
              />
              {current ? (
                <ToolbarButton
                  label="Take down"
                  icon="close-outline"
                  variant="danger"
                  onPress={() => setConfirmClear(true)}
                  disabled={busy}
                />
              ) : null}
            </>
          ) : null
        }
        loading={loading && !current && !error}
        error={error}
      >
        {/* Currently live state */}
        {current ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Currently live</Text>
              <StatusBadge label="Live" color={Colors.success} />
            </View>
            <LinearGradient colors={[previewTone.from, previewTone.to]} style={styles.bannerPreview}>
              <Text style={styles.previewTitle}>{current.title}</Text>
              <Text style={styles.previewBody}>{current.body}</Text>
              {current.cta ? <Text style={styles.previewCta}>{current.cta.label} →</Text> : null}
            </LinearGradient>
            <Text style={styles.meta}>
              Published {new Date(current.publishedAt).toLocaleString('en-IN')}
              {current.expiresAt ? ` · expires ${new Date(current.expiresAt).toLocaleString('en-IN')}` : ''}
            </Text>
          </View>
        ) : !loading ? (
          <EmptyState
            kind="empty"
            title="No banner is live"
            body="Compose below and publish to show it on home for every user."
            compact
          />
        ) : null}

        {canEdit ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Compose</Text>
              <View style={styles.formCard}>
                <TextInput
                  style={styles.input}
                  placeholder="Title"
                  placeholderTextColor={Colors.textMuted}
                  value={title}
                  onChangeText={setTitle}
                  maxLength={80}
                />
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Body (1–2 sentences)"
                  placeholderTextColor={Colors.textMuted}
                  value={body}
                  onChangeText={setBody}
                  maxLength={240}
                  multiline
                />
                <View style={styles.toneRow}>
                  {TONES.map((t) => (
                    <ToolbarButton
                      key={t.key}
                      label={t.label}
                      variant={tone === t.key ? 'primary' : 'secondary'}
                      onPress={() => setTone(t.key)}
                    />
                  ))}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="CTA label (optional, e.g. 'Read more')"
                  placeholderTextColor={Colors.textMuted}
                  value={ctaLabel}
                  onChangeText={setCtaLabel}
                  maxLength={40}
                />
                <TextInput
                  style={styles.input}
                  placeholder="CTA href (optional, /community or https://…)"
                  placeholderTextColor={Colors.textMuted}
                  value={ctaHref}
                  onChangeText={setCtaHref}
                  maxLength={200}
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Expires at (optional, YYYY-MM-DD HH:MM)"
                  placeholderTextColor={Colors.textMuted}
                  value={expiresAt}
                  onChangeText={setExpiresAt}
                  maxLength={20}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Preview</Text>
              <LinearGradient colors={[previewTone.from, previewTone.to]} style={styles.bannerPreview}>
                <Text style={styles.previewTitle}>{title || 'Title goes here'}</Text>
                <Text style={styles.previewBody}>{body || 'Message body goes here.'}</Text>
                {ctaLabel ? <Text style={styles.previewCta}>{ctaLabel} →</Text> : null}
              </LinearGradient>
            </View>
          </>
        ) : null}
      </AdminPage>

      <ConfirmDialog
        visible={confirmClear}
        title="Take down banner?"
        body="The banner will disappear from every user's home page immediately."
        destructive
        confirmLabel="Take down"
        onCancel={() => setConfirmClear(false)}
        onConfirm={handleClear}
      />
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textLight,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  meta: { fontSize: FontSize.xs, color: Colors.textMuted },

  formCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  input: {
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: FontSize.sm, color: Colors.textDark,
    borderWidth: 1, borderColor: Colors.border,
  },
  textArea: { minHeight: 72, textAlignVertical: 'top' },

  toneRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },

  bannerPreview: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: 6,
  },
  previewTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textDark },
  previewBody: { fontSize: FontSize.sm, color: Colors.textDark, lineHeight: 19 },
  previewCta: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.primary, marginTop: 4 },
});
