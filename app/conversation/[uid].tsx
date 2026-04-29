import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { useDMStore } from '../../store/useDMStore';
import { useProfileStore } from '../../store/useProfileStore';
import { useSocialStore } from '../../store/useSocialStore';
import { getPublicProfile, type UserPublicProfile } from '../../services/social';
import { getOrCreateConversation, conversationId } from '../../services/messages';
import { uploadDMImage } from '../../services/storage';
import GradientAvatar from '../../components/ui/GradientAvatar';
import { Fonts, Colors } from '../../constants/theme';

// ─── Message Bubble ──────────────────────────────────────────────────────────

function MessageBubble({
  text,
  imageUrl,
  isMine,
  time,
}: {
  text: string;
  imageUrl?: string;
  isMine: boolean;
  time: Date;
}) {
  const timeStr = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const hasText = !!text?.trim();

  if (isMine) {
    return (
      <View style={bubbleStyles.myRow}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={bubbleStyles.attachedImage}
            resizeMode="cover"
          />
        ) : null}
        {hasText ? (
          <LinearGradient
            colors={[Colors.primary, Colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[bubbleStyles.myBubble, imageUrl ? { marginTop: 6 } : null]}
          >
            <Text style={bubbleStyles.myText}>{text}</Text>
            <Text style={bubbleStyles.myTime}>{timeStr}</Text>
          </LinearGradient>
        ) : (
          <Text style={[bubbleStyles.myTime, { alignSelf: 'flex-end', marginTop: 4 }]}>{timeStr}</Text>
        )}
      </View>
    );
  }

  return (
    <View style={bubbleStyles.otherRow}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={bubbleStyles.attachedImage}
          resizeMode="cover"
        />
      ) : null}
      {hasText ? (
        <View style={[bubbleStyles.otherBubble, imageUrl ? { marginTop: 6 } : null]}>
          <Text style={bubbleStyles.otherText}>{text}</Text>
          <Text style={bubbleStyles.otherTime}>{timeStr}</Text>
        </View>
      ) : (
        <Text style={[bubbleStyles.otherTime, { alignSelf: 'flex-start', marginTop: 4 }]}>{timeStr}</Text>
      )}
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  myRow: { alignSelf: 'flex-end', maxWidth: '78%', marginVertical: 3, marginRight: 12 },
  myBubble: { borderRadius: 18, borderBottomRightRadius: 4, paddingVertical: 10, paddingHorizontal: 14 },
  myText: { fontFamily: Fonts.sansRegular, fontSize: 15, color: '#ffffff', lineHeight: 21 },
  myTime: { fontFamily: Fonts.sansRegular, fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 4, alignSelf: 'flex-end' },
  otherRow: { alignSelf: 'flex-start', maxWidth: '78%', marginVertical: 3, marginLeft: 12 },
  otherBubble: { backgroundColor: '#ffffff', borderRadius: 18, borderBottomLeftRadius: 4, paddingVertical: 10, paddingHorizontal: 14, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 },
  otherText: { fontFamily: Fonts.sansRegular, fontSize: 15, color: '#1C1033', lineHeight: 21 },
  otherTime: { fontFamily: Fonts.sansRegular, fontSize: 10, color: '#9ca3af', marginTop: 4, alignSelf: 'flex-end' },
  attachedImage: {
    width: 220,
    height: 220,
    borderRadius: 16,
    backgroundColor: '#EDE9F6',
  },
});

