/**
 * Admin · Marketing drafts queue (M2).
 *
 * Reads from marketing_drafts via a live snapshot. Each row shows
 * thumbnail + headline + status. Clicking opens a slide-over with the
 * full image, editable caption, compliance flags, and the four actions:
 *   - Approve  (status → 'approved'; manual-publish mode shows
 *     copy-caption + download-image while Meta App Review pending)
 *   - Reject   (asks for a reason; status → 'rejected')
 *   - Regenerate (calls generateMarketingDraft with same persona/pillar;
 *     creates a NEW draft, leaves the old one in place — admin compares)
 *   - Delete   (hard delete — for stale drafts the admin doesn't want
 *     in the audit trail)
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';
import {
  AdminPage,
  EmptyState,
  SlideOver,
  StatusBadge,
  ToolbarButton,
} from '../../../components/admin/ui';
import {
  approveDraft,
  boostMarketingDraft,
  deleteDraft,
  fetchDraft,
  generateMarketingDraft,
  markDraftPosted,
  publishDraftNow,
  rejectDraft,
  scheduleDraft,
  subscribeDrafts,
  unscheduleDraft,
  updateDraftCaption,
} from '../../../services/marketingDrafts';
import { DraftStatus, MarketingDraft, MarketingPlatform } from '../../../lib/marketingTypes';
import { useAuthStore } from '../../../store/useAuthStore';
import { friendlyError, friendlyPublishError } from '../../../services/marketingErrors';
import { buildBioLink } from '../../../services/attribution';

const STATUS_FILTERS: { value: DraftStatus | 'all'; label: string }[] = [
  { value: 'all',            label: 'All' },
  { value: 'pending_review', label: 'Pending review' },
  { value: 'approved',       label: 'Approved' },
  { value: 'scheduled',      label: 'Scheduled' },
  { value: 'rejected',       label: 'Rejected' },
  { value: 'posted',         label: 'Posted' },
];

const STATUS_TONES: Record<DraftStatus, string> = {
  pending_review: Colors.warning,
  approved: Colors.success,
  scheduled: Colors.primary,
  posted: Colors.success,
  rejected: Colors.error,
  failed: Colors.error,
};

export default function MarketingDraftsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ open?: string }>();
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<DraftStatus | 'all'>('pending_review');
  const [drafts, setDrafts] = useState<MarketingDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  // Deep-link from calendar: /admin/marketing/drafts?open=<id> opens that
  // draft's slide-over once the snapshot has loaded the row.
  useEffect(() => {
    const target = typeof params.open === 'string' ? params.open : null;
    if (target && target !== openId) setOpenId(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.open]);

  const counts = useMemo(() => {
    const out: Record<DraftStatus | 'all', number> = {
      all: drafts.length,
      pending_review: 0, approved: 0, scheduled: 0, posted: 0, rejected: 0, failed: 0,
    };
    drafts.forEach((d) => { out[d.status] += 1; });
    return out;
  }, [drafts]);

  const visible = useMemo(
    () => (filter === 'all' ? drafts : drafts.filter((d) => d.status === filter)),
    [drafts, filter],
  );

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeDrafts({ limitN: 100 }, (rows) => {
      setDrafts(rows);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function handleGenerate(count: 1 | 2 = 1) {
    setError(null);
    setGenerating(true);
    try {
      // For "Generate 2 variants" we kick off two parallel calls with the
      // same (empty) override so the slot picker chooses identically and
      // the only delta is GPT temperature noise.
      const calls = Array.from({ length: count }, () => generateMarketingDraft({}));
      const results = await Promise.all(calls);
      const failures = results.filter((r) => !r.ok);
      if (failures.length === results.length) {
        throw failures[0];
      }
      // Open the first successful one for review.
      const firstOk = results.find((r) => r.ok) as any;
      setOpenId(firstOk.draftId);
      if (failures.length > 0) {
        setError(`${failures.length} of ${results.length} variants didn't work — opening the ones that did.`);
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setGenerating(false);
    }
  }

  const openDraft = useMemo(() => visible.find((d) => d.id === openId) ?? drafts.find((d) => d.id === openId) ?? null, [drafts, visible, openId]);

  return (
    <>
      <Stack.Screen options={{ title: 'Drafts' }} />
      <AdminPage
        title="Marketing drafts"
        description="Review, edit, and approve AI-generated drafts. Cron runs at 6am IST when enabled; meanwhile use Generate now."
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Marketing', href: '/admin/marketing' },
          { label: 'Drafts' },
        ]}
        headerActions={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <ToolbarButton
              label={generating ? 'Generating…' : 'Generate 2 (A/B)'}
              icon="sparkles"
              onPress={() => handleGenerate(2)}
              disabled={generating}
            />
            <ToolbarButton
              label={generating ? 'Generating…' : 'Generate now'}
              icon="sparkles"
              variant="primary"
              onPress={() => handleGenerate(1)}
              disabled={generating}
            />
          </View>
        }
        loading={loading && drafts.length === 0}
        error={error}
      >
        <View style={styles.filterBar}>
          {STATUS_FILTERS.map((f) => (
            <Pressable
              key={f.value}
              onPress={() => setFilter(f.value)}
              style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
            >
              <Text style={[styles.filterLabel, filter === f.value && styles.filterLabelActive]}>
                {f.label}
              </Text>
              <Text style={[styles.filterCount, filter === f.value && styles.filterCountActive]}>
                {counts[f.value]}
              </Text>
            </Pressable>
          ))}
        </View>

        {visible.length === 0 ? (
          <EmptyState
            kind="empty"
            title={filter === 'all' ? 'No drafts yet' : `No ${filter.replace('_', ' ')} drafts`}
            body="Click Generate now to create one. The daily cron also produces a draft each morning when enabled."
          />
        ) : (
          <View style={styles.grid}>
            {visible.map((d) => (
              <DraftCard key={d.id} draft={d} onOpen={() => setOpenId(d.id)} />
            ))}
          </View>
        )}
      </AdminPage>

      <DraftSlideOver
        draft={openDraft}
        onClose={() => setOpenId(null)}
        onChanged={async () => {
          // Snapshot will refresh automatically; force-reload the open
          // draft from server just in case (e.g. caption edit confirm).
          if (openId) {
            const fresh = await fetchDraft(openId);
            if (!fresh) setOpenId(null);
          }
        }}
        actor={user ? { uid: user.uid, email: user.email } : null}
      />
    </>
  );
}

// ── Draft card ──────────────────────────────────────────────────────────────

function DraftCard({ draft, onOpen }: { draft: MarketingDraft; onOpen: () => void }) {
  const tone = STATUS_TONES[draft.status];
  const thumb = draft.assets[0]?.url ?? null;
  return (
    <Pressable onPress={onOpen} style={styles.card}>
      <View style={styles.thumbWrap}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons name="image-outline" size={32} color={Colors.textMuted} />
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardHead}>
          <StatusBadge label={draft.status.replace('_', ' ')} color={tone} />
          {draft.pillarLabel ? (
            <Text style={styles.metaSub} numberOfLines={1}>{draft.pillarLabel}</Text>
          ) : null}
        </View>
        <Text style={styles.headline} numberOfLines={2}>
          {draft.headline ?? '(no headline)'}
        </Text>
        <Text style={styles.captionPreview} numberOfLines={3}>
          {draft.caption.replace(/\n+/g, ' ')}
        </Text>
        <View style={styles.metaRow}>
          {draft.personaLabel ? <Text style={styles.metaTag}>👤 {draft.personaLabel}</Text> : null}
          {draft.eventLabel ? <Text style={styles.metaTag}>🗓 {draft.eventLabel}</Text> : null}
          {draft.imageSource ? <Text style={styles.metaTag}>🖼 {draft.imageSource}</Text> : null}
          {draft.safetyFlags.length > 0 ? (
            <Text style={[styles.metaTag, { color: Colors.error }]}>⚠ {draft.safetyFlags.length} flag{draft.safetyFlags.length === 1 ? '' : 's'}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

// ── Slide-over editor ───────────────────────────────────────────────────────

function DraftSlideOver({
  draft,
  onClose,
  onChanged,
  actor,
}: {
  draft: MarketingDraft | null;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
  actor: { uid: string; email: string | null | undefined } | null;
}) {
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectingReason, setRejectingReason] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [scheduleDraftAt, setScheduleDraftAt] = useState<string>('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showMarkPosted, setShowMarkPosted] = useState(false);
  const [showBoost, setShowBoost] = useState(false);
  const [boostBudget, setBoostBudget] = useState(500);
  const [boostDays, setBoostDays] = useState(3);
  const [boosting, setBoosting] = useState(false);

  useEffect(() => {
    setEditingCaption(false);
    setCaptionDraft(draft?.caption ?? '');
    setActionError(null);
    setRejectingReason(null);
    setShowSchedule(false);
    setShowExport(false);
    setShowMarkPosted(false);
    setShowBoost(false);
    // Default schedule input to tomorrow 9am IST in local datetime-local format.
    setScheduleDraftAt(defaultScheduleAt());
  }, [draft?.id]);

  if (!draft || !actor) {
    return <SlideOver visible={false} title="" onClose={onClose} />;
  }

  async function withGuard(label: string, fn: () => Promise<void>) {
    setActionError(null);
    setSaving(true);
    try {
      await fn();
      await onChanged();
    } catch (e) {
      setActionError(friendlyError(label, e));
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    if (!draft || !actor) return;
    await withGuard('Approve', async () => {
      // If caption was edited inline but not saved, save it first.
      const finalCaption = captionDraft !== draft.caption ? captionDraft : undefined;
      await approveDraft(actor, draft.id, finalCaption ? { caption: finalCaption } : undefined);
      onClose();
    });
  }

  async function handleReject() {
    if (!draft || !actor) return;
    if (!rejectingReason) {
      setRejectingReason('');
      return;
    }
    if (!rejectingReason.trim()) {
      setActionError('Please give a reason so we can learn from it.');
      return;
    }
    await withGuard('Reject', async () => {
      await rejectDraft(actor, draft.id, rejectingReason.trim());
      onClose();
    });
  }

  async function handleRegenerate() {
    if (!draft) return;
    setActionError(null);
    setRegenerating(true);
    try {
      const res = await generateMarketingDraft({
        personaId: draft.personaId ?? undefined,
        pillarId: draft.pillarId ?? undefined,
        eventId: draft.eventId ?? undefined,
      });
      if (!res.ok) throw res;
    } catch (e) {
      setActionError(friendlyError('Regenerate', e));
    } finally {
      setRegenerating(false);
    }
  }

  async function handleDelete() {
    if (!draft || !actor) return;
    if (!confirm('Delete this draft permanently?')) return;
    await withGuard('Delete', async () => {
      await deleteDraft(actor, draft.id);
      onClose();
    });
  }

  async function handleSaveCaption() {
    if (!draft || !actor) return;
    await withGuard('Save caption', async () => {
      await updateDraftCaption(actor, draft.id, captionDraft);
      setEditingCaption(false);
    });
  }

  async function handleSchedule() {
    if (!draft || !actor) return;
    if (!scheduleDraftAt) {
      setActionError('Pick a date and time first.');
      return;
    }
    const iso = scheduleInputToIso(scheduleDraftAt);
    if (!iso) {
      setActionError('Invalid date/time.');
      return;
    }
    await withGuard('Schedule', async () => {
      await scheduleDraft(actor, draft.id, iso);
      setShowSchedule(false);
      onClose();
    });
  }

  async function handleUnschedule() {
    if (!draft || !actor) return;
    await withGuard('Unschedule', async () => {
      await unscheduleDraft(actor, draft.id);
    });
  }

  async function handleMarkPosted() {
    if (!draft || !actor) return;
    await withGuard('Mark posted', async () => {
      // Manual-publish mode — admin already pasted to whichever channels.
      // We don't capture per-channel permalinks via UI yet (M3b will);
      // store an empty map so the row doesn't fail validation.
      await markDraftPosted(actor, draft.id, {});
      setShowMarkPosted(false);
      onClose();
    });
  }

  async function handleBoost() {
    if (!draft || !actor) return;
    if (boostBudget < 100 || boostBudget > 5000 || boostDays < 1 || boostDays > 7) {
      setActionError('Budget should be ₹100–₹5000 a day, for 1–7 days.');
      return;
    }
    setActionError(null);
    setBoosting(true);
    try {
      const res = await boostMarketingDraft({ draftId: draft.id, dailyBudgetInr: boostBudget, durationDays: boostDays });
      if (!res.ok) throw res;
      await onChanged();
      setShowBoost(false);
    } catch (e) {
      setActionError(friendlyError('Boost', e));
    } finally {
      setBoosting(false);
    }
  }

  async function handlePublishNow() {
    if (!draft || !actor) return;
    setActionError(null);
    setSaving(true);
    try {
      const res = await publishDraftNow({ draftId: draft.id });
      if (!res.ok) throw res;
      // Server already flipped status='posted' + saved permalink. Snapshot
      // refreshes on its own; close so admin can see the queue update.
      await onChanged();
      onClose();
    } catch (e) {
      setActionError(friendlyError('Publish', e));
    } finally {
      setSaving(false);
    }
  }

  async function copyCaption() {
    if (!draft) return;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(draft.caption);
    }
  }

  function downloadImage() {
    const url = draft?.assets[0]?.url;
    if (!url) return;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  }

  const tone = STATUS_TONES[draft.status];
  const thumb = draft.assets[0]?.url;
  const isPending = draft.status === 'pending_review';
  const isApproved = draft.status === 'approved';
  const isScheduled = draft.status === 'scheduled';
  const isPosted = draft.status === 'posted';
  const isFailed = draft.status === 'failed';

  return (
    <SlideOver
      visible={!!draft}
      title={draft.headline ?? '(no headline)'}
      subtitle={[draft.pillarLabel, draft.personaLabel, draft.themeLabel].filter(Boolean).join(' · ')}
      onClose={onClose}
      width={640}
      footer={
        <View style={styles.footerCol}>
          {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
          {rejectingReason !== null ? (
            <View style={styles.rejectRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={rejectingReason}
                onChangeText={setRejectingReason}
                placeholder="Reason (helps the system learn)"
                placeholderTextColor={Colors.textMuted}
                autoFocus
              />
              <Pressable
                onPress={handleReject}
                style={[styles.btn, styles.btnDanger]}
                disabled={saving}
              >
                <Text style={styles.btnLabel}>Confirm reject</Text>
              </Pressable>
              <Pressable onPress={() => setRejectingReason(null)} style={[styles.btn, styles.btnGhost]}>
                <Text style={[styles.btnLabel, { color: Colors.textMuted }]}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.footerRow}>
              {isPending ? (
                <>
                  <Pressable onPress={handleApprove} disabled={saving} style={[styles.btn, styles.btnPrimary]}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={styles.btnLabel}>{saving ? 'Saving…' : 'Approve'}</Text>
                  </Pressable>
                  <Pressable onPress={() => setRejectingReason('')} style={[styles.btn, styles.btnGhost]}>
                    <Ionicons name="close" size={16} color={Colors.error} />
                    <Text style={[styles.btnLabel, { color: Colors.error }]}>Reject</Text>
                  </Pressable>
                </>
              ) : null}
              {isApproved ? (
                <>
                  <Pressable onPress={handlePublishNow} disabled={saving} style={[styles.btn, styles.btnPrimary]}>
                    <Ionicons name="rocket" size={16} color="#fff" />
                    <Text style={styles.btnLabel}>{saving ? 'Publishing…' : 'Publish now'}</Text>
                  </Pressable>
                  <Pressable onPress={() => setShowSchedule((v) => !v)} style={[styles.btn, styles.btnGhost]}>
                    <Ionicons name="calendar" size={16} color={Colors.primary} />
                    <Text style={[styles.btnLabel, { color: Colors.primary }]}>Schedule…</Text>
                  </Pressable>
                  <Pressable onPress={copyCaption} style={[styles.btn, styles.btnGhost]}>
                    <Ionicons name="copy" size={16} color={Colors.primary} />
                    <Text style={[styles.btnLabel, { color: Colors.primary }]}>Copy caption</Text>
                  </Pressable>
                  <Pressable onPress={downloadImage} style={[styles.btn, styles.btnGhost]}>
                    <Ionicons name="download" size={16} color={Colors.primary} />
                    <Text style={[styles.btnLabel, { color: Colors.primary }]}>Download image</Text>
                  </Pressable>
                  <Pressable onPress={() => setShowMarkPosted(true)} style={[styles.btn, styles.btnGhost]}>
                    <Ionicons name="checkmark-done" size={16} color={Colors.success} />
                    <Text style={[styles.btnLabel, { color: Colors.success }]}>Mark posted</Text>
                  </Pressable>
                </>
              ) : null}
              {isScheduled ? (
                <>
                  <Pressable onPress={handlePublishNow} disabled={saving} style={[styles.btn, styles.btnPrimary]}>
                    <Ionicons name="rocket" size={16} color="#fff" />
                    <Text style={styles.btnLabel}>{saving ? 'Publishing…' : 'Publish now'}</Text>
                  </Pressable>
                  <Pressable onPress={handleUnschedule} style={[styles.btn, styles.btnGhost]} disabled={saving}>
                    <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
                    <Text style={[styles.btnLabel, { color: Colors.textMuted }]}>{saving ? 'Updating…' : 'Unschedule'}</Text>
                  </Pressable>
                  <Pressable onPress={() => setShowMarkPosted(true)} style={[styles.btn, styles.btnGhost]}>
                    <Ionicons name="checkmark-done" size={16} color={Colors.success} />
                    <Text style={[styles.btnLabel, { color: Colors.success }]}>Mark posted</Text>
                  </Pressable>
                  <Pressable onPress={copyCaption} style={[styles.btn, styles.btnGhost]}>
                    <Ionicons name="copy" size={16} color={Colors.primary} />
                    <Text style={[styles.btnLabel, { color: Colors.primary }]}>Copy</Text>
                  </Pressable>
                </>
              ) : null}
              {isPosted && !draft.boost ? (
                <Pressable onPress={() => setShowBoost(true)} style={[styles.btn, styles.btnPrimary]}>
                  <Ionicons name="trending-up" size={16} color="#fff" />
                  <Text style={styles.btnLabel}>Boost this post</Text>
                </Pressable>
              ) : null}
              {isPosted && draft.boost?.status === 'active' ? (
                <View style={[styles.btn, { backgroundColor: Colors.primarySoft, borderWidth: 1, borderColor: Colors.primary }]}>
                  <Ionicons name="trending-up" size={14} color={Colors.primary} />
                  <Text style={[styles.btnLabel, { color: Colors.primary }]}>
                    Boost active · ₹{draft.boost.dailyBudgetInr}/day
                  </Text>
                </View>
              ) : null}
              {isPosted && draft.boost?.status === 'failed' ? (
                <View style={[styles.btn, styles.btnGhost]}>
                  <Ionicons name="warning" size={14} color={Colors.error} />
                  <Text style={[styles.btnLabel, { color: Colors.error }]}>Boost failed — see details</Text>
                </View>
              ) : null}
              {isFailed ? (
                <Pressable onPress={handlePublishNow} disabled={saving} style={[styles.btn, styles.btnPrimary]}>
                  <Ionicons name="refresh-circle" size={16} color="#fff" />
                  <Text style={styles.btnLabel}>{saving ? 'Retrying…' : 'Retry publish'}</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={handleRegenerate}
                disabled={regenerating}
                style={[styles.btn, styles.btnGhost]}
              >
                <Ionicons name="refresh" size={16} color={Colors.textMuted} />
                <Text style={[styles.btnLabel, { color: Colors.textMuted }]}>
                  {regenerating ? 'Regenerating…' : 'Regenerate'}
                </Text>
              </Pressable>
              <Pressable onPress={handleDelete} style={[styles.btn, styles.btnGhost]}>
                <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
                <Text style={[styles.btnLabel, { color: Colors.textMuted }]}>Delete</Text>
              </Pressable>
            </View>
          )}
        </View>
      }
    >
      <View style={{ gap: Spacing.md }}>
        <View style={styles.previewWrap}>
          {draft.assets.length > 1 ? (
            // Carousel — horizontal scroller with slide-of-N badges so admin
            // can review every slide before approving / publishing.
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
              style={{ flexGrow: 0 }}
            >
              {draft.assets.map((a, i) => (
                <View key={i} style={styles.carouselThumbWrap}>
                  <Image source={{ uri: a.url }} style={styles.carouselThumb} resizeMode="cover" />
                  <View style={styles.carouselThumbBadge}>
                    <Text style={styles.carouselThumbBadgeLabel}>{i + 1}/{draft.assets.length}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : thumb ? (
            <Image source={{ uri: thumb }} style={styles.preview} resizeMode="cover" />
          ) : (
            <View style={[styles.preview, styles.thumbPlaceholder]}>
              <ActivityIndicator />
            </View>
          )}
        </View>

        <View style={styles.metaCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <StatusBadge label={draft.status.replace('_', ' ')} color={tone} />
            {draft.locale ? <Text style={styles.metaInline}>locale: {draft.locale}</Text> : null}
            {draft.imageSource ? <Text style={styles.metaInline}>image: {draft.imageSource}</Text> : null}
            <Text style={styles.metaInline}>cost: ₹{draft.costInr.toFixed(2)}</Text>
          </View>
        </View>

        {draft.safetyFlags.length > 0 ? (
          <View style={styles.flagBox}>
            <Text style={styles.flagTitle}>Compliance flags</Text>
            {draft.safetyFlags.map((f, i) => (
              <Text key={i} style={styles.flagText}>• {f}</Text>
            ))}
            <Text style={styles.flagHint}>Edit the caption to remove these phrases, then approve.</Text>
          </View>
        ) : null}

        {isFailed && draft.publishError ? (
          <View style={styles.publishErrorBox}>
            <Text style={styles.publishErrorTitle}>Couldn't publish</Text>
            <Text style={styles.publishErrorText}>{friendlyPublishError(draft.publishError) ?? draft.publishError}</Text>
            <Text style={styles.flagHint}>
              Tap "Retry publish" below — IG processes images asynchronously,
              transient errors usually clear on retry.
            </Text>
          </View>
        ) : null}

        {showSchedule ? (
          <View style={styles.schedBox}>
            <Text style={styles.captionLabel}>Schedule for (IST)</Text>
            <Text style={styles.fieldHint}>The post stays as-is; it just shows up on the calendar at this time and the cron auto-publishes once Meta access lands. Until then, manual publish.</Text>
            <DateTimeInput value={scheduleDraftAt} onChange={setScheduleDraftAt} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Pressable onPress={handleSchedule} disabled={saving} style={[styles.btn, styles.btnPrimary]}>
                <Text style={styles.btnLabel}>{saving ? 'Saving…' : 'Confirm schedule'}</Text>
              </Pressable>
              <Pressable onPress={() => setShowSchedule(false)} style={[styles.btn, styles.btnGhost]}>
                <Text style={[styles.btnLabel, { color: Colors.textMuted }]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {draft.scheduledAt ? (
          <View style={styles.schedShown}>
            <Ionicons name="calendar" size={16} color={Colors.primary} />
            <Text style={styles.schedShownLabel}>
              Scheduled · {new Date(draft.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}
            </Text>
          </View>
        ) : null}

        {showMarkPosted ? (
          <View style={styles.schedBox}>
            <Text style={styles.captionLabel}>Mark this draft as posted?</Text>
            <Text style={styles.fieldHint}>Use this once you've manually pasted to your channels. Status flips to "posted" and the draft moves out of the active queue.</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Pressable onPress={handleMarkPosted} disabled={saving} style={[styles.btn, styles.btnPrimary]}>
                <Text style={styles.btnLabel}>{saving ? 'Saving…' : 'Yes, mark posted'}</Text>
              </Pressable>
              <Pressable onPress={() => setShowMarkPosted(false)} style={[styles.btn, styles.btnGhost]}>
                <Text style={[styles.btnLabel, { color: Colors.textMuted }]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {showBoost ? (
          <View style={styles.schedBox}>
            <Text style={styles.captionLabel}>Boost this post</Text>
            <Text style={styles.fieldHint}>
              Promotes this IG post via the Marketing API. Requires META_AD_ACCOUNT_ID + META_FB_PAGE_ID + ads_management scope on your token. Spend tracked in analytics.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Daily budget (₹)</Text>
                <TextInput
                  style={styles.input}
                  value={String(boostBudget)}
                  onChangeText={(t) => {
                    const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
                    setBoostBudget(Number.isFinite(n) ? n : 0);
                  }}
                  keyboardType="numeric"
                />
                <Text style={styles.fieldHint}>₹100 – ₹5,000/day</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Duration (days)</Text>
                <TextInput
                  style={styles.input}
                  value={String(boostDays)}
                  onChangeText={(t) => {
                    const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
                    setBoostDays(Number.isFinite(n) ? Math.max(1, Math.min(7, n)) : 1);
                  }}
                  keyboardType="numeric"
                />
                <Text style={styles.fieldHint}>1 – 7 days</Text>
              </View>
            </View>
            <Text style={styles.fieldHint}>
              Total spend: up to ₹{(boostBudget * boostDays).toLocaleString('en-IN')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Pressable onPress={handleBoost} disabled={boosting} style={[styles.btn, styles.btnPrimary]}>
                <Ionicons name="trending-up" size={14} color="#fff" />
                <Text style={styles.btnLabel}>{boosting ? 'Creating boost…' : 'Confirm boost'}</Text>
              </Pressable>
              <Pressable onPress={() => setShowBoost(false)} style={[styles.btn, styles.btnGhost]}>
                <Text style={[styles.btnLabel, { color: Colors.textMuted }]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {draft.boost ? (
          <View style={styles.boostInfo}>
            <Ionicons name="trending-up" size={16} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.boostTitle}>
                Boost · {draft.boost.status} · ₹{draft.boost.dailyBudgetInr}/day × {draft.boost.durationDays} days
              </Text>
              {draft.boost.status === 'active' || draft.boost.status === 'completed' ? (
                <Text style={styles.boostMeta}>Spent ₹{draft.boost.spendInr.toFixed(0)} · reach {draft.boost.reach.toLocaleString('en-IN')}</Text>
              ) : null}
              {draft.boost.error ? (
                <Text style={[styles.boostMeta, { color: Colors.error }]}>{draft.boost.error}</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {(isApproved || isScheduled || draft.status === 'posted') ? (
          <View style={styles.exportBlock}>
            <Pressable onPress={() => setShowExport((v) => !v)} style={styles.exportToggle}>
              <Ionicons name={showExport ? 'chevron-down' : 'chevron-forward'} size={16} color={Colors.textMuted} />
              <Text style={styles.exportToggleLabel}>Export package — per-channel ready-to-paste</Text>
            </Pressable>
            {showExport ? <ExportPackage draft={draft} /> : null}
          </View>
        ) : null}

        <View>
          <View style={styles.captionHead}>
            <Text style={styles.captionLabel}>Caption</Text>
            {!editingCaption ? (
              <Pressable onPress={() => { setCaptionDraft(draft.caption); setEditingCaption(true); }}>
                <Text style={styles.editLink}>Edit</Text>
              </Pressable>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable onPress={() => { setEditingCaption(false); setCaptionDraft(draft.caption); }}>
                  <Text style={[styles.editLink, { color: Colors.textMuted }]}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleSaveCaption} disabled={saving}>
                  <Text style={styles.editLink}>{saving ? 'Saving…' : 'Save'}</Text>
                </Pressable>
              </View>
            )}
          </View>
          {editingCaption ? (
            <TextInput
              style={[styles.input, styles.captionInput]}
              value={captionDraft}
              onChangeText={setCaptionDraft}
              multiline
            />
          ) : (
            <Text style={styles.captionBody}>{draft.caption}</Text>
          )}
        </View>

        {draft.imagePrompt ? (
          <View>
            <Text style={styles.captionLabel}>Image prompt (used for AI)</Text>
            <Text style={styles.metaText} selectable>{draft.imagePrompt}</Text>
          </View>
        ) : null}

        {isPosted ? <BioLinkBlock draft={draft} /> : null}

        {draft.rejectReason ? (
          <View style={styles.flagBox}>
            <Text style={styles.flagTitle}>Reject reason</Text>
            <Text style={styles.flagText}>{draft.rejectReason}</Text>
          </View>
        ) : null}
      </View>
    </SlideOver>
  );
}

// ── Date-time input (web datetime-local; native plain text) ────────────────

function BioLinkBlock({ draft }: { draft: MarketingDraft }) {
  const igUrl = useMemo(() => buildBioLink({ draftId: draft.id, headline: draft.headline, channel: 'instagram' }), [draft.id, draft.headline]);
  const fbUrl = useMemo(() => buildBioLink({ draftId: draft.id, headline: draft.headline, channel: 'facebook' }), [draft.id, draft.headline]);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(label: string, url: string) {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setCopied(label);
      setTimeout(() => setCopied(null), 1800);
    }
  }

  return (
    <View>
      <Text style={styles.captionLabel}>Bio link with attribution</Text>
      <Text style={styles.fieldHint}>
        Paste in the IG/FB bio for this post — UTM tags let analytics attribute new signups back to this draft.
      </Text>
      <View style={{ gap: 6, marginTop: 6 }}>
        <BioLinkRow label="Instagram" url={igUrl} active={copied === 'Instagram'} onCopy={() => copy('Instagram', igUrl)} />
        <BioLinkRow label="Facebook" url={fbUrl} active={copied === 'Facebook'} onCopy={() => copy('Facebook', fbUrl)} />
      </View>
    </View>
  );
}

function BioLinkRow({ label, url, active, onCopy }: { label: string; url: string; active: boolean; onCopy: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, width: 70 }}>{label}</Text>
      <Text style={[styles.metaText, { flex: 1, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }]} numberOfLines={1} selectable>{url}</Text>
      <Pressable onPress={onCopy} style={[styles.btn, styles.btnGhost, { paddingHorizontal: 10, paddingVertical: 4 }]}>
        <Ionicons name={active ? 'checkmark' : 'copy'} size={14} color={active ? Colors.success : Colors.primary} />
        <Text style={[styles.btnLabel, { color: active ? Colors.success : Colors.primary }]}>{active ? 'Copied' : 'Copy'}</Text>
      </Pressable>
    </View>
  );
}

function DateTimeInput({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  if (Platform.OS === 'web') {
    return (
      <TextInput
        style={[styles.input, { marginTop: 6 }]}
        // @ts-expect-error — Expo Web renders TextInput as <input>; passing
        // `type="datetime-local"` upgrades it to the native picker. Not in
        // the RN typings, but supported at runtime.
        type="datetime-local"
        value={value}
        onChangeText={onChange}
      />
    );
  }
  return (
    <TextInput
      style={[styles.input, { marginTop: 6 }]}
      value={value}
      onChangeText={onChange}
      placeholder="YYYY-MM-DDTHH:mm"
      placeholderTextColor={Colors.textMuted}
      autoCapitalize="none"
    />
  );
}

function defaultScheduleAt(): string {
  // Tomorrow 9am IST in `YYYY-MM-DDTHH:mm` for the datetime-local input.
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000 + 24 * 3600 * 1000);
  ist.setUTCHours(9 - 5, 30, 0, 0); // 9am IST → 03:30 UTC; we'll show in IST text
  // Reformat to `YYYY-MM-DDTHH:mm` based on the IST clock.
  const pad = (n: number) => String(n).padStart(2, '0');
  const istClock = new Date(Date.now() + 5.5 * 3600 * 1000 + 24 * 3600 * 1000);
  return `${istClock.getUTCFullYear()}-${pad(istClock.getUTCMonth() + 1)}-${pad(istClock.getUTCDate())}T09:00`;
}

function scheduleInputToIso(local: string): string | null {
  // The datetime-local input's value is naive local time. We treat it as IST
  // (since the admin lives in India) and convert to a UTC ISO string.
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, da, h, mi] = m;
  // IST is UTC+5:30 with no DST.
  const utcMs = Date.UTC(+y, +mo - 1, +da, +h, +mi) - 5.5 * 3600 * 1000;
  return new Date(utcMs).toISOString();
}

// ── Export package — per-channel ready-to-paste content ─────────────────────
// All adaptation is client-side string formatting. No extra LLM calls.

type ChannelKey = 'instagram' | 'facebook' | 'twitter' | 'linkedin' | 'whatsapp' | 'email' | 'push';

interface ChannelDef {
  key: ChannelKey;
  label: string;
  hint: string;
  /** Build the export content from a draft. Returns either a single block
   *  or labelled fields (e.g. email subject + body). */
  build: (draft: MarketingDraft) => Array<{ label?: string; text: string }>;
}

