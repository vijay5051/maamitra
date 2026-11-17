"use strict";
// Google Play Billing (Android in-app subscriptions).
//
//   verifyPlayPurchase   callable  the app sends the purchase token right after
//                                  Google confirms a purchase (and on launch for
//                                  any purchase not yet acknowledged)
//   playBillingNotifications  Pub/Sub  Real-time developer notifications from
//                                  Play (renewals, cancellations, holds, refunds)
//
// Both read the subscription from the Google Play Developer API
// (purchases.subscriptionsv2) and write the same entitlements/{uid} doc the
// Razorpay webhook writes, with source 'play'.
//
// Setup outside code (see HANDOFF.md):
//   - Play Console → Users and permissions: invite the functions service account
//     maa-mitra-7kird8@appspot.gserviceaccount.com with "View financial data"
//     and "Manage orders and subscriptions".
//   - Google Cloud: enable "Google Play Android Developer API".
//   - Pub/Sub topic "play-billing" (created by this deploy): grant Publisher to
//     google-play-developer-notifications@system.gserviceaccount.com, then set
//     projects/maa-mitra-7kird8/topics/play-billing in Play Console →
//     Monetization setup → Real-time developer notifications.
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
exports.playAccountId = playAccountId;
exports.buildVerifyPlayPurchase = buildVerifyPlayPurchase;
exports.buildPlayBillingNotifications = buildPlayBillingNotifications;
const crypto = __importStar(require("crypto"));
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const google_auth_library_1 = require("google-auth-library");
const razorpay_1 = require("./razorpay");
const plans_1 = require("./plans");
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const auth = new google_auth_library_1.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
function db() {
    return admin.firestore();
}
/**
 * The app passes the Firebase uid as obfuscatedAccountId (a random id, not
 * personal data, within Play's 64-character limit), so each token is tied to
 * one MaaMitra account.
 */
function playAccountId(uid) {
    return uid;
}
function tokenKey(token) {
    return crypto.createHash('sha256').update(token).digest('hex').slice(0, 40);
}
async function playApi(method, path) {
    const client = await auth.getClient();
    const res = await client.request({ url: `${API}/${plans_1.PLAY_PACKAGE_NAME}${path}`, method });
    return res.data;
}
function planFromProduct(productId) {
    if (productId === plans_1.PLAY_PRODUCT_IDS.plus)
        return 'plus';
    if (productId === plans_1.PLAY_PRODUCT_IDS.family)
        return 'family';
    return null;
}
function intervalFromBasePlan(basePlanId) {
    return basePlanId === plans_1.PLAY_BASE_PLANS.monthly ? 'monthly' : 'yearly';
}
/**
 * Fetch a purchase token from Google and apply it to the owner's entitlement.
 * `uidHint` is the caller when it comes from the app; RTDN looks the owner up
 * from the token record written at first verification.
 */
