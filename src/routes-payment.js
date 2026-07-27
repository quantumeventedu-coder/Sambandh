// @ts-check
// routes-payment.js — payments: join fee, tiers, karma escalation, boost
//
// Strict-type-checked via JSDoc rather than a .ts rename — see ADR-004 (Node runs
// this file directly; there is no build step). Enforced by `tsc --noEmit` in CI.
//
// ALL amounts in CHF. Base membership is a SINGLE FLAT PRICE for every member —
// CHF 5/month — computed server-side (never taken from the request). No gender
// differential: one transparent price, easier to explain and equal by design.
// Tiers (display → internal key): Essential=base CHF 5 · Plus=pro CHF 12 ·
// Signature=max CHF 25 per month; annual is CHF 48 · 120 · 240. Keys stay base/pro/max.
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

/** @type {any} */
let razorpay = null;
if (!DEV_PAYMENTS) {
  const Razorpay = require('razorpay');
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

const fx = require('./services/fx');
const commerce = require('./services/commerce-config');
const tax = require('./services/tax');
const wallet = require('./services/wallet');
const { toMinor } = require('./services/money');

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
/** Base membership — a single flat price for every member (no gender differential).
 * Kept as a per-gender map so existing callers/readers need no change; the values
 * are deliberately identical. @type {Record<string, number>} */
const BASE_CHF = { male: 5, female: 5, non_binary: 5, other: 5 };
/** @type {Record<string, number>} */
const PURPOSE_CHF = {
  pro_subscription: 12, max_subscription: 25,
  base_annual: 48, pro_annual: 120, max_annual: 240,
  karma_escalation: 0.5, karma_escalation_high: 1, boost: 1
};
/** @type {Record<string, string>} */
const LEGACY_PURPOSES = {
  plus_subscription: 'pro_subscription',
  premium_subscription: 'max_subscription',
  join_fee: 'base_subscription'
};
/** @type {Record<string, string>} */
const SYMBOLS = { INR: '₹', CHF: 'CHF ', USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SGD: 'S$', AUD: 'A$', CAD: 'C$', JPY: '¥' };

// Gateway amounts are charged in minor units (services/money.toMinor is currency-
// exponent-aware, so ¥932 stays 932, not 93200).

/**
 * Map a payment purpose to a tax category (so the right rate applies per jurisdiction).
 * Marketplace/consultation orders that carry their own category use createDirectOrder.
 * @param {string} purpose
 * @returns {string}
 */
function categoryForPurpose(purpose) {
  if (/(_subscription|_annual)$/.test(purpose) || purpose === 'base_subscription') return 'subscription';
  if (purpose === 'consultation' || purpose === 'consultation_session') return 'consultation';
  if (purpose === 'verification_service') return 'verification';
  if (purpose === 'gift_pass') return 'gift';
  return 'default';
}

/**
 * A user document, as far as pricing is concerned. Deliberately narrow: pricing
 * reads gender and country from the STORED user, never from the request.
 * @typedef {{ _id?: unknown, profile?: { gender?: string, country?: string, firstName?: string }, phone?: string }} PricingUser
 */

/**
 * The currency to charge this user in — derived from the super-admin-editable commerce
 * config (each country charged in its own currency; India → INR unlocks UPI). Falls
 * back to the config DEFAULT for unlisted countries.
 * @param {PricingUser | null | undefined} user
 * @returns {Promise<string>}
 */
async function currencyForUser(user) {
  const cc = await commerce.countryConfig((user && user.profile && user.profile.country) || 'IN');
  return cc.currency;
}

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
 * The full, itemized, honest quote for a purpose (SHIG R-14): base (live fx-converted)
 * + every tax line (per the buyer's country/category) + the gateway fee → total. This
 * is what the buyer is actually charged. Country/gender come from the STORED user.
 * @param {string} purpose
 * @param {PricingUser | null | undefined} user
 * @returns {Promise<null | { code:string, symbol:string, chf:number, base:number, taxName:string, taxRate:number, taxTotal:number, taxLines:Array<{label:string,rate:number,amount:number}>, gatewayFeePct:number, gatewayFee:number, total:number, minor:number, country:string, category:string }>}
 */
async function quoteFor(purpose, user) {
  const gender = (user && user.profile && user.profile.gender) || 'other';
  const chf = chfAmount(purpose, gender);
  if (chf == null) return null;
  const country = (user && user.profile && user.profile.country) || 'IN';
  const cc = await commerce.countryConfig(country);
  const cfg = await commerce.getCommerce();
  const code = cc.currency;
  const base = await fx.convertFromCHF(chf, code);
  const category = categoryForPurpose(purpose);
  const taxRate = await commerce.categoryRate(country, category);
  const q = tax.computeQuote({
    components: [{ label: 'Membership', amount: base, rate: taxRate }],
    taxName: cc.taxName, gatewayFeePct: cfg.gatewayFeePct,
  });
  return {
    code, symbol: SYMBOLS[code] || (code + ' '),
    chf, base: q.base, taxName: cc.taxName, taxRate, taxTotal: q.taxTotal, taxLines: q.lines,
    gatewayFeePct: q.gatewayFeePct, gatewayFee: q.gatewayFee,
    total: q.total, minor: toMinor(q.total, code), country, category,
  };
}

// 1. Create order — join fee by default, or another purpose
router.post('/create-order', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const purpose = LEGACY_PURPOSES[req.body.purpose] || req.body.purpose || 'base_subscription';
    // Priced by verified gender + country (INR for India → UPI etc.), live-converted
    // from CHF. Registration is by payment, so no verification gate here.
    // The itemized quote is AUTHORITATIVE: base (live fx from CHF) + tax (per the
    // buyer's country/category) + gateway fee → total. The user is charged `total`.
    const quote = await quoteFor(purpose, user);
    if (!quote) return res.status(400).json({ error: 'Unknown purpose' });
    // Breakdown persisted with the order so /verify, receipts, and pro-rated refunds
    // read the real charged amounts back from the DB, never from the request body.
    const breakdown = {
      base: quote.base, taxName: quote.taxName, taxRate: quote.taxRate,
      taxTotal: quote.taxTotal, taxLines: quote.taxLines,
      gatewayFeePct: quote.gatewayFeePct, gatewayFee: quote.gatewayFee,
      total: quote.total, country: quote.country, category: quote.category,
    };
    const clientQuote = {
      amount: quote.minor, amountMajor: quote.total, amountCHF: quote.chf,
      currency: quote.code, symbol: quote.symbol, purpose, breakdown,
    };

    if (DEV_PAYMENTS) {
      const orderId = 'order_dev_' + crypto.randomBytes(8).toString('hex');
      await Payment.create({
        userId: req.userId,
        purpose: purpose.replace('_high', ''),
        amountCHF: quote.chf, currency: quote.code,
        razorpayOrderId: orderId,
        status: 'created',
        createdAt: new Date(),
        metadata: { dev: true, gender: user.profile.gender, amountLocal: quote.total, ...breakdown }
      });
      return res.json({ devMode: true, orderId, ...clientQuote });
    }

    // Fail closed: never attempt a live order without a configured client.
    if (!razorpay) return res.status(503).json({ error: 'Payments are not configured.' });
    const order = await razorpay.orders.create({
      amount: quote.minor,
      currency: quote.code,
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
      amountCHF: quote.chf, currency: quote.code,
      razorpayOrderId: order.id,
      status: 'created',
      createdAt: new Date(),
      metadata: { gender: user.profile.gender, amountLocal: quote.total, ...breakdown }
    });

    res.json({
      orderId: order.id, ...clientQuote,
      key: process.env.RAZORPAY_KEY_ID,
      prefill: { name: user.profile.firstName, contact: user.phone }
    });
  } catch (err) { next(err); }
});

