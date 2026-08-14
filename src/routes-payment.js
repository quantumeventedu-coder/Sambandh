// @ts-check
// routes-payment.js — payments: join fee, tiers, karma escalation, boost
//
// Strict-type-checked via JSDoc rather than a .ts rename — see ADR-004 (Node runs
// this file directly; there is no build step). Enforced by `tsc --noEmit` in CI.
//
// ALL amounts in CHF. Base membership is a SINGLE FLAT PRICE for every member —
// CHF 5/month — computed server-side (never taken from the request). No gender
// differential: one transparent price, easier to explain and equal by design.
// Tiers (display → internal key): Basic=base CHF 5 · Plus=pro CHF 12 ·
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
const coupons = require('./services/coupons');
const { bestEffort } = require('./services/best-effort');
const invoicing = require('./services/invoicing');
const { toMinor, fromMinor } = require('./services/money');

/**
 * Genuinely-atomic Payment state transition: ONE conditional `UPDATE … WHERE … RETURNING`
 * (pg-odm atomicUpdate), so two concurrent requests can never both win the same transition
 * — the loser gets null. Plain findOneAndUpdate is READ-THEN-WRITE on pg-odm (loads then
 * UPDATEs by id, NOT re-checking the status guard in SQL), which would let concurrent
 * /verify, cancel, or refund calls double-capture / double-refund. Used for every
 * money-critical status flip. Falls back to findOneAndUpdate only where atomicUpdate is
 * absent (real MongoDB, where findOneAndUpdate is itself atomic).
 * @param {Record<string,any>} filter @param {Record<string,any>} set
 * @returns {Promise<any>}
 */
function claimPayment(filter, set) {
  return typeof (/** @type {any} */ (Payment).atomicUpdate) === 'function'
    ? (/** @type {any} */ (Payment)).atomicUpdate(filter, { $set: set })
    : Payment.findOneAndUpdate(filter, { $set: set }, { new: true });
}

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

/** Constant-time compare of a computed HMAC against a client-supplied signature, on the payment-auth
 * boundary. A plain `!==` short-circuits on the first differing byte (a timing side-channel); this
 * doesn't. Length-guarded so timingSafeEqual never throws on unequal buffers. @param {string} a @param {string} b */
