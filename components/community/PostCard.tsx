import React, { useState } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import GradientAvatar from '../ui/GradientAvatar';
import TagPill from '../ui/TagPill';
import { Post } from '../../store/useCommunityStore';
import { useSocialStore } from '../../store/useSocialStore';
import { Colors, Fonts } from '../../constants/theme';
import { sharePost } from '../../lib/share';
import { confirmAction, infoAlert } from '../../lib/cross-platform-alerts';

interface PostCardProps {
  post: Post;                                             // Post from useCommunityStore — now has authorUid field
  currentUserUid: string;
  currentUserName: string;
  currentUserPhotoUrl?: string;                          // current user's profile photo for comment input
  blockedUids?: string[];                                // UIDs blocked by current user — hides their comments
  onReact: (postId: string, emoji: string) => void;
  onToggleComments: (postId: string) => void;
  onAddComment: (postId: string, text: string) => void;
  onViewProfile: (uid: string, name: string) => void;    // open UserProfileModal
  onDeletePost?: (postId: string) => void;               // only provided for own posts
  onEditPost?: (postId: string) => void;                 // only provided for own posts
  onDeleteComment?: (postId: string, commentId: string) => void; // own comment or own post's comment
  onEditComment?: (postId: string, commentId: string, text: string) => Promise<void> | void;
  /** Tap on a reaction pill (long-press / secondary) → show who reacted.
      If omitted, the reaction pill is just a tap-to-toggle. */
  onShowReactors?: (postId: string, emoji?: string) => void;
}

const REACTION_OPTIONS = ['❤️', '🤱', '😊', '💪', '🙏', '💜'];