function ExportPackage({ draft }: { draft: MarketingDraft }) {
  const [activeKey, setActiveKey] = useState<ChannelKey>('instagram');
  const channels: ChannelDef[] = [
    { key: 'instagram', label: 'Instagram', hint: '≤2200 chars · keeps full caption', build: igExport },
    { key: 'facebook',  label: 'Facebook',  hint: 'Same caption; FB allows long form', build: fbExport },
    { key: 'twitter',   label: 'X / Twitter', hint: '≤280 chars · trims body, keeps top hashtags', build: twExport },
    { key: 'linkedin',  label: 'LinkedIn',  hint: 'Body reformatted for professional tone framing', build: liExport },
    { key: 'whatsapp',  label: 'WhatsApp Status', hint: 'Punchy first 200 chars + key hashtags', build: waExport },
    { key: 'email',     label: 'Email',     hint: 'Subject + body for newsletter blast', build: emailExport },
    { key: 'push',      label: 'Push',      hint: '≤30c title · ≤120c body for FCM', build: pushExport },
  ];
  const active = channels.find((c) => c.key === activeKey)!;
  const blocks = active.build(draft);

  async function copyBlock(text: string) {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
  }

  return (
    <View style={styles.exportBody}>
      <View style={styles.channelRow}>
        {channels.map((c) => (
          <Pressable
            key={c.key}
            onPress={() => setActiveKey(c.key)}
            style={[styles.channelChip, activeKey === c.key && styles.channelChipActive]}
          >
            <Text style={[styles.channelChipLabel, activeKey === c.key && styles.channelChipLabelActive]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.fieldHint}>{active.hint}</Text>
      <View style={{ gap: 8, marginTop: 8 }}>
        {blocks.map((b, idx) => (
          <View key={idx} style={styles.exportBlockRow}>
            {b.label ? <Text style={styles.exportBlockLabel}>{b.label}</Text> : null}
            <View style={styles.exportTextRow}>
              <Text style={styles.exportText} selectable>{b.text}</Text>
              <Pressable onPress={() => copyBlock(b.text)} style={styles.copyBtn}>
                <Ionicons name="copy" size={14} color={Colors.primary} />
                <Text style={styles.copyBtnLabel}>Copy</Text>
              </Pressable>
            </View>
            <Text style={styles.exportLen}>{b.text.length} chars</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Channel adapters — pure string transforms over the existing caption.

function splitCaption(caption: string): { body: string; tags: string; disclaimers: string } {
  // Split off the trailing hashtag block and any preceding disclaimer
  // paragraph. `assembleCaption` in the generator joins these with two
  // newlines, so we reverse that here.
  const parts = caption.split(/\n\n+/);
  const tagPart = parts.length > 1 && parts[parts.length - 1].trim().startsWith('#')
    ? parts.pop()!
    : '';
  // Disclaimers are paragraphs that start with an italicised asterisk.
  const disclaimerParts: string[] = [];
  while (parts.length > 1 && /^\s*\*/.test(parts[parts.length - 1])) {
    disclaimerParts.unshift(parts.pop()!);
  }
  return {
    body: parts.join('\n\n').trim(),
    tags: tagPart.trim(),
    disclaimers: disclaimerParts.join('\n\n').trim(),
  };
}

function igExport(d: MarketingDraft) {
  return [{ text: d.caption }];
}

function fbExport(d: MarketingDraft) {
  return [{ text: d.caption }];
}

function twExport(d: MarketingDraft) {
  const { body, tags } = splitCaption(d.caption);
  // X cap is 280. Reserve ~40 for top 2-3 hashtags.
  const tagList = (tags.match(/#\w+/g) ?? []).slice(0, 2).join(' ');
  const reserve = tagList.length + (tagList ? 1 : 0);
  const trimmed = body.length + reserve > 275 ? body.slice(0, 275 - reserve - 1) + '…' : body;
  const out = (trimmed + (tagList ? ` ${tagList}` : '')).slice(0, 280);
  return [{ text: out }];
}

function liExport(d: MarketingDraft) {
  const { body, tags } = splitCaption(d.caption);
  const tagList = (tags.match(/#\w+/g) ?? []).slice(0, 5).join(' ');
  const lead = d.headline ? `${d.headline}\n\n` : '';
  const text = `${lead}${body}${tagList ? `\n\n${tagList}` : ''}`;
  return [{ text }];
}

function waExport(d: MarketingDraft) {
  const { body, tags } = splitCaption(d.caption);
  const trimmed = body.length > 200 ? body.slice(0, 197) + '…' : body;
  const tagList = (tags.match(/#\w+/g) ?? []).slice(0, 3).join(' ');
  return [{ text: `${trimmed}${tagList ? `\n\n${tagList}` : ''}` }];
}

function emailExport(d: MarketingDraft) {
  const subject = d.headline ?? d.themeLabel;
  const { body } = splitCaption(d.caption);
  const emailBody = `Hi maa,\n\n${body}\n\n— team MaaMitra`;
  return [
    { label: 'Subject', text: subject },
    { label: 'Body', text: emailBody },
  ];
}

function pushExport(d: MarketingDraft) {
  const title = (d.headline ?? d.themeLabel).slice(0, 30);
  const { body } = splitCaption(d.caption);
  const firstSentence = body.split(/[.?!]\s/)[0] ?? body;
  const pushBody = firstSentence.slice(0, 117) + (firstSentence.length > 117 ? '…' : '');
  return [
    { label: 'Title', text: title },
    { label: 'Body', text: pushBody },
  ];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function confirm(msg: string): boolean {
  if (Platform.OS === 'web') return typeof window !== 'undefined' && window.confirm(msg);
  return true; // native: rely on caller-side ConfirmDialog if needed
}

const styles = StyleSheet.create({
  filterBar: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgLight,
    gap: 6,
  },
  filterChipActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  filterLabel: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '600' },
  filterLabelActive: { color: Colors.primary, fontWeight: '700' },
  filterCount: {
    fontSize: 11, color: Colors.textMuted, backgroundColor: Colors.cardBg,
    paddingHorizontal: 6, borderRadius: 999, fontWeight: '700', minWidth: 20, textAlign: 'center',
  },
  filterCountActive: { color: Colors.primary, backgroundColor: '#fff' },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md,
  },
  card: {
    flexBasis: '32%', flexGrow: 1, minWidth: 280,
    backgroundColor: Colors.cardBg, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.borderSoft,
    overflow: 'hidden', ...Shadow.sm,
  },
  thumbWrap: { aspectRatio: 1, backgroundColor: Colors.bgLight },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: Spacing.md, gap: 6 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  headline: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark, lineHeight: 22 },
  captionPreview: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  metaTag: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  metaSub: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },

  // width:'100%' ensures the wrapper fills the ScrollView content column so the
  // Image's own width:'100%' resolves to the panel width (without it the View
  // collapses and the image renders at 0 height inside the ScrollView body).
  previewWrap: { width: '100%', borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Colors.bgLight },
  preview: { width: '100%', aspectRatio: 1 },

  // Carousel thumbnails (Phase 4 item 1)
  carouselThumbWrap: {
    width: 220, aspectRatio: 1, borderRadius: Radius.md,
    overflow: 'hidden', backgroundColor: Colors.bgTint,
    position: 'relative',
  },
  carouselThumb: { width: '100%', height: '100%' },
  carouselThumbBadge: {
    position: 'absolute', top: 8, left: 8,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 999,
  },
  carouselThumbBadgeLabel: { fontSize: 10, fontWeight: '800', color: Colors.white, letterSpacing: 0.4 },
  metaCard: { padding: Spacing.sm, backgroundColor: Colors.bgLight, borderRadius: Radius.md },
  metaInline: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },
  metaText: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18, marginTop: 4 },

  flagBox: { backgroundColor: '#FFF4F4', borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: '#F8C8CB', gap: 4 },
  flagTitle: { fontWeight: '700', color: Colors.error, fontSize: FontSize.sm },
  flagText: { fontSize: FontSize.xs, color: Colors.error, fontWeight: '600' },
  flagHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4, fontStyle: 'italic' },

  publishErrorBox: { backgroundColor: '#FFF4F4', borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: '#F8C8CB', gap: 4 },
  publishErrorTitle: { fontWeight: '700', color: Colors.error, fontSize: FontSize.sm },
  publishErrorText: { fontSize: FontSize.xs, color: Colors.error, fontWeight: '600', lineHeight: 18 },

  captionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  captionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.6, textTransform: 'uppercase' },
  editLink: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  captionBody: { fontSize: FontSize.sm, color: Colors.textDark, lineHeight: 22 },
  captionInput: { minHeight: 200, textAlignVertical: 'top' },

  input: {
    backgroundColor: '#fff',
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: FontSize.sm,
    color: Colors.textDark,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  footerCol: { gap: 8 },
  footerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  btnPrimary: { backgroundColor: Colors.primary },
  btnDanger: { backgroundColor: Colors.error },
  btnGhost: { backgroundColor: Colors.bgLight, borderWidth: 1, borderColor: Colors.border },
  btnLabel: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
  errorText: { color: Colors.error, fontSize: FontSize.xs, fontWeight: '600' },
  rejectRow: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },

  schedBox: { backgroundColor: Colors.bgLight, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  schedShown: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: Colors.primarySoft, borderRadius: Radius.sm, alignSelf: 'flex-start' },
  schedShownLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.6, textTransform: 'uppercase' },
  fieldHint: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18 },

  exportBlock: { backgroundColor: Colors.bgLight, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  exportToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  exportToggleLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  exportBody: { padding: Spacing.md, gap: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: '#fff' },
  channelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  channelChip: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.bgLight,
  },
  channelChipActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  channelChipLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textMuted },
  channelChipLabelActive: { color: Colors.primary, fontWeight: '700' },
  exportBlockRow: { gap: 4, paddingVertical: 6, borderTopWidth: 1, borderTopColor: Colors.borderSoft },
  exportBlockLabel: { fontSize: 11, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.6, textTransform: 'uppercase' },
  exportTextRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  exportText: { flex: 1, fontSize: FontSize.sm, color: Colors.textDark, lineHeight: 20 },
  exportLen: { fontSize: 10, color: Colors.textMuted, textAlign: 'right' },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: Radius.sm, backgroundColor: Colors.primarySoft,
  },
  copyBtnLabel: { fontSize: 11, fontWeight: '700', color: Colors.primary },

  boostInfo: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: Colors.primarySoft, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.primary,
  },
  boostTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary, textTransform: 'capitalize' },
  boostMeta: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
});
