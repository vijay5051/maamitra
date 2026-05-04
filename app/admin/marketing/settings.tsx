/**
 * Marketing Settings hub.
 *
 * Studio v2 redesign: a single Settings page split into three sections —
 * Daily knobs (the toggles admin actually touches week-to-week),
 * Setup (the brand kit / strategy / style profile rarely-touched config),
 * and Advanced (template preview + diagnostics).
 *
 * Every "edit" button deep-links into an existing legacy screen so this
 * stays a thin hub — no logic duplication.
 */

import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';
import {
  fetchBrandKit,
  probeMarketingHealthNow,
  saveBrandKit,
  subscribeBrandKit,
  subscribeMarketingHealth,
} from '../../../services/marketing';
import { friendlyError } from '../../../services/marketingErrors';
import {
  BrandKit,
  ChannelHealth,
  DEFAULT_STYLE_PROFILE,
  MarketingHealth,
  StyleProfile,
} from '../../../lib/marketingTypes';
import { useAuthStore } from '../../../store/useAuthStore';

export default function MarketingSettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [brand, setBrand] = useState<BrandKit | null>(null);
  const [health, setHealth] = useState<MarketingHealth | null>(null);
  const [recheckBusy, setRecheckBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    void fetchBrandKit().then((k) => { setBrand(k); setLoading(false); });
    const unsubBrand = subscribeBrandKit((k) => setBrand(k));
    const unsubHealth = subscribeMarketingHealth(setHealth);
    return () => { unsubBrand(); unsubHealth(); };
  }, []);

  const showBanner = useCallback((tone: 'ok' | 'err', text: string) => {
    setBanner({ tone, text });
    setTimeout(() => setBanner(null), 2400);
  }, []);

  async function update(label: string, patch: Partial<BrandKit>) {
    if (!user || !brand) return;
    setSaving(label);
    try {
      await saveBrandKit({ uid: user.uid, email: user.email }, patch);
      showBanner('ok', 'Saved');
    } catch {
      showBanner('err', "Couldn't save — try again");
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Settings' }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.bgLight }}
        contentContainerStyle={[styles.body, isWide && styles.bodyWide]}
      >
        {banner ? (
          <View style={[styles.banner, banner.tone === 'err' && styles.bannerErr]}>
            <Ionicons
              name={banner.tone === 'ok' ? 'checkmark-circle' : 'alert-circle'}
              size={16}
              color={banner.tone === 'ok' ? Colors.success : Colors.error}
            />
            <Text style={[styles.bannerText, banner.tone === 'err' && { color: Colors.error }]}>{banner.text}</Text>
          </View>
        ) : null}

        {/* ── Daily knobs ──────────────────────────────────────────────── */}
        <SectionHead title="Daily" subtitle="The toggles you'll actually touch." />

        <ToggleRow
          icon="alarm-outline"
          title="Auto-post each morning"
          body={brand?.cronEnabled
            ? 'A fresh draft lands in your To-Review inbox every day at 6 AM IST.'
            : 'Off — drafts only happen when you click Generate now.'}
          on={brand?.cronEnabled ?? false}
          loading={saving === 'cron'}
          disabled={loading}
          onToggle={(v) => update('cron', { cronEnabled: v })}
        />

        <ToggleRow
          icon="pause-circle-outline"
          title="Crisis pause"
          body={brand?.crisisPaused
            ? `Active${brand.crisisPauseReason ? ` — ${brand.crisisPauseReason}` : ''}. Nothing auto-publishes while paused.`
            : 'Halt scheduled posts during outages or sensitive news.'}
          on={brand?.crisisPaused ?? false}
          loading={saving === 'crisis'}
          disabled={loading}
          onToggle={async (v) => {
            let reason: string | null = brand?.crisisPauseReason ?? null;
            if (v && typeof window !== 'undefined') {
              reason = window.prompt('Reason for the pause (optional):', '') ?? null;
            }
            await update('crisis', { crisisPaused: v, crisisPauseReason: v ? reason : null });
          }}
          tone={brand?.crisisPaused ? 'warn' : 'default'}
        />

        <Card>
          <View style={styles.cardHead}>
            <View style={styles.cardIcon}>
              <Ionicons name="link-outline" size={16} color={Colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Connected accounts</Text>
            <Pressable
              disabled={recheckBusy}
              onPress={async () => {
                setRecheckBusy(true);
                try {
                  const out = await probeMarketingHealthNow();
                  showBanner(
                    out.ig.ok && out.fb.ok ? 'ok' : 'err',
                    out.ig.ok && out.fb.ok
                      ? 'Both connections are live.'
                      : `IG ${out.ig.ok ? 'OK' : '✕'} • FB ${out.fb.ok ? 'OK' : '✕'}`,
                  );
                } catch (e: any) {
                  showBanner('err', friendlyError('Re-check connections', e));
                } finally {
                  setRecheckBusy(false);
                }
              }}
              style={styles.editLink}
            >
              {recheckBusy ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={styles.editLinkLabel}>Re-check now</Text>
              )}
            </Pressable>
          </View>
          <View style={{ gap: 8, marginTop: 8 }}>
            <ConnectionRow platform="Instagram" channel={health?.ig ?? null} pending={health === null} fallbackHandle="maamitra.official" />
            <ConnectionRow platform="Facebook Page" channel={health?.fb ?? null} pending={health === null} fallbackHandle="MaaMitra" />
          </View>
          <Text style={styles.cardHint}>
            {health?.lastCheckedAt
              ? `Checked ${formatRelative(health.lastCheckedAt)}. Re-checks every hour automatically.`
              : 'Waiting for first probe — re-check now to populate.'}
          </Text>
        </Card>

        {/* ── Setup ───────────────────────────────────────────────────── */}
        <SectionHead title="Setup" subtitle="Configure once, change rarely." />

        <NavCard
          icon="color-palette-outline"
          title="Brand kit"
          body={brand?.logoUrl ? `${brand.brandName} • logo + palette + voice set.` : 'Add your logo, palette, and voice — drives every generated post.'}
          status={brand?.logoUrl ? 'done' : 'pending'}
          onPress={() => router.push('/admin/marketing/brand-kit' as any)}
        />

        <NavCard
          icon="people-outline"
          title="Strategy"
          body={
            (brand?.personas?.length ?? 0) > 0
              ? `${brand?.personas.length} personas • ${brand?.pillars.length} pillars • ${brand?.culturalCalendar.length} events`
              : 'Define audience personas, content pillars, cultural calendar, compliance.'
          }
          status={(brand?.personas?.length ?? 0) > 0 ? 'done' : 'pending'}
          onPress={() => router.push('/admin/marketing/strategy' as any)}
        />

        <StyleProfileEditor
          profile={brand?.styleProfile ?? DEFAULT_STYLE_PROFILE}
          loading={loading || saving === 'style'}
          onSave={async (next) => update('style', { styleProfile: next })}
        />

        {/* ── Advanced ────────────────────────────────────────────────── */}
        <SectionHead title="Advanced" subtitle="Power tools and diagnostics." />

        <NavCard
          icon="image-outline"
          title="Template preview"
          body="Render a single post with custom inputs — useful for tuning brand voice or testing layouts."
          onPress={() => router.push('/admin/marketing/preview' as any)}
        />

        <NavCard
          icon="receipt-outline"
          title="Cost log"
          body={`Daily cap ₹${brand?.costCaps?.dailyInr ?? 0} • monthly ₹${brand?.costCaps?.monthlyInr ?? 0}.`}
          onPress={() => router.push('/admin/marketing/preview' as any)}
        />
      </ScrollView>
    </>
  );
}