// GET /payment/quote?purpose=… — the itemized breakdown for display (server order is
// authoritative). Lets checkout show base + tax lines + gateway fee → total before pay.
router.get('/quote', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const purposeRaw = String(req.query.purpose || 'base_subscription');
    const purpose = LEGACY_PURPOSES[purposeRaw] || purposeRaw;
    const quote = await quoteFor(purpose, user);
    if (!quote) return res.status(400).json({ error: 'Unknown purpose' });
    res.json(quote);
  } catch (e) { next(e); }
});

// Cancel membership. Policy (super-admin editable via commerce.cancellation):
//   • within `windowDays` of the last payment → cancel + PRO-RATED refund of the
//     unused portion of the paid period;
//   • after the window → refused (the membership simply runs to its paid expiry).
// The refund fraction and amounts are computed server-side from the STORED payment,
// never the request, so the amount can't be inflated by the client.
const SUB_PURPOSES = ['base_subscription', 'pro_subscription', 'max_subscription', 'base_annual', 'pro_annual', 'max_annual'];
router.post('/cancel-subscription', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthenticated' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const m = (user.membership) || {};
    const active = m.tier && m.tier !== 'free' && m.tierExpiresAt && new Date(m.tierExpiresAt) > new Date();
    if (!active) return res.status(400).json({ error: 'No active membership to cancel.' });

    const cfg = await commerce.getCommerce();
    const windowDays = (cfg.cancellation && cfg.cancellation.windowDays) || 0;
    const prorate = !cfg.cancellation || cfg.cancellation.prorate !== false;

    const payment = await Payment.findOne({ userId, purpose: { $in: SUB_PURPOSES }, status: 'captured' }).sort({ capturedAt: -1 });
    const paidAt = m.paidAt ? new Date(m.paidAt) : (payment && payment.capturedAt ? new Date(payment.capturedAt) : null);
    if (!paidAt) return res.status(400).json({ error: 'No payment on record to cancel against.' });

    const ageDays = (Date.now() - paidAt.getTime()) / 86400000;
    if (ageDays > windowDays) {
      return res.status(403).json({
        error: `Cancellation is only available within ${windowDays} day(s) of payment. Your membership stays active until it expires.`,
        windowDays, expiresAt: m.tierExpiresAt,
      });
    }

    // Atomically CLAIM the payment (captured → refunding) BEFORE touching the gateway,
    // so two concurrent cancels — or a retry after a crash — can never double-refund:
    // only the request that wins the conditional update proceeds; the rest get 409.
    let claimed = null;
    if (payment) {
      claimed = await Payment.findOneAndUpdate(
        { _id: payment._id, status: 'captured' },
        { $set: { status: 'refunding' } },
        { new: true },
      );
      if (!claimed) return res.status(409).json({ error: 'A cancellation is already in progress or completed.' });
    }

    // Pro-rated refund of the UNUSED portion of the paid period (server-computed).
    const expires = new Date(m.tierExpiresAt).getTime();
    const period = Math.max(1, expires - paidAt.getTime());
    const unused = Math.max(0, expires - Date.now());
    const fraction = prorate ? Math.min(1, Math.max(0, unused / period)) : 1;
    const paidTotal = (claimed && claimed.metadata && Number(claimed.metadata.total)) ||
      (claimed && claimed.metadata && Number(claimed.metadata.amountLocal)) ||
      (claimed && Number(claimed.amountCHF)) || 0;
    const currency = (claimed && claimed.currency) || 'CHF';
    const refundAmount = Math.round(paidTotal * fraction * 100) / 100;

    // Refund at the gateway (real partial refund in prod; simulated in dev), then
    // finalize the claimed row. On a gateway error, roll the claim back to 'captured'.
    if (claimed) {
      try {
        if (refundAmount > 0 && !DEV_PAYMENTS && razorpay && claimed.razorpayPaymentId) {
          await razorpay.payments.refund(claimed.razorpayPaymentId, {
            amount: toMinor(refundAmount, currency), speed: 'normal',
            notes: { idempotency: `refund_${claimed._id}` },
          });
        }
        claimed.status = 'refunded';
        claimed.refundedAt = new Date();
        await claimed.save();
      } catch (refundErr) {
        await Payment.findOneAndUpdate({ _id: claimed._id, status: 'refunding' }, { $set: { status: 'captured' } });
        throw refundErr;
      }
    }

    await User.findByIdAndUpdate(userId, {
      'membership.tier': 'free', 'membership.tierExpiresAt': null,
      'membership.joinFeePaid': false, 'membership.cancelledAt': new Date(),
    });

    try {
      const Notification = require('./models/Notification');
      await Notification.create({
        userId, type: 'membership_cancelled', severity: 'info', title: 'Membership cancelled',
        body: refundAmount > 0
          ? `Your membership is cancelled. A pro-rated refund of ${currency} ${refundAmount} (for the unused time) reaches your account in 5–7 working days.`
          : 'Your membership is cancelled.',
      });
    } catch { /* notification is best-effort */ }

    const AuditLog = require('./models/AuditLog');
    await AuditLog.create({
      actor: String(userId), action: 'membership_cancelled', targetType: 'user', targetId: String(userId),
      detail: { refundAmount, currency, fraction: Math.round(fraction * 1000) / 1000, ageDays: Math.round(ageDays * 100) / 100 },
    });

    res.json({ ok: true, refunded: refundAmount > 0, refundAmount, currency, fraction: Math.round(fraction * 1000) / 1000 });
  } catch (err) { next(err); }
});

