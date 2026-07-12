const mongoose = require('../db/odm');

// Append-only behavioural event log (Intelligence spec Vol I §3 / §8 — the
// event-sourcing backbone). One immutable row per meaningful thing a user does.
// Behaviour is DERIVED from sequences of these (services/behavior-engine.js),
// never stored as a mutable label. Payload is intentionally small and free of
// message text — ids and lightweight metadata only.
const EventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true, index: true },   // e.g. Liked, Passed, MessageSent, RoomPosted
  payload: mongoose.Schema.Types.Mixed,                   // event-specific { targetId, chatId, roomSlug, ... }
  context: mongoose.Schema.Types.Mixed,                   // optional { source, ... }
  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('Event', EventSchema);
