// @ts-check
// models/Session.js — the actual consultation tied to a booked Order + slot.
//
// Lifecycle mirrors the marketplace order: scheduled → active (consultant starts)
// → ended (consultant ends) → the buyer completes the order to release the payout.
// actualMinutes is recorded for reference (per-minute offerings are priced from the
// booked slot length, so the charged amount is fixed at booking).
const mongoose = require('../db/odm');

const SESSION_STATES = ['scheduled', 'active', 'ended', 'cancelled'];

const SessionSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true, sparse: true },
  slotId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConsultantSlot', required: true },
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },   // the ATTENDEE (transfers to the recipient when a gift is accepted)
  bookedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },            // who paid (the gift buyer); = userId for a self-booking
  giftForUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true }, // recipient, until they accept
  status: { type: String, enum: SESSION_STATES, default: 'scheduled', index: true },
  startedAt: Date,
  endedAt: Date,
  actualMinutes: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Session', SessionSchema);
module.exports.SESSION_STATES = SESSION_STATES;
