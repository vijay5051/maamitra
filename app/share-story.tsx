/**
 * Share Your Story — user-facing UGC submission flow (M6).
 *
 * Real moms reach this screen via the in-app entry point on community
 * (TODO: wire that link). They submit a photo + story + display name with
 * explicit consent; admin reviews in /admin/marketing/ugc; once rendered
 * the story goes out as an Inspired Story IG post with attribution.
 *
 * Consent flow:
 *  - Required checkbox before submit
 *  - DPDP-compliant consent ledger row written by submitUgc()
 *  - Photo upload to gated Storage path (admin-only read)
 */

import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../constants/theme';
import { submitUgc } from '../services/marketingUgc';
import { useAuthStore } from '../store/useAuthStore';

const STORY_MIN = 50;
const STORY_MAX = 800;

export default function ShareStoryScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [displayName, setDisplayName] = useState<string>(user?.name ?? '');
  const [story, setStory] = useState('');
  const [childAge, setChildAge] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function pickPhoto() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow photo access to attach a picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      // Convert to blob (works on web; on native we use a fetch).
      try {
        const res = await fetch(asset.uri);
        const blob = await res.blob();
        setPhotoBlob(blob);
      } catch (e) {
        Alert.alert('Could not read photo', 'Please try a different image.');
      }
    } catch (e: any) {
      Alert.alert('Image picker error', e?.message ?? String(e));
    }
  }

  function clearPhoto() {
    setPhotoUri(null);
    setPhotoBlob(null);
  }

  const storyLen = story.trim().length;
  const canSubmit = !submitting && !!user && consent && storyLen >= STORY_MIN && storyLen <= STORY_MAX;

  async function handleSubmit() {
    if (!user || !canSubmit) return;
    setSubmitting(true);
    try {
      await submitUgc({
        uid: user.uid,
        displayName: displayName.trim() || 'Anonymous',
        story: story.trim(),
        childAge: childAge.trim() || undefined,
        photo: photoBlob,
        consent,
      });
      setSubmitted(true);
    } catch (e: any) {
      Alert.alert('Could not submit', e?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <View style={styles.successRoot}>
        <Stack.Screen options={{ title: 'Story shared' }} />
        <View style={styles.successCard}>
          <Ionicons name="heart" size={56} color={Colors.primary} />
          <Text style={styles.successTitle}>Thank you, maa ❤</Text>
          <Text style={styles.successBody}>
            We've received your story. Our team will review it (usually within
            24 hours), and if approved you'll see it on our Instagram with
            credit to you. We'll never share anything you didn't agree to.
          </Text>
          <Pressable onPress={() => router.back()} style={styles.successBtn}>
            <Text style={styles.successBtnLabel}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Share your story' }} />
      <ScrollView style={styles.root} contentContainerStyle={styles.body}>
        <View style={styles.heroCard}>
          <Ionicons name="heart-circle" size={36} color={Colors.primary} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.heroTitle}>Share your story with other moms</Text>
            <Text style={styles.heroBody}>
              Your real moments help moms across India feel less alone. We'll
              feature your story on @maamitra.official with credit (or anonymous,
              if you'd like). Reviewed by our team before sharing.
            </Text>
          </View>
        </View>

        <Field label="Your name (or how you'd like to be credited)">
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Priya · Anonymous · A MaaMitra mom"
            placeholderTextColor={Colors.textMuted}
            maxLength={60}
          />
        </Field>

        <Field label="Child's age (optional)" hint="Helps us pair the story with the right audience.">
          <TextInput
            style={styles.input}
            value={childAge}
            onChangeText={setChildAge}
            placeholder="e.g. 4 months, 2 years"
            placeholderTextColor={Colors.textMuted}
            maxLength={20}
          />
        </Field>

        <Field
          label="Your story"
          hint={`${STORY_MIN}–${STORY_MAX} characters. Real moments — what worked, what didn't, what you'd tell another mom.`}
        >
          <TextInput
            style={[styles.input, styles.textarea]}
            value={story}
            onChangeText={setStory}
            placeholder="My 4-month-old refused the bottle for weeks. What finally worked was…"
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={STORY_MAX}
          />
          <Text style={[
            styles.charCount,
            storyLen > 0 && storyLen < STORY_MIN ? { color: Colors.warning } : null,
            storyLen >= STORY_MIN ? { color: Colors.success } : null,
          ]}>
            {storyLen} / {STORY_MAX}
          </Text>
        </Field>

        <Field label="Add a photo (optional)" hint="Square photos work best. Under 8 MB.">
          {photoUri ? (
            <View style={styles.photoWrap}>
              <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
              <Pressable onPress={clearPhoto} style={styles.photoRemove}>
                <Ionicons name="close" size={16} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={pickPhoto} style={styles.photoPick}>
              <Ionicons name="image" size={28} color={Colors.primary} />
              <Text style={styles.photoPickLabel}>Choose photo</Text>
            </Pressable>
          )}
        </Field>

        <Pressable onPress={() => setConsent((v) => !v)} style={styles.consentRow}>
          <View style={[styles.checkbox, consent && styles.checkboxChecked]}>
            {consent ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
          </View>
          <Text style={styles.consentText}>
            I'm sharing this voluntarily and I'm OK with MaaMitra publishing it
            on Instagram and Facebook with credit (as I named above), and using
            the photo in those posts. I understand I can request removal anytime.
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={[styles.submitBtn, !canSubmit && { opacity: 0.5 }]}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={16} color="#fff" />}
          <Text style={styles.submitLabel}>{submitting ? 'Sharing…' : 'Share my story'}</Text>
        </Pressable>

        <Text style={styles.footer}>
          You're shaping how Indian motherhood is talked about online. Thank you for being part of it. ❤
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      <View style={{ marginTop: 6 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgLight },
  body: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 80 },

  heroCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.borderSoft, ...Shadow.sm,
  },
  heroTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textDark },
  heroBody: { fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: 22 },

  field: { gap: 4 },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  fieldHint: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18 },
  input: {
    backgroundColor: Colors.cardBg, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    fontSize: FontSize.md, color: Colors.textDark,
    borderWidth: 1, borderColor: Colors.border,
  },
  textarea: { minHeight: 160, textAlignVertical: 'top' },
  charCount: { textAlign: 'right', fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },

  photoWrap: { aspectRatio: 1, borderRadius: Radius.md, overflow: 'hidden', position: 'relative' },
  photo: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute', top: 8, right: 8,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoPick: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primarySoft,
    paddingVertical: 18, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.primary, borderStyle: 'dashed',
  },
  photoPickLabel: { fontWeight: '700', color: Colors.primary, fontSize: FontSize.md },

  consentRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.cardBg, marginTop: 2,
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  consentText: { flex: 1, fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: 22 },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: Radius.lg,
  },
  submitLabel: { color: '#fff', fontWeight: '800', fontSize: FontSize.md },

  footer: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, fontStyle: 'italic' },

  successRoot: { flex: 1, backgroundColor: Colors.bgLight, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  successCard: {
    maxWidth: 440, alignItems: 'center', gap: Spacing.md,
    padding: Spacing.xl, backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.borderSoft, ...Shadow.sm,
  },
  successTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textDark },
  successBody: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: 24 },
  successBtn: {
    backgroundColor: Colors.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: Radius.lg,
  },
  successBtnLabel: { color: '#fff', fontWeight: '800' },
});
