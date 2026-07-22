// @ts-check
// routes-payment.js — payments: join fee, tiers, karma escalation, boost
//
// Strict-type-checked via JSDoc rather than a .ts rename — see ADR-004 (Node runs
// this file directly; there is no build step). Enforced by `tsc --noEmit` in CI.
//
// ALL amounts in CHF. Join fee (computed SERVER-SIDE from the user's stored
// gender — never from the request): male CHF 1 · female CHF 5 · non-binary CHF 3.
//
// Dev mode: when Razorpay keys are not configured (or DEV_PAYMENTS=true),
// orders are simulated locally so the full flow works without a live account.
// NEVER enable dev payments on a public deployment.

const express = require('express');
const crypto = require('crypto');
const User = require('./models/User');
const Payment = require('./models/Payment');
const { requireAuth, requireAdmin } = require('./routes-auth');

const router = express.Router();

const DEV_PAYMENTS = process.env.DEV_PAYMENTS === 'true' ||
  !process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID.startsWith('rzp_test_xxx');

let razorpay = null;
if (!DEV_PAYMENTS) {
  const Razorpay = require('razorpay');
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

const fx = require('./services/fx');

/**
 * The Razorpay secret, or a loud failure. Signature verification must NEVER run
 * against an undefined key — `createHmac('sha256', undefined)` is not a
 * verification, it is an accident. Fail closed instead. (require-secrets.js
 * already refuses to boot production without it; this guards the misconfig path.)
 * @returns {string}
 */
function razorpaySecret() {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error('RAZORPAY_KEY_SECRET is not set — refusing to verify a payment signature');
  return secret;
}

/**
 * Same rule for the webhook secret: an unset secret means we cannot authenticate
 * the caller, so we must refuse — not hash against `undefined` and hope.
 * @returns {string}
 */
function webhookSecret() {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error('RAZORPAY_WEBHOOK_SECRET is not set — refusing to verify a webhook signature');
  return secret;
}

// CHF is the canonical price. Each user is charged in their LOCAL currency
// (India → INR, which also unlocks UPI/netbanking/wallets; others → their
// currency), converted from CHF at the LIVE exchange rate (services/fx.js) so the
// amount always tracks the CHF price. Gender/country come from the DB, not the request.
// Split in two so every lookup has a precise type: base pricing is keyed by
// gender, everything else by purpose. One mixed object types each read as
// `number | Record<string, number>` — true, but useless to the checker.
/** @type {Record<string, number>} */
const BASE_CHF = { male: 1, female: 5, non_binary: 3, other: 3 };
/** @type {Record<string, number>} */
const PURPOSE_CHF = {
  pro_subscription: 6, max_subscription: 15,
  karma_escalation: 0.5, karma_escalation_high: 1, boost: 1
};
/** @type {Record<string, string>} */
const LEGACY_PURPOSES = {
  plus_subscription: 'pro_subscription',
  premium_subscription: 'max_subscription',
  join_fee: 'base_subscription'
};
/** @type {Record<string, string>} */
const SYMBOLS = { INR: '₹', CHF: 'CHF ', USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SGD: 'S$' };

/**
 * A user document, as far as pricing is concerned. Deliberately narrow: pricing
 * reads gender and country from the STORED user, never from the request.
 * @typedef {{ _id?: unknown, profile?: { gender?: string, country?: string, firstName?: string }, phone?: string }} PricingUser
 */

/**
 * @param {PricingUser | null | undefined} user
 * @returns {string} the currency code to charge this user in
 */
function currencyForUser(user) { return ((user && user.profile && user.profile.country) || 'IN') === 'IN' ? 'INR' : 'CHF'; }

/**
 * Canonical CHF amount. Returns null for an unknown purpose, so the caller
 * refuses the order rather than charging zero.
 * @param {string} purpose
 * @param {string} gender
 * @returns {number | null}
 */
function chfAmount(purpose, gender) {
  if (purpose === 'base_subscription') return BASE_CHF[gender] ?? BASE_CHF.other;
  return PURPOSE_CHF[purpose] ?? null;
}

/**
 * { code, symbol, major (live-converted, rounded), minor (=major×100), chf (canonical) }
 * @param {string} purpose
 * @param {PricingUser | null | undefined} user
 * @returns {Promise<{ code: string, symbol: string, major: number, minor: number, chf: number } | null>}
 */
async function priceFor(purpose, user) {
  const gender = (user && user.profile && user.profile.gender) || 'other';
  const chf = chfAmount(purpose, gender);
  if (chf == null) return null;
  const code = currencyForUser(user);
  const major = await fx.convertFromCHF(chf, code);
  return { code, symbol: SYMBOLS[code] || (code + ' '), major, minor: Math.round(major * 100), chf };
}

// 1. Create order — join fee by default, or another purpose
router.post('/create-order', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const purpose = LEGACY_PURPOSES[req.body.purpose] || req.body.purpose || 'base_subscription';
    // Priced by verified gender + country (INR for India → UPI etc.), live-converted
    // from CHF. Registration is by payment, so no verification gate here.
    const price = await priceFor(purpose, user);
    if (!price) return res.status(400).json({ error: 'Unknown purpose' });

    if (DEV_PAYMENTS) {
      const orderId = 'order_dev_' + crypto.randomBytes(8).toString('hex');
      await Payment.create({
        userId: req.userId,
        purpose: purpose.replace('_high', ''),
        amountCHF: price.chf, currency: price.code,
        razorpayOrderId: orderId,
        status: 'created',
        createdAt: new Date(),
        metadata: { dev: true, gender: user.profile.gender, amountLocal: price.major }
      });
      return res.json({
        devMode: true, orderId,
        amount: price.minor, amountMajor: price.major, amountCHF: price.chf,
        currency: price.code, symbol: price.symbol, purpose
      });
    }

    // Fail closed: never attempt a live order without a configured client.
    if (!razorpay) return res.status(503).json({ error: 'Payments are not configured.' });
    const order = await razorpay.orders.create({
      amount: price.minor,
      currency: price.code,
      // Razorpay caps receipt at 40 chars — keep it short (timestamp in base36 +
      // last 6 of the user id). Full context lives in notes below.
      receipt: `sb_${Date.now().toString(36)}_${String(user._id).slice(-6)}`,
      notes: { userId: user._id.toString(), gender: user.profile.gender, purpose }
    });

    // Persist what we priced, BEFORE the user pays. /verify reads the purpose and
    // amount back from this record — never from the request body. Without this
    // row there is nothing authoritative to check a payment against, and since the
    // Razorpay signature covers only order_id|payment_id, a caller could pay for
    // base_subscription and then claim max_subscription at verify time.
    await Payment.create({
      userId: req.userId,
      purpose: purpose.replace('_high', ''),
      amountCHF: price.chf, currency: price.code,
      razorpayOrderId: order.id,
      status: 'created',
      createdAt: new Date(),
      metadata: { gender: user.profile.gender, amountLocal: price.major }
    });

    res.json({
      orderId: order.id,
      amount: price.minor, amountMajor: price.major, amountCHF: price.chf,
      currency: price.code, symbol: price.symbol,
      purpose,
      key: process.env.RAZORPAY_KEY_ID,
      prefill: { name: user.profile.firstName, contact: user.phone }
    });
  } catch (err) { next(err); }
});

