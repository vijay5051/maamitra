import * as fs from 'fs';
import * as path from 'path';

import { openaiImage, openaiImageEdit } from './imageSources';

const STYLE_MOSAIC_FILE = 'all-72-style-mosaic.webp' as const;
const STYLE_CORE_REF_FILES = [
  'onboarding-welcome.webp',
  'home-hero-morning.webp',
  'community-hero.webp',
  'health-cat-mother.webp',
] as const;
const STYLE_ARTICLE_REF_FILES = [
  'topic-general.webp',
  'topic-milestones.webp',
  'topic-newborn.webp',
  'topic-pregnancy.webp',
  'home-hero.webp',
  'health-hero.webp',
] as const;
const STYLE_POST_REF_FILES = [
  'feature-growth.webp',
  'feature-community.webp',
  'dadi-ke-nuskhe-hero.webp',
] as const;

type StyleRefFile =
  typeof STYLE_MOSAIC_FILE |
  typeof STYLE_CORE_REF_FILES[number] |
  typeof STYLE_ARTICLE_REF_FILES[number] |
  typeof STYLE_POST_REF_FILES[number];

type StylePreset = 'article' | 'post' | 'product' | 'generic';

let styleReferenceCache: Map<StyleRefFile, Buffer> | null = null;

function loadStyleReferenceCache(): Map<StyleRefFile, Buffer> {
  if (styleReferenceCache) return styleReferenceCache;
  const dir = path.join(__dirname, 'style-refs');
  const files: StyleRefFile[] = [
    STYLE_MOSAIC_FILE,
    ...STYLE_CORE_REF_FILES,
    ...STYLE_ARTICLE_REF_FILES,
    ...STYLE_POST_REF_FILES,
  ];
  styleReferenceCache = new Map(files.map((file) => [file, fs.readFileSync(path.join(dir, file))]));
  return styleReferenceCache;
}

export function loadStyleReferenceImages(): Buffer[] {
  return Array.from(loadStyleReferenceCache().values());
}

function subjectSpecificRefs(subjectPrompt: string, preset: StylePreset): StyleRefFile[] {
  const text = subjectPrompt.toLowerCase();
  const refs = new Set<StyleRefFile>();

  if (preset === 'article') {
    refs.add('topic-general.webp');
    refs.add('home-hero.webp');
  }
  if (preset === 'post') {
    refs.add('feature-growth.webp');
    refs.add('feature-community.webp');
  }

  if (/\b(pregnan|prenatal|trimester|antenatal)\b/.test(text)) refs.add('topic-pregnancy.webp');
  if (/\b(newborn|infant|baby|feeding|swaddle)\b/.test(text)) refs.add('topic-newborn.webp');
  if (/\b(toddler|preschool|school|milestone|swing|play|books?|crayon|bag|lunch)\b/.test(text)) refs.add('topic-milestones.webp');
  if (/\b(health|doctor|vaccine|care|wellness|nutrition|sleep)\b/.test(text)) refs.add('health-hero.webp');

  return Array.from(refs);
}

function pickStyleReferenceImages(
  subjectPrompt: string,
  opts?: { maxRefs?: number; preset?: StylePreset },
): Buffer[] {
  const preset = opts?.preset ?? 'generic';
  const files: StyleRefFile[] = [
    STYLE_MOSAIC_FILE,
    ...STYLE_CORE_REF_FILES,
    ...(preset === 'article' ? STYLE_ARTICLE_REF_FILES : []),
    ...(preset === 'post' ? STYLE_POST_REF_FILES : []),
    ...subjectSpecificRefs(subjectPrompt, preset),
  ].filter((file, index, all) => all.indexOf(file) === index);
  const limited = opts?.maxRefs && opts.maxRefs > 0 ? files.slice(0, Math.min(opts.maxRefs, files.length)) : files;
  const cache = loadStyleReferenceCache();
  return limited.map((file) => cache.get(file)).filter((buf): buf is Buffer => !!buf);
}

export function buildMaaMitraReferencePrompt(subjectPrompt: string, extraLines: string[] = []): string {
  return [
    'Use the supplied MaaMitra illustration references as binding style and character references.',
    'The first supplied reference is a mosaic sampled from the real MaaMitra assets/illustrations library and is the master style anchor. Match that family before anything else.',
    'The remaining supplied references also come from the real MaaMitra assets/illustrations library and should reinforce the exact palette, faces, wardrobe language, and whitespace treatment.',
    'These references must dominate the visual result over any generic model priors.',
    'Match the same soft painterly Indian motherhood illustration family: warm cream negative space, rounded expressive faces, delicate hand-painted shading, pastel lavender/blush/cream palette, light gold accents, embroidered Indian wardrobe, and a calm premium editorial finish.',
    'Preserve the recurring MaaMitra character language when relevant: young Indian mother with warm medium-brown Indian skin and peach undertones, expressive almond eyes, dark wavy hair with wisps, tiny bindi, gold studs, and children with rounded cheeks, big dark eyes, and clean natural skin tones.',
    'Do not drift into generic storybook watercolor, nursery poster, stock-kids illustration, or random Pinterest-mom-art aesthetics.',
    'Create a NEW scene for the requested subject. Do not copy any reference composition exactly.',
    'Keep the requested action, setting, props, and age cues central and literal. Do not drift into generic mother-baby cuddling, tea-chatting, portrait, or yoga poses unless the prompt explicitly asks for them.',
    'Output must be a clean illustration only: no text, no readable words, no labels, no infographic panels, no poster/card layout, no logo, no watermark.',
    ...extraLines,
    subjectPrompt.trim(),
  ].join('\n');
}

export async function openaiMaaMitraReferenceImage(
  subjectPrompt: string,
  opts?: {
    quality?: 'low' | 'medium' | 'high';
    size?: '1024x1024' | '1024x1536' | '1536x1024';
    extraLines?: string[];
    maxRefs?: number;
    timeoutMs?: number;
    fallbackToGeneration?: boolean;
    preset?: StylePreset;
  },
): Promise<string | null> {
  const prompt = buildMaaMitraReferencePrompt(subjectPrompt, opts?.extraLines ?? []);
  const viaRefs = await openaiImageEdit(
    pickStyleReferenceImages(subjectPrompt, { maxRefs: opts?.maxRefs, preset: opts?.preset }),
    prompt,
    {
      quality: opts?.quality ?? 'high',
      size: opts?.size ?? '1024x1024',
      inputFidelity: 'high',
      mimeType: 'image/webp',
      timeoutMs: opts?.timeoutMs ?? 90_000,
    },
  );
  if (viaRefs) return viaRefs;
  if (opts?.fallbackToGeneration === false) return null;
  return openaiImage(prompt, {
    quality: opts?.quality ?? 'high',
    size: opts?.size ?? '1024x1024',
    timeoutMs: Math.max(45_000, Math.min(opts?.timeoutMs ?? 90_000, 90_000)),
  });
}
