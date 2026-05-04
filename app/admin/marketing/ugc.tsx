/**
 * Admin · UGC review queue (M6).
 *
 * Real moms submit photo + story from inside the app; this is where admin
 * reviews them. Approve → call renderUgcAsDraft → a Real Story marketing
 * draft drops into the regular queue, ready to schedule/publish/boost.
 */

import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';
import { AdminPage, EmptyState, SlideOver, StatusBadge, ToolbarButton } from '../../../components/admin/ui';
import {
  approveUgc,
  deleteUgcSubmission,
  rejectUgc,
  renderUgcAsDraft,
  subscribeUgcQueue,
} from '../../../services/marketingUgc';
import { UgcStatus, UgcSubmission } from '../../../lib/marketingTypes';
import { useAuthStore } from '../../../store/useAuthStore';

const STATUS_FILTERS: { value: UgcStatus | 'all'; label: string }[] = [
  { value: 'all',            label: 'All' },
  { value: 'pending_review', label: 'Pending' },
  { value: 'approved',       label: 'Approved' },
  { value: 'rendered',       label: 'Rendered' },
  { value: 'rejected',       label: 'Rejected' },
];

const STATUS_TONES: Record<UgcStatus, string> = {
  pending_review: Colors.warning,
  approved: Colors.primary,
  rendered: Colors.success,
  rejected: Colors.error,
  deleted: Colors.textMuted,
};

export default function MarketingUgcScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<UgcStatus | 'all'>('pending_review');
  const [rows, setRows] = useState<UgcSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeUgcQueue({ limitN: 100 }, (next) => {
      setRows(next);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const counts = useMemo(() => {
    const out: Record<UgcStatus | 'all', number> = {
      all: rows.length,
      pending_review: 0, approved: 0, rendered: 0, rejected: 0, deleted: 0,
    };
    rows.forEach((r) => { out[r.status] += 1; });
    return out;
  }, [rows]);

  const visible = useMemo(() => filter === 'all' ? rows : rows.filter((r) => r.status === filter), [rows, filter]);
  const open = openId ? rows.find((r) => r.id === openId) ?? null : null;

  return (
    <>
      <Stack.Screen options={{ title: 'UGC' }} />
      <AdminPage
        title="Real-mom stories (UGC)"
        description="Submissions from real moms via the app's Share Your Story flow. Approve → render as a Real Story draft → schedule + publish + boost like any other post."
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Marketing', href: '/admin/marketing' },
          { label: 'UGC' },
        ]}
        loading={loading && rows.length === 0}
        error={error}
      >
        <View style={styles.filterBar}>
          {STATUS_FILTERS.map((f) => (
            <Pressable
              key={f.value}
              onPress={() => setFilter(f.value)}
              style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
            >
              <Text style={[styles.filterLabel, filter === f.value && styles.filterLabelActive]}>{f.label}</Text>
              <Text style={[styles.filterCount, filter === f.value && styles.filterCountActive]}>{counts[f.value]}</Text>
            </Pressable>
          ))}
        </View>

        {visible.length === 0 ? (
          <EmptyState
            kind="empty"
            title={filter === 'pending_review' ? 'No pending submissions' : `No ${filter} submissions`}
            body="Stories submitted from inside the app land here. Once a mom uses the Share Your Story flow, you'll see her submission for review."
          />
        ) : (
          <View style={styles.grid}>
            {visible.map((s) => (
              <UgcCard key={s.id} submission={s} onOpen={() => setOpenId(s.id)} />
            ))}
          </View>
        )}
      </AdminPage>

      <UgcSlideOver
        submission={open}
        actor={user ? { uid: user.uid, email: user.email } : null}
        onClose={() => setOpenId(null)}
        onJumpToDraft={(id) => {
          setOpenId(null);
          router.push({ pathname: '/admin/marketing/drafts', params: { open: id } } as any);
        }}
      />
    </>
  );
}

