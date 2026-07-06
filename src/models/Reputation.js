const mongoose = require('../db/odm');
const ReputationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  lastUpdatedAt: { type: Date, default: Date.now },
  basedOnChats: { type: Number, default: 0 },
  basedOnMessages: { type: Number, default: 0 },
  scores: {
    respect: { type: Number, default: 5 }, responsive: { type: Number, default: 5 },
    depth: { type: Number, default: 5 }, humor: { type: Number, default: 5 },
    directness: { type: Number, default: 5 }
  },
  grades: { conversation: String, boundaries: String, honesty: String, warmth: String },
  tagsPositive: [{ tag: String, count: Number, lastSeenAt: Date }],
  tagsNegative: [{ tag: String, count: Number, lastSeenAt: Date }],
  userRatings: { totalRatingsGiven: { type: Number, default: 0 }, averageStars: { type: Number, default: 0 } },
  redFlags: { ghostingIncidents: { type: Number, default: 0 }, blockedByOthers: { type: Number, default: 0 }, reportsAgainst: { type: Number, default: 0 } },
  trustScore: { type: Number, default: 50 }
});
module.exports = mongoose.model('Reputation', ReputationSchema);