function signaturesEqual(a, b) {
  const ab = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
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
 * The full, itemized, honest quote (SHIG R-14): base (live fx-converted) + every tax
 * line (per the buyer's country/category) + the gateway fee → total. This is what the
 * buyer is actually charged. Country comes from the STORED user. Used for variable-priced
 * items (gift passes, verification) that can't derive their price from the purpose alone.
 * A coupon discount (in CHF) is applied to the base BEFORE tax, so GST/VAT is charged on
 * the discounted amount. `grossBase` keeps the pre-discount base for the itemized bill.
 * @param {number|null|undefined} chf @param {string} category
 * @param {PricingUser | null | undefined} user @param {string} [label] @param {number} [discountCHF]
 * @returns {Promise<null | { code:string, symbol:string, chf:number, grossBase:number, base:number, discountCHF:number, discountLocal:number, taxName:string, taxRate:number, taxTotal:number, taxLines:Array<{label:string,rate:number,amount:number}>, gatewayFeePct:number, gatewayFee:number, total:number, minor:number, country:string, category:string }>}
 */
async function quoteForAmount(chf, category, user, label = 'Membership', discountCHF = 0) {
  if (chf == null || !(Number(chf) > 0)) return null;
  const country = (user && user.profile && user.profile.country) || 'IN';
  const cc = await commerce.countryConfig(country);
  const cfg = await commerce.getCommerce();
  const code = cc.currency;
  const grossBase = await fx.convertFromCHF(Number(chf), code);
  // Discount is pre-tax: convert the CHF discount to the buyer's currency, cap it at the
  // base, and tax the remainder.
  const discountLocal = Number(discountCHF) > 0 ? Math.min(await fx.convertFromCHF(Number(discountCHF), code), grossBase) : 0;
  const netBase = Math.max(0, Math.round((grossBase - discountLocal) * 100) / 100);
  const taxRate = await commerce.categoryRate(country, category);
  const q = tax.computeQuote({
    components: [{ label, amount: netBase, rate: taxRate }],
    taxName: cc.taxName, gatewayFeePct: cfg.gatewayFeePct,
  });
  return {
    code, symbol: SYMBOLS[code] || (code + ' '),
    chf: Number(chf), grossBase: Math.round(grossBase * 100) / 100, base: q.base,
    discountCHF: Math.round((Number(discountCHF) || 0) * 100) / 100, discountLocal: Math.round(discountLocal * 100) / 100,
    taxName: cc.taxName, taxRate, taxTotal: q.taxTotal, taxLines: q.lines,
    gatewayFeePct: q.gatewayFeePct, gatewayFee: q.gatewayFee,
    total: q.total, minor: toMinor(q.total, code), country, category,
  };
}

/** The itemized quote for a fixed-price purpose (membership tiers): price derived from the
 * buyer's verified gender + the purpose, minus an optional pre-tax coupon discount (CHF).
 * @param {string} purpose @param {PricingUser | null | undefined} user @param {number} [discountCHF] */
async function quoteFor(purpose, user, discountCHF = 0) {
  const gender = (user && user.profile && user.profile.gender) || 'other';
  return quoteForAmount(chfAmount(purpose, gender), categoryForPurpose(purpose), user, 'Membership', discountCHF);
}

// 1. Create order — join fee by default, or another purpose
router.post('/create-order', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const purpose = LEGACY_PURPOSES[req.body.purpose] || req.body.purpose || 'base_subscription';
    // Optional coupon — validated and priced SERVER-SIDE (authoritative). The discount
    // reduces the base BEFORE tax. A bad coupon fails the order loudly, never silently at
    // full price.
    let coupon = null, couponDiscountCHF = 0;
    if (req.body.couponCode) {
      const chfBase = chfAmount(purpose, (user.profile && user.profile.gender) || 'other');
      try {
        const v = await coupons.validate(req.body.couponCode, purpose, chfBase || 0, req.userId);
        coupon = v.coupon; couponDiscountCHF = v.discountCHF;
      } catch (e) {
        return res.status(400).json({ error: (e && /** @type {any} */ (e).message) || 'Invalid coupon', couponError: (e && /** @type {any} */ (e).code) || 'INVALID' });
      }
    }
    // Priced by verified gender + country (INR for India → UPI etc.), live-converted
    // from CHF. The itemized quote is AUTHORITATIVE: base (live fx from CHF) − coupon
    // discount + tax (per the buyer's country/category) + gateway fee → total.
    const quote = await quoteFor(purpose, user, couponDiscountCHF);
    if (!quote) return res.status(400).json({ error: 'Unknown purpose' });
    // RESERVE the coupon NOW — before the discounted price is committed — so the total cap
    // and per-user limit are enforced up front. (Deferring to /verify would let several
    // checkouts price at the discount before any is consumed, then swallow the over-cap at
    // capture — real discounted sales past the cap.) Idempotent on couponRef; /verify
    // re-confirms the same ref. A reserved-but-abandoned order holds a slot — a safe-direction
    // leak; releasing on expiry is a follow-up.
    const couponRef = coupon ? 'cpn_' + crypto.randomBytes(8).toString('hex') : null;
    if (coupon) {
      try {
        // committed:false for a PAID membership (the sweep reclaims it if the checkout is abandoned;
        // /verify's redeemOrderCoupon commits it on capture). A FREE (100%-off) grant fulfils inline
        // and never reaches /verify, so it is committed at once and never swept.
        await coupons.redeem({ coupon, userId: req.userId, orderRef: /** @type {string} */ (couponRef), purpose: purpose.replace('_high', ''), discountCHF: couponDiscountCHF, discountLocal: quote.discountLocal, currency: quote.code, committed: quote.total <= 0 });
      } catch (e) {
        return res.status(409).json({ error: (e && /** @type {any} */ (e).message) || 'This coupon could not be applied.', couponError: (e && /** @type {any} */ (e).code) || 'EXHAUSTED' });
      }
    }
    // Breakdown persisted with the order so /verify, receipts, and pro-rated refunds
    // read the real charged amounts back from the DB, never from the request body.
    const breakdown = {
      grossBase: quote.grossBase, discountLocal: quote.discountLocal, discountCHF: quote.discountCHF,
      base: quote.base, taxName: quote.taxName, taxRate: quote.taxRate,
      taxTotal: quote.taxTotal, taxLines: quote.taxLines,
      gatewayFeePct: quote.gatewayFeePct, gatewayFee: quote.gatewayFee,
      total: quote.total, country: quote.country, category: quote.category,
      ...(coupon ? { couponCode: coupon.code, couponOrderRef: /** @type {string} */ (couponRef) } : {}),
    };
    const clientQuote = {
      amount: quote.minor, amountMajor: quote.total, amountCHF: quote.chf,
      currency: quote.code, symbol: quote.symbol, purpose, breakdown,
      couponCode: coupon ? coupon.code : null, discountLocal: quote.discountLocal,
    };

    // Fully discounted (e.g. a 100%-off tester coupon) → NO gateway charge. The coupon is
    // already reserved above; record a captured 'coupon' Payment and fulfill (grant the tier).
    if (quote.total <= 0) {
      let payment;
      try {
        payment = await Payment.create({
          userId: req.userId, purpose: purpose.replace('_high', ''), amountCHF: quote.chf, currency: quote.code,
          razorpayOrderId: couponRef || ('free_' + crypto.randomBytes(8).toString('hex')), status: 'captured', method: 'coupon', capturedAt: new Date(), createdAt: new Date(),
          metadata: { free: true, gender: user.profile.gender, amountLocal: 0, ...breakdown },
        });
      } catch (e) {
        // The grant was consumed (committed:true, no paymentId → the sweep won't normally reach it),
        // so release now rather than leak the slot on a membership that was never granted. markSweepable
        // (inside releaseCouponFor) FIRST so that even on a double DB failure the row is committed:false
        // and the nightly sweep reclaims it.
        if (coupon) await releaseCouponFor({ metadata: { couponCode: coupon.code, couponOrderRef: couponRef } });
        throw e;
      }
      await fulfillCaptured(req.userId, payment);
      return res.json({ ...clientQuote, free: true, ok: true, activated: true, purpose: payment.purpose, paymentId: payment._id });
    }

    if (DEV_PAYMENTS) {
      const orderId = 'order_dev_' + crypto.randomBytes(8).toString('hex');
      const payment = await Payment.create({
        userId: req.userId,
        purpose: purpose.replace('_high', ''),
        amountCHF: quote.chf, currency: quote.code,
        razorpayOrderId: orderId,
        status: 'created',
        createdAt: new Date(),
        metadata: { dev: true, gender: user.profile.gender, amountLocal: quote.total, ...breakdown }
      });
      // Give the (committed:false) reservation the paymentId the sweep needs to distinguish an
      // abandoned checkout from a real late capture.
      if (coupon) await coupons.attachReservationPayment(/** @type {string} */ (couponRef), payment._id);
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
    const paidPayment = await Payment.create({
      userId: req.userId,
      purpose: purpose.replace('_high', ''),
      amountCHF: quote.chf, currency: quote.code,
      razorpayOrderId: order.id,
      status: 'created',
      createdAt: new Date(),
      metadata: { gender: user.profile.gender, amountLocal: quote.total, ...breakdown }
    });
    // Give the (committed:false) reservation the paymentId the sweep needs (abandonment vs capture).
    if (coupon) await coupons.attachReservationPayment(/** @type {string} */ (couponRef), paidPayment._id);

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

// POST /payment/coupon/preview { code, purpose } — validate a coupon and return the
// DISCOUNTED itemized quote for display, without creating an order. A bad code returns 400
// with the reason (so checkout can show it) — nothing is consumed.
router.post('/coupon/preview', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const purpose = LEGACY_PURPOSES[req.body.purpose] || req.body.purpose || 'base_subscription';
    const chfBase = chfAmount(purpose, (user.profile && user.profile.gender) || 'other');
    if (chfBase == null) return res.status(400).json({ error: 'Unknown purpose' });
    let discountCHF = 0, code = null;
    try {
      const v = await coupons.validate(req.body.code, purpose, chfBase, req.userId);
      discountCHF = v.discountCHF; code = v.coupon.code;
    } catch (e) {
      return res.status(400).json({ ok: false, error: (e && /** @type {any} */ (e).message) || 'Invalid coupon', couponError: (e && /** @type {any} */ (e).code) || 'INVALID' });
    }
    const quote = await quoteFor(purpose, user, discountCHF);
    if (!quote) return res.status(400).json({ error: 'Unknown purpose' });
    res.json({
      ok: true, couponCode: code, purpose,
      amount: quote.minor, amountMajor: quote.total, currency: quote.code, symbol: quote.symbol,
      discountLocal: quote.discountLocal, discountCHF,
      free: quote.total <= 0,
      breakdown: {
        grossBase: quote.grossBase, discountLocal: quote.discountLocal, base: quote.base,
        taxName: quote.taxName, taxTotal: quote.taxTotal, gatewayFee: quote.gatewayFee, total: quote.total,
      },
    });
  } catch (err) { next(err); }
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
      claimed = await claimPayment({ _id: payment._id, status: 'captured' }, { status: 'refunding' });
      if (!claimed) return res.status(409).json({ error: 'A cancellation is already in progress or completed.' });
    }

    // Pro-rated refund of the UNUSED portion of the paid period (server-computed).
    const expires = new Date(m.tierExpiresAt).getTime();
    const period = Math.max(1, expires - paidAt.getTime());
    const unused = Math.max(0, expires - Date.now());
    const fraction = prorate ? Math.min(1, Math.max(0, unused / period)) : 1;
    // The LOCAL amount actually charged. A free (100%-off coupon) order stored total=0 and took no
    // money — its refund is 0, never the CHF base price. Fall back to amountCHF only for legacy
    // payments that never recorded a local amount.
    const cm = (claimed && claimed.metadata) || {};
    const paidTotal = (cm.total != null || cm.amountLocal != null)
      ? (Number(cm.total) || Number(cm.amountLocal) || 0)
      : (claimed && Number(claimed.amountCHF)) || 0;
    const currency = (claimed && claimed.currency) || 'CHF';
    const refundAmount = Math.round(paidTotal * fraction * 100) / 100;

    // Refund at the gateway (real partial refund in prod; simulated in dev), then
    // finalize the claimed row. On a gateway error, roll the claim back to 'captured'.
    // Wallet-paid subscriptions have NO gateway charge to reverse — the refund must go
    // back to the wallet, not to a razorpay payment that doesn't exist.
    const fromWallet = !!(claimed && (claimed.method === 'wallet' || (claimed.metadata && claimed.metadata.paidFromWallet)));
    if (claimed) {
      try {
        if (refundAmount > 0) {
          if (fromWallet) {
            // Idempotent on ref: a retry after a partial failure (below) re-credits nothing.
            await wallet.credit(userId, refundAmount, currency, { type: 'refund', purpose: 'cancellation', ref: String(claimed._id), note: 'Membership cancellation refund' });
          } else if (!DEV_PAYMENTS && razorpay && claimed.razorpayPaymentId) {
            await razorpay.payments.refund(claimed.razorpayPaymentId, {
              amount: toMinor(refundAmount, currency), speed: 'normal',
              notes: { idempotency: `refund_${claimed._id}` },
            });
          }
        }
      } catch (refundErr) {
        // The refund was NOT dispatched → safe to reopen 'captured' for a retry.
        await claimPayment({ _id: claimed._id, status: 'refunding' }, { status: 'captured' });
        throw refundErr;
      }
      // Refund dispatched. Finalize refunding→refunded. If THIS flip fails we must NOT reopen
      // 'captured' — a retry would re-dispatch the gateway refund (notes.idempotency is not a
      // real gateway idempotency key). Leave it 'refunding' for an idempotent operator replay.
      await claimPayment({ _id: claimed._id, status: 'refunding' }, { status: 'refunded', refundedAt: new Date() });
      // The membership charge is reversed → give back any coupon it consumed (sweep backstops a lost release).
      await releaseCouponFor(claimed);
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
          ? (fromWallet
              ? `Your membership is cancelled. A pro-rated refund of ${currency} ${refundAmount} (for the unused time) has been added back to your wallet.`
              : `Your membership is cancelled. A pro-rated refund of ${currency} ${refundAmount} (for the unused time) reaches your account in 5–7 working days.`)
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
    // Reject a mismatched currency even at zero balance — a wallet is single-currency,
    // and a mismatched top-up would strand at capture (credit() rejects it) after charging.
    if (w.currency && w.currency !== code) {
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
    const cur = quote.code;
    // Currency-exponent-aware: round base+tax to the currency's minor precision (whole units
    // for zero-decimal like JPY) via money.js, so the amount charged, shown, stored and
    // debited all agree — no fractional over/undercharge on a currency with no sub-unit.
    const walletTotal = fromMinor(toMinor(quote.base + quote.taxTotal, cur), cur);   // base + tax, no gateway fee
    const w = await wallet.getWallet(user._id);
    if (w.currency && w.currency !== cur) return res.status(400).json({ error: `Your wallet holds ${w.currency}, but this is priced in ${cur}.` });
    if (w.balance < walletTotal) return res.status(402).json({ error: 'Insufficient wallet balance', needed: walletTotal, balance: w.balance, currency: cur });

    // Duplicate-submit guard. The atomic debit prevents OVERSPEND, but two affordable debits
    // (double-click / client retry — /pay-wallet has no order to bind to) would buy the same
    // membership twice. CORRECTNESS MUST NOT DEPEND ON THE CLIENT: we always pass a debit `ref`, so
    // the ledger's unique idemKey collapses a concurrent duplicate into a no-op reversal instead of a
    // second charge. An explicit client idempotencyKey is preferred (unambiguous across intentional
    // repeats); otherwise a short per-(user,purpose) time bucket collapses the common double-tap —
    // two near-simultaneous submits share the bucket. The 20s recent-check backstops sequential retries.
    const canonicalPurpose = purpose.replace('_high', '');
    const clientKey = (typeof req.body.idempotencyKey === 'string' && req.body.idempotencyKey.trim())
      ? req.body.idempotencyKey.trim().slice(0, 80) : null;
    const idemKey = clientKey ? `pw_${clientKey}` : `pw_auto_${req.userId}_${canonicalPurpose}_${Math.floor(Date.now() / 10000)}`;
    const recent = await Payment.findOne({ userId: req.userId, purpose: canonicalPurpose, method: 'wallet', status: 'captured' }).sort({ createdAt: -1 });
    if (!clientKey && recent && recent.createdAt && (Date.now() - new Date(recent.createdAt).getTime()) < 20000) {
      return res.status(409).json({ error: 'This looks like a duplicate of a wallet payment you just made.' });
    }

    // Atomic debit; the balance guard prevents overspend/race. A `duplicate` result means this
    // exact spend already went through (retry/concurrent dup) — return the original outcome, no second grant.
    const after = await wallet.debit(user._id, walletTotal, cur, { purpose, note: `Membership (${purpose})`, ref: idemKey });
    if (!after) return res.status(402).json({ error: 'Insufficient wallet balance', currency: cur });
    if (after.duplicate) {
      return res.json({ ok: true, paidFromWallet: true, duplicate: true, amount: walletTotal, currency: cur, balance: after.balance, paymentId: recent && recent._id });
    }
    let payment = null;
    try {
      payment = await Payment.create({
        userId: req.userId, purpose: purpose.replace('_high', ''), amountCHF: quote.chf, currency: cur,
        status: 'captured', method: 'wallet', capturedAt: new Date(), createdAt: new Date(),
        metadata: { base: quote.base, taxTotal: quote.taxTotal, total: walletTotal, country: quote.country, category: quote.category, paidFromWallet: true, idemKey },
      });
      await activateTier(String(req.userId), purpose, payment);
      res.json({ ok: true, paidFromWallet: true, amount: walletTotal, currency: cur, balance: after.balance, paymentId: payment._id });
    } catch (fulfillErr) {
      // Roll the money back AND void the orphaned captured Payment, so cancel/admin-refund
      // can never treat a reversed wallet sale as real.
      await wallet.credit(user._id, walletTotal, cur, { type: 'refund', purpose, note: 'Auto-refund: fulfillment failed' });
      if (payment && payment._id) await Payment.findByIdAndUpdate(payment._id, { $set: { status: 'failed' } });
      throw fulfillErr;
    }
  } catch (e) { next(e); }
});

// Apply a CAPTURED payment's fulfillment (grant tier / mark join fee / credit top-up). The
// gateway has ALREADY taken the money and the capture flip is committed, so this must NEVER
// throw: a 500 here would strand the payment, because a retry of /verify sees status
// 'captured' and returns alreadyProcessed WITHOUT re-fulfilling. On ANY failure it flags the
// payment for reconciliation and notifies the user. Fulfillment is NOT auto-re-driven on
// retry, because activateTier STACKS (re-running would double the granted time) — an operator
// reconciles the flagged payment. The wallet credit is idempotent on the payment ref.
/** @param {any} userId @param {any} payment */
async function fulfillCaptured(userId, payment) {
  try {
    const p = payment.purpose;
    if (p === 'join_fee') await markJoinFeePaid(userId, payment);
    else if (/_(subscription|annual)$/.test(p)) await activateTier(userId, p, payment);
    else if (p === 'wallet_topup') await wallet.credit(userId, payment.metadata.topupAmount, payment.metadata.currency, { type: 'topup', ref: String(payment._id), note: 'Wallet top-up' });
  } catch (e) {
    await flagUnfulfilled(userId, payment, e);
  }
}

/** Flag a captured-but-unfulfilled payment for reconciliation; never throws. @param {any} userId @param {any} payment @param {any} e */
async function flagUnfulfilled(userId, payment, e) {
  const err = /** @type {any} */ (e);
  const mismatch = !!(err && err.code === 'WALLET_CURRENCY');
  const md = payment.metadata || {};
  const amount = md.topupAmount ?? md.total ?? payment.amountCHF;
  const cur = md.currency || payment.currency || '';
  try {
    await require('./models/AuditLog').create({
      actor: 'system', action: 'payment_unfulfilled', targetType: 'payment', targetId: String(payment._id),
      detail: { userId: String(userId), purpose: payment.purpose, amount, currency: cur, reason: (err && err.message) || String(err), mismatch },
    });
    await require('./models/Notification').create({
      userId, type: 'payment_unfulfilled', severity: 'warning', title: 'We’re finalizing your payment',
      body: mismatch
        ? `We received your ${cur} ${amount} top-up but couldn't add it to your wallet (currency mismatch). Our team will resolve it — you won't lose the amount.`
        : `We received your payment but couldn't finish applying it just now. Our team will complete it shortly — you won't lose anything.`,
    });
  } catch { /* flagging is best-effort */ }
}

// Record a coupon redemption for a CAPTURED order (idempotent on the order ref). Never
// throws: the payment already succeeded at the discounted price, so a cap race or a
// bookkeeping error must not fail /verify — it is logged for reconciliation instead.
/** @param {any} userId @param {any} payment */
async function redeemOrderCoupon(userId, payment) {
  const code = payment.metadata && payment.metadata.couponCode;
  if (!code) return;
  try {
    const coupon = await coupons.findByCode(code);
    if (!coupon) return;
    // Confirm on the SAME ref reserved at create-order → idempotent (returns the existing
    // redemption, never a second consume). Falls back for older orders without a stored ref.
    const orderRef = (payment.metadata && payment.metadata.couponOrderRef) || payment.razorpayOrderId || String(payment._id);
    await coupons.redeem({
      coupon, userId, orderRef, paymentId: payment._id,
      purpose: payment.purpose, discountCHF: payment.metadata.discountCHF, discountLocal: payment.metadata.discountLocal, currency: payment.currency,
    });
    // The charge is now final — take this reservation out of the abandonment sweep's scope.
    await coupons.commitReservation({ coupon, orderRef });
  } catch (e) {
    try {
      await require('./models/AuditLog').create({
        actor: 'system', action: 'coupon_redeem_deferred', targetType: 'payment', targetId: String(payment._id),
        detail: { code, userId: String(userId), reason: (e && /** @type {any} */ (e).message) || String(e) },
      });
    } catch { /* best-effort */ }
  }
}

// Give back any coupon a REVERSED payment consumed (markSweepable so the sweep backstops a lost
// release, then release). Shared by cancel-subscription, admin refund, and the free-grant rollback.
// Best-effort and idempotent; never throws — releaseStaleReservations is the ultimate backstop.
/** @param {any} carrier a doc with metadata.{couponCode,couponOrderRef} */
async function releaseCouponFor(carrier) {
  const md = carrier && carrier.metadata;
  if (!(md && md.couponCode && md.couponOrderRef)) return;
  try {
    await coupons.markSweepable(md.couponOrderRef);
    const c = await coupons.findByCode(md.couponCode);
    if (c) await coupons.release({ coupon: c, orderRef: md.couponOrderRef });
  } catch { /* releaseStaleReservations backstops */ }
}

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
      // Genuinely-atomic claim (created → captured) so a duplicate/concurrent submit can't
      // double-grant or double-credit — only the winner flips; the rest get null.
      const payment = await claimPayment(
        { razorpayOrderId: razorpay_order_id, userId: req.userId, status: 'created' },
        { status: 'captured', capturedAt: new Date(), razorpayPaymentId: 'pay_dev_' + crypto.randomBytes(8).toString('hex'), method: 'dev_simulated' },
      );
      if (!payment) {
        const done = await Payment.findOne({ razorpayOrderId: razorpay_order_id, userId: req.userId });
        if (done) return res.json({ ok: true, alreadyProcessed: true, paymentId: done._id });
        return res.status(404).json({ error: 'Order not found' });
      }

      await fulfillCaptured(userId, payment);   // never throws — flags on failure, no strand
      await redeemOrderCoupon(userId, payment); // record a coupon redemption (idempotent)
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

    if (!signaturesEqual(expected, razorpay_signature)) {
      console.warn('[SECURITY] Invalid Razorpay signature attempt', { userId: req.userId });
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // ATOMIC idempotency + authority in ONE conditional update: transition the priced
    // order created → captured. The order we priced at create-order time is the ONLY
    // authority on what was bought (req.body.purpose is attacker-controlled — the
    // Razorpay signature covers order_id|payment_id only, so trusting it would let
    // someone pay for base_subscription (CHF 5) and claim max_subscription (CHF 25)).
    // The claim is a GENUINELY-atomic conditional UPDATE (claimPayment → pg-odm
    // atomicUpdate), so two concurrent verifies can never both capture-and-grant — only
    // the winner flips; the rest fall through to already-processed. (Plain findOneAndUpdate
    // is read-then-write on pg-odm and would let both win — see claimPayment.)
    const payment = await claimPayment(
      { razorpayOrderId: razorpay_order_id, userId: req.userId, status: 'created' },
      { status: 'captured', capturedAt: new Date(), razorpayPaymentId: razorpay_payment_id, razorpaySignature: razorpay_signature },
    );
    if (!payment) {
      const done = await Payment.findOne({ razorpayOrderId: razorpay_order_id, userId: req.userId });
      if (done) return res.json({ ok: true, alreadyProcessed: true, paymentId: done._id, purpose: done.purpose });
      return res.status(404).json({ error: 'Order not found' });
    }
    const purpose = payment.purpose;                     // authoritative, from the DB

    await fulfillCaptured(userId, payment);     // never throws — flags on failure, no strand
    await redeemOrderCoupon(userId, payment);   // record a coupon redemption (idempotent)

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

// GET /payment/receipt/:paymentId — the tax invoice / receipt for one of the caller's OWN
// captured payments. The invoice number is assigned (once, idempotently) on first view, and
// the amounts come straight from the breakdown stored at checkout.
router.get('/receipt/:paymentId', requireAuth, async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.paymentId);
    if (!payment || String(payment.userId) !== String(req.userId)) return res.status(404).json({ error: 'Receipt not found' });
    if (payment.status !== 'captured' && payment.status !== 'refunded') {
      return res.status(400).json({ error: 'A receipt is only available for a completed payment.' });
    }
    await invoicing.assignInvoice(payment);
    const [user, business] = await Promise.all([User.findById(req.userId).lean(), invoicing.getBusiness()]);
    res.json({ receipt: invoicing.buildReceipt(payment, user, business) });
  } catch (err) { next(err); }
});

