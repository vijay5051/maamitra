"use strict";
// Marketing draft generator (M2).
//
// Same internal flow used by:
//   - generateMarketingDraft (admin-callable, "Generate now" button)
//   - dailyMarketingDraftCron (pubsub schedule, 6am IST)
//
// Flow:
//   1. Read brand kit (palette, voice, personas, pillars, calendar, compliance).
//   2. Pick today's slot — caller-supplied persona/pillar/event override; else
//      auto-select from weekday theme + active cultural events.
//   3. Ask OpenAI gpt-4o-mini for {headline, body, hashtags, template,
//      imagePrompt} as JSON. System prompt embeds brand voice + persona +
//      pillar + event hint + compliance "do not say" list.
//   4. Run the rendered template (Imagen by default for cultural fidelity).
//   5. Run compliance scorer (regex against the brand's own ComplianceRules).
//   6. Auto-attach matched disclaimers to the caption tail.
//   7. Write marketing_drafts/{id} with status='pending_review'.
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
exports.runGenerator = runGenerator;
exports.buildGenerateMarketingDraft = buildGenerateMarketingDraft;
exports.buildRegenerateMarketingDraft = buildRegenerateMarketingDraft;
exports.buildScheduleMarketingDraft = buildScheduleMarketingDraft;
exports.buildUnscheduleMarketingDraft = buildUnscheduleMarketingDraft;
exports.buildDailyMarketingDraftCron = buildDailyMarketingDraftCron;
exports.buildGenerateAheadDrafts = buildGenerateAheadDrafts;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const imageSources_1 = require("./imageSources");
const renderer_1 = require("./renderer");
const integrationConfig_1 = require("../lib/integrationConfig");
const styleReferences_1 = require("./styleReferences");
const MAX_GENERATE_AHEAD_DAYS = 183;
const VETTED_INDIAN_PARENTING_PEXELS_IDS = [
    11527695, // mother holding child at Indian cultural event
    11527697, // mother holding child at Indian cultural event
    11439050, // toddler outdoors in Goa, India
    19205992, // mother and child walking in South Asian rural setting
];
// ── Caller auth ────────────────────────────────────────────────────────────
async function callerIsMarketingAdmin(token, allowList) {
    if (!token)
        return false;
    if (token.admin === true)
        return true;
    if (token.email_verified === true && token.email && allowList.has(token.email.toLowerCase()))
        return true;
    if (!token.uid)
        return false;
    try {
        const snap = await admin.firestore().doc(`users/${token.uid}`).get();
        const role = snap.exists ? snap.data()?.adminRole : null;
        return role === 'super' || role === 'content';
    }
    catch {
        return false;
    }
}
// Studio v2 defaults — kept identical to functions/src/marketing/studio.ts so
// the cron generator and the Studio canvas produce visually consistent
// drafts. Update both when tweaking the brand visual DNA.
const STYLE_DEFAULT_DESCRIPTION = 'A warm hand-drawn 2D illustration. Flat colours with subtle gradients, no photorealism. Indian characters (brown skin, dark hair). Soft pastels. Rounded organic shapes. Generous negative space. Single-scene composition.';
const STYLE_DEFAULT_KEYWORDS = 'flat illustration, pastel, Indian, motherhood, gentle, hand-drawn, soft gradient, organic shapes';
async function loadBrandKit() {
    const snap = await admin.firestore().doc('marketing_brand/main').get();
    const d = snap.exists ? snap.data() : {};
    const arr = (v) => (Array.isArray(v) ? v : []);
    return {
        brandName: typeof d?.brandName === 'string' ? d.brandName : 'MaaMitra',
        voice: {
            attributes: arr(d?.voice?.attributes),
            avoid: arr(d?.voice?.avoid),
            bilingual: typeof d?.voice?.bilingual === 'string' ? d.voice.bilingual : 'hinglish',
        },
        personas: arr(d?.personas).filter((p) => p?.enabled !== false),
        pillars: arr(d?.pillars).filter((p) => p?.enabled !== false),
        culturalCalendar: arr(d?.culturalCalendar),
        hashtags: arr(d?.hashtags),
        themeCalendar: d?.themeCalendar ?? {},
        automationSlots: Array.isArray(d?.automationSlots)
            ? d.automationSlots
                .map((slot, i) => ({
                id: typeof slot?.id === 'string' ? slot.id : `slot_${i}`,
                label: typeof slot?.label === 'string' ? slot.label : `Slot ${i + 1}`,
                time: typeof slot?.time === 'string' ? slot.time : (typeof d?.defaultPostTime === 'string' ? d.defaultPostTime : '09:00'),
                template: ['auto', 'tipCard', 'quoteCard', 'milestoneCard', 'realStoryCard'].includes(slot?.template)
                    ? slot.template
                    : 'auto',
                platforms: Array.isArray(slot?.platforms)
                    ? slot.platforms.filter((p) => p === 'instagram' || p === 'facebook')
                    : ['instagram', 'facebook'],
                enabled: slot?.enabled !== false,
                autoSchedule: slot?.autoSchedule === true,
            }))
                .slice(0, 8)
            : [{
                    id: 'morning_auto',
                    label: 'Morning post',
                    time: typeof d?.defaultPostTime === 'string' ? d.defaultPostTime : '09:00',
                    template: 'auto',
                    platforms: ['instagram', 'facebook'],
                    enabled: true,
                    autoSchedule: false,
                }],
        compliance: {
            medicalForbiddenWords: arr(d?.compliance?.medicalForbiddenWords),
            requiredDisclaimers: arr(d?.compliance?.requiredDisclaimers),
            blockedTopics: arr(d?.compliance?.blockedTopics),
        },
        costCaps: {
            dailyInr: typeof d?.costCaps?.dailyInr === 'number' ? d.costCaps.dailyInr : 200,
            monthlyInr: typeof d?.costCaps?.monthlyInr === 'number' ? d.costCaps.monthlyInr : 3000,
            alertAtPct: typeof d?.costCaps?.alertAtPct === 'number' ? d.costCaps.alertAtPct : 80,
        },
        palette: {
            primary: typeof d?.palette?.primary === 'string' ? d.palette.primary : '#E91E63',
            background: typeof d?.palette?.background === 'string' ? d.palette.background : '#FFF8F2',
            text: typeof d?.palette?.text === 'string' ? d.palette.text : '#1F1F2C',
            accent: typeof d?.palette?.accent === 'string' ? d.palette.accent : '#F8C8DC',
        },
        logoUrl: typeof d?.logoUrl === 'string' ? d.logoUrl : null,
        styleProfile: d?.styleProfile ? {
            description: typeof d.styleProfile.description === 'string' ? d.styleProfile.description : STYLE_DEFAULT_DESCRIPTION,
            artKeywords: typeof d.styleProfile.artKeywords === 'string' ? d.styleProfile.artKeywords : STYLE_DEFAULT_KEYWORDS,
            prohibited: arr(d.styleProfile.prohibited).filter((s) => typeof s === 'string'),
        } : null,
        templateDefaults: parseTemplateDefaults(d?.templateDefaults),
    };
}
function parseTemplateDefaults(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return {};
    const out = {};
    const templates = ['tipCard', 'quoteCard', 'milestoneCard', 'realStoryCard'];
    for (const t of templates) {
        const v = raw[t];
        if (!v || typeof v !== 'object')
            continue;
        const source = v.source;
        if (source !== 'none' && source !== 'stock' && source !== 'ai')
            continue;
        const entry = { source };
        if (typeof v.stockQuery === 'string' && v.stockQuery.trim())
            entry.stockQuery = v.stockQuery.trim().slice(0, 240);
        if (v.aiModel === 'imagen' || v.aiModel === 'dalle' || v.aiModel === 'flux')
            entry.aiModel = v.aiModel;
        if (typeof v.aiPrompt === 'string' && v.aiPrompt.trim())
            entry.aiPrompt = v.aiPrompt.trim().slice(0, 1200);
        out[t] = entry;
    }
    return out;
}
/** Wrap the LLM-supplied imagePrompt with the brand's visual DNA so daily
 *  cron drafts match Studio variants. Mirrors buildStudioPrompt in studio.ts;
 *  keep the structure aligned when tweaking either. */
function buildStyleLockedImagePrompt(subject, brand) {
    const profile = brand.styleProfile;
    const desc = profile?.description ?? STYLE_DEFAULT_DESCRIPTION;
    const keywords = profile?.artKeywords ?? STYLE_DEFAULT_KEYWORDS;
    const negative = profile?.prohibited?.length ? profile.prohibited.join(', ') : '';
    const parts = [
        `Visual style: ${desc}`,
        `Art direction keywords: ${keywords}.`,
        `Subject: ${subject.trim()}`,
    ];
    if (negative)
        parts.push(`Do NOT include: ${negative}.`);
    parts.push('Single coherent illustration with Indian-context subjects (Indian woman / Indian family / Indian home, warm soft natural light).', 'STRICT: no text, no letters, no words, no typography, no captions, no signage, no logos, no watermarks anywhere in the image — the image must contain ZERO readable characters.');
    return parts.join('\n');
}
// ── Slot picker ────────────────────────────────────────────────────────────
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
/** Convert any UTC Date to its IST representation.
 *  India is UTC+5:30 and has no DST — this shift is exact. */
