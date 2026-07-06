const mongoose = require('mongoose');
const CompatibilitySchema = new mongoose.Schema({
  // userPair is always stored sorted (smaller id first) so a pair has one document
  userPair: { type: [String], required: true },
  computedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, index: true },
  astrology: {
    gunaScore: Number, gunaMax: { type: Number, default: 36 }, gunaPercent: Number,
    mangalCompatible: Boolean, moonSignCompatible: Boolean,
    sunSigns: [String], moonSigns: [String], nakshatras: [String],
    verdict: String,
    computedVia: { type: String, enum: ['prokerala', 'internal_approximation'] }
  },
  engagement: {
    messagesExchanged: Number, balanceScore: Number,
    responseTimeMatch: String, humorAlignment: Number, depthAlignment: Number,
    overallScore: Number, verdict: String
  },
  overall: Number
});
CompatibilitySchema.index({ userPair: 1 }, { unique: true });
module.exports = mongoose.model('Compatibility', CompatibilitySchema);
