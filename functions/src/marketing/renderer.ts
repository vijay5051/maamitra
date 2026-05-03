// Satori → SVG → PNG pipeline.
//
// Renders a named template with caller-supplied props + brand kit, returns
// the PNG buffer. The HTTPS callable in marketing/index.ts is what wires
// this to the admin panel and (in Phase 3) the daily generator cron.
//
// Image sources for backgrounds/photos are the caller's responsibility —
// pass a public URL in the template props (e.g. props.backgroundUrl from
// pexelsSearch). Satori fetches the URL and embeds it. We don't re-host
// because the embed is one-shot.

import { Resvg } from '@resvg/resvg-js';
import * as fs from 'fs';
import * as path from 'path';
import satori from 'satori';

import { getTemplate } from './templates';
import { BrandSnapshot } from './templates/types';

// ── Font loading ────────────────────────────────────────────────────────────
// Satori needs each font as an ArrayBuffer. We load all four bundled TTFs
// once on first call and cache them in module scope. The functions runtime
// keeps the module hot across invocations within the same instance, so
// fonts only re-load on a cold start (~once per instance lifetime).

interface LoadedFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: 'normal';
}

let _fonts: LoadedFont[] | null = null;

function loadFonts(): LoadedFont[] {
  if (_fonts) return _fonts;
  const dir = path.join(__dirname, 'fonts');
  const fontPaths: { file: string; name: string; weight: 400 | 700 }[] = [
    { file: 'inter-400.ttf', name: 'Inter', weight: 400 },
    { file: 'inter-700.ttf', name: 'Inter', weight: 700 },
    { file: 'noto-devanagari-400.ttf', name: 'Noto Sans Devanagari', weight: 400 },
    { file: 'noto-devanagari-700.ttf', name: 'Noto Sans Devanagari', weight: 700 },
  ];
  _fonts = fontPaths.map((f) => {
    const buf = fs.readFileSync(path.join(dir, f.file));
    // Convert Buffer → ArrayBuffer slice (Satori is strict about the type).
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    return { name: f.name, data: ab, weight: f.weight, style: 'normal' };
  });
  return _fonts;
}

// ── Render ─────────────────────────────────────────────────────────────────

export interface RenderOptions {
  /** Output dimensions. Defaults to 1080×1080 (Instagram square). */
  width?: number;
  height?: number;
}

export interface RenderResult {
  png: Buffer;
  width: number;
  height: number;
  template: string;
}

export async function renderTemplate(
  templateName: string,
  props: Record<string, any>,
  brand: BrandSnapshot,
  opts?: RenderOptions,
): Promise<RenderResult> {
  const template = getTemplate(templateName);
  if (!template) throw new Error(`Unknown template: ${templateName}`);

  const width = opts?.width ?? 1080;
  const height = opts?.height ?? 1080;

  const tree = template(props as any, brand);

  const svg = await satori(tree as any, {
    width,
    height,
    fonts: loadFonts(),
    // Cache fetched <img> URLs across the render so the same logo isn't
    // re-fetched per slide of a carousel.
    loadAdditionalAsset: async (code, segment) => {
      // We don't need emoji or non-Latin sub-fonts beyond what we bundled.
      // Returning the segment unchanged tells Satori to render it as text
      // with the existing fonts (Devanagari falls through to Noto).
      void code;
      return segment;
    },
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: 'transparent',
    font: { loadSystemFonts: false },
  });
  const png = resvg.render().asPng();

  return { png: Buffer.from(png), width, height, template: templateName };
}
