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

/** How many times this user has ACTIVELY redeemed this coupon. Released reservations (abandoned /
 * cancelled / refunded checkouts) do NOT count — otherwise abandoning a checkout would lock a user
 * out of a one-time coupon they never actually used. @param {any} couponId @param {any} userId */
async function userRedemptionCount(couponId, userId) {
  return (await CouponRedemption.find({ couponId, userId })).filter((/** @type {any} */ r) => !r.released).length;
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
 *
 * `committed:false` marks a reservation made at order-CREATE whose charge is not yet final
 * (paid order path) — the ONLY rows the abandonment sweep considers. Everything final at once
 * (free/membership/tester grants) is committed:true and never swept.
 * @param {{ coupon:any, userId:any, orderRef:string, paymentId?:any, purpose?:string, discountCHF?:number, discountLocal?:number, currency?:string, committed?:boolean }} a
 */
async function redeem({ coupon, userId, orderRef, paymentId, purpose, discountCHF, discountLocal, currency, committed = true }) {
  const couponId = coupon._id;
  const redemptionKey = `${couponId}:${orderRef}`;

  const prior = await CouponRedemption.findOne({ redemptionKey });
  if (prior && !prior.released) return prior;   // active reservation/redemption on this order — idempotent
  if (prior && prior.released) {
    // A LATE redemption on a reservation the abandonment sweep already released (its payment
    // captured after the TTL). RE-CONSUME the cap so the genuinely-paid order holds a slot again —
    // only the CAS winner re-decrements. remaining/redeemedCount move in LOCKSTEP (−1/+1) exactly as
    // a normal consume, WITHOUT the remaining>0 guard: if another order took the freed slot first,
    // remaining goes negative — an honest, bounded over-subscription that (a) blocks further redeems
    // (validate treats remaining<=0 as exhausted) and (b) reverses cleanly when this order is later
    // released (+1/−1) instead of over-restoring the cap. Only ever arises from the narrow sweep-
    // then-late-capture race, never from normal reserve→capture.
    const won = await atomicUpdate(CouponRedemption, { redemptionKey, released: true }, { $set: { released: false, committed: true, releasedAt: null } });
    if (won) {
      if (coupon.remaining != null) await atomicUpdate(Coupon, { _id: couponId }, { $inc: { remaining: -1, redeemedCount: 1 }, $set: { updatedAt: new Date() } });
      else await atomicUpdate(Coupon, { _id: couponId }, { $inc: { redeemedCount: 1 }, $set: { updatedAt: new Date() } });
    }
    return await CouponRedemption.findOne({ redemptionKey });
  }

  // Per-user cap, enforced RACE-SAFELY for EVERY limit value by a SLOT unique key: a redemption
  // claims the LOWEST FREE slot in [0, perUser) not held by an active redemption, so two concurrent
  // attempts pick the same slot and collide on the unique index (one wins) — the limit can never be
  // exceeded. Lowest-free (not count-based) so releasing a MIDDLE reservation of a multi-use coupon
  // frees exactly its slot for reuse, instead of leaving a gap the next redemption would collide on.
  const perUser = coupon.perUserLimit != null ? Number(coupon.perUserLimit) : null;
  let userLimitKey;
  if (perUser != null) {
    const active = (await CouponRedemption.find({ couponId, userId })).filter((/** @type {any} */ r) => !r.released);
    if (active.length >= perUser) throw couponError('You’ve already used this coupon.', 'PER_USER');
    const taken = new Set(active.map((/** @type {any} */ r) => r.userLimitKey));
    let slot = 0;
    while (taken.has(`${couponId}:${userId}:${slot}`)) slot++;
    userLimitKey = `${couponId}:${userId}:${slot}`;
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
      discountCHF, discountLocal, currency, redemptionKey, userLimitKey, released: false, committed: !!committed, at: new Date(),
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
 * sweep) can never both restore the counter. The row is left in place (marked released) — if the
 * order's payment later captures anyway, redeem() re-consumes the slot from this same row, so the
 * cap is never double-counted in either direction. The per-user slot key is retired to a released-
 * unique value so it neither counts toward perUserLimit (see userRedemptionCount) nor collides
 * with the user's next attempt — an abandoned checkout never locks a one-time coupon.
 * NOTE (safe-direction): pre-deploy rows that predate the `released` field won't match this CAS
 * (no backfill); their slot simply isn't reclaimed on cancel — the safe (under-issue) direction.
 * `onlyIfUncommitted` (used by the sweep) additionally guards committed:false in the SAME CAS, so a
 * reservation that captures + commits DURING a sweep run can't be released off a stale snapshot.
 * @param {{ coupon:any, orderRef:string, onlyIfUncommitted?:boolean }} a @returns {Promise<boolean>} whether THIS call released
 */
async function release({ coupon, orderRef, onlyIfUncommitted = false }) {
  const couponId = coupon._id;
  const redemptionKey = `${couponId}:${orderRef}`;
  const filter = onlyIfUncommitted
    ? { redemptionKey, released: false, committed: false }
    : { redemptionKey, released: false };
  const claimed = await atomicUpdate(CouponRedemption, filter,
    { $set: { released: true, releasedAt: new Date(), userLimitKey: 'rel:' + redemptionKey } });
  if (!claimed) return false;   // no such reservation, already released, or committed under us — idempotent no-op
  if (coupon.remaining != null) {
    await atomicUpdate(Coupon, { _id: couponId }, { $inc: { remaining: 1, redeemedCount: -1 }, $set: { updatedAt: new Date() } });
  } else {
    await atomicUpdate(Coupon, { _id: couponId }, { $inc: { redeemedCount: -1 }, $set: { updatedAt: new Date() } });
  }
  return true;
}

/**
 * Mark a reservation's charge as FINAL (its payment captured) so the abandonment sweep never
 * considers it again — called at capture-confirm. Idempotent (committed:false→true CAS); a no-op
 * for grants that were already committed at create.
 * @param {{ coupon:any, orderRef:string }} a
 */
async function commitReservation({ coupon, orderRef }) {
  await atomicUpdate(CouponRedemption, { redemptionKey: `${coupon._id}:${orderRef}`, committed: false }, { $set: { committed: true } });
}

/**
 * Return a captured reservation to the abandonment-sweep's scope (committed:true→false) — called
 * when its order is cancelled/refunded, so that even if the immediate release throws, the nightly
 * sweep still reclaims the slot (the payment is now refunded → releasable). Keyed on the unique
 * couponOrderRef so the caller needn't resolve the coupon first. Idempotent no-op otherwise.
 * @param {string} orderRef
 */
async function markSweepable(orderRef) {
  await atomicUpdate(CouponRedemption, { orderRef, committed: true }, { $set: { committed: false } });
}

/**
 * Nightly backstop: release reservations whose order NEVER became a real charge — an abandoned
 * checkout (payment stuck 'created'/'failed', or gone) still holding a cap slot. A payment that
 * captured is a real use and is left alone (a later cancel/refund releases it via transition()).
 *
 * The candidate set is `committed:false` reservations only — a captured order is marked
 * committed at confirm (redeemOrderCoupon), so real uses never pile up in this query and starve a
 * genuinely-stale one no matter how many coupons have ever been redeemed. Oldest-first + a TTL
 * gate means a live checkout is never reclaimed. Payment / Coupon rows are batch-loaded ($in), not
 * per-reservation. Bounded at 5000 pending reservations/run (logged if that cap is ever hit).
 * @param {Date} now @param {number} [ttlMinutes]
 */
async function releaseStaleReservations(now, ttlMinutes = 120) {
  const Payment = require('../models/Payment');
  const cutoff = new Date(now.getTime() - ttlMinutes * 60000);
  const LIMIT = 5000;
  // Only reservations still pending (uncommitted), already aged past the checkout window, that
  // have a payment to check (free/membership grants carry none and are never swept).
  const open = await CouponRedemption.find({ released: false, committed: false, at: { $lt: cutoff } }).sort({ at: 1 }).limit(LIMIT);
  const capped = open.length >= LIMIT;
  if (!open.length) return { released: 0, capped };
  const uniq = (/** @type {any[]} */ a) => [...new Set(a.map((v) => v && String(v)).filter(Boolean))];
  const [payments, cpns] = await Promise.all([
    Payment.find({ _id: { $in: uniq(open.map((/** @type {any} */ r) => r.paymentId)) } }).lean(),
    Coupon.find({ _id: { $in: uniq(open.map((/** @type {any} */ r) => r.couponId)) } }),
  ]);
  const payById = new Map(payments.map((/** @type {any} */ p) => [String(p._id), p]));
  const couponById = new Map(cpns.map((/** @type {any} */ c) => [String(c._id), c]));
  let released = 0;
  for (const r of open) {
    if (r.paymentId) {
      const pay = payById.get(String(r.paymentId));
      if (pay && pay.status === 'refunding') continue;                 // in-flight refund — transition() owns it
      if (pay && pay.status === 'captured') {
        // Real use whose commit was lost (commitReservation threw) — self-heal so it leaves the
        // candidate set next run instead of re-scanning forever, and never gets released.
        await commitReservation({ coupon: { _id: r.couponId }, orderRef: r.orderRef }).catch(() => { });
        continue;
      }
    }
    // No paymentId here means a free/membership grant that markSweepable() returned to scope — i.e.
    // its order was cancelled/refunded and the immediate release was lost — so reclaiming is correct.
    // onlyIfUncommitted re-checks committed:false in the release CAS, so a reservation that captured
    // between the snapshot above and here is NOT released off the stale 'created' read.
    const coupon = couponById.get(String(r.couponId));
    // Coupon hard-deleted out from under a live reservation: nothing to release, but commit the row
    // so it leaves the candidate set instead of re-clogging the oldest-first 5000-row budget forever.
    if (!coupon) { await commitReservation({ coupon: { _id: r.couponId }, orderRef: r.orderRef }).catch(() => { }); continue; }
    if (await release({ coupon, orderRef: r.orderRef, onlyIfUncommitted: true })) released++;
  }
  return { released, capped };
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
    // Floor the DISPLAYED remaining at 0: the re-consume path can drive the stored counter briefly
    // negative (honest over-subscription, kept for lockstep), but "-1 left" is confusing to show.
    appliesTo: c.appliesTo, minAmountCHF: c.minAmountCHF, remaining: (typeof c.remaining === 'number') ? Math.max(0, c.remaining) : c.remaining, maxRedemptions: c.maxRedemptions,
    perUserLimit: c.perUserLimit, redeemedCount: c.redeemedCount, startsAt: c.startsAt, expiresAt: c.expiresAt,
    active: c.active, note: c.note, createdAt: c.createdAt,
  };
}

module.exports = { validate, redeem, release, commitReservation, markSweepable, releaseStaleReservations, discountFor, findByCode, create, update, list, pub, normalizeCode, categoryOf, applies };
