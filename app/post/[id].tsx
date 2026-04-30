import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import GradientAvatar from '../../components/ui/GradientAvatar';
import TagPill from '../../components/ui/TagPill';
import GradientButton from '../../components/ui/GradientButton';
import { fetchPostById, type CommunityPost } from '../../services/social';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors, Fonts } from '../../constants/theme';
import { sharePost } from '../../lib/share';

// ─── Public post viewer ──────────────────────────────────────────────────────
//
// The deep-link target for every share action in the community. Shows a
// single post + author info. If the viewer is not signed in, shows a sign-up
// CTA so virality converts into real installs.
//
// Kept read-only on purpose: no reactions, no comments, no join-the-thread
// UI here. Anyone who wants to engage is nudged to sign in, which drops
// them straight into /tabs with the post still addressable.

function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PublicPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const [post, setPost] = useState<CommunityPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    fetchPostById(id)
      .then((p) => {
        if (p) setPost(p);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    // Set browser tab title on web for nicer social previews even before
    // the server renders OG tags.
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'MaaMitra — Shared post';
    }
  }, [id]);

  const handleShare = async () => {
    if (!post) return;
    await sharePost({
      postId: post.id,
      authorName: post.authorName || 'A parent',
      text: post.text || '',
    });
  };

  const handlePrimaryCta = () => {
    if (isAuthenticated) {
      router.replace('/(tabs)/community');
    } else {
      router.replace('/(auth)/sign-up');
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.topBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color="#6b7280" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Shared post</Text>
        {post ? (
          <TouchableOpacity
            onPress={handleShare}
            style={styles.topBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Share again"
          >
            <Ionicons name="share-social-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.topBtn} />
        )}
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={Colors.primary} size="large" />
          </View>
        ) : notFound || !post ? (
          <View style={styles.stateBox}>
            <View style={styles.iconChip}>
              <Ionicons name="document-outline" size={22} color={Colors.primary} />
            </View>
            <Text style={styles.stateTitle}>Post not found</Text>
            <Text style={styles.stateSub}>
              It may have been deleted, or the link is incorrect.
            </Text>
          </View>
        ) : (
          <>
            {/* Post card */}
            <View style={styles.card}>
              <View style={styles.authorRow}>
                {post.authorPhotoUrl ? (
                  <Image source={{ uri: post.authorPhotoUrl }} style={styles.avatar} />
                ) : (
                  <GradientAvatar name={post.authorName || '?'} size={44} />
                )}
                <View style={styles.authorMeta}>
                  <Text style={styles.authorName} numberOfLines={1}>
                    {post.authorName || 'A parent'}
                  </Text>
                  <Text style={styles.authorSub} numberOfLines={1}>
                    {post.badge || 'Community member'} · {timeAgo(post.createdAt)}
                  </Text>
                </View>
                {post.topic ? (
                  <TagPill label={post.topic} color={Colors.primary} />
                ) : null}
              </View>

              <Text style={styles.body}>{post.text}</Text>

              {post.imageUri ? (
                <Image
                  source={{ uri: post.imageUri }}
                  style={[
                    styles.image,
                    post.imageAspectRatio
                      ? { aspectRatio: post.imageAspectRatio }
                      : { aspectRatio: 4 / 3 },
                  ]}
                  resizeMode="cover"
                />
              ) : null}

              {post.imageCaption ? (
                <Text style={styles.imageCaption}>{post.imageCaption}</Text>
              ) : null}

              {/* Engagement counters (read-only on this public view). */}
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="heart-outline" size={14} color="#6b7280" />
                  <Text style={styles.metaText}>
                    {Object.values(post.reactions || {}).reduce((a: number, b: any) => a + (b as number), 0)}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="chatbubble-outline" size={14} color="#6b7280" />
                  <Text style={styles.metaText}>{post.commentCount ?? 0}</Text>
                </View>
              </View>
            </View>

            {/* Join / open CTA */}
            <View style={styles.ctaBlock}>
              <Text style={styles.ctaTitle}>
                {isAuthenticated ? 'Join the discussion' : 'Join Indian parents on MaaMitra'}
              </Text>
              <Text style={styles.ctaSub}>
                {isAuthenticated
                  ? 'Open the community to react, comment, and see more posts like this.'
                  : 'Free app for pregnancy, newborn care, and parenting — backed by IAP & FOGSI guidelines.'}
              </Text>
              <GradientButton
                title={isAuthenticated ? 'Open community' : 'Create a free account'}
                onPress={handlePrimaryCta}
                style={styles.ctaBtn}
              />
              {!isAuthenticated && (
                <TouchableOpacity
                  onPress={() => router.replace('/(auth)/sign-in')}
                  style={styles.signInLink}
                  activeOpacity={0.6}
                >
                  <Text style={styles.signInText}>
                    Already a member? <Text style={styles.signInBold}>Sign in</Text>
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgLight },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDF5',
  },
  topBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    color: '#1C1033',
    letterSpacing: 0.1,
  },

  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 18,
  },

  stateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 12,
  },
  iconChip: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F0FF',
  },
  stateTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 16,
    color: '#1C1033',
    marginTop: 4,
  },
  stateSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0EDF5',
    gap: 14,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  authorMeta: { flex: 1 },
  authorName: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    color: '#1C1033',
    letterSpacing: -0.1,
  },
  authorSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  body: {
    fontFamily: Fonts.sansRegular,
    fontSize: 15,
    color: '#1C1033',
    lineHeight: 22,
  },
  image: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#F5F0FF',
  },
  imageCaption: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: '#6b7280',
    marginTop: -4,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#6b7280',
  },

  ctaBlock: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F0EDF5',
    alignItems: 'center',
    gap: 10,
  },
  ctaTitle: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    color: '#1C1033',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  ctaSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
    maxWidth: 320,
  },
  ctaBtn: { width: '100%' },
  signInLink: { paddingVertical: 8 },
  signInText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: '#6b7280',
  },
  signInBold: {
    fontFamily: Fonts.sansBold,
    color: Colors.primary,
  },
});
