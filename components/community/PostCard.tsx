import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GradientAvatar from '../ui/GradientAvatar';
import TagPill from '../ui/TagPill';
import { Post } from '../../store/useCommunityStore';

interface PostCardProps {
  post: Post;
  onReact: (emoji: string) => void;
  onComment: (text: string) => void;
  onToggleComments: () => void;
  currentUserName: string;
}

const REACTION_OPTIONS = ['❤️', '🤱', '😊', '💪', '🙏', '💜'];

function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function PostCard({
  post,
  onReact,
  onComment,
  onToggleComments,
  currentUserName,
}: PostCardProps) {
  const [commentText, setCommentText] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const handleSendComment = () => {
    const trimmed = commentText.trim();
    if (!trimmed) return;
    onComment(trimmed);
    setCommentText('');
  };

  return (
    <View style={styles.card}>
      {/* Author row */}
      <View style={styles.authorRow}>
        <GradientAvatar name={post.authorName} size={40} />
        <View style={styles.authorInfo}>
          <Text style={styles.authorName}>{post.authorName}</Text>
          <View style={styles.authorMeta}>
            <Text style={styles.badge}>{post.badge}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.timeAgo}>{timeAgo(post.createdAt)}</Text>
          </View>
        </View>
        {post.topic ? (
          <TagPill label={post.topic} color="#8b5cf6" style={styles.topicPill} />
        ) : null}
      </View>

      {/* Post text */}
      <Text style={styles.postText}>{post.text}</Text>

      {/* Optional image area */}
      {post.imageEmoji ? (
        <View style={styles.imageArea}>
          <Text style={styles.imageEmoji}>{post.imageEmoji}</Text>
          {post.imageCaption ? (
            <Text style={styles.imageCaption}>{post.imageCaption}</Text>
          ) : null}
        </View>
      ) : null}

      {/* Reactions row */}
      <View style={styles.reactionsRow}>
        {post.reactions && Object.entries(post.reactions).map(([emoji, count]) => {
          const userReacted = post.userReactions?.includes(emoji);
          return (
            <TouchableOpacity
              key={emoji}
              onPress={() => onReact(emoji)}
              style={[styles.reactionPill, userReacted && styles.reactionPillActive]}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
              <Text style={[styles.reactionCount, userReacted && styles.reactionCountActive]}>
                {count as number}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Add reaction */}
        <TouchableOpacity
          onPress={() => setShowReactionPicker((v) => !v)}
          style={styles.addReactionBtn}
        >
          <Text style={styles.addReactionText}>+</Text>
        </TouchableOpacity>

        {/* Spacer + comment count */}
        <View style={styles.flex1} />
        <TouchableOpacity onPress={onToggleComments} style={styles.commentCountRow}>
          <Ionicons name="chatbubble-outline" size={16} color="#9ca3af" />
          <Text style={styles.commentCount}>{post.comments?.length ?? 0}</Text>
        </TouchableOpacity>
      </View>

      {/* Reaction picker */}
      {showReactionPicker && (
        <View style={styles.reactionPicker}>
          {REACTION_OPTIONS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              onPress={() => {
                onReact(emoji);
                setShowReactionPicker(false);
              }}
              style={styles.reactionPickerItem}
            >
              <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Expanded comments */}
      {post.showComments && (
        <View style={styles.commentsSection}>
          {post.comments?.map((comment) => (
            <View key={comment.id} style={styles.commentRow}>
              <GradientAvatar name={comment.authorName} size={28} />
              <View style={styles.commentBubble}>
                <Text style={styles.commentAuthor}>{comment.authorName}</Text>
                <Text style={styles.commentText}>{comment.text}</Text>
                <Text style={styles.commentTime}>{timeAgo(comment.createdAt)}</Text>
              </View>
            </View>
          ))}

          {/* Comment input */}
          <View style={styles.commentInputRow}>
            <GradientAvatar name={currentUserName} size={28} />
            <TextInput
              style={styles.commentInput}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Write a comment…"
              placeholderTextColor="#9ca3af"
              onSubmitEditing={handleSendComment}
              returnKeyType="send"
            />
            <TouchableOpacity
              onPress={handleSendComment}
              disabled={!commentText.trim()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="send"
                size={18}
                color={commentText.trim() ? '#ec4899' : '#e5e7eb'}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    boxShadow: '0px 2px 8px rgba(236, 72, 153, 0.07)',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  authorMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  badge: {
    fontSize: 12,
    color: '#9ca3af',
  },
  dot: {
    color: '#d1d5db',
    fontSize: 12,
  },
  timeAgo: {
    fontSize: 12,
    color: '#9ca3af',
  },
  topicPill: {
    alignSelf: 'flex-start',
  },
  postText: {
    fontSize: 15,
    color: '#1a1a2e',
    lineHeight: 22,
    marginBottom: 12,
  },
  imageArea: {
    backgroundColor: '#fdf2f8',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  imageEmoji: {
    fontSize: 48,
    marginBottom: 4,
  },
  imageCaption: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
  },
  reactionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: '#f3f4f6',
    gap: 4,
  },
  reactionPillActive: {
    borderWidth: 1,
    borderColor: '#ec4899',
    backgroundColor: 'rgba(236,72,153,0.08)',
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
  },
  reactionCountActive: {
    color: '#ec4899',
  },
  addReactionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addReactionText: {
    fontSize: 16,
    color: '#9ca3af',
    fontWeight: '700',
    lineHeight: 20,
  },
  flex1: { flex: 1 },
  commentCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentCount: {
    fontSize: 13,
    color: '#9ca3af',
  },
  reactionPicker: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 8,
    marginTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    gap: 4,
    alignSelf: 'flex-start',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.12)',
  },
  reactionPickerItem: {
    padding: 4,
  },
  reactionPickerEmoji: {
    fontSize: 22,
  },
  commentsSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 12,
    gap: 10,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  commentBubble: {
    flex: 1,
    backgroundColor: '#fdf6ff',
    borderRadius: 12,
    padding: 10,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 2,
  },
  commentText: {
    fontSize: 13,
    color: '#1a1a2e',
    lineHeight: 18,
  },
  commentTime: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#1a1a2e',
  },
});
