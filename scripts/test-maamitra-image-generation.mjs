#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const DEFAULT_PROMPT = 'A young Indian mother playing with her little daughter in a leafy neighborhood park in India, joyful and gentle, the child reaching for a red ball on soft grass.';
const DEFAULT_REF_FILES = [
  'all-72-style-mosaic.webp',
  'onboarding-welcome.webp',
  'home-hero-morning.webp',
  'community-hero.webp',
  'topic-milestones.webp',
];

function readEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

function parseArgs(argv) {
  const args = {
    prompt: DEFAULT_PROMPT,
    runs: 2,
    model: 'gpt-image-1',
    quality: 'medium',
    size: '1024x1024',
    maxRefs: 5,
    mode: 'refs',
    preset: 'clean-illustration',
    customRefs: [],
    outDir: path.join(rootDir, 'tmp', 'image-generation-tests'),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--prompt' && next) { args.prompt = next; i += 1; }
    else if (arg === '--runs' && next) { args.runs = Number(next); i += 1; }
    else if (arg === '--model' && next) { args.model = next; i += 1; }
    else if (arg === '--quality' && next) { args.quality = next; i += 1; }
    else if (arg === '--size' && next) { args.size = next; i += 1; }
    else if (arg === '--max-refs' && next) { args.maxRefs = Number(next); i += 1; }
    else if (arg === '--mode' && next) { args.mode = next; i += 1; }
    else if (arg === '--preset' && next) { args.preset = next; i += 1; }
    else if (arg === '--ref' && next) { args.customRefs.push(path.resolve(next)); i += 1; }
    else if (arg === '--out-dir' && next) { args.outDir = path.resolve(next); i += 1; }
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  args.runs = Math.max(1, Math.min(Number.isFinite(args.runs) ? args.runs : 2, 8));
  args.maxRefs = Math.max(0, Math.min(Number.isFinite(args.maxRefs) ? args.maxRefs : 5, 16));
  if (!['low', 'medium', 'high', 'auto'].includes(args.quality)) throw new Error('--quality must be low, medium, high, or auto');
  if (!['refs', 'generate'].includes(args.mode)) throw new Error('--mode must be refs or generate');
  if (!['clean-illustration', 'editorial-banner', 'premium-banner', 'character-banner'].includes(args.preset)) throw new Error('--preset must be clean-illustration, editorial-banner, premium-banner, or character-banner');
  args.customRefs.forEach((file) => {
    if (!fs.existsSync(file)) throw new Error(`Reference file not found: ${file}`);
  });
  return args;
}

function printHelp() {
  console.log(`
MaaMitra OpenAI image generation test bench

Usage:
  npm run image:test -- [options]

Options:
  --prompt "..."             Scene to generate. Defaults to mother/daughter park test.
  --runs 2                   Number of repeated generations for the same prompt.
  --mode refs                refs uses MaaMitra images as style references; generate uses text only.
  --preset clean-illustration clean-illustration, editorial-banner, premium-banner, or character-banner.
  --ref /path/image.png      Extra reference image. Repeatable; useful for target layout/style.
  --model gpt-image-1        Image model to call.
  --quality medium           low, medium, high, or auto.
  --size 1024x1024           1024x1024, 1024x1536, or 1536x1024.
  --max-refs 5               Number of style reference files to send, up to 16.
  --out-dir tmp/image-generation-tests
`);
}

function buildMaaMitraPrompt(subjectPrompt, opts = {}) {
  const hasCustomRefs = (opts.customRefs ?? []).length > 0;
  const styleAnchorLines = hasCustomRefs
    ? [
        'The first one or two supplied reference images are the target composition and finish references. Match their wide editorial illustration feel, character polish, soft home-lighting, prop detail, and generous negative space, while creating a new scene for the requested subject.',
        'The remaining supplied MaaMitra references are binding style and character references. Match that family before anything else.',
      ]
    : [
        'The first supplied reference is a mosaic sampled from the real MaaMitra assets/illustrations library and is the master style anchor. Match that family before anything else.',
        'The remaining supplied references reinforce the exact palette, faces, wardrobe language, softness, and whitespace treatment.',
      ];

  const bannerBaseLines = [
    'Output a wide editorial banner illustration, not a square icon, not a poster, not a social card.',
    'Use a landscape composition with the people and detailed props weighted on the right or center-right.',
    'Keep the left 40 percent mostly clean warm cream negative space for headline text that will be added later by code.',
    'Do not generate any words, letters, headline, caption, label, watermark, logo, or fake typography anywhere in the image, even if a reference image contains text.',
    'Use soft indoor natural light, premium parenting-magazine finish, delicate linework, warm cream background, lavender/blush accents, and lightly rendered plants or home details when useful.',
  ];
  const premiumBannerLines = [
    ...bannerBaseLines,
    'Make the final image feel like a polished premium digital illustration, not pale watercolor and not a rough sketch.',
    'Use crisp expressive faces, clean almond eyes, refined eyelashes, smooth warm Indian skin tones, detailed dark hair strands, and gentle highlights on cheeks and noses.',
    'Use richer but still soft lavender and blush colors. Avoid washed-out low-contrast rendering.',
    'Keep character anatomy clean and natural: correct hands, fingers, feet, knees, necks, and eye alignment.',
    'Include a few carefully drawn props that support the story, but keep the composition uncluttered and elegant.',
    'Keep the background luminous and minimal. No busy patterns, no heavy shadows, no hard outlines.',
  ];
  const characterBannerLines = [
    ...premiumBannerLines,
    'Character quality is the highest priority. Spend visual detail on faces, eyes, hair, skin warmth, hands, and emotional connection before background decoration.',
    'Use the mother and father character language from the references: graceful Indian parents, expressive almond eyes, refined nose and lips, warm cheeks, dark glossy hair with visible strand groups, simple gold jewelry when appropriate, and calm affectionate posture.',
    'Use the baby and child character language from the references: round cheeks, bright dark eyes, tiny fingers and toes, joyful but natural expressions, soft baby skin, and believable proportions.',
    'Draw hands carefully with five clear fingers where visible. Avoid fused fingers, tiny hands, awkward wrists, overlong arms, duplicate limbs, or distorted feet.',
    'Preserve the reference-level line polish: clean confident contours, sharper facial features, subtle blush, embroidery detail, fabric folds, and softly textured but controlled shading.',
    'Keep props secondary and elegant. Do not let bottles, toys, plants, shelves, or furniture steal focus from the characters.',
  ];
  const presetLines = opts.preset === 'character-banner'
    ? characterBannerLines
    : opts.preset === 'premium-banner'
    ? premiumBannerLines
    : opts.preset === 'editorial-banner'
    ? [
        ...bannerBaseLines,
      ]
    : [
        'Output must be a clean illustration only: no text, no readable words, no labels, no infographic panels, no poster/card layout, no logo, no watermark.',
      ];

  return [
    'Use the supplied MaaMitra illustration references as binding style and character references.',
    ...styleAnchorLines,
    'These references must dominate the visual result over generic model priors.',
    'Match this soft painterly Indian motherhood illustration family: warm cream negative space, rounded expressive faces, delicate hand-painted shading, pastel lavender, blush, cream, light gold accents, embroidered Indian wardrobe, and a calm premium editorial finish.',
    'Preserve the recurring MaaMitra character language when relevant: young Indian mother with warm medium-brown Indian skin and peach undertones, expressive almond eyes, dark wavy hair with wisps, tiny bindi, gold studs, and children with rounded cheeks and big dark eyes.',
    'Keep the requested action, setting, props, and age cues central and literal.',
    'Create a new scene for the requested subject. Do not copy any reference composition exactly.',
    ...presetLines,
    subjectPrompt.trim(),
  ].join('\n');
}

function styleRefPaths(maxRefs) {
  const styleRefDir = path.join(rootDir, 'functions', 'src', 'marketing', 'style-refs');
  return DEFAULT_REF_FILES
    .slice(0, maxRefs)
    .map((file) => path.join(styleRefDir, file))
    .filter((file) => fs.existsSync(file));
}

async function callOpenAiGeneration({ apiKey, model, prompt, quality, size }) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, prompt, n: 1, size, quality, output_format: 'png' }),
  });
  return parseImageResponse(res, 'generation');
}

