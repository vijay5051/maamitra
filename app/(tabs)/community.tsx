import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCommunityStore, Post, CommunityFilter } from '../../store/useCommunityStore';
import { useProfileStore } from '../../store/useProfileStore';
import GradientAvatar from '../../components/ui/GradientAvatar';
import TagPill from '../../components/ui/TagPill';

const FILTERS: CommunityFilter[] = ['All', 'Newborn', 'Pregnancy', 'Nutrition', 'Mental Health', 'Milestones', 'Products'];
const TOPICS = ['Newborn', 'Pregnancy', 'Nutrition', 'Mental Health', 'Milestones', 'Products', 'General'];

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({
  post,
  currentUserName,
  onReact,
  onToggleComments,
  onAddComment,
}: {
  post: Post;
  currentUserName: string;
  onReact: (postId: string, emoji: string) => void;
  onToggleComments: (postId: string) => void;
  onAddComment: (postId: string, authorName: string, text: string) => void;
}) {
  const [commentText, setCommentText] = useState('');

  function timeAgo(date: Date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  const handleSendComment = () => {
    const trimmed = commentText.trim();
    if (!trimmed) return;
    onAddComment(post.id, currentUserName || 'Anonymous', trimmed);
    setCommentText('');
  };

  return (
    <View style={postStyles.card}>
      {/* Author row */}
      <View style={postStyles.authorRow}>
        <GradientAvatar name={post.authorInitial} size={40} />
        <View style={postStyles.authorInfo}>
          <Text style={postStyles.authorName}>{post.authorName}</Text>
          <Text style={postStyles.authorBadge}>{post.badge}</Text>
        </View>
        <View style={postStyles.rightMeta}>
          <TagPill label={post.topic} color="#8b5cf6" />
          <Text style={postStyles.time}>{timeAgo(post.createdAt)}</Text>
        </View>
      </View>

      {/* Post text */}
      <Text style={postStyles.text}>{post.text}</Text>

      {/* Reactions */}
      <View style={postStyles.reactionsRow}>
        {['❤️', '💜', '😊', '💪', '🙏', '🤱'].map((emoji) => {
          const count = post.reactions[emoji] ?? 0;
          const reacted = post.userReactions.includes(emoji);
          return (
            <TouchableOpacity
              key={emoji}
              style={[postStyles.reactionBtn, reacted && postStyles.reactionBtnActive]}
              onPress={() => onReact(post.id, emoji)}
              activeOpacity={0.75}
            >
              <Text style={postStyles.reactionEmoji}>{emoji}</Text>
              {count > 0 && (
                <Text style={[postStyles.reactionCount, reacted && postStyles.reactionCountActive]}>
                  {count}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={postStyles.commentsBtn}
          onPress={() => onToggleComments(post.id)}
          activeOpacity={0.75}
        >
          <Ionicons name="chatbubble-outline" size={14} color="#9ca3af" />
          <Text style={postStyles.commentsBtnText}>{post.comments.length}</Text>
        </TouchableOpacity>
      </View>

      {/* Comments */}
      {post.showComments && (
        <View style={postStyles.commentsSection}>
          {post.comments.map((c) => (
            <View key={c.id} style={postStyles.commentRow}>
              <GradientAvatar name={c.authorInitial} size={28} />
              <View style={postStyles.commentBubble}>
                <Text style={postStyles.commentAuthor}>{c.authorName}</Text>
                <Text style={postStyles.commentText}>{c.text}</Text>
              </View>
            </View>
          ))}

          {/* Comment input */}
          <View style={postStyles.commentInput}>
            <TextInput
              style={postStyles.commentTextInput}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment..."
              placeholderTextColor="#9ca3af"
              returnKeyType="send"
              onSubmitEditing={handleSendComment}
            />
            <TouchableOpacity onPress={handleSendComment} disabled={!commentText.trim()}>
              <Ionicons
                name="paper-plane"
                size={18}
                color={commentText.trim() ? '#ec4899' : '#d1d5db'}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const postStyles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3e8ff',
    boxShadow: '0px 2px 10px rgba(236, 72, 153, 0.06)',
  },
  authorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  authorInfo: { flex: 1 },
  authorName: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  authorBadge: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  rightMeta: { alignItems: 'flex-end', gap: 4 },
  time: { fontSize: 11, color: '#9ca3af' },
  text: { fontSize: 14, color: '#374151', lineHeight: 22, marginBottom: 14 },
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  reactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reactionBtnActive: {
    backgroundColor: 'rgba(236,72,153,0.08)',
    borderColor: 'rgba(236,72,153,0.25)',
  },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  reactionCountActive: { color: '#ec4899' },
  commentsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  commentsBtnText: { fontSize: 12, color: '#9ca3af' },
  commentsSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#f3e8ff', paddingTop: 12 },
  commentRow: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'flex-start' },
  commentBubble: {
    flex: 1,
    backgroundColor: '#fdf6ff',
    borderRadius: 12,
    padding: 10,
  },
  commentAuthor: { fontSize: 12, fontWeight: '700', color: '#1a1a2e', marginBottom: 2 },
  commentText: { fontSize: 13, color: '#374151', lineHeight: 19 },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3e8ff',
    paddingTop: 10,
    marginTop: 4,
  },
  commentTextInput: {
    flex: 1,
    backgroundColor: '#fdf6ff',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    fontSize: 13,
    color: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#f3e8ff',
  },
});

// ─── New Post Modal ────────────────────────────────────────────────────────────

function NewPostModal({
  visible,
  onClose,
  onPost,
}: {
  visible: boolean;
  onClose: () => void;
  onPost: (text: string, topic: string, authorName: string) => void;
}) {
  const { motherName } = useProfileStore();
  const [text, setText] = useState('');
  const [topic, setTopic] = useState('General');
  const [error, setError] = useState('');

  const handlePost = () => {
    if (!text.trim() || text.trim().length < 10) {
      setError('Please write at least 10 characters');
      return;
    }
    onPost(text.trim(), topic, motherName || 'Anonymous Mom');
    setText('');
    setTopic('General');
    setError('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={newPostStyles.overlay}>
        <View style={newPostStyles.sheet}>
          <View style={newPostStyles.header}>
            <Text style={newPostStyles.title}>New Post ✍️</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle-outline" size={26} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <Text style={newPostStyles.label}>Topic</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {TOPICS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  newPostStyles.topicChip,
                  t === topic && newPostStyles.topicChipActive,
                ]}
                onPress={() => setTopic(t)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    newPostStyles.topicChipText,
                    t === topic && newPostStyles.topicChipTextActive,
                  ]}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={newPostStyles.label}>Share with the community</Text>
          <TextInput
            style={newPostStyles.textArea}
            value={text}
            onChangeText={(t) => { setText(t); setError(''); }}
            placeholder="What's on your mind? Ask a question, share a tip, or celebrate a milestone..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={5}
          />
          {error ? <Text style={newPostStyles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={newPostStyles.postBtn}
            onPress={handlePost}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#ec4899', '#8b5cf6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={newPostStyles.postBtnGrad}
            >
              <Text style={newPostStyles.postBtnText}>Post to Community</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const newPostStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 44,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a2e' },
  label: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 8 },
  topicChip: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginRight: 6,
    backgroundColor: '#f9fafb',
  },
  topicChipActive: { borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.08)' },
  topicChipText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  topicChipTextActive: { color: '#8b5cf6', fontWeight: '700' },
  textArea: {
    backgroundColor: '#fdf6ff',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#f3e8ff',
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 6,
  },
  errorText: { color: '#ef4444', fontSize: 12, marginBottom: 10 },
  postBtn: { borderRadius: 999, overflow: 'hidden', marginTop: 10 },
  postBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  postBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const {
    activeFilter,
    addPost,
    toggleReaction,
    addComment,
    toggleComments,
    setFilter,
    getFilteredPosts,
  } = useCommunityStore();
  const { motherName } = useProfileStore();

  const [showNewPost, setShowNewPost] = useState(false);
  const posts = getFilteredPosts();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Community 👥</Text>
        <TouchableOpacity onPress={() => setShowNewPost(true)} activeOpacity={0.85}>
          <LinearGradient
            colors={['#ec4899', '#8b5cf6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.postBtn}
          >
            <Text style={styles.postBtnText}>Post +</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
      >
        {FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterChip,
              activeFilter === filter && styles.filterChipActive,
            ]}
            onPress={() => setFilter(filter)}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === filter && styles.filterChipTextActive,
              ]}
            >
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Posts */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            currentUserName={motherName}
            onReact={toggleReaction}
            onToggleComments={toggleComments}
            onAddComment={addComment}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyText}>No posts in this category yet.{'\n'}Be the first to share!</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      <NewPostModal
        visible={showNewPost}
        onClose={() => setShowNewPost(false)}
        onPost={addPost}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fdf6ff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3e8ff',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    boxShadow: '0px 2px 8px rgba(139, 92, 246, 0.06)',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1a1a2e' },
  postBtn: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  postBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  filtersRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3e8ff',
  },
  filterChip: {
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterChipActive: {
    backgroundColor: 'rgba(236,72,153,0.1)',
    borderColor: '#ec4899',
  },
  filterChipText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  filterChipTextActive: { color: '#ec4899', fontWeight: '700' },
  listContent: { paddingHorizontal: 16, paddingTop: 14 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#9ca3af', textAlign: 'center', lineHeight: 22 },
});
