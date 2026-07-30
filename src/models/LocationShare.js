// @ts-check
// models/LocationShare.js — a CONSENTED, mutual, revocable, auto-expiring live-location
// share between two matched users (a couple). This is entirely separate from the admin
// oversight trail (LocationPing): coordinates here are relayed ONLY to the consented peer
// (and visible to the SUPER-ADMIN oversight view — never to ordinary admins/moderators),
// while active + both sides sharing + unexpired. Fail-closed everywhere.
//
// Layout is flat (a/b, not a nested participants array) so per-side consent bits and status
// are queryable/updatable, while `pair` (an array of the two ids) supports `{ pair: userId }`
// membership queries. A side's `lastFix` is EPHEMERAL — overwritten on each fix, nulled on
// revoke/expire; it is never appended to a history.
const mongoose = require('../db/odm');

const SHARE_STATES = ['pending', 'active', 'revoked', 'declined', 'expired'];
const Fix = { lat: Number, lng: Number, accuracy: Number, at: Date };

const LocationShareSchema = new mongoose.Schema({
  pair: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],  // [a, b] — for membership queries
  a: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },     // initiator
  b: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },     // invited peer
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat' },               // proves the match
  status: { type: String, enum: SHARE_STATES, default: 'pending', index: true },
  aSharing: { type: Boolean, default: true },   // a's live consent bit (initiator opts in on create)
  bSharing: { type: Boolean, default: false },  // b's live consent bit (set true on accept)
  aFix: { type: Fix, default: null },           // a's latest position — ephemeral, nulled on stop
  bFix: { type: Fix, default: null },
  expiresAt: { type: Date, required: true },    // hard auto-expiry (capped)
  createdAt: { type: Date, default: Date.now },
  revokedAt: Date,
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

module.exports = mongoose.model('LocationShare', LocationShareSchema);
module.exports.SHARE_STATES = SHARE_STATES;