async function syncPlayToken(token, uidHint) {
    const sub = await playApi('GET', `/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`);
    const item = sub.lineItems?.[0];
    const plan = planFromProduct(item?.productId);
    if (!plan || !item?.productId) {
        throw new functions.https.HttpsError('invalid-argument', 'This purchase is not a MaaMitra plan.');
    }
    const recRef = db().doc(`play_purchases/${tokenKey(token)}`);
    const rec = (await recRef.get()).data();
    const accountId = sub.externalAccountIdentifiers?.obfuscatedExternalAccountId;
    const uid = rec?.uid ?? uidHint;
    if (!uid)
        throw new Error(`play token ${tokenKey(token)} has no known owner`);
    if (accountId && accountId !== playAccountId(uid)) {
        throw new functions.https.HttpsError('permission-denied', 'This purchase belongs to a different MaaMitra account.');
    }
    // Google refunds any purchase not acknowledged within 3 days.
    if (sub.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING') {
        await playApi('POST', `/purchases/subscriptions/${encodeURIComponent(item.productId)}/tokens/${encodeURIComponent(token)}:acknowledge`);
    }
    const state = sub.subscriptionState ?? 'SUBSCRIPTION_STATE_UNSPECIFIED';
    const expiry = item.expiryTime ? admin.firestore.Timestamp.fromDate(new Date(item.expiryTime)) : null;
    const now = admin.firestore.Timestamp.now();
    // Access runs to the paid-up date while active, in grace or cancelled-but-paid;
    // it stops now when Google puts the subscription on hold, pauses or expires it.
    const keepsAccess = ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED'].includes(state);
    const activeUntil = keepsAccess ? expiry : now;
    const basePlanId = item.offerDetails?.basePlanId;
    const founding = plan === 'plus' && basePlanId === plans_1.PLAY_BASE_PLANS.founding;
    const subscriptionId = `play:${tokenKey(token)}`;
    await db().runTransaction(async (tx) => {
        const entRef = db().doc(`entitlements/${uid}`);
        const ent = (await tx.get(entRef)).data();
        const recSnap = await tx.get(recRef);
        tx.set(recRef, {
            uid,
            token,
            productId: item.productId,
            basePlanId: basePlanId ?? null,
            offerId: item.offerDetails?.offerId ?? null,
            state,
            latestOrderId: sub.latestOrderId ?? null,
            linkedPurchaseToken: sub.linkedPurchaseToken ?? null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            ...(recSnap.exists ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
        }, { merge: true });
        // Never let this token override a different plan that is still active
        // (e.g. a website subscription), unless this one also grants access and
        // the other is from the token it replaced.
        const replaces = ent?.subscriptionId === `play:${tokenKey(sub.linkedPurchaseToken ?? '')}`;
        if (ent?.subscriptionId && ent.subscriptionId !== subscriptionId && (0, razorpay_1.isActiveEntitlement)(ent) && !(keepsAccess && replaces)) {
            return;
        }
        tx.set(entRef, {
            plan,
            interval: founding ? 'yearly' : intervalFromBasePlan(basePlanId),
            founding,
            source: 'play',
            subscriptionId,
            status: state.replace('SUBSCRIPTION_STATE_', '').toLowerCase(),
            activeUntil,
            trialEndsAt: null,
            trialUsed: ent?.trialUsed === true || item.offerDetails?.offerId === plans_1.PLAY_TRIAL_OFFER_ID,
            earlyAccessDeferred: false,
            cancelAtPeriodEnd: state === 'SUBSCRIPTION_STATE_CANCELED' || item.autoRenewingPlan?.autoRenewEnabled === false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        if (founding && keepsAccess && !recSnap.data()?.foundingCounted) {
            tx.set(db().doc('app_settings/billing'), { foundingCount: admin.firestore.FieldValue.increment(1) }, { merge: true });
            tx.set(recRef, { foundingCounted: true }, { merge: true });
        }
    });
    return { uid, plan, activeUntil: activeUntil?.toMillis() ?? null, state };
}
function buildVerifyPlayPurchase() {
    return functions
        .runWith({ memory: '256MB', timeoutSeconds: 30 })
        .https.onCall(async (data, context) => {
        const uid = context.auth?.uid;
        if (!uid)
            throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const token = data?.purchaseToken;
        if (typeof token !== 'string' || token.length < 10 || token.length > 4096) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing purchase token.');
        }
        const existing = (await db().doc(`play_purchases/${tokenKey(token)}`).get()).data();
        if (existing?.uid && existing.uid !== uid) {
            throw new functions.https.HttpsError('permission-denied', 'This purchase belongs to a different MaaMitra account.');
        }
        try {
            const r = await syncPlayToken(token, uid);
            return { plan: r.plan, activeUntil: r.activeUntil, state: r.state };
        }
        catch (e) {
            if (e instanceof functions.https.HttpsError)
                throw e;
            console.error('[verifyPlayPurchase] failed', e);
            throw new functions.https.HttpsError('unavailable', 'We could not confirm your purchase with Google Play yet. It will update automatically shortly.');
        }
    });
}
function buildPlayBillingNotifications() {
    return functions
        .runWith({ memory: '256MB', timeoutSeconds: 60 })
        .pubsub.topic('play-billing')
        .onPublish(async (message) => {
        const body = message.json;
        if (body?.testNotification) {
            console.log('[playBillingNotifications] test notification received');
            await db().doc('billing_meta/play_status').set({ lastTestAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            return null;
        }
        const token = body?.subscriptionNotification?.purchaseToken;
        if (body?.packageName !== plans_1.PLAY_PACKAGE_NAME || !token)
            return null;
        try {
            const r = await syncPlayToken(token, null);
            await db().doc('billing_meta/play_status').set({ lastEventAt: admin.firestore.FieldValue.serverTimestamp(), lastType: body.subscriptionNotification?.notificationType ?? null, lastState: r.state }, { merge: true });
        }
        catch (e) {
            // Purchases the app has not verified yet have no owner record; the app
            // verifies them on next launch, so these are safe to drop.
            console.warn('[playBillingNotifications] could not apply', body.subscriptionNotification?.notificationType, e);
        }
        return null;
    });
}