// ---- WALLET: stored value, so members can pay without a gateway each time (and in
// countries where UPI/cards are awkward). Paying FROM the wallet skips the per-txn
// gateway fee; the fee was already paid at top-up. ------------------------------------

// GET /payment/wallet — balance + recent ledger.
router.get('/wallet', requireAuth, async (req, res, next) => {
  try {
    const [w, history] = await Promise.all([wallet.getWallet(req.userId), wallet.history(req.userId, 30)]);
    res.json({ ...w, history });
  } catch (e) { next(e); }
});

// POST /payment/wallet/topup { amount } — add funds. Charges (amount + gateway fee) via
// the gateway; on capture (/verify) the wallet is credited `amount` (no tax — storing
// value is not a taxable supply).
router.post('/wallet/topup', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const amount = Math.round((Number(req.body.amount) || 0) * 100) / 100;
    if (!(amount > 0)) return res.status(400).json({ error: 'Enter a top-up amount' });
    const cc = await commerce.countryConfig((user.profile && user.profile.country) || 'IN');
    const cfg = await commerce.getCommerce();
    const code = cc.currency;
    const w = await wallet.getWallet(user._id);
    if (w.currency && w.balance > 0 && w.currency !== code) {
      return res.status(400).json({ error: `Your wallet holds ${w.currency}; top up in ${w.currency}.` });
    }
    const q = tax.computeQuote({ components: [{ label: 'Top-up', amount, rate: 0 }], gatewayFeePct: cfg.gatewayFeePct });
    const meta = { topupAmount: amount, gatewayFee: q.gatewayFee, total: q.total, currency: code, amountLocal: q.total };
    const clientQuote = { amount: toMinor(q.total, code), amountMajor: q.total, currency: code, symbol: SYMBOLS[code] || (code + ' '), purpose: 'wallet_topup', topupAmount: amount, gatewayFee: q.gatewayFee };

    if (DEV_PAYMENTS) {
      const orderId = 'order_dev_' + crypto.randomBytes(8).toString('hex');
      await Payment.create({ userId: req.userId, purpose: 'wallet_topup', amountCHF: 0, currency: code, razorpayOrderId: orderId, status: 'created', createdAt: new Date(), metadata: { dev: true, ...meta } });
      return res.json({ devMode: true, orderId, ...clientQuote });
    }
    if (!razorpay) return res.status(503).json({ error: 'Payments are not configured.' });
    const order = await razorpay.orders.create({ amount: toMinor(q.total, code), currency: code, receipt: `wt_${Date.now().toString(36)}_${String(user._id).slice(-6)}`, notes: { userId: String(user._id), purpose: 'wallet_topup' } });
    await Payment.create({ userId: req.userId, purpose: 'wallet_topup', amountCHF: 0, currency: code, razorpayOrderId: order.id, status: 'created', createdAt: new Date(), metadata: meta });
    res.json({ orderId: order.id, ...clientQuote, key: process.env.RAZORPAY_KEY_ID, prefill: { name: user.profile.firstName, contact: user.phone } });
  } catch (e) { next(e); }
});

