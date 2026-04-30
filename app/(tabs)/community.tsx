import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCommunityStore, CommunityFilter } from '../../store/useCommunityStore';
import { useProfileStore } from '../../store/useProfileStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useSocialStore } from '../../store/useSocialStore';
import GradientAvatar from '../../components/ui/GradientAvatar';
import TagPill from '../../components/ui/TagPill';
import SettingsModal from '../../components/ui/SettingsModal';
import PostCardComponent from '../../components/community/PostCard';
import UserProfileModalComponent, {
  FollowListModal,
  followEntriesToProfiles,
} from '../../components/community/UserProfileModal';
import UserPostsSheet from '../../components/community/UserPostsSheet';
import EditPostModal from '../../components/community/EditPostModal';
import NotificationsSheet from '../../components/community/NotificationsSheet';
import ConversationsSheet from '../../components/community/ConversationsSheet';
import UserSearchSheet from '../../components/community/UserSearchSheet';
import ReactorsSheet from '../../components/community/ReactorsSheet';
import type { CommunityPost } from '../../services/social';
import { countProfilesInState } from '../../services/social';
import ContextualAskChip from '../../components/ui/ContextualAskChip';
import { EmailVerifyBanner } from '../../components/ui/EmailVerifyBanner';
import { Illustration } from '../../components/ui/Illustration';
import type { IllustrationName } from '../../lib/illustrations';
import { Fonts } from '../../constants/theme';
import { uploadPostImage } from '../../services/storage';
import { useDMStore } from '../../store/useDMStore';
import { Colors } from '../../constants/theme';

const FILTERS: CommunityFilter[] = ['All', 'Newborn', 'Pregnancy', 'Nutrition', 'Mental Health', 'Milestones', 'Products'];
const TOPICS = ['Newborn', 'Pregnancy', 'Nutrition', 'Mental Health', 'Milestones', 'Products', 'General'];

// Map a feed filter to its illustration. 'All' has no banner.
const TOPIC_ILLUSTRATION: Record<string, IllustrationName> = {
  Newborn: 'topicNewborn',
  Pregnancy: 'topicPregnancy',
  Nutrition: 'topicNutrition',
  'Mental Health': 'topicMentalHealth',
  Milestones: 'topicMilestones',
  Products: 'topicProducts',
  General: 'topicGeneral',
};

// ─── Topic color map ──────────────────────────────────────────────────────────

const TOPIC_COLORS: Record<string, string> = {
  Newborn: Colors.primary,
  Pregnancy: Colors.primary,
  Nutrition: '#34D399',
  'Mental Health': '#60A5FA',
  Milestones: '#F59E0B',
  Sleep: '#A78BCA',
  Products: '#F97316',
};

function getTopicColor(topic: string): string {
  return TOPIC_COLORS[topic] ?? '#EDE9F6';
}

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

// (UserProfileModal is now imported from components/community/UserProfileModal)

// ─── Animated Heart React Button ──────────────────────────────────────────────

