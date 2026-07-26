// @ts-check
// services/gift-pass.js — the Sambandh Gift Pass system.
//
// Buy a pass → get an unguessable code you can share over ANY channel → the recipient
// redeems it inside Sambandh (one-time) → the entitlement is granted to them. Money
// rides the existing Payment rail; membership grants reuse the membership engine. The
// catalogue is extensible via `grant.kind`, so date/event/concierge passes can be
// added later without touching the redemption model. Everything money/fraud-sensitive
// is atomic: single-use redemption + idempotent refunds via compare-and-set.

const crypto = require('crypto');
const market = require('./marketplace');            // atomicUpdate primitive (CAS)
const GiftPass = require('../models/GiftPass');
const Payment = require('../models/Payment');
const User = require('../models/User');

/** The pass catalogue. Every pass here grants REAL value today (membership), so
 * nothing is a stub. grant.kind dispatches the entitlement.
 * @type {Record<string, { label:string, sub:string, priceCHF:number, grant:{kind:string, tier?:string, months?:number} }>} */
const CATALOG = {
  chat_pass: { label: 'Chat Pass', sub: '30 days of unlimited premium chat', priceCHF: 5, grant: { kind: 'membership', tier: 'pro', months: 1 } },
  premium_1m: { label: 'Premium — 1 month', sub: 'Full Max membership for a month', priceCHF: 15, grant: { kind: 'membership', tier: 'max', months: 1 } },
  premium_3m: { label: 'Premium — 3 months', sub: 'Full Max membership for a season', priceCHF: 40, grant: { kind: 'membership', tier: 'max', months: 3 } },
  premium_6m: { label: 'Premium — 6 months', sub: 'Half a year of Max membership', priceCHF: 75, grant: { kind: 'membership', tier: 'max', months: 6 } },
  premium_1y: { label: 'Premium — 1 year', sub: 'A whole year of Max membership', priceCHF: 140, grant: { kind: 'membership', tier: 'max', months: 12 } }
};

const isPassType = (/** @type {string} */ t) => Object.prototype.hasOwnProperty.call(CATALOG, t);
const priceOf = (/** @type {string} */ t) => (CATALOG[t] ? CATALOG[t].priceCHF : null);
const paymentRail = () => /** @type {any} */ (require('../routes-payment'));

/** Unambiguous, unguessable code: SB-XXXX-XXXX-XXXX over a 31-symbol alphabet
 * (no 0/O/1/I). ~31^12 ≈ 8e17 space, so brute force is infeasible. */
function genCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = crypto.randomBytes(12);
  let s = '';
  for (let i = 0; i < 12; i++) s += A[b[i] % A.length];
  return `SB-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

/**
 * Purchase a pass: create it (status 'created') with a fresh code + a case-bound
 * Payment. Nothing is redeemable until the payment is confirmed.
 * @param {{ purchaserId:any, passType:string, message?:string, deliverAt?:string, expiresAt?:string }} args
 */
async function purchasePass({ purchaserId, passType, message, deliverAt, expiresAt }) {
  if (!isPassType(passType)) throw new Error('Unknown gift pass type');
  const amountCHF = /** @type {number} */ (priceOf(passType));
  const grant = CATALOG[passType].grant;
  let code = genCode();
  for (let i = 0; i < 5 && await GiftPass.findOne({ code }); i++) code = genCode();   // collision-proof

  const pass = await GiftPass.create({
    purchaserId, passType, amountCHF, code, status: 'created',
    message: String(message || '').slice(0, 500),
    deliverAt: deliverAt ? new Date(deliverAt) : null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    grant, createdAt: new Date(), updatedAt: new Date()
  });
  const order = await paymentRail().createDirectOrder({
    userId: purchaserId, purpose: 'gift_pass', amountCHF,
    metadata: { giftPassId: String(pass._id), passType }
  });
  await GiftPass.findByIdAndUpdate(pass._id, { paymentId: order.payment._id });
  pass.paymentId = order.payment._id;
  return { pass, order };
}

/** Activate a pass once its payment is captured. Pins purpose + amount + ownership +
 * binding; refunds any other captured gift_pass payment for the same pass. Idempotent.
 * @param {any} passId @param {any} purchaserId */
async function confirmPurchase(passId, purchaserId) {
  const pass = await GiftPass.findById(passId);
  if (!pass) throw new Error('Gift pass not found');
  if (String(pass.purchaserId) !== String(purchaserId)) throw new Error('Not your gift pass');
  if (pass.status === 'active' || pass.status === 'redeemed') return pass;   // idempotent
  if (pass.status !== 'created') throw new Error('This pass can no longer be activated');

  const pay = pass.paymentId ? await Payment.findById(pass.paymentId) : null;
  if (!pay) throw new Error('Payment not found');
  if (String((pay.metadata || {}).giftPassId) !== String(pass._id)) throw new Error('Payment is not bound to this pass');
  if (pay.purpose !== 'gift_pass') throw new Error('Wrong payment purpose');
  if (Number(pay.amountCHF) !== Number(priceOf(pass.passType))) throw new Error('Payment amount mismatch');
  if (pay.status !== 'captured') throw new Error('Payment is not captured yet');

  const dupes = await Payment.find({ 'metadata.giftPassId': String(pass._id), status: 'captured' });
  for (const o of dupes) {
    if (String(o._id) === String(pay._id)) continue;
    await market.atomicUpdate(Payment, { _id: o._id, status: 'captured' }, { $set: { status: 'refunded', refundedAt: new Date() } });
  }
  await market.atomicUpdate(GiftPass, { _id: pass._id, status: 'created' }, { $set: { status: 'active', updatedAt: new Date() } });
  return await GiftPass.findById(pass._id);
}

/** Redeem a code. ONE-TIME: an atomic active→redeemed CAS means exactly one redeemer
 * wins, even under concurrent attempts. Applies the entitlement to the redeemer.
 * @param {{ code:string, redeemerId:any }} args */
async function redeem({ code, redeemerId }) {
  const pass = await GiftPass.findOne({ code: String(code || '').trim().toUpperCase() });
  if (!pass) throw new Error('Invalid gift code');
  if (pass.status === 'redeemed') throw new Error('This gift has already been redeemed');
  if (pass.status === 'revoked') throw new Error('This gift was cancelled');
  if (pass.status === 'created') throw new Error('This gift is not active yet');
  if (pass.status === 'expired' || (pass.expiresAt && new Date(pass.expiresAt) < new Date())) {
    await market.atomicUpdate(GiftPass, { _id: pass._id, status: 'active' }, { $set: { status: 'expired', updatedAt: new Date() } });
    throw new Error('This gift has expired');
  }
  const won = await market.atomicUpdate(
    GiftPass, { _id: pass._id, status: 'active' },
    { $set: { status: 'redeemed', recipientId: redeemerId, redeemedAt: new Date(), updatedAt: new Date() } }
  );
  if (!won) throw new Error('This gift has already been redeemed');
  await applyGrant(pass, redeemerId);
  return await GiftPass.findById(pass._id);
}

/** Apply a pass's entitlement to a user. Extensible by grant.kind. @param {any} pass @param {any} userId */
async function applyGrant(pass, userId) {
  const g = pass.grant || (CATALOG[pass.passType] && CATALOG[pass.passType].grant);
  if (g && g.kind === 'membership') await grantMembership(userId, g.tier, g.months || 1);
}

/** Extend a user's membership by N months, keeping the better tier and NEVER shortening
 * an entitlement they already hold. @param {any} userId @param {string} tier @param {number} months */
async function grantMembership(userId, tier, months) {
  const { tierRank } = require('./membership');
  const user = await User.findById(userId);
  if (!user) return;
  const m = user.membership || {};
  const active = !!(m.tierExpiresAt && new Date(m.tierExpiresAt) > new Date());
  const curRank = active ? tierRank(m.tier) : 0;
  const curEnd = active ? new Date(m.tierExpiresAt).getTime() : 0;
  const grantRank = tierRank(tier);
  const effectiveTier = curRank > grantRank ? m.tier : tier;
  const from = (active && curRank >= grantRank) ? curEnd : Date.now();
  const newEnd = Math.max(from + months * 30 * 86400000, curEnd);
  await User.findByIdAndUpdate(userId, {
    'membership.tier': effectiveTier,
    'membership.tierExpiresAt': new Date(newEnd),
    'membership.joinFeePaid': true,
    'membership.paidAt': new Date()
  });
}

/** Cancel a not-yet-redeemed pass and refund the buyer (idempotent CAS). @param {{ passId:any, purchaserId:any }} args */
async function revoke({ passId, purchaserId }) {
  const pass = await GiftPass.findById(passId);
  if (!pass || String(pass.purchaserId) !== String(purchaserId)) throw new Error('Gift pass not found');
  if (pass.status === 'redeemed') throw new Error('A redeemed gift cannot be cancelled');
  if (pass.status === 'revoked') return pass;
  let moved = await market.atomicUpdate(GiftPass, { _id: pass._id, status: 'active' }, { $set: { status: 'revoked', updatedAt: new Date() } });
  if (!moved) moved = await market.atomicUpdate(GiftPass, { _id: pass._id, status: 'created' }, { $set: { status: 'revoked', updatedAt: new Date() } });
  if (!moved) throw new Error('This gift can no longer be cancelled');
  if (pass.paymentId) await market.atomicUpdate(Payment, { _id: pass.paymentId, status: 'captured' }, { $set: { status: 'refunded', refundedAt: new Date() } });
  return await GiftPass.findById(pass._id);
}

/** The user's Gift Wallet — passes they bought, and passes they redeemed. @param {any} userId */
async function wallet(userId) {
  const [purchased, received] = await Promise.all([
    GiftPass.find({ purchaserId: userId }).sort({ createdAt: -1 }).limit(200).lean(),
    GiftPass.find({ recipientId: userId, status: 'redeemed' }).sort({ redeemedAt: -1 }).limit(200).lean()
  ]);
  return { purchased, received };
}

function catalog() {
  return Object.entries(CATALOG).map(([id, c]) => ({ id, label: c.label, sub: c.sub, priceCHF: c.priceCHF }));
}

module.exports = {
  CATALOG, isPassType, priceOf, catalog,
  purchasePass, confirmPurchase, redeem, revoke, wallet, applyGrant, grantMembership, genCode
};
