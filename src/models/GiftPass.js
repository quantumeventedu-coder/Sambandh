// @ts-check
// models/GiftPass.js — a Sambandh Gift Pass: a purchased, giftable, one-time-
// redeemable entitlement (premium membership, chat access, …).
//
// Lifecycle: created (awaiting payment) → active (paid, redeemable via `code`) →
// redeemed (linked permanently to the recipient) | expired | revoked. The `code` is
// an unguessable, unique redemption token that can be shared over ANY channel; the
// recipient redeems it inside Sambandh. Redemption is one-time (enforced by an atomic
// compare-and-set on `status`).
const mongoose = require('../db/odm');

const GIFT_PASS_STATES = ['created', 'active', 'redeemed', 'expired', 'revoked'];

const GiftPassSchema = new mongoose.Schema({
  purchaserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  passType: { type: String, required: true },
  amountCHF: { type: Number, default: 0 },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  code: { type: String, required: true, unique: true, index: true },   // the redemption token
  status: { type: String, enum: GIFT_PASS_STATES, default: 'created', index: true },
  message: { type: String, default: '' },                              // personal note from the sender
  deliverAt: { type: Date, default: null },                            // optional scheduled delivery date
  expiresAt: { type: Date, default: null },                            // optional expiry
  grant: { type: mongoose.Schema.Types.Mixed },                        // the entitlement: { kind, tier?, months? }
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },  // set on redemption
  redeemedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GiftPass', GiftPassSchema);
module.exports.GIFT_PASS_STATES = GIFT_PASS_STATES;
