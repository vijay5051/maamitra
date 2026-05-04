// Boost-this-post (M6) — paid promotion via the Marketing API.
//
// Creates an "Ad" + "AdSet" + "Campaign" sequence on the Page-tied ad
// account, with the published IG post as the creative. Stores the
// resulting ids on the draft so we can poll spend/reach later.
//
// Flow when admin clicks "Boost this post":
//   1. Caller passes draftId + dailyBudgetInr + durationDays.
//   2. We require status='posted' + postIgMediaId on the draft.
//   3. Read META_AD_ACCOUNT_ID + access token from .env.
//   4. Create campaign → ad set → creative → ad. Activate.
//   5. Write draft.boost with adSetId + status='active'.
//
// Until the user adds META_AD_ACCOUNT_ID + a token with ads_management
// scope to functions/.env, the function returns a clear error explaining
// what's missing — same gated-graceful pattern as the other functions.

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID ?? '';
const META_IG_ACCESS_TOKEN = process.env.META_IG_ACCESS_TOKEN ?? '';
const META_IG_USER_ID = process.env.META_IG_USER_ID ?? '';
const META_FB_PAGE_ID = process.env.META_FB_PAGE_ID ?? '';
const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

interface BoostInput {
  draftId?: unknown;
  dailyBudgetInr?: unknown;
  durationDays?: unknown;
}

type BoostResult =
  | { ok: true; adSetId: string; status: string }
  | { ok: false; code: string; message: string };

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

interface GraphErrorBody { error?: { message?: string } }

async function postForm(url: string, params: URLSearchParams): Promise<any> {
  const res = await fetch(url, { method: 'POST', body: params });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as GraphErrorBody;
    throw new Error(`Graph ${res.status}: ${body?.error?.message ?? 'unknown'}`);
  }
  return res.json();
}