function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  if (!Number.isFinite(diffMs)) return 'recently';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── ReactionPill ────────────────────────────────────────────────────
// Small tappable pill with a scale pop on tap — the premium-feeling
// "my reaction landed" signal. Pop runs entirely on the UI thread (shared
// value + withSequence) so it's smooth even in long feeds.
function ReactionPill({
  emoji,
  count,
  active,
  onPress,
  onLongPress,
}: {
  emoji: string;
  count: number;
  active: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const handlePress = () => {
    scale.value = withSequence(
      withTiming(1.18, { duration: 110, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 9, stiffness: 220 }),
    );
    onPress();
  };
  return (
    <Animated.View style={[animatedStyle]}>
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={onLongPress}
        delayLongPress={250}
        style={[styles.reactionPill, active && styles.reactionPillActive]}
      >
        <Text style={styles.reactionEmoji}>{emoji}</Text>
        <Text style={[styles.reactionCount, active && styles.reactionCountActive]}>
          {count}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function PostCard({
  post,
  currentUserUid,
  currentUserName,
  currentUserPhotoUrl,
  blockedUids = [],
  onReact,
  onToggleComments,
  onAddComment,
  onViewProfile,
  onDeletePost,
  onEditPost,
  onDeleteComment,
  onEditComment,
  onShowReactors,
}: PostCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [commentActionBusy, setCommentActionBusy] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const confirmDeletePost = () => {
    Alert.alert(
      'Delete post',
      'This will permanently remove your post and all its comments.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDeletePost?.(post.id),
        },
      ],
    );
  };

  const confirmDeleteComment = async (commentId: string) => {
    const ok = await confirmAction(
      'Delete comment',
      'Remove this comment permanently?',
      { confirmLabel: 'Delete', destructive: true },
    );
    if (!ok) return;
    try {
      setCommentActionBusy(commentId);
      await onDeleteComment?.(post.id, commentId);
      if (editingCommentId === commentId) {
        setEditingCommentId(null);
        setEditingCommentText('');
      }
    } catch (error) {
      console.error('confirmDeleteComment failed:', error);
      infoAlert('Could not delete comment', 'Please try again.');
    } finally {
      setCommentActionBusy(null);
    }
  };

  const startEditComment = (commentId: string, text: string) => {
    setEditingCommentId(commentId);
    setEditingCommentText(text);
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const saveEditComment = async (commentId: string) => {
    const trimmed = editingCommentText.trim();
    if (!trimmed) {
      infoAlert('Comment is empty', 'Write something before saving.');
      return;
    }
    try {
      setCommentActionBusy(commentId);
      await onEditComment?.(post.id, commentId, trimmed);
      setEditingCommentId(null);
      setEditingCommentText('');
    } catch (error) {
      console.error('saveEditComment failed:', error);
      infoAlert('Could not edit comment', 'Please try again.');
    } finally {
      setCommentActionBusy(null);
    }
  };

  const handleSendComment = () => {
    const trimmed = commentText.trim();
    if (!trimmed || isSubmitting) return;
    setIsSubmitting(true);
    onAddComment(post.id, trimmed);
    setCommentText('');
    setIsSubmitting(false);
  };

  const handleShare = async () => {
    const result = await sharePost({
      postId: post.id,
      authorName: post.authorName || 'A parent',
      text: post.text || '',
    });
    // Light feedback — the Web Share sheet on mobile already confirms; on
    // desktop the clipboard fallback benefits from an explicit toast.
    if (result.method === 'clipboard' && result.ok) {
      Alert.alert('Link copied', 'Share it in any app or chat.');
    } else if (result.method === 'none') {
      Alert.alert('Share unavailable', 'Try again from a mobile browser, or copy the URL from the address bar.');
    }
  };

  // Support both old `userReactions` array and new `reactionsByUser` map
  const isUserReacted = (emoji: string): boolean => {
    if (post.reactionsByUser?.[currentUserUid]) {
      return post.reactionsByUser[currentUserUid].includes(emoji);
    }
    return post.userReactions?.includes(emoji) ?? false;
  };

  // Support both old embedded `comments` array and new loaded `commentList`
  // Filter out comments from blocked users
  const rawComments = post.commentList ?? post.comments;
  const displayedComments = blockedUids.length > 0
    ? rawComments?.filter((c: any) => !blockedUids.includes(c.authorUid))
    : rawComments;
  const lastComment = post.lastComment;
  const commentCount = Math.max(
    0,
    post.commentCount ?? 0,
    displayedComments?.length ?? 0,
    lastComment?.text ? 1 : 0,
  );

  const isOwnPost = post.authorUid === currentUserUid;
  const followStatus = useSocialStore((s) => s.followStatusCache[post.authorUid ?? ''] ?? 'none');
  const showFollowBtn = !isOwnPost && !!post.authorUid && followStatus !== 'following';

  return (
    <View style={styles.card}>
      {/* Author row */}
      <View style={styles.authorRow}>
        <TouchableOpacity
          onPress={() => onViewProfile(post.authorUid ?? '', post.authorName)}
          activeOpacity={0.75}
        >
          {post.authorPhotoUrl ? (
            <Image
              source={{ uri: post.authorPhotoUrl }}
              style={styles.authorPhoto}
            />
          ) : (
            <GradientAvatar name={post.authorName} size={40} />
          )}
        </TouchableOpacity>
        <View style={styles.authorInfo}>
          <View style={styles.authorNameRow}>
            <TouchableOpacity
              onPress={() => onViewProfile(post.authorUid ?? '', post.authorName)}
              activeOpacity={0.75}
            >
              <Text style={styles.authorName}>{post.authorName}</Text>
            </TouchableOpacity>
            {/* Quick follow shortcut — shown only for other users' posts not yet followed */}
            {showFollowBtn && (
              <TouchableOpacity
                onPress={() => onViewProfile(post.authorUid ?? '', post.authorName)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={styles.quickFollowBtn}
              >
                <Text style={styles.quickFollowText}>+ Follow</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.authorMeta}>
            <Text style={styles.badge}>{post.badge}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.timeAgo}>{timeAgo(post.createdAt)}</Text>
          </View>
        </View>
        <View style={styles.postHeaderRight}>
          {post.topic ? (
            <TagPill label={post.topic} color={Colors.primary} />
          ) : null}
          {/* 3-dot menu — own posts only */}
          {isOwnPost && (onDeletePost || onEditPost) && (
            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                onPress={() => setMenuOpen((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.moreBtn}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color="#9ca3af" />
              </TouchableOpacity>
              {menuOpen && (
                <View style={styles.menuDropdown}>
                  {onEditPost && (
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => { setMenuOpen(false); onEditPost(post.id); }}
                    >
                      <Ionicons name="pencil-outline" size={15} color="#1a1a2e" />
                      <Text style={styles.menuItemText}>Edit</Text>
                    </TouchableOpacity>
                  )}
                  {onDeletePost && (
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => { setMenuOpen(false); confirmDeletePost(); }}
                    >
                      <Ionicons name="trash-outline" size={15} color="#ef4444" />
                      <Text style={[styles.menuItemText, { color: '#ef4444' }]}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Post text */}
      <Text style={styles.postText}>{post.text}</Text>

      {/* Optional image area */}
      {post.imageUri ? (
        <View style={[styles.imageWrap, post.imageAspectRatio ? { aspectRatio: post.imageAspectRatio } : {}]}>
          <Image source={{ uri: post.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        </View>
      ) : post.imageEmoji ? (
        <View style={styles.imageArea}>
          <Text style={styles.imageEmoji}>{post.imageEmoji}</Text>
          {post.imageCaption ? (
            <Text style={styles.imageCaption}>{post.imageCaption}</Text>
          ) : null}
        </View>
      ) : null}

      {/* Reactions row. Tap a pill to toggle your own reaction; long-press
          (or tap the "who reacted" chevron below) to see the list of users
          who reacted with that emoji. */}
      <View style={styles.reactionsRow}>
        {post.reactions && Object.entries(post.reactions).map(([emoji, count]) => {
          const userReacted = isUserReacted(emoji);
          return (
            <ReactionPill
              key={emoji}
              emoji={emoji}
              count={Math.max(0, count as number)}
              active={userReacted}
              onPress={() => onReact(post.id, emoji)}
              onLongPress={onShowReactors ? () => onShowReactors(post.id, emoji) : undefined}
            />
          );
        })}

        {/* Add reaction */}
        <TouchableOpacity
          onPress={() => setShowReactionPicker((v) => !v)}
          style={styles.addReactionBtn}
        >
          <Text style={styles.addReactionText}>+</Text>
        </TouchableOpacity>

        {/* Spacer + comment count + share */}
        <View style={styles.flex1} />
        <TouchableOpacity
          onPress={handleShare}
          style={styles.shareBtn}
          accessibilityLabel="Share post"
          activeOpacity={0.7}
        >
          <Ionicons name="share-social-outline" size={16} color="#9ca3af" />
          <Text style={styles.shareText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onToggleComments(post.id)} style={styles.commentCountRow}>
          <Ionicons name="chatbubble-outline" size={16} color="#9ca3af" />
          <Text style={styles.commentCount}>{commentCount}</Text>
        </TouchableOpacity>
      </View>

      {/* Most-recent comment preview — visible without tapping "Comments".
          Lets the feed feel alive: every post with at least one comment
          shows the latest author + text on the card. Tapping the row
          opens the full comments list. */}
      {!post.showComments && lastComment?.text ? (
        <TouchableOpacity
          onPress={() => onToggleComments(post.id)}
          activeOpacity={0.75}
          style={styles.lastCommentRow}
        >
          {lastComment.authorPhotoUrl ? (
            <Image
              source={{ uri: lastComment.authorPhotoUrl }}
              style={styles.lastCommentPhoto}
            />
          ) : (
            <GradientAvatar name={lastComment.authorName || 'Parent'} size={24} />
          )}
          <View style={styles.lastCommentBody}>
            <Text style={styles.lastCommentAuthor} numberOfLines={1}>
              {lastComment.authorName || 'Parent'}
            </Text>
            <Text style={styles.lastCommentText} numberOfLines={2}>
              {lastComment.text}
            </Text>
          </View>
          {commentCount > 1 ? (
            <Text style={styles.lastCommentMore}>
              +{commentCount - 1} more
            </Text>
          ) : null}
        </TouchableOpacity>
      ) : null}

      {/* "Who reacted" chip — shown when there's at least one reaction and
          the parent provided a handler. Explicit affordance for users who
          don't discover long-press on mobile. */}
      {onShowReactors &&
        post.reactions &&
        Object.values(post.reactions).some((c: any) => (c as number) > 0) && (
          <TouchableOpacity
            onPress={() => onShowReactors(post.id)}
            style={styles.reactorsLink}
            activeOpacity={0.7}
          >
            <Ionicons name="people-outline" size={14} color={Colors.primary} />
            <Text style={styles.reactorsLinkText}>See who reacted</Text>
          </TouchableOpacity>
        )}

      {/* Reaction picker */}
      {showReactionPicker && (
        <View style={styles.reactionPicker}>
          {REACTION_OPTIONS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              onPress={() => {
                onReact(post.id, emoji);
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
          {displayedComments?.map((comment) => {
            const commentAuthorUid = (comment as any).authorUid ?? '';
            const isOwnComment = !!currentUserUid && !!commentAuthorUid && commentAuthorUid === currentUserUid;
            const canDeleteComment = onDeleteComment && comment.id && (
              isOwnComment ||                                  // own comment
              isOwnPost                                         // post owner can remove any comment
            );
            const canEditComment = !!onEditComment && !!comment.id && isOwnComment;
            const isEditing = editingCommentId === comment.id;
            const isBusy = commentActionBusy === comment.id;
            return (
              <View key={comment.id} style={styles.commentRow}>
                <TouchableOpacity
                  onPress={() => onViewProfile(
                    (comment as any).authorUid ?? '',
                    comment.authorName
                  )}
                  activeOpacity={0.75}
                >
                  {(comment as any).authorPhotoUrl ? (
                    <Image
                      source={{ uri: (comment as any).authorPhotoUrl }}
                      style={styles.commentPhoto}
                    />
                  ) : (
                    <GradientAvatar name={comment.authorName} size={28} />
                  )}
                </TouchableOpacity>
                <View style={styles.commentBubble}>
                  <TouchableOpacity
                    onPress={() => onViewProfile(
                      (comment as any).authorUid ?? '',
                      comment.authorName
                    )}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.commentAuthor}>{comment.authorName}</Text>
                  </TouchableOpacity>
                  {isEditing ? (
                    <>
                      <TextInput
                        style={styles.commentEditInput}
                        value={editingCommentText}
                        onChangeText={setEditingCommentText}
                        multiline
                        autoFocus
                        placeholder="Edit your comment"
                        placeholderTextColor="#9ca3af"
                      />
                      <View style={styles.commentActionRow}>
                        <TouchableOpacity
                          onPress={cancelEditComment}
                          style={styles.commentActionBtn}
                          disabled={isBusy}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.commentActionText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => saveEditComment(comment.id)}
                          style={[styles.commentActionBtn, styles.commentActionPrimary]}
                          disabled={isBusy}
                          activeOpacity={0.75}
                        >
                          <Text style={[styles.commentActionText, styles.commentActionPrimaryText]}>
                            {isBusy ? 'Saving...' : 'Save'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.commentText}>{comment.text}</Text>
                      <Text style={styles.commentTime}>{timeAgo(comment.createdAt)}</Text>
                    </>
                  )}
                </View>
                {(canEditComment || canDeleteComment) && !isEditing ? (
                  <View style={styles.commentOwnerActions}>
                    {canEditComment ? (
                      <TouchableOpacity
                        onPress={() => startEditComment(comment.id, comment.text)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.commentIconBtn}
                        disabled={isBusy}
                        accessibilityLabel="Edit comment"
                      >
                        <Ionicons name="pencil-outline" size={15} color={Colors.primary} />
                      </TouchableOpacity>
                    ) : null}
                    {canDeleteComment ? (
                      <TouchableOpacity
                        onPress={() => confirmDeleteComment(comment.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.commentIconBtn}
                        disabled={isBusy}
                        accessibilityLabel="Delete comment"
                      >
                        <Ionicons name="trash-outline" size={15} color="#ef4444" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}

          {/* Comment input */}
          <View style={styles.commentInputRow}>
            {currentUserPhotoUrl ? (
              <Image source={{ uri: currentUserPhotoUrl }} style={styles.commentPhoto} />
            ) : (
              <GradientAvatar name={currentUserName} size={28} />
            )}
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
              disabled={!commentText.trim() || isSubmitting}
              style={{ opacity: (!commentText.trim() || isSubmitting) ? 0.4 : 1 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="send"
                size={18}
                color={commentText.trim() ? Colors.primary : '#e5e7eb'}
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
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    boxShadow: '0px 2px 8px rgba(28, 16, 51, 0.042)',
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
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  quickFollowBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  quickFollowText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
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
  postHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 4,
  },
  moreBtn: {
    padding: 2,
  },
  menuDropdown: {
    position: 'absolute',
    top: 24,
    right: 0,
    minWidth: 140,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    zIndex: 100,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  menuItemText: {
    fontSize: 14,
    color: '#1a1a2e',
    fontWeight: '500',
  },
  commentOwnerActions: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 2,
  },
  commentIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F0FF',
  },
  postText: {
    fontSize: 15,
    color: '#1a1a2e',
    lineHeight: 22,
    marginBottom: 12,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#F0EDF5',
  },
  authorPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  commentPhoto: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  imageArea: {
    backgroundColor: '#F5F0FF',
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
    backgroundColor: '#F0EDF5',
    gap: 4,
  },
  reactionPillActive: {
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: 'rgba(28, 16, 51, 0.048)',
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
    color: Colors.primary,
  },
  addReactionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0EDF5',
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
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
  },
  shareText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
  },
  commentCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentCount: {
    fontSize: 13,
    color: '#9ca3af',
  },
  reactorsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    marginLeft: 2,
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  lastCommentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  lastCommentPhoto: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EDE9F6',
  },
  lastCommentBody: { flex: 1, minWidth: 0 },
  lastCommentAuthor: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: '#1C1033',
  },
  lastCommentText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: '#3F3553',
    lineHeight: 18,
    marginTop: 1,
  },
  lastCommentMore: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: Colors.primary,
    marginTop: 4,
  },
  reactorsLinkText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
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
  commentEditInput: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: '#EDE9F6',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#1a1a2e',
    backgroundColor: '#ffffff',
    fontSize: 13,
    lineHeight: 18,
    textAlignVertical: 'top',
  },
  commentActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  commentActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: '#F0EDF5',
  },
  commentActionPrimary: {
    backgroundColor: Colors.primary,
  },
  commentActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
  },
  commentActionPrimaryText: {
    color: '#ffffff',
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
    backgroundColor: '#F0EDF5',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#1a1a2e',
  },
});
