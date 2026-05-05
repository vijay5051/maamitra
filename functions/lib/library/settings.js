"use strict";
// Library AI settings — single Firestore doc at app_settings/libraryAi.
//
// Drives autopilot for Articles / Books / Products in the Library tab.
// Admin edits this from /admin/library-ai. The cron + callables read it
// at request time (no in-memory cache — admin toggles must take effect
// instantly).
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
exports.DEFAULT_LIBRARY_AI = exports.DEFAULT_AGE_BUCKETS = void 0;
exports.frequencyToWeekdays = frequencyToWeekdays;
exports.loadLibraryAiSettings = loadLibraryAiSettings;
exports.nowInIst = nowInIst;
exports.shouldFireToday = shouldFireToday;
const admin = __importStar(require("firebase-admin"));
exports.DEFAULT_AGE_BUCKETS = [
    { key: 'pregnancy', label: 'Pregnancy', ageMin: -9, ageMax: 0 },
    { key: 'newborn', label: 'Newborn (0-3m)', ageMin: 0, ageMax: 3 },
    { key: 'infant', label: 'Infant (3-12m)', ageMin: 3, ageMax: 12 },
    { key: 'toddler', label: 'Toddler (1-3y)', ageMin: 12, ageMax: 36 },
    { key: 'preschool', label: 'Preschool (3-5y)', ageMin: 36, ageMax: 60 },
];
/** Days of the IST week the cron should fire. Based on `frequency`:
 *    daily    → every weekday key (0-6, Sunday=0)
 *    biweekly → Sunday(0) + Wednesday(3)
 *    weekly   → Sunday(0)
 *    monthly  → 1st of month (handled separately)
 *    off      → never
 */
