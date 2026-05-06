"use strict";
// Image source adapters.
//
// Stock:
//   - Pexels — free unlimited stock photos. Library skews Western, so for
//     Indian content the query must be explicit ("indian", "saree", etc.).
//
// AI generators (ascending Indian-context fidelity, ascending cost):
//   - Replicate FLUX.1 Schnell — ~₹0.25/img, fast, generic.
//   - Google Imagen 4 (via Gemini API) — ~₹3.30/img, strong on Indian skin
//     tones, traditional clothing, Indian environments. Default for our
//     daily content; cost is negligible at ~30 posts/mo (~₹100/mo).
//   - OpenAI gpt-image-1 — ~₹3.50/img medium quality. Strong prompt
//     adherence for compositional detail. Requires verified OpenAI org.
//
// All adapters return either an http(s) URL or a `data:` URL. The renderer's
// Satori loader fetches both transparently. Adapters never throw — they
// return null on any failure so the caller can fall back.
//
// Secrets: read at request time via getIntegrationConfig() (Firestore-first,
// env fallback). Keys set in the admin Integration Hub take effect within
// 5 minutes (cache TTL); no functions redeploy required.
Object.defineProperty(exports, "__esModule", { value: true });
exports.pexelsSearch = pexelsSearch;
exports.fluxSchnell = fluxSchnell;
exports.replicateLoraImage = replicateLoraImage;
exports.imagenGenerate = imagenGenerate;
exports.openaiImage = openaiImage;
exports.openaiImageEdit = openaiImageEdit;
const integrationConfig_1 = require("../lib/integrationConfig");
/**
 * Search Pexels for a photo matching the query. Returns the URL of the
 * `large2x` variant (1880px wide max, plenty for a 1080×1080 IG post).
 *
 * Picks among the top 5 results randomly so consecutive posts on the same
 * theme don't reuse the same image.
 */
