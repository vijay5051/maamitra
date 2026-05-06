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
import { useEffect, useMemo, useRef, useState } from 'react';
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
  composeStudioLogo,
  createStudioDraft,
  editStudioImage,
  generateStudioVariants,
  LogoPosition,
  uploadStudioImage,
} from '../../../services/marketingStudio';
import { fetchTopPerformingDraft, TopPerformingDraft } from '../../../services/marketingDrafts';

interface Variant {
  variantId: string;
  url: string;
  storagePath: string;
}

type Quality = 'best' | 'quick';
type Step = 1 | 2 | 3;

const QUALITY_INFO: Record<Quality, { label: string; sub: string; provider: 'dalle' | 'imagen' | 'flux'; perVariantInr: number }> = {
  best:  { label: 'Best',  sub: 'Strongest brand-style match. ~₹3.50 / image.', provider: 'dalle', perVariantInr: 3.50 },
  quick: { label: 'Quick', sub: 'Fast iteration. ~₹0.25 / image.', provider: 'flux',  perVariantInr: 0.25 },
};

export default function StudioCanvasScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ prompt?: string }>();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [step, setStep] = useState<Step>(1);
  const [prompt, setPrompt] = useState(typeof params.prompt === 'string' ? params.prompt : '');
  const [quality, setQuality] = useState<Quality>('best');
  // Carousel mode (Phase 4 item 1) — when true, generate N slides instead
  // of picker variants; no picking step, all slides go into the draft.
  const [carouselMode, setCarouselMode] = useState(false);
  const [slideCount, setSlideCount] = useState<3 | 5>(3);
  const variantCount: 1 | 2 | 3 | 4 | 5 = carouselMode ? slideCount : 4;

  const [variants, setVariants] = useState<Variant[]>([]);
  const [generating, setGenerating] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const [caption, setCaption] = useState('');
  const [captionGenerating, setCaptionGenerating] = useState(false);
  const [scheduleAt, setScheduleAt] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okBanner, setOkBanner] = useState<string | null>(null);

  // Edit mode (Phase 3) — applies a text-edit to the currently picked variant.
  const [editing, setEditing] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [editApplying, setEditApplying] = useState(false);
  // Mask brush (Phase 4 item 5) — when set, the next "Apply edit" sends a
  // mask alongside the prompt so OpenAI only repaints the brushed region.
  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
  const [brushOpen, setBrushOpen] = useState(false);

  // Reuse-winners (Phase 4 item 2) — fetched once on mount when the
  // Studio canvas opens; null = no winner yet (need a posted draft with
  // ≥30 reach in the last 30d).
  const [winner, setWinner] = useState<TopPerformingDraft | null>(null);
  const [winnerLoaded, setWinnerLoaded] = useState(false);

  // Logo overlay (Phase 4 item 3). When the admin toggles "Add brand logo"
  // on Step 3, we replace the picked variant in-place with a server-composed
  // image that has the brand logo in the chosen corner.
  const [logoApplying, setLogoApplying] = useState(false);
  const [logoApplied, setLogoApplied] = useState<LogoPosition | null>(null);

  async function handleApplyLogo(position: LogoPosition) {
    if (!picked || logoApplying) return;
    setError(null);
    setLogoApplying(true);
    try {
      const r = await composeStudioLogo({ imageStoragePath: picked.storagePath, position });
      if (!r.ok) {
        setError(friendlyError('Add logo', r));
        return;
      }
      const newVariant: Variant = { variantId: r.variantId, url: r.url, storagePath: r.storagePath };
      setVariants((prev) => prev.map((v) => (v.variantId === picked.variantId ? newVariant : v)));
      setPickedId(newVariant.variantId);
      setLogoApplied(position);
      setOkBanner('Logo added.');
      setTimeout(() => setOkBanner(null), 2000);
    } catch (e) {
      setError(friendlyError('Add logo', e));
    } finally {
      setLogoApplying(false);
    }
  }

  useEffect(() => {
    void fetchTopPerformingDraft().then((w) => { setWinner(w); setWinnerLoaded(true); });
  }, []);

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
        mode: carouselMode ? 'carousel' : 'single',
      });
      if (!r.ok) {
        setError(friendlyError('Generate', r));
        setStep(1);
      } else {
        setVariants(r.variants);
        if (r.failedCount > 0) {
          const noun = carouselMode ? 'slides' : 'variants';
          setOkBanner(`${r.variants.length} of ${variantCount} ${noun} made it. ${r.failedCount} skipped — try Generate again to fill in.`);
        }
        // In carousel mode there's no picking — all slides go into the draft.
        // Auto-select the first to satisfy the picked-required guards in
        // Step 3, but the save path uses the full variants array.
        if (carouselMode && r.variants.length > 0) {
          setPickedId(r.variants[0].variantId);
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

  function handleEnterEdit() {
    if (!picked) return;
    setEditPrompt('');
    setMaskDataUrl(null);
    setBrushOpen(false);
    setEditing(true);
  }

  function handleCancelEdit() {
    setEditing(false);
    setEditPrompt('');
    setMaskDataUrl(null);
    setBrushOpen(false);
  }

  async function handleApplyEdit() {
    if (!picked) return;
    if (!editPrompt.trim()) {
      setError('Tell me what to change.');
      return;
    }
    setError(null);
    setEditApplying(true);
    try {
      const r = await editStudioImage({
        imageStoragePath: picked.storagePath,
        prompt: editPrompt.trim(),
        maskDataUrl: maskDataUrl ?? undefined,
      });
      if (!r.ok) {
        setError(friendlyError('Edit', r));
        return;
      }
      // Replace the picked variant in-place with the edited one. Keeps
      // the position in the grid + auto-keeps it picked.
      const newVariant: Variant = { variantId: r.variantId, url: r.url, storagePath: r.storagePath };
      setVariants((prev) => prev.map((v) => (v.variantId === picked.variantId ? newVariant : v)));
      setPickedId(newVariant.variantId);
      setEditing(false);
      setEditPrompt('');
      setMaskDataUrl(null);
      setBrushOpen(false);
      setOkBanner(maskDataUrl ? 'Brushed area edited! ✨' : 'Edited! ✨ Pick again or continue when you\'re happy.');
      setTimeout(() => setOkBanner(null), 3500);
    } catch (e) {
      setError(friendlyError('Edit', e));
    } finally {
      setEditApplying(false);
    }
  }

  /** Upload-your-own (Phase 4 item 4). Web-only path: read the file as a
   *  base64 data URL and POST through the studio callable. On success,
   *  treat the uploaded image as the picked variant and skip Step 2's
   *  AI-generation flow entirely (no AI cost, no prompt requirement). */
  async function handleUpload(file: File) {
    if (Platform.OS !== 'web') return;
    if (file.size > 8 * 1024 * 1024) {
      setError('File is larger than 8 MB. Compress or resize and try again.');
      return;
    }
    setError(null);
    setGenerating(true);
    setStep(2);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(reader.error ?? new Error('file-read-failed'));
        reader.readAsDataURL(file);
      });
      const r = await uploadStudioImage({ dataUrl });
      if (!r.ok) {
        setError(friendlyError('Upload', r));
        setStep(1);
        return;
      }
      const v: Variant = { variantId: r.variantId, url: r.url, storagePath: r.storagePath };
      setVariants([v]);
      setPickedId(v.variantId);
      // Default the prompt from filename so caption gen has something to
      // riff on if the admin didn't write anything.
      if (!prompt.trim()) {
        const niceName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 200);
        setPrompt(niceName || 'Uploaded image');
      }
      setOkBanner('Image uploaded! Pick "Use this image" to continue.');
      setTimeout(() => setOkBanner(null), 3500);
    } catch (e) {
      setError(friendlyError('Upload', e));
      setStep(1);
    } finally {
      setGenerating(false);
    }
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
        // Carousel: send all slides as assets[]. Single: use the picked one.
        ...(carouselMode && variants.length > 1
          ? { assets: variants.map((v) => ({ url: v.url, storagePath: v.storagePath })) }
          : { imageUrl: picked.url, imageStoragePath: picked.storagePath }),
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
            winner={winner}
            winnerLoaded={winnerLoaded}
            onReuseWinner={() => {
              if (!winner) return;
              const next = winner.imagePrompt?.trim() || winner.headline?.trim() || '';
              if (next) setPrompt(next);
            }}
            onUploadFile={handleUpload}
            carouselMode={carouselMode}
            setCarouselMode={setCarouselMode}
            slideCount={slideCount}
            setSlideCount={setSlideCount}
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
            picked={picked}
            editing={editing}
            editPrompt={editPrompt}
            setEditPrompt={setEditPrompt}
            editApplying={editApplying}
            onEnterEdit={handleEnterEdit}
            onApplyEdit={handleApplyEdit}
            onCancelEdit={handleCancelEdit}
            carouselMode={carouselMode}
            maskDataUrl={maskDataUrl}
            setMaskDataUrl={setMaskDataUrl}
            brushOpen={brushOpen}
            setBrushOpen={setBrushOpen}
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
            logoApplying={logoApplying}
            logoApplied={logoApplied}
            onApplyLogo={handleApplyLogo}
            carouselMode={carouselMode}
            slides={variants}
          />
        )}
      </ScrollView>
    </>
  );
}