// ─── Image compression ──────────────────────────────────────────────────────
// Web-only helper: read a File, downscale to max 1600px on the longer edge,
// re-encode as JPEG 0.85. Keeps Storage uploads + doc-size modest.
async function compressImageToDataUrl(file: File): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });
  try {
    const ImageCtor: any = (window as any).Image;
    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      const el = new ImageCtor();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode image'));
      el.src = raw;
    });
    const max = 1600;
    const longer = Math.max(img.width, img.height);
    const scale = longer > max ? max / longer : 1;
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas ctx unavailable');
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return raw;
  }
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ConversationScreen() {
  const { uid: otherUid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const myUid = user?.uid ?? '';

  const {
    activeMessages,
    isLoadingMessages,
    isSending,
    loadMessages,
    sendMessage,
    markRead,
    subscribeActiveThread,
  } = useDMStore();

  const [text, setText] = useState('');
  const [profile, setProfile] = useState<UserPublicProfile | null>(null);
  const [attachment, setAttachment] = useState<{ dataUrl: string; mimeType: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // If I've blocked the other person, hide their messages and disable
  // the composer. Block enforcement is client-side here — the blocked
  // user can still write to Firestore (their own send succeeds), they
  // just don't appear in my view.
  const blockedUids = useSocialStore((s) => s.blockedUids);
  const isBlocked = !!otherUid && blockedUids.includes(otherUid);
  const visibleMessages = isBlocked
    ? activeMessages.filter((m) => m.senderUid === myUid)
    : activeMessages;

  // Load other user's profile + eagerly create the conversation doc if
  // it doesn't exist yet, then load messages. Without the eager create
  // the messages read rule fails — the rule does `get(conv).data.
  // participants` and errors out when the conv doc is missing.
  useEffect(() => {
    if (!otherUid) return;
    let cancelled = false;
    (async () => {
      const otherProfile = await getPublicProfile(otherUid);
      if (cancelled) return;
      setProfile(otherProfile);

      const myUid = useAuthStore.getState().user?.uid;
      if (!myUid) return;
      const myName = useProfileStore.getState().motherName || 'User';
      const myPhoto = useProfileStore.getState().photoUrl || '';
      try {
        await getOrCreateConversation(
          myUid,
          myName,
          myPhoto,
          otherUid,
          otherProfile?.name || 'User',
          otherProfile?.photoUrl || '',
        );
      } catch (e) {
        console.error('Failed to prepare conversation:', e);
      }
      if (cancelled) return;
      // One-shot prime (so the thread isn't empty during the first
      // onSnapshot round-trip), then attach a live listener that
      // overwrites activeMessages on every write.
      loadMessages(otherUid);
      markRead(otherUid);
    })();
    const teardown = subscribeActiveThread(otherUid);
    return () => {
      cancelled = true;
      teardown();
    };
  }, [otherUid]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (activeMessages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [activeMessages.length]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    // Allow sending image-only messages (no text)
    if ((!trimmed && !attachment) || isSending || !otherUid || !myUid) return;
    if (isBlocked) return; // composer is hidden, but belt-and-suspenders

    let imageUrl: string | undefined;
    if (attachment) {
      try {
        setUploading(true);
        const convId = conversationId(myUid, otherUid);
        imageUrl = await uploadDMImage(convId, myUid, attachment.dataUrl);
      } catch (e: any) {
        setAttachError(e?.message ?? 'Could not upload image. Please try again.');
        setTimeout(() => setAttachError(null), 4000);
        setUploading(false);
        return;
      } finally {
        setUploading(false);
      }
    }

    sendMessage(
      otherUid,
      profile?.name || 'User',
      profile?.photoUrl || '',
      trimmed,
      imageUrl,
    );
    setText('');
    setAttachment(null);
  }, [text, attachment, isSending, otherUid, profile, sendMessage, myUid]);

  const handleAttachPress = () => {
    if (Platform.OS !== 'web') {
      setAttachError('Image upload is available on web. Native support coming soon.');
      setTimeout(() => setAttachError(null), 4000);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: any) => {
    const file: File | undefined = e?.target?.files?.[0];
    if (e?.target) e.target.value = '';
    if (!file) return;
    // Compress on client first so Storage stays cheap + uploads are fast.
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setAttachment({ dataUrl, mimeType: 'image/jpeg' });
    } catch (err: any) {
      setAttachError(err?.message ?? 'Could not read image.');
      setTimeout(() => setAttachError(null), 4000);
    }
  };

  const otherName = profile?.name || 'User';
  const otherPhoto = profile?.photoUrl;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header — light theme, consistent with the rest of the app */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerProfile}>
          {otherPhoto ? (
            <Image source={{ uri: otherPhoto }} style={styles.headerAvatar} />
          ) : (
            <GradientAvatar name={otherName} size={38} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName} numberOfLines={1}>{otherName}</Text>
            {profile?.badge ? (
              <Text style={styles.headerBadge} numberOfLines={1}>{profile.badge}</Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 60}
      >
        {isLoadingMessages ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : visibleMessages.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyEmoji}>{isBlocked ? '🚫' : '💬'}</Text>
            <Text style={styles.emptyTitle}>
              {isBlocked ? 'You blocked this user' : 'Start the conversation'}
            </Text>
            <Text style={styles.emptySubtext}>
              {isBlocked
                ? `Their messages are hidden. Unblock ${otherName} from their profile to see them again.`
                : `Say hi to ${otherName}!`}
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={visibleMessages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble
                text={item.text}
                imageUrl={item.imageUrl}
                isMine={item.senderUid === myUid}
                time={item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt)}
              />
            )}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Attach error banner */}
        {attachError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={14} color="#b91c1c" />
            <Text style={styles.errorBannerText}>{attachError}</Text>
          </View>
        ) : null}

        {/* Attachment preview */}
        {attachment ? (
          <View style={styles.previewRow}>
            <Image source={{ uri: attachment.dataUrl }} style={styles.previewImage} />
            <Text style={styles.previewLabel}>
              {uploading ? 'Uploading…' : 'Photo ready to send'}
            </Text>
            {!uploading && (
              <TouchableOpacity
                onPress={() => setAttachment(null)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityLabel="Remove attachment"
              >
                <Ionicons name="close-circle" size={20} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {/* Hidden file input (web) */}
        {Platform.OS === 'web'
          ? React.createElement('input', {
              ref: (el: HTMLInputElement | null) => { fileInputRef.current = el; },
              type: 'file',
              accept: 'image/*',
              onChange: handleFileChange,
              style: { display: 'none' },
            })
          : null}

        {/* Input — hidden while the other user is blocked. Replying
            after a block would silently fail and confuse the user. */}
        {isBlocked ? (
          <View style={[styles.blockedNotice, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Ionicons name="ban-outline" size={16} color="#9ca3af" />
            <Text style={styles.blockedNoticeText}>
              You blocked {otherName}. Unblock them from their profile to message again.
            </Text>
          </View>
        ) : (
          <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TouchableOpacity
              onPress={handleAttachPress}
              style={styles.attachBtn}
              accessibilityLabel="Attach photo"
              disabled={uploading}
            >
              <Ionicons
                name={uploading ? 'hourglass-outline' : 'image-outline'}
                size={20}
                color={uploading ? '#9ca3af' : Colors.primary}
              />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Type a message..."
              placeholderTextColor="#9ca3af"
              multiline
              maxLength={2000}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={(!text.trim() && !attachment) || isSending || uploading}
              style={[styles.sendBtn, ((!text.trim() && !attachment) || isSending || uploading) && { opacity: 0.4 }]}
            >
              <LinearGradient
                colors={[Colors.primary, Colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sendBtnGrad}
              >
                {isSending || uploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={18} color="#ffffff" />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFB' },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDF5',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerProfile: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  headerName: { fontFamily: Fonts.sansBold, fontSize: 16, color: '#1C1033' },
  headerBadge: { fontFamily: Fonts.sansRegular, fontSize: 12, color: '#9ca3af' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontFamily: Fonts.sansSemiBold, fontSize: 17, color: '#1C1033' },
  emptySubtext: { fontFamily: Fonts.sansRegular, fontSize: 14, color: '#9ca3af' },
  messageList: { paddingVertical: 12 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#EDE9F6',
    backgroundColor: '#FAFAFB',
  },
  blockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EDE9F6',
    backgroundColor: '#F5F0FF',
  },
  blockedNoticeText: {
    flex: 1,
    fontFamily: Fonts.sansMedium,
    fontSize: 12.5,
    color: '#6b7280',
    lineHeight: 18,
  },
  input: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: Fonts.sansRegular,
    color: '#1C1033',
    borderWidth: 1.5,
    borderColor: '#EDE9F6',
    maxHeight: 100,
  },
  sendBtn: { marginBottom: 2 },
  sendBtnGrad: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryAlpha08,
    marginBottom: 2,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#F8F3FF',
    borderWidth: 1,
    borderColor: Colors.primaryAlpha12,
  },
  previewImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#E5E1EE',
  },
  previewLabel: {
    flex: 1,
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#1C1033',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.sansMedium,
    color: '#991b1b',
  },
});
