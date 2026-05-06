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
exports.buildDailyMarketingDraftCron = buildDailyMarketingDraftCron;
exports.buildGenerateAheadDrafts = buildGenerateAheadDrafts;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const imageSources_1 = require("./imageSources");
const renderer_1 = require("./renderer");
const integrationConfig_1 = require("../lib/integrationConfig");
const styleReferences_1 = require("./styleReferences");
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
    };
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
    parts.push('Single coherent illustration. No text, no logos, no watermarks.');
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
async function draftExistsForKey(generatedForKey) {
    try {
        const snap = await admin.firestore()
            .collection('marketing_drafts')
            .where('generatedForKey', '==', generatedForKey)
            .where('status', 'in', ['pending_review', 'approved', 'scheduled', 'posted'])
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
    let event = brand.culturalCalendar.find((e) => {
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
async function generateCaption(brand, slot, stats) {
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
        'Pick the most appropriate template:',
        '- "tipCard" — a numbered list of 3 short practical tips (use for advice / safety / how-to)',
        '- "quoteCard" — a single short quote with attribution (use for inspiration / wisdom / cultural)',
        '- "milestoneCard" — an age + bulleted developmental milestones list (use for milestones / development)',
        '- "realStoryCard" — a first-person mini story with attribution (use for relatable community moments)',
        '',
        'Return JSON with exactly these keys:',
        '{',
        '  "headline": "≤80 chars, the on-image headline",',
        '  "body": "the IG caption body (3–6 sentences, no headline duplication, no hashtags, no disclaimers)",',
        '  "hashtags": ["array", "of", "5-10", "hashtags", "without # prefix"],',
        '  "template": "tipCard" | "quoteCard" | "milestoneCard" | "realStoryCard",',
        '  "imagePrompt": "specific prompt for an AI image generator — describe an Indian-context scene with lighting, mood, palette",',
        '  "templateProps": { /* per-template fields */ }',
        '}',
        '',
        'templateProps shape per template:',
        '  tipCard:        { eyebrow: string (≤30c), title: string (≤80c), tips: string[3-4] (each ≤120c) }',
        '  quoteCard:      { quote: string (≤200c), attribution: string (≤40c) }',
        '  milestoneCard:  { age: string (≤20c), title: string (≤60c), milestones: string[3-5] (each ≤120c) }',
        '  realStoryCard:  { eyebrow: string (≤30c), story: string (≤320c), attribution: string (≤40c) }',
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
    const template = ['tipCard', 'quoteCard', 'milestoneCard', 'realStoryCard'].includes(parsed?.template)
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
function titleCase(s) {
    return s
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
        .join(' ');
}
function fallbackCaption(brand, slot) {
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
async function renderDraftImage(template, templateProps, imagePrompt, imageModel, brand) {
    // Tip Card never takes a background; Quote / Milestone / Real Story do.
    // For AI providers, wrap the LLM-supplied subject prompt in the brand's
    // style preamble so cron-generated images share the Studio look. Pexels
    // is keyword-search, so it gets the raw subject prompt only.
    const styleLockedPrompt = buildStyleLockedImagePrompt(imagePrompt, brand);
    const bgUrl = template === 'tipCard'
        ? null
        : imageModel === 'imagen'
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
    // If AI failed, fall back to Pexels with the (un-styled) subject prompt as
    // a query. Pexels is keyword-search; the styling preamble would just
    // narrow the photo set unhelpfully.
    let imageSource = template === 'tipCard' ? 'none' : imageModel;
    let imageAttribution = null;
    let resolvedBg = bgUrl;
    if (!resolvedBg && template !== 'tipCard') {
        const stock = await (0, imageSources_1.pexelsSearch)(imagePrompt.slice(0, 100));
        if (stock) {
            resolvedBg = stock.url;
            imageAttribution = stock.attribution;
            imageSource = 'pexels';
        }
        else {
            imageSource = 'none';
        }
    }
    const propsForRender = { ...templateProps };
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
        metadata: { metadata: { template, source: imageSource, attribution: imageAttribution ?? '' } },
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
            costInr,
            bytes: result.png.length,
            actor: 'generator',
        });
    }
    catch (e) {
        console.warn('[generator] cost log write failed (non-fatal)', e);
    }
    return { url, storagePath, bytes: result.png.length, source: imageSource, costInr };
}
function imageSourceCostInr(source) {
    switch (source) {
        case 'imagen': return 3.30;
        case 'dalle': return 3.50;
        case 'flux': return 0.25;
        default: return 0;
    }
}
function parsePlatforms(input) {
    const out = Array.isArray(input)
        ? input.filter((p) => p === 'instagram' || p === 'facebook')
        : [];
    return out.length ? Array.from(new Set(out)).slice(0, 2) : ['instagram', 'facebook'];
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
    let captionOut;
    try {
        captionOut = await generateCaption(brand, slot, stats);
    }
    catch (e) {
        console.warn('[generator] caption AI failed, using local fallback', e?.message ?? e);
        captionOut = fallbackCaption(brand, slot);
    }
    const requestedTemplate = ['tipCard', 'quoteCard', 'milestoneCard', 'realStoryCard'].includes(input.template)
        ? input.template
        : slot.templateOverride && slot.templateOverride !== 'auto'
            ? slot.templateOverride
            : captionOut.template;
    const requestedModel = ['imagen', 'dalle', 'flux'].includes(input.imageModel)
        ? input.imageModel
        : 'flux';
    const slotId = typeof input.slotId === 'string' && input.slotId.trim() ? input.slotId.trim() : 'default';
    const slotLabel = typeof input.slotLabel === 'string' && input.slotLabel.trim() ? input.slotLabel.trim() : 'Daily slot';
    const slotTime = typeof input.slotTime === 'string' && /^[0-2]\d:[0-5]\d$/.test(input.slotTime) ? input.slotTime : null;
    const autoSchedule = input.autoSchedule === true;
    const scheduledAt = autoSchedule && slotTime ? scheduleIsoForSlot(today.isoDate, slotTime) : null;
    const generatedForKey = `${today.isoDate}:${slotId}`;
    const platforms = parsePlatforms(input.slotPlatforms);
    let render;
    try {
        render = await renderDraftImage(requestedTemplate, captionOut.templateProps, captionOut.imagePrompt, requestedModel, brand);
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
        assets: [{ url: render.url, index: 0, template: requestedTemplate, storagePath: render.storagePath }],
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
        await draftRef.set(draft);
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
// ── Pubsub cron (6am IST = 00:30 UTC) ──────────────────────────────────────
// Auto-disabled: bumps a counter in marketing_brand/main if `cronEnabled`
// is true; otherwise no-ops. Admin opts in by saving brand kit with
// `cronEnabled: true`. This keeps test deploys safe.
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
            const slotId = typeof rawSlot?.id === 'string' ? rawSlot.id : 'default';
            const generatedForKey = `${todayIso}:${slotId}`;
            if (await draftExistsForKey(generatedForKey)) {
                console.log('[dailyMarketingDraftCron] draft already exists for', generatedForKey, '— skipping slot');
                continue;
            }
            const genInput = {
                forDateIso: todayIso,
                slotId,
                slotLabel: typeof rawSlot?.label === 'string' ? rawSlot.label : 'Daily slot',
                slotTime: typeof rawSlot?.time === 'string' ? rawSlot.time : (data?.defaultPostTime ?? '09:00'),
                slotPlatforms: rawSlot?.platforms,
                autoSchedule: rawSlot?.autoSchedule === true,
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
            const genInput = {
                forDateIso: tomorrow.isoDate,
                slotId,
                slotLabel: typeof rawSlot?.label === 'string' ? rawSlot.label : 'Daily slot',
                slotTime: typeof rawSlot?.time === 'string' ? rawSlot.time : (data?.defaultPostTime ?? '09:00'),
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
// Lets the admin "queue" tomorrow through +7d so they can review and adjust
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
        const rawDays = typeof data?.days === 'number' ? Math.min(7, Math.max(1, Math.round(data.days))) : 7;
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
                const slotId = typeof rawSlot?.id === 'string' ? rawSlot.id : 'default';
                const generatedForKey = `${isoDate}:${slotId}`;
                if (await draftExistsForKey(generatedForKey)) {
                    results.push({ date: generatedForKey, ok: true, skipped: 'already-exists' });
                    continue;
                }
                const genInput = {
                    forDateIso: isoDate,
                    slotId,
                    slotLabel: typeof rawSlot?.label === 'string' ? rawSlot.label : 'Daily slot',
                    slotTime: typeof rawSlot?.time === 'string' ? rawSlot.time : (brandData?.defaultPostTime ?? '09:00'),
                    slotPlatforms: rawSlot?.platforms,
                    autoSchedule: rawSlot?.autoSchedule === true,
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
