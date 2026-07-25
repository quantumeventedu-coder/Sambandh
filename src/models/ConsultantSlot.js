// @ts-check
// models/ConsultantSlot.js — a bookable time slot a consultation partner publishes.
//
// Booking a slot is an ATOMIC compare-and-set (open → booked) via the ODM's
// atomicUpdate, so two buyers can never grab the same slot (the same class of race
// the marketplace hardening fixed). A booked slot carries its Order id.
const mongoose = require('../db/odm');

const SLOT_STATES = ['open', 'booked', 'cancelled'];

const ConsultantSlotSchema = new mongoose.Schema({
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
  startsAt: { type: Date, required: true, index: true },
  durationMin: { type: Number, default: 30 },
  status: { type: String, enum: SLOT_STATES, default: 'open', index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ConsultantSlot', ConsultantSlotSchema);
module.exports.SLOT_STATES = SLOT_STATES;
