/**
 * Marketing Studio — Create canvas (Phase 2).
 *
 * Three-step wizard inside the marketing area:
 *   1. Prompt — what's this post about? Pick quality (Best/Quick).
 *   2. Pick — 4 brand-locked variants stream in. Click to choose.
 *   3. Caption + schedule — auto-generated caption (editable). Save as
 *      draft (pending_review) or schedule for later.
 *
 * On save → drops admin into Posts → To-review with the new draft open.
 *
 * Brand-style lock comes from `marketing_brand/main.styleProfile` —
 * server-side prompt prefix. The user only types the subject; we add the
 * MaaMitra style on top.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';
import { friendlyError } from '../../../services/marketingErrors';
import {
  createStudioDraft,
  generateStudioVariants,
} from '../../../services/marketingStudio';

interface Variant {
  variantId: string;
  url: string;
  storagePath: string;
}

type Quality = 'best' | 'quick';
type Step = 1 | 2 | 3;

const QUALITY_INFO: Record<Quality, { label: string; sub: string; provider: 'imagen' | 'flux'; perVariantInr: number }> = {
  best:  { label: 'Best',  sub: 'Stronger Indian context. ~₹3.30 per image.', provider: 'imagen', perVariantInr: 3.30 },
  quick: { label: 'Quick', sub: 'Fast, ~₹0.25 per image. Use for iteration.', provider: 'flux',   perVariantInr: 0.25 },
};

export default function StudioCanvasScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ prompt?: string }>();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [step, setStep] = useState<Step>(1);
  const [prompt, setPrompt] = useState(typeof params.prompt === 'string' ? params.prompt : '');
  const [quality, setQuality] = useState<Quality>('best');
  const [variantCount] = useState<1 | 2 | 3 | 4>(4);

  const [variants, setVariants] = useState<Variant[]>([]);
  const [generating, setGenerating] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const [caption, setCaption] = useState('');
  const [captionGenerating, setCaptionGenerating] = useState(false);
  const [scheduleAt, setScheduleAt] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okBanner, setOkBanner] = useState<string | null>(null);

  const picked = useMemo(() => variants.find((v) => v.variantId === pickedId) ?? null, [variants, pickedId]);
  const estCost = QUALITY_INFO[quality].perVariantInr * variantCount;

  async function handleGenerate() {
    if (!prompt.trim()) {
      setError('Tell me what to make first.');
      return;
    }
    setError(null);
    setVariants([]);
    setPickedId(null);
    setGenerating(true);
    setStep(2);
    try {
      const r = await generateStudioVariants({
        prompt: prompt.trim(),
        variantCount,
        model: QUALITY_INFO[quality].provider,
        aspectRatio: '1:1',
      });
      if (!r.ok) {
        setError(friendlyError('Generate', r));
        setStep(1);
      } else {
        setVariants(r.variants);
        if (r.failedCount > 0) {
          setOkBanner(`${r.variants.length} of ${variantCount} variants made it. ${r.failedCount} skipped — try Generate again to fill in.`);
        }
      }
    } catch (e) {
      setError(friendlyError('Generate', e));
      setStep(1);
    } finally {
      setGenerating(false);
    }
  }

  function handlePick(v: Variant) {
    setPickedId(v.variantId);
  }

  async function handleAdvanceToCaption() {
    if (!picked) return;
    setStep(3);
    if (!caption.trim()) {
      // Lazy-generate caption when entering step 3 if admin hasn't typed one
      // (we just call createStudioDraft preflight to get the AI caption?
      // No — we'll synthesize on createStudioDraft call. Just leave empty
      // and the placeholder hints "AI will write one".
    }
  }

  async function handleSave(asScheduled: boolean) {
    if (!picked) return;
    if (asScheduled && !scheduleAt) {
      setError('Pick a date and time first.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const r = await createStudioDraft({
        prompt: prompt.trim(),
        imageUrl: picked.url,
        imageStoragePath: picked.storagePath,
        caption: caption.trim() || undefined,
        scheduledAt: asScheduled ? scheduleInputToIso(scheduleAt) : null,
      });
      if (!r.ok) {
        setError(friendlyError('Save', r));
        setSaving(false);
        return;
      }
      // Success — drop into Posts → To-review with the new draft open.
      const tab = asScheduled ? 'calendar' : 'inbox';
      router.replace(`/admin/marketing/posts?tab=${tab}` as any);
      // Open the slide-over too via the legacy /drafts deep-link.
      setTimeout(() => router.push(`/admin/marketing/drafts?open=${r.draftId}` as any), 50);
    } catch (e) {
      setError(friendlyError('Save', e));
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Create' }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.bgLight }}
        contentContainerStyle={[styles.body, isWide && styles.bodyWide]}
      >
        {/* Step indicator */}
        <View style={styles.stepRow}>
          <StepDot n={1} active={step === 1} done={step > 1} label="Prompt" />
          <StepLine active={step >= 2} />
          <StepDot n={2} active={step === 2} done={step > 2} label="Pick" />
          <StepLine active={step >= 3} />
          <StepDot n={3} active={step === 3} done={false} label="Save" />
        </View>

        {error ? (
          <View style={styles.errBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
            <Text style={styles.errText}>{error}</Text>
            <Pressable onPress={() => setError(null)} hitSlop={8}>
              <Ionicons name="close" size={16} color={Colors.error} />
            </Pressable>
          </View>
        ) : null}

        {okBanner && step === 2 ? (
          <View style={styles.warnBanner}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.warning} />
            <Text style={styles.warnText}>{okBanner}</Text>
            <Pressable onPress={() => setOkBanner(null)} hitSlop={8}>
              <Ionicons name="close" size={16} color={Colors.warning} />
            </Pressable>
          </View>
        ) : null}

        {step === 1 ? (
          <Step1Prompt
            prompt={prompt} setPrompt={setPrompt}
            quality={quality} setQuality={setQuality}
            estCost={estCost}
            onGenerate={handleGenerate}
            generating={generating}
          />
        ) : step === 2 ? (
          <Step2Pick
            prompt={prompt}
            variants={variants}
            variantCount={variantCount}
            generating={generating}
            pickedId={pickedId}
            onPick={handlePick}
            onEdit={() => setStep(1)}
            onRetry={handleGenerate}
            onContinue={handleAdvanceToCaption}
          />
        ) : (
          <Step3Save
            prompt={prompt}
            picked={picked}
            caption={caption}
            setCaption={setCaption}
            captionGenerating={captionGenerating}
            scheduleAt={scheduleAt}
            setScheduleAt={setScheduleAt}
            saving={saving}
            onBack={() => setStep(2)}
            onSaveDraft={() => handleSave(false)}
            onSchedule={() => handleSave(true)}
          />
        )}
      </ScrollView>
    </>
  );
}

