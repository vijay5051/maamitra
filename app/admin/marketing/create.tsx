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
  Linking,
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
import { renderMarketingTemplate, RenderableTemplateName } from '../../../services/marketing';
import {
  composeStudioLogo,
  createStudioDraft,
  editStudioImage,
  generateTemplatePrefill,
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
type StudioAspectRatio = '1:1' | '9:16' | '16:9';
type CreateMode = 'ai' | 'template';
type TemplateKind = RenderableTemplateName;

const QUALITY_INFO: Record<Quality, { label: string; sub: string; provider: 'dalle' | 'imagen' | 'flux'; perVariantInr: number }> = {
  best:  { label: 'Best',  sub: 'ChatGPT with MaaMitra illustration references.', provider: 'dalle', perVariantInr: 15.00 },
  quick: { label: 'Quick', sub: 'Fast, ~₹0.25 per image. Use for iteration.', provider: 'flux',   perVariantInr: 0.25 },
};

const TEMPLATE_META: Record<TemplateKind, { label: string; sub: string }> = {
  tipCard: { label: 'Tip card', sub: 'Numbered tips on a clean editorial card.' },
  quoteCard: { label: 'Quote card', sub: 'Pull quote with optional soft background.' },
  milestoneCard: { label: 'Milestone card', sub: 'Age-based checklist with optional photo.' },
  realStoryCard: { label: 'Inspired story', sub: 'Story-led post with optional portrait-style image.' },
};

type TemplateForm = {
  eyebrow: string;
  title: string;
  tipsText: string;
  quote: string;
  attribution: string;
  age: string;
  milestonesText: string;
  story: string;
  backgroundPrompt: string;
};

export default function StudioCanvasScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ prompt?: string }>();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [step, setStep] = useState<Step>(1);
  const [prompt, setPrompt] = useState(typeof params.prompt === 'string' ? params.prompt : '');
  const [createMode, setCreateMode] = useState<CreateMode>('ai');
  const [templateKind, setTemplateKind] = useState<TemplateKind>('tipCard');
  const [templateForm, setTemplateForm] = useState<TemplateForm>({
    eyebrow: 'MaaMitra',
    title: '',
    tipsText: '',
    quote: '',
    attribution: '',
    age: '',
    milestonesText: '',
    story: '',
    backgroundPrompt: '',
  });
  const [quality, setQuality] = useState<Quality>('best');
  // Carousel mode (Phase 4 item 1) — when true, generate N slides instead
  // of picker variants; no picking step, all slides go into the draft.
  const [carouselMode, setCarouselMode] = useState(false);
  const [singleVariantCount, setSingleVariantCount] = useState<1 | 2 | 3 | 4>(1);
  const [slideCount, setSlideCount] = useState<3 | 5>(3);
  const [aspectRatio, setAspectRatio] = useState<StudioAspectRatio>('1:1');
  const variantCount: 1 | 2 | 3 | 4 | 5 = carouselMode ? slideCount : singleVariantCount;

  const [variants, setVariants] = useState<Variant[]>([]);
  const [generating, setGenerating] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const [caption, setCaption] = useState('');
  const [captionGenerating, setCaptionGenerating] = useState(false);
  const [prefillingTemplate, setPrefillingTemplate] = useState(false);
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
  const [cropOpen, setCropOpen] = useState(false);
  const [cropApplying, setCropApplying] = useState(false);
  const [cropAspectRatio, setCropAspectRatio] = useState<StudioAspectRatio>(aspectRatio);

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
  const estCost = createMode === 'template'
    ? estimateTemplateCost(templateKind, templateForm, quality)
    : QUALITY_INFO[quality].perVariantInr * variantCount;
  const promptSummary = createMode === 'template'
    ? buildTemplateDraftPrompt(templateKind, templateForm, prompt)
    : prompt;

  async function handleGenerate() {
    setError(null);
    setVariants([]);
    setPickedId(null);
    setGenerating(true);
    setStep(2);
    try {
      if (createMode === 'template') {
        const request = buildTemplateRenderRequest(templateKind, templateForm, prompt, quality);
        if (!request) {
          setError('Fill the required template fields first.');
          setStep(1);
          return;
        }
        const r = await renderMarketingTemplate(request);
        if (!r.ok) {
          setError(friendlyError('Render', r));
          setStep(1);
        } else {
          const only: Variant = { variantId: 'template-preview', url: r.url, storagePath: r.storagePath };
          setVariants([only]);
          setPickedId(only.variantId);
        }
      } else {
        if (!prompt.trim()) {
          setError('Tell me what to make first.');
          setStep(1);
          return;
        }
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
          if (carouselMode && r.variants.length > 0) {
            setPickedId(r.variants[0].variantId);
          }
        }
      }
    } catch (e) {
      setError(friendlyError('Generate', e));
      setStep(1);
    } finally {
      setGenerating(false);
    }
  }

  async function handleApplyCrop(dataUrl: string) {
    if (!picked) return;
    setError(null);
    setCropApplying(true);
    try {
      const r = await uploadStudioImage({ dataUrl });
      if (!r.ok) {
        setError(friendlyError('Crop', r));
        return;
      }
      const newVariant: Variant = { variantId: r.variantId, url: r.url, storagePath: r.storagePath };
      setVariants((prev) => prev.map((v) => (v.variantId === picked.variantId ? newVariant : v)));
      setPickedId(newVariant.variantId);
      setCropOpen(false);
      setOkBanner('Crop applied.');
      setTimeout(() => setOkBanner(null), 2500);
    } catch (e) {
      setError(friendlyError('Crop', e));
    } finally {
      setCropApplying(false);
    }
  }

  async function handleTemplatePrefill() {
    setError(null);
    setPrefillingTemplate(true);
    try {
      const r = await generateTemplatePrefill({
        template: templateKind,
        context: prompt.trim(),
        current: templateFormToPrefillCurrent(templateKind, templateForm),
      });
      if (!r.ok) {
        setError(friendlyError('Prefill', r));
        return;
      }
      setTemplateForm(applyTemplatePrefill(templateKind, templateForm, r.props, r.backgroundPrompt));
      setOkBanner('AI filled the template. Edit anything you want, then render.');
      setTimeout(() => setOkBanner(null), 2500);
    } catch (e) {
      setError(friendlyError('Prefill', e));
    } finally {
      setPrefillingTemplate(false);
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

  async function handleDownloadOutputs(items?: Variant[]) {
    const selected = items?.length ? items : carouselMode ? variants : picked ? [picked] : [];
    if (!selected.length) return;

    try {
      for (let i = 0; i < selected.length; i += 1) {
        const item = selected[i];
        const suffix = selected.length > 1 ? `-slide-${i + 1}` : '';
        const filename = `maamitra-${item.variantId}${suffix}.png`;

        if (Platform.OS === 'web' && typeof document !== 'undefined') {
          const res = await fetch(item.url);
          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = objectUrl;
          a.download = filename;
          a.rel = 'noopener';
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(objectUrl);
        } else {
          await Linking.openURL(item.url);
        }
      }
      setOkBanner(selected.length > 1 ? 'Slides downloaded.' : 'Image downloaded.');
      setTimeout(() => setOkBanner(null), 2500);
    } catch (e) {
      setError('Download failed. Open the preview image in a new tab and save it from there.');
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
      const draftPrompt = createMode === 'template'
        ? buildTemplateDraftPrompt(templateKind, templateForm, prompt)
        : prompt.trim();
      const r = await createStudioDraft({
        prompt: draftPrompt,
        // Carousel: send all slides as assets[]. Single: use the picked one.
        ...(createMode === 'ai' && carouselMode && variants.length > 1
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
            createMode={createMode} setCreateMode={setCreateMode}
            templateKind={templateKind} setTemplateKind={setTemplateKind}
            templateForm={templateForm} setTemplateForm={setTemplateForm}
            onTemplatePrefill={handleTemplatePrefill}
            prefillingTemplate={prefillingTemplate}
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
            singleVariantCount={singleVariantCount}
            setSingleVariantCount={setSingleVariantCount}
            slideCount={slideCount}
            setSlideCount={setSlideCount}
            aspectRatio={aspectRatio}
            setAspectRatio={setAspectRatio}
            isWide={isWide}
          />
        ) : step === 2 ? (
          <Step2Pick
            prompt={promptSummary}
            variants={variants}
            variantCount={createMode === 'template' ? 1 : variantCount}
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
            carouselMode={createMode === 'ai' && carouselMode}
            maskDataUrl={maskDataUrl}
            setMaskDataUrl={setMaskDataUrl}
            brushOpen={brushOpen}
            setBrushOpen={setBrushOpen}
            onDownload={() => handleDownloadOutputs()}
            aspectRatio={aspectRatio}
            cropOpen={cropOpen}
            cropApplying={cropApplying}
            onOpenCrop={() => {
              setCropAspectRatio(aspectRatio);
              setCropOpen(true);
            }}
            onApplyCrop={handleApplyCrop}
            onCancelCrop={() => setCropOpen(false)}
            cropAspectRatio={cropAspectRatio}
            setCropAspectRatio={setCropAspectRatio}
          />
        ) : (
          <Step3Save
            prompt={promptSummary}
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
            carouselMode={createMode === 'ai' && carouselMode}
            slides={variants}
            onDownload={() => handleDownloadOutputs(carouselMode ? variants : picked ? [picked] : [])}
            aspectRatio={aspectRatio}
          />
        )}
      </ScrollView>
    </>
  );
}

// ── Step 1: Prompt ──────────────────────────────────────────────────────────

function Step1Prompt({
  prompt, setPrompt, createMode, setCreateMode, templateKind, setTemplateKind, templateForm, setTemplateForm,
  onTemplatePrefill, prefillingTemplate,
  quality, setQuality, estCost, onGenerate, generating,
  winner, winnerLoaded, onReuseWinner, onUploadFile,
  carouselMode, setCarouselMode, singleVariantCount, setSingleVariantCount, slideCount, setSlideCount,
  aspectRatio, setAspectRatio, isWide,
}: {
  prompt: string; setPrompt: (v: string) => void;
  createMode: CreateMode; setCreateMode: (v: CreateMode) => void;
  templateKind: TemplateKind; setTemplateKind: (v: TemplateKind) => void;
  templateForm: TemplateForm; setTemplateForm: (v: TemplateForm) => void;
  onTemplatePrefill: () => void;
  prefillingTemplate: boolean;
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
  singleVariantCount: 1 | 2 | 3 | 4;
  setSingleVariantCount: (n: 1 | 2 | 3 | 4) => void;
  slideCount: 3 | 5;
  setSlideCount: (n: 3 | 5) => void;
  aspectRatio: StudioAspectRatio;
  setAspectRatio: (v: StudioAspectRatio) => void;
  isWide: boolean;
}) {
  const router = useRouter();
  const valid = createMode === 'template'
    ? templateFormIsValid(templateKind, templateForm, prompt)
    : prompt.trim().length >= 3;
  // Only surface the chip when there's a real winner with a usable prompt
  // — silence is honest when no posted draft has cleared the noise floor.
  const showWinner = winnerLoaded && winner && (winner.imagePrompt || winner.headline);
  return (
    <View style={styles.card}>
      <View style={styles.step1Header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Generate post</Text>
          <Text style={styles.cardHint}>Keep the idea short. We’ll shape it into a post or template card without changing the working Studio flow.</Text>
        </View>
        <View style={styles.step1CostChip}>
          <Ionicons name="pricetag-outline" size={14} color={Colors.primary} />
          <Text style={styles.step1CostChipLabel}>≈ ₹{estCost.toFixed(2)}</Text>
        </View>
      </View>

      <View style={[styles.step1Layout, isWide && styles.step1LayoutWide]}>
        <View style={styles.step1MainCol}>
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Idea</Text>
              <Text style={styles.sectionHint}>1-2 lines is enough.</Text>
            </View>
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
              placeholder={createMode === 'template'
                ? 'Optional context for tone, audience, or CTA'
                : 'e.g. A mom and her toddler enjoying healthy snacks together'}
              placeholderTextColor={Colors.textMuted}
              style={styles.promptInput}
              multiline
              maxLength={500}
              autoFocus
            />
            <Text style={styles.charCount}>{prompt.length} / 500</Text>
          </View>

          {createMode === 'template' ? (
            <TemplateFields
              templateKind={templateKind}
              setTemplateKind={setTemplateKind}
              form={templateForm}
              setForm={setTemplateForm}
              onTemplatePrefill={onTemplatePrefill}
              prefillingTemplate={prefillingTemplate}
              isWide={isWide}
            />
          ) : null}

          {Platform.OS === 'web' && createMode === 'ai' ? (
            <View style={styles.uploadRowCompact}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Use your own photo</Text>
                <Text style={styles.sectionHint}>PNG, JPG, or WEBP up to 8 MB. No AI cost.</Text>
              </View>
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

        <View style={styles.step1SideCol}>
          <View style={styles.sectionBlockCompact}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Mode</Text>
              <Text style={styles.sectionHint}>Pick how this post starts.</Text>
            </View>
            <View style={styles.optionGrid}>
              <Pressable
                onPress={() => setCreateMode('ai')}
                style={[styles.optionCardCompact, createMode === 'ai' && styles.qualityCardSelected]}
              >
                <View style={styles.qualityHead}>
                  <Text style={[styles.optionLabel, createMode === 'ai' && { color: Colors.primary }]}>AI image</Text>
                  {createMode === 'ai' ? <Ionicons name="checkmark-circle" size={16} color={Colors.primary} /> : null}
                </View>
                <Text style={styles.optionSub}>Prompt to visual.</Text>
              </Pressable>
              <Pressable
                onPress={() => setCreateMode('template')}
                style={[styles.optionCardCompact, createMode === 'template' && styles.qualityCardSelected]}
              >
                <View style={styles.qualityHead}>
                  <Text style={[styles.optionLabel, createMode === 'template' && { color: Colors.primary }]}>Template</Text>
                  {createMode === 'template' ? <Ionicons name="checkmark-circle" size={16} color={Colors.primary} /> : null}
                </View>
                <Text style={styles.optionSub}>Tip, quote, story.</Text>
              </Pressable>
            </View>
          </View>

          {createMode === 'ai' ? (
            <View style={styles.sectionBlockCompact}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Format</Text>
                <Text style={styles.sectionHint}>Single image or carousel.</Text>
              </View>
              <View style={styles.optionGrid}>
                <Pressable
                  onPress={() => setCarouselMode(false)}
                  style={[styles.optionCardCompact, !carouselMode && styles.qualityCardSelected]}
                >
                  <View style={styles.qualityHead}>
                    <Text style={[styles.optionLabel, !carouselMode && { color: Colors.primary }]}>Single image</Text>
                    {!carouselMode ? <Ionicons name="checkmark-circle" size={16} color={Colors.primary} /> : null}
                  </View>
                  <Text style={styles.optionSub}>4 variants to choose from.</Text>
                </Pressable>
                <Pressable
                  onPress={() => setCarouselMode(true)}
                  style={[styles.optionCardCompact, carouselMode && styles.qualityCardSelected]}
                >
                  <View style={styles.qualityHead}>
                    <Text style={[styles.optionLabel, carouselMode && { color: Colors.primary }]}>Carousel</Text>
                    {carouselMode ? <Ionicons name="checkmark-circle" size={16} color={Colors.primary} /> : null}
                  </View>
                  <Text style={styles.optionSub}>3-5 slides for Instagram.</Text>
                </Pressable>
              </View>

              {carouselMode ? (
                <View style={styles.miniOptionRow}>
                  {([3, 5] as const).map((n) => (
                    <Pressable
                      key={n}
                      onPress={() => setSlideCount(n)}
                      style={[styles.miniOptionChip, slideCount === n && styles.miniOptionChipActive]}
                    >
                      <Text style={[styles.miniOptionChipLabel, slideCount === n && { color: Colors.primary }]}>{n} slides</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {createMode === 'ai' ? (
            <View style={styles.sectionBlockCompact}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Quality</Text>
                <Text style={styles.sectionHint}>Use quick for iteration, best for final output.</Text>
              </View>
              <View style={styles.qualityStackCompact}>
                {(['best', 'quick'] as Quality[]).map((q) => {
                  const info = QUALITY_INFO[q];
                  const selected = q === quality;
                  return (
                    <Pressable
                      key={q}
                      onPress={() => setQuality(q)}
                      style={[styles.optionCardCompact, selected && styles.qualityCardSelected]}
                    >
                      <View style={styles.qualityHead}>
                        <Text style={[styles.optionLabel, selected && { color: Colors.primary }]}>{info.label}</Text>
                        {selected ? <Ionicons name="checkmark-circle" size={16} color={Colors.primary} /> : null}
                      </View>
                      <Text style={styles.optionSub}>{info.sub}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            // Template mode pulls render style (image source / model / prompt) from
            // the locked default in Settings → Template Preview. The Best/Quick
            // dial doesn't apply here — admins iterate in Settings, not per-post.
            <View style={[styles.sectionBlockCompact, styles.lockedHintCard]}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Locked render style</Text>
              </View>
              <Text style={styles.sectionHint}>
                Image source, model, and prompt for {TEMPLATE_META[templateKind].label} come from
                Settings → Template Preview. Adjust them there to change every future render.
              </Text>
              <Pressable
                onPress={() => router.push('/admin/marketing/preview' as any)}
                style={styles.lockedHintLink}
              >
                <Ionicons name="settings-outline" size={12} color={Colors.primary} />
                <Text style={styles.lockedHintLinkLabel}>Open Template Preview</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.generateRail}>
            <View style={{ flex: 1 }}>
              <Text style={styles.generateRailTitle}>
                {createMode === 'template'
                  ? `Render ${TEMPLATE_META[templateKind].label}`
                  : carouselMode ? `Generate ${slideCount} slides` : 'Generate 4 variants'}
              </Text>
              <Text style={styles.generateRailHint}>
                {createMode === 'template'
                  ? 'AI can prefill, you edit, then render.'
                  : carouselMode ? 'Build all slides in one pass.' : 'You’ll pick the strongest result next.'}
              </Text>
            </View>
            <Pressable
              onPress={valid && !generating ? onGenerate : undefined}
              disabled={!valid || generating}
              style={[styles.primaryBtn, styles.generateRailBtn, (!valid || generating) && styles.primaryBtnDisabled]}
            >
              {generating ? (
                <>
                  <ActivityIndicator size="small" color={Colors.white} />
                  <Text style={styles.primaryBtnLabel}>Generating…</Text>
                </>
              ) : (
                <>
                  <Ionicons name="sparkles" size={16} color={Colors.white} />
                  <Text style={styles.primaryBtnLabel}>Continue</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function TemplateFields({
  templateKind,
  setTemplateKind,
  form,
  setForm,
  onTemplatePrefill,
  prefillingTemplate,
  isWide,
}: {
  templateKind: TemplateKind;
  setTemplateKind: (v: TemplateKind) => void;
  form: TemplateForm;
  setForm: (v: TemplateForm) => void;
  onTemplatePrefill: () => void;
  prefillingTemplate: boolean;
  isWide: boolean;
}) {
  const patch = (key: keyof TemplateForm, value: string) => setForm({ ...form, [key]: value });
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Template content</Text>
        <Text style={styles.sectionHint}>Pick a structure, let AI draft it, then edit freely.</Text>
      </View>
      <View style={styles.templateGrid}>
        {(Object.keys(TEMPLATE_META) as TemplateKind[]).map((key) => {
          const meta = TEMPLATE_META[key];
          const selected = key === templateKind;
          return (
            <Pressable key={key} onPress={() => setTemplateKind(key)} style={[styles.templateCard, selected && styles.templateCardSelected]}>
              <Text style={[styles.templateLabel, selected && { color: Colors.primary }]}>{meta.label}</Text>
              <Text style={styles.templateSub}>{meta.sub}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.templateAiRow}>
        <Pressable
          onPress={prefillingTemplate ? undefined : onTemplatePrefill}
          disabled={prefillingTemplate}
          style={[styles.secondaryBtn, prefillingTemplate && styles.primaryBtnDisabled]}
        >
          {prefillingTemplate
            ? <ActivityIndicator size="small" color={Colors.primary} />
            : <Ionicons name="sparkles-outline" size={16} color={Colors.primary} />}
          <Text style={styles.secondaryBtnLabel}>{hasTemplateContent(templateKind, form) ? 'Regenerate with AI' : 'Prefill with AI'}</Text>
        </Pressable>
        <Text style={styles.templateAiHint}>AI drafts the card fields. You can edit them, then render and rerender.</Text>
      </View>

      <View style={[styles.templateFieldsGrid, isWide && styles.templateFieldsGridWide]}>
      {(templateKind === 'tipCard' || templateKind === 'realStoryCard') ? (
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Eyebrow</Text>
          <TextInput value={form.eyebrow} onChangeText={(v) => patch('eyebrow', v)} placeholder="e.g. Tip Tuesday" placeholderTextColor={Colors.textMuted} style={styles.fieldInput} />
        </View>
      ) : null}

      {templateKind === 'tipCard' ? (
        <>
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput value={form.title} onChangeText={(v) => patch('title', v)} placeholder="e.g. Calm teething support" placeholderTextColor={Colors.textMuted} style={styles.fieldInput} />
          </View>
          <View style={[styles.fieldBlock, styles.fieldBlockFull]}>
            <Text style={styles.fieldLabel}>Tips</Text>
            <TextInput value={form.tipsText} onChangeText={(v) => patch('tipsText', v)} placeholder={'One tip per line'} placeholderTextColor={Colors.textMuted} style={[styles.fieldInput, styles.fieldTextArea]} multiline />
          </View>
        </>
      ) : null}

      {templateKind === 'quoteCard' ? (
        <>
          <View style={[styles.fieldBlock, styles.fieldBlockFull]}>
            <Text style={styles.fieldLabel}>Quote</Text>
            <TextInput value={form.quote} onChangeText={(v) => patch('quote', v)} placeholder="The quote to feature" placeholderTextColor={Colors.textMuted} style={[styles.fieldInput, styles.fieldTextArea]} multiline />
          </View>
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Attribution</Text>
            <TextInput value={form.attribution} onChangeText={(v) => patch('attribution', v)} placeholder="Optional name or source" placeholderTextColor={Colors.textMuted} style={styles.fieldInput} />
          </View>
        </>
      ) : null}

      {templateKind === 'milestoneCard' ? (
        <>
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Age label</Text>
            <TextInput value={form.age} onChangeText={(v) => patch('age', v)} placeholder="e.g. 18 months" placeholderTextColor={Colors.textMuted} style={styles.fieldInput} />
          </View>
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput value={form.title} onChangeText={(v) => patch('title', v)} placeholder="e.g. Teething signs to notice" placeholderTextColor={Colors.textMuted} style={styles.fieldInput} />
          </View>
          <View style={[styles.fieldBlock, styles.fieldBlockFull]}>
            <Text style={styles.fieldLabel}>Milestones / points</Text>
            <TextInput value={form.milestonesText} onChangeText={(v) => patch('milestonesText', v)} placeholder={'One bullet per line'} placeholderTextColor={Colors.textMuted} style={[styles.fieldInput, styles.fieldTextArea]} multiline />
          </View>
        </>
      ) : null}

      {templateKind === 'realStoryCard' ? (
        <>
          <View style={[styles.fieldBlock, styles.fieldBlockFull]}>
            <Text style={styles.fieldLabel}>Story</Text>
            <TextInput value={form.story} onChangeText={(v) => patch('story', v)} placeholder="1-3 sentences from the parent’s point of view" placeholderTextColor={Colors.textMuted} style={[styles.fieldInput, styles.fieldTextArea]} multiline />
          </View>
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Attribution</Text>
            <TextInput value={form.attribution} onChangeText={(v) => patch('attribution', v)} placeholder="e.g. A MaaMitra mom" placeholderTextColor={Colors.textMuted} style={styles.fieldInput} />
          </View>
        </>
      ) : null}

      {(templateKind === 'quoteCard' || templateKind === 'milestoneCard' || templateKind === 'realStoryCard') ? (
        <View style={[styles.fieldBlock, styles.fieldBlockFull]}>
          <Text style={styles.fieldLabel}>Optional background image prompt</Text>
          <TextInput value={form.backgroundPrompt} onChangeText={(v) => patch('backgroundPrompt', v)} placeholder="e.g. warm Indian home scene with soft natural light" placeholderTextColor={Colors.textMuted} style={[styles.fieldInput, styles.fieldTextAreaSmall]} multiline />
        </View>
      ) : null}
      </View>
    </View>
  );
}

// ── Step 2: Pick ────────────────────────────────────────────────────────────

function Step2Pick({
  prompt, variants, variantCount, generating, pickedId, onPick, onEdit, onRetry, onContinue,
  picked, editing, editPrompt, setEditPrompt, editApplying, onEnterEdit, onApplyEdit, onCancelEdit,
  carouselMode,
  maskDataUrl, setMaskDataUrl, brushOpen, setBrushOpen,
  onDownload,
  aspectRatio, cropOpen, cropApplying, onOpenCrop, onApplyCrop, onCancelCrop,
  cropAspectRatio, setCropAspectRatio,
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
  onDownload: () => void;
  aspectRatio: StudioAspectRatio;
  cropOpen: boolean;
  cropApplying: boolean;
  onOpenCrop: () => void;
  onApplyCrop: (dataUrl: string) => void;
  onCancelCrop: () => void;
  cropAspectRatio: StudioAspectRatio;
  setCropAspectRatio: (v: StudioAspectRatio) => void;
}) {
  const slots = Array.from({ length: variantCount });
  const frameRatio = aspectRatioNumber(aspectRatio);
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
              style={[styles.variantCard, { aspectRatio: frameRatio }, selected && styles.variantCardSelected]}
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

      {cropOpen && picked && Platform.OS === 'web' ? (
        <CropEditor
          imageUrl={picked.url}
          aspectRatio={cropAspectRatio}
          setAspectRatio={setCropAspectRatio}
          disabled={cropApplying}
          onApply={onApplyCrop}
          onCancel={onCancelCrop}
        />
      ) : null}

      {/* Actions */}
      {!editing ? (
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
          {pickedId && !carouselMode && Platform.OS === 'web' ? (
            <Pressable onPress={onOpenCrop} style={styles.ghostBtn}>
              <Ionicons name="crop-outline" size={16} color={Colors.textDark} />
              <Text style={styles.ghostBtnLabel}>Crop</Text>
            </Pressable>
          ) : null}
          {(carouselMode ? variants.length > 0 : !!pickedId) ? (
            <Pressable onPress={onDownload} style={styles.ghostBtn}>
              <Ionicons name="download-outline" size={16} color={Colors.textDark} />
              <Text style={styles.ghostBtnLabel}>{carouselMode ? 'Download slides' : 'Download'}</Text>
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
      ) : null}
    </View>
  );
}

// ── Step 3: Save ────────────────────────────────────────────────────────────

function Step3Save({
  prompt, picked, caption, setCaption, captionGenerating, scheduleAt, setScheduleAt,
  saving, onBack, onSaveDraft, onSchedule,
  logoApplying, logoApplied, onApplyLogo,
  carouselMode, slides, onDownload, aspectRatio,
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
  onDownload: () => void;
  aspectRatio: StudioAspectRatio;
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
              <View key={s.variantId} style={[styles.carouselSlideWrap, { aspectRatio: aspectRatioNumber(aspectRatio) }]}>
                <Image source={{ uri: s.url }} style={[styles.carouselSlide, { aspectRatio: aspectRatioNumber(aspectRatio) }]} resizeMode="cover" />
                <View style={styles.carouselSlideBadge}>
                  <Text style={styles.carouselSlideBadgeLabel}>{i + 1}/{slides.length}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={{ position: 'relative' }}>
            <Image source={{ uri: picked.url }} style={[styles.savePreviewImage, { aspectRatio: aspectRatioNumber(aspectRatio) }]} resizeMode="cover" />
            {logoApplying ? (
              <View style={[StyleSheet.absoluteFillObject, styles.logoOverlay]}>
                <ActivityIndicator size="small" color={Colors.white} />
                <Text style={styles.logoOverlayText}>Adding logo…</Text>
              </View>
            ) : null}
          </View>
        )}
        <View style={styles.previewActionRow}>
          <Pressable onPress={onBack} style={styles.changePickBtn}>
            <Ionicons name="swap-horizontal" size={14} color={Colors.primary} />
            <Text style={styles.changePickLabel}>{carouselMode ? 'Change slides' : 'Change image'}</Text>
          </Pressable>
          <Pressable onPress={onDownload} style={styles.changePickBtn}>
            <Ionicons name="download-outline" size={14} color={Colors.primary} />
            <Text style={styles.changePickLabel}>{carouselMode ? 'Download slides' : 'Download image'}</Text>
          </Pressable>
        </View>
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

function aspectRatioNumber(r: StudioAspectRatio): number {
  if (r === '9:16') return 9 / 16;
  if (r === '16:9') return 16 / 9;
  return 1;
}

function aspectOutputSize(r: StudioAspectRatio): { width: number; height: number } {
  if (r === '9:16') return { width: 1080, height: 1920 };
  if (r === '16:9') return { width: 1920, height: 1080 };
  return { width: 1080, height: 1080 };
}

function CropEditor({
  imageUrl, aspectRatio, setAspectRatio, disabled, onApply, onCancel,
}: {
  imageUrl: string;
  aspectRatio: StudioAspectRatio;
  setAspectRatio: (v: StudioAspectRatio) => void;
  disabled: boolean;
  onApply: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [src, setSrc] = useState(imageUrl);
  const [loadingImage, setLoadingImage] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ratio = aspectRatioNumber(aspectRatio);
  const frameWidth = 420;
  const frameHeight = Math.round(frameWidth / ratio);

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    setSrc(imageUrl);
    setErr(null);
    setLoadingImage(true);
    fetch(imageUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`image-fetch-${r.status}`);
        return r.blob();
      })
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (alive) setErr('Crop preview could not load this image. Try Download, crop externally, then upload it back.');
      })
      .finally(() => {
        if (alive) setLoadingImage(false);
      });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageUrl]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, startX: offset.x, startY: offset.y };
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || disabled) return;
    setOffset({
      x: dragRef.current.startX + e.clientX - dragRef.current.x,
      y: dragRef.current.startY + e.clientY - dragRef.current.y,
    });
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {/* noop */}
  }

  async function applyCrop() {
    const img = imgRef.current;
    const frame = frameRef.current;
    if (!img || !frame || !img.naturalWidth || !img.naturalHeight) {
      setErr('Image is still loading. Try again in a moment.');
      return;
    }
    setErr(null);
    try {
      const rect = frame.getBoundingClientRect();
      const output = aspectOutputSize(aspectRatio);
      const coverScale = Math.max(rect.width / img.naturalWidth, rect.height / img.naturalHeight) * zoom;
      const drawnW = img.naturalWidth * coverScale;
      const drawnH = img.naturalHeight * coverScale;
      const drawnX = rect.width / 2 - drawnW / 2 + offset.x;
      const drawnY = rect.height / 2 - drawnH / 2 + offset.y;
      const sx = Math.max(0, -drawnX / coverScale);
      const sy = Math.max(0, -drawnY / coverScale);
      const sw = Math.min(img.naturalWidth - sx, rect.width / coverScale);
      const sh = Math.min(img.naturalHeight - sy, rect.height / coverScale);
      const canvas = document.createElement('canvas');
      canvas.width = output.width;
      canvas.height = output.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas-unavailable');
      ctx.fillStyle = '#FFF8F2';
      ctx.fillRect(0, 0, output.width, output.height);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, output.width, output.height);
      onApply(canvas.toDataURL('image/png'));
    } catch {
      setErr('Crop failed. Download the image and crop externally, then upload it back.');
    }
  }

  return (
    <View style={styles.cropPanel}>
      <View style={styles.editHead}>
        <Ionicons name="crop-outline" size={16} color={Colors.primary} />
        <Text style={styles.editTitle}>Crop to {aspectRatio}</Text>
      </View>
      <Text style={styles.editHint}>Drag the image to reframe. Use zoom if the subject needs more breathing room.</Text>
      <View style={styles.cropAspectRow}>
        {([
          { value: '1:1', label: '1:1' },
          { value: '9:16', label: '9:16' },
          { value: '16:9', label: '16:9' },
        ] as const).map((r) => (
          <Pressable
            key={r.value}
            onPress={() => {
              setAspectRatio(r.value);
              setZoom(1);
              setOffset({ x: 0, y: 0 });
            }}
            disabled={disabled}
            style={[styles.cropAspectBtn, aspectRatio === r.value && styles.cropAspectBtnActive, disabled && { opacity: 0.6 }]}
          >
            <Text style={[styles.cropAspectLabel, aspectRatio === r.value && { color: Colors.primary }]}>{r.label}</Text>
          </Pressable>
        ))}
      </View>
      {loadingImage ? (
        <View style={styles.cropLoading}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.editHint}>Loading preview…</Text>
        </View>
      ) : null}
      <div
        ref={frameRef}
        style={{
          width: '100%',
          maxWidth: frameWidth,
          height: Math.min(frameHeight, 560),
          aspectRatio: ratio,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: Radius.md,
          background: Colors.bgTint,
          touchAction: 'none',
          cursor: disabled ? 'not-allowed' : 'grab',
          alignSelf: 'center',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <img
          ref={imgRef}
          src={src}
          alt="Crop source"
          draggable={false}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            minWidth: '100%',
            minHeight: '100%',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
            transformOrigin: 'center',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />
      </div>
      <View style={styles.cropControls}>
        <Text style={styles.editHint}>Zoom</Text>
        <input
          type="range"
          min="1"
          max="2.2"
          step="0.05"
          value={zoom}
          disabled={disabled}
          onChange={(e) => setZoom(Number(e.currentTarget.value))}
          style={{ flex: 1 }}
        />
        <Pressable onPress={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }} disabled={disabled} style={styles.ghostBtn}>
          <Text style={styles.ghostBtnLabel}>Reset</Text>
        </Pressable>
      </View>
      {err ? <Text style={[styles.editHint, { color: Colors.error }]}>{err}</Text> : null}
      <View style={styles.editActions}>
        <Pressable onPress={onCancel} disabled={disabled} style={styles.ghostBtn}>
          <Text style={styles.ghostBtnLabel}>Cancel</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={applyCrop} disabled={disabled} style={[styles.primaryBtn, disabled && styles.primaryBtnDisabled]}>
          {disabled ? <ActivityIndicator size="small" color={Colors.white} /> : <Ionicons name="checkmark" size={16} color={Colors.white} />}
          <Text style={styles.primaryBtnLabel}>{disabled ? 'Applying…' : 'Apply crop'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

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

function splitLines(value: string, max: number): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max);
}

function templateFormIsValid(kind: TemplateKind, form: TemplateForm, prompt: string): boolean {
  if (kind === 'tipCard') return !!((form.title.trim() || prompt.trim()) && splitLines(form.tipsText, 4).length >= 2);
  if (kind === 'quoteCard') return !!(form.quote.trim() || prompt.trim());
  if (kind === 'milestoneCard') return !!(form.age.trim() && (form.title.trim() || prompt.trim()) && splitLines(form.milestonesText, 6).length >= 3);
  return !!(form.story.trim() && form.attribution.trim());
}

function buildTemplateDraftPrompt(kind: TemplateKind, form: TemplateForm, prompt: string): string {
  if (kind === 'tipCard') {
    return [form.eyebrow || 'MaaMitra tip', form.title || prompt, ...splitLines(form.tipsText, 4)].filter(Boolean).join(' · ');
  }
  if (kind === 'quoteCard') {
    return ['Quote card', form.quote || prompt, form.attribution].filter(Boolean).join(' · ');
  }
  if (kind === 'milestoneCard') {
    return [form.age, form.title || prompt, ...splitLines(form.milestonesText, 6)].filter(Boolean).join(' · ');
  }
  return [form.eyebrow || 'Inspired story', form.story, form.attribution, prompt].filter(Boolean).join(' · ');
}

function estimateTemplateCost(kind: TemplateKind, form: TemplateForm, quality: Quality): number {
  const usesBackground = (kind === 'quoteCard' || kind === 'milestoneCard' || kind === 'realStoryCard') && !!form.backgroundPrompt.trim();
  return usesBackground ? QUALITY_INFO[quality].perVariantInr : 0;
}

function buildTemplateRenderRequest(
  kind: TemplateKind,
  form: TemplateForm,
  prompt: string,
  quality: Quality,
) {
  if (!templateFormIsValid(kind, form, prompt)) return null;

  const background = form.backgroundPrompt.trim()
    ? { type: 'ai' as const, model: QUALITY_INFO[quality].provider, prompt: form.backgroundPrompt.trim() }
    : undefined;

  if (kind === 'tipCard') {
    return {
      template: kind,
      props: {
        eyebrow: form.eyebrow.trim() || 'MaaMitra Tip',
        title: form.title.trim() || prompt.trim(),
        tips: splitLines(form.tipsText, 4),
      },
    };
  }
  if (kind === 'quoteCard') {
    return {
      template: kind,
      props: {
        quote: form.quote.trim() || prompt.trim(),
        attribution: form.attribution.trim(),
      },
      background,
    };
  }
  if (kind === 'milestoneCard') {
    return {
      template: kind,
      props: {
        age: form.age.trim(),
        title: form.title.trim() || prompt.trim(),
        milestones: splitLines(form.milestonesText, 6),
      },
      background,
    };
  }
  return {
    template: kind,
    props: {
      eyebrow: form.eyebrow.trim() || 'MaaMitra Story',
      story: form.story.trim(),
      attribution: form.attribution.trim(),
    },
    background,
  };
}

function templateFormToPrefillCurrent(kind: TemplateKind, form: TemplateForm): Record<string, any> {
  if (kind === 'tipCard') return { eyebrow: form.eyebrow, title: form.title, tips: splitLines(form.tipsText, 4) };
  if (kind === 'quoteCard') return { quote: form.quote, attribution: form.attribution };
  if (kind === 'milestoneCard') return { age: form.age, title: form.title, milestones: splitLines(form.milestonesText, 6) };
  return { eyebrow: form.eyebrow, story: form.story, attribution: form.attribution };
}

function applyTemplatePrefill(
  kind: TemplateKind,
  form: TemplateForm,
  props: Record<string, any>,
  backgroundPrompt: string,
): TemplateForm {
  const next: TemplateForm = { ...form, backgroundPrompt: backgroundPrompt || form.backgroundPrompt };
  if (kind === 'tipCard') {
    next.eyebrow = typeof props.eyebrow === 'string' ? props.eyebrow : next.eyebrow;
    next.title = typeof props.title === 'string' ? props.title : next.title;
    next.tipsText = Array.isArray(props.tips) ? props.tips.filter((x: unknown) => typeof x === 'string').join('\n') : next.tipsText;
    return next;
  }
  if (kind === 'quoteCard') {
    next.quote = typeof props.quote === 'string' ? props.quote : next.quote;
    next.attribution = typeof props.attribution === 'string' ? props.attribution : next.attribution;
    return next;
  }
  if (kind === 'milestoneCard') {
    next.age = typeof props.age === 'string' ? props.age : next.age;
    next.title = typeof props.title === 'string' ? props.title : next.title;
    next.milestonesText = Array.isArray(props.milestones) ? props.milestones.filter((x: unknown) => typeof x === 'string').join('\n') : next.milestonesText;
    return next;
  }
  next.eyebrow = typeof props.eyebrow === 'string' ? props.eyebrow : next.eyebrow;
  next.story = typeof props.story === 'string' ? props.story : next.story;
  next.attribution = typeof props.attribution === 'string' ? props.attribution : next.attribution;
  return next;
}

function hasTemplateContent(kind: TemplateKind, form: TemplateForm): boolean {
  if (kind === 'tipCard') return !!(form.title.trim() || form.tipsText.trim());
  if (kind === 'quoteCard') return !!(form.quote.trim() || form.attribution.trim());
  if (kind === 'milestoneCard') return !!(form.age.trim() || form.title.trim() || form.milestonesText.trim());
  return !!(form.story.trim() || form.attribution.trim());
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
    gap: Spacing.md,
    ...Shadow.sm,
  },
  cardTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  cardHint: { fontSize: FontSize.xs, color: Colors.textLight, lineHeight: 18 },

  // Step 1
  step1Header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, justifyContent: 'space-between' },
  step1CostChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.primarySoft,
    borderWidth: 1, borderColor: Colors.primary,
  },
  step1CostChipLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  step1Layout: { gap: Spacing.md },
  step1LayoutWide: { flexDirection: 'row', alignItems: 'flex-start' },
  step1MainCol: { flex: 1.35, gap: Spacing.md },
  step1SideCol: { flex: 0.95, gap: Spacing.sm },
  sectionBlock: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgTint,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  sectionBlockCompact: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgTint,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  sectionHeader: { gap: 2 },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  sectionHint: { fontSize: FontSize.xs, color: Colors.textLight, lineHeight: 16 },
  promptInput: {
    backgroundColor: Colors.bgLight,
    borderWidth: 1, borderColor: Colors.borderSoft,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: FontSize.md, color: Colors.textDark,
    minHeight: 96, textAlignVertical: 'top',
    outlineStyle: 'none' as any,
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
  uploadRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    backgroundColor: Colors.bgTint,
  },
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
  countCard: {
    flex: 1,
    minWidth: 72,
    padding: Spacing.md,
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.borderSoft,
    gap: 4,
  },
  qualityCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  lockedHintCard: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  lockedHintLink: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  lockedHintLinkLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  qualityHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qualityLabel: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  qualitySub: { fontSize: FontSize.xs, color: Colors.textLight, lineHeight: 16 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  optionCardCompact: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 150,
    padding: Spacing.sm,
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.borderSoft,
    gap: 4,
  },
  optionLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  optionSub: { fontSize: FontSize.xs, color: Colors.textLight, lineHeight: 16 },
  miniOptionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  miniOptionChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    backgroundColor: Colors.cardBg,
  },
  miniOptionChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  miniOptionChipLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDark },
  qualityStackCompact: { gap: Spacing.sm },
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  templateCard: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 180,
    padding: Spacing.sm,
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.borderSoft,
    gap: 4,
  },
  templateCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  templateLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  templateSub: { fontSize: FontSize.xs, color: Colors.textLight, lineHeight: 16 },
  templateAiRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  templateAiHint: { fontSize: FontSize.xs, color: Colors.textLight, lineHeight: 16 },
  templateFieldsGrid: { gap: Spacing.sm },
  templateFieldsGridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  fieldBlock: { gap: 6, flexBasis: '48%', flexGrow: 1, minWidth: 180 },
  fieldBlockFull: { width: '100%' },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDark, marginBottom: 6 },
  fieldInput: {
    backgroundColor: Colors.bgLight,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: FontSize.sm,
    color: Colors.textDark,
    outlineStyle: 'none' as any,
  },
  fieldTextArea: { minHeight: 100, textAlignVertical: 'top' as any },
  fieldTextAreaSmall: { minHeight: 72, textAlignVertical: 'top' as any },

  estCost: { fontSize: FontSize.xs, color: Colors.textLight, fontWeight: '600' },
  generateRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  generateRailTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  generateRailHint: { fontSize: FontSize.xs, color: Colors.textLight, lineHeight: 16, marginTop: 2 },
  generateRailBtn: { minWidth: 132, justifyContent: 'center' },

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
  cropPanel: {
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  cropControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  cropLoading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cropAspectRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  cropAspectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  cropAspectBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  cropAspectLabel: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.textDark },

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
  previewActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
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
