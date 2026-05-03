// Image source adapters.
//
// Phase 2 ships two sources:
//   - Pexels   — free unlimited stock photos. Best for real moms / babies /
//                Indian families. ~70% of posts should pull from here.
//   - Replicate FLUX.1 Schnell — paid AI generator (~₹0.25/image). Used for
//                stylized illustrations, abstract backgrounds, theme graphics
//                that stock can't fill.
//
// Both return a public URL the Satori `<img>` tag can fetch. We don't
// re-host into Storage at this layer — the renderer fetches the image as an
// ArrayBuffer and embeds it directly in the SVG, so the source URL only
// needs to be alive for one render.
//
// Secrets:
//   PEXELS_API_KEY      — Pexels developer key (free signup)
//   REPLICATE_API_TOKEN — Replicate token (paid, ~$5 to start)

const PEXELS_API_KEY = process.env.PEXELS_API_KEY ?? '';
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN ?? '';

// ── Pexels ──────────────────────────────────────────────────────────────────

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  src: { large: string; large2x: string; original: string };
  alt: string;
  photographer: string;
}

interface PexelsResponse {
  photos: PexelsPhoto[];
  total_results: number;
}

/**
 * Search Pexels for a photo matching the query. Returns the URL of the
 * `large2x` variant (1880px wide max, plenty for a 1080×1080 IG post).
 *
 * Picks among the top 5 results randomly so consecutive posts on the same
 * theme don't reuse the same image.
 */
export async function pexelsSearch(query: string, opts?: { orientation?: 'square' | 'landscape' | 'portrait' }): Promise<{ url: string; attribution: string } | null> {
  if (!PEXELS_API_KEY) {
    console.warn('[imageSources] PEXELS_API_KEY not set');
    return null;
  }
  const params = new URLSearchParams({
    query,
    per_page: '5',
    orientation: opts?.orientation ?? 'square',
  });
  const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
    headers: { Authorization: PEXELS_API_KEY },
  });
  if (!res.ok) {
    console.warn(`[imageSources] Pexels ${res.status}: ${await res.text()}`);
    return null;
  }
  const data = (await res.json()) as PexelsResponse;
  if (!data.photos.length) return null;
  const pick = data.photos[Math.floor(Math.random() * data.photos.length)];
  return {
    url: pick.src.large2x,
    attribution: `Photo by ${pick.photographer} on Pexels`,
  };
}

// ── Replicate FLUX.1 Schnell ────────────────────────────────────────────────

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output: string[] | string | null;
  error: string | null;
  urls: { get: string };
}

/**
 * Generate an AI image via FLUX.1 Schnell. Schnell is the fast/cheap variant
 * (~₹0.25/image, ~2 seconds). Returns a temporary URL — Replicate keeps the
 * file ~1 hour, plenty for the renderer to fetch and embed.
 *
 * Polls the prediction endpoint until terminal state or `timeoutMs` elapses.
 * Falls back to null on any failure so the caller can substitute a stock
 * photo — never throws.
 */
export async function fluxSchnell(prompt: string, opts?: { aspectRatio?: '1:1' | '16:9' | '9:16'; timeoutMs?: number }): Promise<string | null> {
  if (!REPLICATE_API_TOKEN) {
    console.warn('[imageSources] REPLICATE_API_TOKEN not set');
    return null;
  }
  const aspect = opts?.aspectRatio ?? '1:1';
  const timeout = opts?.timeoutMs ?? 30_000;

  let prediction: ReplicatePrediction;
  try {
    const res = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
        Prefer: 'wait',
      },
      body: JSON.stringify({
        input: { prompt, aspect_ratio: aspect, num_outputs: 1, output_format: 'jpg', output_quality: 90 },
      }),
    });
    if (!res.ok) {
      console.warn(`[imageSources] Replicate ${res.status}: ${await res.text()}`);
      return null;
    }
    prediction = (await res.json()) as ReplicatePrediction;
  } catch (e) {
    console.warn('[imageSources] Replicate request failed', e);
    return null;
  }

  // With Prefer: wait Replicate often returns the finished prediction
  // synchronously. If it didn't, poll until terminal.
  const start = Date.now();
  while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && prediction.status !== 'canceled') {
    if (Date.now() - start > timeout) {
      console.warn('[imageSources] Replicate timed out after', timeout, 'ms');
      return null;
    }
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const poll = await fetch(prediction.urls.get, { headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` } });
      if (!poll.ok) return null;
      prediction = (await poll.json()) as ReplicatePrediction;
    } catch {
      return null;
    }
  }

  if (prediction.status !== 'succeeded' || !prediction.output) {
    console.warn('[imageSources] Replicate prediction did not succeed', prediction.status, prediction.error);
    return null;
  }
  return Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
}