function mimeTypeForFile(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  throw new Error(`Unsupported reference image type: ${file}`);
}

async function callOpenAiEdit({ apiKey, model, prompt, quality, size, refs }) {
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('n', '1');
  form.append('size', size);
  form.append('quality', quality);
  form.append('output_format', 'png');
  form.append('input_fidelity', 'high');

  refs.forEach((file, index) => {
    const buf = fs.readFileSync(file);
    const mimeType = mimeTypeForFile(file);
    const blob = new Blob([new Uint8Array(buf)], { type: mimeType });
    form.append(refs.length > 1 ? 'image[]' : 'image', blob, `maamitra-ref-${index + 1}${path.extname(file)}`);
  });

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  return parseImageResponse(res, 'edit');
}

async function parseImageResponse(res, label) {
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message = data?.error?.message ?? text.slice(0, 500);
    throw new Error(`OpenAI ${label} failed (${res.status}): ${message}`);
  }
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error(`OpenAI ${label} returned no b64_json image.`);
  return {
    b64,
    revisedPrompt: data?.data?.[0]?.revised_prompt ?? null,
    usage: data?.usage ?? data?.data?.[0]?.usage ?? null,
  };
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'image-test';
}

function writeGallery({ runDir, args, prompt, refs, outputs, failures, manifestPath }) {
  const refCards = refs.map((file) => `<figure><img src="${relativeUrl(runDir, file)}" alt="${escapeHtml(path.basename(file))}"><figcaption>${escapeHtml(path.basename(file))}</figcaption></figure>`).join('\n');
  const outputCards = outputs.map((item) => `<figure><img src="${escapeHtml(path.basename(item.file))}" alt="Generated run ${item.index}"><figcaption>Run ${item.index}</figcaption></figure>`).join('\n');
  const failureBlock = failures.length
    ? `<h2>Failures</h2><pre>${escapeHtml(failures.map((failure) => `Run ${failure.index}: ${failure.message}`).join('\n'))}</pre>`
    : '';
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MaaMitra Image Test</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f1ea; color: #29231f; }
    main { max-width: 1180px; margin: 0 auto; padding: 32px 20px 48px; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    h2 { font-size: 18px; margin: 28px 0 12px; }
    pre { white-space: pre-wrap; background: #fffaf4; border: 1px solid #eadfd4; padding: 16px; border-radius: 8px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
    figure { margin: 0; background: #fffaf4; border: 1px solid #eadfd4; border-radius: 8px; overflow: hidden; }
    img { display: block; width: 100%; aspect-ratio: 1 / 1; object-fit: contain; background: #fff; }
    figcaption { padding: 10px 12px; font-size: 13px; color: #655b52; }
    .meta { color: #655b52; margin: 0 0 20px; }
    a { color: #7657a6; }
  </style>
</head>
<body>
  <main>
    <h1>MaaMitra Image Test</h1>
    <p class="meta">${escapeHtml(args.model)} | ${escapeHtml(args.mode)} | ${escapeHtml(args.quality)} | ${escapeHtml(args.size)} | ${new Date().toLocaleString()}</p>
    <h2>Prompt</h2>
    <pre>${escapeHtml(prompt)}</pre>
    <p class="meta"><a href="${escapeHtml(path.basename(manifestPath))}">manifest.json</a></p>
    ${failureBlock}
    <h2>Generated Runs</h2>
    <div class="grid">${outputCards || '<p>No images were generated.</p>'}</div>
    <h2>Style References</h2>
    <div class="grid">${refCards || '<p>No reference images used.</p>'}</div>
  </main>
</body>
</html>`;
  fs.writeFileSync(path.join(runDir, 'index.html'), html);
}

function relativeUrl(fromDir, toFile) {
  return path.relative(fromDir, toFile).split(path.sep).map(encodeURIComponent).join('/');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function main() {
  readEnvFile(path.join(rootDir, '.env'));
  readEnvFile(path.join(rootDir, 'functions', '.env'));

  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY was not found. Add it to functions/.env or export it in your shell.');
  }

  const finalPrompt = buildMaaMitraPrompt(args.prompt, args);
  const refs = args.mode === 'refs' ? [...args.customRefs, ...styleRefPaths(args.maxRefs)] : [];
  if (args.mode === 'refs' && refs.length === 0) throw new Error('No MaaMitra style reference images found.');

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(args.outDir, `${stamp}-${slugify(args.prompt)}`);
  fs.mkdirSync(runDir, { recursive: true });

  console.log(`Writing outputs to ${runDir}`);
  console.log(`Mode: ${args.mode}; refs: ${refs.length}; model: ${args.model}; quality: ${args.quality}`);

  const outputs = [];
  const failures = [];
  for (let i = 1; i <= args.runs; i += 1) {
    console.log(`Generating run ${i}/${args.runs}...`);
    try {
      const result = args.mode === 'refs'
        ? await callOpenAiEdit({ apiKey, model: args.model, prompt: finalPrompt, quality: args.quality, size: args.size, refs })
        : await callOpenAiGeneration({ apiKey, model: args.model, prompt: finalPrompt, quality: args.quality, size: args.size });
      const file = path.join(runDir, `run-${String(i).padStart(2, '0')}.png`);
      fs.writeFileSync(file, Buffer.from(result.b64, 'base64'));
      outputs.push({ index: i, file, revisedPrompt: result.revisedPrompt, usage: result.usage });
    } catch (error) {
      const message = error?.message || String(error);
      console.error(message);
      failures.push({ index: i, message });
      break;
    }
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    args,
    finalPrompt,
    references: refs,
    outputs,
    failures,
    note: 'OpenAI image generation is not seed-deterministic here; judge repeatability by running the same prompt multiple times and comparing style/action consistency.',
  };
  const manifestPath = path.join(runDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(runDir, 'prompt.txt'), finalPrompt);
  writeGallery({ runDir, args, prompt: finalPrompt, refs, outputs, failures, manifestPath });

  console.log(`Done: ${path.join(runDir, 'index.html')}`);
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
