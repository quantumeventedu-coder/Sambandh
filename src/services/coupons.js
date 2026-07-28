// @ts-check
// services/coupons.js — super-admin discount coupons, redeemed at checkout.
//
// The discount is on the BASE price BEFORE tax (GST/VAT then applies to the discounted
// amount), computed in canonical CHF and converted to the buyer's currency by the quote.
// Redemption is money-adjacent, so it is atomic (the wallet review's lessons): the TOTAL
// cap is a `remaining` counter moved by a single conditional atomicUpdate, and per-user /
// per-order limits ride DB-level unique keys on CouponRedemption — never a read-then-write.

const Coupon = require('../models/Coupon');
const CouponRedemption = require('../models/CouponRedemption');

/** Genuinely-atomic conditional update (pg-odm), Mongoose fallback where absent.
 * @param {any} Model @param {any} filter @param {any} update */
function atomicUpdate(Model, filter, update) {
  return typeof Model.atomicUpdate === 'function'
    ? Model.atomicUpdate(filter, update)
    : Model.findOneAndUpdate(filter, update, { new: true });
}

/** A unique-violation from the DB (the idempotency/limit backstop firing). @param {any} e */
function isDupKey(e) { return !!(e && (e.code === '23505' || e.code === 11000 || /duplicate key|E11000/i.test(String((e && e.message) || '')))); }

/** A coupon error the route can map to a status. @param {string} msg @param {string} code */
function couponError(msg, code) { const e = new Error(msg); /** @type {any} */ (e).code = code; /** @type {any} */ (e).coupon = true; return e; }

/** @param {any} v */
const normalizeCode = (v) => String(v || '').trim().toUpperCase().replace(/\s+/g, '');
/** @param {number} n @param {number} lo @param {number} hi */
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** @param {string} purpose — coarse category for appliesTo matching (mirrors routes-payment). */
function categoryOf(purpose) {
  if (/_(subscription|annual)$/.test(purpose) || purpose === 'base_subscription') return 'subscription';
  if (purpose === 'consultation' || purpose === 'consultation_session') return 'consultation';
  if (purpose === 'verification_service') return 'verification';
  if (purpose === 'gift_pass') return 'gift';
  return 'default';
}
/** @param {any} coupon @param {string} purpose */
function applies(coupon, purpose) {
  const a = (coupon.appliesTo && coupon.appliesTo.length) ? coupon.appliesTo : ['*'];
  return a.includes('*') || a.includes(purpose) || a.includes(categoryOf(purpose));
}

/** The CHF discount this coupon yields on a CHF base price (never more than the base).
 * @param {any} coupon @param {number} chf */
function discountFor(coupon, chf) {
  const base = Number(chf) || 0;
  let d = coupon.kind === 'percent' ? base * (Number(coupon.percentOff) || 0) / 100 : (Number(coupon.flatOffCHF) || 0);
  d = Math.min(Math.max(0, d), base);
  return Math.round(d * 100) / 100;
}

/** @param {string} code */
async function findByCode(code) { return Coupon.findOne({ code: normalizeCode(code) }); }

/** @param {any} couponId @param {any} userId */
async function userRedemptionCount(couponId, userId) {
  return (await CouponRedemption.find({ couponId, userId })).length;
}

/**
 * Validate a code for a purchase and return the CHF discount. Throws a coupon error (with
 * a `.code`) the caller maps to a message; never mutates anything.
 * @param {string} code @param {string} purpose @param {number} chfBase @param {any} userId
 * @returns {Promise<{ coupon:any, discountCHF:number }>}
 */
async function validate(code, purpose, chfBase, userId) {
  const coupon = await findByCode(code);
  if (!coupon || coupon.active === false) throw couponError('That coupon code isn’t valid.', 'INVALID');
  const now = Date.now();
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) throw couponError('This coupon isn’t active yet.', 'NOT_STARTED');
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now) throw couponError('This coupon has expired.', 'EXPIRED');
  if (!applies(coupon, purpose)) throw couponError('This coupon doesn’t apply to this purchase.', 'NOT_APPLICABLE');
  if ((Number(chfBase) || 0) < (Number(coupon.minAmountCHF) || 0)) throw couponError(`This coupon needs a minimum order of CHF ${coupon.minAmountCHF}.`, 'MIN');
  if (coupon.remaining != null && coupon.remaining <= 0) throw couponError('This coupon has been fully redeemed.', 'EXHAUSTED');
  if (coupon.perUserLimit != null && await userRedemptionCount(coupon._id, userId) >= coupon.perUserLimit) {
    throw couponError('You’ve already used this coupon.', 'PER_USER');
  }
  return { coupon, discountCHF: discountFor(coupon, chfBase) };
}

/**
 * Atomically CONSUME a coupon for an order. Idempotent per (coupon, orderRef): a retried
 * /verify or free activation redeems once. Enforces the total cap (atomic `remaining`
 * decrement) and, for perUserLimit===1, the per-user cap (a unique key). Returns the
 * redemption row, or throws a coupon error when a cap is hit.
 * @param {{ coupon:any, userId:any, orderRef:string, paymentId?:any, purpose?:string, discountCHF?:number, discountLocal?:number, currency?:string }} a
 */
