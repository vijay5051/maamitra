"use strict";
// Paid plan catalogue for the server. Keep in sync with lib/plans.ts in the app.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAY_TRIAL_OFFER_ID = exports.PLAY_BASE_PLANS = exports.PLAY_PRODUCT_IDS = exports.PLAY_PACKAGE_NAME = exports.PLAN_LABELS = exports.TRIAL_DAYS = exports.DEFAULT_FOUNDING_LIMIT = exports.FOUNDING_PLUS_YEARLY = exports.PLAN_PRICES = void 0;
exports.isPaidPlan = isPaidPlan;
exports.isInterval = isInterval;
// Amounts in paise, GST included.
exports.PLAN_PRICES = {
    plus: { monthly: 14900, yearly: 99900 },
    family: { monthly: 24900, yearly: 179900 },
};
exports.FOUNDING_PLUS_YEARLY = 69900;
exports.DEFAULT_FOUNDING_LIMIT = 1000;
exports.TRIAL_DAYS = 7;
exports.PLAN_LABELS = {
    plus: 'MaaMitra Plus',
    family: 'MaaMitra Family',
};
function isPaidPlan(v) {
    return v === 'plus' || v === 'family';
}
function isInterval(v) {
    return v === 'monthly' || v === 'yearly';
}
// ─── Google Play (Android in-app) ─────────────────────────────────────
// Create these in Play Console → Monetize → Subscriptions. Keep in sync with
// lib/plans.ts PLAY_PRODUCTS in the app.
exports.PLAY_PACKAGE_NAME = 'in.maamitra.app';
exports.PLAY_PRODUCT_IDS = {
    plus: 'maamitra_plus',
    family: 'maamitra_family',
};
// Base plans on each product. "founding" exists on maamitra_plus only (₹699/yr).
exports.PLAY_BASE_PLANS = { monthly: 'monthly', yearly: 'yearly', founding: 'founding' };
// Free-trial offer id on the Plus base plans (7 days, new customers only).
exports.PLAY_TRIAL_OFFER_ID = 'trial';
