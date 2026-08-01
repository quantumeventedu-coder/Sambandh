// @ts-check
// models/SessionMessage.js — a message in a booking-scoped consultation thread, between the
// client (Session.userId) and the consultant (Partner.ownerUserId of Session.partnerId).
// Separate from the dating Chat/Message system — this is tied to a booked Session only.
const mongoose = require('../db/odm');

const SessionMessageSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  at: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model('SessionMessage', SessionMessageSchema);
