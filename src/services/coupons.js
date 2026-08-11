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

  const prior = await CouponRedemption.findOne({ redemptionKey });
  if (prior) return prior;   // this order already redeemed — idempotent

  // Per-user cap, enforced RACE-SAFELY for EVERY limit value by a SLOT unique key: the Nth
  // redemption for this (coupon,user) claims slot N-1, so two concurrent attempts at the same
  // slot collide on the unique index (one wins) — the limit can never be exceeded, and a
  // concurrent/retried free-path request can't mint a second grant.
  const perUser = coupon.perUserLimit != null ? Number(coupon.perUserLimit) : null;
  let userLimitKey;
  if (perUser != null) {
    const used = await userRedemptionCount(couponId, userId);
    if (used >= perUser) throw couponError('You’ve already used this coupon.', 'PER_USER');
    userLimitKey = `${couponId}:${userId}:${used}`;
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
      discountCHF, discountLocal, currency, redemptionKey, userLimitKey, released: false, at: new Date(),
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

/**
 * RELEASE a reservation made by redeem() — give the cap slot back. Used when the order the
 * coupon was reserved for never becomes a real charge (cancelled / refunded / abandoned).
 * Idempotent and concurrency-safe: the release is CLAIMED by an atomic released:false→true CAS
 * on the reservation row, so two concurrent releases (e.g. an explicit cancel racing the nightly
 * sweep) can never both restore the counter. A released row is left in place (marked) so a late
 * capture on the same ref resolves idempotently to it and does NOT re-consume — erring, as the
 * rest of the coupon rail does, in the safe (never over-charge, never double-count) direction.
 * @param {{ coupon:any, orderRef:string }} a @returns {Promise<boolean>} whether THIS call released
 */
async function release({ coupon, orderRef }) {
  const couponId = coupon._id;
  const redemptionKey = `${couponId}:${orderRef}`;
  const claimed = await atomicUpdate(CouponRedemption,
    { redemptionKey, released: false },
    { $set: { released: true, releasedAt: new Date() } });
  if (!claimed) return false;   // no such reservation, or already released — idempotent no-op
  if (coupon.remaining != null) {
    await atomicUpdate(Coupon, { _id: couponId }, { $inc: { remaining: 1, redeemedCount: -1 }, $set: { updatedAt: new Date() } });
  } else {
    await atomicUpdate(Coupon, { _id: couponId }, { $inc: { redeemedCount: -1 }, $set: { updatedAt: new Date() } });
  }
  return true;
}

/**
 * Nightly backstop: release reservations whose order NEVER became a real charge — an abandoned
 * checkout (payment stuck 'created'/'failed', or gone) still holding a cap slot. A payment that
 * captured is a real use and is left alone (a later cancel/refund releases it via transition()).
 * Only touches reservations older than `ttlMinutes` so a live checkout is never reclaimed.
 * @param {Date} now @param {number} [ttlMinutes]
 */
async function releaseStaleReservations(now, ttlMinutes = 120) {
  const Payment = require('../models/Payment');
  const cutoffMs = now.getTime() - ttlMinutes * 60000;
  const open = await CouponRedemption.find({ released: false }).limit(5000);
  let released = 0;
  for (const r of open) {
    if (!r.paymentId) continue;                                   // free/legacy reservation — never swept
    if (new Date(r.at).getTime() > cutoffMs) continue;            // still inside the checkout window
    const pay = await Payment.findById(r.paymentId);
    if (pay && pay.status !== 'created' && pay.status !== 'failed') continue;   // real/captured use — leave it
    const coupon = await Coupon.findById(r.couponId);
    if (!coupon) continue;
    if (await release({ coupon, orderRef: r.orderRef })) released++;
  }
  return { released };
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
  // A non-numeric cap must be REJECTED, not silently coerced to null (which would disable the
  // cap and, on a 100%-off code, mint unlimited free memberships).
  const hasMax = data.maxRedemptions != null && data.maxRedemptions !== '';
  const maxN = Number(data.maxRedemptions);
  if (hasMax && !Number.isFinite(maxN)) throw couponError('Total uses must be a number.', 'INVALID');
  const remaining = hasMax ? Math.max(0, Math.floor(maxN)) : null;
  const puN = Number(data.perUserLimit);
  const perUserLimit = data.perUserLimit != null ? (Number.isFinite(puN) ? Math.max(1, Math.floor(puN)) : 1) : 1;
  return Coupon.create({
    code, kind, percentOff, flatOffCHF,
    appliesTo: (Array.isArray(data.appliesTo) && data.appliesTo.length) ? data.appliesTo : ['*'],
    minAmountCHF: Math.max(0, Number(data.minAmountCHF) || 0),
    remaining, maxRedemptions: remaining, perUserLimit,
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
  const c = await Coupon.findById(id);
  if (!c) return null;
  // maxRedemptions change: move `remaining` by the DELTA atomically (number→number) so
  // concurrent redeem() decrements are preserved, not clobbered by a stale absolute write.
  if (patch.maxRedemptions !== undefined) {
    const hasMax = patch.maxRedemptions !== null && patch.maxRedemptions !== '';
    const raw = Number(patch.maxRedemptions);
    if (hasMax && !Number.isFinite(raw)) throw couponError('Total uses must be a number.', 'INVALID');
    const newMax = hasMax ? Math.max(0, Math.floor(raw)) : null;
    if (newMax == null) {
      await atomicUpdate(Coupon, { _id: id }, { $set: { maxRedemptions: null, remaining: null, updatedAt: new Date() } });
    } else if (c.maxRedemptions == null || c.remaining == null) {
      await atomicUpdate(Coupon, { _id: id }, { $set: { maxRedemptions: newMax, remaining: Math.max(0, newMax - (c.redeemedCount || 0)), updatedAt: new Date() } });
    } else {
      await atomicUpdate(Coupon, { _id: id }, { $inc: { remaining: newMax - c.maxRedemptions }, $set: { maxRedemptions: newMax, updatedAt: new Date() } });
    }
  }
  /** @type {Record<string, any>} */
  const set = { updatedAt: new Date() };
  if (patch.active != null) set.active = !!patch.active;
  if (patch.note != null) set.note = String(patch.note).slice(0, 300);
  if (patch.expiresAt !== undefined) set.expiresAt = patch.expiresAt ? new Date(patch.expiresAt) : null;
  if (patch.perUserLimit != null) { const n = Number(patch.perUserLimit); if (Number.isFinite(n)) set.perUserLimit = Math.max(1, Math.floor(n)); }
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

module.exports = { validate, redeem, release, releaseStaleReservations, discountFor, findByCode, create, update, list, pub, normalizeCode, categoryOf, applies };