// POST /payment/pay-wallet { purpose } — pay a membership plan from the wallet. NO gateway
// fee (internal): total = base + tax. Atomic debit; if fulfillment fails, auto-refund.
router.post('/pay-wallet', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const purpose = LEGACY_PURPOSES[req.body.purpose] || req.body.purpose || 'base_subscription';
    if (!/_(subscription|annual)$/.test(purpose)) return res.status(400).json({ error: 'Wallet payment supports membership plans here.' });
    const quote = await quoteFor(purpose, user);
    if (!quote) return res.status(400).json({ error: 'Unknown purpose' });
    const walletTotal = Math.round((quote.base + quote.taxTotal) * 100) / 100;   // base + tax, no gateway fee
    const cur = quote.code;
    const w = await wallet.getWallet(user._id);
    if (w.currency && w.currency !== cur) return res.status(400).json({ error: `Your wallet holds ${w.currency}, but this is priced in ${cur}.` });
    if (w.balance < walletTotal) return res.status(402).json({ error: 'Insufficient wallet balance', needed: walletTotal, balance: w.balance, currency: cur });

    // Atomic debit first; the balance guard prevents overspend/double-pay.
    const after = await wallet.debit(user._id, walletTotal, cur, { purpose, note: `Membership (${purpose})` });
    if (!after) return res.status(402).json({ error: 'Insufficient wallet balance', currency: cur });
    try {
      const payment = await Payment.create({
        userId: req.userId, purpose: purpose.replace('_high', ''), amountCHF: quote.chf, currency: cur,
        status: 'captured', method: 'wallet', capturedAt: new Date(), createdAt: new Date(),
        metadata: { base: quote.base, taxTotal: quote.taxTotal, total: walletTotal, country: quote.country, category: quote.category, paidFromWallet: true },
      });
      await activateTier(String(req.userId), purpose, payment);
      res.json({ ok: true, paidFromWallet: true, amount: walletTotal, currency: cur, balance: after.balance, paymentId: payment._id });
    } catch (fulfillErr) {
      // Roll the money back if we couldn't grant what they paid for.
      await wallet.credit(user._id, walletTotal, cur, { type: 'refund', purpose, note: 'Auto-refund: fulfillment failed' });
      throw fulfillErr;
    }
  } catch (e) { next(e); }
});

