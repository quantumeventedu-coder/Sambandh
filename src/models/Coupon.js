const mongoose = require('../db/odm');

// A discount coupon, created by a super-admin and redeemed at checkout. The discount is
// applied to the BASE price BEFORE tax (so GST/VAT is charged on the discounted amount),
// in canonical CHF — the checkout converts it to the buyer's currency like every price.
//
// Caps are enforced the money-safe way (learned from the wallet review): the TOTAL cap is
// a `remaining` counter decremented by a single conditional atomicUpdate (never
// findOneAndUpdate), and the per-user cap rides a DB-level unique key on CouponRedemption.
const CouponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },   // stored UPPERCASE
  kind: { type: String, enum: ['percent', 'flat'], required: true },
  percentOff: { type: Number, default: 0 },      // 0..100 for kind 'percent'
  flatOffCHF: { type: Number, default: 0 },      // CHF off for kind 'flat'
  // Which purposes this applies to: ['*'] = anything, or specific purposes / categories
  // (e.g. 'base_subscription', 'subscription', 'consultation', 'gift_pass').
  appliesTo: { type: [String], default: ['*'] },
  minAmountCHF: { type: Number, default: 0 },     // ignore below this base price
  // Total redemptions left. null = unlimited. Decremented atomically on redemption.
  remaining: { type: Number, default: null },
  maxRedemptions: { type: Number, default: null },// the initial `remaining` (for display)
  perUserLimit: { type: Number, default: 1 },     // how many times ONE user may redeem
  redeemedCount: { type: Number, default: 0 },    // total ever redeemed (stats)
  startsAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
  active: { type: Boolean, default: true },
  note: { type: String, default: '' },            // admin description (e.g. "QA testers")
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Coupon', CouponSchema);