// GET /payment/pricing — live, localized prices for display (server order is authoritative)
router.get('/pricing', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const code = currencyForUser(user);
    /** @param {number} chf */
    const conv = (chf) => fx.convertFromCHF(chf, code);
    const gender = (user.profile && user.profile.gender) || 'other';
    const [male, female, nb, yours, pro, max, esc, escH, boost] = await Promise.all([
      conv(BASE_CHF.male), conv(BASE_CHF.female), conv(BASE_CHF.non_binary), conv(BASE_CHF[gender] ?? BASE_CHF.other),
      conv(PURPOSE_CHF.pro_subscription), conv(PURPOSE_CHF.max_subscription),
      conv(PURPOSE_CHF.karma_escalation), conv(PURPOSE_CHF.karma_escalation_high), conv(PURPOSE_CHF.boost)
    ]);
    res.json({ currency: code, symbol: SYMBOLS[code] || (code + ' '),
      base: { male, female, non_binary: nb, yours }, pro, max, escalation: esc, escalationHigh: escH, boost });
  } catch (e) { next(e); }
});

// 2. Verify payment (frontend calls after Razorpay checkout returns)
router.post('/verify', requireAuth, async (req, res, next) => {
  try {
    // requireAuth guarantees this, but the type cannot know it. Narrowing once is
    // honest and keeps the real 401 path visible; asserting non-null would hide it.
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthenticated' });
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (DEV_PAYMENTS && razorpay_order_id?.startsWith('order_dev_')) {
      const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id, userId: req.userId });
      if (!payment) return res.status(404).json({ error: 'Order not found' });
      if (payment.status === 'captured') return res.json({ ok: true, alreadyProcessed: true, paymentId: payment._id });

      payment.status = 'captured';
      payment.capturedAt = new Date();
      payment.razorpayPaymentId = 'pay_dev_' + crypto.randomBytes(8).toString('hex');
      payment.method = 'dev_simulated';
      await payment.save();

      if (payment.purpose === 'join_fee') await markJoinFeePaid(userId, payment); // legacy stored orders
      if (payment.purpose.endsWith('_subscription')) await activateTier(userId, payment.purpose, payment);
      return res.json({ ok: true, devMode: true, paymentId: payment._id, purpose: payment.purpose });
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment fields' });
    }

    // Verify signature server-side — CRITICAL, never skip
    const expected = crypto
      .createHmac('sha256', razorpaySecret())
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (expected !== razorpay_signature) {
      console.warn('[SECURITY] Invalid Razorpay signature attempt', { userId: req.userId });
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Idempotency
    const existing = await Payment.findOne({ razorpayPaymentId: razorpay_payment_id });
    if (existing) return res.json({ ok: true, alreadyProcessed: true, paymentId: existing._id });

    // The order we priced at create-order time is the ONLY authority on what was
    // bought. req.body.purpose is attacker-controlled: the Razorpay signature
    // covers order_id|payment_id only, so trusting it would let someone pay CHF 1
    // for base_subscription and claim max_subscription (CHF 15) here.
    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id, userId: req.userId });
    if (!payment) return res.status(404).json({ error: 'Order not found' });
    if (payment.status === 'captured') return res.json({ ok: true, alreadyProcessed: true, paymentId: payment._id });

    const purpose = payment.purpose;                     // authoritative, from the DB
    payment.status = 'captured';
    payment.capturedAt = new Date();
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    await payment.save();

    if (purpose === 'join_fee') await markJoinFeePaid(userId, payment); // legacy stored orders
    if (purpose.endsWith('_subscription')) await activateTier(userId, purpose, payment);

    res.json({ ok: true, paymentId: payment._id, purpose });
  } catch (err) { next(err); }
});

