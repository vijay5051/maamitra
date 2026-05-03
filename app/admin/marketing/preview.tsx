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
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';
import { AdminPage, EmptyState, ToolbarButton } from '../../../components/admin/ui';
import {
  RenderableTemplateName,
  RenderTemplateInput,
  RenderTemplateResult,
  RenderTemplateError,
  renderMarketingTemplate,
} from '../../../services/marketing';

type ImageSource = 'none' | 'pexels' | 'flux';

const TEMPLATE_PRESETS: Record<RenderableTemplateName, { label: string; props: Record<string, any>; defaultStock?: string; defaultAi?: string }> = {
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
    defaultStock: 'mother and baby soft warm light',
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
    defaultStock: 'happy indian baby 4 months',
  },
};

export default function MarketingPreviewScreen() {
  const [template, setTemplate] = useState<RenderableTemplateName>('tipCard');
  const [imageSource, setImageSource] = useState<ImageSource>('none');
  const [stockQuery, setStockQuery] = useState<string>(TEMPLATE_PRESETS.tipCard.defaultStock ?? '');
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [propsJson, setPropsJson] = useState<string>(JSON.stringify(TEMPLATE_PRESETS.tipCard.props, null, 2));
  const [rendering, setRendering] = useState(false);
  const [result, setResult] = useState<RenderTemplateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pickTemplate(t: RenderableTemplateName) {
    setTemplate(t);
    setPropsJson(JSON.stringify(TEMPLATE_PRESETS[t].props, null, 2));
    setStockQuery(TEMPLATE_PRESETS[t].defaultStock ?? '');
    setAiPrompt(TEMPLATE_PRESETS[t].defaultAi ?? '');
    if (t === 'tipCard') setImageSource('none');
    else if (TEMPLATE_PRESETS[t].defaultStock) setImageSource('pexels');
    setResult(null);
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
      if (imageSource === 'pexels' && stockQuery.trim()) input.stockQuery = stockQuery.trim();
      if (imageSource === 'flux' && aiPrompt.trim()) input.aiPrompt = aiPrompt.trim();

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
          <ToolbarButton
            label={rendering ? 'Rendering…' : 'Render'}
            icon="sparkles"
            variant="primary"
            onPress={render}
            disabled={rendering}
          />
        }
        error={error}
      >
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

            <Section title="Background image">
              <View style={styles.chipRow}>
                {(['none', 'pexels', 'flux'] as ImageSource[]).map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setImageSource(s)}
                    style={[styles.tab, imageSource === s && styles.tabActive]}
                  >
                    <Text style={[styles.tabLabel, imageSource === s && styles.tabLabelActive]}>
                      {s === 'none' ? 'No image' : s === 'pexels' ? 'Pexels stock' : 'AI (FLUX)'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {imageSource === 'pexels' ? (
                <View style={{ marginTop: Spacing.sm }}>
                  <Text style={styles.fieldLabel}>Search query</Text>
                  <Text style={styles.fieldHint}>e.g. "indian mother newborn warm light".</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={stockQuery}
                    onChangeText={setStockQuery}
                    placeholder="search query"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="none"
                  />
                </View>
              ) : null}
              {imageSource === 'flux' ? (
                <View style={{ marginTop: Spacing.sm }}>
                  <Text style={styles.fieldLabel}>AI prompt</Text>
                  <Text style={styles.fieldHint}>Describe the image. ~₹0.25/render via Replicate FLUX Schnell.</Text>
                  <TextInput
                    style={[styles.fieldInput, { minHeight: 80, textAlignVertical: 'top' }]}
                    value={aiPrompt}
                    onChangeText={setAiPrompt}
                    multiline
                    placeholder="watercolor illustration of a baby holding a flower, warm pastel palette"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              ) : null}
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
