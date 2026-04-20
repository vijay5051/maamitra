/**
 * Audience tagging — part of Option A (role-adaptive content).
 *
 * Each piece of content (articles, yoga sessions, schemes, milestones,
 * quick actions) carries an optional `audience` tag that declares who
 * the content is written for. At render time we filter by the logged-in
 * user's parentGender:
 *
 *   - 'mother'     → mother-only content (lactation, postpartum, etc.)
 *   - 'father'     → father-only content (how to support mum, etc.)
 *   - 'caregiver'  → non-parent caregiver content
 *   - 'all'        → shown to everyone (default when untagged)
 *
 * Content authored BEFORE we started tagging has no audience field — it
 * falls back to 'all', so nothing visually changes until pieces are
 * explicitly tagged. That's deliberate: we can layer father content in
 * gradually without a single flip-the-switch release.
 *
 * ROLE_LOCK: once `parentGender` is set at signup it cannot be changed
 * from the app UI. See SettingsModal → Edit Profile for the locked
 * read-only display. The explicit lock keeps the content variant stable
 * — if a user's view flipped between role versions, milestones, saved
 * answers, and AI history would read as wildly different from day to
 * day. Lock prevents that confusion.
 */

import type { ParentGender } from '../store/useProfileStore';

export type Audience = 'mother' | 'father' | 'caregiver' | 'all';

/**
 * Feature flag. While false, `filterByAudience` returns every item
 * unchanged — UI behaviour is identical to before we introduced the
 * audience concept. Flip to true once we have enough content tagged
 * to make the filtered-down view worth the context loss.
 *
 * Kept in code (not Firestore) for now so toggling it requires a deploy
 * — no risk of a misconfigured remote flag wiping half the content.
 */
export const ENABLE_ROLE_ADAPTIVE_CONTENT = true;

/** Map the stored ParentGender ('mother' | 'father' | 'other' | '') to
 *  the Audience enum. Empty / unknown defaults to 'mother' (our default
 *  user) — but `filterByAudience` always keeps 'all' items regardless,
 *  so even an edge-case mis-map renders something useful. */
export function parentGenderToAudience(pg: ParentGender): Audience {
  if (pg === 'father') return 'father';
  if (pg === 'other') return 'caregiver';
  // Includes '' and 'mother'
  return 'mother';
}

/**
 * Keep items that match the viewer's audience. Untagged items (no
 * `audience` field, or `audience === 'all'`) always stay.
 *
 * Example:
 *   const list = filterByAudience(ARTICLES, 'father');
 *   // → every article tagged 'father' plus every untagged/'all' article
 */
export function filterByAudience<T extends { audience?: Audience }>(
  items: T[],
  viewer: Audience,
): T[] {
  if (!ENABLE_ROLE_ADAPTIVE_CONTENT) return items;
  return items.filter((it) => {
    const a = it.audience;
    return !a || a === 'all' || a === viewer;
  });
}