// Base / Pro / Max — 30-day subscription per purchase, stacking extends.
// joinFeePaid doubles as the "membership currently active" flag: set on every
// activation, cleared by the nightly cron when the tier expires to 'free'.
/**
 * @param {string} userId
 * @param {string} purpose
 * @param {{ _id: unknown, amountCHF?: number } | null} [payment]
 */
async function activateTier(userId, purpose, payment) {
  const tier = purpose === 'max_subscription' ? 'max'
    : purpose === 'pro_subscription' ? 'pro' : 'base';
  const user = await User.findById(userId);
  // Never DOWNGRADE an active higher tier or SHORTEN paid time. Rank the tiers and
  // keep the better of {current active, purchased}: a same-or-lower purchase stacks
  // onto the current expiry; an upgrade starts now but never ends before the current
  // one. (Previously, buying base while an active max ran silently discarded the max.)
  const { tierRank } = require('./services/membership');
  const m = user.membership || {};
  const active = !!(m.tierExpiresAt && new Date(m.tierExpiresAt) > new Date());
  const curRank = active ? tierRank(m.tier) : 0;
  const curEnd = active ? new Date(m.tierExpiresAt).getTime() : 0;
  const purchasedRank = tierRank(tier);
  const effectiveTier = curRank > purchasedRank ? m.tier : tier;
  const from = (active && curRank >= purchasedRank) ? curEnd : Date.now();
  const newEnd = Math.max(from + 30 * 86400000, curEnd);
  // Paying during pre-launch → early-access member. Their 30 days will be (re)started
  // at launch so gated time isn't burned (site-mode.setPrelaunch grants the trial).
  let earlyAccess = false;
  try { earlyAccess = await require('./services/site-mode').isPrelaunch(); } catch { /* default false */ }
  await User.findByIdAndUpdate(userId, {
    'membership.tier': effectiveTier,
    'membership.tierExpiresAt': new Date(newEnd),
    'membership.joinFeePaid': true,
    'membership.paidAt': new Date(),
    ...(earlyAccess ? { 'membership.earlyAccess': true } : {}),
    ...(payment ? { 'membership.joinFeePaymentId': payment._id, 'membership.joinFeeAmountCHF': payment.amountCHF } : {})
  });
  require('./services/analytics').track('tier_activated', userId, { tier: effectiveTier, purchased: tier, earlyAccess });
}

