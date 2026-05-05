// Library AI — Articles generator.
//
// Produces full-length parenting articles ready for the Library "Read" tab.
// Each run generates one article:
//   1. Pick (topic, ageBucket) — caller override or auto-rotated by performance.
//   2. Ask gpt-4o-mini for { title, preview, body, readTime, emoji, tag }.
//   3. Compliance scan against marketing brand kit forbidden-words list.
//   4. Generate hero image via Imagen (style-locked) → upload to Storage.
//      Falls back to Pexels search → falls back to imageless.
//   5. Write to `articles` collection at status='published' or 'draft'
//      depending on settings.autoPublish.
//
// Re-uses the marketing renderer's brand kit + image sources for
// consistency. Output shape matches the legacy `Article` type so the
// existing Library UI renders AI items without any client-side change.

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

import { fluxSchnell, imagenGenerate, openaiImage, pexelsSearch } from '../marketing/imageSources';
import { buildStyleLockedImagePrompt, buildSystemVoiceHeader, LibraryBrand, loadLibraryBrand, runCompliance } from './brand';
import { chatJson } from './openai';
import {
  AgeBucket,
  KindSettings,
  loadLibraryAiSettings,
} from './settings';
import { callerIsContentAdmin } from './auth';

interface ArticleInput {
  topic?: unknown;
  ageBucketKey?: unknown;
  imageModel?: unknown;          // 'imagen' | 'flux' | 'dalle' | 'pexels' | 'none'
  publish?: unknown;             // override: force draft vs published
}

export interface ArticleGenOk {
  ok: true;
  articleId: string;
  title: string;
  topic: string;
  ageBucketKey: string;
  imageUrl: string | null;
  imageSource: string;
  status: 'published' | 'draft';
  costInr: number;
  flags: { type: string; phrase: string }[];
}

export interface ArticleGenErr {
  ok: false;
  code: string;
  message: string;
}

export type ArticleGenResult = ArticleGenOk | ArticleGenErr;

type ImageModel = 'imagen' | 'flux' | 'dalle' | 'pexels' | 'none';

interface ArticleDraftJson {
  title: string;
  preview: string;
  body: string;
  readTime: string;
  emoji: string;
  tag: string;
  imagePrompt: string;
  audience?: 'all' | 'mother' | 'father' | 'both-parents';
}

// ── Slot picker ─────────────────────────────────────────────────────────────

function pickAgeBucket(buckets: AgeBucket[], override: string | null, today: Date): AgeBucket {
  if (override) {
    const m = buckets.find((b) => b.key === override);
    if (m) return m;
  }
  // Rotate by day-of-year so consecutive runs don't all hit the same bucket.
  const start = Date.UTC(today.getUTCFullYear(), 0, 0);
  const diff = today.getTime() - start;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return buckets[dayOfYear % buckets.length];
}

function pickTopic(topics: string[], override: string | null, today: Date, ageBucket: AgeBucket): string {
  const cleaned = topics.filter((t) => typeof t === 'string' && t.trim());
  if (!cleaned.length) return 'Indian Parenting Tips';
  if (override) {
    const match = cleaned.find((t) => t.toLowerCase() === override.toLowerCase());
    if (match) return match;
    if (override.trim()) return override.trim().slice(0, 80);
  }
  // Hash (date + ageBucket) so each run pulls a different topic but the same
  // run for the same bucket is reproducible during retries.
  const seed = today.toISOString().slice(0, 10) + '|' + ageBucket.key;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return cleaned[Math.abs(h) % cleaned.length];
}

// ── De-dupe — avoid generating an article whose title we already published in
// the last 60 days. ─────────────────────────────────────────────────────────

async function recentArticleTitles(): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 60 * 24 * 3600 * 1000);
    const snap = await admin.firestore()
      .collection('articles')
      .where('createdAt', '>=', cutoff)
      .limit(200)
      .get();
    snap.forEach((d) => {
      const t = (d.data() as any)?.title;
      if (typeof t === 'string') out.add(t.toLowerCase().trim());
    });
  } catch (e) {
    console.warn('[library/articles] recentTitles read failed', e);
  }
  return out;
}

// ── Caption / body generation ───────────────────────────────────────────────