async function pexelsSearch(query, opts) {
    const cfg = await (0, integrationConfig_1.getIntegrationConfig)();
    if (!cfg.pexels.apiKey) {
        console.warn('[imageSources] pexels.apiKey not set');
        return null;
    }
    const params = new URLSearchParams({
        query,
        per_page: '5',
        orientation: opts?.orientation ?? 'square',
    });
    const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
        headers: { Authorization: cfg.pexels.apiKey },
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
    const cfg = await (0, integrationConfig_1.getIntegrationConfig)();
    if (!cfg.replicate.apiToken) {
        console.warn('[imageSources] replicate.apiToken not set');
        return null;
    }
    const aspect = opts?.aspectRatio ?? '1:1';
    const timeout = opts?.timeoutMs ?? 30000;
    let prediction;
    try {
        const res = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${cfg.replicate.apiToken}`,
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
            const poll = await fetch(prediction.urls.get, { headers: { Authorization: `Bearer ${cfg.replicate.apiToken}` } });
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
async function replicateLoraImage(prompt, opts) {
    const cfg = await (0, integrationConfig_1.getIntegrationConfig)();
    if (!cfg.replicate.apiToken) {
        console.warn('[imageSources] replicate.apiToken not set');
        return null;
    }
    const model = opts?.model || cfg.replicate.loraModel;
    if (!model || !model.includes('/')) {
        console.warn('[imageSources] replicate.loraModel not set');
        return null;
    }
    const aspect = opts?.aspectRatio ?? '1:1';
    const timeout = opts?.timeoutMs ?? 160000;
    let prediction;
    try {
        const [modelPath, versionId] = model.split(':');
        const url = versionId
            ? 'https://api.replicate.com/v1/predictions'
            : `https://api.replicate.com/v1/models/${modelPath}/predictions`;
        const input = {
            prompt,
            aspect_ratio: aspect,
            num_outputs: 1,
            output_format: 'png',
            output_quality: 100,
            model: 'dev',
            num_inference_steps: 40,
            guidance_scale: 3.2,
            lora_scale: 0.78,
        };
        const body = versionId ? { version: versionId, input } : { input };
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${cfg.replicate.apiToken}`,
                'Content-Type': 'application/json',
                Prefer: 'wait',
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            console.warn(`[imageSources] Replicate LoRA ${res.status}: ${await res.text()}`);
            return null;
        }
        prediction = (await res.json());
    }
    catch (e) {
        console.warn('[imageSources] Replicate LoRA request failed', e);
        return null;
    }
    const start = Date.now();
    while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && prediction.status !== 'canceled') {
        if (Date.now() - start > timeout) {
            console.warn('[imageSources] Replicate LoRA timed out after', timeout, 'ms');
            return null;
        }
        await new Promise((r) => setTimeout(r, 1500));
        try {
            const poll = await fetch(prediction.urls.get, { headers: { Authorization: `Bearer ${cfg.replicate.apiToken}` } });
            if (!poll.ok)
                return null;
            prediction = (await poll.json());
        }
        catch {
            return null;
        }
    }
    if (prediction.status !== 'succeeded' || !prediction.output) {
        console.warn('[imageSources] Replicate LoRA prediction did not succeed', prediction.status, prediction.error);
        return null;
    }
    return Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
}
function firstImagenDataUrl(data) {
    const prediction = data?.predictions?.find((p) => p?.bytesBase64Encoded);
    if (prediction?.bytesBase64Encoded) {
        return `data:${prediction.mimeType ?? 'image/png'};base64,${prediction.bytesBase64Encoded}`;
    }
    const generated = data?.generatedImages?.find((g) => g?.image?.imageBytes);
    if (generated?.image?.imageBytes) {
        return `data:${generated.image.mimeType ?? 'image/png'};base64,${generated.image.imageBytes}`;
    }
    for (const candidate of data?.candidates ?? []) {
        const inline = candidate?.content?.parts?.find((p) => p?.inlineData?.data)?.inlineData;
        if (inline?.data)
            return `data:${inline.mimeType ?? 'image/png'};base64,${inline.data}`;
    }
    return null;
}
async function imagenGenerate(prompt, opts) {
    const cfg = await (0, integrationConfig_1.getIntegrationConfig)();
    if (!cfg.gemini.apiKey) {
        console.warn('[imageSources] gemini.apiKey not set');
        return null;
    }
    const aspectRatio = opts?.aspectRatio ?? '1:1';
    const model = cfg.gemini.imagenModel || 'imagen-4.0-generate-001';
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.gemini.apiKey },
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
        const imageUrl = firstImagenDataUrl(data);
        if (!imageUrl) {
            console.warn('[imageSources] Imagen returned no image', data?.error?.message ?? '');
            return null;
        }
        return imageUrl;
    }
    catch (e) {
        console.warn('[imageSources] Imagen request failed', e);
        return null;
    }
}
async function openaiImage(prompt, opts) {
    const cfg = await (0, integrationConfig_1.getIntegrationConfig)();
    if (!cfg.openai.apiKey) {
        console.warn('[imageSources] openai.apiKey not set');
        return null;
    }
    const quality = opts?.quality ?? 'medium';
    const size = opts?.size ?? '1024x1024';
    const timeoutMs = opts?.timeoutMs ?? 90000;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${cfg.openai.apiKey}`,
                'Content-Type': 'application/json',
            },
            signal: controller.signal,
            body: JSON.stringify({ model: 'gpt-image-1', prompt, n: 1, size, quality }),
        });
        clearTimeout(timeout);
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
// ── OpenAI gpt-image-1 — edits ──────────────────────────────────────────────
//
// Endpoint: POST https://api.openai.com/v1/images/edits (multipart/form-data)
// Takes one or more input PNGs + a text prompt. Returns a re-imagined image.
// Same b64_json shape as /generations. Optional `mask` for inpainting.
//
// Cost (May 2026): ~$0.042 medium / 1024x1024.
//
// Multipart in Node 22 native fetch — use built-in FormData + Blob.
async function openaiImageEdit(imageBuf, prompt, opts) {
    const cfg = await (0, integrationConfig_1.getIntegrationConfig)();
    if (!cfg.openai.apiKey) {
        console.warn('[imageSources] openai.apiKey not set');
        return null;
    }
    const quality = opts?.quality ?? 'medium';
    const size = opts?.size ?? '1024x1024';
    const timeoutMs = opts?.timeoutMs ?? 120000;
    try {
        const form = new FormData();
        form.append('model', 'gpt-image-1');
        form.append('prompt', prompt);
        form.append('n', '1');
        form.append('size', size);
        form.append('quality', quality);
        form.append('output_format', 'png');
        if (opts?.inputFidelity)
            form.append('input_fidelity', opts.inputFidelity);
        // Cast Buffer → Blob via Uint8Array conversion (Node Buffer is a
        // Uint8Array subclass but TS Blob ctor needs the explicit type).
        const images = Array.isArray(imageBuf) ? imageBuf : [imageBuf];
        const mimeType = opts?.mimeType ?? 'image/png';
        images.forEach((buf, index) => {
            const blob = new Blob([new Uint8Array(buf)], { type: mimeType });
            form.append(images.length > 1 ? 'image[]' : 'image', blob, `input-${index}.${mimeType.endsWith('webp') ? 'webp' : 'png'}`);
        });
        if (opts?.maskBuf) {
            const maskBlob = new Blob([new Uint8Array(opts.maskBuf)], { type: 'image/png' });
            form.append('mask', maskBlob, 'mask.png');
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch('https://api.openai.com/v1/images/edits', {
            method: 'POST',
            headers: { Authorization: `Bearer ${cfg.openai.apiKey}` },
            signal: controller.signal,
            body: form,
        });
        clearTimeout(timeout);
        if (!res.ok) {
            console.warn(`[imageSources] OpenAI edit ${res.status}: ${await res.text()}`);
            return null;
        }
        const data = (await res.json());
        const item = data?.data?.[0];
        if (item?.b64_json)
            return `data:image/png;base64,${item.b64_json}`;
        if (item?.url)
            return item.url;
        console.warn('[imageSources] OpenAI edit returned no image', data?.error?.message ?? '');
        return null;
    }
    catch (e) {
        console.warn('[imageSources] OpenAI edit request failed', e);
        return null;
    }
}
