// Crisis-language detection for user-generated content.
//
// MaaMitra users sometimes post about postpartum depression, suicidal
// ideation, or domestic abuse. The right response is NEVER to silently
// hide such posts — that compounds the harm. Instead:
//
//   1. The post still publishes (community support helps).
//   2. A copy is queued in `crisis_queue` for admin/wellness outreach.
//   3. A non-blocking in-app card is shown to the author with the
//      Vandrevala helpline (1860-2662-345) and a "you're not alone"
//      message.
//
// This module is the keyword pass — pattern-matching only. A future
// model-based pass could replace it but the keyword pass is good
// enough to catch obvious cases and miss noisy/ambiguous ones (which
// is the right error direction for safety: prefer to escalate too
// little than too much, since the queue requires admin time).

import { CrisisSeverity } from './adminEnums';

export interface CrisisFinding {
  severity: CrisisSeverity;
  /** The matched terms — useful for the admin queue card. */
  matches: string[];
  /** Free-form category for routing (PPD, self-harm, abuse, etc.). */
  categories: Array<'self_harm' | 'ppd' | 'abuse' | 'eating_disorder'>;
}

// Severity escalates if multiple categories hit — even if each individual
// term is "medium", multiple categories together signal a more urgent post.
type Pattern = {
  severity: CrisisSeverity;
  category: CrisisFinding['categories'][number];
  /** Lowercased; whole-word match unless the entry contains a space. */
  terms: string[];
};

const PATTERNS: Pattern[] = [
  // ─── Self-harm ────────────────────────────────────────────────────────
  {
    severity: 'critical',
    category: 'self_harm',
    terms: [
      'kill myself', 'killing myself', 'kms',
      'suicide', 'suicidal', 'end my life', 'ending my life',
      'want to die', 'wanna die', 'better off dead',
      'cant go on', 'can\'t go on', 'cannot go on',
    ],
  },
  // ─── PPD / depression ─────────────────────────────────────────────────
  {
    severity: 'high',
    category: 'ppd',
    terms: [
      'postpartum depression', 'ppd',
      'hate my baby', 'hate the baby', 'resent my baby',
      'cant bond', 'can\'t bond',
      'no will to live', 'feeling hopeless', 'empty inside',
      'crying every day', 'crying everyday', 'crying constantly',
    ],
  },
  // ─── Abuse / DV ───────────────────────────────────────────────────────
  {
    severity: 'high',
    category: 'abuse',
    terms: [
      'beats me', 'hits me', 'slaps me',
      'husband hits', 'mil hits', 'hits my baby', 'beats my baby',
      'scared of him', 'afraid of him',
      'controlling husband', 'verbally abusive', 'emotionally abusive',
    ],
  },
  // ─── Eating disorder (mom/postpartum context) ─────────────────────────
  {
    severity: 'medium',
    category: 'eating_disorder',
    terms: [
      'cant eat', 'can\'t eat', 'havent eaten', 'haven\'t eaten',
      'lost so much weight', 'losing too much weight',
      'making myself sick', 'purging',
    ],
  },
];

const SEVERITY_RANK: Record<CrisisSeverity, number> = {
  low: 0, medium: 1, high: 2, critical: 3,
};

function escalate(a: CrisisSeverity, b: CrisisSeverity): CrisisSeverity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

export function detectCrisis(input: string | null | undefined): CrisisFinding | null {
  if (!input) return null;
  const text = input.toLowerCase();
  const matches: string[] = [];
  const categories = new Set<CrisisFinding['categories'][number]>();
  let severity: CrisisSeverity = 'low';

  for (const p of PATTERNS) {
    for (const term of p.terms) {
      if (text.includes(term)) {
        matches.push(term);
        categories.add(p.category);
        severity = escalate(severity, p.severity);
      }
    }
  }

  if (matches.length === 0) return null;

  // Multiple distinct categories → bump severity. Two unrelated red flags
  // (e.g. self-harm AND abuse) is more urgent than two PPD phrases.
  if (categories.size >= 2 && SEVERITY_RANK[severity] < SEVERITY_RANK.critical) {
    severity = severity === 'medium' ? 'high' : severity === 'high' ? 'critical' : severity;
  }

  return { severity, matches, categories: Array.from(categories) };
}

/** India-specific crisis hotline. Shown to authors of flagged posts. */
export const CRISIS_HOTLINE = {
  name: 'Vandrevala Foundation',
  phone: '1860-2662-345',
  message: 'You don\'t have to go through this alone. Free, 24/7, confidential.',
};
