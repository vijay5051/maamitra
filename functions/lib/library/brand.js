"use strict";
// Library-AI brand context — pulls the same brand voice, compliance lists,
// and visual style profile that the marketing generator uses, so AI-written
// articles / book curation / product copy share MaaMitra's voice and obey the
// same forbidden-words list.
//
// The single source of truth is marketing_brand/main. We never duplicate this
// content into a Library-specific doc; every change propagates.
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
exports.loadLibraryBrand = loadLibraryBrand;
exports.runCompliance = runCompliance;
exports.buildStyleLockedImagePrompt = buildStyleLockedImagePrompt;
exports.buildSystemVoiceHeader = buildSystemVoiceHeader;
const admin = __importStar(require("firebase-admin"));
const STYLE_DEFAULT_DESCRIPTION = 'A warm hand-drawn 2D illustration. Flat colours with subtle gradients, no photorealism. Indian characters (brown skin, dark hair). Soft pastels. Rounded organic shapes. Generous negative space. Single-scene composition.';
const STYLE_DEFAULT_KEYWORDS = 'flat illustration, pastel, Indian, motherhood, gentle, hand-drawn, soft gradient, organic shapes';
const DEFAULT_BRAND = {
    brandName: 'MaaMitra',
    voiceAttributes: ['warm', 'honest', 'judgement-free', 'evidence-based'],
    voiceAvoid: ['preachy', 'medicalised', 'fear-based'],
    bilingual: 'hinglish',
    forbiddenWords: [],
    blockedTopics: [],
    requiredDisclaimers: [],
    styleProfile: {
        description: STYLE_DEFAULT_DESCRIPTION,
        artKeywords: STYLE_DEFAULT_KEYWORDS,
        prohibited: [],
    },
};
async function loadLibraryBrand() {
    try {
        const snap = await admin.firestore().doc('marketing_brand/main').get();
        if (!snap.exists)
            return DEFAULT_BRAND;
        const d = snap.data();
        const arr = (v) => (Array.isArray(v) ? v : []);
        const strArr = (v) => arr(v).filter((s) => typeof s === 'string' && s.trim().length > 0);
        const bilingual = d?.voice?.bilingual === 'english_only'
            ? 'english_only'
            : d?.voice?.bilingual === 'mixed'
                ? 'mixed'
                : 'hinglish';
        return {
            brandName: typeof d?.brandName === 'string' && d.brandName.trim() ? d.brandName : DEFAULT_BRAND.brandName,
            voiceAttributes: strArr(d?.voice?.attributes).length ? strArr(d?.voice?.attributes) : DEFAULT_BRAND.voiceAttributes,
            voiceAvoid: strArr(d?.voice?.avoid),
            bilingual,
            forbiddenWords: strArr(d?.compliance?.medicalForbiddenWords),
            blockedTopics: strArr(d?.compliance?.blockedTopics),
            requiredDisclaimers: arr(d?.compliance?.requiredDisclaimers)
                .filter((r) => r && typeof r.trigger === 'string' && typeof r.text === 'string')
                .map((r) => ({ trigger: String(r.trigger), text: String(r.text) })),
            styleProfile: {
                description: typeof d?.styleProfile?.description === 'string' && d.styleProfile.description.trim()
                    ? d.styleProfile.description
                    : STYLE_DEFAULT_DESCRIPTION,
                artKeywords: typeof d?.styleProfile?.artKeywords === 'string' && d.styleProfile.artKeywords.trim()
                    ? d.styleProfile.artKeywords
                    : STYLE_DEFAULT_KEYWORDS,
                prohibited: strArr(d?.styleProfile?.prohibited),
            },
        };
    }
    catch (e) {
        console.warn('[library/brand] load failed, using defaults', e);
        return DEFAULT_BRAND;
    }
}
// ── Compliance utilities ────────────────────────────────────────────────────
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
    const lc = text.toLowerCase();
    for (const w of brand.forbiddenWords) {
        if (findPhrase(lc, w.toLowerCase()))
            flags.push({ type: 'forbidden_word', phrase: w });
    }
    for (const t of brand.blockedTopics) {
        if (findPhrase(lc, t.toLowerCase()))
            flags.push({ type: 'blocked_topic', phrase: t });
    }
    const disclaimers = Array.from(new Set(brand.requiredDisclaimers
        .filter((d) => d.trigger && d.text && findPhrase(lc, d.trigger.toLowerCase()))
        .map((d) => d.text)));
    return { flags, disclaimers };
}
/** Wrap an LLM-supplied subject prompt in the brand's visual DNA. Mirrors
 *  marketing's buildStyleLockedImagePrompt so cron-rendered article hero
 *  images share the Studio look. */
function buildStyleLockedImagePrompt(subject, brand) {
    const negative = brand.styleProfile.prohibited.length ? brand.styleProfile.prohibited.join(', ') : '';
    const parts = [
        `Visual style: ${brand.styleProfile.description}`,
        `Art direction keywords: ${brand.styleProfile.artKeywords}.`,
        `Subject: ${subject.trim()}`,
    ];
    if (negative)
        parts.push(`Do NOT include: ${negative}.`);
    parts.push('Single coherent illustration. No text, no logos, no watermarks.');
    return parts.join('\n');
}
/** Voice header for OpenAI system prompts. */
function buildSystemVoiceHeader(brand) {
    const localeInstruction = brand.bilingual === 'english_only'
        ? 'Write in English only.'
        : brand.bilingual === 'hinglish'
            ? 'Write in natural Indian English. Light Hinglish is welcome (using Latin script) but never literal Hindi translation. Always Indian context — clothing, food, names, traditions.'
            : 'Write in English with occasional Devanagari accent words for emphasis.';
    const lines = [
        `You are a content writer for ${brand.brandName}, an Indian motherhood platform.`,
        `Brand voice: ${brand.voiceAttributes.join(', ')}.`,
        brand.voiceAvoid.length ? `Avoid these tones: ${brand.voiceAvoid.join(', ')}.` : '',
        brand.forbiddenWords.length ? `Avoid these words/phrases entirely (medical / over-claim risk): ${brand.forbiddenWords.slice(0, 30).join(', ')}.` : '',
        brand.blockedTopics.length ? `Never write about: ${brand.blockedTopics.slice(0, 20).join(', ')}.` : '',
        localeInstruction,
        'Default to inclusive, non-prescriptive language. Real Indian families come from many backgrounds, religions, regions.',
    ];
    return lines.filter(Boolean).join('\n');
}
