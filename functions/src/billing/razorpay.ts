// Razorpay subscriptions for website purchases.
//
//   createRazorpaySubscription  callable — creates a subscription for the caller
//   cancelRazorpaySubscription  callable — stops renewal at the end of the paid period
//   razorpayWebhook             HTTPS    — Razorpay → us; the only writer of entitlements
//
// Firestore:
//   app_settings/billing        public: { webCheckoutEnabled, trialEnabled, foundingOffer, foundingCount }
//   entitlements/{uid}          the user's plan; server-written only, user can read their own
//   billing_subscriptions/{id}  subscription → uid + what was bought (server only)
//   billing_events/{eventId}    processed webhook ids, for idempotency (server only)
//   billing_meta/razorpay_plans cached Razorpay plan ids per mode/plan/interval/amount

import * as crypto from 'crypto';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

import { getIntegrationConfig, RazorpayConfig } from '../lib/integrationConfig';
import {
  BillingInterval,
  DEFAULT_FOUNDING_LIMIT,
  FOUNDING_PLUS_YEARLY,
  isInterval,
  isPaidPlan,
  PaidPlanId,
  PLAN_LABELS,
  PLAN_PRICES,
  TRIAL_DAYS,
} from './plans';

const RZP_API = 'https://api.razorpay.com/v1';

interface BillingSettings {
  webCheckoutEnabled?: boolean;
  trialEnabled?: boolean;
  foundingOffer?: { enabled?: boolean; limit?: number };
  foundingCount?: number;
}

interface SubscriptionRecord {
  uid: string;
  plan: PaidPlanId;
  interval: BillingInterval;
  founding: boolean;
  trial: boolean;
  foundingCounted?: boolean;
}

interface RazorpaySubscription {
  id: string;
  status: string;
  current_end?: number | null;
  start_at?: number | null;
  notes?: Record<string, string>;
}

function db() {
  return admin.firestore();
}

async function rzp<T>(cfg: RazorpayConfig, method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${RZP_API}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    console.error(`[razorpay] ${method} ${path} → ${res.status}`, json?.error);
    throw new functions.https.HttpsError('internal', json?.error?.description ?? `Razorpay error ${res.status}`);
  }
  return json as T;
}

async function getSettings(): Promise<BillingSettings> {
  const snap = await db().doc('app_settings/billing').get();
  return (snap.data() as BillingSettings | undefined) ?? {};
}

async function requireRazorpayConfig(): Promise<RazorpayConfig> {
  const cfg = (await getIntegrationConfig()).razorpay;
  if (!cfg.keyId || !cfg.keySecret) {
    throw new functions.https.HttpsError('failed-precondition', 'Payments are not set up yet.');
  }
  return cfg;
}

async function ensurePlan(cfg: RazorpayConfig, plan: PaidPlanId, interval: BillingInterval, amount: number, founding: boolean): Promise<string> {
  const mode = cfg.keyId.startsWith('rzp_live_') ? 'live' : 'test';
  const key = `${mode}_${plan}_${interval}_${amount}`;
  const ref = db().doc('billing_meta/razorpay_plans');
  const cached = (await ref.get()).data()?.[key];
  if (typeof cached === 'string' && cached) return cached;

  const created = await rzp<{ id: string }>(cfg, 'POST', '/plans', {
    period: interval,
    interval: 1,
    item: {
      name: `${PLAN_LABELS[plan]} (${interval}${founding ? ', Founding Mothers' : ''})`,
      amount,
      currency: 'INR',
    },
  });
  await ref.set({ [key]: created.id }, { merge: true });
  return created.id;
}

function isActiveEntitlement(ent: admin.firestore.DocumentData | undefined): boolean {
  const until = ent?.activeUntil as admin.firestore.Timestamp | undefined;
  return !!ent && ent.plan !== 'free' && !!until && until.toMillis() > Date.now();
}