// ── Small components ────────────────────────────────────────────────────────

function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginTop: Spacing.md, marginBottom: 4 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function CardHead({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.cardHead}>
      <View style={styles.cardIcon}>
        <Ionicons name={icon} size={16} color={Colors.primary} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
  );
}

function ToggleRow({
  icon, title, body, on, loading, disabled, onToggle, tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  on: boolean;
  loading: boolean;
  disabled: boolean;
  onToggle: (next: boolean) => void;
  tone?: 'default' | 'warn';
}) {
  return (
    <Pressable
      onPress={() => !disabled && !loading && onToggle(!on)}
      style={[styles.toggleRow, on && tone === 'warn' && styles.toggleRowWarn, on && tone !== 'warn' && styles.toggleRowOn]}
    >
      <View style={[styles.cardIcon, on && tone !== 'warn' && { backgroundColor: Colors.primary }, on && tone === 'warn' && { backgroundColor: Colors.error }]}>
        <Ionicons name={icon} size={16} color={on ? Colors.white : Colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardBody}>{body}</Text>
      </View>
      <View style={[styles.switch, on && (tone === 'warn' ? { backgroundColor: Colors.error } : { backgroundColor: Colors.primary })]}>
        {loading ? (
          <ActivityIndicator size="small" color={on ? Colors.white : Colors.primary} />
        ) : (
          <View style={[styles.switchKnob, on && styles.switchKnobOn]} />
        )}
      </View>
    </Pressable>
  );
}

