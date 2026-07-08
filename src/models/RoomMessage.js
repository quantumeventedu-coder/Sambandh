const mongoose = require('../db/odm');

// A message in a community room. userId is stored for moderation/rate-limiting
// only and is NEVER exposed — the client only ever sees the anonymous `handle`.
const RoomMessageSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, index: true },
  handle: String,                     // stable per (user, room) pseudonym
  text: String,
  flagged: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('RoomMessage', RoomMessageSchema);