// ── Step 1: Prompt ──────────────────────────────────────────────────────────

function Step1Prompt({
  prompt, setPrompt, quality, setQuality, estCost, onGenerate, generating,
}: {
  prompt: string; setPrompt: (v: string) => void;
  quality: Quality; setQuality: (q: Quality) => void;
  estCost: number;
  onGenerate: () => void; generating: boolean;
}) {
  const valid = prompt.trim().length >= 3;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>What's this post about?</Text>
      <Text style={styles.cardHint}>Describe the scene or topic in 1-2 sentences. We'll keep it on-brand for you.</Text>
      <TextInput
        value={prompt}
        onChangeText={setPrompt}
        placeholder="e.g. A mom and her toddler enjoying healthy snacks together"
        placeholderTextColor={Colors.textMuted}
        style={styles.promptInput}
        multiline
        maxLength={500}
        autoFocus
      />
      <Text style={styles.charCount}>{prompt.length} / 500</Text>

      <Text style={[styles.cardTitle, { marginTop: Spacing.lg }]}>Quality</Text>
      <View style={styles.qualityRow}>
        {(['best', 'quick'] as Quality[]).map((q) => {
          const info = QUALITY_INFO[q];
          const selected = q === quality;
          return (
            <Pressable
              key={q}
              onPress={() => setQuality(q)}
              style={[styles.qualityCard, selected && styles.qualityCardSelected]}
            >
              <View style={styles.qualityHead}>
                <Text style={[styles.qualityLabel, selected && { color: Colors.primary }]}>{info.label}</Text>
                {selected ? <Ionicons name="checkmark-circle" size={16} color={Colors.primary} /> : null}
              </View>
              <Text style={styles.qualitySub}>{info.sub}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.lg }}>
        <Text style={styles.estCost}>≈ ₹{estCost.toFixed(2)} for 4 variants</Text>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={valid && !generating ? onGenerate : undefined}
          disabled={!valid || generating}
          style={[styles.primaryBtn, (!valid || generating) && styles.primaryBtnDisabled]}
        >
          {generating ? (
            <>
              <ActivityIndicator size="small" color={Colors.white} />
              <Text style={styles.primaryBtnLabel}>Generating…</Text>
            </>
          ) : (
            <>
              <Ionicons name="sparkles" size={16} color={Colors.white} />
              <Text style={styles.primaryBtnLabel}>Generate 4 variants</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ── Step 2: Pick ────────────────────────────────────────────────────────────

function Step2Pick({
  prompt, variants, variantCount, generating, pickedId, onPick, onEdit, onRetry, onContinue,
}: {
  prompt: string;
  variants: Variant[];
  variantCount: number;
  generating: boolean;
  pickedId: string | null;
  onPick: (v: Variant) => void;
  onEdit: () => void;
  onRetry: () => void;
  onContinue: () => void;
}) {
  const slots = Array.from({ length: variantCount });
  return (
    <View style={{ gap: Spacing.md }}>
      {/* Prompt summary card */}
      <View style={styles.promptSummary}>
        <View style={{ flex: 1 }}>
          <Text style={styles.promptSummaryLabel}>YOUR PROMPT</Text>
          <Text style={styles.promptSummaryText} numberOfLines={3}>{prompt}</Text>
        </View>
        <Pressable onPress={onEdit} style={styles.editLink} hitSlop={8}>
          <Ionicons name="create-outline" size={14} color={Colors.primary} />
          <Text style={styles.editLinkLabel}>Edit</Text>
        </Pressable>
      </View>

      {/* Variant grid */}
      <View style={styles.variantGrid}>
        {slots.map((_, i) => {
          const v = variants[i];
          const ready = !!v;
          const selected = v && pickedId === v.variantId;
          return (
            <Pressable
              key={i}
              onPress={ready ? () => onPick(v) : undefined}
              disabled={!ready}
              style={[styles.variantCard, selected && styles.variantCardSelected]}
            >
              {ready ? (
                <Image source={{ uri: v.url }} style={styles.variantImage} resizeMode="cover" />
              ) : generating ? (
                <View style={[styles.variantImage, styles.variantSkeleton]}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.variantSkeletonText}>Generating…</Text>
                </View>
              ) : (
                <View style={[styles.variantImage, styles.variantSkeleton]}>
                  <Ionicons name="image-outline" size={28} color={Colors.textMuted} />
                  <Text style={styles.variantSkeletonText}>Skipped</Text>
                </View>
              )}
              <View style={styles.variantBadge}>
                <Text style={styles.variantBadgeLabel}>{String.fromCharCode(65 + i)}</Text>
              </View>
              {selected ? (
                <View style={styles.variantCheck}>
                  <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <Pressable onPress={onRetry} disabled={generating} style={styles.ghostBtn}>
          <Ionicons name="refresh" size={16} color={Colors.textDark} />
          <Text style={styles.ghostBtnLabel}>Try again</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={pickedId ? onContinue : undefined}
          disabled={!pickedId}
          style={[styles.primaryBtn, !pickedId && styles.primaryBtnDisabled]}
        >
          <Text style={styles.primaryBtnLabel}>Use this image</Text>
          <Ionicons name="arrow-forward" size={16} color={Colors.white} />
        </Pressable>
      </View>
    </View>
  );
}

// ── Step 3: Save ────────────────────────────────────────────────────────────

function Step3Save({
  prompt, picked, caption, setCaption, captionGenerating, scheduleAt, setScheduleAt,
  saving, onBack, onSaveDraft, onSchedule,
}: {
  prompt: string;
  picked: Variant | null;
  caption: string; setCaption: (v: string) => void;
  captionGenerating: boolean;
  scheduleAt: string; setScheduleAt: (v: string) => void;
  saving: boolean;
  onBack: () => void;
  onSaveDraft: () => void;
  onSchedule: () => void;
}) {
  if (!picked) {
    return (
      <View style={styles.card}>
        <Text>Pick a variant first.</Text>
      </View>
    );
  }
  return (
    <View style={[styles.savePane, { flexDirection: 'column' }]}>
      <View style={styles.savePreview}>
        <Image source={{ uri: picked.url }} style={styles.savePreviewImage} resizeMode="cover" />
        <Pressable onPress={onBack} style={styles.changePickBtn}>
          <Ionicons name="swap-horizontal" size={14} color={Colors.primary} />
          <Text style={styles.changePickLabel}>Change image</Text>
        </Pressable>
      </View>

      <View style={[styles.card, { gap: Spacing.md }]}>
        <View>
          <Text style={styles.cardTitle}>Caption</Text>
          <Text style={styles.cardHint}>
            {captionGenerating ? 'Writing one in your brand voice…' : caption.trim() ? 'Edit anytime — saved when you save the draft.' : "Leave blank — we'll write one in your brand voice when you save."}
          </Text>
        </View>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder={`(AI will write a caption based on: "${prompt.slice(0, 60)}…")`}
          placeholderTextColor={Colors.textMuted}
          style={styles.captionInput}
          multiline
          maxLength={2200}
        />
        <Text style={styles.charCount}>{caption.length} / 2200</Text>
      </View>

      <View style={[styles.card, { gap: Spacing.sm }]}>
        <Text style={styles.cardTitle}>When?</Text>
        <Text style={styles.cardHint}>Save as a draft to review later, or pick a date + time to publish automatically.</Text>
        {Platform.OS === 'web' ? (
          <input
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
            style={{
              padding: 10,
              fontSize: 14,
              borderRadius: 8,
              border: `1px solid ${Colors.borderSoft}`,
              background: Colors.bgLight,
              color: Colors.textDark,
              outline: 'none',
            }}
          />
        ) : (
          <TextInput
            value={scheduleAt}
            onChangeText={setScheduleAt}
            placeholder="YYYY-MM-DDTHH:MM (IST)"
            style={styles.captionInput}
          />
        )}
      </View>

      <View style={styles.actionsRow}>
        <Pressable onPress={onBack} disabled={saving} style={styles.ghostBtn}>
          <Ionicons name="arrow-back" size={16} color={Colors.textDark} />
          <Text style={styles.ghostBtnLabel}>Back</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={onSaveDraft} disabled={saving} style={[styles.secondaryBtn, saving && styles.primaryBtnDisabled]}>
          <Ionicons name="bookmark-outline" size={16} color={Colors.primary} />
          <Text style={styles.secondaryBtnLabel}>Save as draft</Text>
        </Pressable>
        <Pressable onPress={onSchedule} disabled={saving || !scheduleAt} style={[styles.primaryBtn, (saving || !scheduleAt) && styles.primaryBtnDisabled]}>
          {saving ? (
            <>
              <ActivityIndicator size="small" color={Colors.white} />
              <Text style={styles.primaryBtnLabel}>Saving…</Text>
            </>
          ) : (
            <>
              <Ionicons name="calendar-outline" size={16} color={Colors.white} />
              <Text style={styles.primaryBtnLabel}>Schedule</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ── Step indicator dots ─────────────────────────────────────────────────────

function StepDot({ n, active, done, label }: { n: number; active: boolean; done: boolean; label: string }) {
  return (
    <View style={styles.stepDotWrap}>
      <View style={[styles.stepDot, active && styles.stepDotActive, done && styles.stepDotDone]}>
        {done ? (
          <Ionicons name="checkmark" size={14} color={Colors.white} />
        ) : (
          <Text style={[styles.stepDotN, active && { color: Colors.white }]}>{n}</Text>
        )}
      </View>
      <Text style={[styles.stepDotLabel, active && { color: Colors.primary, fontWeight: '700' }]}>{label}</Text>
    </View>
  );
}

function StepLine({ active }: { active: boolean }) {
  return <View style={[styles.stepLine, active && { backgroundColor: Colors.primary }]} />;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function scheduleInputToIso(input: string): string {
  // Treat the input string as IST (no timezone) → convert to UTC ISO.
  if (!input) return '';
  // input is "YYYY-MM-DDTHH:MM" — append :00 + IST offset
  const ist = new Date(`${input}:00+05:30`);
  if (isNaN(ist.getTime())) return '';
  return ist.toISOString();
}

const styles = StyleSheet.create({
  body: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 80 },
  bodyWide: { paddingHorizontal: Spacing.xxxl, paddingTop: Spacing.md },

  // Step indicator
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  stepDotWrap: { alignItems: 'center', gap: 4 },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.cardBg,
    borderWidth: 1.5, borderColor: Colors.borderSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepDotDone:   { backgroundColor: Colors.success, borderColor: Colors.success },
  stepDotN: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight },
  stepDotLabel: { fontSize: 10, fontWeight: '600', color: Colors.textMuted },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.borderSoft, marginHorizontal: 4, marginBottom: 16 },

  // Banner
  errBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: Spacing.sm,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.error,
  },
  errText: { flex: 1, fontSize: FontSize.xs, color: Colors.error, fontWeight: '600' },
  warnBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: Spacing.sm,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.warning,
  },
  warnText: { flex: 1, fontSize: FontSize.xs, color: Colors.warning, fontWeight: '600' },

  // Card
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.borderSoft,
    gap: 6,
    ...Shadow.sm,
  },
  cardTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  cardHint: { fontSize: FontSize.xs, color: Colors.textLight, lineHeight: 18 },

  // Step 1
  promptInput: {
    backgroundColor: Colors.bgLight,
    borderWidth: 1, borderColor: Colors.borderSoft,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: FontSize.md, color: Colors.textDark,
    minHeight: 88, textAlignVertical: 'top',
    outlineStyle: 'none' as any,
    marginTop: 8,
  },
  charCount: { fontSize: 11, color: Colors.textMuted, textAlign: 'right' },

  qualityRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 8 },
  qualityCard: {
    flex: 1, padding: Spacing.md,
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.borderSoft,
    gap: 4,
  },
  qualityCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  qualityHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qualityLabel: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  qualitySub: { fontSize: FontSize.xs, color: Colors.textLight, lineHeight: 16 },

  estCost: { fontSize: FontSize.xs, color: Colors.textLight, fontWeight: '600' },

  // Buttons
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
  },
  primaryBtnDisabled: { backgroundColor: Colors.textMuted, opacity: 0.6 },
  primaryBtnLabel: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '700' },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.primary,
  },
  secondaryBtnLabel: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '700' },
  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  ghostBtnLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },

  // Step 2
  promptSummary: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  promptSummaryLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.4, marginBottom: 4 },
  promptSummaryText: { fontSize: FontSize.sm, color: Colors.textDark, lineHeight: 18 },
  editLink: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  editLinkLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },

  variantGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  variantCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: Radius.md,
    borderWidth: 2, borderColor: 'transparent',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.cardBg,
  },
  variantCardSelected: { borderColor: Colors.primary },
  variantImage: { width: '100%', height: '100%' },
  variantSkeleton: {
    backgroundColor: Colors.bgTint,
    alignItems: 'center', justifyContent: 'center',
    gap: 6,
  },
  variantSkeletonText: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },
  variantBadge: {
    position: 'absolute', top: 8, left: 8,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  variantBadgeLabel: { fontSize: 11, fontWeight: '800', color: Colors.white },
  variantCheck: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: Colors.white, borderRadius: 12,
  },

  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },

  // Step 3
  savePane: { gap: Spacing.md },
  savePreview: { alignItems: 'center', gap: 8 },
  savePreviewImage: {
    width: '100%',
    maxWidth: 360,
    aspectRatio: 1,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgTint,
  },
  changePickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  changePickLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },

  captionInput: {
    backgroundColor: Colors.bgLight,
    borderWidth: 1, borderColor: Colors.borderSoft,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: FontSize.sm, color: Colors.textDark,
    minHeight: 120, textAlignVertical: 'top',
    outlineStyle: 'none' as any,
  },
});
