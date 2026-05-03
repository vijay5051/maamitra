// PII auto-redaction for user-generated content (posts, comments, DMs).
//
// MaaMitra is a mother/baby app — users frequently slip in phone numbers
// ("WhatsApp me at 98xxx"), home addresses, or other identifiable details
// that shouldn't live in a public feed. This module scrubs the obvious
// stuff before the content hits Firestore.
//
// Conservative: false-positives are visible to the author (their number
// turns into ▒▒▒▒▒) but the author can re-edit. False-negatives are
// the worry — keep the regex tight rather than aggressive.
//
// What we redact:
//   - Indian mobile numbers (10 digits starting 6/7/8/9, with optional
//     +91 / 91 / 0 prefix and arbitrary spaces / dashes / dots).
//   - Email addresses.
//   - Aadhaar-shaped strings (12 digits, often grouped 4-4-4).
//   - PAN-shaped strings (5 letters, 4 digits, 1 letter).
//
// What we DON'T redact (yet):
//   - Postal addresses — too varied to regex without false-positives.
//     A future model-based pass could handle this.
//   - Names and ages — these are often the whole point of a community
//     post ("Aarav is 6 months old today").

export interface RedactionResult {
  text: string;
  /** Categories of PII that were redacted. */
  found: Array<'phone' | 'email' | 'aadhaar' | 'pan'>;
  /** True if any redaction happened. */
  redacted: boolean;
}

const MASK = '▒▒▒▒▒';

// 10-digit mobile (India) with optional +91 / 91 / 0 prefix and spaces / -- / dots.
// Conservative: requires the leading digit to be 6/7/8/9 to avoid mangling
// random year strings like "2024-06-15".
const PHONE_RE = /(?:(?:\+|00)?91[-\s.]?|0)?[6-9]\d{2}[-\s.]?\d{3}[-\s.]?\d{4}\b/g;

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

const AADHAAR_RE = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g;

const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;

export function redactPII(input: string | null | undefined): RedactionResult {
  if (!input) return { text: '', found: [], redacted: false };
  const found = new Set<RedactionResult['found'][number]>();
  let text = input;

  if (PHONE_RE.test(text)) found.add('phone');
  text = text.replace(PHONE_RE, MASK);

  if (EMAIL_RE.test(text)) found.add('email');
  text = text.replace(EMAIL_RE, MASK);

  if (AADHAAR_RE.test(text)) found.add('aadhaar');
  text = text.replace(AADHAAR_RE, MASK);

  if (PAN_RE.test(text)) found.add('pan');
  text = text.replace(PAN_RE, MASK);

  return { text, found: Array.from(found), redacted: found.size > 0 };
}

/** Quick boolean — does the text contain any maskable PII? */
export function containsPII(text: string | null | undefined): boolean {
  return redactPII(text).redacted;
}
