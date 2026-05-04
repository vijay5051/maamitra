// First-visit attribution capture (M6b).
//
// Two surfaces:
//   captureFirstVisitAttribution() — runs on every web page load. Reads
//     UTM params + referrer from the URL/document. If the visitor doesn't
//     already have a captured attribution in localStorage, stores one.
//     Subsequent visits no-op so a returning user can't overwrite their
//     own first-touch source.
//
//   writeAttributionToUser(uid) — runs once per session after auth lands.
//     Reads the localStorage capture (if any) and writes it onto
//     users/{uid}.attribution with merge:true. Skips when the user already
//     has attribution set so we never overwrite first-touch with later-touch.
//
// Why first-touch and not last-touch — for organic acquisition the first
// click that brought a visitor to the app is the question we want to
// answer ("which IG post earned this user?"). Later visits from the same
// device shouldn't re-attribute.
//
// Native (iOS / Android) is a no-op for now. Mobile install attribution
// would need a deep-link / install-referrer pipeline; for v1 the web
// signup path covers the bulk of acquisitions from IG/FB bio links.

import { Platform } from 'react-native';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from './firebase';

const LS_KEY = 'maamitra.attribution.firstTouch';

export interface AttributionCapture {
  /** ISO timestamp of the first capture. */
  capturedAt: string;
  /** UTM block — null when the param was absent on the source URL. */
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  /** document.referrer at first visit (cross-domain; usually present for IG/FB clicks). */
  referrer: string | null;
  /** Landing path at first visit (without origin) — e.g. "/?utm_source=instagram". */
  landingPath: string | null;
}

/** Read UTMs from the current URL. Web-only. Idempotent: subsequent calls
 *  do not overwrite an existing capture. */
export function captureFirstVisitAttribution(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const existing = window.localStorage?.getItem(LS_KEY);
    if (existing) return; // first-touch wins.

    const url = new URL(window.location.href);
    const sp = url.searchParams;
    const get = (k: string): string | null => {
      const v = sp.get(k);
      return v && v.trim() ? v.trim().slice(0, 200) : null;
    };

    const cap: AttributionCapture = {
      capturedAt: new Date().toISOString(),
      source: get('utm_source'),
      medium: get('utm_medium'),
      campaign: get('utm_campaign'),
      content: get('utm_content'),
      term: get('utm_term'),
      referrer: typeof document !== 'undefined' && document.referrer ? document.referrer.slice(0, 500) : null,
      landingPath: (url.pathname + url.search).slice(0, 500),
    };

    // Only persist when there's at least one signal worth recording.
    // Direct visits with no UTM and no cross-domain referrer aren't useful
    // attribution data and would just bloat user docs.
    const hasSignal =
      cap.source || cap.medium || cap.campaign || cap.content || cap.term ||
      (cap.referrer && !cap.referrer.startsWith(window.location.origin));
    if (!hasSignal) return;

    window.localStorage?.setItem(LS_KEY, JSON.stringify(cap));
  } catch {
    // Privacy/incognito modes can throw on localStorage; safe to swallow.
  }
}

/** Read the captured attribution out of localStorage. Web-only; native
 *  always returns null. */
export function readCapturedAttribution(): AttributionCapture | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage?.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as AttributionCapture;
  } catch {
    return null;
  }
}

/** Write the captured attribution onto users/{uid}.attribution if and only
 *  if the user doesn't already have one. Idempotent; safe to call on every
 *  auth-state-changed firing. */
export async function writeAttributionToUser(uid: string): Promise<void> {
  if (!uid || !db) return;
  const cap = readCapturedAttribution();
  if (!cap) return;
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (snap.exists() && (snap.data() as any)?.attribution) return; // first-touch wins server-side too.
    await setDoc(ref, {
      attribution: { ...cap, writtenAt: serverTimestamp() },
    }, { merge: true });
  } catch {
    // Pre-onboarding writes can race with rules — silent retry on next session.
  }
}

// ── UTM URL builder for outbound posts ─────────────────────────────────────
// Used by the Drafts slide-over to give admin a one-click "Copy bio link"
// affordance per posted draft. The draftId is the campaign so analytics
// can join attribution back to the post that earned the user.

export interface BioLinkInput {
  /** Draft id — feeds utm_campaign so attribution joins back to the draft. */
  draftId: string;
  /** Optional headline → slugified into utm_content for human-readability
   *  in analytics dashboards. */
  headline?: string | null;
  /** Origin to point at — defaults to the production marketing site. */
  origin?: string;
  /** Channel — IG or FB. Defaults to 'instagram'. */
  channel?: 'instagram' | 'facebook';
}

export function buildBioLink(input: BioLinkInput): string {
  const origin = (input.origin ?? 'https://maamitra.co.in').replace(/\/+$/, '');
  const channel = input.channel ?? 'instagram';
  const sp = new URLSearchParams();
  sp.set('utm_source', channel);
  sp.set('utm_medium', 'social');
  sp.set('utm_campaign', input.draftId);
  if (input.headline) {
    const slug = input.headline.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    if (slug) sp.set('utm_content', slug);
  }
  return `${origin}/?${sp.toString()}`;
}