async function writeArticleBody(
  brand: LibraryBrand,
  topic: string,
  ageBucket: AgeBucket,
  tone: string,
  recentTitles: Set<string>,
): Promise<ArticleDraftJson | null> {
  const system = [
    buildSystemVoiceHeader(brand),
    `Tone: ${tone}`,
    'You write long-form, magazine-quality parenting articles for the in-app Library.',
    'Output STRICT JSON only. No prose outside the JSON object. No markdown.',
  ].join('\n');

  const ageDesc = ageBucket.ageMin < 0
    ? 'pregnancy stage'
    : `child age ${ageBucket.ageMin}–${ageBucket.ageMax} months (${ageBucket.label})`;

  const recentList = Array.from(recentTitles).slice(0, 25).join(' | ') || 'none';

  const user = [
    `Write ONE original Library article about: ${topic}.`,
    `Audience: Indian mother whose ${ageDesc}.`,
    `Do NOT pick a title that overlaps with recent titles: ${recentList}`,
    '',
    'Body shape: 4–6 sections. Each section starts with a short bold-style heading on its own line followed by a paragraph (no markdown — plain text with section heading on a separate line). 600–900 words total.',
    'Always:',
    '- Cite Indian context where relevant (IAP guidance, Indian foods, family pressures, monsoon/heat realities).',
    '- Lead with empathy, then practical steps.',
    '- Close with a one-line reassurance.',
    'Never:',
    '- Diagnose or prescribe medication / dosages.',
    '- Compare specific brands.',
    '- Cite specific studies you cannot verify.',
    '',
    'Return JSON with these exact keys:',
    '{',
    '  "title": "≤80 chars, specific, scannable, no clickbait",',
    '  "preview": "2-3 sentence hook for the article card (≤280 chars)",',
    '  "body": "the full article body as plain text with sections separated by blank lines",',
    '  "readTime": "e.g. \\"5 min read\\"",',
    '  "emoji": "single emoji that matches the topic",',
    '  "tag": "one short label, e.g. \\"Sleep\\", \\"Weaning\\", \\"Mental Health\\" (≤24 chars)",',
    '  "imagePrompt": "specific scene prompt for an AI image generator — describe an Indian-context moment with lighting and mood, do NOT include text or logos",',
    '  "audience": "all" | "mother" | "father" | "both-parents"',
    '}',
  ].join('\n');

  const parsed = await chatJson<Partial<ArticleDraftJson>>(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { temperature: 0.85, maxTokens: 2400 },
  );
  if (!parsed) return null;
  const title = trim(parsed.title, 120);
  const body = trim(parsed.body, 6000);
  if (!title || body.length < 200) return null;
  return {
    title,
    preview: trim(parsed.preview, 320) || body.slice(0, 240),
    body,
    readTime: trim(parsed.readTime, 24) || estimateReadTime(body),
    emoji: trim(parsed.emoji, 6) || '📰',
    tag: trim(parsed.tag, 24) || topic.split(' ')[0],
    imagePrompt: trim(parsed.imagePrompt, 600) || `Indian mother and ${ageBucket.label.toLowerCase()} child, warm soft lighting`,
    audience: parsed.audience === 'mother' || parsed.audience === 'father' || parsed.audience === 'both-parents' ? parsed.audience : 'all',
  };
}

function trim(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function estimateReadTime(body: string): string {
  const words = body.split(/\s+/).filter(Boolean).length;
  return `${Math.max(2, Math.round(words / 220))} min read`;
}

// ── Hero image ──────────────────────────────────────────────────────────────

async function renderHeroImage(
  prompt: string,
  brand: LibraryBrand,
  preferred: ImageModel,
): Promise<{ url: string | null; source: string; costInr: number }> {
  if (preferred === 'none') return { url: null, source: 'none', costInr: 0 };

  const styled = buildStyleLockedImagePrompt(prompt, brand);
  let aiUrl: string | null = null;
  let source = preferred;
  let costInr = 0;

  if (preferred === 'imagen') {
    aiUrl = await imagenGenerate(styled, { aspectRatio: '16:9' }).catch(() => null);
    if (aiUrl) costInr = 3.30;
  } else if (preferred === 'dalle') {
    aiUrl = await openaiImage(styled, { quality: 'medium', size: '1536x1024' }).catch(() => null);
    if (aiUrl) costInr = 3.50;
  } else if (preferred === 'flux') {
    aiUrl = await fluxSchnell(styled, { aspectRatio: '16:9' }).catch(() => null);
    if (aiUrl) costInr = 0.25;
  }

  if (aiUrl) {
    const stored = await persistImage(aiUrl, source);
    if (stored) return { url: stored, source, costInr };
  }

  // Fallback to Pexels stock if AI fails or we asked for stock directly.
  const stock = await pexelsSearch(prompt.slice(0, 100), { orientation: 'landscape' }).catch(() => null);
  if (stock) {
    const stored = await persistImage(stock.url, 'pexels');
    if (stored) return { url: stored, source: 'pexels', costInr: 0 };
    return { url: stock.url, source: 'pexels', costInr: 0 };
  }
  return { url: null, source: 'none', costInr: 0 };
}

async function persistImage(url: string, source: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const path = `library/articles/${timestamp}-${source}.jpg`;
    const file = admin.storage().bucket().file(path);
    await file.save(buf, {
      contentType: source === 'imagen' || source === 'flux' || source === 'dalle' ? 'image/png' : 'image/jpeg',
      metadata: { metadata: { source, kind: 'library-article' } },
    });
    await file.makePublic();
    return `https://storage.googleapis.com/${admin.storage().bucket().name}/${path}`;
  } catch (e) {
    console.warn('[library/articles] persistImage failed', e);
    return null;
  }
}