async function redeem({ coupon, userId, orderRef, paymentId, purpose, discountCHF, discountLocal, currency }) {
  const couponId = coupon._id;
  const redemptionKey = `${couponId}:${orderRef}`;
  const userLimitKey = Number(coupon.perUserLimit) === 1 ? `${couponId}:${userId}` : undefined;

  const prior = await CouponRedemption.findOne({ redemptionKey });
  if (prior) return prior;   // this order already redeemed — idempotent

  // Soft per-user check for perUserLimit > 1 (the ===1 case is enforced by userLimitKey below).
  if (!userLimitKey && coupon.perUserLimit != null && await userRedemptionCount(couponId, userId) >= coupon.perUserLimit) {
    throw couponError('You’ve already used this coupon.', 'PER_USER');
  }

  // TOTAL cap — a single conditional decrement (guard remaining > 0). Skip when unlimited.
  if (coupon.remaining != null) {
    const dec = await atomicUpdate(Coupon, { _id: couponId, remaining: { $gt: 0 } },
      { $inc: { remaining: -1, redeemedCount: 1 }, $set: { updatedAt: new Date() } });
    if (!dec) throw couponError('This coupon has been fully redeemed.', 'EXHAUSTED');
  } else {
    await atomicUpdate(Coupon, { _id: couponId }, { $inc: { redeemedCount: 1 }, $set: { updatedAt: new Date() } });
  }

  try {
    return await CouponRedemption.create({
      couponId, code: coupon.code, userId, orderRef, paymentId, purpose,
      discountCHF, discountLocal, currency, redemptionKey, userLimitKey, at: new Date(),
    });
  } catch (e) {
    // The unique key fired: roll the cap decrement back, then resolve idempotently.
    if (coupon.remaining != null) await atomicUpdate(Coupon, { _id: couponId }, { $inc: { remaining: 1, redeemedCount: -1 }, $set: { updatedAt: new Date() } });
    else await atomicUpdate(Coupon, { _id: couponId }, { $inc: { redeemedCount: -1 }, $set: { updatedAt: new Date() } });
    if (isDupKey(e)) {
      const same = await CouponRedemption.findOne({ redemptionKey });
      if (same) return same;                                   // same order raced us — success
      throw couponError('You’ve already used this coupon.', 'PER_USER');   // userLimitKey collision
    }
    throw e;
  }
}

// ---- super-admin management ------------------------------------------------
/** @param {any} data @param {any} adminId */
async function create(data, adminId) {
  const code = normalizeCode(data.code);
  if (!code) throw couponError('A coupon code is required.', 'INVALID');
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) throw couponError('Code must be 3–40 letters, digits, - or _.', 'INVALID');
  if (await findByCode(code)) throw couponError('That code already exists.', 'DUPLICATE');
  const kind = data.kind === 'flat' ? 'flat' : 'percent';
  const percentOff = kind === 'percent' ? clamp(Number(data.percentOff) || 0, 0, 100) : 0;
  const flatOffCHF = kind === 'flat' ? Math.max(0, Number(data.flatOffCHF) || 0) : 0;
  if (kind === 'percent' && !(percentOff > 0)) throw couponError('Percent off must be greater than 0.', 'INVALID');
  if (kind === 'flat' && !(flatOffCHF > 0)) throw couponError('Flat amount must be greater than 0.', 'INVALID');
  const hasMax = data.maxRedemptions != null && data.maxRedemptions !== '';
  const remaining = hasMax ? Math.max(0, Math.floor(Number(data.maxRedemptions))) : null;
  return Coupon.create({
    code, kind, percentOff, flatOffCHF,
    appliesTo: (Array.isArray(data.appliesTo) && data.appliesTo.length) ? data.appliesTo : ['*'],
    minAmountCHF: Math.max(0, Number(data.minAmountCHF) || 0),
    remaining, maxRedemptions: remaining,
    perUserLimit: data.perUserLimit != null ? Math.max(1, Math.floor(Number(data.perUserLimit))) : 1,
    redeemedCount: 0,
    startsAt: data.startsAt ? new Date(data.startsAt) : null,
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    active: data.active !== false,
    note: String(data.note || '').slice(0, 300),
    createdBy: adminId, createdAt: new Date(), updatedAt: new Date(),
  });
}

/** @param {any} id @param {any} patch */
async function update(id, patch) {
  /** @type {Record<string, any>} */
  const set = { updatedAt: new Date() };
  if (patch.active != null) set.active = !!patch.active;
  if (patch.note != null) set.note = String(patch.note).slice(0, 300);
  if (patch.expiresAt !== undefined) set.expiresAt = patch.expiresAt ? new Date(patch.expiresAt) : null;
  if (patch.perUserLimit != null) set.perUserLimit = Math.max(1, Math.floor(Number(patch.perUserLimit)));
  if (patch.maxRedemptions !== undefined) {
    const c = await Coupon.findById(id);
    const newMax = (patch.maxRedemptions === null || patch.maxRedemptions === '') ? null : Math.max(0, Math.floor(Number(patch.maxRedemptions)));
    set.maxRedemptions = newMax;
    set.remaining = newMax == null ? null : Math.max(0, newMax - ((c && c.redeemedCount) || 0));
  }
  return Coupon.findByIdAndUpdate(id, { $set: set }, { new: true });
}

/** All coupons, newest first (super-admin list). */
async function list() { return Coupon.find({}).sort({ createdAt: -1 }).limit(500); }

/** Public shape (safe to send to the client at redemption preview). @param {any} c */
function pub(c) {
  return {
    id: c._id, code: c.code, kind: c.kind, percentOff: c.percentOff, flatOffCHF: c.flatOffCHF,
    appliesTo: c.appliesTo, minAmountCHF: c.minAmountCHF, remaining: c.remaining, maxRedemptions: c.maxRedemptions,
    perUserLimit: c.perUserLimit, redeemedCount: c.redeemedCount, startsAt: c.startsAt, expiresAt: c.expiresAt,
    active: c.active, note: c.note, createdAt: c.createdAt,
  };
}

module.exports = { validate, redeem, discountFor, findByCode, create, update, list, pub, normalizeCode, categoryOf, applies };
