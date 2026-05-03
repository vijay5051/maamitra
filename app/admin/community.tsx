/**
 * Admin · Community moderation.
 *
 * Wave 3 rebuild: AdminPage shell, FilterBar tabs (All / Live / Hidden /
 * Pending), card-style post list with bulk-select, SlideOver-based hide
 * modal with preset reasons, ConfirmDialog for deletes, ToolbarButton
 * bulk actions. Real "pending" filter now wired to the runtime config's
 * moderation.requireApproval flag (Wave 2 + 4).
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import {
  AdminPage,
  ConfirmDialog,
  EmptyState,
  FilterBar,
  SlideOver,
  StatCard,
  StatusBadge,
  Toolbar,
  ToolbarButton,
} from '../../components/admin/ui';
import { HIDE_REASON_LABELS, HIDE_REASONS, HideReason, POST_STATUS_COLORS, POST_STATUS_LABELS, PostStatus } from '../../lib/adminEnums';
import { useAuthStore } from '../../store/useAuthStore';
import { useAdminRole } from '../../lib/useAdminRole';
import { can } from '../../lib/admin';
import { bulkApprovePosts, bulkHidePosts } from '../../services/admin';

interface CommunityPost {
  id: string;
  authorUid: string;
  author: string;
  authorEmail?: string;
  text: string;
  topic: string;
  createdAt: string;
  approved: boolean;
  hidden: boolean;
  hiddenReason?: string;
  flaggedPII?: string[];
  flaggedCrisis?: string;
}

type FilterKey = 'all' | 'live' | 'pending' | 'hidden';

function postStatus(p: CommunityPost): PostStatus {
  if (p.hidden) return 'hidden';
  if (!p.approved) return 'pending';
  return 'live';
}

export default function AdminCommunity() {
  const router = useRouter();
  const { user: actor } = useAuthStore();
  const role = useAdminRole();
  const canModerate = can(role, 'moderate_posts');

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [hideTarget, setHideTarget] = useState<CommunityPost | null>(null);
  const [confirm, setConfirm] = useState<null | { title: string; body: string; destructive?: boolean; run: () => Promise<void> }>(null);

  useEffect(() => { void loadPosts(); }, []);

  async function loadPosts() {
    setLoading(true);
    setError(null);
    try {
      const { fetchRecentPosts } = await import('../../services/social');
      const { posts: data } = await fetchRecentPosts(100, undefined, { includeHidden: true });
      setPosts(data.map((p: any) => ({
        id: p.id,
        authorUid: p.authorUid ?? '',
        author: p.authorName ?? '',
        authorEmail: '',
        text: p.text ?? '',
        topic: p.topic ?? '',
        createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt ?? ''),
        approved: p.approved !== false,
        hidden: p.hidden === true,
        hiddenReason: p.hiddenReason ?? '',
        flaggedPII: p.flaggedPII,
        flaggedCrisis: p.flaggedCrisis,
      })));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkApprove() {
    if (!actor || !canModerate || selected.size === 0) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selected).map((id) => ({ id, collection: 'communityPosts' as const }));
      await bulkApprovePosts(actor, ids);
      setPosts((prev) => prev.map((p) => selected.has(p.id) ? { ...p, approved: true, hidden: false } : p));
      setSelected(new Set());
    } finally { setBulkBusy(false); }
  }

  async function handleBulkHide() {
    if (!actor || !canModerate || selected.size === 0) return;
    setConfirm({
      title: `Hide ${selected.size} post${selected.size === 1 ? '' : 's'}?`,
      body: 'They will be removed from the public feed but kept on file. Authors are notified.',
      run: async () => {
        setBulkBusy(true);
        try {
          const ids = Array.from(selected).map((id) => ({ id, collection: 'communityPosts' as const }));
          await bulkHidePosts(actor, ids, 'Bulk moderation');
          setPosts((prev) => prev.map((p) => selected.has(p.id) ? { ...p, hidden: true, hiddenReason: 'Bulk moderation' } : p));
          setSelected(new Set());
        } finally { setBulkBusy(false); }
      },
    });
  }

  async function handleApprove(post: CommunityPost) {
    try {
      const { approveCommunityPost } = await import('../../services/firebase');
      await approveCommunityPost(post.id);
      setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, approved: true } : p));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  async function handleUnhide(post: CommunityPost) {
    try {
      const { unhidePost } = await import('../../services/social');
      await unhidePost(post.id);
      setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, hidden: false, hiddenReason: '' } : p));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  function askDelete(post: CommunityPost) {
    setConfirm({
      title: 'Delete this post?',
      body: `By ${post.author}: "${post.text.slice(0, 120)}${post.text.length > 120 ? '…' : ''}". This is permanent and cascades to comments.`,
      destructive: true,
      run: async () => {
        try {
          const { deletePost } = await import('../../services/social');
          await deletePost(post.id);
          setPosts((prev) => prev.filter((p) => p.id !== post.id));
        } catch (e: any) {
          setError(e?.message ?? String(e));
        }
      },
    });
  }

  async function handleClearDemo() {
    setConfirm({
      title: 'Clear demo posts?',
      body: 'Deletes every community post written by seeded users (priya/ananya/deepika/meena/etc. @demo.maamitra.app). Real user posts are not touched.',
      destructive: true,
      run: async () => {
        try {
          const { getDocs, collection } = await import('firebase/firestore');
          const { db } = await import('../../services/firebase');
          if (!db) throw new Error('Firestore not configured');
          const usersSnap = await getDocs(collection(db, 'users'));
          const demoUids = usersSnap.docs
            .filter((d) => {
              const email = (d.data() as any).email ?? '';
              return typeof email === 'string' && email.endsWith('@demo.maamitra.app');
            })
            .map((d) => d.id);
          if (demoUids.length === 0) {
            setError('No demo users with @demo.maamitra.app emails found.');
            return;
          }
          const { deletePostsByAuthorUids } = await import('../../services/social');
          const { deleted } = await deletePostsByAuthorUids(demoUids);
          setPosts((prev) => prev.filter((p) => !demoUids.includes(p.authorUid)));
          setError(`Deleted ${deleted} demo posts.`);
        } catch (e: any) {
          setError(e?.message ?? String(e));
        }
      },
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (filter === 'live' && !(p.approved && !p.hidden)) return false;
      if (filter === 'hidden' && !p.hidden) return false;
      if (filter === 'pending' && p.approved) return false;
      if (!q) return true;
      return (
        p.text.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        p.topic.toLowerCase().includes(q)
      );
    });
  }, [posts, search, filter]);

  const counts = useMemo(() => ({
    all: posts.length,
    live: posts.filter((p) => p.approved && !p.hidden).length,
    pending: posts.filter((p) => !p.approved).length,
    hidden: posts.filter((p) => p.hidden).length,
    flaggedPII: posts.filter((p) => p.flaggedPII && p.flaggedPII.length > 0).length,
    flaggedCrisis: posts.filter((p) => p.flaggedCrisis).length,
  }), [posts]);

  const filterChips = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'live', label: 'Live', count: counts.live },
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'hidden', label: 'Hidden', count: counts.hidden },
  ];

  return (
    <>
      <Stack.Screen options={{ title: 'Community' }} />
      <AdminPage
        title="Community moderation"
        description="Approve, hide, or remove posts. Bulk-select to act on many at once. The pending filter lights up when moderation.requireApproval is on."
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Community' }]}
        headerActions={
          <>
            <ToolbarButton label="Refresh" icon="refresh" onPress={loadPosts} />
            {canModerate && selected.size > 0 ? (
              <>
                <ToolbarButton
                  label={`Approve ${selected.size}`}
                  icon="checkmark"
                  variant="primary"
                  onPress={handleBulkApprove}
                  disabled={bulkBusy}
                />
                <ToolbarButton
                  label={`Hide ${selected.size}`}
                  icon="eye-off-outline"
                  variant="danger"
                  onPress={handleBulkHide}
                  disabled={bulkBusy}
                />
              </>
            ) : null}
            {canModerate ? (
              <ToolbarButton
                label="Clear demo"
                icon="sparkles-outline"
                variant="ghost"
                onPress={handleClearDemo}
              />
            ) : null}
          </>
        }
        toolbar={
          <View style={{ gap: 10 }}>
            <Toolbar
              search={{
                value: search,
                onChange: setSearch,
                placeholder: 'Search post text, author, topic…',
              }}
              leading={<Text style={styles.countText}>{filtered.length} of {posts.length}</Text>}
            />
            <FilterBar chips={filterChips} active={filter} onChange={(k) => setFilter(k as FilterKey)} />
          </View>
        }
        error={error}
      >
        <View style={styles.statsRow}>
          <StatCard label="Live"           value={counts.live}          icon="globe-outline" />
          <StatCard label="Pending"        value={counts.pending}       icon="time-outline" deltaPositive="down" />
          <StatCard label="Hidden"         value={counts.hidden}        icon="eye-off-outline" deltaPositive="down" />
          <StatCard label="PII flagged"    value={counts.flaggedPII}    icon="warning-outline" />
          <StatCard label="Crisis flagged" value={counts.flaggedCrisis} icon="shield-checkmark-outline" onPress={() => router.push('/admin/safety')} />
        </View>

        {loading ? (
          <EmptyState kind="loading" title="Loading posts…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            kind="empty"
            title={
              filter === 'pending' ? 'Nothing pending'
              : filter === 'hidden' ? 'No hidden posts'
              : filter === 'live' ? 'No live posts'
              : 'No posts'
            }
            body={
              filter === 'pending' ? 'When moderation.requireApproval is on, new posts wait here.'
              : filter === 'hidden' ? 'Posts you hide will show up here so you can review or unhide them.'
              : 'Try a different filter.'
            }
          />
        ) : (
          <View style={{ gap: Spacing.md }}>
            {filtered.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                selected={selected.has(post.id)}
                canModerate={canModerate}
                onToggleSelect={() => toggleSelect(post.id)}
                onApprove={() => handleApprove(post)}
                onHide={() => setHideTarget(post)}
                onUnhide={() => handleUnhide(post)}
                onDelete={() => askDelete(post)}
                onOpenAuthor={() => router.push(`/admin/users/${post.authorUid}` as any)}
              />
            ))}
          </View>
        )}
      </AdminPage>

      <HideReasonDrawer
        post={hideTarget}
        onClose={() => setHideTarget(null)}
        onSubmit={async (reason) => {
          if (!hideTarget) return;
          try {
            const { hidePost } = await import('../../services/social');
            const { useProfileStore } = await import('../../store/useProfileStore');
            const profile = useProfileStore.getState();
            if (!actor?.uid) throw new Error('Admin not signed in');
            await hidePost(
              hideTarget.id,
              reason,
              { uid: actor.uid, name: actor.name || profile.motherName || 'Moderator', photoUrl: profile.photoUrl || undefined },
              hideTarget.authorUid,
              hideTarget.text,
            );
            setPosts((prev) => prev.map((p) => p.id === hideTarget.id ? { ...p, hidden: true, hiddenReason: reason } : p));
            setHideTarget(null);
          } catch (e: any) {
            setError(e?.message ?? String(e));
          }
        }}
      />

      <ConfirmDialog
        visible={!!confirm}
        title={confirm?.title ?? ''}
        body={confirm?.body}
        destructive={confirm?.destructive}
        confirmLabel="Confirm"
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const c = confirm;
          setConfirm(null);
          if (c) await c.run();
        }}
      />
    </>
  );
}

// ─── Post card ────────────────────────────────────────────────────────────
function PostCard({ post, selected, canModerate, onToggleSelect, onApprove, onHide, onUnhide, onDelete, onOpenAuthor }: {
  post: CommunityPost;
  selected: boolean;
  canModerate: boolean;
  onToggleSelect: () => void;
  onApprove: () => void;
  onHide: () => void;
  onUnhide: () => void;
  onDelete: () => void;
  onOpenAuthor: () => void;
}) {
  const status = postStatus(post);
  const date = post.createdAt
    ? new Date(post.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <View style={[styles.card, selected && styles.cardSelected]}>
      <View style={styles.cardHeader}>
        {canModerate ? (
          <Pressable style={styles.checkBox} onPress={onToggleSelect} hitSlop={6}>
            <View style={[styles.checkbox, selected && styles.checkboxOn]}>
              {selected ? <Ionicons name="checkmark" size={12} color={Colors.white} /> : null}
            </View>
          </Pressable>
        ) : null}
        <Pressable onPress={onOpenAuthor} style={{ flex: 1 }}>
          <Text style={styles.author} numberOfLines={1}>{post.author || 'Unknown'}</Text>
          <Text style={styles.headerMeta} numberOfLines={1}>
            {post.topic ? `${post.topic} · ` : ''}{date}
          </Text>
        </Pressable>
        <View style={styles.headerBadges}>
          <StatusBadge label={POST_STATUS_LABELS[status]} color={POST_STATUS_COLORS[status]} />
          {post.flaggedPII && post.flaggedPII.length > 0 ? (
            <StatusBadge label={`PII: ${post.flaggedPII.join(', ')}`} color={Colors.warning} variant="outline" />
          ) : null}
          {post.flaggedCrisis ? (
            <StatusBadge label={`Crisis ${post.flaggedCrisis}`} color={Colors.error} variant="solid" />
          ) : null}
        </View>
      </View>

      <Text style={styles.body}>{post.text}</Text>

      {post.hidden && post.hiddenReason ? (
        <View style={styles.hiddenReason}>
          <Ionicons name="eye-off-outline" size={12} color={Colors.textLight} />
          <Text style={styles.hiddenReasonText}>{post.hiddenReason}</Text>
        </View>
      ) : null}

      {canModerate ? (
        <View style={styles.cardActions}>
          {!post.approved ? (
            <ToolbarButton label="Approve" icon="checkmark" variant="primary" onPress={onApprove} />
          ) : null}
          {!post.hidden ? (
            <ToolbarButton label="Hide" icon="eye-off-outline" variant="secondary" onPress={onHide} />
          ) : (
            <ToolbarButton label="Unhide" icon="eye-outline" variant="secondary" onPress={onUnhide} />
          )}
          <ToolbarButton label="Delete" icon="trash-outline" variant="danger" onPress={onDelete} />
        </View>
      ) : null}
    </View>
  );
}

// ─── Hide-reason drawer ───────────────────────────────────────────────────
function HideReasonDrawer({ post, onClose, onSubmit }: {
  post: CommunityPost | null;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [preset, setPreset] = useState<HideReason>('spam');
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!post) return;
    setPreset('spam');
    setExtra('');
    setBusy(false);
  }, [post]);

  async function submit() {
    const reason = extra.trim()
      ? `${HIDE_REASON_LABELS[preset]}. ${extra.trim()}`
      : HIDE_REASON_LABELS[preset];
    setBusy(true);
    try { await onSubmit(reason); }
    finally { setBusy(false); }
  }

  return (
    <SlideOver
      visible={!!post}
      title="Hide post"
      subtitle={post ? `By ${post.author}` : undefined}
      onClose={onClose}
      footer={
        <>
          <ToolbarButton label="Cancel" variant="ghost" onPress={onClose} disabled={busy} />
          <ToolbarButton label={busy ? 'Hiding…' : 'Hide post'} icon="eye-off-outline" variant="danger" onPress={submit} disabled={busy} />
        </>
      }
    >
      {post ? (
        <>
          <Text style={styles.drawerLabel}>Excerpt</Text>
          <View style={styles.excerpt}>
            <Text style={styles.excerptText} numberOfLines={5}>{post.text}</Text>
          </View>
          <Text style={[styles.drawerLabel, { marginTop: Spacing.lg }]}>Community guideline breached</Text>
          <ScrollView style={{ maxHeight: 280 }}>
            {HIDE_REASONS.map((r) => (
              <Pressable
                key={r}
                onPress={() => setPreset(r)}
                style={[styles.reasonRow, preset === r && styles.reasonRowActive]}
              >
                <Ionicons
                  name={preset === r ? 'radio-button-on' : 'radio-button-off'}
                  size={16}
                  color={preset === r ? Colors.primary : Colors.textMuted}
                />
                <Text style={[styles.reasonText, preset === r && styles.reasonTextActive]}>
                  {HIDE_REASON_LABELS[r]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={[styles.drawerLabel, { marginTop: Spacing.lg }]}>Additional note (optional)</Text>
          <TextInput
            style={styles.noteInput}
            value={extra}
            onChangeText={setExtra}
            multiline
            placeholder="Anything else the author should know…"
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.helperText}>
            The author will receive a notification with the reason. The post is hidden from the public feed but kept on file.
          </Text>
        </>
      ) : null}
    </SlideOver>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  countText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.4 },

  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.borderSoft,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  cardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },

  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  checkBox: { paddingTop: 2 },
  checkbox: {
    width: 18, height: 18, borderRadius: 5,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.cardBg,
  },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  author: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  headerMeta: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },
  headerBadges: { flexDirection: 'column', alignItems: 'flex-end', gap: 4 },

  body: { fontSize: FontSize.sm, color: Colors.textDark, lineHeight: 20 },

  hiddenReason: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.sm,
    alignSelf: 'flex-start',
  },
  hiddenReasonText: { fontSize: FontSize.xs, color: Colors.textLight, fontStyle: 'italic' },

  cardActions: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },

  drawerLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.5, textTransform: 'uppercase' },
  excerpt: {
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: 6,
  },
  excerptText: { fontSize: FontSize.sm, color: Colors.textDark, lineHeight: 19, fontStyle: 'italic' },
  reasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 10, paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
  },
  reasonRowActive: { backgroundColor: Colors.primarySoft },
  reasonText: { fontSize: FontSize.sm, color: Colors.textDark },
  reasonTextActive: { fontWeight: '700', color: Colors.primary },
  noteInput: {
    marginTop: 6,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: FontSize.sm, color: Colors.textDark,
    backgroundColor: Colors.bgLight,
    minHeight: 72, textAlignVertical: 'top',
  },
  helperText: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.sm, lineHeight: 17 },
});
