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

import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
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
  deleteDraft,
  fetchDraft,
  generateMarketingDraft,
  rejectDraft,
  subscribeDrafts,
  updateDraftCaption,
} from '../../../services/marketingDrafts';
import { DraftStatus, MarketingDraft } from '../../../lib/marketingTypes';
import { useAuthStore } from '../../../store/useAuthStore';

const STATUS_FILTERS: { value: DraftStatus | 'all'; label: string }[] = [
  { value: 'all',            label: 'All' },
  { value: 'pending_review', label: 'Pending review' },
  { value: 'approved',       label: 'Approved' },
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
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<DraftStatus | 'all'>('pending_review');
  const [drafts, setDrafts] = useState<MarketingDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

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

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    try {
      const res = await generateMarketingDraft({});
      if (!res.ok) throw new Error(`${res.code}: ${res.message}`);
      // Snapshot will surface it; jump straight into review.
      setOpenId(res.draftId);
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
          <ToolbarButton
            label={generating ? 'Generating…' : 'Generate now'}
            icon="sparkles"
            variant="primary"
            onPress={handleGenerate}
            disabled={generating}
          />
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

  useEffect(() => {
    setEditingCaption(false);
    setCaptionDraft(draft?.caption ?? '');
    setActionError(null);
    setRejectingReason(null);
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
    } catch (e: any) {
      setActionError(`${label} failed: ${e?.message ?? String(e)}`);
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
      if (!res.ok) throw new Error(`${res.code}: ${res.message}`);
    } catch (e: any) {
      setActionError(`Regenerate failed: ${e?.message ?? String(e)}`);
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
                  <Pressable onPress={copyCaption} style={[styles.btn, styles.btnPrimary]}>
                    <Ionicons name="copy" size={16} color="#fff" />
                    <Text style={styles.btnLabel}>Copy caption</Text>
                  </Pressable>
                  <Pressable onPress={downloadImage} style={[styles.btn, styles.btnGhost]}>
                    <Ionicons name="download" size={16} color={Colors.primary} />
                    <Text style={[styles.btnLabel, { color: Colors.primary }]}>Download image</Text>
                  </Pressable>
                </>
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
          {thumb ? (
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

  previewWrap: { aspectRatio: 1, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Colors.bgLight },
  preview: { width: '100%', height: '100%' },
  metaCard: { padding: Spacing.sm, backgroundColor: Colors.bgLight, borderRadius: Radius.md },
  metaInline: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },
  metaText: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18, marginTop: 4 },

  flagBox: { backgroundColor: '#FFF4F4', borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: '#F8C8CB', gap: 4 },
  flagTitle: { fontWeight: '700', color: Colors.error, fontSize: FontSize.sm },
  flagText: { fontSize: FontSize.xs, color: Colors.error, fontWeight: '600' },
  flagHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4, fontStyle: 'italic' },

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
});
