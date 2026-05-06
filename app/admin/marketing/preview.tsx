/**
 * Admin · Marketing template preview.
 *
 * Lets the admin try out the 3 Phase-2 templates with sample inputs and see
 * the rendered PNG come back from the Cloud Function. Used to verify the
 * brand kit looks right before Phase 3 wires the daily auto-generator.
 *
 * The image source picker (none / Pexels / AI) maps directly to what the
 * cron will use later — same params, same Function, just hand-driven.
 */
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';
import { AdminPage, EmptyState, ToolbarButton } from '../../../components/admin/ui';
import {
  AiImageModel,
  BackgroundSpec,
  RenderableTemplateName,
  RenderTemplateInput,
  RenderTemplateResult,
  RenderTemplateError,
  fetchBrandKit,
  renderMarketingTemplate,
  saveBrandKit,
} from '../../../services/marketing';
import { friendlyError } from '../../../services/marketingErrors';
import { TemplateDefault } from '../../../lib/marketingTypes';
import { useAuthStore } from '../../../store/useAuthStore';

type SourceKind = 'none' | 'stock' | 'ai';

interface TemplatePreset {
  label: string;
  props: Record<string, any>;
  defaultStockQuery?: string;
  defaultAiPrompt?: string;
}

// Defaults are Indian-context-rich on purpose — Pexels' library skews
// Western, and AI models follow specific cultural cues much better than
// generic ones. Tweak in admin to taste.
const TEMPLATE_PRESETS: Record<RenderableTemplateName, TemplatePreset> = {
  tipCard: {
    label: 'Tip Card',
    props: {
      eyebrow: 'Tip Tuesday',
      title: '3 things every new mom should know',
      tips: [
        'Always place baby on their back to sleep — reduces SIDS risk by 50%.',
        'Track wet diapers, not just feeds. Six per day = enough milk.',
        'Skin-to-skin in the first hour boosts breastfeeding success.',
      ],
    },
  },
  quoteCard: {
    label: 'Quote Card',
    props: {
      quote: 'There is no way to be a perfect mother, and a million ways to be a good one.',
      attribution: 'Jill Churchill',
    },
    defaultStockQuery: 'indian mother holding newborn warm light saree',
    defaultAiPrompt:
      'soft warm photograph of an indian mother gently holding her newborn baby, traditional saree, golden hour light through a window, tender quiet mood, watercolour pastel palette, high detail, professional photography',
  },
  milestoneCard: {
    label: 'Milestone Card',
    props: {
      age: '4 months',
      title: 'What to expect this month',
      milestones: [
        'Holds head steady when sitting up',
        'Pushes down on legs when feet on hard surface',
        'Reaches for and grabs toys',
        'Babbles with expression',
        'Recognises familiar people from across the room',
      ],
    },
    defaultStockQuery: 'indian baby 4 months bright natural light playful',
    defaultAiPrompt:
      'cheerful indian baby around 4 months old exploring on a soft pastel mat at home, bright natural light, marigold accents, joyful expression, lifestyle photography, warm tones',
  },
  realStoryCard: {
    label: 'Real Story',
    props: {
      eyebrow: 'Real story',
      story:
        'My 6-month-old refused every spoon I tried — until I let her grab the dal-rice with her hands. She giggled and ate a full bowl. Sometimes the mess IS the milestone.',
      attribution: 'Priya, Pune · mom of Aanya',
    },
    defaultStockQuery: 'indian mother feeding baby home warm light',
    defaultAiPrompt:
      'warm candid photograph of a young indian mother feeding her baby at home, baby smiling, soft natural light, traditional saree, lived-in cosy interior, lifestyle photography, pastel palette',
  },
};

interface AiModelOption {
  value: AiImageModel;
  label: string;
  hint: string;
}

const AI_MODELS: AiModelOption[] = [
  { value: 'imagen', label: 'Imagen (Google)', hint: 'Best for Indian skin tones, traditional clothing, Indian environments. ~₹3.30/render.' },
  { value: 'dalle',  label: 'gpt-image-1 (OpenAI)', hint: 'Strong prompt adherence for compositional details. ~₹3.50/render (medium quality).' },
  { value: 'flux',   label: 'FLUX Schnell',  hint: 'Cheapest + fastest, generic look. ~₹0.25/render.' },
];