export function buildCreateRazorpaySubscription() {
  return functions
    .runWith({ memory: '256MB', timeoutSeconds: 30 })
    .https.onCall(async (data: { plan?: unknown; interval?: unknown; founding?: unknown }, context) => {
      const uid = context.auth?.uid;
      if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Sign in to choose a plan.');

      const settings = await getSettings();
      if (settings.webCheckoutEnabled !== true) {
        throw new functions.https.HttpsError('failed-precondition', 'Paid plans are not available yet.');
      }
      const { plan, interval } = data ?? {};
      if (!isPaidPlan(plan) || !isInterval(interval)) {
        throw new functions.https.HttpsError('invalid-argument', 'Unknown plan.');
      }

      const entSnap = await db().doc(`entitlements/${uid}`).get();
      const ent = entSnap.data();
      if (isActiveEntitlement(ent)) {
        throw new functions.https.HttpsError('already-exists', 'You already have an active plan.');
      }

      let founding = false;
      if (data?.founding === true) {
        const offer = settings.foundingOffer ?? {};
        if (plan !== 'plus' || interval !== 'yearly' || offer.enabled === false) {
          throw new functions.https.HttpsError('invalid-argument', 'The Founding Mothers offer is for Plus yearly only.');
        }
        if ((settings.foundingCount ?? 0) >= (offer.limit ?? DEFAULT_FOUNDING_LIMIT)) {
          throw new functions.https.HttpsError('resource-exhausted', 'All Founding Mothers places have been taken.');
        }
        founding = true;
      }

      const trial = plan === 'plus' && settings.trialEnabled !== false && ent?.trialUsed !== true;
      const amount = founding ? FOUNDING_PLUS_YEARLY : PLAN_PRICES[plan][interval];
      const cfg = await requireRazorpayConfig();
      const planId = await ensurePlan(cfg, plan, interval, amount, founding);

      const sub = await rzp<RazorpaySubscription>(cfg, 'POST', '/subscriptions', {
        plan_id: planId,
        total_count: interval === 'monthly' ? 120 : 10,
        customer_notify: 1,
        ...(trial ? { start_at: Math.floor(Date.now() / 1000) + TRIAL_DAYS * 86400 } : {}),
        notes: { uid, plan, interval, founding: founding ? '1' : '0' },
      });

      const record: SubscriptionRecord = { uid, plan, interval, founding, trial };
      await db().doc(`billing_subscriptions/${sub.id}`).set({
        ...record,
        status: sub.status,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { subscriptionId: sub.id, keyId: cfg.keyId, amount, trial, trialDays: TRIAL_DAYS };
    });
}

export function buildCancelRazorpaySubscription() {
  return functions
    .runWith({ memory: '256MB', timeoutSeconds: 30 })
    .https.onCall(async (_data: unknown, context) => {
      const uid = context.auth?.uid;
      if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');

      const ref = db().doc(`entitlements/${uid}`);
      const ent = (await ref.get()).data();
      const subId = ent?.subscriptionId as string | undefined;
      if (!subId || ent?.source !== 'razorpay') {
        throw new functions.https.HttpsError('not-found', 'No website subscription to cancel.');
      }
      if (ent?.cancelAtPeriodEnd === true || ent?.status === 'cancelled') {
        return { ok: true, activeUntil: (ent.activeUntil as admin.firestore.Timestamp | undefined)?.toMillis() ?? null };
      }

      const cfg = await requireRazorpayConfig();
      // A subscription still in its free trial has no paid cycle to finish, so it is cancelled now;
      // the user keeps access until the trial end already stored in activeUntil.
      const atCycleEnd = ent?.status === 'active' || ent?.status === 'pending' ? 1 : 0;
      await rzp(cfg, 'POST', `/subscriptions/${subId}/cancel`, { cancel_at_cycle_end: atCycleEnd });
      await ref.set(
        { cancelAtPeriodEnd: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
      );
      return { ok: true, activeUntil: (ent.activeUntil as admin.firestore.Timestamp | undefined)?.toMillis() ?? null };
    });
}

function signatureValid(rawBody: Buffer | undefined, signature: string | undefined, secret: string): boolean {
  if (!rawBody || !signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function ts(seconds: number | null | undefined): admin.firestore.Timestamp | null {
  return seconds ? admin.firestore.Timestamp.fromMillis(seconds * 1000) : null;
}

function later(a: admin.firestore.Timestamp | null, b: admin.firestore.Timestamp | null): admin.firestore.Timestamp | null {
  if (!a) return b;
  if (!b) return a;
  return a.toMillis() >= b.toMillis() ? a : b;
}

async function applySubscriptionEvent(sub: RazorpaySubscription): Promise<void> {
  const recRef = db().doc(`billing_subscriptions/${sub.id}`);
  const recSnap = await recRef.get();
  const rec = recSnap.data() as SubscriptionRecord | undefined;
  const uid = rec?.uid ?? sub.notes?.uid;
  if (!uid || !rec) {
    console.warn(`[razorpayWebhook] unknown subscription ${sub.id}; ignoring`);
    return;
  }

  const entRef = db().doc(`entitlements/${uid}`);
  await db().runTransaction(async (tx) => {
    const ent = (await tx.get(entRef)).data();
    // An event for an older subscription must not override a different, still-active one.
    if (ent?.subscriptionId && ent.subscriptionId !== sub.id && isActiveEntitlement(ent)) {
      tx.set(recRef, { status: sub.status }, { merge: true });
      return;
    }

    const now = admin.firestore.Timestamp.now();
    const prevUntil = ent?.subscriptionId === sub.id ? ((ent?.activeUntil as admin.firestore.Timestamp | undefined) ?? null) : null;
    let activeUntil = prevUntil;
    let trialEndsAt = (ent?.subscriptionId === sub.id ? ent?.trialEndsAt : null) ?? null;
    let trialUsed = ent?.trialUsed === true;

    switch (sub.status) {
      case 'authenticated': {
        const start = ts(sub.start_at);
        if (rec.trial && start && start.toMillis() > now.toMillis()) {
          activeUntil = later(activeUntil, start);
          trialEndsAt = start;
          trialUsed = true;
        }
        break;
      }
      case 'active':
        activeUntil = later(activeUntil, ts(sub.current_end));
        break;
      case 'halted':
        activeUntil = now;
        break;
      default:
        // pending: Razorpay is retrying the charge, keep access meanwhile.
        // cancelled / completed / expired: access runs to the end already paid for.
        break;
    }

    const cancelled = sub.status === 'cancelled' || sub.status === 'completed' || sub.status === 'expired';
    tx.set(
      entRef,
      {
        plan: rec.plan,
        interval: rec.interval,
        founding: rec.founding,
        source: 'razorpay',
        subscriptionId: sub.id,
        status: sub.status,
        activeUntil,
        trialEndsAt,
        trialUsed,
        cancelAtPeriodEnd: cancelled || ent?.cancelAtPeriodEnd === true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const grantsAccess = sub.status === 'authenticated' || sub.status === 'active';
    if (rec.founding && grantsAccess && !rec.foundingCounted) {
      tx.set(db().doc('app_settings/billing'), { foundingCount: admin.firestore.FieldValue.increment(1) }, { merge: true });
      tx.set(recRef, { foundingCounted: true }, { merge: true });
    }
    tx.set(recRef, { status: sub.status, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
}

export function buildRazorpayWebhook() {
  return functions
    .runWith({ memory: '256MB', timeoutSeconds: 30 })
    .https.onRequest(async (req, res) => {
      if (req.method !== 'POST') {
        res.status(405).send('method-not-allowed');
        return;
      }
      const cfg = (await getIntegrationConfig()).razorpay;
      const signature = req.get('x-razorpay-signature') ?? undefined;
      if (!signatureValid(req.rawBody as Buffer | undefined, signature, cfg.webhookSecret)) {
        console.warn('[razorpayWebhook] bad or missing signature');
        res.status(400).send('invalid-signature');
        return;
      }

      const eventId = req.get('x-razorpay-event-id');
      if (eventId) {
        try {
          await db().doc(`billing_events/${eventId}`).create({
            event: req.body?.event ?? null,
            receivedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch {
          res.status(200).send('duplicate');
          return;
        }
      }

      const sub = req.body?.payload?.subscription?.entity as RazorpaySubscription | undefined;
      if (typeof req.body?.event === 'string' && req.body.event.startsWith('subscription.') && sub?.id) {
        try {
          await applySubscriptionEvent(sub);
        } catch (e) {
          console.error('[razorpayWebhook] failed to apply event', req.body.event, e);
          if (eventId) await db().doc(`billing_events/${eventId}`).delete().catch(() => {});
          res.status(500).send('error');
          return;
        }
      }
      res.status(200).send('ok');
    });
}