// ── Step 1: Prompt ──────────────────────────────────────────────────────────

function Step1Prompt({
  prompt, setPrompt, quality, setQuality, estCost, onGenerate, generating,
  winner, winnerLoaded, onReuseWinner, onUploadFile,
  carouselMode, setCarouselMode, slideCount, setSlideCount,
}: {
  prompt: string; setPrompt: (v: string) => void;
  quality: Quality; setQuality: (q: Quality) => void;
  estCost: number;
  onGenerate: () => void; generating: boolean;
  winner: TopPerformingDraft | null;
  winnerLoaded: boolean;
  onReuseWinner: () => void;
  /** Web-only — invoked when admin picks a file via the Upload button. */
  onUploadFile: (file: File) => void;
  carouselMode: boolean;
  setCarouselMode: (v: boolean) => void;
  slideCount: 3 | 5;
  setSlideCount: (n: 3 | 5) => void;
}) {
  const valid = prompt.trim().length >= 3;
  // Only surface the chip when there's a real winner with a usable prompt
  // — silence is honest when no posted draft has cleared the noise floor.
  const showWinner = winnerLoaded && winner && (winner.imagePrompt || winner.headline);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>What's this post about?</Text>
      <Text style={styles.cardHint}>Describe the scene or topic in 1-2 sentences. We'll keep it on-brand for you.</Text>
      {showWinner ? (
        <Pressable onPress={onReuseWinner} style={styles.winnerChip}>
          <Ionicons name="trophy-outline" size={14} color={Colors.success} />
          <Text style={styles.winnerLabel}>Reuse a winning prompt</Text>
          <Text style={styles.winnerSub} numberOfLines={1}>
            "{(winner!.headline || winner!.imagePrompt || '').slice(0, 50)}…" — {(winner!.engagementRate * 100).toFixed(1)}% ER
          </Text>
        </Pressable>
      ) : null}
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

      <Text style={[styles.cardTitle, { marginTop: Spacing.lg }]}>Format</Text>
      <View style={styles.qualityRow}>
        <Pressable
          onPress={() => setCarouselMode(false)}
          style={[styles.qualityCard, !carouselMode && styles.qualityCardSelected]}
        >
          <View style={styles.qualityHead}>
            <Text style={[styles.qualityLabel, !carouselMode && { color: Colors.primary }]}>Single image</Text>
            {!carouselMode ? <Ionicons name="checkmark-circle" size={16} color={Colors.primary} /> : null}
          </View>
          <Text style={styles.qualitySub}>4 variants — pick the best one.</Text>
        </Pressable>
        <Pressable
          onPress={() => setCarouselMode(true)}
          style={[styles.qualityCard, carouselMode && styles.qualityCardSelected]}
        >
          <View style={styles.qualityHead}>
            <Text style={[styles.qualityLabel, carouselMode && { color: Colors.primary }]}>Carousel</Text>
            {carouselMode ? <Ionicons name="checkmark-circle" size={16} color={Colors.primary} /> : null}
          </View>
          <Text style={styles.qualitySub}>3–5 slides, on-brand. IG carousel post.</Text>
        </Pressable>
      </View>

      {carouselMode ? (
        <View style={[styles.qualityRow, { marginTop: Spacing.sm }]}>
          {([3, 5] as const).map((n) => (
            <Pressable
              key={n}
              onPress={() => setSlideCount(n)}
              style={[styles.qualityCard, slideCount === n && styles.qualityCardSelected]}
            >
              <View style={styles.qualityHead}>
                <Text style={[styles.qualityLabel, slideCount === n && { color: Colors.primary }]}>{n} slides</Text>
                {slideCount === n ? <Ionicons name="checkmark-circle" size={16} color={Colors.primary} /> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

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
        <Text style={styles.estCost}>
          ≈ ₹{estCost.toFixed(2)} for {carouselMode ? `${slideCount} slides` : '4 variants'}
        </Text>
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
              <Text style={styles.primaryBtnLabel}>
                {carouselMode ? `Generate ${slideCount} slides` : 'Generate 4 variants'}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {Platform.OS === 'web' ? (
        <View style={styles.uploadDivider}>
          <View style={styles.uploadDividerLine} />
          <Text style={styles.uploadDividerLabel}>OR</Text>
          <View style={styles.uploadDividerLine} />
        </View>
      ) : null}

      {Platform.OS === 'web' ? (
        <View style={styles.uploadRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Use your own photo</Text>
            <Text style={styles.cardHint}>PNG, JPG, or WEBP up to 8 MB. Skips AI generation — no cost.</Text>
          </View>
          {/* Hidden native file input + visible label that triggers it. */}
          <label
            htmlFor="studio-upload-input"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 14px',
              borderRadius: 10,
              backgroundColor: Colors.cardBg,
              border: `1px solid ${Colors.borderSoft}`,
              color: Colors.textDark,
              fontSize: FontSize.sm, fontWeight: 700,
              cursor: generating ? 'not-allowed' : 'pointer',
              opacity: generating ? 0.6 : 1,
            }}
          >
            <Ionicons name="cloud-upload-outline" size={16} color={Colors.textDark} />
            <span>Upload image</span>
          </label>
          <input
            id="studio-upload-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={generating}
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              if (f) onUploadFile(f);
              e.currentTarget.value = '';
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

// ── Step 2: Pick ────────────────────────────────────────────────────────────

function Step2Pick({
  prompt, variants, variantCount, generating, pickedId, onPick, onEdit, onRetry, onContinue,
  picked, editing, editPrompt, setEditPrompt, editApplying, onEnterEdit, onApplyEdit, onCancelEdit,
  carouselMode,
  maskDataUrl, setMaskDataUrl, brushOpen, setBrushOpen,
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
  picked: Variant | null;
  editing: boolean;
  editPrompt: string;
  setEditPrompt: (v: string) => void;
  editApplying: boolean;
  onEnterEdit: () => void;
  onApplyEdit: () => void;
  onCancelEdit: () => void;
  /** When true, the variants ARE the carousel slides — no picking, no edit
   *  panel, "Use these slides" advances. */
  carouselMode: boolean;
  /** Mask brush (Phase 4 item 5) — null = no mask (whole-frame edit). */
  maskDataUrl: string | null;
  setMaskDataUrl: (v: string | null) => void;
  brushOpen: boolean;
  setBrushOpen: (v: boolean) => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const isNarrow = screenWidth < 900;
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
          const isPickedAndEditing = selected && editing;
          return (
            <Pressable
              key={i}
              onPress={ready && !editing ? () => onPick(v) : undefined}
              disabled={!ready || editing}
              style={[styles.variantCard, selected && styles.variantCardSelected]}
            >
              {ready ? (
                <>
                  <Image source={{ uri: v.url }} style={styles.variantImage} resizeMode="cover" />
                  {/* Show a "re-rendering" overlay on the picked variant while edit is in flight */}
                  {isPickedAndEditing && editApplying ? (
                    <View style={styles.variantOverlay}>
                      <ActivityIndicator size="small" color={Colors.white} />
                      <Text style={styles.variantOverlayText}>Editing…</Text>
                    </View>
                  ) : null}
                </>
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

      {/* Edit panel (Phase 3) — slides in when admin clicks "Edit it first" */}
      {editing && picked ? (
        <View style={styles.editPanel}>
          <View style={styles.editHead}>
            <Ionicons name="brush-outline" size={16} color={Colors.primary} />
            <Text style={styles.editTitle}>Edit variant {String.fromCharCode(65 + variants.findIndex((v) => v.variantId === picked.variantId))}</Text>
            <Text style={styles.editCost}>≈ ₹3.50</Text>
          </View>
          <Text style={styles.editHint}>
            Describe what should change. We'll keep your brand style intact.
            {maskDataUrl ? ' Brush mask is set — only the highlighted region will change.' : ''}
          </Text>
          <TextInput
            value={editPrompt}
            onChangeText={setEditPrompt}
            placeholder={maskDataUrl ? 'e.g. Replace this with a flowering plant' : 'e.g. Change the background to soft pastel pink'}
            placeholderTextColor={Colors.textMuted}
            style={styles.editInput}
            multiline
            maxLength={500}
            editable={!editApplying}
            autoFocus
          />

          {/* Mask brush (Phase 4 item 5) — web-only canvas overlay. Native
              admins still get the regular text-edit. */}
          {Platform.OS === 'web' ? (
            <View style={styles.maskRow}>
              <Pressable
                onPress={editApplying ? undefined : () => setBrushOpen(!brushOpen)}
                disabled={editApplying}
                style={[styles.ghostBtn, brushOpen && { borderColor: Colors.primary, backgroundColor: Colors.primarySoft }]}
              >
                <Ionicons name={maskDataUrl ? 'checkmark-circle' : 'cut-outline'} size={14} color={maskDataUrl ? Colors.success : Colors.textDark} />
                <Text style={[styles.ghostBtnLabel, brushOpen && { color: Colors.primary }]}>{maskDataUrl ? 'Mask set — re-brush' : brushOpen ? 'Hide brush' : 'Brush a region'}</Text>
              </Pressable>
              {maskDataUrl ? (
                <Pressable onPress={() => setMaskDataUrl(null)} style={styles.ghostBtn}>
                  <Ionicons name="close" size={14} color={Colors.error} />
                  <Text style={[styles.ghostBtnLabel, { color: Colors.error }]}>Clear mask</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {brushOpen && Platform.OS === 'web' && picked ? (
            <MaskBrush
              imageUrl={picked.url}
              disabled={editApplying}
              onMaskReady={(dataUrl) => {
                setMaskDataUrl(dataUrl);
                setBrushOpen(false);
              }}
              onCancel={() => setBrushOpen(false)}
            />
          ) : null}

          <View style={styles.editActions}>
            <Pressable onPress={onCancelEdit} disabled={editApplying} style={styles.ghostBtn}>
              <Text style={styles.ghostBtnLabel}>Cancel</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={editApplying ? undefined : onApplyEdit}
              disabled={editApplying || !editPrompt.trim()}
              style={[styles.primaryBtn, (editApplying || !editPrompt.trim()) && styles.primaryBtnDisabled]}
            >
              {editApplying ? (
                <>
                  <ActivityIndicator size="small" color={Colors.white} />
                  <Text style={styles.primaryBtnLabel}>Applying…</Text>
                </>
              ) : (
                <>
                  <Ionicons name="sparkles" size={14} color={Colors.white} />
                  <Text style={styles.primaryBtnLabel}>{maskDataUrl ? 'Apply masked edit' : 'Apply edit'}</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Actions — narrow: ghost buttons row + primary full-width below.
                  wide: single row with spacer. */}
      {!editing ? (
        isNarrow ? (
          <View style={{ gap: Spacing.sm, marginTop: 4 }}>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <Pressable onPress={onRetry} disabled={generating} style={[styles.ghostBtn, { flex: 1 }]}>
                <Ionicons name="refresh" size={16} color={Colors.textDark} />
                <Text style={styles.ghostBtnLabel}>Try again</Text>
              </Pressable>
              {pickedId && !carouselMode ? (
                <Pressable onPress={onEnterEdit} style={[styles.ghostBtn, { flex: 1 }]}>
                  <Ionicons name="brush-outline" size={16} color={Colors.textDark} />
                  <Text style={styles.ghostBtnLabel}>Edit first</Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable
              onPress={
                carouselMode
                  ? (variants.length >= 2 ? onContinue : undefined)
                  : (pickedId ? onContinue : undefined)
              }
              disabled={carouselMode ? variants.length < 2 : !pickedId}
              style={[styles.primaryBtn, { justifyContent: 'center' }, (carouselMode ? variants.length < 2 : !pickedId) && styles.primaryBtnDisabled]}
            >
              <Text style={styles.primaryBtnLabel}>{carouselMode ? `Use these ${variants.length} slides` : 'Use this image'}</Text>
              <Ionicons name="arrow-forward" size={16} color={Colors.white} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.actionsRow}>
            <Pressable onPress={onRetry} disabled={generating} style={styles.ghostBtn}>
              <Ionicons name="refresh" size={16} color={Colors.textDark} />
              <Text style={styles.ghostBtnLabel}>Try again</Text>
            </Pressable>
            {pickedId && !carouselMode ? (
              <Pressable onPress={onEnterEdit} style={styles.ghostBtn}>
                <Ionicons name="brush-outline" size={16} color={Colors.textDark} />
                <Text style={styles.ghostBtnLabel}>Edit it first</Text>
              </Pressable>
            ) : null}
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={
                carouselMode
                  ? (variants.length >= 2 ? onContinue : undefined)
                  : (pickedId ? onContinue : undefined)
              }
              disabled={carouselMode ? variants.length < 2 : !pickedId}
              style={[styles.primaryBtn, (carouselMode ? variants.length < 2 : !pickedId) && styles.primaryBtnDisabled]}
            >
              <Text style={styles.primaryBtnLabel}>{carouselMode ? `Use these ${variants.length} slides` : 'Use this image'}</Text>
              <Ionicons name="arrow-forward" size={16} color={Colors.white} />
            </Pressable>
          </View>
        )
      ) : null}
    </View>
  );
}

// ── Step 3: Save ────────────────────────────────────────────────────────────

function Step3Save({
  prompt, picked, caption, setCaption, captionGenerating, scheduleAt, setScheduleAt,
  saving, onBack, onSaveDraft, onSchedule,
  logoApplying, logoApplied, onApplyLogo,
  carouselMode, slides,
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
  logoApplying: boolean;
  logoApplied: LogoPosition | null;
  onApplyLogo: (position: LogoPosition) => void;
  carouselMode: boolean;
  slides: Variant[];
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
        {carouselMode && slides.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
            style={{ flexGrow: 0, alignSelf: 'stretch' }}
          >
            {slides.map((s, i) => (
              <View key={s.variantId} style={styles.carouselSlideWrap}>
                <Image source={{ uri: s.url }} style={styles.carouselSlide} resizeMode="cover" />
                <View style={styles.carouselSlideBadge}>
                  <Text style={styles.carouselSlideBadgeLabel}>{i + 1}/{slides.length}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.savePreviewWrap}>
            <Image source={{ uri: picked.url }} style={styles.savePreviewImage} resizeMode="cover" />
            {logoApplying ? (
              <View style={[StyleSheet.absoluteFillObject, styles.logoOverlay]}>
                <ActivityIndicator size="small" color={Colors.white} />
                <Text style={styles.logoOverlayText}>Adding logo…</Text>
              </View>
            ) : null}
          </View>
        )}
        <Pressable onPress={onBack} style={styles.changePickBtn}>
          <Ionicons name="swap-horizontal" size={14} color={Colors.primary} />
          <Text style={styles.changePickLabel}>{carouselMode ? 'Change slides' : 'Change image'}</Text>
        </Pressable>
      </View>

      {/* Logo overlay only available for single-image drafts. Carousel
          mode produces all slides at once; per-slide logo placement is a
          larger feature — defer to a future Phase. */}
      {!carouselMode ? (
      <View style={[styles.card, { gap: 8 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="ribbon-outline" size={16} color={Colors.primary} />
          <Text style={styles.cardTitle}>Add brand logo</Text>
          {logoApplied ? (
            <View style={styles.logoAppliedChip}>
              <Ionicons name="checkmark" size={11} color={Colors.success} />
              <Text style={styles.logoAppliedLabel}>{logoLabel(logoApplied)}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.cardHint}>Optional — composites your brand logo into a corner. No AI cost.</Text>
        <View style={styles.logoCornerRow}>
          {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as LogoPosition[]).map((p) => {
            const active = logoApplied === p;
            return (
              <Pressable
                key={p}
                onPress={logoApplying ? undefined : () => onApplyLogo(p)}
                disabled={logoApplying}
                style={[styles.logoCornerBtn, active && styles.logoCornerBtnActive, logoApplying && { opacity: 0.5 }]}
              >
                <View style={[styles.logoCornerCell, p === 'top-left' && styles.logoCellTL, p === 'top-right' && styles.logoCellTR, p === 'bottom-left' && styles.logoCellBL, p === 'bottom-right' && styles.logoCellBR]} />
                <Text style={[styles.logoCornerLabel, active && { color: Colors.primary }]}>{logoLabel(p)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      ) : null}

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

// ── Mask brush (Phase 4 item 5) ────────────────────────────────────────────
// Web-only HTML canvas overlay that lets admin paint a region to repaint.
// Two canvases: a visible overlay showing the brush trail in semi-transparent
// purple, and an off-screen mask canvas accumulating an opaque-where-kept /
// transparent-where-edit shape — exactly the format OpenAI's
// /v1/images/edits expects.
//
// Native (iOS/Android) renders nothing — feature-gated above.
const MASK_SIZE = 1024;

function MaskBrush({
  imageUrl, disabled, onMaskReady, onCancel,
}: {
  imageUrl: string;
  disabled: boolean;
  onMaskReady: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [brushSize, setBrushSize] = useState(80);
  const [hasStrokes, setHasStrokes] = useState(false);

  // Initialise both canvases on mount: overlay starts transparent (no
  // brushstrokes yet), mask starts fully opaque black (= keep everything).
  useEffect(() => {
    const overlay = overlayRef.current;
    const mask = maskRef.current;
    if (!overlay || !mask) return;
    overlay.width = MASK_SIZE; overlay.height = MASK_SIZE;
    mask.width = MASK_SIZE; mask.height = MASK_SIZE;
    const mctx = mask.getContext('2d');
    if (mctx) {
      mctx.fillStyle = '#000';
      mctx.fillRect(0, 0, MASK_SIZE, MASK_SIZE);
    }
    const octx = overlay.getContext('2d');
    if (octx) octx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
  }, []);

  // Translate a CSS-pixel pointer event into canvas-pixel coords.
  function toCanvas(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const c = e.currentTarget;
    const rect = c.getBoundingClientRect();
    const sx = MASK_SIZE / rect.width;
    const sy = MASK_SIZE / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  function strokeBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
    const overlay = overlayRef.current;
    const mask = maskRef.current;
    if (!overlay || !mask) return;
    const octx = overlay.getContext('2d');
    const mctx = mask.getContext('2d');
    if (!octx || !mctx) return;
    // Overlay paint: semi-transparent purple to show what's brushed.
    octx.globalCompositeOperation = 'source-over';
    octx.strokeStyle = 'rgba(124, 58, 237, 0.55)';
    octx.lineWidth = brushSize;
    octx.lineCap = 'round';
    octx.lineJoin = 'round';
    octx.beginPath(); octx.moveTo(a.x, a.y); octx.lineTo(b.x, b.y); octx.stroke();
    // Mask: same stroke, but composite mode 'destination-out' erases the
    // opaque black so the region becomes transparent (= edit here).
    mctx.globalCompositeOperation = 'destination-out';
    mctx.strokeStyle = '#000';
    mctx.lineWidth = brushSize;
    mctx.lineCap = 'round';
    mctx.lineJoin = 'round';
    mctx.beginPath(); mctx.moveTo(a.x, a.y); mctx.lineTo(b.x, b.y); mctx.stroke();
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const p = toCanvas(e);
    lastPoint.current = p;
    strokeBetween(p, p); // single-tap dot
    setHasStrokes(true);
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || disabled) return;
    const p = toCanvas(e);
    const last = lastPoint.current ?? p;
    strokeBetween(last, p);
    lastPoint.current = p;
  }
  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    lastPoint.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {/* noop */}
  }

  function clearStrokes() {
    const overlay = overlayRef.current;
    const mask = maskRef.current;
    if (overlay) overlay.getContext('2d')?.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
    if (mask) {
      const mctx = mask.getContext('2d');
      if (mctx) {
        mctx.globalCompositeOperation = 'source-over';
        mctx.fillStyle = '#000';
        mctx.fillRect(0, 0, MASK_SIZE, MASK_SIZE);
      }
    }
    setHasStrokes(false);
  }

  function applyMask() {
    if (!hasStrokes || !maskRef.current) return;
    const url = maskRef.current.toDataURL('image/png');
    if (typeof url === 'string' && url.startsWith('data:image/png')) {
      onMaskReady(url);
    }
  }

  return (
    <View style={styles.brushPanel}>
      <Text style={styles.editHint}>
        Drag to paint the area you want repainted. Anything outside your strokes stays unchanged.
      </Text>
      <View style={styles.brushCanvasWrap}>
        <img
          src={imageUrl}
          alt="Source"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: Radius.md, pointerEvents: 'none' }}
          draggable={false}
        />
        <canvas
          ref={overlayRef}
          style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            borderRadius: Radius.md, touchAction: 'none', cursor: disabled ? 'not-allowed' : 'crosshair',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
        {/* Off-screen mask — never displayed; only used to export the PNG. */}
        <canvas ref={maskRef} style={{ display: 'none' }} />
      </View>
      <View style={styles.brushControls}>
        <Text style={styles.editHint}>Brush size:</Text>
        {[40, 80, 140, 220].map((sz) => (
          <Pressable
            key={sz}
            onPress={() => setBrushSize(sz)}
            style={[styles.brushSizeBtn, brushSize === sz && styles.brushSizeBtnActive]}
          >
            <Text style={[styles.brushSizeLabel, brushSize === sz && { color: Colors.primary }]}>{sz}</Text>
          </Pressable>
        ))}
        <View style={{ flex: 1 }} />
        <Pressable onPress={clearStrokes} style={styles.ghostBtn} disabled={!hasStrokes || disabled}>
          <Ionicons name="trash-outline" size={14} color={Colors.textDark} />
          <Text style={styles.ghostBtnLabel}>Clear</Text>
        </Pressable>
        <Pressable onPress={onCancel} style={styles.ghostBtn} disabled={disabled}>
          <Text style={styles.ghostBtnLabel}>Close</Text>
        </Pressable>
        <Pressable
          onPress={applyMask}
          disabled={!hasStrokes || disabled}
          style={[styles.primaryBtn, (!hasStrokes || disabled) && styles.primaryBtnDisabled]}
        >
          <Ionicons name="checkmark" size={14} color={Colors.white} />
          <Text style={styles.primaryBtnLabel}>Use this mask</Text>
        </Pressable>
      </View>
    </View>
  );
}

function logoLabel(p: LogoPosition): string {
  switch (p) {
    case 'top-left':     return 'Top-left';
    case 'top-right':    return 'Top-right';
    case 'bottom-left':  return 'Bottom-left';
    case 'bottom-right': return 'Bottom-right';
  }
}

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

  // Reuse-winners chip (Phase 4 item 2)
  winnerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.success,
    marginTop: 6,
  },
  winnerLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.success },
  winnerSub: { flex: 1, fontSize: 11, color: Colors.textLight, fontStyle: 'italic' },

  // Upload-your-own (Phase 4 item 4)
  uploadDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.md },
  uploadDividerLine: { flex: 1, height: 1, backgroundColor: Colors.borderSoft },
  uploadDividerLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.2 },
  uploadRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: 4 },

  // Logo overlay (Phase 4 item 3)
  logoOverlay: {
    backgroundColor: 'rgba(28, 16, 51, 0.55)',
    alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: Radius.lg,
  },
  logoOverlayText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.white },
  logoAppliedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  logoAppliedLabel: { fontSize: 10, fontWeight: '700', color: Colors.success },
  logoCornerRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  logoCornerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.borderSoft, borderRadius: Radius.md,
    backgroundColor: Colors.cardBg,
    minWidth: 130,
  },
  logoCornerBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  logoCornerCell: {
    width: 22, height: 22, borderRadius: 4,
    backgroundColor: Colors.bgLight,
    borderWidth: 1, borderColor: Colors.borderSoft,
    position: 'relative',
  },
  logoCellTL: { backgroundColor: Colors.primary },
  logoCellTR: { backgroundColor: Colors.primary },
  logoCellBL: { backgroundColor: Colors.primary },
  logoCellBR: { backgroundColor: Colors.primary },
  logoCornerLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDark },

  // Carousel preview (Phase 4 item 1)
  carouselSlideWrap: {
    width: 220,
    aspectRatio: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.bgTint,
    position: 'relative',
  },
  carouselSlide: { width: '100%', height: '100%' },
  carouselSlideBadge: {
    position: 'absolute', top: 8, left: 8,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 999,
  },
  carouselSlideBadgeLabel: { fontSize: 10, fontWeight: '800', color: Colors.white, letterSpacing: 0.4 },

  // Mask brush (Phase 4 item 5)
  maskRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' },
  brushPanel: {
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  brushCanvasWrap: {
    position: 'relative' as any,
    aspectRatio: 1,
    width: '100%',
    backgroundColor: Colors.bgTint,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  brushControls: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  brushSizeBtn: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.borderSoft,
    backgroundColor: Colors.cardBg,
  },
  brushSizeBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  brushSizeLabel: { fontSize: 11, fontWeight: '700', color: Colors.textDark },

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
  variantOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28, 16, 51, 0.55)',
    alignItems: 'center', justifyContent: 'center',
    gap: 6,
  },
  variantOverlayText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.white },

  // Edit panel (Phase 3)
  editPanel: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1.5, borderColor: Colors.primary,
    gap: 8,
    ...Shadow.sm,
  },
  editHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark, flex: 1 },
  editCost: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  editHint: { fontSize: FontSize.xs, color: Colors.textLight, lineHeight: 16 },
  editInput: {
    backgroundColor: Colors.bgLight,
    borderWidth: 1, borderColor: Colors.borderSoft,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    fontSize: FontSize.sm, color: Colors.textDark,
    minHeight: 64, textAlignVertical: 'top',
    outlineStyle: 'none' as any,
  },
  editActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },

  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },

  // Step 3
  savePane: { gap: Spacing.md },
  // savePreview: centered column — "Change image" button and carousel both benefit from center.
  savePreview: { alignItems: 'center', gap: 8 },
  // savePreviewWrap: gives the image container an explicit width so `width: '100%'`
  // on the Image resolves correctly (without this, the View collapses to 0 inside
  // an alignItems-center parent and the image becomes invisible).
  savePreviewWrap: {
    position: 'relative',
    width: '100%',
    maxWidth: 360,
  },
  savePreviewImage: {
    width: '100%',
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
