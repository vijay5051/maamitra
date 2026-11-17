"use strict";
// Server-side "does this user get paid features?" check. Mirrors the client
// rule in lib/plans.ts + hooks/usePlanAccess.ts:
//   - an active Plus/Family entitlement, or
//   - an early member: Firebase Auth account created before plans went live
//     (app_settings/billing.earlyAccess.start), for `days` (default 90) after it.
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
exports.earlyAccessWindow = earlyAccessWindow;
exports.userEarlyAccessUntil = userEarlyAccessUntil;
exports.hasPaidEntitlement = hasPaidEntitlement;
exports.hasFullAccess = hasFullAccess;
const admin = __importStar(require("firebase-admin"));
const DEFAULT_EARLY_ACCESS_DAYS = 90;
const DAY_MS = 86400 * 1000;
/** End of the early-member window for everyone (ms), or null if none is running. */
function earlyAccessWindow(billing, now = Date.now()) {
    const start = billing?.earlyAccess?.start;
    if (!(start instanceof admin.firestore.Timestamp))
        return null;
    const days = typeof billing?.earlyAccess?.days === 'number' ? billing.earlyAccess.days : DEFAULT_EARLY_ACCESS_DAYS;
    const until = start.toMillis() + days * DAY_MS;
    return until > now ? { start: start.toMillis(), until } : null;
}
/** End of this user's early-member free period (ms) if it is still running, else null. */
async function userEarlyAccessUntil(uid, billing) {
    const window = earlyAccessWindow(billing);
    if (!window)
        return null;
    try {
        const created = Date.parse((await admin.auth().getUser(uid)).metadata.creationTime);
        return !Number.isNaN(created) && created < window.start ? window.until : null;
    }
    catch {
        return null;
    }
}
async function hasPaidEntitlement(uid) {
    const ent = (await admin.firestore().doc(`entitlements/${uid}`).get()).data();
    const until = ent?.activeUntil;
    return (ent?.plan === 'plus' || ent?.plan === 'family') && !!until && until.toMillis() > Date.now();
}
/** Paid plan or early-member free period. */
async function hasFullAccess(uid, billing) {
    return (await hasPaidEntitlement(uid)) || (await userEarlyAccessUntil(uid, billing)) !== null;
}
