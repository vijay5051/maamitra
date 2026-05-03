// Safety service — wraps the PII redaction + crisis detection pipeline.
//
// Called from post / comment creation paths in services/social.ts. Side
// effects:
//   - Returns the cleaned text (PII masked) for the actual write.
//   - Emits a crisis_queue/{auto-id} doc when crisis language is detected.
//   - Honours moderation.requireApproval from the runtime config — when
//     true, returns shouldHold=true so the caller writes the post with
//     pending=true / approved=false.
//
// The Firestore writes here use the user's own credentials (the post
// author). The crisis_queue rules grant admin read-all + author-create-only,
// so a malicious user can't read other users' crisis flags.

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

import { db } from './firebase';
import { containsPII, redactPII, RedactionResult } from '../lib/piiRedact';
import { detectCrisis, CrisisFinding } from '../lib/crisisDetect';
import { useRuntimeConfigStore } from '../store/useRuntimeConfigStore';

export interface SafetyEvalResult {
  /** Text after PII redaction. Always use THIS in the actual write. */
  cleanedText: string;
  pii: RedactionResult;
  crisis: CrisisFinding | null;
  /** True when moderation.requireApproval is on. Caller must hold the post. */
  shouldHold: boolean;
  /** True when moderation.autoHideKeywords matched. Caller writes hidden=true. */
  shouldAutoHide: boolean;
  matchedKeyword: string | null;
}

export interface SafetyContext {
  uid: string;
  authorName?: string | null;
  /** Where the content lives. For routing in the admin queue. */
  source: 'community_post' | 'comment' | 'message';
  /** Optional doc id once written — included in crisis_queue meta. */
  docId?: string;
}

export function evaluateContent(
  rawText: string,
  ctx: SafetyContext,
): SafetyEvalResult {
  const pii = redactPII(rawText);
  const cleanedText = pii.text;
  const crisis = detectCrisis(rawText); // detect on RAW text, not cleaned —
                                         // PII mask doesn't change crisis meaning.

  const cfg = useRuntimeConfigStore.getState().config.moderation;

  // Auto-hide keyword scan (case-insensitive substring match)
  let matchedKeyword: string | null = null;
  if (cfg.autoHideKeywords && cfg.autoHideKeywords.length > 0) {
    const haystack = rawText.toLowerCase();
    for (const k of cfg.autoHideKeywords) {
      if (haystack.includes(k.toLowerCase())) {
        matchedKeyword = k;
        break;
      }
    }
  }

  return {
    cleanedText,
    pii,
    crisis,
    shouldHold: !!cfg.requireApproval,
    shouldAutoHide: !!matchedKeyword,
    matchedKeyword,
  };
}

/**
 * Side-effect: file the crisis_queue doc when applicable.
 * Best-effort; never throws.
 */
export async function fileCrisisFinding(
  rawText: string,
  finding: CrisisFinding,
  ctx: SafetyContext,
): Promise<void> {
  if (!db) return;
  try {
    await addDoc(collection(db, 'crisis_queue'), {
      authorUid: ctx.uid,
      authorName: ctx.authorName ?? null,
      source: ctx.source,
      docId: ctx.docId ?? null,
      severity: finding.severity,
      categories: finding.categories,
      matches: finding.matches.slice(0, 12),
      // Never persist the full message body to crisis_queue — that's a
      // separate read-permission scope from the original post and
      // accidentally amplifies access to the user's vulnerable text.
      // We store a truncated snippet for triage and let the admin
      // open the source doc for context.
      snippet: rawText.slice(0, 240),
      status: 'open',
      assignedTo: null,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    // Don't bubble — the user-facing post creation must not fail because
    // we couldn't queue a wellness escalation.
    console.warn('fileCrisisFinding failed:', e);
  }
}

/** Convenience: full pipeline in one call. */
export async function processContent(
  rawText: string,
  ctx: SafetyContext,
): Promise<SafetyEvalResult> {
  const r = evaluateContent(rawText, ctx);
  if (r.crisis) {
    // Fire-and-forget; we already returned the eval to the caller.
    void fileCrisisFinding(rawText, r.crisis, ctx);
  }
  return r;
}

/** Re-export so callers don't need a second import. */
export { containsPII, redactPII } from '../lib/piiRedact';
export { detectCrisis, CRISIS_HOTLINE } from '../lib/crisisDetect';
