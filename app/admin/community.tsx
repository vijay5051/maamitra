import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../../constants/theme';

// Cross-platform confirm. RN's Alert.alert renders on web but its
// destructive-style buttons silently fail to fire onPress (known
// react-native-web limitation). On web we use window.confirm which is
// reliable; on native we keep Alert.alert.
function confirmAction(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(
      typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`),
    );
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

// ─── Types ───────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'pending' | 'approved';

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
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ approved }: { approved: boolean }) {
  return (
    <View style={[styles.badge, approved ? styles.badgeApproved : styles.badgePending]}>
      <View style={[styles.badgeDot, approved ? styles.badgeDotApproved : styles.badgeDotPending]} />
      <Text style={[styles.badgeText, approved ? styles.badgeTextApproved : styles.badgeTextPending]}>
        {approved ? 'Approved' : 'Pending'}
      </Text>
    </View>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({
  post,
  onApprove,
  onDelete,
  onHide,
  onUnhide,
}: {
  post: CommunityPost;
  onApprove: () => void;
  onDelete: () => void;
  onHide: () => void;
  onUnhide: () => void;
}) {
  const dateStr = post.createdAt
    ? new Date(post.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  return (
    <View style={styles.postCard}>
      {/* Header */}
      <View style={styles.postHeader}>
        <View style={styles.postAuthorBlock}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{post.author?.charAt(0)?.toUpperCase() ?? 'U'}</Text>
          </View>
          <View>
            <Text style={styles.postAuthor}>{post.author}</Text>
            {post.authorEmail ? (
              <Text style={styles.postAuthorEmail}>{post.authorEmail}</Text>
            ) : null}
          </View>
        </View>
        <StatusBadge approved={post.approved} />
      </View>

      {/* Text */}
      <Text style={styles.postText} numberOfLines={3}>
        {post.text}
      </Text>

      {/* Meta */}
      <View style={styles.postMeta}>
        <View style={styles.topicChip}>
          <Text style={styles.topicText}>{post.topic}</Text>
        </View>
        <Text style={styles.postDate}>{dateStr}</Text>
      </View>

      {/* Actions */}
      <View style={styles.postActions}>
        {!post.approved && (
          <TouchableOpacity style={styles.approveBtn} onPress={onApprove} activeOpacity={0.8}>
            <Ionicons name="checkmark" size={14} color="#fff" />
            <Text style={styles.approveBtnText}>Approve</Text>
          </TouchableOpacity>
        )}
        {post.approved && !post.hidden && (
          <View style={styles.approvedTag}>
            <Ionicons name="checkmark-circle" size={14} color="#10b981" />
            <Text style={styles.approvedTagText}>Live</Text>
          </View>
        )}
        {post.hidden ? (
          <TouchableOpacity style={styles.editBtn} onPress={onUnhide} activeOpacity={0.8}>
            <Ionicons name="eye-outline" size={14} color="#8b5cf6" />
            <Text style={styles.editBtnText}>Unhide</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.editBtn} onPress={onHide} activeOpacity={0.8}>
            <Ionicons name="eye-off-outline" size={14} color="#8b5cf6" />
            <Text style={styles.editBtnText}>Hide</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.8}>
          <Ionicons name="trash" size={14} color="#fff" />
          <Text style={styles.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
      {post.hidden && post.hiddenReason ? (
        <View style={styles.hiddenBanner}>
          <Ionicons name="shield-outline" size={12} color="#92400e" />
          <Text style={styles.hiddenBannerText} numberOfLines={2}>
            Hidden — {post.hiddenReason}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Hide Post Modal ─────────────────────────────────────────────────────────
// Admins cannot rewrite a user's words (privacy). Instead, they can hide
// off-topic / spammy posts and tell the author which community guideline was
// breached.

const HIDE_REASONS = [
  'Spam or repetitive promotion',
  'Off-topic or unrelated to parenting',
  'Disrespectful or hurtful language',
  'Misinformation about health or medical advice',
  'Personal information or contact details shared',
  'Other (see message)',
];

function HidePostModal({
  post,
  visible,
  onClose,
  onConfirm,
}: {
  post: CommunityPost | null;
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [preset, setPreset] = useState<string>(HIDE_REASONS[0]);
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPreset(HIDE_REASONS[0]);
    setExtra('');
    setBusy(false);
  }, [visible]);

  async function handleConfirm() {
    const reason = extra.trim()
      ? `${preset}. ${extra.trim()}`
      : preset;
    setBusy(true);
    try {
      await onConfirm(reason);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={editStyles.header}>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }} disabled={busy}>
            <Ionicons name="close" size={22} color="#6b7280" />
          </TouchableOpacity>
          <Text style={editStyles.title}>Hide Post</Text>
          <TouchableOpacity
            style={[editStyles.saveBtn, busy && { opacity: 0.4 }]}
            onPress={handleConfirm}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={editStyles.saveBtnText}>Hide</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={editStyles.body} keyboardShouldPersistTaps="handled">
          <Text style={editStyles.label}>Author</Text>
          <Text style={[editStyles.input, { paddingVertical: 10 }]} numberOfLines={1}>
            {post?.author ?? ''}
          </Text>
          <Text style={editStyles.label}>Post excerpt</Text>
          <Text style={[editStyles.input, editStyles.textArea]} numberOfLines={4}>
            {post?.text ?? ''}
          </Text>
          <Text style={editStyles.label}>Community guideline breached</Text>
          {HIDE_REASONS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[editStyles.reasonRow, r === preset && editStyles.reasonRowActive]}
              onPress={() => setPreset(r)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={r === preset ? 'radio-button-on' : 'radio-button-off'}
                size={16}
                color={r === preset ? Colors.primary : '#9ca3af'}
              />
              <Text style={[editStyles.reasonText, r === preset && editStyles.reasonTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
          <Text style={editStyles.label}>Additional note (optional)</Text>
          <TextInput
            style={[editStyles.input, editStyles.textArea]}
            value={extra}
            onChangeText={setExtra}
            multiline
            placeholder="Anything else the author should know…"
            placeholderTextColor="#9ca3af"
          />
          <Text style={editStyles.helper}>
            The author will receive a notification with the reason. The post is hidden from
            the public feed but kept on file.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const editStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fff' },
  title: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  saveBtn: { backgroundColor: '#8b5cf6', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  body: { padding: 16 },
  label: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#f9fafb', borderRadius: 10, padding: 12, fontSize: 14, color: '#1a1a2e', borderWidth: 1, borderColor: '#e5e7eb' },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  chip: { marginRight: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f3f4f6' },
  chipActive: { backgroundColor: '#ede9fe', borderWidth: 1, borderColor: '#8b5cf6' },
  chipText: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  chipTextActive: { color: Colors.primary, fontWeight: '700' },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb', marginBottom: 8 },
  reasonRowActive: { borderColor: Colors.primary, backgroundColor: '#F5F0FF' },
  reasonText: { flex: 1, fontSize: 14, color: '#1a1a2e' },
  reasonTextActive: { color: Colors.primary, fontWeight: '700' },
  helper: { fontSize: 12, color: '#6b7280', marginTop: 12, lineHeight: 17 },
});

// ─── Filter Tab ───────────────────────────────────────────────────────────────

function FilterTabBtn({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.filterTab, active && styles.filterTabActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>{label}</Text>
      <View style={[styles.filterCount, active && styles.filterCountActive]}>
        <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>{count}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminCommunity() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hidingPost, setHidingPost] = useState<CommunityPost | null>(null);
  const [hideModalVisible, setHideModalVisible] = useState(false);

  useEffect(() => {
    loadPosts();
  }, []);

  async function loadPosts(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      // Use the ACTIVE communityPosts collection (social.ts), NOT the legacy community_posts
      const { fetchRecentPosts } = await import('../../services/social');
      // Admin queue includes hidden posts so we can review / unhide them.
      const { posts: data } = await fetchRecentPosts(100, undefined, { includeHidden: true });
      setPosts(data.map((p: any) => ({
        id: p.id,
        authorUid: p.authorUid ?? '',
        author: p.authorName ?? '',
        authorEmail: '',
        text: p.text ?? '',
        topic: p.topic ?? '',
        createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt ?? ''),
        approved: true, // All posts in communityPosts are approved at write time
        hidden: p.hidden === true,
        hiddenReason: p.hiddenReason ?? '',
      })));
    } catch (err) {
      console.error('admin loadPosts failed:', err);
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleApprove(post: CommunityPost) {
    try {
      const { approveCommunityPost } = await import('../../services/firebase');
      await approveCommunityPost(post.id);
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, approved: true } : p)));
    } catch (err: any) {
      Alert.alert('Approve failed', err?.message ?? String(err));
    }
  }

  function openHideModal(post: CommunityPost) {
    setHidingPost(post);
    setHideModalVisible(true);
  }

  async function handleHideConfirm(reason: string) {
    if (!hidingPost) return;
    try {
      const { hidePost } = await import('../../services/social');
      const { useAuthStore } = await import('../../store/useAuthStore');
      const { useProfileStore } = await import('../../store/useProfileStore');
      const auth = useAuthStore.getState();
      const profile = useProfileStore.getState();
      if (!auth.user?.uid) throw new Error('Admin not signed in');
      await hidePost(
        hidingPost.id,
        reason,
        { uid: auth.user.uid, name: auth.user.name || profile.motherName || 'Moderator', photoUrl: profile.photoUrl || undefined },
        hidingPost.authorUid,
        hidingPost.text,
      );
      setPosts((prev) => prev.map((p) =>
        p.id === hidingPost.id ? { ...p, hidden: true, hiddenReason: reason } : p,
      ));
      setHideModalVisible(false);
      setHidingPost(null);
    } catch (err: any) {
      Alert.alert('Hide failed', err?.message ?? String(err));
    }
  }

  async function handleUnhide(post: CommunityPost) {
    try {
      const { unhidePost } = await import('../../services/social');
      await unhidePost(post.id);
      setPosts((prev) => prev.map((p) =>
        p.id === post.id ? { ...p, hidden: false, hiddenReason: '' } : p,
      ));
    } catch (err: any) {
      Alert.alert('Unhide failed', err?.message ?? String(err));
    }
  }

  async function handleDelete(post: CommunityPost) {
    const ok = await confirmAction(
      'Delete Post',
      `Delete this post by "${post.author}"?\n\n"${post.text.slice(0, 80)}..."`,
    );
    if (!ok) return;
    try {
      const { deletePost } = await import('../../services/social');
      await deletePost(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch (err: any) {
      const code = err?.code ? `${err.code}\n\n` : '';
      Alert.alert('Delete failed', `${code}${err?.message ?? String(err)}`);
    }
  }

  async function handleClearDemo() {
    const ok = await confirmAction(
      'Clear demo posts',
      'This deletes every community post written by the seeded demo users (priya/ananya/deepika/meena/etc. @demo.maamitra.app). Real user posts are not touched. Continue?',
    );
    if (!ok) return;
    try {
      // Look up seeded user uids by email pattern, then bulk-delete their
      // posts. The seed script writes users with @demo.maamitra.app emails.
      const { getDocs, collection, query, where } = await import('firebase/firestore');
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
        Alert.alert('No demo users found', 'Could not find any users with @demo.maamitra.app emails.');
        return;
      }
      const { deletePostsByAuthorUids } = await import('../../services/social');
      const { deleted, errors } = await deletePostsByAuthorUids(demoUids);
      // Reflect locally
      setPosts((prev) => prev.filter((p) => !demoUids.includes((p as any).authorUid)));
      const errMsg = errors.length > 0 ? `\n\n${errors.length} failed.` : '';
      Alert.alert('Done', `Deleted ${deleted} demo posts.${errMsg}`);
    } catch (err: any) {
      const code = err?.code ? `${err.code}\n\n` : '';
      Alert.alert('Clear demo failed', `${code}${err?.message ?? String(err)}`);
    }
  }

  const totalCount = posts.length;
  const pendingCount = posts.filter((p) => !p.approved).length;
  const approvedCount = posts.filter((p) => p.approved).length;

  const filteredPosts = posts.filter((p) => {
    if (filter === 'pending') return !p.approved;
    if (filter === 'approved') return p.approved;
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        <FilterTabBtn
          label="All"
          count={totalCount}
          active={filter === 'all'}
          onPress={() => setFilter('all')}
        />
        <FilterTabBtn
          label="Pending"
          count={pendingCount}
          active={filter === 'pending'}
          onPress={() => setFilter('pending')}
        />
        <FilterTabBtn
          label="Approved"
          count={approvedCount}
          active={filter === 'approved'}
          onPress={() => setFilter('approved')}
        />
      </View>

      {/* One-shot cleanup for demo seed posts authored by *.@demo.maamitra.app */}
      <TouchableOpacity
        onPress={handleClearDemo}
        style={styles.clearDemoBtn}
        activeOpacity={0.85}
      >
        <Ionicons name="sparkles-outline" size={14} color="#92400e" />
        <Text style={styles.clearDemoBtnText}>Clear demo posts (Priya / Ananya / etc.)</Text>
      </TouchableOpacity>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading posts...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadPosts(true)}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        >
          {filteredPosts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color="#e5e7eb" />
              <Text style={styles.emptyTitle}>No posts here</Text>
              <Text style={styles.emptySubtitle}>
                {filter === 'pending'
                  ? 'All caught up! No posts awaiting approval.'
                  : filter === 'approved'
                  ? 'No approved posts yet.'
                  : 'No community posts found.'}
              </Text>
            </View>
          ) : (
            filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onApprove={() => handleApprove(post)}
                onDelete={() => handleDelete(post)}
                onHide={() => openHideModal(post)}
                onUnhide={() => handleUnhide(post)}
              />
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <HidePostModal
        post={hidingPost}
        visible={hideModalVisible}
        onClose={() => { setHideModalVisible(false); setHidingPost(null); }}
        onConfirm={handleHideConfirm}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },

  filterBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  filterTabActive: { backgroundColor: '#EDE9F6' },
  filterTabText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  filterTabTextActive: { color: Colors.primary },
  filterCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  filterCountActive: { backgroundColor: '#fbcfe8' },
  filterCountText: { fontSize: 11, fontWeight: '700', color: '#6b7280' },
  filterCountTextActive: { color: '#be185d' },

  list: { flex: 1 },
  listContent: { padding: 16, gap: 12 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#9ca3af', fontSize: 14 },

  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e' },
  emptySubtitle: { fontSize: 14, color: '#9ca3af', textAlign: 'center', paddingHorizontal: 30 },

  postCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.05)',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  postAuthorBlock: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EDE9F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  postAuthor: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  postAuthorEmail: { fontSize: 11, color: '#9ca3af' },

  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeApproved: { backgroundColor: '#d1fae5' },
  badgePending: { backgroundColor: '#fef3c7' },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeDotApproved: { backgroundColor: '#10b981' },
  badgeDotPending: { backgroundColor: '#f59e0b' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextApproved: { color: '#065f46' },
  badgeTextPending: { color: '#92400e' },

  postText: { fontSize: 14, color: '#374151', lineHeight: 20, marginBottom: 10 },

  postMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  topicChip: { backgroundColor: '#fdf6ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#f0e6ff' },
  topicText: { fontSize: 11, fontWeight: '600', color: '#8b5cf6' },
  postDate: { fontSize: 11, color: '#9ca3af' },

  postActions: { flexDirection: 'row', gap: 10 },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    paddingVertical: 10,
    borderRadius: 10,
  },
  approveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  approvedTag: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#d1fae5',
    paddingVertical: 10,
    borderRadius: 10,
  },
  approvedTagText: { color: '#065f46', fontSize: 13, fontWeight: '700' },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ef4444',
    paddingVertical: 10,
    borderRadius: 10,
  },
  deleteBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(139,92,246,0.1)', paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)',
  },
  editBtnText: { color: '#8b5cf6', fontSize: 13, fontWeight: '700' },
  hiddenBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A',
  },
  hiddenBannerText: { flex: 1, fontSize: 12, color: '#92400e', fontWeight: '600' },
  clearDemoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A',
    alignSelf: 'flex-start',
  },
  clearDemoBtnText: { fontSize: 12, color: '#92400e', fontWeight: '700' },
});