function frequencyToWeekdays(f) {
    switch (f) {
        case 'daily': return [0, 1, 2, 3, 4, 5, 6];
        case 'biweekly': return [0, 3];
        case 'weekly': return [0];
        case 'monthly': return [1]; // run on 1st of month, pubsub handler checks DOM
        case 'off':
        default: return [];
    }
}
// ── Defaults ────────────────────────────────────────────────────────────────
const DEFAULT_ARTICLE_TOPICS = [
    'Feeding & Weaning',
    'Sleep',
    'Pregnancy Wellness',
    'Postpartum Recovery',
    'Newborn Care',
    'Infant Development',
    'Toddler Behaviour',
    'Indian Home Remedies',
    'Vaccinations & Health',
    'Mental Health for Mothers',
    'Working Mom Tips',
    'Indian Festivals & Babies',
    'Nutrition for Toddlers',
    'Baby-Proofing Your Home',
    'First Foods (Indian Recipes)',
];
const DEFAULT_BOOK_TOPICS = [
    'Pregnancy in India',
    'Breastfeeding',
    'Newborn care',
    'Indian baby food recipes',
    'Toddler discipline',
    'Maternal mental health',
    'Sleep training gentle methods',
    'Indian parenting',
    'Yoga for pregnancy',
    'First-year development',
];
const DEFAULT_PRODUCT_TOPICS = [
    'Feeding',
    'Skincare',
    'Sleep',
    'Development',
    'Mother',
    'Toddler',
    'Bath & hygiene',
    'Diapering',
    'Babyproofing',
];
exports.DEFAULT_LIBRARY_AI = {
    paused: false,
    articles: {
        enabled: false, // opt-in
        frequency: 'biweekly',
        perRun: 2,
        autoPublish: true,
        expireAfterDays: 90,
        topics: DEFAULT_ARTICLE_TOPICS,
        ageBuckets: exports.DEFAULT_AGE_BUCKETS,
        tone: 'Warm, evidence-based, judgement-free, written for Indian mothers. Mix English with light Hinglish where natural. Never preachy.',
    },
    books: {
        enabled: false,
        frequency: 'monthly',
        perRun: 3,
        autoPublish: true,
        expireAfterDays: 0, // books don't expire — they're timeless
        topics: DEFAULT_BOOK_TOPICS,
        ageBuckets: exports.DEFAULT_AGE_BUCKETS,
        tone: 'Curate authoritative, well-reviewed books that an Indian mother would actually buy. Prefer Kindle availability.',
    },
    products: {
        enabled: false,
        frequency: 'weekly',
        perRun: 3,
        autoPublish: true,
        expireAfterDays: 60, // pricing/availability drifts faster
        topics: DEFAULT_PRODUCT_TOPICS,
        ageBuckets: exports.DEFAULT_AGE_BUCKETS,
        tone: 'Recommend specific, well-known brand-name products available on Amazon.in / Flipkart. Indian-priced.',
    },
};
// ── Loader ──────────────────────────────────────────────────────────────────
async function loadLibraryAiSettings() {
    try {
        const snap = await admin.firestore().doc('app_settings/libraryAi').get();
        if (!snap.exists)
            return exports.DEFAULT_LIBRARY_AI;
        const d = snap.data();
        return mergeDefaults(d);
    }
    catch (e) {
        console.warn('[libraryAi.settings] load failed, using defaults', e);
        return exports.DEFAULT_LIBRARY_AI;
    }
}
function mergeDefaults(d) {
    const merge = (base, over) => {
        if (!over || typeof over !== 'object')
            return base;
        return {
            enabled: typeof over.enabled === 'boolean' ? over.enabled : base.enabled,
            frequency: isFrequency(over.frequency) ? over.frequency : base.frequency,
            perRun: clampInt(over.perRun, 1, 10, base.perRun),
            autoPublish: typeof over.autoPublish === 'boolean' ? over.autoPublish : base.autoPublish,
            expireAfterDays: clampInt(over.expireAfterDays, 0, 365, base.expireAfterDays),
            topics: Array.isArray(over.topics) && over.topics.length > 0
                ? over.topics.filter((t) => typeof t === 'string' && t.trim()).slice(0, 50)
                : base.topics,
            ageBuckets: Array.isArray(over.ageBuckets) && over.ageBuckets.length > 0
                ? over.ageBuckets.filter(isAgeBucket).slice(0, 10)
                : base.ageBuckets,
            tone: typeof over.tone === 'string' && over.tone.trim() ? over.tone : base.tone,
        };
    };
    return {
        paused: typeof d.paused === 'boolean' ? d.paused : exports.DEFAULT_LIBRARY_AI.paused,
        articles: merge(exports.DEFAULT_LIBRARY_AI.articles, d.articles),
        books: merge(exports.DEFAULT_LIBRARY_AI.books, d.books),
        products: merge(exports.DEFAULT_LIBRARY_AI.products, d.products),
        updatedAt: d.updatedAt,
        updatedBy: typeof d.updatedBy === 'string' ? d.updatedBy : undefined,
    };
}
function isFrequency(v) {
    return v === 'daily' || v === 'biweekly' || v === 'weekly' || v === 'monthly' || v === 'off';
}
function isAgeBucket(v) {
    return v && typeof v === 'object'
        && typeof v.key === 'string'
        && typeof v.label === 'string'
        && typeof v.ageMin === 'number'
        && typeof v.ageMax === 'number';
}
function clampInt(v, lo, hi, fallback) {
    const n = typeof v === 'number' ? Math.round(v) : NaN;
    if (!Number.isFinite(n))
        return fallback;
    return Math.max(lo, Math.min(hi, n));
}
// ── IST helpers ─────────────────────────────────────────────────────────────
function nowInIst() {
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
    return {
        weekday: ist.getUTCDay(),
        dayOfMonth: ist.getUTCDate(),
        isoDate: ist.toISOString().slice(0, 10),
    };
}
/** Returns true if `frequency` says "fire today". */
function shouldFireToday(f, today) {
    if (f === 'off')
        return false;
    if (f === 'monthly')
        return today.dayOfMonth === 1;
    return frequencyToWeekdays(f).includes(today.weekday);
}