/**
 * @param {string} userId
 * @param {{ _id: unknown, amountCHF?: number }} payment
 */
async function markJoinFeePaid(userId, payment) {
  await User.findByIdAndUpdate(userId, {
    'membership.joinFeePaid': true,
    'membership.joinFeeAmountCHF': payment.amountCHF,
    'membership.joinFeePaymentId': payment._id,
    'membership.paidAt': new Date()
  });
  require('./services/analytics').track('join_fee_paid', userId, { amountCHF: payment.amountCHF });
}

// 3. Payment history
router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const payments = await Payment.find({ userId: req.userId })
      .sort({ createdAt: -1 }).limit(50)
      .select('-razorpaySignature');
    res.json({ payments });
  } catch (err) { next(err); }
});

// 4. Admin refund — a moderator-only tool for exceptional cases (a failed/rejected
// verification, a duplicate charge, or a payment-provider chargeback). This is NOT a
// user-facing money-back guarantee: membership is monthly and non-refundable, and no
// refund is promised anywhere in the product. Razorpay refund API in prod, simulated in dev.
router.post('/admin/:paymentId/refund', requireAdmin, async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.paymentId);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.status !== 'captured') return res.status(400).json({ error: 'Only captured payments can be refunded' });

    if (!DEV_PAYMENTS && razorpay && payment.razorpayPaymentId) {
      await razorpay.payments.refund(payment.razorpayPaymentId, { speed: 'normal' });
    }

    payment.status = 'refunded';
    payment.refundedAt = new Date();
    await payment.save();

    if (payment.purpose === 'join_fee' || payment.purpose === 'base_subscription') {
      // Refunding the base membership removes access entirely (nothing is free)
      await User.findByIdAndUpdate(payment.userId, {
        'membership.joinFeePaid': false, 'membership.tier': 'free', 'membership.tierExpiresAt': null
      });
    }

    const Notification = require('./models/Notification');
    await Notification.create({
      userId: payment.userId, type: 'refund_processed', severity: 'info',
      title: 'Refund processed',
      body: `Your CHF ${payment.amountCHF} ${payment.purpose.replace(/_/g, ' ')} payment has been refunded. It reaches your account in 5–7 working days.`
    });

    const AuditLog = require('./models/AuditLog');
    await AuditLog.create({
      actor: req.userId, action: 'payment_refunded', targetType: 'payment',
      targetId: payment._id.toString(),
      detail: { userId: payment.userId.toString(), amountCHF: payment.amountCHF, purpose: payment.purpose }
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// 5. Webhook (Razorpay calls this async; mounted with a raw body in server.js)
router.post('/webhook', async (req, res, next) => {
  try {
    if (DEV_PAYMENTS) return res.json({ ok: true, devMode: true });

    const signature = req.headers['x-razorpay-signature'];
    const expected = crypto
      .createHmac('sha256', webhookSecret())
      .update(req.body)
      .digest('hex');

    if (signature !== expected) {
      console.warn('[SECURITY] Invalid webhook signature');
      return res.status(400).send('Invalid signature');
    }

    const event = JSON.parse(req.body.toString());
    console.log('[WEBHOOK]', event.event);
    // /verify already handles success — this is belt-and-suspenders
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.activateTier = activateTier;   // exported for tests (early-access flag integration)
