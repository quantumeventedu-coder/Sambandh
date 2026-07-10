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

// ALL prices in CHF (Swiss francs) — no dollars, no rupees. NOTHING IS FREE:
// the base membership itself is a monthly subscription, priced by gender.
// "minor" = rappen (CHF × 100), the smallest currency unit for the gateway.
// Gender is read from the database — NEVER from the request body.
function computeBaseFee(gender) {
  if (gender === 'male') return { chf: 1, minor: 100 };     // CHF 1 / month
  if (gender === 'female') return { chf: 5, minor: 500 };   // CHF 5 / month
  return { chf: 3, minor: 300 };                            // CHF 3 / month
}

const PURPOSE_PRICES = {
  karma_escalation: { chf: 0.5, minor: 50 },
  karma_escalation_high: { chf: 1, minor: 100 },
  boost: { chf: 1, minor: 100 },
  pro_subscription: { chf: 6, minor: 600 },   // Sambandh Pro — unlimited messaging
  max_subscription: { chf: 15, minor: 1500 }  // Sambandh Max — Pro + likes list + advanced filters
};
// Old purpose names (pre-July-2026 clients) map onto the new tiers.
// join_fee → base_subscription: the join fee became the monthly base membership.
const LEGACY_PURPOSES = {
  plus_subscription: 'pro_subscription',
  premium_subscription: 'max_subscription',
  join_fee: 'base_subscription'
};
const CURRENCY = 'CHF';

// 1. Create order — join fee by default, or another purpose
router.post('/create-order', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const purpose = LEGACY_PURPOSES[req.body.purpose] || req.body.purpose || 'base_subscription';
    let amount;

    if (purpose === 'base_subscription') {
      // Monthly base membership, priced by verified gender. Renewals stack +30 days.
      // Registration is by payment (before verification), so no verification gate here.
      amount = computeBaseFee(user.profile.gender);
    } else if (PURPOSE_PRICES[purpose]) {
      amount = PURPOSE_PRICES[purpose];
    } else {
      return res.status(400).json({ error: 'Unknown purpose' });
    }

    if (DEV_PAYMENTS) {
      const orderId = 'order_dev_' + crypto.randomBytes(8).toString('hex');
      await Payment.create({
        userId: req.userId,
        purpose: purpose.replace('_high', ''),
        amountCHF: amount.chf, currency: CURRENCY,
        razorpayOrderId: orderId,
        status: 'created',
        createdAt: new Date(),
        metadata: { dev: true, gender: user.profile.gender }
      });
      return res.json({
        devMode: true, orderId,
        amount: amount.minor, amountCHF: amount.chf,
        currency: CURRENCY, purpose
      });
    }

    const order = await razorpay.orders.create({
      amount: amount.minor,
      currency: CURRENCY,
      // Razorpay caps receipt at 40 chars — keep it short (purpose + timestamp in
      // base36 + last 6 of the user id). Full context lives in notes below.
      receipt: `sb_${Date.now().toString(36)}_${String(user._id).slice(-6)}`,
      notes: { userId: user._id.toString(), gender: user.profile.gender, purpose }
    });

    res.json({
      orderId: order.id,
      amount: amount.minor, amountCHF: amount.chf,
      currency: CURRENCY,
      purpose,
      key: process.env.RAZORPAY_KEY_ID,
      prefill: { name: user.profile.firstName, contact: user.phone }
    });
  } catch (err) { next(err); }
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
    const amount = purpose === 'base_subscription'
      ? computeBaseFee(user.profile.gender)
      : PURPOSE_PRICES[purpose] || { chf: 0 };

    const payment = await Payment.create({
      userId: req.userId,
      purpose: purpose.replace('_high', ''),
      amountCHF: amount.chf,
      currency: CURRENCY,
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