function UgcCard({ submission, onOpen }: { submission: UgcSubmission; onOpen: () => void }) {
  const tone = STATUS_TONES[submission.status];
  return (
    <Pressable onPress={onOpen} style={styles.card}>
      <View style={styles.thumbWrap}>
        {submission.photoUrl ? (
          <Image source={{ uri: submission.photoUrl }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons name="text" size={28} color={Colors.textMuted} />
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardHead}>
          <StatusBadge label={submission.status.replace('_', ' ')} color={tone} />
          {submission.childAge ? <Text style={styles.metaSub}>{submission.childAge}</Text> : null}
        </View>
        <Text style={styles.author} numberOfLines={1}>{submission.displayName}</Text>
        <Text style={styles.preview} numberOfLines={3}>{submission.story}</Text>
      </View>
    </Pressable>
  );
}

function UgcSlideOver({
  submission,
  actor,
  onClose,
  onJumpToDraft,
}: {
  submission: UgcSubmission | null;
  actor: { uid: string; email: string | null | undefined } | null;
  onClose: () => void;
  onJumpToDraft: (draftId: string) => void;
}) {
  const [busy, setBusy] = useState<'approve' | 'reject' | 'render' | 'delete' | null>(null);
  const [paneError, setPaneError] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    setPaneError(null);
    setReason(null);
  }, [submission?.id]);

  if (!submission || !actor) return <SlideOver visible={false} title="" onClose={onClose} />;

  async function handleApprove() {
    if (!submission || !actor) return;
    setBusy('approve');
    setPaneError(null);
    try {
      await approveUgc(actor, submission.id);
    } catch (e: any) {
      setPaneError(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleReject() {
    if (!submission || !actor) return;
    if (reason === null) { setReason(''); return; }
    if (!reason.trim()) { setPaneError('Please give a reason.'); return; }
    setBusy('reject');
    setPaneError(null);
    try {
      await rejectUgc(actor, submission.id, reason.trim());
      onClose();
    } catch (e: any) {
      setPaneError(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleRender() {
    if (!submission) return;
    setBusy('render');
    setPaneError(null);
    try {
      const res = await renderUgcAsDraft({ submissionId: submission.id });
      if (!res.ok) throw new Error(`${res.code}: ${res.message}`);
      onJumpToDraft(res.draftId);
    } catch (e: any) {
      setPaneError(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!submission || !actor) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && !window.confirm('Delete this submission permanently?')) return;
    setBusy('delete');
    setPaneError(null);
    try {
      await deleteUgcSubmission(actor, submission.id, submission.photoStoragePath);
      onClose();
    } catch (e: any) {
      setPaneError(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  const isPending = submission.status === 'pending_review';
  const isApproved = submission.status === 'approved';

  return (
    <SlideOver
      visible={!!submission}
      title={`From ${submission.displayName}`}
      subtitle={submission.childAge ? `Child age: ${submission.childAge}` : undefined}
      onClose={onClose}
      width={620}
      footer={
        <View style={{ gap: 8 }}>
          {paneError ? <Text style={styles.errorText}>{paneError}</Text> : null}
          {reason !== null ? (
            <View style={styles.rejectRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={reason}
                onChangeText={setReason}
                placeholder="Reason (helps the AI tune over time)"
                placeholderTextColor={Colors.textMuted}
                autoFocus
              />
              <Pressable onPress={handleReject} disabled={busy === 'reject'} style={[styles.btn, styles.btnDanger]}>
                <Text style={styles.btnLabel}>{busy === 'reject' ? 'Rejecting…' : 'Confirm reject'}</Text>
              </Pressable>
              <Pressable onPress={() => setReason(null)} style={[styles.btn, styles.btnGhost]}>
                <Text style={[styles.btnLabel, { color: Colors.textMuted }]}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.footerRow}>
              {isPending ? (
                <>
                  <Pressable onPress={handleApprove} disabled={busy === 'approve'} style={[styles.btn, styles.btnPrimary]}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={styles.btnLabel}>{busy === 'approve' ? 'Saving…' : 'Approve'}</Text>
                  </Pressable>
                  <Pressable onPress={() => setReason('')} style={[styles.btn, styles.btnGhost]}>
                    <Ionicons name="close" size={16} color={Colors.error} />
                    <Text style={[styles.btnLabel, { color: Colors.error }]}>Reject</Text>
                  </Pressable>
                </>
              ) : null}
              {isApproved ? (
                <Pressable onPress={handleRender} disabled={busy === 'render'} style={[styles.btn, styles.btnPrimary]}>
                  <Ionicons name="sparkles" size={16} color="#fff" />
                  <Text style={styles.btnLabel}>{busy === 'render' ? 'Rendering…' : 'Render as Real Story draft'}</Text>
                </Pressable>
              ) : null}
              {submission.renderedDraftId ? (
                <Pressable onPress={() => onJumpToDraft(submission.renderedDraftId!)} style={[styles.btn, styles.btnGhost]}>
                  <Ionicons name="open-outline" size={16} color={Colors.primary} />
                  <Text style={[styles.btnLabel, { color: Colors.primary }]}>Open draft</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={handleDelete} disabled={busy === 'delete'} style={[styles.btn, styles.btnGhost]}>
                <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
                <Text style={[styles.btnLabel, { color: Colors.textMuted }]}>Delete</Text>
              </Pressable>
            </View>
          )}
        </View>
      }
    >
      <View style={{ gap: Spacing.md }}>
        {submission.photoUrl ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: submission.photoUrl }} style={styles.previewImg} resizeMode="cover" />
          </View>
        ) : null}

        <View style={styles.metaCard}>
          <StatusBadge label={submission.status.replace('_', ' ')} color={STATUS_TONES[submission.status]} />
          <Text style={styles.metaInline}>uid: {submission.uid.slice(0, 12)}…</Text>
          <Text style={styles.metaInline}>submitted: {new Date(submission.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}</Text>
        </View>

        <View>
          <Text style={styles.label}>Story</Text>
          <Text style={styles.story}>{submission.story}</Text>
        </View>

        {submission.rejectReason ? (
          <View style={styles.rejectBox}>
            <Text style={styles.rejectTitle}>Reject reason</Text>
            <Text style={styles.rejectText}>{submission.rejectReason}</Text>
          </View>
        ) : null}
      </View>
    </SlideOver>
  );
}

const styles = StyleSheet.create({
  filterBar: { flexDirection: 'row', gap: 6, marginBottom: Spacing.md, flexWrap: 'wrap' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgLight,
  },
  filterChipActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  filterLabel: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '600' },
  filterLabelActive: { color: Colors.primary, fontWeight: '700' },
  filterCount: {
    fontSize: 11, color: Colors.textMuted, backgroundColor: Colors.cardBg,
    paddingHorizontal: 6, borderRadius: 999, fontWeight: '700', minWidth: 20, textAlign: 'center',
  },
  filterCountActive: { color: Colors.primary, backgroundColor: '#fff' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  card: {
    flexBasis: '32%', flexGrow: 1, minWidth: 280,
    backgroundColor: Colors.cardBg, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.borderSoft, overflow: 'hidden', ...Shadow.sm,
  },
  thumbWrap: { aspectRatio: 1, backgroundColor: Colors.bgLight },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: Spacing.md, gap: 4 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  author: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  preview: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18 },
  metaSub: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },

  previewWrap: { aspectRatio: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  previewImg: { width: '100%', height: '100%' },
  metaCard: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: Spacing.sm, backgroundColor: Colors.bgLight, borderRadius: Radius.md },
  metaInline: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },

  label: { fontSize: 11, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 },
  story: { fontSize: FontSize.md, color: Colors.textDark, lineHeight: 24 },

  rejectBox: { backgroundColor: '#FFF4F4', padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: '#F8C8CB' },
  rejectTitle: { fontWeight: '700', color: Colors.error, fontSize: FontSize.sm },
  rejectText: { fontSize: FontSize.xs, color: Colors.error, marginTop: 4 },

  rejectRow: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  footerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.md },
  btnPrimary: { backgroundColor: Colors.primary },
  btnDanger: { backgroundColor: Colors.error },
  btnGhost: { backgroundColor: Colors.bgLight, borderWidth: 1, borderColor: Colors.border },
  btnLabel: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
  errorText: { color: Colors.error, fontSize: FontSize.xs, fontWeight: '600' },
  input: {
    backgroundColor: '#fff', borderRadius: Radius.sm,
    paddingHorizontal: 10, paddingVertical: 8,
    fontSize: FontSize.sm, color: Colors.textDark,
    borderWidth: 1, borderColor: Colors.border,
  },
});