// ── Public entry ────────────────────────────────────────────────────────────

export async function runArticleGenerator(
  input: ArticleInput,
  actorEmail: string | null,
): Promise<ArticleGenResult> {
  const settings = await loadLibraryAiSettings();
  if (settings.paused) {
    return { ok: false, code: 'paused', message: 'Library AI is globally paused.' };
  }
  const k: KindSettings = settings.articles;

  const today = new Date(Date.now() + 5.5 * 3600 * 1000);
  const ageBucket = pickAgeBucket(
    k.ageBuckets,
    typeof input.ageBucketKey === 'string' ? input.ageBucketKey : null,
    today,
  );
  const topic = pickTopic(
    k.topics,
    typeof input.topic === 'string' ? input.topic : null,
    today,
    ageBucket,
  );

  const brand = await loadLibraryBrand();
  const recent = await recentArticleTitles();

  const draft = await writeArticleBody(brand, topic, ageBucket, k.tone, recent);
  if (!draft) {
    return { ok: false, code: 'caption-failed', message: 'AI failed to produce an article body.' };
  }

  const preferred: ImageModel = (['imagen', 'dalle', 'flux', 'pexels', 'none'] as ImageModel[]).includes(input.imageModel as any)
    ? (input.imageModel as ImageModel)
    : 'imagen';
  const image = await renderHeroImage(draft.imagePrompt, brand, preferred);

  // Compliance — body + title.
  const screen = `${draft.title}\n${draft.body}`;
  const { flags, disclaimers } = runCompliance(screen, brand);
  // Append disclaimers to the body so they're visible to readers.
  let body = draft.body.trim();
  if (disclaimers.length > 0) {
    body = body + '\n\n' + disclaimers.join('\n');
  }

  // Decide publish vs draft. autoPublish=true unless caller forced 'draft'
  // OR there are unrecoverable forbidden-word flags.
  const explicit = input.publish === 'published' || input.publish === 'draft' ? input.publish : null;
  const hasHardFlag = flags.some((f) => f.type === 'forbidden_word');
  const status: 'published' | 'draft' =
    explicit
      ? explicit as 'published' | 'draft'
      : hasHardFlag
        ? 'draft'
        : k.autoPublish ? 'published' : 'draft';

  const docRef = admin.firestore().collection('articles').doc();
  const expiresAt = k.expireAfterDays > 0
    ? admin.firestore.Timestamp.fromMillis(Date.now() + k.expireAfterDays * 24 * 3600 * 1000)
    : null;

  const doc = {
    title: draft.title,
    preview: draft.preview,
    body,
    topic,
    readTime: draft.readTime,
    ageMin: ageBucket.ageMin,
    ageMax: ageBucket.ageMax,
    emoji: draft.emoji,
    tag: draft.tag,
    imageUrl: image.url ?? null,
    audience: draft.audience ?? 'all',
    status,
    source: 'ai',
    aiModel: 'gpt-4o-mini',
    aiTopic: topic,
    aiAgeBucketKey: ageBucket.key,
    aiImageSource: image.source,
    aiImagePrompt: draft.imagePrompt,
    aiCostInr: image.costInr + 0.10,
    aiFlags: flags.map((f) => `${f.type}:${f.phrase}`),
    aiGeneratedBy: actorEmail ?? 'cron',
    expiresAt,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await docRef.set(doc);

  // Cost log row.
  try {
    await admin.firestore().collection('library_ai_log').add({
      kind: 'article',
      itemId: docRef.id,
      topic,
      ageBucketKey: ageBucket.key,
      imageSource: image.source,
      costInr: image.costInr + 0.10,
      status,
      flags: flags.length,
      generatedBy: actorEmail ?? 'cron',
      ts: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.warn('[library/articles] log row failed', e);
  }

  return {
    ok: true,
    articleId: docRef.id,
    title: draft.title,
    topic,
    ageBucketKey: ageBucket.key,
    imageUrl: image.url,
    imageSource: image.source,
    status,
    costInr: image.costInr + 0.10,
    flags: flags.map((f) => ({ type: f.type, phrase: f.phrase })),
  };
}

// ── HTTPS callable wrapper ──────────────────────────────────────────────────

export function buildGenerateArticleNow(allowList: ReadonlySet<string>) {
  return functions
    .runWith({ memory: '1GB', timeoutSeconds: 300 })
    .https.onCall(async (data: ArticleInput, context): Promise<ArticleGenResult> => {
      if (!(await callerIsContentAdmin(context.auth?.token, allowList))) {
        throw new functions.https.HttpsError('permission-denied', 'Only content admins can generate library articles.');
      }
      const actorEmail = context.auth?.token?.email ?? null;
      return runArticleGenerator(data ?? {}, actorEmail);
    });
}
