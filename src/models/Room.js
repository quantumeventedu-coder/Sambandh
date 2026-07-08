const mongoose = require('../db/odm');

// A community room — an open, topic-based space where any verified member can
// talk under a stable per-room pseudonym. Not tied to romance: friends,
// professionals, newcomers, support — everyone gets a Sambandh.
const RoomSchema = new mongoose.Schema({
  slug: { type: String, unique: true, index: true },
  name: String,
  topic: String,
  // interest · city · professional · support · general
  category: { type: String, enum: ['interest', 'city', 'professional', 'support', 'general'], default: 'general', index: true },
  description: String,
  icon: String,                       // emoji shown on the card
  memberCount: { type: Number, default: 0 },
  messageCount: { type: Number, default: 0 },
  lastMessageAt: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Room', RoomSchema);
