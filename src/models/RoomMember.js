const mongoose = require('../db/odm');

// Tracks who has joined a room (for member counts, "my rooms", unread markers).
// One doc per (roomId, userId) — deduped in code via findOneAndUpdate upsert.
const RoomMemberSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, index: true },
  handle: String,
  joinedAt: { type: Date, default: Date.now },
  lastReadAt: Date
});

module.exports = mongoose.model('RoomMember', RoomMemberSchema);
