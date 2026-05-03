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

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

export interface ComplianceFlag {
  type: 'forbidden_word' | 'blocked_topic';
  phrase: string;
  index: number;
}

interface DisclaimerRuleRaw {
  trigger?: unknown;
  text?: unknown;
}

interface ComplianceRulesRaw {
  medicalForbiddenWords?: unknown;
  requiredDisclaimers?: unknown;
  blockedTopics?: unknown;
}

interface ScoreInput {
  caption?: unknown;
}

interface ScoreOk {
  ok: true;
  flags: ComplianceFlag[];
  requiredDisclaimers: string[];
  passes: boolean;
}

interface ScoreErr {
  ok: false;
  code: string;
  message: string;
}

type ScoreResult = ScoreOk | ScoreErr;

async function callerIsMarketingAdmin(
  token: admin.auth.DecodedIdToken | undefined,
  allowList: ReadonlySet<string>,
): Promise<boolean> {
  if (!token) return false;
  if (token.admin === true) return true;
  if (token.email_verified === true && token.email && allowList.has(token.email.toLowerCase())) return true;
  if (!token.uid) return false;
  try {
    const snap = await admin.firestore().doc(`users/${token.uid}`).get();
    const role = snap.exists ? (snap.data() as any)?.adminRole : null;
    return role === 'super' || role === 'content';
  } catch {
    return false;
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word, case-insensitive match. Returns char index of first match. */
function findPhrase(haystack: string, phrase: string): number {
  if (!phrase) return -1;
  // For multi-word phrases we anchor on whitespace; for single words we use
  // \b so "cure" doesn't fire inside "manicure".
  const isWord = /^\w+$/.test(phrase);
  const re = isWord
    ? new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'i')
    : new RegExp(escapeRegex(phrase), 'i');
  const m = re.exec(haystack);
  return m ? m.index : -1;
}

function loadRulesFrom(data: any): {
  forbidden: string[];
  blocked: string[];
  disclaimers: { trigger: string; text: string }[];
} {
  const c = (data?.compliance ?? {}) as ComplianceRulesRaw;
  const arr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.map((x) => (typeof x === 'string' ? x.trim().toLowerCase() : '')).filter(Boolean)
      : [];
  const disclaimers: { trigger: string; text: string }[] = Array.isArray(c.requiredDisclaimers)
    ? (c.requiredDisclaimers as DisclaimerRuleRaw[])
        .map((d): { trigger: string; text: string } | null => {
          const trigger = typeof d?.trigger === 'string' ? d.trigger.trim().toLowerCase() : '';
          const text = typeof d?.text === 'string' ? d.text.trim() : '';
          return trigger && text ? { trigger, text } : null;
        })
        .filter((x): x is { trigger: string; text: string } => x !== null)
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
export function buildScoreMarketingDraft(allowList: ReadonlySet<string>) {
  return functions
    .runWith({ memory: '256MB', timeoutSeconds: 30 })
    .https.onCall(async (data: ScoreInput, context): Promise<ScoreResult> => {
      if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins with marketing access can score drafts.');
      }
      const caption = typeof data?.caption === 'string' ? data.caption : '';
      if (!caption.trim()) return { ok: true, flags: [], requiredDisclaimers: [], passes: true };

      const brandSnap = await admin.firestore().doc('marketing_brand/main').get();
      const { forbidden, blocked, disclaimers } = loadRulesFrom(brandSnap.exists ? brandSnap.data() : {});

      const flags: ComplianceFlag[] = [];
      for (const word of forbidden) {
        const idx = findPhrase(caption, word);
        if (idx >= 0) flags.push({ type: 'forbidden_word', phrase: word, index: idx });
      }
      for (const topic of blocked) {
        const idx = findPhrase(caption, topic);
        if (idx >= 0) flags.push({ type: 'blocked_topic', phrase: topic, index: idx });
      }

      const required = disclaimers
        .filter((d) => findPhrase(caption, d.trigger) >= 0)
        .map((d) => d.text);
      const dedupRequired = Array.from(new Set(required));

      const passes = flags.length === 0;
      return { ok: true, flags, requiredDisclaimers: dedupRequired, passes };
    });
}
