#!/usr/bin/env node

/**
 * Generate one MaaMitra Library article draft for today's date and save it to:
 *   1. Firebase Storage (hero image)
 *   2. Firestore `articles/{daily-article-YYYY-MM-DD}`
 *
 * Inputs:
 *   - OpenAI API key from Firestore `app_settings/integrations.openai.apiKey`
 *     or `functions/.env` / process env fallback.
 *   - Firebase CLI cached auth from `~/.config/configstore/firebase-tools.json`
 *   - Visual style references from `assets/illustrations/*.webp`
 *
 * Run:
 *   node scripts/generate-daily-library-article.mjs
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PROJECT_ID = 'maa-mitra-7kird8';
const STORAGE_BUCKET = 'maa-mitra-7kird8.firebasestorage.app';
const FUNCTIONS_ENV = join(ROOT, 'functions', '.env');
const OUTPUT_DIR = join(ROOT, 'tmp', 'daily-articles');

const DEFAULT_TOPICS = [
  'Feeding & Weaning',
  'Sleep',
  'Pregnancy Wellness',
  'Postpartum Recovery',
  'Newborn Care',
  'Infant Development',
  'Toddler Behaviour',
  'Indian Home Remedies',
  'Vaccinations & Health',
  'Mental Health for Mothers',
  'Working Mom Tips',
  'Indian Festivals & Babies',
  'Nutrition for Toddlers',
  'Baby-Proofing Your Home',
  'First Foods (Indian Recipes)',
];

const DEFAULT_AGE_BUCKETS = [
  { key: 'pregnancy', label: 'Pregnancy', ageMin: -9, ageMax: 0 },
  { key: 'newborn', label: 'Newborn (0-3m)', ageMin: 0, ageMax: 3 },
  { key: 'infant', label: 'Infant (3-12m)', ageMin: 3, ageMax: 12 },
  { key: 'toddler', label: 'Toddler (1-3y)', ageMin: 12, ageMax: 36 },
  { key: 'preschool', label: 'Preschool (3-5y)', ageMin: 36, ageMax: 60 },
];

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const startedAt = new Date();
  const today = startedAt.toISOString().slice(0, 10);
  const cli = parseArgs(process.argv.slice(2));

  const accessToken = getCachedFirebaseAccessToken();
  console.log('[daily-article] loaded Firebase CLI token');
  const integrations = await firestoreGetDoc(accessToken, 'app_settings/integrations');
  const libraryAi = await firestoreGetDoc(accessToken, 'app_settings/libraryAi');
  const brand = await firestoreGetDoc(accessToken, 'marketing_brand/main');
  console.log('[daily-article] loaded Firestore settings');

  const openaiApiKey =
    asString(integrations?.openai?.apiKey) ||
    asString(process.env.OPENAI_API_KEY) ||
    asString(parseEnv(FUNCTIONS_ENV).OPENAI_API_KEY);
  if (!openaiApiKey) {
    throw new Error('Missing OpenAI API key. Set app_settings/integrations.openai.apiKey or functions/.env OPENAI_API_KEY.');
  }

  const openaiImageModel = normaliseImageModel(
    asString(integrations?.openai?.defaultModel) || 'gpt-image-1.5',
  );
  const articleSettings = libraryAi?.articles ?? {};
  const topics = Array.isArray(articleSettings.topics) && articleSettings.topics.length > 0
    ? articleSettings.topics.filter((v) => typeof v === 'string' && v.trim())
    : DEFAULT_TOPICS;
  const ageBuckets = Array.isArray(articleSettings.ageBuckets) && articleSettings.ageBuckets.length > 0
    ? articleSettings.ageBuckets
    : DEFAULT_AGE_BUCKETS;
  const tone = asString(articleSettings.tone) || 'Warm, evidence-based, judgement-free, written for Indian mothers. Mix English with light Hinglish where natural. Never preachy.';

  const ageBucket = pickAgeBucket(ageBuckets, startedAt, cli.ageBucketKey);
  const topic = cli.topic || pickTopic(topics, ageBucket, startedAt);
  const refs = selectIllustrationReferences(topic);
  const article = await generateArticleJson({
    apiKey: openaiApiKey,
    topic,
    ageBucket,
    tone,
    brandName: asString(brand?.brandName) || 'MaaMitra',
    styleReferences: refs,
  });
  console.log(`[daily-article] generated article copy: ${article.title}`);

  const imagePrompt = buildImagePrompt(article.imagePrompt, refs);
  const { imageBuffer, mimeType } = await generateHeroImage({
    apiKey: openaiApiKey,
    model: openaiImageModel,
    prompt: imagePrompt,
  });
  console.log('[daily-article] generated hero image');

  const localBase = join(OUTPUT_DIR, `${today}-${slugify(article.title)}`);
  const localImage = `${localBase}.png`;
  const localJson = `${localBase}.json`;
  writeFileSync(localImage, imageBuffer);
  console.log(`[daily-article] wrote local image: ${localImage}`);

  const storagePath = `library/articles/${today}-${slugify(article.title)}.png`;
  const imageUrl = await uploadToFirebaseStorage(accessToken, storagePath, imageBuffer, mimeType);
  console.log(`[daily-article] uploaded image: ${storagePath}`);

  const docId = cli.slug
    ? `daily-article-${today}-${slugify(cli.slug)}`
    : `daily-article-${today}`;
  const articleDoc = {
    title: article.title,
    preview: article.preview,
    body: article.body,
    topic,
    readTime: article.readTime,
    ageMin: numberOr(ageBucket.ageMin, 0),
    ageMax: numberOr(ageBucket.ageMax, 0),
    emoji: article.emoji,
    tag: article.tag,
    imageUrl,
    audience: article.audience,
    status: 'draft',
    source: 'ai',
    aiModel: article.textModel,
    aiTopic: topic,
    aiAgeBucketKey: asString(ageBucket.key) || 'custom',
    aiImageSource: openaiImageModel,
    aiImagePrompt: imagePrompt,
    aiGeneratedBy: 'automation:daily-article-generator',
    createdAt: startedAt.toISOString(),
    updatedAt: startedAt.toISOString(),
  };
  await firestoreSetDoc(accessToken, `articles/${docId}`, articleDoc);
  console.log(`[daily-article] wrote Firestore draft: ${docId}`);

  writeFileSync(localJson, JSON.stringify({ articleDoc, styleReferences: refs }, null, 2));

  console.log(JSON.stringify({
    ok: true,
    docId,
    title: article.title,
    topic,
    ageBucket: ageBucket.label,
    imageUrl,
    localImage,
    localJson,
  }, null, 2));
}

function parseEnv(filePath) {
  if (!existsSync(filePath)) return {};
  return Object.fromEntries(
    readFileSync(filePath, 'utf8')
      .split('\n')
      .filter((line) => line.trim() && !line.trim().startsWith('#') && line.includes('='))
      .map((line) => {
        const idx = line.indexOf('=');
        return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
      }),
  );
}

function parseArgs(args) {
  const out = {
    topic: '',
    ageBucketKey: '',
    slug: '',
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--topic' && args[i + 1]) {
      out.topic = String(args[i + 1]).trim();
      i += 1;
    } else if (arg.startsWith('--topic=')) {
      out.topic = arg.slice('--topic='.length).trim();
    } else if (arg === '--age' && args[i + 1]) {
      out.ageBucketKey = String(args[i + 1]).trim();
      i += 1;
    } else if (arg.startsWith('--age=')) {
      out.ageBucketKey = arg.slice('--age='.length).trim();
    } else if (arg === '--slug' && args[i + 1]) {
      out.slug = String(args[i + 1]).trim();
      i += 1;
    } else if (arg.startsWith('--slug=')) {
      out.slug = arg.slice('--slug='.length).trim();
    }
  }
  return out;
}

function getCachedFirebaseAccessToken() {
  const cfgPath = join(process.env.HOME || '', '.config', 'configstore', 'firebase-tools.json');
  if (!existsSync(cfgPath)) {
    throw new Error('Missing Firebase CLI auth cache at ~/.config/configstore/firebase-tools.json.');
  }
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  const token = asString(cfg?.tokens?.access_token);
  const expiresAt = Number(cfg?.tokens?.expires_at || 0);
  if (!token) {
    throw new Error('Firebase CLI access token missing. Re-authenticate locally.');
  }
  if (expiresAt && Date.now() > expiresAt - 60_000) {
    throw new Error('Firebase CLI access token is expired. Refresh it locally before running this script.');
  }
  return token;
}

async function firestoreGetDoc(accessToken, docPath) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Firestore GET ${docPath} failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return fromFirestoreDocument(json);
}

async function firestoreSetDoc(accessToken, docPath, data) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({ fields: toFirestoreMap(data) }),
  });
  if (!res.ok) {
    throw new Error(`Firestore PATCH ${docPath} failed: ${res.status} ${await res.text()}`);
  }
}

function fromFirestoreDocument(doc) {
  return fromFirestoreMap(doc?.fields || {});
}

function fromFirestoreMap(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = fromFirestoreValue(value);
  }
  return out;
}

function fromFirestoreValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in value) return fromFirestoreMap(value.mapValue.fields || {});
  return null;
}

function toFirestoreMap(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    out[key] = toFirestoreValue(value);
  }
  return out;
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) return { timestampValue: value };
    return { stringValue: value };
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === 'object') return { mapValue: { fields: toFirestoreMap(value) } };
  return { stringValue: String(value) };
}

function pickAgeBucket(ageBuckets, today, overrideKey = '') {
  const clean = ageBuckets.filter((bucket) => bucket && typeof bucket === 'object');
  if (overrideKey) {
    const exact = clean.find((bucket) => asString(bucket.key).toLowerCase() === overrideKey.toLowerCase());
    if (exact) return exact;
  }
  const start = Date.UTC(today.getUTCFullYear(), 0, 0);
  const diff = today.getTime() - start;
  const dayOfYear = Math.floor(diff / 86_400_000);
  return clean[dayOfYear % clean.length];
}

function pickTopic(topics, ageBucket, today) {
  const clean = topics.filter((topic) => typeof topic === 'string' && topic.trim());
  const seed = `${today.toISOString().slice(0, 10)}|${asString(ageBucket?.key) || 'all'}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  return clean[Math.abs(hash) % clean.length];
}

function selectIllustrationReferences(topic) {
  const dir = join(ROOT, 'assets', 'illustrations');
  const files = readdirSync(dir)
    .filter((file) => file.endsWith('.webp'))
    .sort();
  const needle = topic.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const topicWords = needle.split(/\s+/).filter(Boolean);
  const scored = files
    .map((file) => {
      const base = file.replace(/\.webp$/, '').toLowerCase();
      const score = topicWords.reduce((sum, word) => sum + (base.includes(word) ? 3 : 0), 0)
        + (base.includes('hero') ? 2 : 0)
        + (base.includes('topic-') ? 2 : 0)
        + (base.includes('feature-') ? 1 : 0);
      return { file, score };
    })
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));

  const picked = scored.slice(0, 6).map((item) => item.file);
  const traits = [
    'soft pastel palette',
    'rounded organic shapes',
    'flat hand-drawn illustration',
    'gentle gradients',
    'Indian family context',
    'clean negative space',
    'editorial app-illustration framing',
  ];
  return { files: picked, traits };
}

async function generateArticleJson({ apiKey, topic, ageBucket, tone, brandName, styleReferences }) {
  const ageDesc = ageBucket.ageMin < 0
    ? 'pregnancy stage'
    : `child age ${ageBucket.ageMin}-${ageBucket.ageMax} months (${ageBucket.label})`;
  const styleLine = styleReferences.files.length
    ? `Internal visual references: ${styleReferences.files.join(', ')}.`
    : '';

  const system = [
    `You write long-form parenting articles for ${brandName}, an Indian motherhood app.`,
    `Tone: ${tone}`,
    'Write in natural Indian English. Light Hinglish is acceptable where it feels natural.',
    'Output strict JSON only.',
  ].join('\n');

  const user = [
    `Write one original MaaMitra library article about "${topic}".`,
    `Audience: Indian mother whose ${ageDesc}.`,
    'The article will be saved as a draft in the app admin console.',
    '',
    'Requirements:',
    '- 650-900 words.',
    '- 4-6 short sections with a plain-text heading on its own line and a blank line between sections.',
    '- Practical, evidence-aware, empathetic, Indian-context examples.',
    '- No medication dosages, no diagnosis, no unverifiable studies, no brand comparisons.',
    '- Close with one calm, reassuring line.',
    '',
    'Return JSON with keys:',
    '{',
    '  "title": "specific, <= 80 chars",',
    '  "preview": "2-3 sentence hook, <= 280 chars",',
    '  "body": "full article plain text",',
    '  "readTime": "e.g. 5 min read",',
    '  "emoji": "single emoji",',
    '  "tag": "short label <= 24 chars",',
    '  "imagePrompt": "illustration scene for the hero image",',
    '  "audience": "all | mother | father | both-parents"',
    '}',
    '',
    'Visual direction for the image prompt only:',
    styleLine,
    `Style traits: ${styleReferences.traits.join(', ')}.`,
    'No text, logos, watermarks, photorealism, or clinical diagrams.',
  ].filter(Boolean).join('\n');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.85,
      max_tokens: 2400,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI article generation failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`OpenAI returned non-JSON article content: ${String(raw).slice(0, 200)}`);
  }
  return {
    title: trim(parsed.title, 80) || `${topic} for Indian Moms`,
    preview: trim(parsed.preview, 280),
    body: trim(parsed.body, 7000),
    readTime: trim(parsed.readTime, 24) || estimateReadTime(parsed.body),
    emoji: trim(parsed.emoji, 6) || '📰',
    tag: trim(parsed.tag, 24) || trim(topic, 24),
    imagePrompt: trim(parsed.imagePrompt, 700) || `Warm Indian motherhood moment related to ${topic}`,
    audience: normaliseAudience(parsed.audience),
    textModel: 'gpt-4o-mini',
  };
}

function buildImagePrompt(subjectPrompt, refs) {
  return [
    'Create a polished editorial illustration for the MaaMitra app.',
    `Visual style references from the existing MaaMitra asset library: ${refs.files.join(', ')}.`,
    `Core style traits: ${refs.traits.join(', ')}.`,
    `Scene: ${subjectPrompt}.`,
    'Use a warm, hand-drawn 2D illustration style with Indian characters, soft pastels, and subtle gradients.',
    'No text, no logos, no watermark, no photorealism.',
    'Landscape composition with enough breathing room for a library hero card.',
  ].join('\n');
}

async function generateHeroImage({ apiKey, model, prompt }) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model,
      prompt,
      size: '1536x1024',
      quality: 'medium',
      n: 1,
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI image generation failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const item = data?.data?.[0];
  const b64 = asString(item?.b64_json);
  if (!b64) throw new Error('OpenAI image response did not include b64_json.');
  return {
    imageBuffer: Buffer.from(b64, 'base64'),
    mimeType: 'image/png',
  };
}

async function uploadToFirebaseStorage(accessToken, storagePath, buffer, mimeType) {
  const downloadToken = randomUUID();
  const metadata = {
    name: storagePath,
    contentType: mimeType,
    metadata: {
      firebaseStorageDownloadTokens: downloadToken,
      source: 'automation:daily-article-generator',
    },
  };
  const boundary = `maamitra-${Date.now()}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    'utf8',
  );
  const tail = Buffer.from(`\r\n--${boundary}--`, 'utf8');
  const body = Buffer.concat([head, buffer, tail]);

  const res = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${STORAGE_BUCKET}/o?uploadType=multipart`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': String(body.length),
    },
    signal: AbortSignal.timeout(120_000),
    body,
  });
  if (!res.ok) {
    throw new Error(`Storage upload failed: ${res.status} ${await res.text()}`);
  }
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;
}

function normaliseImageModel(model) {
  return /^gpt-image-/.test(model) ? model : 'gpt-image-1.5';
}

function normaliseAudience(audience) {
  return ['all', 'mother', 'father', 'both-parents'].includes(audience) ? audience : 'all';
}

function trim(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function estimateReadTime(body) {
  const text = typeof body === 'string' ? body : '';
  const words = text.split(/\s+/).filter(Boolean).length;
  return `${Math.max(3, Math.round(words / 220))} min read`;
}

function slugify(value) {
  return trim(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'article';
}

function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function numberOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exitCode = 1;
});