function AnimatedHeartButton({
  hasReacted,
  onPress,
}: {
  hasReacted: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSpring(1.3, { damping: 4, stiffness: 300 }, () => {
      scale.value = withSpring(1, { damping: 6, stiffness: 250 });
    });
    onPress();
  };

  return (
    <TouchableOpacity
      style={heartStyles.pill}
      onPress={handlePress}
      activeOpacity={0.75}
    >
      <Animated.View style={[heartStyles.inner, animatedStyle]}>
        <Ionicons
          name={hasReacted ? 'heart' : 'heart-outline'}
          size={13}
          color={hasReacted ? Colors.primary : Colors.primary}
        />
        <Text style={heartStyles.text}>React</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const heartStyles = StyleSheet.create({
  pill: {
    borderWidth: 1.5,
    borderColor: 'rgba(28, 16, 51, 0.15)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(28, 16, 51, 0.024)',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  text: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: Colors.primary,
  },
});

// ─── New Post Modal ────────────────────────────────────────────────────────────

function NewPostModal({
  visible,
  onClose,
  onPost,
  authorUid,
}: {
  visible: boolean;
  onClose: () => void;
  onPost: (text: string, topic: string, authorName: string, imageUri?: string, imageAspectRatio?: number) => void;
  authorUid: string;
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
  const [isUploading, setIsUploading] = useState(false);

  const handlePickImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (file) {
        // Revoke previous blob URL to prevent memory leak
        if (rawImageUri && rawImageUri.startsWith('blob:')) {
          URL.revokeObjectURL(rawImageUri);
        }
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
    // Revoke blob URL to free memory
    if (rawImageUri && rawImageUri.startsWith('blob:')) {
      URL.revokeObjectURL(rawImageUri);
    }
    setImageUri(null);
    setRawImageUri(null);
    setCropRatio('Original');
  };

  const handlePost = async () => {
    if (!text.trim() || text.trim().length < 10) {
      setError('Please write at least 10 characters');
      return;
    }
    setIsUploading(true);
    try {
      let finalImageUri: string | undefined;
      // Upload image to Firebase Storage if present
      if (imageUri && authorUid) {
        try {
          finalImageUri = await uploadPostImage(authorUid, imageUri);
        } catch (uploadErr) {
          console.error('Image upload failed:', uploadErr);
          // Fall back to dataURL if storage upload fails
          finalImageUri = imageUri;
        }
      }
      onPost(text.trim(), topic, motherName || 'Anonymous Mom', finalImageUri, finalImageUri ? imageAspectRatio : undefined);
      setText('');
      setTopic('General');
      setError('');
      setImageUri(null);
      setRawImageUri(null);
      setCropRatio('Original');
      onClose();
    } finally {
      setIsUploading(false);
    }
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
              <Ionicons name="camera-outline" size={18} color={Colors.primary} />
              <Text style={newPostStyles.photoBtnText}>Add Photo</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[newPostStyles.postBtn, isUploading && { opacity: 0.6 }]}
            onPress={handlePost}
            activeOpacity={0.85}
            disabled={isUploading}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={newPostStyles.postBtnGrad}
            >
              <Text style={newPostStyles.postBtnText}>{isUploading ? 'Uploading…' : 'Post to Community'}</Text>
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
    backgroundColor: '#FAFAFB',
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
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDF5',
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
  topicChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryAlpha05 },
  topicChipText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: '#9CA3AF' },
  topicChipTextActive: { fontFamily: Fonts.sansBold, color: Colors.primary },
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
  photoBtnText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: Colors.primary },
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
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryAlpha08,
  },
  ratioBtnText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  ratioBtnTextActive: { color: Colors.primary },
  postBtn: { borderRadius: 18, overflow: 'hidden', marginTop: 4 },
  postBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  postBtnText: { fontFamily: Fonts.sansBold, color: '#ffffff', fontSize: 16 },
});

// ─── Compose Card — LinkedIn-style prompt to open NewPostModal ────────────────

function ComposeCard({ onPress }: { onPress: () => void }) {
  const { motherName, photoUrl } = useProfileStore();
  const firstName = (motherName || 'You').split(' ')[0];

  return (
    <TouchableOpacity
      style={composeStyles.card}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={composeStyles.topRow}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={composeStyles.avatar} />
        ) : (
          <GradientAvatar name={motherName || 'M'} size={40} />
        )}
        <View style={composeStyles.promptPill}>
          <Text style={composeStyles.promptText}>
            Share something, {firstName}…
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const composeStyles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EDE9F6',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  promptPill: {
    flex: 1,
    backgroundColor: '#F8F4FF',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#EDE9F6',
  },
  promptText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#9ca3af',
  },
});

// ─── My Profile Card — Premium Dark Hero ──────────────────────────────────────