// GET /payment/pricing — live, localized prices for display (server order is authoritative)
router.get('/pricing', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const code = await currencyForUser(user);
    /** @param {number} chf */
    const conv = (chf) => fx.convertFromCHF(chf, code);
    const gender = (user.profile && user.profile.gender) || 'other';
    const [male, female, nb, yours, pro, max, baseYr, proYr, maxYr, esc, escH, boost] = await Promise.all([
      conv(BASE_CHF.male), conv(BASE_CHF.female), conv(BASE_CHF.non_binary), conv(BASE_CHF[gender] ?? BASE_CHF.other),
      conv(PURPOSE_CHF.pro_subscription), conv(PURPOSE_CHF.max_subscription),
      conv(PURPOSE_CHF.base_annual), conv(PURPOSE_CHF.pro_annual), conv(PURPOSE_CHF.max_annual),
      conv(PURPOSE_CHF.karma_escalation), conv(PURPOSE_CHF.karma_escalation_high), conv(PURPOSE_CHF.boost)
    ]);
    res.json({ currency: code, symbol: SYMBOLS[code] || (code + ' '),
      base: { male, female, non_binary: nb, yours }, pro, max,
      annual: { base: baseYr, pro: proYr, max: maxYr },
      escalation: esc, escalationHigh: escH, boost });
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
      // Atomic claim (created → captured) so a duplicate submit can't double-grant.
      const payment = await Payment.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id, userId: req.userId, status: 'created' },
        { $set: { status: 'captured', capturedAt: new Date(), razorpayPaymentId: 'pay_dev_' + crypto.randomBytes(8).toString('hex'), method: 'dev_simulated' } },
        { new: true },
      );
      if (!payment) {
        const done = await Payment.findOne({ razorpayOrderId: razorpay_order_id, userId: req.userId });
        if (done) return res.json({ ok: true, alreadyProcessed: true, paymentId: done._id });
        return res.status(404).json({ error: 'Order not found' });
      }

      if (payment.purpose === 'join_fee') await markJoinFeePaid(userId, payment); // legacy stored orders
      if (/_(subscription|annual)$/.test(payment.purpose)) await activateTier(userId, payment.purpose, payment);
      if (payment.purpose === 'wallet_topup') await wallet.credit(userId, payment.metadata.topupAmount, payment.metadata.currency, { type: 'topup', ref: String(payment._id), note: 'Wallet top-up' });
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

    // ATOMIC idempotency + authority in ONE conditional update: transition the priced
    // order created → captured. The order we priced at create-order time is the ONLY
    // authority on what was bought (req.body.purpose is attacker-controlled — the
    // Razorpay signature covers order_id|payment_id only, so trusting it would let
    // someone pay for base_subscription (CHF 5) and claim max_subscription (CHF 25)).
    // Because the flip is conditional on status:'created', two concurrent verifies can
    // never both capture-and-grant — only the winner flips; the rest are already-processed.
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id, userId: req.userId, status: 'created' },
      { $set: { status: 'captured', capturedAt: new Date(), razorpayPaymentId: razorpay_payment_id, razorpaySignature: razorpay_signature } },
      { new: true },
    );
    if (!payment) {
      const done = await Payment.findOne({ razorpayOrderId: razorpay_order_id, userId: req.userId });
      if (done) return res.json({ ok: true, alreadyProcessed: true, paymentId: done._id, purpose: done.purpose });
      return res.status(404).json({ error: 'Order not found' });
    }
    const purpose = payment.purpose;                     // authoritative, from the DB

    if (purpose === 'join_fee') await markJoinFeePaid(userId, payment); // legacy stored orders
    if (/_(subscription|annual)$/.test(purpose)) await activateTier(userId, purpose, payment);
    if (purpose === 'wallet_topup') await wallet.credit(userId, payment.metadata.topupAmount, payment.metadata.currency, { type: 'topup', ref: String(payment._id), note: 'Wallet top-up' });

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
  // The tier is the purpose stem (base|pro|max), independent of the billing period.
  // Annual purchases ('_annual') grant 365 days; monthly ('_subscription') grant 30.
  const annual = purpose.endsWith('_annual');
  const stem = purpose.replace(/_(subscription|annual)$/, '');
  const tier = stem === 'max' ? 'max' : stem === 'pro' ? 'pro' : 'base';
  const days = annual ? 365 : 30;
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
  const newEnd = Math.max(from + days * 86400000, curEnd);
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
    // Atomically claim (captured → refunding) so two admins — or a retry — can't
    // double-refund the same payment.
    const payment = await Payment.findOneAndUpdate(
      { _id: req.params.paymentId, status: 'captured' },
      { $set: { status: 'refunding' } },
      { new: true },
    );
    if (!payment) {
      const existing = await Payment.findById(req.params.paymentId);
      if (!existing) return res.status(404).json({ error: 'Payment not found' });
      return res.status(400).json({ error: 'Only captured payments can be refunded' });
    }

    // Report the amount actually charged, in the currency actually charged (not CHF).
    const currency = payment.currency || 'CHF';
    const refundedLocal = (payment.metadata && Number(payment.metadata.total)) ||
      (payment.metadata && Number(payment.metadata.amountLocal)) || Number(payment.amountCHF) || 0;

    try {
      if (!DEV_PAYMENTS && razorpay && payment.razorpayPaymentId) {
        await razorpay.payments.refund(payment.razorpayPaymentId, { speed: 'normal', notes: { idempotency: `refund_${payment._id}` } });
      }
      payment.status = 'refunded';
      payment.refundedAt = new Date();
      await payment.save();
    } catch (refundErr) {
      await Payment.findOneAndUpdate({ _id: payment._id, status: 'refunding' }, { $set: { status: 'captured' } });
      throw refundErr;
    }

    if (payment.purpose === 'join_fee' || payment.purpose === 'base_subscription') {
      // Refunding the base membership removes access entirely (nothing is free)
      await User.findByIdAndUpdate(payment.userId, {
        'membership.joinFeePaid': false, 'membership.tier': 'free', 'membership.tierExpiresAt': null
      });
    }
    // Refunding a gift pass must also invalidate it — an un-redeemed pass is revoked so
    // it can never be redeemed for value that was paid back.
    if (payment.purpose === 'gift_pass') {
      try { await require('./services/gift-pass').handlePaymentRefund(payment); }
      catch (e) { console.error('[REFUND] gift-pass reconcile failed:', e instanceof Error ? e.message : e); }
    }

    const Notification = require('./models/Notification');
    await Notification.create({
      userId: payment.userId, type: 'refund_processed', severity: 'info',
      title: 'Refund processed',
      body: `Your ${currency} ${refundedLocal} ${payment.purpose.replace(/_/g, ' ')} payment has been refunded. It reaches your account in 5–7 working days.`
    });

    const AuditLog = require('./models/AuditLog');
    await AuditLog.create({
      actor: req.userId, action: 'payment_refunded', targetType: 'payment',
      targetId: payment._id.toString(),
      detail: { userId: payment.userId.toString(), amountCHF: payment.amountCHF, refundedLocal, currency, purpose: payment.purpose }
    });

    res.json({ ok: true, refundedAmount: refundedLocal, currency });
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

