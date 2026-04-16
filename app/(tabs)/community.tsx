import React, { useState } from 'react';
import {
  FlatList,
  Image,
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
import SettingsModal from '../../components/ui/SettingsModal';
import { Fonts } from '../../constants/theme';

const FILTERS: CommunityFilter[] = ['All', 'Newborn', 'Pregnancy', 'Nutrition', 'Mental Health', 'Milestones', 'Products'];
const TOPICS = ['Newborn', 'Pregnancy', 'Nutrition', 'Mental Health', 'Milestones', 'Products', 'General'];

// ─── Image Crop Helpers ───────────────────────────────────────────────────────

type CropRatio = 'Original' | '1:1' | '4:3' | '16:9';

const RATIO_VALUES: Record<CropRatio, number | null> = {
  'Original': null,
  '1:1': 1,
  '4:3': 4 / 3,
  '16:9': 16 / 9,
};

async function cropImageToRatio(uri: string, ratio: number | null): Promise<{ uri: string; aspectRatio: number }> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve({ uri, aspectRatio: 4 / 3 });
      return;
    }
    const img = new (window as any).Image() as HTMLImageElement;
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      let sx = 0, sy = 0, sw = w, sh = h;
      if (ratio !== null) {
        const imgRatio = w / h;
        if (imgRatio > ratio) {
          sw = Math.round(h * ratio);
          sx = Math.round((w - sw) / 2);
        } else if (imgRatio < ratio) {
          sh = Math.round(w / ratio);
          sy = Math.round((h - sh) / 2);
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve({ uri, aspectRatio: w / h }); return; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const cropped = canvas.toDataURL('image/jpeg', 0.88);
      resolve({ uri: cropped, aspectRatio: sw / sh });
    };
    img.onerror = () => resolve({ uri, aspectRatio: ratio ?? 4 / 3 });
    img.src = uri;
  });
}

// ─── User Profile Modal ───────────────────────────────────────────────────────