export default function MarketingPreviewScreen() {
  const user = useAuthStore((s) => s.user);
  const [template, setTemplate] = useState<RenderableTemplateName>('tipCard');
  const [sourceKind, setSourceKind] = useState<SourceKind>('none');
  const [aiModel, setAiModel] = useState<AiImageModel>('dalle');
  const [stockQuery, setStockQuery] = useState<string>(TEMPLATE_PRESETS.tipCard.defaultStockQuery ?? '');
  const [aiPrompt, setAiPrompt] = useState<string>(TEMPLATE_PRESETS.tipCard.defaultAiPrompt ?? '');
  const [propsJson, setPropsJson] = useState<string>(JSON.stringify(TEMPLATE_PRESETS.tipCard.props, null, 2));
  const [rendering, setRendering] = useState(false);
  const [result, setResult] = useState<RenderTemplateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Saved per-template defaults from marketing_brand/main. Loaded once on
   *  mount and refreshed after every Save — both Create Post (template mode)
   *  and the cron generator pull from this same field. */
  const [savedDefaults, setSavedDefaults] = useState<Partial<Record<RenderableTemplateName, TemplateDefault>>>({});
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  // Load brand kit once and hydrate UI from the active template's saved
  // default if one exists. Falls back to the hard-coded TEMPLATE_PRESETS
  // when the admin hasn't locked one yet.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const brand = await fetchBrandKit();
        if (!alive) return;
        const td = brand?.templateDefaults ?? {};
        setSavedDefaults(td);
        applySavedToCurrent('tipCard', td);
      } catch (e: any) {
        // Soft-fail: page still works as a one-shot preview without persisted
        // defaults if Firestore is unavailable.
        console.warn('[preview] brand load failed', e);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Apply the saved default for `t` to the live form (or the hardcoded
   *  preset if nothing is saved). Keeps source-kind picker in sync with the
   *  saved value so admin sees what's locked. */
  function applySavedToCurrent(t: RenderableTemplateName, defaults: Partial<Record<RenderableTemplateName, TemplateDefault>>) {
    const preset = TEMPLATE_PRESETS[t];
    const saved = defaults[t];
    setTemplate(t);
    setPropsJson(JSON.stringify(preset.props, null, 2));
    if (saved) {
      setSourceKind(saved.source);
      setStockQuery(saved.stockQuery ?? preset.defaultStockQuery ?? '');
      setAiModel(saved.aiModel ?? 'dalle');
      setAiPrompt(saved.aiPrompt ?? preset.defaultAiPrompt ?? '');
    } else {
      setSourceKind(t === 'tipCard' ? 'none' : 'ai');
      setStockQuery(preset.defaultStockQuery ?? '');
      setAiModel('dalle');
      setAiPrompt(preset.defaultAiPrompt ?? '');
    }
    setResult(null);
  }

  function pickTemplate(t: RenderableTemplateName) {
    applySavedToCurrent(t, savedDefaults);
  }

  async function saveAsDefault() {
    if (!user) {
      setError('Sign in to save defaults.');
      return;
    }
    setError(null);
    setSavedBanner(null);
    setSaving(true);
    try {
      const next: TemplateDefault = (() => {
        if (template === 'tipCard') return { source: 'none', updatedAt: new Date().toISOString() };
        if (sourceKind === 'stock') {
          return {
            source: 'stock',
            stockQuery: stockQuery.trim().slice(0, 240),
            updatedAt: new Date().toISOString(),
          };
        }
        if (sourceKind === 'ai') {
          return {
            source: 'ai',
            aiModel,
            aiPrompt: aiPrompt.trim().slice(0, 1200),
            updatedAt: new Date().toISOString(),
          };
        }
        return { source: 'none', updatedAt: new Date().toISOString() };
      })();
      const merged = { ...savedDefaults, [template]: next };
      await saveBrandKit({ uid: user.uid, email: user.email }, { templateDefaults: merged });
      setSavedDefaults(merged);
      setSavedBanner(`${TEMPLATE_PRESETS[template].label} default locked. Create Post + Auto Post now use these settings.`);
      setTimeout(() => setSavedBanner(null), 4000);
    } catch (e: any) {
      setError(friendlyError('Save default', e));
    } finally {
      setSaving(false);
    }
  }

  const isLocked = !!savedDefaults[template];
  const lockedAt = savedDefaults[template]?.updatedAt;

  function buildBackground(): BackgroundSpec | undefined {
    if (template === 'tipCard') return undefined;
    if (sourceKind === 'none') return undefined;
    if (sourceKind === 'stock') {
      const q = stockQuery.trim();
      if (!q) return undefined;
      return { type: 'stock', provider: 'pexels', query: q };
    }
    // ai
    const p = aiPrompt.trim();
    if (!p) return undefined;
    return { type: 'ai', model: aiModel, prompt: p };
  }

  async function render() {
    setError(null);
    setRendering(true);
    setResult(null);
    try {
      let props: Record<string, any>;
      try {
        props = JSON.parse(propsJson);
      } catch (e: any) {
        throw new Error(`Invalid JSON in props: ${e?.message ?? e}`);
      }
      const input: RenderTemplateInput = { template, props };
      const bg = buildBackground();
      if (bg) input.background = bg;

      const res = await renderMarketingTemplate(input);
      if (!res.ok) {
        const err = res as RenderTemplateError;
        throw new Error(`${err.code}: ${err.message}`);
      }
      setResult(res as RenderTemplateResult);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setRendering(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Template preview' }} />
      <AdminPage
        title="Template preview"
        description="Try the rendering pipeline with sample inputs. Same path the daily generator will use in Phase 3 — caption AI is the only piece missing."
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Marketing', href: '/admin/marketing' },
          { label: 'Preview' },
        ]}
        headerActions={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <ToolbarButton
              label={saving ? 'Saving…' : isLocked ? 'Update locked default' : 'Save as default'}
              icon="lock-closed"
              onPress={saveAsDefault}
              disabled={saving || rendering}
            />
            <ToolbarButton
              label={rendering ? 'Rendering…' : 'Render'}
              icon="sparkles"
              variant="primary"
              onPress={render}
              disabled={rendering}
            />
          </View>
        }
        error={error}
      >
        {savedBanner ? (
          <View style={styles.savedBanner}>
            <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
            <Text style={styles.savedBannerText}>{savedBanner}</Text>
          </View>
        ) : null}
        {isLocked && !savedBanner ? (
          <View style={styles.lockBanner}>
            <Ionicons name="lock-closed" size={12} color={Colors.primary} />
            <Text style={styles.lockBannerText}>
              {TEMPLATE_PRESETS[template].label} is locked. These settings are used by Create Post + Auto Post.
              {lockedAt ? ` Saved ${formatRelativeTime(lockedAt)}.` : ''}
            </Text>
          </View>
        ) : null}
        <View style={styles.row}>
          {/* ── Left: configure ────────────────────────────────────────── */}
          <View style={styles.col}>
            <Section title="Template">
              <View style={styles.chipRow}>
                {(Object.keys(TEMPLATE_PRESETS) as RenderableTemplateName[]).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => pickTemplate(t)}
                    style={[styles.tab, template === t && styles.tabActive]}
                  >
                    <Text style={[styles.tabLabel, template === t && styles.tabLabelActive]}>
                      {TEMPLATE_PRESETS[t].label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Section>

            <Section
              title="Background image"
              description={
                template === 'tipCard'
                  ? 'Tip Card is solid-background by design (text legibility first). Photo sources only apply to Quote Card and Milestone Card.'
                  : undefined
              }
            >
              {template === 'tipCard' ? (
                <Text style={styles.fieldHint}>
                  No background image — Tip Card uses your brand palette as the canvas.
                </Text>
              ) : (
                <>
                  <View style={styles.chipRow}>
                    {(['none', 'stock', 'ai'] as SourceKind[]).map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => setSourceKind(s)}
                        style={[styles.tab, sourceKind === s && styles.tabActive]}
                      >
                        <Text style={[styles.tabLabel, sourceKind === s && styles.tabLabelActive]}>
                          {s === 'none' ? 'No image' : s === 'stock' ? 'Stock photo' : 'AI image'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {sourceKind === 'stock' ? (
                    <View style={{ marginTop: Spacing.md }}>
                      <Text style={styles.fieldLabel}>Pexels search query</Text>
                      <Text style={styles.fieldHint}>
                        Pexels skews Western — prepend "indian", "south asian", or specific cues
                        like "saree" / "kurta" to get the right look. Free.
                      </Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={stockQuery}
                        onChangeText={setStockQuery}
                        placeholder="indian mother newborn warm light"
                        placeholderTextColor={Colors.textMuted}
                        autoCapitalize="none"
                      />
                    </View>
                  ) : null}

                  {sourceKind === 'ai' ? (
                    <View style={{ marginTop: Spacing.md, gap: Spacing.md }}>
                      <View>
                        <Text style={styles.fieldLabel}>Model</Text>
                        <View style={[styles.chipRow, { marginTop: 6 }]}>
                          {AI_MODELS.map((m) => (
                            <Pressable
                              key={m.value}
                              onPress={() => setAiModel(m.value)}
                              style={[styles.tab, aiModel === m.value && styles.tabActive]}
                            >
                              <Text style={[styles.tabLabel, aiModel === m.value && styles.tabLabelActive]}>
                                {m.label}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                        <Text style={[styles.fieldHint, { marginTop: 6 }]}>
                          {AI_MODELS.find((m) => m.value === aiModel)?.hint}
                        </Text>
                      </View>

                      <View>
                        <Text style={styles.fieldLabel}>Prompt</Text>
                        <Text style={styles.fieldHint}>
                          Be specific about culture, lighting, mood, and style for the strongest
                          results.
                        </Text>
                        <TextInput
                          style={[styles.fieldInput, { minHeight: 100, textAlignVertical: 'top' }]}
                          value={aiPrompt}
                          onChangeText={setAiPrompt}
                          multiline
                          placeholder="soft warm photograph of an indian mother holding her newborn..."
                          placeholderTextColor={Colors.textMuted}
                        />
                      </View>
                    </View>
                  ) : null}
                </>
              )}
            </Section>

            <Section title="Template props (JSON)" description="Edit to tweak text. Length caps + sanitisation happen server-side; invalid JSON shows here as an error.">
              <TextInput
                style={[styles.fieldInput, styles.codeInput]}
                value={propsJson}
                onChangeText={setPropsJson}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Section>
          </View>

          {/* ── Right: result ─────────────────────────────────────────── */}
          <View style={styles.col}>
            <Section title="Result">
              {rendering ? (
                <View style={styles.placeholderCard}>
                  <Ionicons name="sparkles" size={36} color={Colors.primary} />
                  <Text style={styles.placeholderText}>Rendering…</Text>
                  <Text style={styles.placeholderHint}>Cold-start can take ~10s on first call (font load + Resvg init).</Text>
                </View>
              ) : result ? (
                <View>
                  <View style={styles.resultImgWrap}>
                    <Image source={{ uri: result.url }} style={styles.resultImg} resizeMode="contain" />
                  </View>
                  <Text style={styles.metaLine}>
                    {result.width}×{result.height} · {(result.bytes / 1024).toFixed(1)} KB · source: {result.imageSource}
                  </Text>
                  {result.imageAttribution ? <Text style={styles.metaLine}>{result.imageAttribution}</Text> : null}
                  <Text selectable style={[styles.metaLine, { marginTop: Spacing.xs }]}>{result.url}</Text>
                </View>
              ) : (
                <EmptyState kind="empty" title="No render yet" body="Pick a template + image source and hit Render." compact />
              )}
            </Section>
          </View>
        </View>
      </AdminPage>
    </>
  );
}

function formatRelativeTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return 'just now';
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description ? <Text style={styles.sectionDesc}>{description}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.lg, flexWrap: 'wrap' },
  col: { flex: 1, minWidth: 320 },

  section: { marginBottom: Spacing.lg },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textDark, marginBottom: 4 },
  sectionDesc: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.md, lineHeight: 18 },
  sectionBody: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    ...Shadow.sm,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  tabLabel: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '600' },
  tabLabelActive: { color: Colors.primary, fontWeight: '700' },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 },
  fieldHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 6, lineHeight: 18 },
  fieldInput: {
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: FontSize.sm,
    color: Colors.textDark,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  codeInput: {
    fontFamily: 'monospace',
    fontSize: 12,
    minHeight: 280,
    textAlignVertical: 'top',
  },

  savedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.success,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    marginBottom: Spacing.md,
  },
  savedBannerText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.success, flex: 1 },
  lockBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.primary,
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    marginBottom: Spacing.md,
  },
  lockBannerText: { fontSize: 11, fontWeight: '600', color: Colors.primary, flex: 1 },

  placeholderCard: {
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: Spacing.xl,
  },
  placeholderText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  placeholderHint: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },

  resultImgWrap: {
    aspectRatio: 1,
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  resultImg: { width: '100%', height: '100%' },
  metaLine: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
});
