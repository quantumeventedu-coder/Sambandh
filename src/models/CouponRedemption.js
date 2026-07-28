const mongoose = require('../db/odm');

// One row per coupon redemption — the audit trail and the enforcement backstop.
//
// Two DB-level unique keys make redemption safe under concurrency:
//   redemptionKey = `${couponId}:${orderRef}` — a given checkout redeems a coupon AT MOST
//     once (idempotent: a retried /verify or free-activation can't double-consume).
//   userLimitKey  = `${couponId}:${userId}`   — set ONLY when the coupon's perUserLimit is
//     1 (the common case, e.g. one code per tester); a second redemption by the same user
//     then fails the unique insert. For perUserLimit > 1 it is unset and a count check
//     enforces the (softer) limit.
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
  at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('CouponRedemption', CouponRedemptionSchema);