function UserProfileModal({
  author,
  onClose,
  allPosts,
}: {
  author: { name: string; initial: string; badge: string } | null;
  onClose: () => void;
  allPosts: Post[];
}) {
  if (!author) return null;
  const authorPosts = allPosts.filter((p) => p.authorName === author.name);
  const topTopics = [...new Set(authorPosts.map((p) => p.topic))];
  const totalReactions = authorPosts.reduce(
    (sum, p) => sum + Object.values(p.reactions).reduce((a, b) => a + b, 0),
    0
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={uStyles.overlay} onPress={onClose} activeOpacity={1}>
        <View style={uStyles.sheet}>
          <View style={uStyles.handle} />

          {/* Avatar + name */}
          <View style={uStyles.profileHeader}>
            <GradientAvatar name={author.initial} size={68} />
            <Text style={uStyles.name}>{author.name}</Text>
            <Text style={uStyles.badge}>{author.badge}</Text>
          </View>

          {/* Stats */}
          <View style={uStyles.statsRow}>
            <View style={uStyles.stat}>
              <Text style={uStyles.statNum}>{authorPosts.length}</Text>
              <Text style={uStyles.statLabel}>Posts</Text>
            </View>
            <View style={uStyles.statDivider} />
            <View style={uStyles.stat}>
              <Text style={uStyles.statNum}>{totalReactions}</Text>
              <Text style={uStyles.statLabel}>Reactions</Text>
            </View>
            {topTopics.length > 0 && (
              <>
                <View style={uStyles.statDivider} />
                <View style={uStyles.stat}>
                  <Text style={uStyles.statNum}>{topTopics.length}</Text>
                  <Text style={uStyles.statLabel}>Topics</Text>
                </View>
              </>
            )}
          </View>

          {/* Topics chips */}
          {topTopics.length > 0 && (
            <View style={uStyles.topicsWrap}>
              <Text style={uStyles.topicsLabel}>Talks about</Text>
              <View style={uStyles.topicsRow}>
                {topTopics.map((t) => (
                  <View key={t} style={uStyles.topicChip}>
                    <Text style={uStyles.topicChipText}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Most recent post preview */}
          {authorPosts[0] && (
            <View style={uStyles.recentPost}>
              <Text style={uStyles.recentLabel}>Recent post</Text>
              <Text style={uStyles.recentText} numberOfLines={3}>
                {authorPosts[0].text}
              </Text>
            </View>
          )}

          <TouchableOpacity style={uStyles.closeBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={uStyles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const uStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFF8FC',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#EDE9F6',
    alignSelf: 'center',
    marginBottom: 20,
  },
  profileHeader: { alignItems: 'center', marginBottom: 20 },
  name: { fontFamily: Fonts.serif, fontSize: 20, color: '#1C1033', marginTop: 12, marginBottom: 4 },
  badge: { fontFamily: Fonts.sansRegular, fontSize: 13, color: '#9CA3AF' },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 0,
    borderWidth: 1,
    borderColor: '#EDE9F6',
  },
  stat: { alignItems: 'center', flex: 1 },
  statNum: { fontFamily: Fonts.sansBold, fontSize: 22, color: '#1C1033' },
  statLabel: { fontFamily: Fonts.sansRegular, fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: '#EDE9F6' },
  topicsWrap: { marginBottom: 16 },
  topicsLabel: { fontFamily: Fonts.sansBold, fontSize: 11, color: '#C4B5D4', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  topicsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  topicChip: {
    backgroundColor: 'rgba(124,58,237,0.06)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.15)',
  },
  topicChipText: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: '#7C3AED' },
  recentPost: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EDE9F6',
  },
  recentLabel: { fontFamily: Fonts.sansBold, fontSize: 10, color: '#C4B5D4', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  recentText: { fontFamily: Fonts.sansRegular, fontSize: 13, color: '#374151', lineHeight: 19 },
  closeBtn: {
    backgroundColor: 'rgba(124,58,237,0.08)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeBtnText: { fontFamily: Fonts.sansBold, fontSize: 15, color: '#7C3AED' },
});

// ─── Post Card ────────────────────────────────────────────────────────────────

const REACTION_EMOJIS = ['❤️', '💜', '😊', '💪', '🙏', '🤱'];

function PostCard({
  post,
  currentUserName,
  onReact,
  onToggleComments,
  onAddComment,
  onViewProfile,
}: {
  post: Post;
  currentUserName: string;
  onReact: (postId: string, emoji: string) => void;
  onToggleComments: (postId: string) => void;
  onAddComment: (postId: string, authorName: string, text: string) => void;
  onViewProfile: (author: { name: string; initial: string; badge: string }) => void;
}) {
  const [commentText, setCommentText] = useState('');
  const [showReactPicker, setShowReactPicker] = useState(false);

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

  // Compiled reaction summary
  const totalReactions = Object.values(post.reactions).reduce((a, b) => a + b, 0);
  const topEmojis = Object.entries(post.reactions)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([emoji]) => emoji);

  return (
    <View style={postStyles.card}>
      {/* Author row */}
      <View style={postStyles.authorRow}>
        <TouchableOpacity
          style={postStyles.authorLeft}
          onPress={() => onViewProfile({ name: post.authorName, initial: post.authorInitial, badge: post.badge })}
          activeOpacity={0.75}
        >
          <GradientAvatar name={post.authorInitial} size={40} />
          <View style={postStyles.authorInfo}>
            <Text style={postStyles.authorName}>{post.authorName}</Text>
            <Text style={postStyles.authorBadge}>{post.badge}</Text>
          </View>
        </TouchableOpacity>
        <View style={postStyles.rightMeta}>
          <TagPill label={post.topic} color="#8b5cf6" />
          <Text style={postStyles.time}>{timeAgo(post.createdAt)}</Text>
        </View>
      </View>

      {/* Post text */}
      <Text style={postStyles.text}>{post.text}</Text>

      {/* Post image — uses stored aspect ratio so no forced cropping in feed */}
      {post.imageUri ? (
        <View style={[postStyles.postImageWrap, post.imageAspectRatio ? { aspectRatio: post.imageAspectRatio } : {}]}>
          <Image
            source={{ uri: post.imageUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        </View>
      ) : null}

      {/* Reactions bar */}
      <View style={postStyles.reactionsBar}>
        {/* Left: compiled emoji summary */}
        <TouchableOpacity
          style={postStyles.reactionSummary}
          onPress={() => setShowReactPicker((v) => !v)}
          activeOpacity={0.75}
        >
          {topEmojis.length > 0 ? (
            <>
              <Text style={postStyles.reactionCluster}>{topEmojis.join('')}</Text>
              <Text style={postStyles.reactionTotal}>{totalReactions}</Text>
            </>
          ) : null}
          <View style={postStyles.reactBtn}>
            <Text style={postStyles.reactBtnText}>React</Text>
            <Ionicons name="add" size={13} color="#E8487A" />
          </View>
        </TouchableOpacity>

        {/* Right: comment count */}
        <TouchableOpacity
          style={postStyles.commentsBtn}
          onPress={() => onToggleComments(post.id)}
          activeOpacity={0.75}
        >
          <Ionicons name="chatbubble-outline" size={14} color="#9ca3af" />
          <Text style={postStyles.commentsBtnText}>{post.comments.length}</Text>
        </TouchableOpacity>
      </View>

      {/* Emoji picker (expands on tap React) */}
      {showReactPicker && (
        <View style={postStyles.emojiPicker}>
          {REACTION_EMOJIS.map((emoji) => {
            const count = post.reactions[emoji] ?? 0;
            const reacted = post.userReactions.includes(emoji);
            return (
              <TouchableOpacity
                key={emoji}
                style={[postStyles.emojiPickerBtn, reacted && postStyles.emojiPickerBtnActive]}
                onPress={() => { onReact(post.id, emoji); }}
                activeOpacity={0.7}
              >
                <Text style={postStyles.emojiPickerIcon}>{emoji}</Text>
                {count > 0 && (
                  <Text style={[postStyles.emojiPickerCount, reacted && postStyles.emojiPickerCountActive]}>
                    {count}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

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
    shadowColor: '#E8487A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#EDE9F6',
    boxShadow: '0px 2px 10px rgba(232, 72, 122, 0.06)',
  } as any,
  authorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12, justifyContent: 'space-between' },
  authorLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  authorInfo: { flex: 1 },
  authorName: { fontFamily: Fonts.sansBold, fontSize: 15, color: '#1C1033' },
  authorBadge: { fontFamily: Fonts.sansRegular, fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  rightMeta: { alignItems: 'flex-end', gap: 4 },
  time: { fontFamily: Fonts.sansRegular, fontSize: 11, color: '#9CA3AF' },
  text: { fontFamily: Fonts.sansRegular, fontSize: 14, color: '#374151', lineHeight: 22, marginBottom: 14 },
  postImageWrap: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#EDE9F6',
    position: 'relative',
  },
  reactionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reactionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reactionCluster: { fontSize: 16 },
  reactionTotal: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: '#9CA3AF' },
  reactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1.5,
    borderColor: 'rgba(232,72,122,0.25)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(232,72,122,0.04)',
  },
  reactBtnText: { fontFamily: Fonts.sansSemiBold, fontSize: 12, color: '#E8487A' },
  commentsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  commentsBtnText: { fontFamily: Fonts.sansRegular, fontSize: 12, color: '#9CA3AF' },
  emojiPicker: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFF8FC',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#EDE9F6',
  },
  emojiPickerBtn: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 10,
  },
  emojiPickerBtnActive: { backgroundColor: 'rgba(232,72,122,0.08)' },
  emojiPickerIcon: { fontSize: 22 },
  emojiPickerCount: { fontFamily: Fonts.sansSemiBold, fontSize: 11, color: '#9CA3AF' },
  emojiPickerCountActive: { color: '#E8487A' },
  commentsSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#EDE9F6', paddingTop: 12 },
  commentRow: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'flex-start' },
  commentBubble: {
    flex: 1,
    backgroundColor: '#FFF8FC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EDE9F6',
  },
  commentAuthor: { fontFamily: Fonts.sansBold, fontSize: 12, color: '#1C1033', marginBottom: 2 },
  commentText: { fontFamily: Fonts.sansRegular, fontSize: 13, color: '#374151', lineHeight: 19 },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#EDE9F6',
    paddingTop: 10,
    marginTop: 4,
  },
  commentTextInput: {
    flex: 1,
    backgroundColor: '#FFF8FC',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: '#1C1033',
    borderWidth: 1,
    borderColor: '#EDE9F6',
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
  onPost: (text: string, topic: string, authorName: string, imageUri?: string, imageAspectRatio?: number) => void;
}) {
  const { motherName } = useProfileStore();
  const [text, setText] = useState('');
  const [topic, setTopic] = useState('General');
  const [error, setError] = useState('');
  const [rawImageUri, setRawImageUri] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState<number>(4 / 3);
  const [cropRatio, setCropRatio] = useState<CropRatio>('Original');
  const [cropLoading, setCropLoading] = useState(false);

  const handlePickImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (file) {
        const uri = URL.createObjectURL(file);
        setRawImageUri(uri);
        setCropRatio('Original');
        // Measure original aspect ratio
        const result = await cropImageToRatio(uri, null);
        setImageUri(result.uri);
        setImageAspectRatio(result.aspectRatio);
      }
    };
    input.click();
  };

  const handleSetCropRatio = async (ratio: CropRatio) => {
    if (!rawImageUri || cropLoading) return;
    setCropRatio(ratio);
    setCropLoading(true);
    const result = await cropImageToRatio(rawImageUri, RATIO_VALUES[ratio]);
    setImageUri(result.uri);
    setImageAspectRatio(result.aspectRatio);
    setCropLoading(false);
  };

  const handleRemoveImage = () => {
    setImageUri(null);
    setRawImageUri(null);
    setCropRatio('Original');
  };

  const handlePost = () => {
    if (!text.trim() || text.trim().length < 10) {
      setError('Please write at least 10 characters');
      return;
    }
    onPost(text.trim(), topic, motherName || 'Anonymous Mom', imageUri ?? undefined, imageUri ? imageAspectRatio : undefined);
    setText('');
    setTopic('General');
    setError('');
    setImageUri(null);
    setRawImageUri(null);
    setCropRatio('Original');
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
            numberOfLines={4}
          />
          {error ? <Text style={newPostStyles.errorText}>{error}</Text> : null}

          {/* Photo picker + crop selector */}
          {imageUri ? (
            <View style={newPostStyles.imageCropWrap}>
              {/* Preview */}
              <View style={[newPostStyles.imagePreviewWrap, { aspectRatio: imageAspectRatio }]}>
                <Image
                  source={{ uri: imageUri }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
                {cropLoading && (
                  <View style={newPostStyles.cropLoadingOverlay}>
                    <Text style={newPostStyles.cropLoadingText}>Cropping…</Text>
                  </View>
                )}
                <TouchableOpacity style={newPostStyles.removeImageBtn} onPress={handleRemoveImage}>
                  <Ionicons name="close-circle" size={22} color="#ffffff" />
                </TouchableOpacity>
              </View>
              {/* Ratio selector */}
              <View style={newPostStyles.ratioRow}>
                <Text style={newPostStyles.ratioLabel}>Crop:</Text>
                {(['Original', '1:1', '4:3', '16:9'] as CropRatio[]).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[newPostStyles.ratioBtn, cropRatio === r && newPostStyles.ratioBtnActive]}
                    onPress={() => handleSetCropRatio(r)}
                    activeOpacity={0.75}
                  >
                    <Text style={[newPostStyles.ratioBtnText, cropRatio === r && newPostStyles.ratioBtnTextActive]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <TouchableOpacity style={newPostStyles.photoBtn} onPress={handlePickImage} activeOpacity={0.75}>
              <Ionicons name="camera-outline" size={18} color="#8b5cf6" />
              <Text style={newPostStyles.photoBtnText}>Add Photo</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={newPostStyles.postBtn}
            onPress={handlePost}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#E8487A', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={newPostStyles.postBtnGrad}
            >
              <Text style={newPostStyles.postBtnText}>Post to Connect</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const newPostStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFF8FC',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 44,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  title: { fontFamily: Fonts.sansBold, fontSize: 20, color: '#1C1033' },
  label: { fontFamily: Fonts.sansSemiBold, fontSize: 10, color: '#9CA3AF', letterSpacing: 1, marginBottom: 8 },
  topicChip: {
    borderWidth: 1.5,
    borderColor: '#EDE9F6',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginRight: 6,
    backgroundColor: '#ffffff',
  },
  topicChipActive: { borderColor: '#7C3AED', backgroundColor: 'rgba(124,58,237,0.06)' },
  topicChipText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: '#9CA3AF' },
  topicChipTextActive: { fontFamily: Fonts.sansBold, color: '#7C3AED' },
  textArea: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#1C1033',
    borderWidth: 1.5,
    borderColor: '#EDE9F6',
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 6,
  },
  errorText: { fontFamily: Fonts.sansRegular, color: '#ef4444', fontSize: 12, marginBottom: 8 },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#EDE9F6',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  photoBtnText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: '#7C3AED' },
  imageCropWrap: {
    marginBottom: 12,
    gap: 8,
  },
  imagePreviewWrap: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f3e8ff',
    position: 'relative',
    minHeight: 80,
  },
  cropLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropLoadingText: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 11,
  },
  ratioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratioLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
    marginRight: 2,
  },
  ratioBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  ratioBtnActive: {
    borderColor: '#8b5cf6',
    backgroundColor: 'rgba(139,92,246,0.08)',
  },
  ratioBtnText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  ratioBtnTextActive: { color: '#8b5cf6' },
  postBtn: { borderRadius: 18, overflow: 'hidden', marginTop: 4 },
  postBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  postBtnText: { fontFamily: Fonts.sansBold, color: '#ffffff', fontSize: 16 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

// ─── My Profile Card ──────────────────────────────────────────────────────────

function MyProfileCard({ onEdit }: { onEdit: () => void }) {
  const {
    motherName, photoUrl, parentGender, bio, expertise,
    kids, visibilitySettings, profile,
  } = useProfileStore();
  const { getUserPostCount } = useCommunityStore();
  const [imgErr, setImgErr] = useState(false);

  const postCount = getUserPostCount(motherName);
  const initial = (motherName || 'M').charAt(0).toUpperCase();
  const genderLabel = parentGender === 'mother' ? 'Mother' : parentGender === 'father' ? 'Father' : parentGender === 'other' ? 'Parent' : 'Parent';
  const kidsLabel = kids.length === 0 ? 'No kids added' : kids.length === 1 ? `${genderLabel} of 1` : `${genderLabel} of ${kids.length}`;

  return (
    <View style={profileStyles.card}>
      <LinearGradient colors={['rgba(232,72,122,0.04)', 'rgba(124,58,237,0.04)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      {/* Label */}
      <View style={profileStyles.cardLabel}>
        <Ionicons name="person-circle-outline" size={13} color="#8b5cf6" />
        <Text style={profileStyles.cardLabelText}>My Profile</Text>
      </View>

      <View style={profileStyles.row}>
        {/* Avatar */}
        <View style={profileStyles.avatarWrap}>
          {photoUrl && !imgErr ? (
            // @ts-ignore
            <img src={photoUrl} alt="avatar" style={{ width: 60, height: 60, borderRadius: 30, objectFit: 'cover' }} onError={() => setImgErr(true)} />
          ) : (
            <View style={profileStyles.avatarFallback}>
              <Text style={profileStyles.avatarInitial}>{initial}</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={profileStyles.info}>
          <Text style={profileStyles.name}>{motherName || 'Your Name'}</Text>
          {visibilitySettings.showKids && <Text style={profileStyles.role}>{kidsLabel}</Text>}
          {visibilitySettings.showState && profile?.state ? <Text style={profileStyles.location}>📍 {profile.state}</Text> : null}
        </View>

        {/* Edit button */}
        <TouchableOpacity style={profileStyles.editBtn} onPress={onEdit} activeOpacity={0.75}>
          <Ionicons name="create-outline" size={16} color="#8b5cf6" />
          <Text style={profileStyles.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      {/* Bio */}
      {bio && visibilitySettings.showBio ? (
        <Text style={profileStyles.bio}>{bio}</Text>
      ) : null}

      {/* Stats row */}
      <View style={profileStyles.statsRow}>
        {visibilitySettings.showPostCount && (
          <View style={profileStyles.stat}>
            <Text style={profileStyles.statNum}>{postCount}</Text>
            <Text style={profileStyles.statLabel}>Posts</Text>
          </View>
        )}
        <View style={profileStyles.stat}>
          <Text style={profileStyles.statNum}>{kids.length}</Text>
          <Text style={profileStyles.statLabel}>{kids.length === 1 ? 'Child' : 'Children'}</Text>
        </View>
      </View>

      {/* Expertise chips */}
      {expertise.length > 0 && visibilitySettings.showExpertise && (
        <View style={profileStyles.expertiseRow}>
          {expertise.map((tag) => (
            <View key={tag} style={profileStyles.expertiseChip}>
              <Text style={profileStyles.expertiseChipText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Empty state nudge */}
      {!bio && expertise.length === 0 && (
        <TouchableOpacity style={profileStyles.nudge} onPress={onEdit} activeOpacity={0.75}>
          <Ionicons name="sparkles-outline" size={14} color="#8b5cf6" />
          <Text style={profileStyles.nudgeText}>Complete your profile — add bio & expertise</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const profileStyles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EDE9F6',
    overflow: 'hidden',
    shadowColor: '#E8487A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    boxShadow: '0px 2px 10px rgba(232, 72, 122, 0.06)',
  } as any,
  cardLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
  },
  cardLabelText: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    color: '#7C3AED',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  avatarWrap: { width: 60, height: 60, borderRadius: 30, overflow: 'hidden' },
  avatarFallback: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#E8487A', alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontFamily: Fonts.sansBold, color: '#fff', fontSize: 24 },
  info: { flex: 1 },
  name: { fontFamily: Fonts.sansBold, fontSize: 17, color: '#1C1033', marginBottom: 2 },
  role: { fontFamily: Fonts.sansRegular, fontSize: 13, color: '#9CA3AF' },
  location: { fontFamily: Fonts.sansRegular, fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.2)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: 'rgba(124,58,237,0.04)',
  },
  editBtnText: { fontFamily: Fonts.sansBold, fontSize: 12, color: '#7C3AED' },
  bio: { fontFamily: Fonts.sansRegular, fontSize: 13, color: '#4b5563', lineHeight: 19, marginBottom: 10 },
  statsRow: { flexDirection: 'row', gap: 20, marginBottom: 10 },
  stat: { alignItems: 'center' },
  statNum: { fontFamily: Fonts.sansBold, fontSize: 18, color: '#1C1033' },
  statLabel: { fontFamily: Fonts.sansRegular, fontSize: 11, color: '#9CA3AF' },
  expertiseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  expertiseChip: {
    backgroundColor: 'rgba(124,58,237,0.06)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(124,58,237,0.15)',
  },
  expertiseChipText: { fontFamily: Fonts.sansSemiBold, fontSize: 12, color: '#7C3AED' },
  nudge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(124,58,237,0.04)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginTop: 4,
  },
  nudgeText: { fontFamily: Fonts.sansSemiBold, fontSize: 12, color: '#7C3AED' },
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
  const [showSettings, setShowSettings] = useState(false);
  const [viewingAuthor, setViewingAuthor] = useState<{ name: string; initial: string; badge: string } | null>(null);
  const allPosts = useCommunityStore((s) => s.posts);
  const posts = getFilteredPosts();

  return (
    <View style={styles.container}>
      {/* ── Dark Gradient Header ── */}
      <LinearGradient
        colors={['#1C1033', '#3b1060', '#6d1a7a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 14 }]}
      >
        <View style={styles.glowTopRight} pointerEvents="none" />
        <View style={styles.glowBottomLeft} pointerEvents="none" />
        <View style={styles.headerInner}>
          <Text style={styles.headerTitle}>Connect</Text>
          <TouchableOpacity onPress={() => setShowNewPost(true)} activeOpacity={0.85}>
            <LinearGradient
              colors={['#E8487A', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.postBtn}
            >
              <Text style={styles.postBtnText}>Post +</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />

      {viewingAuthor && (
        <UserProfileModal
          author={viewingAuthor}
          onClose={() => setViewingAuthor(null)}
          allPosts={allPosts}
        />
      )}

      {/* Filter chips */}
      <View style={styles.filtersWrap}>
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
      </View>

      {/* Posts */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}
        ListHeaderComponent={
          <MyProfileCard onEdit={() => setShowSettings(true)} />
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            currentUserName={motherName}
            onReact={toggleReaction}
            onToggleComments={toggleComments}
            onAddComment={addComment}
            onViewProfile={(author) => setViewingAuthor(author)}
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
        onPost={(text, topic, authorName, imageUri, imageAspectRatio) => addPost(text, topic, authorName, imageUri, imageAspectRatio)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8FC' },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  glowTopRight: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(232,72,122,0.22)', top: -60, right: -40,
  },
  glowBottomLeft: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(124,58,237,0.18)', bottom: -40, left: -20,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontFamily: Fonts.serif, fontSize: 26, color: '#ffffff', letterSpacing: -0.3 },
  postBtn: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  postBtnText: { fontFamily: Fonts.sansBold, color: '#ffffff', fontSize: 14 },
  filtersWrap: {
    backgroundColor: '#FFF8FC',
    borderBottomWidth: 1,
    borderBottomColor: '#EDE9F6',
    flexShrink: 0,
    flexGrow: 0,
  },
  filtersRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'center',
    flexDirection: 'row',
  },
  filterChip: {
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#EDE9F6',
  },
  filterChipActive: {
    backgroundColor: 'rgba(232,72,122,0.08)',
    borderColor: '#E8487A',
  },
  filterChipText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: '#9CA3AF' },
  filterChipTextActive: { fontFamily: Fonts.sansBold, color: '#E8487A' },
  listContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontFamily: Fonts.sansRegular, fontSize: 15, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },
});
