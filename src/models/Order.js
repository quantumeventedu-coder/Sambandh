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
  // Physical delivery destination — REQUIRED for kind:'product' (enforced in
  // services/marketplace.createOrder), null for services/bookings. The buyer's GPS
  // location is NEVER used for delivery; this is the postal address they provide and
  // the fulfilling partner ships to. For a gift to a match, `giftForUserId` records
  // who it's for (the address can be the buyer's own or the recipient's, as given).
  shippingAddress: {
    name: String, phone: String,
    line1: String, line2: String,
    city: String, state: String, pincode: String, landmark: String,
    country: { type: String, default: 'IN' }
  },
  giftForUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // Gift-acceptance gate — ORTHOGONAL to the money state machine (no new money states).
  // A gift order stays 'pending' until the RECIPIENT accepts and supplies their OWN
  // private address (the buyer never sees it); 'declined' triggers an escrow-safe refund.
  // 'none' for ordinary self-purchases.
  giftStatus: { type: String, enum: ['none', 'pending', 'accepted', 'declined'], default: 'none', index: true },
  giftRespondedAt: Date,
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