/**
 * Create a Payment + order for a product priced DIRECTLY in CHF (marketplace,
 * consultation, verification services — NOT the gender-priced membership tiers).
 * Dev mode simulates the order id ('order_dev_…', captured by the normal /verify
 * dev path); prod creates a real Razorpay order. The returned payment is 'created'.
 * `metadata` (e.g. { caseId }) binds the payment to what it pays for, so a later
 * confirm step can verify purpose + amount + ownership before granting anything.
 * @param {{ userId:any, purpose:string, amountCHF:number, currency?:string, metadata?:Record<string,any> }} args
 * @returns {Promise<{ devMode:boolean, orderId:string, key?:string, payment:any }>}
 */
async function createDirectOrder({ userId, purpose, amountCHF, currency = 'CHF', metadata = {} }) {
  const amt = Math.round((Number(amountCHF) || 0) * 100) / 100;
  if (!(amt > 0)) throw new Error('Invalid order amount');
  if (DEV_PAYMENTS) {
    const orderId = 'order_dev_' + crypto.randomBytes(8).toString('hex');
    const payment = await Payment.create({
      userId, purpose, amountCHF: amt, currency, razorpayOrderId: orderId,
      status: 'created', createdAt: new Date(), metadata: { ...metadata, dev: true }
    });
    return { devMode: true, orderId, payment };
  }
  if (!razorpay) throw new Error('Payments are not configured');
  const order = await razorpay.orders.create({
    amount: toMinor(amt, currency), currency,
    receipt: `sb_${Date.now().toString(36)}_${String(userId).slice(-6)}`,
    notes: { userId: String(userId), purpose }
  });
  const payment = await Payment.create({
    userId, purpose, amountCHF: amt, currency, razorpayOrderId: order.id,
    status: 'created', createdAt: new Date(), metadata
  });
  return { devMode: false, orderId: order.id, key: process.env.RAZORPAY_KEY_ID, payment };
}

module.exports = router;
module.exports.activateTier = activateTier;   // exported for tests (early-access flag integration)
module.exports.createDirectOrder = createDirectOrder;