export function buildBoostMarketingDraft(allowList: ReadonlySet<string>) {
  return functions
    .runWith({ memory: '512MB', timeoutSeconds: 60 })
    .https.onCall(async (data: BoostInput, context): Promise<BoostResult> => {
      if (!(await callerIsMarketingAdmin(context.auth?.token, allowList))) {
        throw new functions.https.HttpsError('permission-denied', 'Admin only.');
      }
      if (!META_AD_ACCOUNT_ID || !META_IG_ACCESS_TOKEN || !META_FB_PAGE_ID) {
        return {
          ok: false,
          code: 'missing-creds',
          message: 'Boost requires META_AD_ACCOUNT_ID + META_FB_PAGE_ID + META_IG_ACCESS_TOKEN (with ads_management scope) in functions/.env. Add and redeploy.',
        };
      }
      const draftId = typeof data?.draftId === 'string' ? data.draftId : '';
      const dailyBudgetInr = typeof data?.dailyBudgetInr === 'number' ? Math.round(data.dailyBudgetInr) : 0;
      const durationDays = typeof data?.durationDays === 'number' ? Math.max(1, Math.min(7, Math.round(data.durationDays))) : 0;
      if (!draftId) return { ok: false, code: 'missing-draft', message: 'draftId required.' };
      if (dailyBudgetInr < 100) return { ok: false, code: 'budget-too-low', message: 'Minimum daily budget is ₹100.' };
      if (dailyBudgetInr > 5000) return { ok: false, code: 'budget-too-high', message: 'Max daily budget for now is ₹5000.' };
      if (durationDays < 1) return { ok: false, code: 'duration-invalid', message: 'Pick 1–7 days.' };

      const db = admin.firestore();
      const draftRef = db.doc(`marketing_drafts/${draftId}`);
      const draftSnap = await draftRef.get();
      if (!draftSnap.exists) return { ok: false, code: 'no-draft', message: 'Draft not found.' };
      const draft = draftSnap.data() as Record<string, any>;
      if (draft?.status !== 'posted') {
        return { ok: false, code: 'not-posted', message: `Draft must be posted before boosting (current status: ${draft?.status}).` };
      }
      if (!draft?.postIgMediaId) {
        return { ok: false, code: 'no-media-id', message: 'Posted draft is missing postIgMediaId — was it published before M3b shipped?' };
      }
      if (draft?.boost?.status === 'active') {
        return { ok: false, code: 'already-boosted', message: 'This post is already being boosted.' };
      }

      // Daily budget in paise (Marketing API expects min currency unit).
      const dailyBudgetPaise = dailyBudgetInr * 100;

      try {
        // 1. Campaign — POST_ENGAGEMENT objective.
        const campaign = await postForm(
          `${GRAPH_BASE}/act_${encodeURIComponent(META_AD_ACCOUNT_ID)}/campaigns`,
          new URLSearchParams({
            name: `Boost ${draftId} ${new Date().toISOString().slice(0, 10)}`,
            objective: 'OUTCOME_ENGAGEMENT',
            status: 'ACTIVE',
            special_ad_categories: '[]',
            access_token: META_IG_ACCESS_TOKEN,
          }),
        );
        const campaignId = campaign?.id;
        if (!campaignId) throw new Error('No campaign id returned');

        // 2. Ad set — daily budget, simple India targeting.
        const startTs = Math.floor(Date.now() / 1000);
        const endTs = startTs + durationDays * 86400;
        const targeting = JSON.stringify({
          geo_locations: { countries: ['IN'] },
          age_min: 18,
          age_max: 45,
          publisher_platforms: ['instagram'],
          instagram_positions: ['stream', 'story'],
        });
        const adSet = await postForm(
          `${GRAPH_BASE}/act_${encodeURIComponent(META_AD_ACCOUNT_ID)}/adsets`,
          new URLSearchParams({
            name: `Boost ${draftId} adset`,
            campaign_id: campaignId,
            daily_budget: String(dailyBudgetPaise),
            billing_event: 'IMPRESSIONS',
            optimization_goal: 'POST_ENGAGEMENT',
            bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
            targeting,
            start_time: String(startTs),
            end_time: String(endTs),
            status: 'ACTIVE',
            access_token: META_IG_ACCESS_TOKEN,
          }),
        );
        const adSetId = adSet?.id;
        if (!adSetId) throw new Error('No ad set id returned');

        // 3. Creative — uses the existing IG post.
        const creative = await postForm(
          `${GRAPH_BASE}/act_${encodeURIComponent(META_AD_ACCOUNT_ID)}/adcreatives`,
          new URLSearchParams({
            name: `Boost ${draftId} creative`,
            object_story_id: `${META_FB_PAGE_ID}_${draft.postIgMediaId}`,
            access_token: META_IG_ACCESS_TOKEN,
          }),
        );
        const creativeId = creative?.id;
        if (!creativeId) throw new Error('No creative id returned');

        // 4. Ad
        await postForm(
          `${GRAPH_BASE}/act_${encodeURIComponent(META_AD_ACCOUNT_ID)}/ads`,
          new URLSearchParams({
            name: `Boost ${draftId} ad`,
            adset_id: adSetId,
            creative: JSON.stringify({ creative_id: creativeId }),
            status: 'ACTIVE',
            access_token: META_IG_ACCESS_TOKEN,
          }),
        );

        const startedAt = new Date(startTs * 1000).toISOString();
        const endsAt = new Date(endTs * 1000).toISOString();

        await draftRef.update({
          boost: {
            adSetId,
            status: 'active',
            dailyBudgetInr,
            durationDays,
            spendInr: 0,
            reach: 0,
            startedAt,
            endsAt,
            error: null,
          },
        });

        return { ok: true, adSetId, status: 'active' };
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        await draftRef.update({
          boost: {
            adSetId: '',
            status: 'failed',
            dailyBudgetInr,
            durationDays,
            spendInr: 0,
            reach: 0,
            startedAt: new Date().toISOString(),
            endsAt: new Date(Date.now() + durationDays * 86400 * 1000).toISOString(),
            error: msg.slice(0, 400),
          },
        });
        return { ok: false, code: 'graph-failed', message: msg };
      }
    });
}

// Suppress unused-warn until M6b uses META_IG_USER_ID for FB-side polling.
void META_IG_USER_ID;
