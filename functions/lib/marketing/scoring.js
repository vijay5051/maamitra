"use strict";
// Compliance scoring for marketing drafts (M1).
//
// Pure regex / string-match screen against the brand's own ComplianceRules.
// Runs server-side because:
//   - the rules live in marketing_brand/main and shouldn't be re-fetched
//     by every client,
//   - the Phase-3 cron will call it before queueing a draft,
//   - admin-only callable preserves the same code path for both UIs.
//
// What this is NOT (yet):
//   - LLM-based brand-voice scoring. That gets bolted on in M2 when the
//     daily cron is already calling Claude Haiku for the caption itself —
//     one extra prompt then is essentially free.
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
exports.buildScoreMarketingDraft = buildScoreMarketingDraft;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
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
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/** Whole-word, case-insensitive match. Returns char index of first match. */
function findPhrase(haystack, phrase) {
    if (!phrase)
        return -1;
    // For multi-word phrases we anchor on whitespace; for single words we use
    // \b so "cure" doesn't fire inside "manicure".
    const isWord = /^\w+$/.test(phrase);
    const re = isWord
        ? new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'i')
        : new RegExp(escapeRegex(phrase), 'i');
    const m = re.exec(haystack);
    return m ? m.index : -1;
}
function loadRulesFrom(data) {
    const c = (data?.compliance ?? {});
    const arr = (v) => Array.isArray(v)
        ? v.map((x) => (typeof x === 'string' ? x.trim().toLowerCase() : '')).filter(Boolean)
        : [];
    const disclaimers = Array.isArray(c.requiredDisclaimers)
        ? c.requiredDisclaimers
            .map((d) => {
            const trigger = typeof d?.trigger === 'string' ? d.trigger.trim().toLowerCase() : '';
            const text = typeof d?.text === 'string' ? d.text.trim() : '';
            return trigger && text ? { trigger, text } : null;
        })
            .filter((x) => x !== null)
        : [];
    return {
        forbidden: arr(c.medicalForbiddenWords),
        blocked: arr(c.blockedTopics),
        disclaimers,
    };
}
/**
 * Admin-callable. Reads compliance rules from marketing_brand/main and runs
 * the supplied caption against them.
 */
function buildScoreMarketingDraft(allowList) {
    return functions
        .runWith({ memory: '256MB', timeoutSeconds: 30 })
        .https.onCall(async (data, context) => {
        if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
            throw new functions.https.HttpsError('permission-denied', 'Only admins with marketing access can score drafts.');
        }
        const caption = typeof data?.caption === 'string' ? data.caption : '';
        if (!caption.trim())
            return { ok: true, flags: [], requiredDisclaimers: [], passes: true };
        const brandSnap = await admin.firestore().doc('marketing_brand/main').get();
        const { forbidden, blocked, disclaimers } = loadRulesFrom(brandSnap.exists ? brandSnap.data() : {});
        const flags = [];
        for (const word of forbidden) {
            const idx = findPhrase(caption, word);
            if (idx >= 0)
                flags.push({ type: 'forbidden_word', phrase: word, index: idx });
        }
        for (const topic of blocked) {
            const idx = findPhrase(caption, topic);
            if (idx >= 0)
                flags.push({ type: 'blocked_topic', phrase: topic, index: idx });
        }
        const required = disclaimers
            .filter((d) => findPhrase(caption, d.trigger) >= 0)
            .map((d) => d.text);
        const dedupRequired = Array.from(new Set(required));
        const passes = flags.length === 0;
        return { ok: true, flags, requiredDisclaimers: dedupRequired, passes };
    });
}
