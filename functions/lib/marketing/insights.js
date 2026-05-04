"use strict";
// Insights polling + weekly digest (M5 + M4c).
//
// pollMarketingInsights        — pubsub every 6h. For each posted draft
//                                in the last 30d, hits IG Insights API and
//                                stores a snapshot in marketing_drafts/{id}/
//                                insights/{ts}, denormalising the latest
//                                values to the parent draft for fast queries.
//                                When the draft was also published to FB
//                                (postFbPostId set), pulls FB Page Insights
//                                in the same loop and stores under
//                                latestFbInsights + insights_fb/{ts}.
//
// pollMarketingAccountInsights — daily at 03:00 IST (= 21:30 UTC). Pulls
//                                follower count + reach for the IG account
//                                AND fan_count + page reach/impressions
//                                for the linked FB Page.
//
// generateWeeklyInsightDigest  — pubsub every Monday 08:00 IST (= 02:30
//                                UTC). LLM commentary on the past week +
//                                3 actionable recommendations stored at
//                                marketing_insights/{weekId}. Sums IG+FB
//                                reach for the totals.
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
exports.buildPollMarketingInsights = buildPollMarketingInsights;
exports.buildPollMarketingAccountInsights = buildPollMarketingAccountInsights;
exports.buildGenerateWeeklyInsightDigest = buildGenerateWeeklyInsightDigest;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const publisher_1 = require("./publisher");
const integrationConfig_1 = require("../lib/integrationConfig");
const GRAPH_BASE = 'https://graph.facebook.com/v21.0';
async function getInsightsVars() {
    const cfg = await (0, integrationConfig_1.getIntegrationConfig)();
    const fbPAT = cfg.meta.fbPageAccessToken;
    const igToken = cfg.meta.igAccessToken;
    return {
        META_IG_USER_ID: cfg.meta.igUserId,
        META_FB_PAGE_ID: cfg.meta.fbPageId,
        IG_GRAPH_TOKEN: (fbPAT && fbPAT.startsWith('EAA')) ? fbPAT : igToken,
        FB_CONFIGURED: !!cfg.meta.fbPageId && !!fbPAT,
        OPENAI_API_KEY: cfg.openai.apiKey,
    };
}
const ZERO_METRICS = {
    reach: 0, impressions: 0, likes: 0, comments: 0, saved: 0, shares: 0, profileVisits: 0,
};
// FB Page post insights — two calls because the /insights endpoint gives
// reach + impressions + clicks but not likes/comments/shares. The post
// node with .summary(true) gives those engagement counts directly. Map
// both into the same PostInsightMetrics shape so the analytics service
// can sum across IG + FB without per-platform branches.
async function fetchFbPostMetrics(fbPostId) {
    const { FB_CONFIGURED } = await getInsightsVars();
    if (!FB_CONFIGURED)
        return null;
    let pat;
    try {
        pat = await (0, publisher_1.getFbPagePat)();
    }
    catch (e) {
        console.warn(`[pollMarketingInsights] FB PAT derive failed for ${fbPostId}:`, e);
        return null;
    }
    try {
        // Engagement counts via the post node — likes, comments, shares.
        const summaryUrl = `${GRAPH_BASE}/${fbPostId}?fields=likes.summary(true).limit(0),comments.summary(true).limit(0),shares,reactions.summary(true).limit(0)&access_token=${encodeURIComponent(pat)}`;
        const sumRes = await fetch(summaryUrl);
        if (!sumRes.ok) {
            const body = await sumRes.text();
            console.warn(`[pollMarketingInsights] FB summary ${fbPostId} ${sumRes.status}:`, body.slice(0, 200));
            return null;
        }
        const sum = (await sumRes.json());
        // Reach + impressions via /insights. Some FB Pages return permission
        // errors on certain metrics — request what's available and zero-fill.
        const metrics = ['post_impressions', 'post_impressions_unique'];
        const insUrl = `${GRAPH_BASE}/${fbPostId}/insights?metric=${metrics.join(',')}&access_token=${encodeURIComponent(pat)}`;
        const insRes = await fetch(insUrl);
        let reach = 0;
        let impressions = 0;
        if (insRes.ok) {
            const ins = (await insRes.json());
            for (const m of ins.data ?? []) {
                const v = m.values?.[0]?.value ?? 0;
                if (m.name === 'post_impressions')
                    impressions = v;
                if (m.name === 'post_impressions_unique')
                    reach = v;
            }
        }
        else {
            // Insights perm denied is common on small Pages — fall back silently.
            const body = await insRes.text();
            console.warn(`[pollMarketingInsights] FB insights ${fbPostId} ${insRes.status} (using engagement-only):`, body.slice(0, 200));
        }
        // FB reactions.summary covers likes + love + wow + haha + sad + angry,
        // which is the closer analogue to IG "likes" (which also includes
        // hearts + saves on Reels). Falls back to likes-only if reactions missing.
        const likesTotal = sum.reactions?.summary?.total_count ?? sum.likes?.summary?.total_count ?? 0;
        return {
            reach,
            impressions,
            likes: likesTotal,
            comments: sum.comments?.summary?.total_count ?? 0,
            saved: 0, // FB has no equivalent of IG saves
            shares: sum.shares?.count ?? 0,
            profileVisits: 0, // Page-level, not per-post
        };
    }
    catch (e) {
        console.warn(`[pollMarketingInsights] FB ${fbPostId} fetch threw`, e);
        return null;
    }
}
async function fetchPostMetrics(igMediaId) {
    const { IG_GRAPH_TOKEN } = await getInsightsVars();
    if (!IG_GRAPH_TOKEN)
        return null;
    const metrics = ['reach', 'impressions', 'likes', 'comments', 'saved', 'shares', 'profile_visits'];
    const url = `${GRAPH_BASE}/${igMediaId}/insights?metric=${metrics.join(',')}&access_token=${encodeURIComponent(IG_GRAPH_TOKEN)}`;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            const body = await res.text();
            console.warn(`[pollMarketingInsights] ${igMediaId} ${res.status}:`, body.slice(0, 200));
            return null;
        }
        const data = (await res.json());
        const out = { ...ZERO_METRICS };
        for (const m of data.data ?? []) {
            const v = m.values?.[0]?.value ?? 0;
            switch (m.name) {
                case 'reach':
                    out.reach = v;
                    break;
                case 'impressions':
                    out.impressions = v;
                    break;
                case 'likes':
                    out.likes = v;
                    break;
                case 'comments':
                    out.comments = v;
                    break;
                case 'saved':
                    out.saved = v;
                    break;
                case 'shares':
                    out.shares = v;
                    break;
                case 'profile_visits':
                    out.profileVisits = v;
                    break;
            }
        }
        return out;
    }
    catch (e) {
        console.warn(`[pollMarketingInsights] ${igMediaId} fetch threw`, e);
        return null;
    }
}
function buildPollMarketingInsights() {
    return functions
        .runWith({ memory: '512MB', timeoutSeconds: 540 })
        .pubsub.schedule('every 6 hours')
        .onRun(async () => {
        const { META_IG_USER_ID, IG_GRAPH_TOKEN } = await getInsightsVars();
        if (!META_IG_USER_ID || !IG_GRAPH_TOKEN) {
            console.log('[pollMarketingInsights] IG creds missing — skipping cycle');
            return null;
        }
        const db = admin.firestore();
        const cutoffMs = Date.now() - 30 * 24 * 3600 * 1000;
        const cutoffIso = new Date(cutoffMs).toISOString();
        const due = await db
            .collection('marketing_drafts')
            .where('status', '==', 'posted')
            .where('postedAt', '>=', cutoffIso)
            .limit(50)
            .get();
        if (due.empty) {
            console.log('[pollMarketingInsights] no posts in last 30d');
            return null;
        }
        console.log(`[pollMarketingInsights] polling ${due.size} posts`);
        for (const docSnap of due.docs) {
            const data = docSnap.data();
            if (data?.isSynthetic === true)
                continue;
            const postedIso = tsAsIso(data?.postedAt) ?? new Date().toISOString();
            const hoursSincePost = Math.max(0, (Date.now() - new Date(postedIso).getTime()) / 3600000);
            const fetchedAt = admin.firestore.FieldValue.serverTimestamp();
            const update = {};
            // ── IG ────────────────────────────────────────────────────────────
            const mediaId = typeof data?.postIgMediaId === 'string'
                ? data.postIgMediaId
                : extractMediaIdFromPermalink(data?.postPermalinks?.instagram);
            if (mediaId) {
                const metrics = await fetchPostMetrics(mediaId);
                if (metrics) {
                    await docSnap.ref.collection('insights').doc().set({
                        ...metrics,
                        fetchedAt,
                        hoursSincePost: Math.round(hoursSincePost * 10) / 10,
                    });
                    update.latestInsights = metrics;
                    update.latestInsightsAt = fetchedAt;
                }
            }
            // ── FB Page (M4c) ────────────────────────────────────────────────
            const fbPostId = typeof data?.postFbPostId === 'string' ? data.postFbPostId : null;
            if (fbPostId) {
                const fbMetrics = await fetchFbPostMetrics(fbPostId);
                if (fbMetrics) {
                    await docSnap.ref.collection('insights_fb').doc().set({
                        ...fbMetrics,
                        fetchedAt,
                        hoursSincePost: Math.round(hoursSincePost * 10) / 10,
                    });
                    update.latestFbInsights = fbMetrics;
                    update.latestFbInsightsAt = fetchedAt;
                }
            }
            if (Object.keys(update).length > 0)
                await docSnap.ref.update(update);
        }
        return null;
    });
}
function extractMediaIdFromPermalink(permalink) {
    // IG permalinks look like https://www.instagram.com/p/<shortcode>/
    // We can't derive media id from shortcode without a second API call, so
    // this returns null — the publisher SHOULD store postIgMediaId at publish
    // time. Until that's added, posts published before this runs won't have
    // insights; we'll backfill from the next M3b publish onwards.
    void permalink;
    return null;
}
function tsAsIso(ts) {
    if (!ts)
        return null;
    if (typeof ts?.toDate === 'function') {
        try {
            return ts.toDate().toISOString();
        }
        catch {
            return null;
        }
    }
    if (typeof ts === 'string')
        return ts;
    return null;
}
// FB Page snapshot — fan count is on the page node; daily reach +
// impressions come from /insights with period=day. We pull yesterday's
// values to match the IG snapshot semantics.
async function fetchFbAccountSnapshot() {
    const { FB_CONFIGURED, META_FB_PAGE_ID } = await getInsightsVars();
    if (!FB_CONFIGURED)
        return null;
    let pat;
    try {
        pat = await (0, publisher_1.getFbPagePat)();
    }
    catch (e) {
        console.warn('[pollMarketingAccountInsights] FB PAT derive failed:', e);
        return null;
    }
    try {
        // fan_count via the page node. (followers_count is the newer field
        // but fan_count is more reliably populated for older pages.)
        const pageRes = await fetch(`${GRAPH_BASE}/${META_FB_PAGE_ID}?fields=fan_count,followers_count&access_token=${encodeURIComponent(pat)}`);
        if (!pageRes.ok) {
            console.warn('[pollMarketingAccountInsights] FB page node failed', await pageRes.text());
            return null;
        }
        const page = (await pageRes.json());
        const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
        const insRes = await fetch(`${GRAPH_BASE}/${META_FB_PAGE_ID}/insights?metric=page_impressions,page_impressions_unique&period=day&since=${yesterday}&until=${yesterday}&access_token=${encodeURIComponent(pat)}`);
        let reach = 0;
        let impressions = 0;
        if (insRes.ok) {
            const ins = (await insRes.json());
            for (const m of ins.data ?? []) {
                const v = m.values?.[0]?.value ?? 0;
                if (m.name === 'page_impressions')
                    impressions = v;
                if (m.name === 'page_impressions_unique')
                    reach = v;
            }
        }
        else {
            // Insights perms can be flaky on small Pages — keep the fan count.
            console.warn('[pollMarketingAccountInsights] FB insights failed', await insRes.text());
        }
        return {
            fanCount: page.followers_count ?? page.fan_count ?? 0,
            reach,
            impressions,
        };
    }
    catch (e) {
        console.warn('[pollMarketingAccountInsights] FB threw', e);
        return null;
    }
}
async function fetchAccountSnapshot() {
    const { META_IG_USER_ID, IG_GRAPH_TOKEN } = await getInsightsVars();
    if (!META_IG_USER_ID || !IG_GRAPH_TOKEN)
        return null;
    try {
        // Follower count is on the user node directly.
        const userRes = await fetch(`${GRAPH_BASE}/${META_IG_USER_ID}?fields=followers_count&access_token=${encodeURIComponent(IG_GRAPH_TOKEN)}`);
        if (!userRes.ok) {
            console.warn('[pollMarketingAccountInsights] user node failed', await userRes.text());
            return null;
        }
        const user = (await userRes.json());
        // Daily reach + impressions for yesterday.
        const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
        const insRes = await fetch(`${GRAPH_BASE}/${META_IG_USER_ID}/insights?metric=reach,impressions&period=day&since=${yesterday}&until=${yesterday}&access_token=${encodeURIComponent(IG_GRAPH_TOKEN)}`);
        let reach = 0;
        let impressions = 0;
        if (insRes.ok) {
            const ins = (await insRes.json());
            for (const m of ins.data ?? []) {
                const v = m.values?.[0]?.value ?? 0;
                if (m.name === 'reach')
                    reach = v;
                if (m.name === 'impressions')
                    impressions = v;
            }
        }
        return {
            followerCount: user.followers_count ?? 0,
            reach,
            impressions,
        };
    }
    catch (e) {
        console.warn('[pollMarketingAccountInsights] threw', e);
        return null;
    }
}
function buildPollMarketingAccountInsights() {
    return functions
        .runWith({ memory: '256MB', timeoutSeconds: 60 })
        .pubsub.schedule('30 21 * * *')
        .timeZone('UTC')
        .onRun(async () => {
        const [igSnap, fbSnap] = await Promise.all([
            fetchAccountSnapshot(),
            fetchFbAccountSnapshot(),
        ]);
        if (!igSnap && !fbSnap) {
            console.log('[pollMarketingAccountInsights] no snapshot');
            return null;
        }
        const db = admin.firestore();
        const today = new Date().toISOString().slice(0, 10);
        const docRef = db.doc(`marketing_account_insights/${today}`);
        // Compute daily delta vs yesterday for both IG followers + FB fans.
        const yesterdayId = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
        const yesterdayDoc = await db.doc(`marketing_account_insights/${yesterdayId}`).get();
        const yesterdayData = (yesterdayDoc.exists ? yesterdayDoc.data() : {});
        const followerCount = igSnap?.followerCount ?? 0;
        const yesterdayFollowers = yesterdayData?.followerCount ?? followerCount;
        const followersDelta = followerCount - yesterdayFollowers;
        const fbFanCount = fbSnap?.fanCount ?? 0;
        const yesterdayFbFans = yesterdayData?.fbFanCount ?? fbFanCount;
        const fbFansDelta = fbFanCount - yesterdayFbFans;
        await docRef.set({
            date: today,
            followerCount,
            reach: igSnap?.reach ?? 0,
            impressions: igSnap?.impressions ?? 0,
            followersDelta,
            // FB Page (M4c) — only written when FB_CONFIGURED + snapshot succeeded.
            ...(fbSnap ? {
                fbFanCount,
                fbReach: fbSnap.reach,
                fbImpressions: fbSnap.impressions,
                fbFansDelta,
            } : {}),
            fetchedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[pollMarketingAccountInsights] ${today} ig_followers=${followerCount} ig_reach=${igSnap?.reach ?? 0} fb_fans=${fbFanCount} fb_reach=${fbSnap?.reach ?? 0}`);
        return null;
    });
}
function buildGenerateWeeklyInsightDigest() {
    return functions
        .runWith({ memory: '512MB', timeoutSeconds: 120 })
        .pubsub.schedule('30 2 * * 1') // Mondays 02:30 UTC = 08:00 IST
        .timeZone('UTC')
        .onRun(async () => {
        const { OPENAI_API_KEY } = await getInsightsVars();
        if (!OPENAI_API_KEY) {
            console.warn('[generateWeeklyInsightDigest] openai.apiKey not configured — skipping digest');
            return null;
        }
        const db = admin.firestore();
        const now = new Date();
        const startMs = Date.now() - 7 * 24 * 3600 * 1000;
        const startIso = new Date(startMs).toISOString();
        const endIso = now.toISOString();
        const snap = await db
            .collection('marketing_drafts')
            .where('status', '==', 'posted')
            .where('postedAt', '>=', startIso)
            .where('postedAt', '<=', endIso)
            .get();
        if (snap.empty) {
            console.log('[generateWeeklyInsightDigest] no posts in window');
            return null;
        }
        const rows = [];
        for (const d of snap.docs) {
            const data = d.data();
            if (data?.isSynthetic === true)
                continue;
            const ig = data?.latestInsights ?? {};
            const fb = data?.latestFbInsights ?? {};
            const reach = (ig?.reach ?? 0) + (fb?.reach ?? 0);
            const engagement = (ig?.likes ?? 0) + (ig?.comments ?? 0) + (ig?.shares ?? 0) + (ig?.saved ?? 0) +
                (fb?.likes ?? 0) + (fb?.comments ?? 0) + (fb?.shares ?? 0);
            rows.push({
                draftId: d.id,
                headline: typeof data?.headline === 'string' ? data.headline : '',
                pillarLabel: typeof data?.pillarLabel === 'string' ? data.pillarLabel : '',
                personaLabel: typeof data?.personaLabel === 'string' ? data.personaLabel : '',
                reach,
                engagement,
                engagementRate: reach > 0 ? engagement / reach : 0,
            });
        }
        if (rows.length === 0) {
            console.log('[generateWeeklyInsightDigest] no non-synthetic posts');
            return null;
        }
        const totalReach = rows.reduce((a, r) => a + r.reach, 0);
        const totalImpressions = totalReach; // approx; impressions denormalised similarly
        const avgEngagementRate = rows.reduce((a, r) => a + r.engagementRate, 0) / rows.length;
        const top = [...rows].sort((a, b) => b.engagementRate - a.engagementRate).slice(0, 3);
        const bot = [...rows].sort((a, b) => a.engagementRate - b.engagementRate).slice(0, 3);
        // LLM commentary
        const prompt = [
            'You are an analyst for an Indian motherhood platform\'s social media.',
            'Generate a short, candid weekly recap.',
            '',
            `Posts published this week: ${rows.length}.`,
            `Total reach: ${totalReach}. Avg engagement rate: ${(avgEngagementRate * 100).toFixed(2)}%.`,
            '',
            'Top performers:',
            ...top.map((r) => `- "${r.headline}" [${r.pillarLabel} / ${r.personaLabel}]: reach ${r.reach}, ER ${(r.engagementRate * 100).toFixed(1)}%`),
            '',
            'Bottom performers:',
            ...bot.map((r) => `- "${r.headline}" [${r.pillarLabel} / ${r.personaLabel}]: reach ${r.reach}, ER ${(r.engagementRate * 100).toFixed(1)}%`),
            '',
            'Output STRICT JSON only:',
            '{',
            '  "commentary": "2-3 paragraph weekly recap — what worked, what didn\'t, why",',
            '  "recommendations": ["3 specific actionable changes for next week"]',
            '}',
        ].join('\n');
        let commentary = '';
        let recommendations = [];
        try {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    response_format: { type: 'json_object' },
                    temperature: 0.5,
                    max_tokens: 800,
                }),
            });
            if (res.ok) {
                const out = (await res.json());
                const parsed = JSON.parse(out?.choices?.[0]?.message?.content ?? '{}');
                commentary = typeof parsed?.commentary === 'string' ? parsed.commentary : '';
                recommendations = Array.isArray(parsed?.recommendations)
                    ? parsed.recommendations.filter((r) => typeof r === 'string').slice(0, 5)
                    : [];
            }
        }
        catch (e) {
            console.warn('[generateWeeklyInsightDigest] LLM threw', e);
        }
        const weekId = isoWeekId(now);
        const weekStart = new Date(startMs).toISOString().slice(0, 10);
        const weekEnd = now.toISOString().slice(0, 10);
        await db.doc(`marketing_insights/${weekId}`).set({
            weekId,
            weekStart,
            weekEnd,
            postsPublished: rows.length,
            totalReach,
            totalImpressions,
            avgEngagementRate,
            commentary,
            topPosts: top.map((r) => ({ draftId: r.draftId, headline: r.headline, engagementRate: r.engagementRate })),
            recommendations,
            generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[generateWeeklyInsightDigest] ${weekId} written, ${rows.length} posts analysed`);
        return null;
    });
}
function isoWeekId(d) {
    const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