function NavCard({
  icon, title, body, status, onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  status?: 'done' | 'pending';
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <Ionicons name={icon} size={16} color={Colors.primary} />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
        {status ? (
          <View style={[styles.statusChip, status === 'done' ? styles.statusChipDone : styles.statusChipPending]}>
            <Text style={[styles.statusChipLabel, status === 'done' && { color: Colors.success }]}>
              {status === 'done' ? '✓ Set up' : 'Set this up'}
            </Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </View>
      <Text style={styles.cardBody}>{body}</Text>
    </Pressable>
  );
}

function ConnectionRow({
  platform, channel, pending, fallbackHandle,
}: {
  platform: string;
  channel: ChannelHealth | null;
  /** True while we're waiting for the first probe to land. */
  pending: boolean;
  /** Shown when the probe hasn't returned a handle yet. */
  fallbackHandle: string;
}) {
  // Three states: pending (no probe yet), ok (last probe succeeded), fail.
  const dotColor = pending
    ? Colors.textMuted
    : channel?.ok ? Colors.success : Colors.error;
  const handleText = (channel?.handle && channel.handle.trim()) || fallbackHandle;
  const statusText = pending ? 'Checking…' : channel?.ok ? 'Connected' : 'Reconnect';
  const statusColor = pending
    ? Colors.textMuted
    : channel?.ok ? Colors.success : Colors.error;
  return (
    <View style={{ gap: 2 }}>
      <View style={styles.connectionRow}>
        <View style={styles.connectionDot}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
        </View>
        <Text style={styles.connectionPlatform}>{platform}</Text>
        <Text style={styles.connectionHandle}>{handleText}</Text>
        <Text style={[styles.connectionStatus, { color: statusColor }]}>{statusText}</Text>
      </View>
      {channel && !channel.ok && channel.error ? (
        <Text style={styles.connectionError}>{channel.error}</Text>
      ) : null}
    </View>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const sec = Math.round(ms / 1000);
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.round(hr / 24);
  return `${day} d ago`;
}

function StyleProfileEditor({
  profile, loading, onSave,
}: {
  profile: StyleProfile;
  loading: boolean;
  onSave: (next: StyleProfile) => Promise<void>;
}) {
  const [oneLiner, setOneLiner] = useState(profile.oneLiner);
  const [description, setDescription] = useState(profile.description);
  const [keywords, setKeywords] = useState(profile.artKeywords);
  const [prohibited, setProhibited] = useState(profile.prohibited.join(', '));
  const [editing, setEditing] = useState(false);

  // Reset locals when profile prop changes (server save flushed back).
  useEffect(() => {
    setOneLiner(profile.oneLiner);
    setDescription(profile.description);
    setKeywords(profile.artKeywords);
    setProhibited(profile.prohibited.join(', '));
  }, [profile.oneLiner, profile.description, profile.artKeywords, profile.prohibited]);

  return (
    <Card>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <Ionicons name="brush-outline" size={16} color={Colors.primary} />
        </View>
        <Text style={styles.cardTitle}>Visual style</Text>
        <View style={styles.newPill}>
          <Text style={styles.newPillLabel}>NEW</Text>
        </View>
        <Pressable onPress={() => setEditing((e) => !e)} style={styles.editLink}>
          <Text style={styles.editLinkLabel}>{editing ? 'Hide' : 'Edit'}</Text>
        </Pressable>
      </View>
      <Text style={styles.cardBody}>
        {profile.oneLiner}
      </Text>

      {editing ? (
        <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
          <Field label="One-line summary">
            <TextInput
              value={oneLiner}
              onChangeText={setOneLiner}
              style={styles.input}
              maxLength={240}
              multiline
            />
          </Field>
          <Field label="Detailed description">
            <Text style={styles.fieldHint}>Fed to AI image-gen as a style preamble.</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              style={[styles.input, { minHeight: 80 }]}
              maxLength={1500}
              multiline
            />
          </Field>
          <Field label="Art keywords">
            <Text style={styles.fieldHint}>Comma-separated. Suffixed onto every prompt.</Text>
            <TextInput
              value={keywords}
              onChangeText={setKeywords}
              style={styles.input}
              maxLength={240}
            />
          </Field>
          <Field label="Things to avoid">
            <Text style={styles.fieldHint}>Comma-separated. The AI is told NOT to produce these.</Text>
            <TextInput
              value={prohibited}
              onChangeText={setProhibited}
              style={[styles.input, { minHeight: 60 }]}
              multiline
            />
          </Field>
          <Pressable
            disabled={loading}
            style={[styles.savePillBtn, loading && { opacity: 0.6 }]}
            onPress={async () => {
              await onSave({
                oneLiner: oneLiner.trim(),
                description: description.trim(),
                artKeywords: keywords.trim(),
                prohibited: prohibited.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 30),
              });
              setEditing(false);
            }}
          >
            {loading ? <ActivityIndicator size="small" color={Colors.white} /> :
              <Text style={styles.savePillBtnLabel}>Save changes</Text>}
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 80 },
  bodyWide: { paddingHorizontal: Spacing.xxxl },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.success,
  },
  bannerErr: { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: Colors.error },
  bannerText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.success },

  sectionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionSubtitle: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },

  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
    gap: 6,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark, flex: 1 },
  cardBody: { fontSize: FontSize.xs, color: Colors.textLight, lineHeight: 18 },
  cardHint: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic', marginTop: 4 },

  // Toggle
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  toggleRowOn: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  toggleRowWarn: { borderColor: Colors.error, backgroundColor: 'rgba(239,68,68,0.05)' },
  switch: {
    width: 44, height: 26, borderRadius: 13,
    backgroundColor: Colors.borderSoft,
    padding: 2, justifyContent: 'center',
  },
  switchKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.white, ...Shadow.sm },
  switchKnobOn: { transform: [{ translateX: 18 }] },

  // Connection
  connectionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  connectionDot: { width: 16, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  connectionPlatform: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark, width: 110 },
  connectionHandle: { fontSize: FontSize.xs, color: Colors.textLight, flex: 1 },
  connectionStatus: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted },
  connectionError: {
    fontSize: 11,
    color: Colors.error,
    marginLeft: 24,
    lineHeight: 14,
  },

  // Status chip
  statusChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  statusChipDone: { backgroundColor: 'rgba(34,197,94,0.1)' },
  statusChipPending: { backgroundColor: 'rgba(245,158,11,0.1)' },
  statusChipLabel: { fontSize: 10, fontWeight: '700', color: Colors.warning },

  // New pill
  newPill: { backgroundColor: Colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  newPillLabel: { fontSize: 9, fontWeight: '800', color: Colors.white, letterSpacing: 0.4 },

  editLink: { paddingHorizontal: 8, paddingVertical: 4 },
  editLinkLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },

  // Form fields (style profile)
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDark },
  fieldHint: { fontSize: 11, color: Colors.textMuted, marginBottom: 2 },
  input: {
    backgroundColor: Colors.bgLight,
    borderWidth: 1, borderColor: Colors.borderSoft,
    borderRadius: Radius.sm,
    paddingHorizontal: 10, paddingVertical: 8,
    fontSize: FontSize.xs, color: Colors.textDark,
    minHeight: 36,
    outlineStyle: 'none' as any,
  },
  savePillBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.primary,
    borderRadius: 999,
    marginTop: 4,
  },
  savePillBtnLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.white },
});
