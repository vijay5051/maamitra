"use strict";
// Library AI — Articles generator.
//
// Produces full-length parenting articles ready for the Library "Read" tab.
// Each run generates one article:
//   1. Pick (topic, ageBucket) — caller override or auto-rotated by performance.
//   2. Ask gpt-4o-mini for { title, preview, body, readTime, emoji, tag }.
//   3. Compliance scan against marketing brand kit forbidden-words list.
//   4. Generate hero image via OpenAI / ChatGPT Images (style-locked)
//      → upload to Storage. Pexels is used only when explicitly selected.
//   5. Write to `articles` collection at status='published' or 'draft'
//      depending on settings.autoPublish.
//
// Re-uses the marketing renderer's brand kit + image sources for
// consistency. Output shape matches the legacy `Article` type so the
// existing Library UI renders AI items without any client-side change.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runArticleGenerator = runArticleGenerator;
exports.buildProcessPendingArticleImage = buildProcessPendingArticleImage;
exports.buildRetryArticleImage = buildRetryArticleImage;
exports.buildSyncPublishedArticleToMarketingDraft = buildSyncPublishedArticleToMarketingDraft;
exports.buildSendArticleToMarketingDraft = buildSendArticleToMarketingDraft;
exports.buildGenerateArticleNow = buildGenerateArticleNow;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const imageSources_1 = require("../marketing/imageSources");
const brand_1 = require("./brand");
const openai_1 = require("./openai");
const settings_1 = require("./settings");
const auth_1 = require("./auth");
const styleReferences_1 = require("../marketing/styleReferences");
const DEFAULT_MARKETING_HASHTAGS = ['MaaMitra', 'IndianMoms', 'Parenting', 'Motherhood', 'BabyCare'];
const STORAGE_URL_PATH = /^https?:\/\/storage\.googleapis\.com\/[^/]+\/(.+)$/i;
const FIREBASE_STORAGE_URL_PATH = /^https?:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/([^?]+)/i;
// ── Slot picker ─────────────────────────────────────────────────────────────
function pickAgeBucket(buckets, override, today) {
    if (override) {
        const m = buckets.find((b) => b.key === override);
        if (m)
            return m;
    }
    // Rotate by day-of-year so consecutive runs don't all hit the same bucket.
    const start = Date.UTC(today.getUTCFullYear(), 0, 0);
    const diff = today.getTime() - start;
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    return buckets[dayOfYear % buckets.length];
}
function pickTopic(topics, override, today, ageBucket) {
    const cleaned = topics.filter((t) => typeof t === 'string' && t.trim());
    if (!cleaned.length)
        return 'Indian Parenting Tips';
    if (override) {
        const match = cleaned.find((t) => t.toLowerCase() === override.toLowerCase());
        if (match)
            return match;
        if (override.trim())
            return override.trim().slice(0, 80);
    }
    // Hash (date + ageBucket) so each run pulls a different topic but the same
    // run for the same bucket is reproducible during retries.
    const seed = today.toISOString().slice(0, 10) + '|' + ageBucket.key;
    let h = 0;
    for (let i = 0; i < seed.length; i++)
        h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    return cleaned[Math.abs(h) % cleaned.length];
}
function inferAgeBucketFromTopic(topic, buckets) {
    const t = topic.toLowerCase();
    const wantedKey = /\b(pregnancy|pregnant|trimester|prenatal|antenatal)\b/.test(t) ? 'pregnancy' :
        /\b(newborn|0-3m|0 to 3|first month)\b/.test(t) ? 'newborn' :
            /\b(infant|3-12m|3 to 12|baby development|first year)\b/.test(t) ? 'infant' :
                /\b(preschool|preschooler|3-5y|3 to 5|school readiness)\b/.test(t) ? 'preschool' :
                    /\b(toddler|1-3y|1 to 3|tantrum|behaviour|behavior|potty)\b/.test(t) ? 'toddler' :
                        null;
    return wantedKey ? buckets.find((b) => b.key === wantedKey) ?? null : null;
}
// ── De-dupe — avoid generating an article whose title we already published in
// the last 60 days. ─────────────────────────────────────────────────────────
async function recentArticleTitles() {
    const out = new Set();
    try {
        const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 60 * 24 * 3600 * 1000);
        const snap = await admin.firestore()
            .collection('articles')
            .where('createdAt', '>=', cutoff)
            .limit(200)
            .get();
        snap.forEach((d) => {
            const t = d.data()?.title;
            if (typeof t === 'string')
                out.add(t.toLowerCase().trim());
        });
    }
    catch (e) {
        console.warn('[library/articles] recentTitles read failed', e);
    }
    return out;
}
// ── Caption / body generation ───────────────────────────────────────────────
async function writeArticleBody(brand, topic, ageBucket, tone, recentTitles) {
    const system = [
        (0, brand_1.buildSystemVoiceHeader)(brand),
        `Mandatory article tone, follow this for every paragraph: ${tone}`,
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
    const parsed = await (0, openai_1.chatJson)([
        { role: 'system', content: system },
        { role: 'user', content: user },
    ], { temperature: 0.85, maxTokens: 2400 });
    if (!parsed) {
        console.warn('[library/articles] article AI failed, using local fallback body');
        return fallbackArticleBody(topic, ageBucket, brand, tone);
    }
    const title = trim(parsed.title, 120);
    const body = trim(parsed.body, 6000);
    if (!title || body.length < 200) {
        console.warn('[library/articles] article AI returned weak body, using local fallback body');
        return fallbackArticleBody(topic, ageBucket, brand, tone);
    }
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
function fallbackArticleBody(topic, ageBucket, brand, tone) {
    const titleTopic = titleCase(topic || 'Parenting');
    const childStage = ageBucket.ageMin < 0 ? 'pregnancy' : ageBucket.label.toLowerCase();
    const englishOnly = brand.bilingual === 'english_only';
    const lightHinglish = !englishOnly;
    const localWarmth = /hindi|hinglish|regional|local|quirky|human/i.test(tone);
    const title = `${titleTopic}: A Gentle Guide for Indian Parents`.slice(0, 80);
    const preview = `A practical, judgement-free guide for Indian families navigating ${titleTopic.toLowerCase()} during ${childStage}.`;
    const reassurance = lightHinglish
        ? 'You do not need to do everything perfectly; steady, loving care is already a strong start.'
        : 'You do not need to do everything perfectly; steady, loving care is already a strong start.';
    const body = [
        'Start With Your Real Day',
        lightHinglish
            ? `Every family handles ${titleTopic.toLowerCase()} differently, especially in Indian homes where advice can come from doctors, grandparents, neighbours, and the internet all at once${localWarmth ? ' — full family WhatsApp University included' : ''}. Start with your own child, your routine, your budget, and your support system. A plan that works calmly in your home is more useful than a perfect plan that adds pressure.`
            : `Every family handles ${titleTopic.toLowerCase()} differently. Start with your own child, your routine, your budget, and your support system. A plan that works calmly in your home is more useful than a perfect plan that adds pressure.`,
        '',
        'Keep The Next Step Small',
        `For ${childStage}, small repeatable steps usually work better than sudden big changes. Pick one thing to improve this week: a calmer bedtime rhythm, a simpler food routine, a safer play corner, a little more rest for the mother, or a clearer conversation with family members. When one step settles, add the next.`,
        '',
        'Watch Your Child, Not Just The Chart',
        `Milestones, routines, and expert guidance are helpful, but your child is still an individual. Notice energy, sleep, feeding, mood, comfort, and how your child responds over a few days. If something feels unusual, persistent, painful, or worrying, speak with a qualified pediatrician or healthcare professional instead of relying on social media advice.`,
        '',
        'Make Family Support Specific',
        lightHinglish
            ? 'Instead of saying “please help,” try asking for one clear thing: folding baby clothes, preparing one simple meal, taking the baby for ten minutes after feeding, or handling an errand. Specific help is easier for family to give, and it protects the mother from carrying every invisible task alone.'
            : 'Instead of saying “please help,” try asking for one clear thing: folding baby clothes, preparing one simple meal, taking the baby for ten minutes after feeding, or handling an errand. Specific help is easier for family to give, and it protects the mother from carrying every invisible task alone.',
        '',
        'Be Kind To Yourself',
        `Some days will feel smooth and some days will feel messy. That does not mean you are failing. Parenting is built through many ordinary moments: noticing, adjusting, apologising, resting, and trying again. ${reassurance}`,
    ].join('\n');
    return {
        title,
        preview,
        body,
        readTime: estimateReadTime(body),
        emoji: '🌱',
        tag: titleTopic.split(/\s+/)[0].slice(0, 24) || 'Parenting',
        imagePrompt: `Indian mother with child in a warm MaaMitra home scene about ${titleTopic.toLowerCase()}, soft pastel light, no text or logos`,
        audience: 'all',
    };
}
function titleCase(s) {
    return s
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
        .join(' ');
}
function trim(v, max) {
    return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
function estimateReadTime(body) {
    const words = body.split(/\s+/).filter(Boolean).length;
    return `${Math.max(2, Math.round(words / 220))} min read`;
}
function weekdayKeyForNowIst() {
    const now = new Date(Date.now() + 5.5 * 3600 * 1000);
    return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getUTCDay()];
}
function decodeStoragePathFromUrl(url) {
    if (!url || typeof url !== 'string')
        return null;
    const firebaseMatch = url.match(FIREBASE_STORAGE_URL_PATH);
    if (firebaseMatch?.[1])
        return decodeURIComponent(firebaseMatch[1]);
    const gcsMatch = url.match(STORAGE_URL_PATH);
    if (gcsMatch?.[1])
        return decodeURIComponent(gcsMatch[1]);
    return null;
}
async function loadMarketingHashtags() {
    try {
        const snap = await admin.firestore().doc('marketing_brand/main').get();
        const raw = snap.exists ? snap.data()?.hashtags : null;
        if (!Array.isArray(raw))
            return DEFAULT_MARKETING_HASHTAGS;
        const cleaned = raw
            .map((h) => (typeof h === 'string' ? h.trim().replace(/^#/, '') : ''))
            .filter(Boolean)
            .slice(0, 12);
        return cleaned.length ? cleaned : DEFAULT_MARKETING_HASHTAGS;
    }
    catch {
        return DEFAULT_MARKETING_HASHTAGS;
    }
}
function assembleMarketingCaption(body, hashtags, brandHashtags) {
    const merged = Array.from(new Set([...hashtags, ...brandHashtags]
        .map((h) => h.trim().replace(/^#/, ''))
        .filter(Boolean))).slice(0, 12);
    const tagLine = merged.length ? merged.map((h) => `#${h}`).join(' ') : '';
    return [body.trim(), tagLine].filter(Boolean).join('\n\n').slice(0, 2200);
}
async function summarizeArticleForMarketing(article, brand) {
    const title = trim(article?.title, 120);
    const preview = trim(article?.preview, 360);
    const body = trim(article?.body, 5000);
    const topic = trim(article?.topic ?? article?.tag, 80);
    const ageRange = typeof article?.ageMin === 'number' && typeof article?.ageMax === 'number'
        ? `${article.ageMin}-${article.ageMax} months`
        : 'Indian parents';
    const parsed = await (0, openai_1.chatJson)([
        {
            role: 'system',
            content: [
                (0, brand_1.buildSystemVoiceHeader)(brand),
                'You turn MaaMitra Library articles into one strong social draft for marketing review.',
                'The output should summarize the live article faithfully, not invent a new topic.',
                'Write warm, practical, non-clickbait social copy for Indian parents.',
                'Output STRICT JSON only.',
            ].join('\n'),
        },
        {
            role: 'user',
            content: [
                'Convert this live library article into one social-media draft.',
                'Return JSON with exactly these keys:',
                '{',
                '  "headline": "≤80 chars, concise social headline",',
                '  "body": "3-6 sentences, warm and useful, no hashtags",',
                '  "hashtags": ["5-10 short tags without #"]',
                '}',
                '',
                `Title: ${title || 'Untitled article'}`,
                `Topic: ${topic || 'Parenting'}`,
                `Age range: ${ageRange}`,
                `Preview: ${preview || 'None'}`,
                `Body:\n${body || 'None'}`,
            ].join('\n'),
        },
    ], { temperature: 0.7, maxTokens: 700 });
    const fallbackBody = preview
        || body.split(/\n+/).map((x) => x.trim()).filter(Boolean).slice(0, 2).join(' ')
        || `A warm, practical read from MaaMitra on ${topic || title || 'parenting'}.`;
    return {
        headline: trim(parsed?.headline, 80) || title.slice(0, 80) || 'MaaMitra Library',
        body: trim(parsed?.body, 1800) || fallbackBody.slice(0, 1800),
        hashtags: Array.isArray(parsed?.hashtags)
            ? parsed.hashtags
                .map((h) => trim(h, 40).replace(/^#/, ''))
                .filter(Boolean)
                .slice(0, 10)
            : [],
    };
}
// ── Hero image ──────────────────────────────────────────────────────────────
function articleThumbnailAgeVisual(ageBucket, topic) {
    const key = ageBucket?.key;
    const t = (topic ?? '').toLowerCase();
    if (key === 'pregnancy' || /\b(pregnancy|pregnant|trimester|prenatal|antenatal)\b/.test(t)) {
        return 'Thumbnail age cue: show a pregnant Indian mother, no older child unless the topic asks for one. Use calm pregnancy-home elements such as cushion, water bottle, prenatal notes, soft dupatta, or gentle yoga mat.';
    }
    if (key === 'newborn' || /\b(newborn|0-3m|first month)\b/.test(t)) {
        return 'Thumbnail age cue: show a tiny newborn baby, wrapped or lying close to mother. Use newborn elements such as swaddle, soft blanket, baby cot, feeding pillow, or tiny mittens.';
    }
    if (key === 'infant' || /\b(infant|3-12m|first year)\b/.test(t)) {
        return 'Thumbnail age cue: show an infant baby around 6-10 months, sitting/crawling with rounded baby proportions. Use infant elements such as soft toy, rattle, bib, feeding bowl, or floor mat.';
    }
    if (key === 'preschool' || /\b(preschool|preschooler|school readiness|3-5y)\b/.test(t)) {
        return 'Thumbnail age cue: show a preschool child aged 3-4 years, clearly older than a toddler, standing or sitting independently. Add preschool elements such as a small school bag, picture books, crayons, lunch box, alphabet blocks, or water bottle. Do not draw a baby.';
    }
    if (key === 'toddler' || /\b(toddler|tantrum|behaviour|behavior|potty|1-3y)\b/.test(t)) {
        return 'Thumbnail age cue: show a toddler aged 1-2 years, walking or playing independently but still small. Use toddler elements such as stacking blocks, chunky toys, sippy cup, small shoes, or potty-training cues when relevant. Do not draw a newborn.';
    }
    return 'Thumbnail age cue: make the child age match the article topic. Do not default to a baby if the article is about toddlers or preschoolers.';
}
function articleThumbnailGuard(ageBucket, topic) {
    const t = topic ?? 'the article topic';
    return [
        `Article thumbnail brief: illustrate the article topic exactly: ${t}.`,
        'Use one mother/caregiver and one child unless the article explicitly asks for more people.',
        'No duplicate mothers, no extra adult friend, no baby if the age bucket is toddler or preschool.',
        'Avoid generic tea/cup chatting scenes unless the article is actually about parent conversation.',
        'Show topic-specific props prominently, not just decorative plants.',
        articleThumbnailAgeVisual(ageBucket, topic),
    ].join('\n');
}
async function renderHeroImage(prompt, brand, preferred, ageBucket, topic) {
    if (preferred === 'none')
        return { url: null, source: 'none', costInr: 0 };
    const thumbnailGuard = articleThumbnailGuard(ageBucket, topic);
    const styled = (0, brand_1.buildStyleLockedImagePrompt)(`${prompt.trim()}\n${thumbnailGuard}`, brand);
    let aiUrl = null;
    let source = preferred;
    let costInr = 0;
    if (preferred === 'openai' || preferred === 'dalle' || preferred === 'lora') {
        aiUrl = await (0, styleReferences_1.openaiMaaMitraReferenceImage)(styled, {
            preset: 'article',
            quality: 'high',
            size: '1536x1024',
            maxRefs: 6,
            timeoutMs: 90000,
            fallbackToGeneration: false,
            extraLines: [
                'Article hero requirement: keep the scene readable as a wide thumbnail with one clear focal action and uncluttered background shapes.',
                'Age bucket cues are mandatory. If the article is about toddler or preschool stages, do not draw a baby.',
                'Treat the supplied MaaMitra mosaic reference as the master house-style anchor for this thumbnail, with the other supplied illustrations reinforcing the same family.',
                'The MaaMitra illustration references must overpower any generic watercolor, storybook, or stock-illustration tendency from the model.',
            ],
        }).catch(() => null);
        if (aiUrl) {
            source = 'openai';
            costInr = 14.50;
        }
    }
    else if (preferred === 'imagen') {
        aiUrl = await (0, imageSources_1.imagenGenerate)(styled, { aspectRatio: '16:9' }).catch(() => null);
        if (aiUrl)
            costInr = 3.30;
    }
    else if (preferred === 'flux') {
        aiUrl = await (0, imageSources_1.fluxSchnell)(styled, { aspectRatio: '16:9' }).catch(() => null);
        if (aiUrl)
            costInr = 0.25;
    }
    if (aiUrl) {
        const stored = await persistImage(aiUrl, source);
        if (stored)
            return { url: stored, source, costInr };
    }
    // Stock imagery is an explicit choice. If the configured AI image model
    // fails, keep the article imageless so admins can see the failure instead of
    // silently drifting away from the MaaMitra brand theme.
    if (preferred === 'pexels') {
        const stock = await (0, imageSources_1.pexelsSearch)(prompt.slice(0, 100), { orientation: 'landscape' }).catch(() => null);
        if (stock) {
            const stored = await persistImage(stock.url, 'pexels');
            if (stored)
                return { url: stored, source: 'pexels', costInr: 0 };
            return { url: stock.url, source: 'pexels', costInr: 0 };
        }
    }
    return { url: null, source: 'none', costInr: 0 };
}
async function persistImage(url, source) {
    try {
        const res = await fetch(url);
        if (!res.ok)
            return null;
        const buf = Buffer.from(await res.arrayBuffer());
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const path = `library/articles/${timestamp}-${source}.jpg`;
        const file = admin.storage().bucket().file(path);
        await file.save(buf, {
            contentType: source === 'imagen' || source === 'flux' || source === 'dalle' || source === 'openai' ? 'image/png' : 'image/jpeg',
            metadata: { metadata: { source, kind: 'library-article' } },
        });
        await file.makePublic();
        return `https://storage.googleapis.com/${admin.storage().bucket().name}/${path}`;
    }
    catch (e) {
        console.warn('[library/articles] persistImage failed', e);
        return null;
    }
}
function decideArticleStatus(explicit, autoPublish, flags) {
    const hasHardFlag = flags.some((f) => f.type === 'forbidden_word');
    return explicit
        ? explicit
        : hasHardFlag
            ? 'draft'
            : autoPublish ? 'published' : 'draft';
}
async function processArticleImageForDoc(ref, data) {
    if (!data || data.source !== 'ai' || typeof data.aiImagePrompt !== 'string')
        return 'failed';
    const brand = await (0, brand_1.loadLibraryBrand)();
    const preferred = ['openai', 'lora', 'imagen', 'dalle', 'flux', 'pexels', 'none'].includes(data.aiRequestedImageModel)
        ? data.aiRequestedImageModel
        : 'openai';
    const ageBucket = typeof data.aiAgeBucketKey === 'string' && typeof data.ageMin === 'number' && typeof data.ageMax === 'number'
        ? { key: data.aiAgeBucketKey, label: data.aiAgeBucketKey, ageMin: data.ageMin, ageMax: data.ageMax }
        : undefined;
    try {
        const image = await renderHeroImage(data.aiImagePrompt, brand, preferred, ageBucket, typeof data.topic === 'string' ? data.topic : undefined);
        if (!image.url) {
            await ref.update({
                aiImageStatus: 'failed',
                aiImageSource: 'none',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return 'failed';
        }
        await ref.update({
            imageUrl: image.url,
            aiImageSource: image.source,
            aiImageStatus: 'ready',
            aiCostInr: (Number(data.aiCostInr) || 0) + image.costInr,
            status: data.aiPendingPublishStatus === 'published' ? 'published' : 'draft',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return 'ready';
    }
    catch (e) {
        console.warn('[library/articles] image generation failed', e);
        await ref.update({
            aiImageStatus: 'failed',
            aiImageSource: 'none',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return 'failed';
    }
}
async function createMarketingDraftFromArticle(ref, data, opts) {
    if (!data || typeof data !== 'object')
        return { ok: false, code: 'invalid-data', message: 'Article data is missing.' };
    if (!opts?.force && data.status !== 'published') {
        return { ok: false, code: 'not-live', message: 'Only live articles can be sent to Marketing Drafts.' };
    }
    const title = trim(data.title, 120);
    const body = trim(data.body, 7000);
    if (!title || !body)
        return { ok: false, code: 'missing-copy', message: 'Article title/body is incomplete.' };
    if (typeof data.imageUrl !== 'string' || !data.imageUrl.trim()) {
        return { ok: false, code: 'missing-image', message: 'Article needs a hero image before it can become a marketing draft.' };
    }
    const brand = await (0, brand_1.loadLibraryBrand)();
    const social = await summarizeArticleForMarketing(data, brand);
    const compliance = (0, brand_1.runCompliance)(`${social.headline}\n${social.body}`, brand);
    const brandHashtags = await loadMarketingHashtags();
    const caption = assembleMarketingCaption(social.body, social.hashtags, brandHashtags);
    const storagePath = decodeStoragePathFromUrl(data.imageUrl);
    const themeKey = weekdayKeyForNowIst();
    const draftRef = admin.firestore().collection('marketing_drafts').doc();
    await draftRef.set({
        status: 'pending_review',
        kind: 'image',
        themeKey,
        themeLabel: 'Library Article',
        caption,
        headline: social.headline,
        assets: [{
                url: data.imageUrl,
                index: 0,
                template: 'libraryArticleHero',
                ...(storagePath ? { storagePath } : {}),
            }],
        platforms: ['instagram', 'facebook'],
        scheduledAt: null,
        postedAt: null,
        postPermalinks: {},
        publishError: null,
        safetyFlags: compliance.flags.map((f) => `${f.type}:${f.phrase}`),
        personaId: null,
        personaLabel: typeof data.audience === 'string' ? data.audience : null,
        pillarId: 'library_article',
        pillarLabel: 'Library Article',
        eventId: null,
        eventLabel: null,
        locale: brand.bilingual,
        headlineSource: 'article-summary',
        imagePrompt: null,
        imageSource: 'library-article',
        costInr: 0.05,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        generatedForDate: new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10),
        generatedBy: opts?.actorEmail ?? 'article-auto',
        approvedAt: null,
        approvedBy: null,
        rejectedAt: null,
        rejectedBy: null,
        rejectReason: null,
        schemaVersion: 2,
        sourceTool: 'library-article',
        sourceArticleId: ref.id,
        sourceArticleTitle: title,
        sourceArticleStatus: data.status ?? null,
    });
    await ref.set({
        marketingDraftLastId: draftRef.id,
        marketingDraftLastSentAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { ok: true, draftId: draftRef.id };
}
// ── Public entry ────────────────────────────────────────────────────────────
async function runArticleGenerator(input, actorEmail) {
    const settings = await (0, settings_1.loadLibraryAiSettings)();
    if (settings.paused) {
        return { ok: false, code: 'paused', message: 'Library AI is globally paused.' };
    }
    const k = settings.articles;
    const today = new Date(Date.now() + 5.5 * 3600 * 1000);
    const requestedAgeBucketKey = typeof input.ageBucketKey === 'string' ? input.ageBucketKey : null;
    const pickedAgeBucket = pickAgeBucket(k.ageBuckets, requestedAgeBucketKey, today);
    const topic = pickTopic(k.topics, typeof input.topic === 'string' ? input.topic : null, today, pickedAgeBucket);
    const inferredAgeBucket = requestedAgeBucketKey ? null : inferAgeBucketFromTopic(topic, k.ageBuckets);
    const ageBucket = inferredAgeBucket ?? pickedAgeBucket;
    const brand = await (0, brand_1.loadLibraryBrand)();
    const recent = await recentArticleTitles();
    const draft = await writeArticleBody(brand, topic, ageBucket, k.tone, recent);
    if (!draft) {
        return { ok: false, code: 'caption-failed', message: 'AI failed to produce an article body.' };
    }
    const preferred = ['openai', 'lora', 'imagen', 'dalle', 'flux', 'pexels', 'none'].includes(input.imageModel)
        ? input.imageModel
        : 'openai';
    // Compliance — body + title.
    const screen = `${draft.title}\n${draft.body}`;
    const { flags, disclaimers } = (0, brand_1.runCompliance)(screen, brand);
    // Append disclaimers to the body so they're visible to readers.
    let body = draft.body.trim();
    if (disclaimers.length > 0) {
        body = body + '\n\n' + disclaimers.join('\n');
    }
    // Decide publish vs draft. autoPublish=true unless caller forced 'draft'
    // OR there are unrecoverable forbidden-word flags.
    const explicit = input.publish === 'published' || input.publish === 'draft' ? input.publish : null;
    const finalStatus = decideArticleStatus(explicit, k.autoPublish, flags);
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
        imageUrl: null,
        audience: draft.audience ?? 'all',
        status: 'draft',
        source: 'ai',
        aiModel: 'gpt-4o-mini',
        aiTopic: topic,
        aiAgeBucketKey: ageBucket.key,
        aiImageSource: 'pending',
        aiImageStatus: 'pending',
        aiRequestedImageModel: preferred,
        aiPendingPublishStatus: finalStatus,
        aiImagePrompt: draft.imagePrompt,
        aiCostInr: 0.10,
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
            imageSource: 'pending',
            costInr: 0.10,
            status: 'draft',
            flags: flags.length,
            generatedBy: actorEmail ?? 'cron',
            ts: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (e) {
        console.warn('[library/articles] log row failed', e);
    }
    return {
        ok: true,
        articleId: docRef.id,
        title: draft.title,
        topic,
        ageBucketKey: ageBucket.key,
        imageUrl: null,
        imageSource: 'pending',
        status: 'draft',
        costInr: 0.10,
        imageStatus: 'pending',
        flags: flags.map((f) => ({ type: f.type, phrase: f.phrase })),
    };
}
function buildProcessPendingArticleImage() {
    return functions
        .runWith({ memory: '1GB', timeoutSeconds: 300 })
        .firestore.document('articles/{articleId}')
        .onCreate(async (snap) => {
        const data = snap.data();
        if (!data || data.source !== 'ai' || data.aiImageStatus !== 'pending' || typeof data.aiImagePrompt !== 'string') {
            return null;
        }
        await processArticleImageForDoc(snap.ref, data);
        return null;
    });
}
function buildRetryArticleImage(allowList) {
    return functions
        .runWith({ memory: '1GB', timeoutSeconds: 300 })
        .https.onCall(async (data, context) => {
        if (!(await (0, auth_1.callerIsContentAdmin)(context.auth?.token, allowList))) {
            throw new functions.https.HttpsError('permission-denied', 'Only content admins can retry article thumbnails.');
        }
        const articleId = typeof data?.articleId === 'string' ? data.articleId.trim() : '';
        if (!articleId)
            return { ok: false, code: 'missing-id', message: 'Provide an articleId.' };
        const ref = admin.firestore().collection('articles').doc(articleId);
        const snap = await ref.get();
        if (!snap.exists)
            return { ok: false, code: 'not-found', message: 'Article not found.' };
        const doc = snap.data();
        if (doc?.source !== 'ai')
            return { ok: false, code: 'not-ai', message: 'Only AI articles support thumbnail retry.' };
        await ref.update({
            aiImageStatus: 'pending',
            aiImageSource: 'pending',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const result = await processArticleImageForDoc(ref, { ...doc, aiImageStatus: 'pending' });
        return { ok: true, articleId, imageStatus: result };
    });
}
function buildSyncPublishedArticleToMarketingDraft() {
    return functions
        .runWith({ memory: '512MB', timeoutSeconds: 120 })
        .firestore.document('articles/{articleId}')
        .onWrite(async (change) => {
        const after = change.after.exists ? change.after.data() : null;
        if (!after)
            return null;
        const before = change.before.exists ? change.before.data() : null;
        const justWentLive = after.status === 'published' && before?.status !== 'published';
        if (!justWentLive)
            return null;
        try {
            await createMarketingDraftFromArticle(change.after.ref, after, { actorEmail: after.aiGeneratedBy ?? null });
        }
        catch (e) {
            console.warn('[library/articles] auto-send to marketing failed', e);
        }
        return null;
    });
}
function buildSendArticleToMarketingDraft(allowList) {
    return functions
        .runWith({ memory: '512MB', timeoutSeconds: 120 })
        .https.onCall(async (data, context) => {
        if (!(await (0, auth_1.callerIsContentAdmin)(context.auth?.token, allowList))) {
            throw new functions.https.HttpsError('permission-denied', 'Only content admins can send articles to Marketing Drafts.');
        }
        const articleId = typeof data?.articleId === 'string' ? data.articleId.trim() : '';
        if (!articleId)
            return { ok: false, code: 'missing-id', message: 'Provide an articleId.' };
        const ref = admin.firestore().collection('articles').doc(articleId);
        const snap = await ref.get();
        if (!snap.exists)
            return { ok: false, code: 'not-found', message: 'Article not found.' };
        const result = await createMarketingDraftFromArticle(ref, snap.data(), {
            actorEmail: context.auth?.token?.email ?? null,
            force: true,
        });
        return result.ok
            ? { ok: true, articleId, draftId: result.draftId }
            : result;
    });
}
// ── HTTPS callable wrapper ──────────────────────────────────────────────────
function buildGenerateArticleNow(allowList) {
    return functions
        .runWith({ memory: '1GB', timeoutSeconds: 300 })
        .https.onCall(async (data, context) => {
        if (!(await (0, auth_1.callerIsContentAdmin)(context.auth?.token, allowList))) {
            throw new functions.https.HttpsError('permission-denied', 'Only content admins can generate library articles.');
        }
        const actorEmail = context.auth?.token?.email ?? null;
        return runArticleGenerator(data ?? {}, actorEmail);
    });
}