function MyProfileCard({
  onEdit,
  onPostsPress,
  onFollowersPress,
  onFollowingPress,
}: {
  onEdit: () => void;
  onPostsPress: () => void;
  onFollowersPress: () => void;
  onFollowingPress: () => void;
}) {
  const {
    motherName, photoUrl, parentGender, bio, expertise,
    kids, visibilitySettings, profile,
  } = useProfileStore();
  const { getUserPostCount } = useCommunityStore();
  const { followersCount, followingCount } = useSocialStore();
  const [imgErr, setImgErr] = useState(false);

  // Reset error state when photoUrl changes (e.g. after upload)
  useEffect(() => { setImgErr(false); }, [photoUrl]);

  const postCount = getUserPostCount(motherName);
  const initial = (motherName || 'M').charAt(0).toUpperCase();
  const genderLabel = parentGender === 'mother' ? 'Mother' : parentGender === 'father' ? 'Father' : parentGender === 'other' ? 'Parent' : 'Parent';
  const kidsLabel = kids.length === 0 ? 'No kids added' : kids.length === 1 ? `${genderLabel} of 1` : `${genderLabel} of ${kids.length}`;

  const hasPhoto = photoUrl && !imgErr;
  const isProfileComplete = !!(profile?.state && profile?.diet && bio && expertise.length > 0);

  // Stat 3: state / location

  return (
    <View style={heroStyles.card}>
      {/* Edit button — flat lilac chip, top-right. The previous "frosted
          glass" white-on-white style made it disappear once the card went
          light. */}
      <TouchableOpacity style={heroStyles.editBtn} onPress={onEdit} activeOpacity={0.75}>
        <Ionicons name="create-outline" size={14} color={Colors.primary} />
        <Text style={heroStyles.editBtnText}>Edit</Text>
      </TouchableOpacity>

      {/* Avatar + name block */}
      <View style={heroStyles.topRow}>
        {/* Gold-ringed avatar */}
        <View style={heroStyles.avatarRing}>
          {hasPhoto ? (
            // @ts-ignore
            <img
              src={photoUrl}
              alt="avatar"
              style={{ width: 66, height: 66, borderRadius: 33, objectFit: 'cover' }}
              onError={() => setImgErr(true)}
            />
          ) : (
            <LinearGradient
              colors={[Colors.primary, Colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={heroStyles.avatarFallback}
            >
              <Text style={heroStyles.avatarInitial}>{initial}</Text>
            </LinearGradient>
          )}
        </View>

        {/* Name + subtitle */}
        <View style={heroStyles.nameBlock}>
          <Text style={heroStyles.name} numberOfLines={1}>{motherName || 'Your Name'}</Text>
          <Text style={heroStyles.subtitle} numberOfLines={1}>
            {kidsLabel}
            {visibilitySettings.showState && profile?.state ? ` · ${profile.state}` : ''}
          </Text>
        </View>
      </View>

      {/* Stats row — frosted glass boxes */}
      <View style={heroStyles.statsRow}>
        {/* Posts */}
        {visibilitySettings.showPostCount && (
          <TouchableOpacity style={heroStyles.statBox} onPress={onPostsPress} activeOpacity={0.75}>
            <Text style={heroStyles.statNum}>{postCount}</Text>
            <Text style={heroStyles.statLabel}>Posts</Text>
          </TouchableOpacity>
        )}

        {/* Followers */}
        <TouchableOpacity
          style={heroStyles.statBox}
          onPress={onFollowersPress}
          activeOpacity={0.75}
        >
          <Text style={heroStyles.statNum}>{followersCount}</Text>
          <Text style={heroStyles.statLabel}>Followers</Text>
        </TouchableOpacity>

        {/* Following */}
        <TouchableOpacity
          style={heroStyles.statBox}
          onPress={onFollowingPress}
          activeOpacity={0.75}
        >
          <Text style={heroStyles.statNum}>{followingCount}</Text>
          <Text style={heroStyles.statLabel}>Following</Text>
        </TouchableOpacity>

      </View>

      {/* Bio — gated by showBio */}
      {visibilitySettings.showBio && !!bio && (
        <Text style={heroStyles.bioText} numberOfLines={2}>{bio}</Text>
      )}

      {/* Expertise tags — gated by showExpertise */}
      {visibilitySettings.showExpertise && expertise.length > 0 && (
        <View style={heroStyles.tagRow}>
          {expertise.slice(0, 4).map((tag) => (
            <View key={tag} style={heroStyles.tag}>
              <Text style={heroStyles.tagText}>{tag}</Text>
            </View>
          ))}
          {expertise.length > 4 && (
            <View style={heroStyles.tag}>
              <Text style={heroStyles.tagText}>+{expertise.length - 4}</Text>
            </View>
          )}
        </View>
      )}

      {/* Complete profile link */}
      {!isProfileComplete && (
        <TouchableOpacity style={heroStyles.completeLink} onPress={onEdit} activeOpacity={0.75}>
          <Ionicons name="sparkles-outline" size={13} color={Colors.primary} />
          <Text style={heroStyles.completeLinkText}>Complete your profile</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const heroStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    paddingTop: 16,
    position: 'relative',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#F0EDF5',
  },
  editBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F0FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#EDE9F6',
    zIndex: 10,
  },
  editBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    color: Colors.primary,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
    marginTop: 4,
    paddingRight: 68, // leave room for edit chip
  },
  avatarRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#F5F0FF',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: Fonts.sansBold,
    fontSize: 22,
    color: '#ffffff',
  },
  nameBlock: {
    flex: 1,
  },
  name: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    color: '#1C1033',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: '#6b7280',
  },
  // Stats rail sits on a lilac sub-card — was translucent-white on a
  // (now) white hero which rendered invisible.
  statsRow: {
    flexDirection: 'row',
    gap: 0,
    backgroundColor: '#F5F0FF',
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#EDE9F6',
  },
  statBox: {
    flex: 1,
    paddingVertical: 2,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statNum: {
    fontFamily: Fonts.sansBold,
    fontSize: 18,
    color: '#1C1033',
    letterSpacing: -0.2,
  },
  statNumSmall: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: '#1C1033',
    marginTop: 2,
  },
  statLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
    letterSpacing: 0.1,
  },
  bioText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: '#374151',
    lineHeight: 19,
    marginTop: 12,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  tag: {
    backgroundColor: '#F5F0FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: Colors.primary,
  },
  completeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
  },
  completeLinkText: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
    color: Colors.primary,
  },
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
    loadPostsFromFirestore,
    loadMorePosts,
    isLoadingMore,
    hasMorePosts,
    addPostFirestore,
    toggleReactionFirestore,
    addCommentFirestore,
    loadCommentsForPost,
    deletePostFirestore,
    updatePostFirestore,
    deleteCommentFirestore,
  } = useCommunityStore();
  const { motherName, photoUrl: myPhotoUrl } = useProfileStore();
  const profile = useProfileStore((s) => s.profile);
  const activeKid = useProfileStore((s) => s.getActiveKid());
  const { user } = useAuthStore();
  const myUid = user?.uid ?? '';
  const {
    loadSocialData,
    syncPublicProfile,
    unreadCount,
    blockedUids,
  } = useSocialStore();
  // Reuse the same arrays the feed filter already watches (declared below)
  // for the followers/following list modals — one store subscription, two
  // consumers.
  const followers = useSocialStore((s) => s.followers);

  // ── Load data on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    loadPostsFromFirestore();
    if (myUid) {
      // Sync motherName into community store so addPostFirestore can use it
      useCommunityStore.setState({ motherName: motherName || '' });
      loadSocialData();
      syncPublicProfile();
      loadDMCount();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myUid]);

  // Keep community store's motherName in sync whenever profile name changes
  useEffect(() => {
    useCommunityStore.setState({ motherName: motherName || '' });
  }, [motherName]);

  const orderedFilters = useMemo((): CommunityFilter[] => {
    const all: CommunityFilter[] = ['All', 'Newborn', 'Pregnancy', 'Nutrition', 'Mental Health', 'Milestones', 'Products'];
    if (!profile) return all;
    const stage = profile.stage;
    const ageMonths = activeKid && !activeKid.isExpecting ? activeKid.ageInMonths : null;
    if (stage === 'pregnant' || activeKid?.isExpecting) {
      return ['All', 'Pregnancy', 'Nutrition', 'Mental Health', 'Newborn', 'Milestones', 'Products'];
    }
    if (ageMonths !== null && ageMonths < 6) {
      return ['All', 'Newborn', 'Nutrition', 'Mental Health', 'Milestones', 'Pregnancy', 'Products'];
    }
    if (ageMonths !== null && ageMonths < 24) {
      return ['All', 'Milestones', 'Nutrition', 'Newborn', 'Mental Health', 'Products', 'Pregnancy'];
    }
    return all;
  }, [profile, activeKid]);

  const [showNewPost, setShowNewPost] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [viewingUid, setViewingUid] = useState<string | null>(null);
  const [showOwnPosts, setShowOwnPosts] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [showFollowersList, setShowFollowersList] = useState(false);
  const [showFollowingList, setShowFollowingList] = useState(false);
  // Home's "Find moms" Quick Jump tile deep-links here with ?search=1.
  const routeParams = useLocalSearchParams<{ search?: string }>();
  useEffect(() => {
    if (routeParams?.search === '1') {
      setShowUserSearch(true);
    }
  }, [routeParams?.search]);

  // "Moms near you" count for the in-feed tile — hits Firestore once,
  // capped at 50. Hidden if state isn't set yet or no one else is there.
  const [momsInState, setMomsInState] = useState<number>(0);
  useEffect(() => {
    if (!profile?.state || !myUid) return;
    let cancelled = false;
    countProfilesInState(profile.state, myUid)
      .then((n) => { if (!cancelled) setMomsInState(n); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [profile?.state, myUid]);

  // Role-aware noun for the moms-in-state tile — father users shouldn't
  // see "moms in <state>" either as recipient or as described group.
  const nearbyNoun = useMemo(() => {
    const pg = useProfileStore.getState().parentGender;
    const n = momsInState;
    if (pg === 'father' || pg === 'other') return n === 1 ? 'parent' : 'parents';
    return n === 1 ? 'mom' : 'moms';
  }, [momsInState]);
  const [reactorsPost, setReactorsPost] = useState<CommunityPost | null>(null);
  const [reactorsEmoji, setReactorsEmoji] = useState<string | undefined>(undefined);
  const [editingPost, setEditingPost] = useState<import('../../store/useCommunityStore').Post | null>(null);
  const { unreadTotal: unreadDMs, loadUnreadCount: loadDMCount } = useDMStore();
  const [refreshing, setRefreshing] = useState(false);
  const allPosts = getFilteredPosts();
  // Build set of UIDs I follow (for followers-only post filtering)
  const following = useSocialStore((s) => s.following);
  const followingUids = React.useMemo(
    () => new Set(following.map((f) => f.uid)),
    [following],
  );
  // Filter: hide blocked authors + hide followers-only posts from authors I don't follow
  const posts = allPosts.filter((p) => {
    if (blockedUids.includes(p.authorUid)) return false;
    if (p.authorFollowersOnly && p.authorUid && p.authorUid !== myUid && !followingUids.has(p.authorUid)) {
      return false;
    }
    return true;
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadPostsFromFirestore();
      if (myUid) {
        await loadSocialData();
      }
    } catch (_) {}
    setRefreshing(false);
  }, [myUid]);

  return (
    <View style={styles.container}>
      {/* ── Dark Gradient Header ── */}
      <LinearGradient
        colors={['#FFFFFF', '#FFFFFF', '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 14 }]}
      >
        <View style={styles.glowTopRight} pointerEvents="none" />
        <View style={styles.glowBottomLeft} pointerEvents="none" />
        <View style={styles.headerInner}>
          <Text style={styles.headerTitle}>Community</Text>
          <View style={styles.headerRight}>
            {/* Search people */}
            <TouchableOpacity
              style={styles.notifBtn}
              onPress={() => setShowUserSearch(true)}
              activeOpacity={0.75}
              accessibilityLabel="Search people"
            >
              <Ionicons name="search-outline" size={20} color="#374151" />
            </TouchableOpacity>

            {/* Messages */}
            <TouchableOpacity
              style={styles.notifBtn}
              onPress={() => setShowMessages(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="chatbubbles-outline" size={20} color="#374151" />
              {unreadDMs > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadDMs > 9 ? '9+' : unreadDMs}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Notifications bell */}
            <TouchableOpacity
              style={styles.notifBtn}
              onPress={() => setShowNotifications(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="notifications-outline" size={22} color="#374151" />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

          </View>
        </View>
      </LinearGradient>

      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />

      {/* Notifications sheet */}
      <NotificationsSheet
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
        onViewProfile={(uid) => { setShowNotifications(false); setViewingUid(uid); }}
      />

      {/* Conversations list */}
      <ConversationsSheet
        visible={showMessages}
        onClose={() => setShowMessages(false)}
      />

      {/* Own posts list */}
      {myUid && (
        <UserPostsSheet
          uid={myUid}
          name={motherName}
          visible={showOwnPosts}
          onClose={() => setShowOwnPosts(false)}
          onEditPost={(p) => setEditingPost(p)}
        />
      )}

      {/* Edit post modal */}
      {editingPost && (
        <EditPostModal
          visible={!!editingPost}
          initialText={editingPost.text}
          initialTopic={editingPost.topic}
          onClose={() => setEditingPost(null)}
          onSave={async ({ text, topic }) => {
            if (!myUid || !editingPost) return;
            await updatePostFirestore(editingPost.id, myUid, { text, topic });
            setEditingPost(null);
          }}
        />
      )}

      {/* User profile modal (uid-based, loads from Firestore) */}
      {viewingUid !== null && (
        <UserProfileModalComponent
          uid={viewingUid}
          visible={viewingUid !== null}
          onClose={() => setViewingUid(null)}
          onEditProfile={() => setShowSettings(true)}
        />
      )}

      {/* Posts */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary, Colors.primary]}
          />
        }
        ListHeaderComponent={
          <>
            <EmailVerifyBanner />
            <ContextualAskChip prompt="Ask Maamitra about what other moms are discussing" />
            <MyProfileCard
              onEdit={() => setShowSettings(true)}
              onPostsPress={() => setShowOwnPosts(true)}
              onFollowersPress={() => setShowFollowersList(true)}
              onFollowingPress={() => setShowFollowingList(true)}
            />

            {/* Moms-in-state shortcut — opens the user-search sheet so the
                user can find people in their state. Hidden when state
                isn't set or there's no one else there. */}
            {profile?.state && momsInState > 0 && (
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.nearbyCard}
                onPress={() => setShowUserSearch(true)}
              >
                <View style={styles.nearbyIconWrap}>
                  <Ionicons name="people-outline" size={22} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nearbyTitle}>
                    {momsInState >= 50 ? '50+' : momsInState} {nearbyNoun} in {profile.state}
                  </Text>
                  <Text style={styles.nearbySub}>Tap to search and connect</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#b5a9d5" />
              </TouchableOpacity>
            )}

            <ComposeCard onPress={() => setShowNewPost(true)} />

            {/* Topic filters — below compose so posting is the primary action */}
            <View style={styles.filtersWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filtersRow}
              >
                {orderedFilters.map((f) => (
                  <TouchableOpacity
                    key={f}
                    onPress={() => setFilter(f)}
                    activeOpacity={0.75}
                    style={{ height: 32, borderRadius: 16, overflow: 'hidden' }}
                  >
                    {activeFilter === f ? (
                      <LinearGradient
                        colors={[Colors.primary, Colors.primary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ height: 32, borderRadius: 16, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Text style={{ fontFamily: Fonts.sansBold, fontSize: 12, color: '#ffffff' }}>{f}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={{ height: 32, borderRadius: 16, paddingHorizontal: 14, backgroundColor: '#EDE9F6', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.primary }}>{f}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Fade overlay on right edge */}
              <View style={styles.filterFadeRight} pointerEvents="none">
                <LinearGradient
                  colors={['rgba(255,248,252,0)', '#FAFAFB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>
            </View>

            {activeFilter !== 'All' && TOPIC_ILLUSTRATION[activeFilter] ? (
              <View style={styles.topicBannerWrap}>
                <Illustration
                  name={TOPIC_ILLUSTRATION[activeFilter]}
                  style={styles.topicBannerImg}
                  contentFit="cover"
                  accessibilityLabel={`${activeFilter} topic`}
                />
              </View>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <PostCardComponent
            post={item}
            currentUserUid={myUid}
            currentUserName={motherName}
            currentUserPhotoUrl={myPhotoUrl || undefined}
            blockedUids={blockedUids}
            onReact={(postId, emoji) => {
              if (myUid) {
                toggleReactionFirestore(postId, myUid, motherName || 'Anonymous', emoji);
              } else {
                toggleReaction(postId, emoji);
              }
            }}
            onToggleComments={(postId) => {
              const post = useCommunityStore.getState().posts.find((p) => p.id === postId);
              // Only fetch from Firestore when opening (not closing), and skip seed posts
              if (post && !post.showComments && post.authorUid) {
                loadCommentsForPost(postId);
              }
              toggleComments(postId);
            }}
            onAddComment={(postId, text) => {
              if (myUid) {
                addCommentFirestore(postId, myUid, motherName || 'Anonymous', text, myPhotoUrl || undefined);
              } else {
                addComment(postId, motherName || 'Anonymous', text);
              }
            }}
            onViewProfile={(uid, _name) => {
              if (uid) setViewingUid(uid);
            }}
            onDeletePost={myUid && item.authorUid === myUid ? (postId) => {
              deletePostFirestore(postId, myUid).catch(() => {
                Alert.alert('Error', 'Could not delete the post. Please try again.');
              });
            } : undefined}
            onEditPost={myUid && item.authorUid === myUid ? (postId) => {
              const p = posts.find((x) => x.id === postId);
              if (p) setEditingPost(p);
            } : undefined}
            onDeleteComment={myUid ? (postId, commentId) => {
              deleteCommentFirestore(postId, commentId).catch(() => {
                Alert.alert('Error', 'Could not delete the comment. Please try again.');
              });
            } : undefined}
            onShowReactors={(postId, emoji) => {
              // CommunityPost type (from services/social) matches the shape
              // we need for fetchPostReactors — cast is safe here.
              const p = posts.find((x) => x.id === postId) as any as CommunityPost | undefined;
              if (!p) return;
              setReactorsPost(p);
              setReactorsEmoji(emoji);
            }}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Illustration name="emptyCommunity" style={styles.emptyIllus} contentFit="contain" />
            <Text style={styles.emptyText}>No posts in this category yet.{'\n'}Be the first to share!</Text>
          </View>
        }
        onEndReached={() => {
          if (hasMorePosts && !isLoadingMore) loadMorePosts();
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={isLoadingMore ? (
          <View style={styles.footerLoader}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : null}
        showsVerticalScrollIndicator={false}
      />

      <NewPostModal
        visible={showNewPost}
        onClose={() => setShowNewPost(false)}
        authorUid={myUid}
        onPost={(text, topic, _authorName, imageUri, imageAspectRatio) => {
          if (myUid) {
            const followersOnly = useProfileStore.getState().visibilitySettings?.postsFollowersOnly ?? false;
            addPostFirestore(text, topic, myUid, imageUri, imageAspectRatio, myPhotoUrl || undefined, followersOnly).catch(() => {
              if (typeof window !== 'undefined') {
                window.alert('Failed to publish your post. Please check your connection and try again.');
              }
            });
          } else {
            addPost(text, topic, motherName || 'Anonymous', imageUri, imageAspectRatio);
          }
        }}
      />

      {/* User search sheet — opened from header search icon */}
      <UserSearchSheet
        visible={showUserSearch}
        onClose={() => setShowUserSearch(false)}
        onSelectUser={(uid) => {
          setViewingUid(uid);
        }}
      />

      {/* Reactors sheet — opened from PostCard's "See who reacted" chip or
          a long-press on a specific reaction emoji. */}
      <ReactorsSheet
        visible={reactorsPost !== null}
        post={reactorsPost}
        emojiFilter={reactorsEmoji}
        onClose={() => { setReactorsPost(null); setReactorsEmoji(undefined); }}
        onSelectUser={(uid) => setViewingUid(uid)}
      />

      {/* Followers / Following lists — opened from the MyProfileCard
          counts. Tapping a row opens that user's profile. */}
      <FollowListModal
        visible={showFollowersList}
        title="Followers"
        items={followEntriesToProfiles(followers ?? [])}
        onClose={() => setShowFollowersList(false)}
        onViewProfile={(uid) => {
          setShowFollowersList(false);
          setViewingUid(uid);
        }}
      />
      <FollowListModal
        visible={showFollowingList}
        title="Following"
        items={followEntriesToProfiles(following ?? [])}
        onClose={() => setShowFollowingList(false)}
        onViewProfile={(uid) => {
          setShowFollowingList(false);
          setViewingUid(uid);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFB' },
  nearbyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  nearbyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    color: Colors.textDark,
  },
  nearbySub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  glowTopRight: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'transparent', top: -60, right: -40,
  },
  glowBottomLeft: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'transparent', bottom: -40, left: -20,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontFamily: Fonts.serif, fontSize: 26, color: '#1C1033', letterSpacing: -0.3 },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notifBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.primary,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#1C1033',
  },
  notifBadgeText: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    color: '#ffffff',
    lineHeight: 12,
  },
  postBtn: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  postBtnText: { fontFamily: Fonts.sansBold, color: '#ffffff', fontSize: 14 },
  topicBannerWrap: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFF8F1',
    aspectRatio: 5 / 2,
  },
  topicBannerImg: {
    width: '100%',
    height: '100%',
  },

  filtersWrap: {
    backgroundColor: '#FAFAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#EDE9F6',
    flexShrink: 0,
    flexGrow: 0,
    position: 'relative',
  },
  filtersRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'center',
    flexDirection: 'row',
    paddingRight: 48,
  },
  filterChip: {
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: '#F8F4FF',
    borderWidth: 1.5,
    borderColor: '#EDE9F6',
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: '#6B7280' },
  filterChipTextActive: { fontFamily: Fonts.sansBold, color: '#ffffff' },
  filterFadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 40,
  },
  listContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  empty: { alignItems: 'center', paddingTop: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyIllus: { width: 220, height: 180, marginBottom: 8 },
  emptyText: { fontFamily: Fonts.sansRegular, fontSize: 15, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },
  footerLoader: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  footerText: { fontFamily: Fonts.sansRegular, fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 16 },
});
