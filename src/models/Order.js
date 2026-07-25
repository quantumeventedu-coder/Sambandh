// @ts-check
// models/Order.js — a buyer's purchase/booking of a Listing, with in-house escrow.
//
// Money flow (all computed by services/marketplace.js, no third party beyond the
// existing payment rail): buyer pays `amountCHF`; Sambandh keeps `commissionCHF`;
// the partner is owed `partnerPayoutCHF`, which stays in ESCROW until the buyer
// confirms fulfilment (or an auto-release window / dispute resolution).
//
// Lifecycle (transitions enforced in services/marketplace.js — invalid ones throw):
//   created → paid → confirmed → fulfilled → completed(payout released)
//   any of {created,paid,confirmed} → cancelled
//   {paid,confirmed,fulfilled} → disputed → {completed | refunded}
//   {paid,confirmed} → refunded
const mongoose = require('../db/odm');

const ORDER_STATES = ['created', 'paid', 'confirmed', 'fulfilled', 'completed', 'cancelled', 'refunded', 'disputed'];

const OrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
  kind: String,
  amountCHF: { type: Number, required: true },
  commissionRate: Number,                    // snapshot at order time (0..1)
  commissionCHF: Number,                      // Sambandh revenue
  partnerPayoutCHF: Number,                    // held in escrow, released on completion
  status: { type: String, enum: ORDER_STATES, default: 'created', index: true },
  stockReserved: { type: Boolean, default: false },   // true iff createOrder atomically decremented finite stock
  escrowHeld: { type: Boolean, default: false },
  escrowReleasedAt: Date,
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  scheduledFor: Date,                          // for bookings
  notes: String,
  disputeReason: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', OrderSchema);
module.exports.ORDER_STATES = ORDER_STATES;
