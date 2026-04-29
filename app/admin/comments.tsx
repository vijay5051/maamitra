/**
 * Admin · Comment moderation.
 *
 * Reads recent comments across BOTH active (communityPosts) and legacy
 * (community_posts) post collections via collectionGroup('comments').
 * Lets the admin filter, search, and delete inline.
 *
 * Why a separate screen from /admin/community: comments are ~10× higher
 * volume than posts and need their own scan view. The post-detail surface
 * still exists for context (we link out via "View post →").
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
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
import { AdminComment, deleteComment, listRecentComments } from '../../services/admin';
import { confirmAction, infoAlert } from '../../lib/cross-platform-alerts';

export default function CommentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: actor } = useAuthStore();
  const role = useAdminRole();

  const [comments, setComments] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setComments(await listRecentComments(150));
    setLoading(false);
  }

  async function refresh() {
    setRefreshing(true);
    setComments(await listRecentComments(150));
    setRefreshing(false);
  }

  async function handleDelete(c: AdminComment) {
    if (!actor) return;
    if (!can(role, 'moderate_comments')) {
      infoAlert('Not allowed', 'Your role does not include comment moderation.');
      return;
    }
    const ok = await confirmAction(
      'Delete comment',
      `Delete this comment by ${c.author}?\n\n"${c.text.slice(0, 120)}${c.text.length > 120 ? '…' : ''}"`,
      { confirmLabel: 'Delete' },
    );
    if (!ok) return;
    setActing(c.id);
    try {
      await deleteComment(actor, c.id, c.postId, c.postCollection);
      setComments((prev) => prev.filter((x) => x.id !== c.id));
    } catch (e: any) {
      infoAlert('Failed', e?.message ?? 'Could not delete comment.');
    } finally {
      setActing(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return comments;
    return comments.filter((c) =>
      c.text.toLowerCase().includes(q) ||
      c.author.toLowerCase().includes(q),
    );
  }, [comments, search]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />}
    >
      <LinearGradient colors={['#F5F0FF', '#EDE4FF']} style={styles.headerCard}>
        <Text style={styles.headerEyebrow}>Admin · Community</Text>
        <Text style={styles.headerTitle}>Comments</Text>
        <Text style={styles.headerSub}>{comments.length} most recent comments across all posts.</Text>
      </LinearGradient>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search comment text or author…"
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 30 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubble-outline" size={36} color="#D1D5DB" />
          <Text style={styles.emptyText}>{search ? 'No comments match' : 'No comments to moderate.'}</Text>
        </View>
      ) : (
        filtered.map((c) => (
          <View key={c.id} style={styles.commentCard}>
            <View style={styles.commentHead}>
              <Text style={styles.commentAuthor} numberOfLines={1}>{c.author}</Text>
              <Text style={styles.commentDate}>
                {c.createdAt ? new Date(c.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
              </Text>
            </View>
            <Text style={styles.commentText}>{c.text}</Text>
            <View style={styles.commentFoot}>
              <Pressable onPress={() => c.authorUid && router.push(`/admin/users/${c.authorUid}` as any)}>
                <Text style={styles.commentLink}>Open author profile →</Text>
              </Pressable>
              <View style={{ flex: 1 }} />
              {can(role, 'moderate_comments') && (
                <TouchableOpacity
                  style={[styles.deleteBtn, acting === c.id && { opacity: 0.5 }]}
                  disabled={acting === c.id}
                  onPress={() => handleDelete(c)}
                >
                  <Ionicons name="trash-outline" size={13} color="#ef4444" />
                  <Text style={styles.deleteBtnText}>{acting === c.id ? 'Deleting…' : 'Delete'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFB' },
  content: { padding: 16, gap: 12 },

  headerCard: { borderRadius: 16, padding: 16 },
  headerEyebrow: { fontSize: 11, fontWeight: '800', color: Colors.primary, letterSpacing: 1.2, textTransform: 'uppercase' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1a1a2e', marginTop: 2 },
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 4 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  searchInput: { flex: 1, fontSize: 13, color: '#1a1a2e' },

  empty: { alignItems: 'center', padding: 30, gap: 8 },
  emptyText: { fontSize: 13, color: '#9CA3AF' },

  commentCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#F0EDF5', gap: 6,
  },
  commentHead: { flexDirection: 'row', alignItems: 'center' },
  commentAuthor: { flex: 1, fontSize: 13, fontWeight: '800', color: '#1a1a2e' },
  commentDate: { fontSize: 11, color: '#9CA3AF' },
  commentText: { fontSize: 13, color: '#374151', lineHeight: 19 },
  commentFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  commentLink: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  deleteBtnText: { fontSize: 11, fontWeight: '700', color: '#ef4444' },
});
