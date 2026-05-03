"use strict";
// Image source adapters.
//
// Stock:
//   - Pexels — free unlimited stock photos. Library skews Western, so for
//     Indian content the query must be explicit ("indian", "saree", etc.).
//
// AI generators (ascending Indian-context fidelity, ascending cost):
//   - Replicate FLUX.1 Schnell — ~₹0.25/img, fast, generic.
//   - Google Imagen 3 (via Gemini API) — ~₹3.30/img, strong on Indian skin
//     tones, traditional clothing, Indian environments. Default for our
//     daily content; cost is negligible at ~30 posts/mo (~₹100/mo).
//   - OpenAI gpt-image-1 — ~₹3.50/img medium quality. Strong prompt
//     adherence for compositional detail. Requires verified OpenAI org.
//
// All adapters return either an http(s) URL or a `data:` URL. The renderer's
// Satori loader fetches both transparently. Adapters never throw — they
// return null on any failure so the caller can fall back.
//
// Secrets (all in functions/.env):
//   PEXELS_API_KEY      — Pexels developer key (free)
//   REPLICATE_API_TOKEN — Replicate token (paid)
//   GEMINI_API_KEY      — Google AI Studio key for Imagen (paid)
//   OPENAI_API_KEY      — OpenAI key for gpt-image-1 (paid, org-verified)
Object.defineProperty(exports, "__esModule", { value: true });
exports.pexelsSearch = pexelsSearch;
exports.fluxSchnell = fluxSchnell;
exports.imagenGenerate = imagenGenerate;
exports.openaiImage = openaiImage;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY ?? '';
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN ?? '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
/**
 * Search Pexels for a photo matching the query. Returns the URL of the
 * `large2x` variant (1880px wide max, plenty for a 1080×1080 IG post).
 *
 * Picks among the top 5 results randomly so consecutive posts on the same
 * theme don't reuse the same image.
 */
async function pexelsSearch(query, opts) {
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
    const data = (await res.json());
    if (!data.photos.length)
        return null;
    const pick = data.photos[Math.floor(Math.random() * data.photos.length)];
    return {
        url: pick.src.large2x,
        attribution: `Photo by ${pick.photographer} on Pexels`,
    };
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
async function fluxSchnell(prompt, opts) {
    if (!REPLICATE_API_TOKEN) {
        console.warn('[imageSources] REPLICATE_API_TOKEN not set');
        return null;
    }
    const aspect = opts?.aspectRatio ?? '1:1';
    const timeout = opts?.timeoutMs ?? 30000;
    let prediction;
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
        prediction = (await res.json());
    }
    catch (e) {
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
            if (!poll.ok)
                return null;
            prediction = (await poll.json());
        }
        catch {
            return null;
        }
    }
    if (prediction.status !== 'succeeded' || !prediction.output) {
        console.warn('[imageSources] Replicate prediction did not succeed', prediction.status, prediction.error);
        return null;
    }
    return Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
}
async function imagenGenerate(prompt, opts) {
    if (!GEMINI_API_KEY) {
        console.warn('[imageSources] GEMINI_API_KEY not set');
        return null;
    }
    const aspectRatio = opts?.aspectRatio ?? '1:1';
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instances: [{ prompt }],
                parameters: { sampleCount: 1, aspectRatio, personGeneration: 'allow_adult' },
            }),
        });
        if (!res.ok) {
            console.warn(`[imageSources] Imagen ${res.status}: ${await res.text()}`);
            return null;
        }
        const data = (await res.json());
        const pred = data?.predictions?.[0];
        if (!pred?.bytesBase64Encoded) {
            console.warn('[imageSources] Imagen returned no image', data?.error?.message ?? '');
            return null;
        }
        return `data:${pred.mimeType ?? 'image/png'};base64,${pred.bytesBase64Encoded}`;
    }
    catch (e) {
        console.warn('[imageSources] Imagen request failed', e);
        return null;
    }
}
async function openaiImage(prompt, opts) {
    if (!OPENAI_API_KEY) {
        console.warn('[imageSources] OPENAI_API_KEY not set');
        return null;
    }
    const quality = opts?.quality ?? 'medium';
    const size = opts?.size ?? '1024x1024';
    try {
        const res = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ model: 'gpt-image-1', prompt, n: 1, size, quality }),
        });
        if (!res.ok) {
            console.warn(`[imageSources] OpenAI ${res.status}: ${await res.text()}`);
            return null;
        }
        const data = (await res.json());
        const item = data?.data?.[0];
        if (item?.b64_json)
            return `data:image/png;base64,${item.b64_json}`;
        if (item?.url)
            return item.url;
        console.warn('[imageSources] OpenAI returned no image', data?.error?.message ?? '');
        return null;
    }
    catch (e) {
        console.warn('[imageSources] OpenAI request failed', e);
        return null;
    }
}