// 4. Admin refund — a moderator-only tool for exceptional cases (a failed/rejected
// verification, a duplicate charge, or a payment-provider chargeback). This is NOT a
// user-facing money-back guarantee: membership is monthly and non-refundable, and no
// refund is promised anywhere in the product. Razorpay refund API in prod, simulated in dev.
router.post('/admin/:paymentId/refund', requireAdmin, async (req, res, next) => {
  try {
    // Genuinely-atomic claim (captured → refunding) so two admins — or a retry — can't
    // double-refund the same payment (claimPayment → pg-odm atomicUpdate).
    const payment = await claimPayment({ _id: req.params.paymentId, status: 'captured' }, { status: 'refunding' });
    if (!payment) {
      const existing = await Payment.findById(req.params.paymentId);
      if (!existing) return res.status(404).json({ error: 'Payment not found' });
      return res.status(400).json({ error: 'Only captured payments can be refunded' });
    }

    // Report the amount actually charged, in the currency actually charged (not CHF). A free order
    // (100%-off coupon) has metadata.total = 0 and no gateway/wallet charge — its refund is 0, NOT the
    // CHF base price. Only fall back to amountCHF for legacy payments that never stored a local amount;
    // never mislabel a CHF figure as the local currency, and never promise a refund that never moves.
    const currency = payment.currency || 'CHF';
    const hasLocal = !!(payment.metadata && (payment.metadata.total != null || payment.metadata.amountLocal != null));
    const refundedLocal = hasLocal
      ? (Number(payment.metadata.total) || Number(payment.metadata.amountLocal) || 0)
      : (Number(payment.amountCHF) || 0);
    // Where the money goes back depends on how it was paid — the gateway path alone would
    // silently lose (or duplicate) money for the wallet payment types the wallet introduced.
    const fromWallet = payment.method === 'wallet' || !!(payment.metadata && payment.metadata.paidFromWallet);
    const isTopup = payment.purpose === 'wallet_topup';
    let destination = 'bank';

    try {
      if (isTopup) {
        // A top-up CREDITED the wallet at capture. Refunding the gateway charge must first
        // claw those funds back out of the wallet (idempotent on ref) — else the user keeps
        // the balance AND gets the money back. But claw back ONLY if the credit actually
        // applied: creditTopupSafely may have flagged it uncredited, in which case there is
        // nothing to reverse and debiting would remove unrelated funds. If already spent, refuse.
        const topupAmount = (payment.metadata && Number(payment.metadata.topupAmount)) || 0;
        const credited = topupAmount > 0 && await wallet.wasApplied(payment.userId, String(payment._id), 'topup');
        if (credited) {
          const clawed = await wallet.debit(payment.userId, topupAmount, currency, { type: 'adjustment', ref: String(payment._id), note: 'Top-up refund clawback' });
          if (!clawed) {
            await claimPayment({ _id: payment._id, status: 'refunding' }, { status: 'captured' });
            return res.status(409).json({ error: 'These topped-up funds have already been spent; refund the resulting purchase instead.' });
          }
        }
        if (!DEV_PAYMENTS && razorpay && payment.razorpayPaymentId) {
          await razorpay.payments.refund(payment.razorpayPaymentId, { speed: 'normal', notes: { idempotency: `refund_${payment._id}` } });
        }
      } else if (fromWallet) {
        // A wallet-PAID purchase has NO gateway charge to reverse — return the money to the
        // wallet (idempotent on ref), mirroring cancel-subscription. The gateway-only path
        // would mark it refunded and strip membership while returning nothing.
        await wallet.credit(payment.userId, refundedLocal, currency, { type: 'refund', purpose: payment.purpose, ref: String(payment._id), note: 'Admin refund' });
        destination = 'wallet';
      } else if (!DEV_PAYMENTS && razorpay && payment.razorpayPaymentId) {
        await razorpay.payments.refund(payment.razorpayPaymentId, { speed: 'normal', notes: { idempotency: `refund_${payment._id}` } });
      }
    } catch (refundErr) {
      // Refund NOT dispatched → safe to reopen 'captured' for a retry.
      await claimPayment({ _id: payment._id, status: 'refunding' }, { status: 'captured' });
      throw refundErr;
    }
    // Refund dispatched. Finalize; a failed flip leaves 'refunding' for an idempotent operator
    // replay rather than reopening 'captured' (which would re-dispatch the gateway refund).
    await claimPayment({ _id: payment._id, status: 'refunding' }, { status: 'refunded', refundedAt: new Date() });

    // Reversing the charge → give back any coupon this payment consumed (same as cancel-subscription
    // and marketplace transition; sweep backstops a lost release).
    await releaseCouponFor(payment);

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
    if (refundedLocal > 0) {
      const arrival = destination === 'wallet'
        ? 'has been added back to your wallet.'
        : 'has been refunded. It reaches your account in 5–7 working days.';
      await Notification.create({
        userId: payment.userId, type: 'refund_processed', severity: 'info',
        title: 'Refund processed',
        body: `Your ${currency} ${refundedLocal} ${payment.purpose.replace(/_/g, ' ')} payment ${arrival}`
      });
    } else {
      // No money was ever charged (e.g. a 100%-off coupon order) — promise no refund that will never arrive.
      await Notification.create({
        userId: payment.userId, type: 'refund_processed', severity: 'info',
        title: 'Membership reversed',
        body: `Your ${payment.purpose.replace(/_/g, ' ')} was reversed. No payment was taken, so there is nothing to refund.`
      });
    }

    const AuditLog = require('./models/AuditLog');
    await AuditLog.create({
      actor: req.userId, action: 'payment_refunded', targetType: 'payment',
      targetId: payment._id.toString(),
      detail: { userId: payment.userId.toString(), amountCHF: payment.amountCHF, refundedLocal, currency, purpose: payment.purpose, destination }
    });

    res.json({ ok: true, refundedAmount: refundedLocal, currency, destination });
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

    if (!signaturesEqual(String(signature || ''), expected)) {
      console.warn('[SECURITY] Invalid webhook signature');
      return res.status(400).send('Invalid signature');
    }

    const event = JSON.parse(req.body.toString());
    console.log('[WEBHOOK]', event.event);

    // BACKSTOP FULFILLMENT. The client's POST /verify is the primary path, but if it never fires
    // (app closed / UPI network drop right after Razorpay auto-captures), the money is taken and the
    // Payment would sit 'created' forever with no membership and no refund — no cron reconciles
    // membership/top-up Payments. So the webhook fulfills too, IDEMPOTENTLY: it atomically claims the
    // priced order created→captured (only if still 'created', so it can never double-fulfill a
    // /verify that already ran), then runs the SAME fulfill + coupon-redeem path.
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const entity = (event.payload && event.payload.payment && event.payload.payment.entity) || {};
      const orderId = entity.order_id;
      if (orderId) {
        const payment = await claimPayment(
          { razorpayOrderId: orderId, status: 'created' },
          { status: 'captured', capturedAt: new Date(), razorpayPaymentId: entity.id, razorpaySignature: signature, method: 'razorpay_webhook' },
        );
        if (payment) {
          await fulfillCaptured(payment.userId, payment);   // never throws — flags on failure, no strand
          await redeemOrderCoupon(payment.userId, payment); // idempotent
          console.log('[WEBHOOK] reconciled stranded payment', String(payment._id), payment.purpose);
        }
      }
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/**
 * Create a Payment + order for a product priced in CHF (gift passes, verification
 * services, marketplace/consultation — NOT the gender-priced membership tiers), CHARGED
 * exactly like every other Sambandh order: live fx to the buyer's currency + category
 * tax + gateway fee (SHIG R-14). The result is a SUPERSET of the /create-order response
 * (key/amount/currency/orderId/prefill/breakdown), so the client opens Razorpay
 * identically — no more "complete payment" dead-end. `payment.amountCHF` stays the
 * canonical CHF base so a later confirm step can pin purpose + amount + ownership.
 * `metadata` (e.g. { giftPassId }/{ caseId }) binds the payment to what it pays for.
 * Dev mode simulates the order id ('order_dev_…', captured by the normal /verify path).
 * @param {{ userId:any, purpose:string, amountCHF:number, category?:string, label?:string, metadata?:Record<string,any>, couponCode?:string, maxDiscountCHF?:number }} args
 */
async function createQuotedOrder({ userId, purpose, amountCHF, category, label, metadata = {}, couponCode, maxDiscountCHF }) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  // Optional coupon: validated here (throws a coupon error on invalid/exhausted), applied as a
  // CHF discount, and stashed in metadata so the existing capture-time redeemOrderCoupon consumes
  // it idempotently (order-bound via couponOrderRef) — the same rail membership checkout uses.
  let discountCHF = 0, coupon = null;
  if (couponCode) {
    const v = await coupons.validate(couponCode, purpose, Number(amountCHF), userId);
    coupon = v.coupon; discountCHF = v.discountCHF;
    // On a PARTNER order the discount is platform-funded: cap it at Sambandh's commission so the
    // partner payout is always fully covered by the (reduced) charge and the platform can never
    // pay a partner from money it didn't collect. This also means a partner order can never be free.
    if (maxDiscountCHF != null && Number.isFinite(Number(maxDiscountCHF))) discountCHF = Math.min(discountCHF, Math.max(0, Number(maxDiscountCHF)));
  }
  const quote = await quoteForAmount(Number(amountCHF), category || categoryForPurpose(purpose), user, label, discountCHF);
  if (!quote) throw new Error('Invalid order amount');
  // Persisted with the order so /verify, receipts and pro-rated refunds read the real
  // charged amounts back from the DB, never from the request body.
  const breakdown = {
    base: quote.base, taxName: quote.taxName, taxRate: quote.taxRate,
    taxTotal: quote.taxTotal, taxLines: quote.taxLines,
    gatewayFeePct: quote.gatewayFeePct, gatewayFee: quote.gatewayFee,
    total: quote.total, country: quote.country, category: quote.category,
    grossBase: quote.grossBase, discountCHF: quote.discountCHF, discountLocal: quote.discountLocal,
  };
  const couponMeta = coupon ? { couponCode: coupon.code, discountCHF: quote.discountCHF, discountLocal: quote.discountLocal, couponOrderRef: 'oc_' + crypto.randomBytes(8).toString('hex') } : {};
  const clientQuote = {
    amount: quote.minor, amountMajor: quote.total, amountCHF: quote.chf,
    currency: quote.code, symbol: quote.symbol, breakdown, couponCode: coupon ? coupon.code : null,
  };
  // RESERVE the coupon against a CHARGED payment at CREATE — so the TOTAL/per-user cap is
  // authoritative BEFORE the buyer is charged. Without this the discount is committed at create
  // but the cap only decrements at capture, so N buyers racing the last unit each pay discounted
  // while `remaining` drops once (a bounded over-issue). Reserving here makes the loser's redeem()
  // lose the atomic decrement → EXHAUSTED → the just-created payment is rolled back and the caller
  // cancels the order. Reserved on the payment's _id so the nightly sweep can tell a real capture
  // from an abandoned checkout; released on cancel/refund (transition) or abandonment (sweep).
  /** @param {any} payment */
  const reserveCouponFor = async (payment) => {
    if (!coupon) return;
    try {
      // committed:false — this is a not-yet-final paid reservation, the only kind the nightly
      // abandonment sweep looks at; redeemOrderCoupon flips it committed at capture.
      await coupons.redeem({ coupon, userId, orderRef: /** @type {string} */ (couponMeta.couponOrderRef), paymentId: payment._id, purpose, discountCHF: quote.discountCHF, discountLocal: quote.discountLocal, currency: quote.code, committed: false });
    } catch (e) {
      await bestEffort(Payment.deleteOne({ _id: payment._id }), { op: 'payment:undo-unreserved', userId: String(userId) });   // undo the un-reserved payment; caller cancels the order
      throw e;
    }
  };
  // FREE order (e.g. a 100%-off tester coupon): there is nothing to charge, so no gateway order.
  // Create a CAPTURED payment, redeem the coupon now (idempotent), and flag it so the caller
  // confirms the order directly without opening a checkout.
  if (quote.total <= 0) {
    const orderId = 'free_' + crypto.randomBytes(8).toString('hex');
    // Gate the free grant on an ATOMIC coupon consume FIRST — so N concurrent 100%-off requests
    // lose the CAS and get a coupon error (→ 400) instead of each minting a free order; a capped or
    // per-user-limited coupon can therefore never yield more free orders than its cap allows.
    // No paymentId: a free order captures instantly (never abandoned), so the sweep must skip it.
    if (coupon) await coupons.redeem({ coupon, userId, orderRef: /** @type {string} */ (couponMeta.couponOrderRef), purpose, discountCHF: quote.discountCHF, discountLocal: quote.discountLocal, currency: quote.code });
    let payment;
    try {
      payment = await Payment.create({
        userId, purpose, amountCHF: quote.chf, currency: quote.code, razorpayOrderId: orderId,
        status: 'captured', capturedAt: new Date(), createdAt: new Date(),
        metadata: { ...metadata, free: true, amountLocal: quote.total, ...breakdown, ...couponMeta },
      });
    } catch (e) {
      // The grant was consumed above but the (committed, paymentId-less) payment never landed, so
      // the sweep can't reclaim it — release the reservation now rather than leak the cap slot.
      if (coupon) await bestEffort(coupons.release({ coupon, orderRef: /** @type {string} */ (couponMeta.couponOrderRef) }), { op: 'coupon:release-orphan', userId: String(userId) });
      throw e;
    }
    return { free: true, devMode: true, orderId, payment, ...clientQuote };
  }
  if (DEV_PAYMENTS) {
    const orderId = 'order_dev_' + crypto.randomBytes(8).toString('hex');
    const payment = await Payment.create({
      userId, purpose, amountCHF: quote.chf, currency: quote.code, razorpayOrderId: orderId,
      status: 'created', createdAt: new Date(), metadata: { ...metadata, dev: true, amountLocal: quote.total, ...breakdown, ...couponMeta }
    });
    await reserveCouponFor(payment);
    return { devMode: true, orderId, payment, ...clientQuote };
  }
  if (!razorpay) throw new Error('Payments are not configured');
  const order = await razorpay.orders.create({
    amount: quote.minor, currency: quote.code,
    receipt: `sb_${Date.now().toString(36)}_${String(userId).slice(-6)}`,
    notes: { userId: String(userId), purpose }
  });
  const payment = await Payment.create({
    userId, purpose, amountCHF: quote.chf, currency: quote.code, razorpayOrderId: order.id,
    status: 'created', createdAt: new Date(), metadata: { ...metadata, amountLocal: quote.total, ...breakdown, ...couponMeta }
  });
  await reserveCouponFor(payment);
  return {
    devMode: false, orderId: order.id, key: process.env.RAZORPAY_KEY_ID, payment,
    prefill: { name: user.profile && user.profile.firstName, contact: user.phone }, ...clientQuote
  };
}

module.exports = router;
module.exports.activateTier = activateTier;   // exported for tests (early-access flag integration)
module.exports.createQuotedOrder = createQuotedOrder;
// Back-compat alias: existing callers used createDirectOrder; the quoted order is a
// strict superset (adds fx/tax/fee + the client quote fields), so the name maps through.
module.exports.createDirectOrder = createQuotedOrder;
