// routes-payment.js — payments: join fee, tiers, karma escalation, boost
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

// Localized pricing. Indian users are charged in INR — which is what unlocks UPI,
// netbanking and wallets in Razorpay and shows the price in ₹; users elsewhere are
// charged in CHF (international cards). CHF stays the canonical figure stored for
// reporting. Gender and country come from the DB — NEVER from the request body.
const PRICING = {
  INR: {
    code: 'INR', symbol: '₹',
    base: { male: 99, female: 499, non_binary: 299, other: 299 },
    pro_subscription: 599, max_subscription: 1499,
    karma_escalation: 49, karma_escalation_high: 99, boost: 99
  },
  CHF: {
    code: 'CHF', symbol: 'CHF ',
    base: { male: 1, female: 5, non_binary: 3, other: 3 },
    pro_subscription: 6, max_subscription: 15,
    karma_escalation: 0.5, karma_escalation_high: 1, boost: 1
  }
};
// Old purpose names (pre-July-2026 clients) map onto the new tiers.
const LEGACY_PURPOSES = {
  plus_subscription: 'pro_subscription',
  premium_subscription: 'max_subscription',
  join_fee: 'base_subscription'
};

function currencyForUser(user) { return ((user && user.profile && user.profile.country) || 'IN') === 'IN' ? 'INR' : 'CHF'; }
// { code, symbol, major, minor (=major×100), chf (canonical CHF for reporting) }
function priceFor(purpose, user) {
  const code = currencyForUser(user), t = PRICING[code], c = PRICING.CHF;
  const gender = (user && user.profile && user.profile.gender) || 'other';
  const major = purpose === 'base_subscription' ? (t.base[gender] ?? t.base.other) : (t[purpose] ?? null);
  if (major == null) return null;
  const chf = purpose === 'base_subscription' ? (c.base[gender] ?? c.base.other) : (c[purpose] ?? null);
  return { code, symbol: t.symbol, major, minor: Math.round(major * 100), chf };
}

// 1. Create order — join fee by default, or another purpose
router.post('/create-order', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const purpose = LEGACY_PURPOSES[req.body.purpose] || req.body.purpose || 'base_subscription';
    // Priced by verified gender + country (INR for India → UPI etc.). Registration
    // is by payment (before verification), so no verification gate here.
    const price = priceFor(purpose, user);
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

    const order = await razorpay.orders.create({
      amount: price.minor,
      currency: price.code,
      // Razorpay caps receipt at 40 chars — keep it short (timestamp in base36 +
      // last 6 of the user id). Full context lives in notes below.
      receipt: `sb_${Date.now().toString(36)}_${String(user._id).slice(-6)}`,
      notes: { userId: user._id.toString(), gender: user.profile.gender, purpose }
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

// GET /payment/pricing — localized prices for display (the server order is authoritative)
router.get('/pricing', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const code = currencyForUser(user), t = PRICING[code];
    res.json({
      currency: code, symbol: t.symbol,
      base: { male: t.base.male, female: t.base.female, non_binary: t.base.non_binary, yours: (t.base[user.profile && user.profile.gender] ?? t.base.other) },
      pro: t.pro_subscription, max: t.max_subscription,
      escalation: t.karma_escalation, escalationHigh: t.karma_escalation_high, boost: t.boost
    });
  } catch (e) { next(e); }
});

// 2. Verify payment (frontend calls after Razorpay checkout returns)
router.post('/verify', requireAuth, async (req, res, next) => {
  try {
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

      if (payment.purpose === 'join_fee') await markJoinFeePaid(req.userId, payment); // legacy stored orders
      if (payment.purpose.endsWith('_subscription')) await activateTier(req.userId, payment.purpose, payment);
      return res.json({ ok: true, devMode: true, paymentId: payment._id, purpose: payment.purpose });
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment fields' });
    }

    // Verify signature server-side — CRITICAL, never skip
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (expected !== razorpay_signature) {
      console.warn('[SECURITY] Invalid Razorpay signature attempt', { userId: req.userId });
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Idempotency
    const existing = await Payment.findOne({ razorpayPaymentId: razorpay_payment_id });
    if (existing) return res.json({ ok: true, alreadyProcessed: true, paymentId: existing._id });

    const user = await User.findById(req.userId);
    const purpose = LEGACY_PURPOSES[req.body.purpose] || req.body.purpose || 'base_subscription';
    const price = priceFor(purpose, user) || { chf: 0, code: 'CHF' };

    const payment = await Payment.create({
      userId: req.userId,
      purpose: purpose.replace('_high', ''),
      amountCHF: price.chf,
      currency: price.code,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      status: 'captured',
      createdAt: new Date(),
      capturedAt: new Date(),
      metadata: { gender: user.profile.gender }
    });

    if (purpose === 'join_fee') await markJoinFeePaid(req.userId, payment); // legacy stored orders
    if (purpose.endsWith('_subscription')) await activateTier(req.userId, purpose, payment);

    res.json({ ok: true, paymentId: payment._id, purpose });
  } catch (err) { next(err); }
});

// Base / Pro / Max — 30-day subscription per purchase, stacking extends.
// joinFeePaid doubles as the "membership currently active" flag: set on every
// activation, cleared by the nightly cron when the tier expires to 'free'.
async function activateTier(userId, purpose, payment) {
  const tier = purpose === 'max_subscription' ? 'max'
    : purpose === 'pro_subscription' ? 'pro' : 'base';
  const user = await User.findById(userId);
  const from = user.membership?.tierExpiresAt && user.membership.tierExpiresAt > new Date() &&
    user.membership.tier === tier
    ? user.membership.tierExpiresAt.getTime() : Date.now();
  await User.findByIdAndUpdate(userId, {
    'membership.tier': tier,
    'membership.tierExpiresAt': new Date(from + 30 * 86400000),
    'membership.joinFeePaid': true,
    'membership.paidAt': new Date(),
    ...(payment ? { 'membership.joinFeePaymentId': payment._id, 'membership.joinFeeAmountCHF': payment.amountCHF } : {})
  });
  require('./services/analytics').track('tier_activated', userId, { tier });
}

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

// 4. Admin refund (spec §2.2.5: 24h no-questions window, or verification failure).
// Executed by a moderator; Razorpay refund API in production, simulated in dev.
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
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
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
