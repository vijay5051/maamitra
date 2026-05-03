/**
 * Admin · What's new publisher.
 *
 * Wave 6. Single Firestore doc at app_config/whatsnew. Bump the version
 * to trigger a fresh modal on every client's next app launch. Clients
 * remember the last version they saw in AsyncStorage so existing users
 * see each new release once and only once.
 */
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import { AdminPage, EmptyState, StatusBadge, ToolbarButton } from '../../components/admin/ui';
import { fetchWhatsNew, publishWhatsNew, WhatsNewEntry } from '../../services/whatsNew';
import { useAuthStore } from '../../store/useAuthStore';

export default function WhatsNewScreen() {
  const { user: actor } = useAuthStore();

  const [current, setCurrent] = useState<WhatsNewEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaHref, setCtaHref] = useState('');
  const [version, setVersion] = useState<string>('1');

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const c = await fetchWhatsNew();
      setCurrent(c);
      if (c) {
        setTitle(c.title);
        setBody(c.body);
        setCtaLabel(c.ctaLabel ?? '');
        setCtaHref(c.ctaHref ?? '');
        setVersion(String(c.version));
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function publishCurrent() {
    if (!actor) return;
    if (!title.trim() || !body.trim()) {
      setError('Title and body are required.');
      return;
    }
    const v = parseInt(version, 10);
    if (!Number.isFinite(v) || v < 1) {
      setError('Version must be a positive integer.');
      return;
    }
    if (current && v <= current.version) {
      setError(`Version must be greater than the live version (${current.version}). Bump it to retrigger the modal for users who saw the previous release.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await publishWhatsNew(actor, {
        version: v,
        title: title.trim(),
        body: body.trim(),
        ctaLabel: ctaLabel.trim() || undefined,
        ctaHref: ctaHref.trim() || undefined,
      });
      await load();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  function bumpVersion() {
    const cur = parseInt(version, 10);
    setVersion(String((Number.isFinite(cur) ? cur : (current?.version ?? 0)) + 1));
  }

  return (
    <>
      <Stack.Screen options={{ title: "What's new" }} />
      <AdminPage
        title="What's new"
        description="Publish a release-notes modal that fires on each user's next app launch. Bump the version every time you publish so users who saw the previous release see this one too."
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: "What's new" }]}
        headerActions={
          <>
            <ToolbarButton label="Refresh" icon="refresh" onPress={load} />
            <ToolbarButton label="Bump version" icon="arrow-up-outline" onPress={bumpVersion} />
            <ToolbarButton
              label={saving ? 'Publishing…' : 'Publish'}
              icon="rocket-outline"
              variant="primary"
              onPress={publishCurrent}
              disabled={saving}
            />
          </>
        }
        loading={loading && !current}
        error={error}
      >
        {current ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabel}>Currently live</Text>
              <StatusBadge label={`v${current.version}`} color={Colors.success} />
            </View>
            <Text style={styles.metaLine}>
              Published {current.publishedAt ? new Date(current.publishedAt).toLocaleString('en-IN') : '—'}
              {current.publishedBy ? ` · by ${current.publishedBy}` : ''}
            </Text>
          </View>
        ) : (
          <EmptyState kind="empty" title="Nothing published yet" body="Compose a release note below and publish to roll it out." compact />
        )}

        <View style={styles.formCard}>
          <Field label="Version *" hint="Strictly greater than the live version. Bump every time you re-publish." value={version} onChange={setVersion} numeric />
          <Field label="Title *" hint="The headline shown at the top of the modal." value={title} onChange={setTitle} />
          <Field label="Body *" hint="Up to ~280 characters of plain text." value={body} onChange={setBody} multiline />
          <Field label="CTA label" hint="Optional. Leave blank to hide the button." value={ctaLabel} onChange={setCtaLabel} />
          <Field label="CTA href" hint="Optional. Route like /community or full URL." value={ctaHref} onChange={setCtaHref} />
        </View>

        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>Preview</Text>
          <Text style={styles.previewTitle}>{title || 'Your headline'}</Text>
          <Text style={styles.previewBody}>{body || 'Your body text shows up here.'}</Text>
          {ctaLabel ? <Text style={styles.previewCta}>{ctaLabel} →</Text> : null}
        </View>
      </AdminPage>
    </>
  );
}

function Field({ label, hint, value, onChange, multiline, numeric }: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  numeric?: boolean;
}) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      <TextInput
        style={[styles.fieldInput, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={numeric ? 'number-pad' : 'default'}
        placeholderTextColor={Colors.textMuted}
        placeholder={label.replace(' *', '')}
        autoCapitalize={label.toLowerCase().includes('href') ? 'none' : 'sentences'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textLight, letterSpacing: 1.2, textTransform: 'uppercase' },
  metaLine: { fontSize: FontSize.xs, color: Colors.textMuted },

  formCard: {
    backgroundColor: Colors.cardBg, borderRadius: Radius.lg, padding: Spacing.lg,
    gap: 4, borderWidth: 1, borderColor: Colors.borderSoft, ...Shadow.sm,
  },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 },
  fieldHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 4 },
  fieldInput: {
    backgroundColor: Colors.bgLight, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: FontSize.sm, color: Colors.textDark,
    borderWidth: 1, borderColor: Colors.border,
  },

  previewCard: {
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: 6,
    borderWidth: 1, borderColor: Colors.primary,
  },
  previewLabel: { fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 },
  previewTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textDark },
  previewBody: { fontSize: FontSize.md, color: Colors.textDark, lineHeight: 22 },
  previewCta: { fontSize: FontSize.md, fontWeight: '800', color: Colors.primary, marginTop: 6 },
});