function dateInIst(d) {
    const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
    return {
        weekdayKey: WEEKDAY_KEYS[ist.getUTCDay()],
        isoDate: ist.toISOString().slice(0, 10),
    };
}
function todayInIst() { return dateInIst(new Date()); }
/** Return the IST date for N days from now (N=1 = tomorrow IST). */
function istDateOffset(daysFromNow) {
    return dateInIst(new Date(Date.now() + daysFromNow * 24 * 3600 * 1000));
}
function hasCulturalEventOnIsoDate(events, isoDate) {
    if (!Array.isArray(events))
        return false;
    const md = isoDate.slice(5);
    return events.some((event) => {
        const date = typeof event?.date === 'string' ? event.date : '';
        if (!date)
            return false;
        return date === isoDate || date.slice(5) === md;
    });
}
/** Does a draft already exist for the given IST date? Checks pending_review,
 *  approved, scheduled, and posted statuses — all mean "cron should skip". */
async function draftExistsForKey(generatedForKey, statuses = ['pending_review', 'approved', 'scheduled', 'posted']) {
    try {
        const snap = await admin.firestore()
            .collection('marketing_drafts')
            .where('generatedForKey', '==', generatedForKey)
            .where('status', 'in', statuses)
            .limit(1)
            .get();
        return !snap.empty;
    }
    catch {
        // On any query error, proceed with generation rather than silently skipping.
        return false;
    }
}
function parseCronOverride(raw) {
    if (!raw || typeof raw !== 'object')
        return {};
    const out = {};
    if (raw.skip === true)
        out.skip = true;
    if (typeof raw.promptOverride === 'string')
        out.promptOverride = raw.promptOverride;
    if (typeof raw.personaId === 'string')
        out.personaId = raw.personaId;
    if (typeof raw.pillarId === 'string')
        out.pillarId = raw.pillarId;
    if (['auto', 'tipCard', 'quoteCard', 'milestoneCard', 'realStoryCard'].includes(raw.template))
        out.template = raw.template;
    return out;
}
function resolveSlotOverride(overrides, dateIso, slotId) {
    const raw = overrides?.[dateIso];
    if (!raw || typeof raw !== 'object')
        return {};
    const hasNested = 'default' in raw || 'slots' in raw;
    const dateOverride = hasNested ? parseCronOverride(raw.default) : parseCronOverride(raw);
    const slotOverride = hasNested && slotId ? parseCronOverride(raw.slots?.[slotId]) : {};
    return { ...dateOverride, ...slotOverride };
}
async function loadPerformanceStats() {
    const out = {
        byPillar: new Map(),
        byPillarTemplate: new Map(),
        topPrompts: [],
    };
    try {
        const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
        const snap = await admin.firestore()
            .collection('marketing_drafts')
            .where('status', '==', 'posted')
            .where('postedAt', '>=', cutoff)
            .limit(200)
            .get();
        const rows = [];
        for (const d of snap.docs) {
            const data = d.data();
            if (data?.isSynthetic === true)
                continue;
            const m = data?.latestInsights;
            if (!m || typeof m?.reach !== 'number' || m.reach <= 0)
                continue;
            const eng = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saved ?? 0);
            const rate = eng / m.reach;
            const pillar = typeof data?.pillarId === 'string' ? data.pillarId : 'unknown';
            const template = typeof data?.assets?.[0]?.template === 'string' ? data.assets[0].template : 'unknown';
            const prompt = typeof data?.imagePrompt === 'string' ? data.imagePrompt : '';
            rows.push({ pillar, template, rate, prompt });
        }
        // Aggregate by pillar
        for (const r of rows) {
            const cur = out.byPillar.get(r.pillar) ?? { posts: 0, avgRate: 0 };
            cur.posts += 1;
            cur.avgRate += r.rate;
            out.byPillar.set(r.pillar, cur);
        }
        out.byPillar.forEach((v) => { v.avgRate = v.posts ? v.avgRate / v.posts : 0; });
        // Aggregate by (pillar, template)
        for (const r of rows) {
            const inner = out.byPillarTemplate.get(r.pillar) ?? new Map();
            const cur = inner.get(r.template) ?? { posts: 0, avgRate: 0 };
            cur.posts += 1;
            cur.avgRate += r.rate;
            inner.set(r.template, cur);
            out.byPillarTemplate.set(r.pillar, inner);
        }
        out.byPillarTemplate.forEach((inner) => {
            inner.forEach((v) => { v.avgRate = v.posts ? v.avgRate / v.posts : 0; });
        });
        // Top 3 image prompts by rate (only if non-trivial reach)
        out.topPrompts = rows
            .filter((r) => r.prompt.length > 20)
            .sort((a, b) => b.rate - a.rate)
            .slice(0, 3)
            .map((r) => r.prompt);
    }
    catch (e) {
        console.warn('[loadPerformanceStats] failed', e);
    }
    return out;
}
/** Pillar weights — winners get up to 2× their share, losers down to 0.5×. */
function weightedPillarPick(pillars, stats) {
    if (pillars.length === 0)
        return null;
    // Need at least 5 datapoints overall to bias; otherwise even rotation.
    const totalPosts = Array.from(stats.byPillar.values()).reduce((a, v) => a + v.posts, 0);
    if (totalPosts < 5)
        return pillars[Math.floor(Math.random() * pillars.length)];
    const overallAvg = Array.from(stats.byPillar.values()).reduce((a, v) => a + v.avgRate * v.posts, 0) / Math.max(1, totalPosts);
    const weights = pillars.map((p) => {
        const stat = stats.byPillar.get(p.id);
        if (!stat || stat.posts < 2)
            return 1; // unseen / under-sampled → neutral
        const ratio = overallAvg > 0 ? stat.avgRate / overallAvg : 1;
        return Math.max(0.5, Math.min(2, ratio));
    });
    const total = weights.reduce((a, w) => a + w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pillars.length; i++) {
        r -= weights[i];
        if (r <= 0)
            return pillars[i];
    }
    return pillars[pillars.length - 1];
}
function pickSlot(brand, override, today, stats, promptOverride) {
    // Cultural event matching today's date — checks YYYY-MM-DD or YYYY-MM-DD
    // suffix of an event date (handles yearly events stored with a year).
    const todayMd = today.isoDate.slice(5); // "MM-DD"
    const event = brand.culturalCalendar.find((e) => {
        const overrideId = typeof override.eventId === 'string' ? override.eventId : '';
        if (overrideId && e.id === overrideId)
            return true;
        if (overrideId)
            return false;
        return e.date.slice(5) === todayMd || e.date === today.isoDate;
    }) ?? null;
    // Pillar — explicit override, else event's pillarHint, else
    // performance-weighted pick across enabled pillars.
    let pillar = null;
    const pillarOverride = typeof override.pillarId === 'string' ? override.pillarId : '';
    if (pillarOverride)
        pillar = brand.pillars.find((p) => p.id === pillarOverride) ?? null;
    if (!pillar && event?.pillarHint)
        pillar = brand.pillars.find((p) => p.id === event.pillarHint) ?? null;
    if (!pillar)
        pillar = weightedPillarPick(brand.pillars, stats);
    // Persona — explicit override, else round-robin by IST day-of-month over
    // enabled personas (so a 5-persona list rotates ~weekly).
    let persona = null;
    const personaOverride = typeof override.personaId === 'string' ? override.personaId : '';
    if (personaOverride)
        persona = brand.personas.find((p) => p.id === personaOverride) ?? null;
    if (!persona && brand.personas.length > 0) {
        const dayOfMonth = parseInt(today.isoDate.slice(8, 10), 10) || 1;
        persona = brand.personas[(dayOfMonth - 1) % brand.personas.length];
    }
    const theme = brand.themeCalendar[today.weekdayKey];
    return {
        persona,
        pillar,
        event,
        themeLabel: theme?.label ?? today.weekdayKey,
        themePrompt: theme?.prompt ?? '',
        promptOverride: typeof promptOverride === 'string' && promptOverride.trim() ? promptOverride.trim() : null,
        templateOverride: ['auto', 'tipCard', 'quoteCard', 'milestoneCard', 'realStoryCard'].includes(override.template)
            ? override.template
            : null,
    };
}
async function generateCaption(brand, slot, stats, forcedTemplate) {
    const cfg = await (0, integrationConfig_1.getIntegrationConfig)();
    if (!cfg.openai.apiKey)
        throw new Error('openai.apiKey not set — configure it in the Integration Hub');
    const localeInstruction = brand.voice.bilingual === 'english_only'
        ? 'Write in English only.'
        : brand.voice.bilingual === 'hinglish'
            ? 'Write in natural Hinglish — English with comfortable Hindi words mixed in (using Latin script). No literal translation.'
            : 'Write in English with occasional Devanagari accent words for emphasis.';
    const eventLine = slot.event
        ? `\nToday is ${slot.event.label}. Tone hint: ${slot.event.promptHint ?? 'respectful, on-theme'}.`
        : '';
    const personaLine = slot.persona
        ? `\nAudience persona: ${slot.persona.label} — ${slot.persona.description}`
        : '';
    const pillarLine = slot.pillar
        ? `\nContent pillar: ${slot.pillar.label} — ${slot.pillar.description}`
        : '';
    const themeLine = slot.themePrompt ? `\nWeekly theme (${slot.themeLabel}): ${slot.themePrompt}` : '';
    const overrideLine = slot.promptOverride ? `\nAdmin override for today: ${slot.promptOverride}` : '';
    // Feedback-loop hint — top-performing image prompts from the last 30d.
    // Empty until insights data exists; only adds 100-300 tokens when present.
    const inspirationLine = stats.topPrompts.length > 0
        ? `\n\nInspiration — these image prompts have performed well recently (use as STYLE reference, do NOT copy verbatim):\n${stats.topPrompts.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
        : '';
    // Pillar-template winning hint — if there's a clear winner template
    // for this pillar, suggest it.
    let templateHint = '';
    if (slot.pillar) {
        const inner = stats.byPillarTemplate.get(slot.pillar.id);
        if (inner && inner.size >= 2) {
            const winner = Array.from(inner.entries())
                .filter(([, v]) => v.posts >= 2)
                .sort((a, b) => b[1].avgRate - a[1].avgRate)[0];
            if (winner) {
                templateHint = `\nFor pillar "${slot.pillar.label}", recent winners use template "${winner[0]}". Lean toward it unless the content clearly fits a different one.`;
            }
        }
    }
    const forbidden = brand.compliance.medicalForbiddenWords.slice(0, 30).join(', ');
    const blockedTopics = brand.compliance.blockedTopics.slice(0, 20).join(', ');
    const system = [
        `You are the social-content writer for ${brand.brandName}, an Indian motherhood platform.`,
        `Brand voice: ${brand.voice.attributes.join(', ') || 'warm, honest, judgement-free'}.`,
        `Avoid these words/phrases entirely (medical / over-claim risk): ${forbidden || 'none'}.`,
        `Never write about: ${blockedTopics || 'none specified'}.`,
        localeInstruction,
        'Always respect Indian cultural context — clothing (sari/kurta), names, food, traditions. Default to inclusive / non-prescriptive language.',
        'Output STRICT JSON only. No prose outside the JSON object.',
    ].join('\n');
    const templateDirective = forcedTemplate
        ? [
            `MUST use template: "${forcedTemplate}" — do not pick another. The post is going into a slot pre-configured for this template.`,
            forcedTemplate === 'realStoryCard'
                ? 'Write a relatable first-person mini story (≤220 chars, MUST end with a period inside the limit — never leave a clause hanging mid-sentence) from the POV of an Indian mom, with a believable Indian name attribution like "Priya, Pune" or "Anjali, mom of 2". Do NOT preface with "I am ...".'
                : forcedTemplate === 'quoteCard'
                    ? 'Write a single short inspirational quote (≤200 chars) suited to Indian motherhood, with a short attribution.'
                    : forcedTemplate === 'milestoneCard'
                        ? 'Write 3-5 developmental milestones tied to a baby age (e.g. "0-3 months", "6 months").'
                        : 'Write 3-4 short practical tips on the topic.',
        ].join('\n')
        : [
            'Pick the most appropriate template:',
            '- "tipCard" — a numbered list of 3 short practical tips (use for advice / safety / how-to)',
            '- "quoteCard" — a single short quote with attribution (use for inspiration / wisdom / cultural)',
            '- "milestoneCard" — an age + bulleted developmental milestones list (use for milestones / development)',
            '- "realStoryCard" — a first-person mini story with attribution (use for relatable community moments)',
        ].join('\n');
    const user = [
        `Generate ONE Instagram-square post.`,
        eventLine,
        personaLine,
        pillarLine,
        themeLine,
        overrideLine,
        templateHint,
        inspirationLine,
        '',
        templateDirective,
        '',
        'Return JSON with exactly these keys:',
        '{',
        '  "headline": "≤80 chars, the on-image headline",',
        '  "body": "the IG caption body (3–6 sentences, no headline duplication, no hashtags, no disclaimers)",',
        '  "hashtags": ["array", "of", "5-10", "hashtags", "without # prefix"],',
        '  "template": "tipCard" | "quoteCard" | "milestoneCard" | "realStoryCard",',
        '  "imagePrompt": "specific prompt for an AI image generator — MUST describe Indian people (Indian woman / Indian mother / Indian family / Indian home), warm soft natural light, palette. Append the literal phrase: \\"no text, no letters, no typography, no signage anywhere in the image\\".",',
        '  "templateProps": { /* per-template fields */ }',
        '}',
        '',
        'templateProps shape per template:',
        '  tipCard:        { eyebrow: string (≤30c), title: string (≤80c), tips: string[3-4] (each ≤120c) }',
        '  quoteCard:      { quote: string (≤200c), attribution: string (≤40c) }',
        '  milestoneCard:  { age: string (≤20c), title: string (≤60c), milestones: string[3-5] (each ≤120c) }',
        '  realStoryCard:  { eyebrow: string (≤30c), story: string (≤220c), attribution: string (≤40c) }',
    ].join('\n');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${cfg.openai.apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.85,
            max_tokens: 800,
        }),
    });
    if (!res.ok) {
        throw new Error(`OpenAI caption generation failed (${res.status}): ${await res.text()}`);
    }
    const data = (await res.json());
    const raw = data?.choices?.[0]?.message?.content ?? '';
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (e) {
        throw new Error(`OpenAI returned non-JSON content: ${raw.slice(0, 200)}…`);
    }
    const template = forcedTemplate
        ? forcedTemplate
        : ['tipCard', 'quoteCard', 'milestoneCard', 'realStoryCard'].includes(parsed?.template)
            ? parsed.template
            : 'tipCard';
    return {
        headline: trim(parsed?.headline, 80),
        body: trim(parsed?.body, 1800),
        hashtags: Array.isArray(parsed?.hashtags)
            ? parsed.hashtags
                .map((h) => (typeof h === 'string' ? h.trim().replace(/^#/, '') : ''))
                .filter(Boolean)
                .slice(0, 12)
            : [],
        template,
        imagePrompt: trim(parsed?.imagePrompt, 600),
        templateProps: typeof parsed?.templateProps === 'object' && parsed?.templateProps ? parsed.templateProps : {},
    };
}
function trim(v, max) {
    return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
function trimStory(v, max) {
    if (typeof v !== 'string')
        return '';
    const cleaned = v.trim().replace(/\s+/g, ' ');
    if (cleaned.length <= max)
        return cleaned;
    const window = cleaned.slice(0, max);
    const sentenceEnd = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '));
    if (sentenceEnd > Math.floor(max * 0.5)) {
        return cleaned.slice(0, sentenceEnd + 1).trim();
    }
    return window.replace(/[\s,;:]+\S*$/, '').trim() + '…';
}
function stripUndefinedDeep(value) {
    if (value &&
        typeof value === 'object' &&
        value.constructor &&
        value.constructor.name === 'FieldValue') {
        return value;
    }
    if (Array.isArray(value)) {
        return value
            .map((item) => stripUndefinedDeep(item))
            .filter((item) => item !== undefined);
    }
    if (value && typeof value === 'object') {
        const out = {};
        for (const [key, item] of Object.entries(value)) {
            if (item === undefined)
                continue;
            out[key] = stripUndefinedDeep(item);
        }
        return out;
    }
    return value;
}
function sanitizeCaptionTemplateProps(template, props) {
    switch (template) {
        case 'tipCard':
            return {
                eyebrow: trim(props.eyebrow, 30),
                title: trim(props.title, 80),
                tips: Array.isArray(props.tips) ? props.tips.map((x) => trim(x, 120)).filter(Boolean).slice(0, 4) : [],
            };
        case 'quoteCard':
            return {
                quote: trim(props.quote, 200),
                attribution: trim(props.attribution, 40),
            };
        case 'milestoneCard':
            return {
                age: trim(props.age, 20),
                title: trim(props.title, 60),
                milestones: Array.isArray(props.milestones) ? props.milestones.map((x) => trim(x, 120)).filter(Boolean).slice(0, 5) : [],
            };
        case 'realStoryCard':
            return {
                eyebrow: trim(props.eyebrow, 30),
                story: trimStory(props.story, 220),
                attribution: trim(props.attribution, 40),
            };
    }
}
function titleCase(s) {
    return s
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
        .join(' ');
}
function firstSentence(input, max = 120) {
    const cleaned = input.replace(/\s+/g, ' ').trim();
    if (!cleaned)
        return '';
    const slice = cleaned.slice(0, max);
    const stop = Math.max(slice.indexOf('. '), slice.indexOf('! '), slice.indexOf('? '));
    return (stop > 0 ? slice.slice(0, stop + 1) : slice).trim();
}
function ageLabelFromHint(hint) {
    const m = hint.match(/\b(\d+\s*[-–]?\s*\d*\s*(?:month|months|week|weeks|year|years))\b/i);
    if (!m)
        return 'Baby milestones';
    return m[1].replace(/\s+/g, ' ').trim();
}
function milestonePointsFromHint(hint, englishOnly) {
    const lower = hint.toLowerCase();
    const points = [];
    if (lower.includes('sitting'))
        points.push('Sits with support and holds their head steady.');
    if (lower.includes('reaching'))
        points.push('Reaches for nearby toys or familiar objects.');
    if (lower.includes('babbling'))
        points.push('Babbles with playful vowel and consonant sounds.');
    if (lower.includes('recognizing familiar faces'))
        points.push('Recognizes familiar faces and responds warmly.');
    if (points.length >= 2)
        return points.slice(0, 4);
    return englishOnly
        ? [
            'Shows growing control while sitting with support.',
            'Reaches for toys and explores with hands and eyes.',
            'Babbles more often and reacts to familiar voices.',
        ]
        : [
            'Support ke saath baithne ki control dheere dheere better hoti hai.',
            'Khilonon tak haath badhata hai aur curiosity dikhata hai.',
            'Awazon par react karta hai aur zyada babble karta hai.',
        ];
}
function fallbackCaption(brand, slot, forcedTemplate) {
    const pillar = slot.pillar?.label || 'Parenting';
    const persona = slot.persona?.label || 'Indian moms';
    const hint = slot.promptOverride || slot.event?.promptHint || slot.themePrompt || slot.pillar?.description || pillar;
    const topic = titleCase((slot.event?.label || pillar).replace(/[^\w\s&-]/g, '').slice(0, 42)) || 'Parenting Moment';
    const englishOnly = brand.voice.bilingual === 'english_only';
    const body = englishOnly
        ? `A gentle reminder for ${persona.toLowerCase()}: small, practical moments matter. ${hint} Keep it simple, stay present, and choose what works for your family today.`
        : `A gentle reminder for ${persona.toLowerCase()}: chhote, practical moments matter. ${hint} Simple rakho, present raho, aur aaj apni family ke liye jo workable hai wahi choose karo.`;
    const baseTags = [
        'MaaMitra',
        'IndianMoms',
        'Parenting',
        pillar.replace(/[^A-Za-z0-9]/g, ''),
        'Motherhood',
        'BabyCare',
    ].filter(Boolean);
    if (forcedTemplate === 'milestoneCard') {
        const age = ageLabelFromHint(hint);
        const milestones = milestonePointsFromHint(hint, englishOnly);
        return {
            headline: `${titleCase(age)} Milestones`.slice(0, 80),
            body: (englishOnly
                ? `A quick look at what many babies may start showing around ${age.toLowerCase()}. Every child develops at their own pace.`
                : `${age} ke around kai babies yeh chhote developmental signs dikhana shuru karte hain. Har bachcha apni pace par grow karta hai.`).slice(0, 1800),
            hashtags: Array.from(new Set(baseTags)).slice(0, 8),
            template: 'milestoneCard',
            imagePrompt: `Warm MaaMitra illustration of an Indian mother or parents with baby around ${age}, developmental milestone moment at home.`.slice(0, 600),
            templateProps: {
                age: titleCase(age).slice(0, 20),
                title: 'Milestones To Look For',
                milestones,
            },
        };
    }
    if (forcedTemplate === 'realStoryCard') {
        const story = englishOnly
            ? `I still pause for these quiet little moments with my baby. In the middle of an ordinary day, one small smile can make everything feel lighter and remind me that we are learning together.`
            : `Main aaj bhi apne baby ke saath in chhote, shaant moments ke liye ruk jaati hoon. Din kitna bhi busy ho, ek si muskaan sab halka kar deti hai aur yaad dilati hai ki hum saath saath seekh rahe hain.`;
        return {
            headline: topic.slice(0, 80),
            body: firstSentence(story, 1800),
            hashtags: Array.from(new Set(baseTags)).slice(0, 8),
            template: 'realStoryCard',
            imagePrompt: `Warm MaaMitra illustration of an Indian mother with her baby in a tender everyday parenting moment at home.`.slice(0, 600),
            templateProps: {
                eyebrow: 'INSPIRED STORY',
                story: trimStory(story, 220),
                attribution: 'A MaaMitra mom',
            },
        };
    }
    if (forcedTemplate === 'quoteCard') {
        const quote = englishOnly
            ? 'Small everyday moments often become the strongest memories of parenthood.'
            : 'Parenting ki sabse gehri yaadein aksar roz ke chhote moments se banti hain.';
        return {
            headline: topic.slice(0, 80),
            body: quote,
            hashtags: Array.from(new Set(baseTags)).slice(0, 8),
            template: 'quoteCard',
            imagePrompt: `Warm MaaMitra illustration with Indian family context and generous negative space for a quote overlay.`.slice(0, 600),
            templateProps: {
                quote,
                attribution: 'MaaMitra',
            },
        };
    }
    return {
        headline: topic.slice(0, 80),
        body: body.slice(0, 1800),
        hashtags: Array.from(new Set(baseTags)).slice(0, 8),
        template: 'tipCard',
        imagePrompt: `Warm MaaMitra illustration for ${pillar}: ${hint}`.slice(0, 600),
        templateProps: {
            eyebrow: slot.themeLabel || 'MaaMitra',
            title: topic.slice(0, 80),
            tips: englishOnly
                ? [
                    'Pause and notice what your child needs right now.',
                    'Keep the next step small, calm, and doable.',
                    'Trust your judgement and ask for help when needed.',
                ]
                : [
                    'Pause karke dekho bachche ko abhi kya chahiye.',
                    'Next step small, calm aur doable rakho.',
                    'Apne judgement par trust karo, help maangna bhi okay hai.',
                ],
        },
    };
}
// Returns true if the AI-supplied templateProps actually has the fields the
// chosen template renderer reads. If false, we downgrade to tipCard rather
// than rendering "undefined" into the image.
function templatePropsValid(template, props) {
    if (!props || typeof props !== 'object')
        return false;
    const str = (v) => typeof v === 'string' && v.trim().length > 0;
    const arr = (v, min) => Array.isArray(v) && v.length >= min && v.every((x) => str(x));
    switch (template) {
        case 'tipCard':
            return str(props.title) && arr(props.tips, 2);
        case 'quoteCard':
            return str(props.quote) && str(props.attribution);
        case 'milestoneCard':
            return str(props.title) && arr(props.milestones, 2);
        case 'realStoryCard':
            return str(props.story) && str(props.attribution);
        default:
            return false;
    }
}
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function findPhrase(haystack, phrase) {
    if (!phrase)
        return false;
    const isWord = /^\w+$/.test(phrase);
    const re = isWord
        ? new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'i')
        : new RegExp(escapeRegex(phrase), 'i');
    return re.test(haystack);
}
function runCompliance(text, brand) {
    const flags = [];
    for (const word of brand.compliance.medicalForbiddenWords) {
        if (findPhrase(text, word.toLowerCase()))
            flags.push({ type: 'forbidden_word', phrase: word });
    }
    for (const topic of brand.compliance.blockedTopics) {
        if (findPhrase(text, topic.toLowerCase()))
            flags.push({ type: 'blocked_topic', phrase: topic });
    }
    const disclaimers = Array.from(new Set(brand.compliance.requiredDisclaimers
        .filter((d) => d?.trigger && d?.text && findPhrase(text, String(d.trigger).toLowerCase()))
        .map((d) => String(d.text))));
    return { flags, disclaimers };
}
// ── Image rendering ────────────────────────────────────────────────────────
async function renderDraftImage(template, templateProps, imagePrompt, imageModel, brand, opts) {
    // Locked source override from Settings → Template Preview. When admin saves
    // `source: 'stock'`, skip AI generation entirely and go straight to Pexels.
    // When `source: 'none'`, render on the brand-colour panel only (no photo).
    const lockedDefault = brand.templateDefaults[template];
    const lockedSource = template === 'tipCard' ? 'none' : (lockedDefault?.source ?? 'ai');
    // For AI providers, wrap the LLM-supplied subject prompt in the brand's
    // style preamble so cron-generated images share the Studio look. Pexels
    // is keyword-search, so it gets the raw subject prompt only.
    let imageSource = template === 'tipCard' ? 'none' : (lockedSource === 'ai' ? imageModel : lockedSource);
    const styleLockedPrompt = buildStyleLockedImagePrompt(imagePrompt, brand);
    let bgUrl = null;
    if (lockedSource === 'ai' && template !== 'tipCard') {
        bgUrl = imageModel === 'imagen'
            ? await (0, imageSources_1.imagenGenerate)(styleLockedPrompt, { aspectRatio: '1:1' })
            : imageModel === 'dalle'
                ? await (0, styleReferences_1.openaiMaaMitraReferenceImage)(styleLockedPrompt, {
                    preset: 'post',
                    quality: 'medium',
                    size: '1024x1024',
                    maxRefs: 6,
                    timeoutMs: 90000,
                    fallbackToGeneration: false,
                    extraLines: [
                        'Treat the supplied MaaMitra mosaic reference as the master house-style anchor for this post image, with the other supplied illustrations reinforcing the same family.',
                        'These post visuals must stay inside the real MaaMitra illustration family from assets/illustrations, not drift into generic editorial, watercolor, or stock-illustration styles.',
                        'The supplied MaaMitra references should dominate palette, face design, negative space, and wardrobe language.',
                    ],
                })
                : await (0, imageSources_1.fluxSchnell)(styleLockedPrompt, { aspectRatio: '1:1' });
        if (!bgUrl && imageModel === 'dalle') {
            bgUrl = await (0, imageSources_1.imagenGenerate)(styleLockedPrompt, { aspectRatio: '1:1' });
            if (bgUrl)
                imageSource = 'imagen';
        }
    }
    // Pexels path — use a frozen MaaMitra-safe query set. Do not feed the
    // free-form AI image prompt into Pexels; broad prompts have returned
    // animals/objects for parenting templates.
    let imageAttribution = null;
    let sourcePhotoId = null;
    let sourceImageUrl = null;
    let resolvedBg = bgUrl;
    if (resolvedBg)
        sourceImageUrl = resolvedBg;
    if (!resolvedBg && template !== 'tipCard' && lockedSource !== 'none') {
        const queries = stockQueriesForTemplate(template, templateProps, lockedSource === 'stock' ? lockedDefault?.stockQuery : undefined);
        let stock = null;
        for (const query of queries) {
            stock = await (0, imageSources_1.pexelsSearch)(query, {
                avoidPhotoIds: opts?.avoidPexelsPhotoIds,
                perPage: 80,
                maxPageAttempts: 12,
                requireHumanAlt: true,
                allowPhotoIds: VETTED_INDIAN_PARENTING_PEXELS_IDS,
            });
            if (stock)
                break;
        }
        if (stock) {
            resolvedBg = stock.url;
            imageAttribution = stock.attribution;
            sourcePhotoId = stock.id;
            sourceImageUrl = stock.url;
            imageSource = 'pexels';
        }
        else {
            const fallbackPrompt = buildStyleLockedImagePrompt(stockFallbackImagePrompt(template, templateProps), brand);
            const imagenFallback = await (0, imageSources_1.imagenGenerate)(fallbackPrompt, { aspectRatio: '1:1' });
            if (imagenFallback) {
                resolvedBg = imagenFallback;
                sourceImageUrl = imagenFallback;
                imageSource = 'imagen';
            }
            else {
                const openAiFallback = await (0, styleReferences_1.openaiMaaMitraReferenceImage)(fallbackPrompt, {
                    preset: 'post',
                    quality: 'medium',
                    size: '1024x1024',
                    maxRefs: 6,
                    timeoutMs: 90000,
                    fallbackToGeneration: true,
                    extraLines: [
                        'Use this only because no relevant curated Pexels photo was available and Imagen also returned no image.',
                        'The image must show Indian-context parenting: Indian mother/father/parents with baby or child, warm real family moment.',
                        'Do NOT show animals, objects-only still life, shoes, toys-only compositions, text, signage, logos, watermarks, temples, idols, or statues.',
                    ],
                });
                if (openAiFallback) {
                    resolvedBg = openAiFallback;
                    sourceImageUrl = openAiFallback;
                    imageSource = 'dalle';
                }
                else {
                    imageSource = 'none';
                }
            }
        }
    }
    const propsForRender = { ...templateProps };
    if (resolvedBg?.startsWith('data:')) {
        resolvedBg = await persistRenderSourceImage(resolvedBg, template);
        sourceImageUrl = resolvedBg;
    }
    if (resolvedBg) {
        if (template === 'quoteCard')
            propsForRender.backgroundUrl = resolvedBg;
        if (template === 'milestoneCard' || template === 'realStoryCard')
            propsForRender.photoUrl = resolvedBg;
    }
    const brandSnap = {
        brandName: brand.brandName,
        logoUrl: brand.logoUrl,
        palette: brand.palette,
    };
    const result = await (0, renderer_1.renderTemplate)(template, propsForRender, brandSnap, { width: 1080, height: 1080 });
    // Upload to Storage at marketing/drafts/{ts}-{template}.png
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const storagePath = `marketing/drafts/${timestamp}-${template}.png`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    await file.save(result.png, {
        contentType: 'image/png',
        metadata: {
            metadata: {
                template,
                source: imageSource,
                attribution: imageAttribution ?? '',
                sourcePhotoId: sourcePhotoId ? String(sourcePhotoId) : '',
                sourceImageUrl: sourceImageUrl ?? '',
            },
        },
    });
    await file.makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    // Cost log row — same shape as renderMarketingTemplate
    const costInr = imageSourceCostInr(imageSource);
    try {
        await admin.firestore().collection('marketing_cost_log').add({
            ts: admin.firestore.FieldValue.serverTimestamp(),
            template,
            imageSource,
            sourcePhotoId,
            costInr,
            bytes: result.png.length,
            actor: 'generator',
        });
    }
    catch (e) {
        console.warn('[generator] cost log write failed (non-fatal)', e);
    }
    return {
        url,
        storagePath,
        bytes: result.png.length,
        source: imageSource,
        costInr,
        sourcePhotoId,
        sourceImageUrl,
        imageAttribution,
    };
}
function stockQueriesForTemplate(template, templateProps, lockedQuery) {
    const maaMitraFamilyQueries = [
        'Indian mother baby',
        'Indian mother child',
        'Indian parents child',
        'Indian family baby',
        'Indian parent toddler',
    ];
    if (template === 'milestoneCard') {
        const age = typeof templateProps.age === 'string' ? templateProps.age : '';
        return [
            ['Indian baby mother developmental milestone', age].filter(Boolean).join(' '),
            'Indian infant mother',
            'Indian mother baby',
            'Indian parents baby',
            'Indian family baby',
        ].map((q) => q.slice(0, 100));
    }
    if (template === 'realStoryCard') {
        return [
            'Indian mother baby family home',
            'Indian mother child home',
            'Indian parents child home',
            'Indian family baby home',
        ];
    }
    // Even quote/background cards stay inside the same parenting-photo pool.
    // Admin locked queries are allowed only when they still name Indian family
    // context; otherwise we ignore them instead of drifting to random stock.
    const cleanedLockedQuery = lockedQuery?.trim();
    const lockedIsFamily = !!cleanedLockedQuery &&
        /\bindian\b/i.test(cleanedLockedQuery) &&
        /\b(mother|mom|parent|family|baby|child|kid|toddler|infant)\b/i.test(cleanedLockedQuery);
    return lockedIsFamily
        ? [cleanedLockedQuery.slice(0, 100), ...maaMitraFamilyQueries]
        : maaMitraFamilyQueries;
}
function stockFallbackImagePrompt(template, templateProps) {
    if (template === 'milestoneCard') {
        const age = typeof templateProps.age === 'string' ? templateProps.age : 'baby';
        return `Indian mother or Indian parents with a ${age} baby, warm home setting, developmental milestone moment, natural light, no text.`;
    }
    if (template === 'realStoryCard') {
        return 'Indian mother with baby or child in a warm home setting, emotional family moment, natural light, no text.';
    }
    if (template === 'quoteCard') {
        return 'Indian parents with baby or child, warm family moment, soft natural light, generous space for overlaid quote, no text.';
    }
    return 'Indian mother with child, warm parenting moment, natural light, no text.';
}
function imageSourceCostInr(source) {
    switch (source) {
        case 'imagen': return 3.30;
        case 'dalle': return 3.50;
        case 'flux': return 0.25;
        default: return 0;
    }
}
async function persistRenderSourceImage(urlOrData, template) {
    if (!urlOrData.startsWith('data:'))
        return urlOrData;
    const match = urlOrData.match(/^data:([^;]+);base64,(.+)$/);
    if (!match)
        throw new Error('invalid-source-data-url');
    const contentType = match[1] || 'image/png';
    const ext = contentType.includes('webp') ? 'webp' : contentType.includes('jpeg') ? 'jpg' : 'png';
    const buf = Buffer.from(match[2], 'base64');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const storagePath = `marketing/render-sources/${timestamp}-${template}.${ext}`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    await file.save(buf, {
        contentType,
        metadata: { metadata: { source: 'generator', template } },
    });
    await file.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}
async function loadUsedPexelsPhotoIds() {
    try {
        const ids = new Set();
        const collect = (data) => {
            const topLevel = Number(data?.sourcePhotoId);
            if (Number.isFinite(topLevel) && topLevel > 0)
                ids.add(topLevel);
            const assets = Array.isArray(data?.assets) ? data.assets : [];
            for (const asset of assets) {
                const assetId = Number(asset?.sourcePhotoId);
                if (Number.isFinite(assetId) && assetId > 0)
                    ids.add(assetId);
            }
        };
        const db = admin.firestore();
        let last = null;
        for (;;) {
            let q = db.collection('marketing_drafts')
                .orderBy('generatedAt', 'desc')
                .limit(500);
            if (last)
                q = q.startAfter(last);
            const snap = await q.get();
            if (snap.empty)
                break;
            snap.forEach((docSnap) => collect(docSnap.data()));
            last = snap.docs[snap.docs.length - 1] ?? null;
            if (snap.size < 500 || !last)
                break;
        }
        return Array.from(ids);
    }
    catch (e) {
        console.warn('[generator] used Pexels photo lookup failed (non-fatal)', e);
        return [];
    }
}
function parsePlatforms(input) {
    const out = Array.isArray(input)
        ? input.filter((p) => p === 'instagram' || p === 'facebook')
        : [];
    return out.length ? Array.from(new Set(out)).slice(0, 2) : ['instagram', 'facebook'];
}
function inferTemplateFromDraft(data) {
    const pillarId = typeof data?.pillarId === 'string' ? data.pillarId.toLowerCase() : '';
    const pillarLabel = typeof data?.pillarLabel === 'string' ? data.pillarLabel.toLowerCase() : '';
    if (pillarId.includes('milestone') ||
        pillarId.includes('development') ||
        pillarLabel.includes('milestone') ||
        pillarLabel.includes('development')) {
        return 'milestoneCard';
    }
    const assetTemplate = data?.assets?.[0]?.template;
    if (['tipCard', 'quoteCard', 'milestoneCard', 'realStoryCard'].includes(assetTemplate)) {
        return assetTemplate;
    }
    const props = data?.templateProps && typeof data.templateProps === 'object' ? data.templateProps : {};
    if (typeof props.quote === 'string')
        return 'quoteCard';
    if (Array.isArray(props.milestones))
        return 'milestoneCard';
    if (typeof props.story === 'string')
        return 'realStoryCard';
    if (Array.isArray(props.tips) || typeof props.title === 'string')
        return 'tipCard';
    return null;
}
function istDateAndTimeFromIso(iso) {
    if (typeof iso !== 'string' || !iso)
        return null;
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime()))
        return null;
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
    return {
        dateIso: `${get('year')}-${get('month')}-${get('day')}`,
        time: `${get('hour')}:${get('minute')}`,
    };
}
function regeneratePromptOverride(template, data) {
    const props = JSON.stringify(data?.templateProps ?? {}).slice(0, 900);
    const headline = typeof data?.headline === 'string' ? data.headline : '';
    const base = [
        'Regenerate this existing draft as a clearly different creative, but preserve the same template and content type.',
        headline ? `Original headline: ${headline}` : '',
        props ? `Original template props: ${props}` : '',
    ].filter(Boolean);
    if (template === 'milestoneCard') {
        base.push('This MUST be a milestone/development card, not a personal story.', 'Write objective milestone copy: age range, short title, and concise developmental milestone bullets.', 'Do not write first-person narration, contributor names, family memory copy, nostalgia story copy, or Inspired Story wording.');
    }
    else if (template === 'quoteCard') {
        base.push('This MUST be a quote card: one concise quote plus attribution.', 'Do not write a first-person story, milestone bullets, or Inspired Story wording.');
    }
    else if (template === 'realStoryCard') {
        base.push('This MUST be an Inspired Story style first-person mini story with attribution.');
    }
    else {
        base.push('This MUST be a practical tip/list card with short actionable tips.');
    }
    return base.join(' ');
}
function scheduleIsoForSlot(dateIso, slotTime) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso))
        return null;
    if (!/^[0-2]\d:[0-5]\d$/.test(slotTime))
        return null;
    const d = new Date(`${dateIso}T${slotTime}:00+05:30`);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}
// ── Caption assembly (body + hashtags + disclaimers) ───────────────────────
function assembleCaption(body, hashtags, disclaimers, extraHashtags) {
    const allTags = Array.from(new Set([...hashtags, ...extraHashtags.map((h) => h.replace(/^#/, ''))])).slice(0, 15);
    const tagLine = allTags.length ? '\n\n' + allTags.map((h) => `#${h}`).join(' ') : '';
    const disclaimerBlock = disclaimers.length ? '\n\n' + disclaimers.join('\n') : '';
    return (body + disclaimerBlock + tagLine).slice(0, 2200);
}
// ── Public entry: draft generation ─────────────────────────────────────────
async function runGenerator(input, actorEmail) {
    let brand;
    try {
        brand = await loadBrandKit();
    }
    catch (e) {
        return { ok: false, code: 'brand-load-failed', message: e?.message ?? String(e) };
    }
    if (brand.personas.length === 0 || brand.pillars.length === 0) {
        return { ok: false, code: 'strategy-incomplete', message: 'Add at least one enabled persona and pillar in /admin/marketing/strategy first.' };
    }
    // Resolve target IST date — explicit forDateIso wins, else today.
    const rawForDate = typeof input.forDateIso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.forDateIso)
        ? input.forDateIso
        : null;
    const today = rawForDate
        ? { weekdayKey: WEEKDAY_KEYS[new Date(rawForDate + 'T05:30:00Z').getUTCDay()], isoDate: rawForDate }
        : todayInIst();
    // Merge any caller-supplied promptOverride (can come from cronOverrides or
    // from the manual Generate form).
    const promptOverrideMerged = typeof input.promptOverride === 'string' && input.promptOverride.trim()
        ? input.promptOverride.trim()
        : null;
    const stats = await loadPerformanceStats();
    const slot = pickSlot(brand, input, today, stats, promptOverrideMerged);
    // Resolve the forced template BEFORE generating the caption so the AI is
    // told exactly which shape to write — otherwise it free-picks tipCard and
    // leaves story/attribution undefined when the slot wants realStoryCard.
    const inputTemplate = ['tipCard', 'quoteCard', 'milestoneCard', 'realStoryCard'].includes(input.template)
        ? input.template
        : null;
    const forcedTemplate = inputTemplate ?? (slot.templateOverride && slot.templateOverride !== 'auto' ? slot.templateOverride : null);
    let captionOut;
    try {
        captionOut = await generateCaption(brand, slot, stats, forcedTemplate ?? undefined);
    }
    catch (e) {
        console.warn('[generator] caption AI failed, using local fallback', e?.message ?? e);
        captionOut = fallbackCaption(brand, slot, forcedTemplate ?? undefined);
    }
    // Guard: if the AI returned the forced template name but didn't include
    // the props the renderer needs (e.g. realStoryCard without story /
    // attribution), downgrade to tipCard with safe content so we never bake
    // the literal word "undefined" into a published image.
    const requestedTemplate = forcedTemplate ?? captionOut.template;
    captionOut = {
        ...captionOut,
        templateProps: sanitizeCaptionTemplateProps(requestedTemplate, captionOut.templateProps),
    };
    if (!templatePropsValid(requestedTemplate, captionOut.templateProps)) {
        console.warn(`[generator] templateProps invalid for ${requestedTemplate}; using same-template fallback`, { keys: Object.keys(captionOut.templateProps || {}) });
        const safe = fallbackCaption(brand, slot, requestedTemplate);
        captionOut = {
            ...captionOut,
            template: requestedTemplate,
            templateProps: safe.templateProps,
            imagePrompt: captionOut.imagePrompt || safe.imagePrompt,
            // Keep the AI body/headline if they exist; only swap props.
            headline: captionOut.headline || safe.headline,
            body: captionOut.body || safe.body,
        };
    }
    // Resolve image model + prompt with the saved per-template default as the
    // tier between "explicit caller input" and "flux fallback". Auto-Post
    // (cron) never passes input.imageModel, so the saved default is what
    // actually drives the visual style for automated drafts.
    const lockedDefault = brand.templateDefaults[requestedTemplate];
    const requestedModel = ['imagen', 'dalle', 'flux'].includes(input.imageModel)
        ? input.imageModel
        : (lockedDefault?.aiModel ?? 'flux');
    // If the locked default has a seed prompt and the caption AI didn't write a
    // specific image prompt, fall back to the seed.
    if (lockedDefault?.aiPrompt && (!captionOut.imagePrompt || captionOut.imagePrompt.length < 12)) {
        captionOut = { ...captionOut, imagePrompt: lockedDefault.aiPrompt };
    }
    const slotId = typeof input.slotId === 'string' && input.slotId.trim() ? input.slotId.trim() : 'default';
    const slotLabel = typeof input.slotLabel === 'string' && input.slotLabel.trim() ? input.slotLabel.trim() : 'Daily slot';
    const slotTime = typeof input.slotTime === 'string' && /^[0-2]\d:[0-5]\d$/.test(input.slotTime) ? input.slotTime : null;
    const autoSchedule = input.autoSchedule === true;
    const scheduledAt = autoSchedule && slotTime ? scheduleIsoForSlot(today.isoDate, slotTime) : null;
    const generatedForKey = `${today.isoDate}:${slotId}`;
    const platforms = parsePlatforms(input.slotPlatforms);
    let render;
    try {
        const usedPexelsPhotoIds = await loadUsedPexelsPhotoIds();
        render = await renderDraftImage(requestedTemplate, captionOut.templateProps, captionOut.imagePrompt, requestedModel, brand, { avoidPexelsPhotoIds: usedPexelsPhotoIds });
    }
    catch (e) {
        return { ok: false, code: 'render-failed', message: e?.message ?? String(e) };
    }
    // Compliance screen — run on body + headline (hashtags / disclaimers excluded
    // since we're about to add disclaimers ourselves).
    const screenText = `${captionOut.headline}\n${captionOut.body}`;
    const { flags, disclaimers } = runCompliance(screenText, brand);
    const caption = assembleCaption(captionOut.body, captionOut.hashtags, disclaimers, brand.hashtags);
    // Caption AI cost — gpt-4o-mini ~₹0.02/draft. Round-up generously.
    const captionCost = 0.05;
    const totalCost = render.costInr + captionCost;
    // Write the draft.
    const draftRef = admin.firestore().collection('marketing_drafts').doc();
    const draft = {
        status: scheduledAt ? 'scheduled' : 'pending_review',
        kind: 'image',
        themeKey: today.weekdayKey,
        themeLabel: slot.themeLabel,
        slotId,
        slotLabel,
        slotTime,
        caption,
        headline: captionOut.headline,
        templateProps: captionOut.templateProps,
        assets: [{
                url: render.url,
                index: 0,
                template: requestedTemplate,
                storagePath: render.storagePath,
                sourcePhotoId: render.sourcePhotoId,
                sourceImageUrl: render.sourceImageUrl,
            }],
        platforms,
        scheduledAt,
        postedAt: null,
        postPermalinks: {},
        publishError: null,
        safetyFlags: flags.map((f) => `${f.type}:${f.phrase}`),
        personaId: slot.persona?.id ?? null,
        personaLabel: slot.persona?.label ?? null,
        pillarId: slot.pillar?.id ?? null,
        pillarLabel: slot.pillar?.label ?? null,
        eventId: slot.event?.id ?? null,
        eventLabel: slot.event?.label ?? null,
        locale: brand.voice.bilingual,
        imagePrompt: captionOut.imagePrompt,
        imageSource: render.source,
        sourcePhotoId: render.sourcePhotoId,
        sourceImageUrl: render.sourceImageUrl,
        imageAttribution: render.imageAttribution,
        costInr: totalCost,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        generatedForDate: today.isoDate,
        generatedForKey,
        generatedBy: actorEmail ?? 'cron',
        approvedAt: null,
        approvedBy: null,
        rejectedAt: null,
        rejectedBy: null,
        rejectReason: null,
    };
    try {
        await draftRef.set(stripUndefinedDeep(draft));
    }
    catch (e) {
        return { ok: false, code: 'write-failed', message: e?.message ?? String(e) };
    }
    return {
        ok: true,
        draftId: draftRef.id,
        caption,
        imageUrl: render.url,
        imageSource: render.source,
        template: requestedTemplate,
        costInr: totalCost,
        flags: flags.map((f) => ({ type: f.type, phrase: f.phrase })),
        requiredDisclaimers: disclaimers,
    };
}
// ── HTTPS callable wrapper ─────────────────────────────────────────────────
function buildGenerateMarketingDraft(allowList) {
    return functions
        .runWith({ memory: '1GB', timeoutSeconds: 300 })
        .https.onCall(async (data, context) => {
        if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
            throw new functions.https.HttpsError('permission-denied', 'Only admins with marketing access can generate drafts.');
        }
        const actorEmail = context.auth?.token?.email ?? null;
        return runGenerator(data ?? {}, actorEmail);
    });
}
function buildRegenerateMarketingDraft(allowList) {
    return functions
        .runWith({ memory: '1GB', timeoutSeconds: 300 })
        .https.onCall(async (data, context) => {
        if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
            throw new functions.https.HttpsError('permission-denied', 'Only admins with marketing access can regenerate drafts.');
        }
        const draftId = typeof data?.draftId === 'string' ? data.draftId.trim() : '';
        if (!draftId)
            return { ok: false, code: 'missing-id', message: 'draftId required.' };
        const db = admin.firestore();
        const draftRef = db.doc(`marketing_drafts/${draftId}`);
        const snap = await draftRef.get();
        if (!snap.exists)
            return { ok: false, code: 'not-found', message: 'Draft not found.' };
        const original = snap.data();
        const template = inferTemplateFromDraft(original);
        if (!template)
            return { ok: false, code: 'unknown-template', message: 'Could not determine the original draft template.' };
        const scheduled = typeof original.scheduledAt === 'string' && !!original.scheduledAt;
        const scheduleParts = scheduled ? istDateAndTimeFromIso(original.scheduledAt) : null;
        const input = {
            personaId: typeof original.personaId === 'string' ? original.personaId : undefined,
            pillarId: typeof original.pillarId === 'string' ? original.pillarId : undefined,
            eventId: typeof original.eventId === 'string' ? original.eventId : undefined,
            template,
            promptOverride: regeneratePromptOverride(template, original),
            slotId: typeof original.slotId === 'string' ? original.slotId : undefined,
            slotLabel: typeof original.slotLabel === 'string' ? original.slotLabel : undefined,
            slotPlatforms: Array.isArray(original.platforms) ? original.platforms : undefined,
        };
        if (scheduleParts) {
            input.forDateIso = scheduleParts.dateIso;
            input.slotTime = scheduleParts.time;
            input.autoSchedule = true;
        }
        const result = await runGenerator(input, context.auth?.token?.email ?? null);
        if (!result.ok)
            return result;
        if (scheduled) {
            await draftRef.delete();
        }
        return {
            ok: true,
            draftId: result.draftId,
            template: result.template,
            scheduledAt: scheduleParts ? scheduleIsoForSlot(scheduleParts.dateIso, scheduleParts.time) : null,
            replacedDraftId: scheduled ? draftId : null,
            message: scheduled
                ? `New ${result.template} generated, scheduled in the same slot, and opened.`
                : `New ${result.template} draft generated and opened.`,
        };
    });
}
function buildScheduleMarketingDraft(allowList) {
    return functions
        .runWith({ memory: '256MB', timeoutSeconds: 60 })
        .https.onCall(async (data, context) => {
        if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
            throw new functions.https.HttpsError('permission-denied', 'Only admins with marketing access can schedule drafts.');
        }
        const draftId = typeof data?.draftId === 'string' ? data.draftId.trim() : '';
        const scheduledAt = typeof data?.scheduledAt === 'string' ? data.scheduledAt.trim() : '';
        if (!draftId)
            return { ok: false, code: 'missing-id', message: 'draftId required.' };
        if (!scheduledAt || !Number.isFinite(new Date(scheduledAt).getTime())) {
            return { ok: false, code: 'bad-schedule', message: 'Valid scheduledAt ISO string required.' };
        }
        const platforms = parsePlatforms(data?.platforms);
        await admin.firestore().doc(`marketing_drafts/${draftId}`).update({
            status: 'scheduled',
            scheduledAt,
            platforms,
            approvedAt: admin.firestore.FieldValue.serverTimestamp(),
            approvedBy: context.auth?.token?.email ?? context.auth?.uid ?? null,
        });
        return { ok: true, draftId, status: 'scheduled', scheduledAt };
    });
}
function buildUnscheduleMarketingDraft(allowList) {
    return functions
        .runWith({ memory: '256MB', timeoutSeconds: 60 })
        .https.onCall(async (data, context) => {
        if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
            throw new functions.https.HttpsError('permission-denied', 'Only admins with marketing access can unschedule drafts.');
        }
        const draftId = typeof data?.draftId === 'string' ? data.draftId.trim() : '';
        if (!draftId)
            return { ok: false, code: 'missing-id', message: 'draftId required.' };
        await admin.firestore().doc(`marketing_drafts/${draftId}`).update({
            status: 'approved',
            scheduledAt: null,
        });
        return { ok: true, draftId, status: 'approved', scheduledAt: null };
    });
}
// ── Pubsub cron (6am IST = 00:30 UTC) ──────────────────────────────────────
// Auto-disabled: bumps a counter in marketing_brand/main if `cronEnabled`
// is true; otherwise no-ops. Admin opts in by saving brand kit with
// `cronEnabled: true`. This keeps test deploys safe.
/** Returns false if the slot's frequency means it should not run on this date. */
function shouldRunSlotToday(slot, isoDate, weekdayKey) {
    const freq = slot.frequency ?? 'daily';
    if (freq === 'daily')
        return true;
    if (freq === 'alternate_day')
        return Math.floor(new Date(isoDate).getTime() / 86400000) % 2 === 0;
    if (freq === 'weekly')
        return weekdayKey === (slot.runOnWeekDay ?? 'mon');
    if (freq === 'monthly') {
        const dayOfMonth = new Date(`${isoDate}T12:00:00+05:30`).getDate();
        return dayOfMonth === (slot.runOnMonthDay ?? 1);
    }
    return true;
}
function buildDailyMarketingDraftCron() {
    return functions
        .runWith({ memory: '1GB', timeoutSeconds: 540 })
        .pubsub.schedule('30 0 * * *')
        .timeZone('UTC')
        .onRun(async () => {
        const brandSnap = await admin.firestore().doc('marketing_brand/main').get();
        const data = (brandSnap.exists ? brandSnap.data() : {});
        if (data?.cronEnabled !== true) {
            console.log('[dailyMarketingDraftCron] disabled — set marketing_brand/main.cronEnabled=true to opt in');
            return null;
        }
        if (data?.crisisPaused === true) {
            console.log('[dailyMarketingDraftCron] crisis pause active — skipping today');
            return null;
        }
        const { isoDate: todayIso, weekdayKey } = todayInIst();
        // Layer 2: check per-date override for today.
        const overrides = (data?.cronOverrides ?? {});
        const dayDefaultOverride = resolveSlotOverride(overrides, todayIso);
        if (dayDefaultOverride.skip === true) {
            console.log('[dailyMarketingDraftCron] skip override active for', todayIso);
            return null;
        }
        const theme = data?.themeCalendar?.[weekdayKey];
        if (theme?.enabled === false) {
            console.log('[dailyMarketingDraftCron] theme disabled for', todayIso, '— skipping day');
            return null;
        }
        const slots = Array.isArray(data?.automationSlots) && data.automationSlots.length
            ? data.automationSlots
            : [{ id: 'morning_auto', label: 'Morning post', time: data?.defaultPostTime ?? '09:00', template: 'auto', platforms: ['instagram', 'facebook'], enabled: true, autoSchedule: false }];
        for (const rawSlot of slots) {
            if (rawSlot?.enabled === false)
                continue;
            if (!shouldRunSlotToday(rawSlot, todayIso, weekdayKey)) {
                console.log('[dailyMarketingDraftCron] frequency skip for slot', rawSlot?.id, 'on', todayIso);
                continue;
            }
            const slotId = typeof rawSlot?.id === 'string' ? rawSlot.id : 'default';
            const generatedForKey = `${todayIso}:${slotId}`;
            if (await draftExistsForKey(generatedForKey)) {
                console.log('[dailyMarketingDraftCron] draft already exists for', generatedForKey, '— skipping slot');
                continue;
            }
            // Day-level autoSchedule overrides slot-level when explicitly set.
            const effectiveAutoSchedule = theme?.autoSchedule === true ? true : rawSlot?.autoSchedule === true;
            const effectiveSlotTime = (typeof theme?.postTime === 'string' && /^[0-2]\d:[0-5]\d$/.test(theme.postTime))
                ? theme.postTime
                : (typeof rawSlot?.time === 'string' ? rawSlot.time : (data?.defaultPostTime ?? '09:00'));
            const genInput = {
                forDateIso: todayIso,
                slotId,
                slotLabel: typeof rawSlot?.label === 'string' ? rawSlot.label : 'Daily slot',
                slotTime: effectiveSlotTime,
                slotPlatforms: rawSlot?.platforms,
                autoSchedule: effectiveAutoSchedule,
            };
            const slotOverride = resolveSlotOverride(overrides, todayIso, slotId);
            if (slotOverride.skip === true) {
                console.log('[dailyMarketingDraftCron] slot skip override active for', generatedForKey);
                continue;
            }
            if (typeof slotOverride.personaId === 'string')
                genInput.personaId = slotOverride.personaId;
            if (typeof slotOverride.pillarId === 'string')
                genInput.pillarId = slotOverride.pillarId;
            if (typeof slotOverride.promptOverride === 'string')
                genInput.promptOverride = slotOverride.promptOverride;
            if (typeof slotOverride.template === 'string')
                genInput.template = slotOverride.template;
            else if (typeof rawSlot?.template === 'string')
                genInput.template = rawSlot.template;
            const result = await runGenerator(genInput, null);
            if (result.ok) {
                console.log('[dailyMarketingDraftCron] generated draft', result.draftId, 'for', generatedForKey);
            }
            else {
                console.error('[dailyMarketingDraftCron] failed for', generatedForKey, result);
            }
        }
        const tomorrow = istDateOffset(1);
        if (!hasCulturalEventOnIsoDate(data?.culturalCalendar, tomorrow.isoDate)) {
            return null;
        }
        const tomorrowDefaultOverride = resolveSlotOverride(overrides, tomorrow.isoDate);
        if (tomorrowDefaultOverride.skip === true) {
            console.log('[dailyMarketingDraftCron] tomorrow event pre-draft skipped by override for', tomorrow.isoDate);
            return null;
        }
        const tomorrowTheme = data?.themeCalendar?.[tomorrow.weekdayKey];
        if (tomorrowTheme?.enabled === false) {
            console.log('[dailyMarketingDraftCron] tomorrow event pre-draft skipped because theme is disabled for', tomorrow.isoDate);
            return null;
        }
        for (const rawSlot of slots) {
            if (rawSlot?.enabled === false)
                continue;
            const slotId = typeof rawSlot?.id === 'string' ? rawSlot.id : 'default';
            const generatedForKey = `${tomorrow.isoDate}:${slotId}`;
            if (await draftExistsForKey(generatedForKey)) {
                console.log('[dailyMarketingDraftCron] tomorrow event draft already exists for', generatedForKey, '— skipping pre-draft');
                continue;
            }
            const slotOverride = resolveSlotOverride(overrides, tomorrow.isoDate, slotId);
            if (slotOverride.skip === true) {
                console.log('[dailyMarketingDraftCron] tomorrow event slot skip override active for', generatedForKey);
                continue;
            }
            const effectiveTomorrowSlotTime = (typeof tomorrowTheme?.postTime === 'string' && /^[0-2]\d:[0-5]\d$/.test(tomorrowTheme.postTime))
                ? tomorrowTheme.postTime
                : (typeof rawSlot?.time === 'string' ? rawSlot.time : (data?.defaultPostTime ?? '09:00'));
            const genInput = {
                forDateIso: tomorrow.isoDate,
                slotId,
                slotLabel: typeof rawSlot?.label === 'string' ? rawSlot.label : 'Daily slot',
                slotTime: effectiveTomorrowSlotTime,
                slotPlatforms: rawSlot?.platforms,
                autoSchedule: rawSlot?.autoSchedule === true,
            };
            if (typeof slotOverride.personaId === 'string')
                genInput.personaId = slotOverride.personaId;
            if (typeof slotOverride.pillarId === 'string')
                genInput.pillarId = slotOverride.pillarId;
            if (typeof slotOverride.promptOverride === 'string')
                genInput.promptOverride = slotOverride.promptOverride;
            if (typeof slotOverride.template === 'string')
                genInput.template = slotOverride.template;
            else if (typeof rawSlot?.template === 'string')
                genInput.template = rawSlot.template;
            const result = await runGenerator(genInput, null);
            if (result.ok) {
                console.log('[dailyMarketingDraftCron] pre-generated tomorrow event draft', result.draftId, 'for', generatedForKey);
            }
            else {
                console.error('[dailyMarketingDraftCron] tomorrow event pre-draft failed for', generatedForKey, result);
            }
        }
        return null;
    });
}
// ── Admin callable: pre-generate drafts for the next N days ─────────────────
// Lets the admin queue roughly six months ahead so they can review and adjust
// content before it goes live. The cron automatically skips any date that
// already has a draft, so pre-generated drafts are not duplicated.
function buildGenerateAheadDrafts(allowList) {
    return functions
        .runWith({ memory: '1GB', timeoutSeconds: 540 })
        .https.onCall(async (data, context) => {
        if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
            throw new functions.https.HttpsError('permission-denied', 'Only admins with marketing access can pre-generate drafts.');
        }
        const brandSnap = await admin.firestore().doc('marketing_brand/main').get();
        const brandData = (brandSnap.exists ? brandSnap.data() : {});
        if (brandData?.crisisPaused === true) {
            return { ok: false, code: 'crisis-paused', message: 'Cannot pre-generate while crisis pause is active.' };
        }
        if ((brandData?.personas?.length ?? 0) === 0 || (brandData?.pillars?.length ?? 0) === 0) {
            return { ok: false, code: 'strategy-incomplete', message: 'Add at least one enabled persona and pillar first.' };
        }
        const rawDays = typeof data?.days === 'number'
            ? Math.min(MAX_GENERATE_AHEAD_DAYS, Math.max(1, Math.round(data.days)))
            : MAX_GENERATE_AHEAD_DAYS;
        const actorEmail = context.auth?.token?.email ?? null;
        const overrides = (brandData?.cronOverrides ?? {});
        const slots = Array.isArray(brandData?.automationSlots) && brandData.automationSlots.length
            ? brandData.automationSlots
            : [{ id: 'morning_auto', label: 'Morning post', time: brandData?.defaultPostTime ?? '09:00', template: 'auto', platforms: ['instagram', 'facebook'], enabled: true, autoSchedule: false }];
        const results = [];
        for (let i = 1; i <= rawDays; i++) {
            const { isoDate, weekdayKey } = istDateOffset(i);
            const dayDefaultOverride = resolveSlotOverride(overrides, isoDate);
            // Skip this date if admin marked it.
            if (dayDefaultOverride.skip === true) {
                results.push({ date: isoDate, ok: true, skipped: 'override-skip' });
                continue;
            }
            const theme = brandData?.themeCalendar?.[weekdayKey];
            if (theme?.enabled === false) {
                results.push({ date: isoDate, ok: true, skipped: 'theme-disabled' });
                continue;
            }
            for (const rawSlot of slots) {
                if (rawSlot?.enabled === false)
                    continue;
                // Frequency gate — weekly/monthly/alternate-day slots must NOT run
                // every day of the 7-day window. Mirrors the daily cron at line
                // 1104. Without this, a "Sunday weekly" slot would generate 7
                // drafts (one per day) on Queue-7-Days.
                if (!shouldRunSlotToday(rawSlot, isoDate, weekdayKey)) {
                    results.push({ date: `${isoDate}:${rawSlot?.id ?? 'default'}`, ok: true, skipped: 'frequency-skip' });
                    continue;
                }
                const slotId = typeof rawSlot?.id === 'string' ? rawSlot.id : 'default';
                const generatedForKey = `${isoDate}:${slotId}`;
                if (await draftExistsForKey(generatedForKey, ['scheduled', 'posted'])) {
                    results.push({ date: generatedForKey, ok: true, skipped: 'already-exists' });
                    continue;
                }
                // Day-level (theme) overrides win over slot-level — same precedence
                // as the daily cron. This is what makes Queue-7-Days actually put
                // drafts on the calendar: `theme.autoSchedule = true` + `theme.postTime`
                // → scheduledAt gets written, otherwise drafts stay status='approved'
                // with scheduledAt=null and never appear on the day grid.
                const theme = brandData?.themeCalendar?.[weekdayKey];
                const effectiveAutoSchedule = theme?.autoSchedule === true ? true : rawSlot?.autoSchedule === true;
                const effectiveSlotTime = (typeof theme?.postTime === 'string' && /^[0-2]\d:[0-5]\d$/.test(theme.postTime))
                    ? theme.postTime
                    : (typeof rawSlot?.time === 'string' ? rawSlot.time : (brandData?.defaultPostTime ?? '09:00'));
                const genInput = {
                    forDateIso: isoDate,
                    slotId,
                    slotLabel: typeof rawSlot?.label === 'string' ? rawSlot.label : 'Daily slot',
                    slotTime: effectiveSlotTime,
                    slotPlatforms: rawSlot?.platforms,
                    autoSchedule: effectiveAutoSchedule,
                };
                const slotOverride = resolveSlotOverride(overrides, isoDate, slotId);
                if (slotOverride.skip === true) {
                    results.push({ date: generatedForKey, ok: true, skipped: 'slot-override-skip' });
                    continue;
                }
                if (typeof slotOverride.personaId === 'string')
                    genInput.personaId = slotOverride.personaId;
                if (typeof slotOverride.pillarId === 'string')
                    genInput.pillarId = slotOverride.pillarId;
                if (typeof slotOverride.promptOverride === 'string')
                    genInput.promptOverride = slotOverride.promptOverride;
                if (typeof slotOverride.template === 'string')
                    genInput.template = slotOverride.template;
                else if (typeof rawSlot?.template === 'string')
                    genInput.template = rawSlot.template;
                const r = await runGenerator(genInput, actorEmail);
                if (r.ok) {
                    results.push({ date: generatedForKey, ok: true, draftId: r.draftId });
                    console.log('[generateAheadDrafts] generated', r.draftId, 'for', generatedForKey);
                }
                else {
                    results.push({ date: generatedForKey, ok: false, skipped: r.message });
                    console.error('[generateAheadDrafts] failed for', generatedForKey, r);
                }
            }
        }
        const generated = results.filter((r) => r.draftId).length;
        const skipped = results.filter((r) => r.skipped).length;
        return { ok: true, generated, skipped, results };
    });
}
