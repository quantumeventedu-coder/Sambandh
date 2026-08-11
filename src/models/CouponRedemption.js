const mongoose = require('../db/odm');

// One row per coupon redemption — the audit trail and the enforcement backstop.
//
// Two DB-level unique keys make redemption safe under concurrency:
//   redemptionKey = `${couponId}:${orderRef}` — a given checkout redeems a coupon AT MOST
//     once (idempotent: a retried /verify or free-activation can't double-consume).
//   userLimitKey  = `${couponId}:${userId}:${slot}` — the Nth redemption for this (coupon,
//     user) claims slot N-1, so two concurrent attempts at the same slot collide on the
//     unique index (one wins). This enforces perUserLimit RACE-SAFELY for every limit value
//     — the cap can never be exceeded under concurrency.
const CouponRedemptionSchema = new mongoose.Schema({
  couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true, index: true },
  code: { type: String, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  orderRef: { type: String, index: true },        // razorpayOrderId, or a synthetic ref for free/wallet
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  purpose: String,
  discountCHF: Number,
  discountLocal: Number,
  currency: String,
  redemptionKey: { type: String, unique: true },  // `${couponId}:${orderRef}`
  userLimitKey: { type: String, unique: true },    // `${couponId}:${userId}` when perUserLimit===1
  // A reservation made at order-CREATE (cap authoritative before any charge) that is later given
  // back — the order was cancelled/refunded or the checkout abandoned. released:true rows keep the
  // slot key (conservative: the user still counts as having taken it) but no longer hold the TOTAL
  // cap. The release is a race-safe released:false→true CAS (see coupons.release).
  released: { type: Boolean, default: false, index: true },
  releasedAt: { type: Date },
  // false ONLY for a paid-order reservation whose charge isn't final yet — the sole rows the
  // abandonment sweep scans. Flipped true at capture (redeemOrderCoupon); everything final at
  // create (free / membership / tester grants) is committed:true and never swept.
  committed: { type: Boolean, default: true, index: true },
  at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('CouponRedemption', CouponRedemptionSchema);
