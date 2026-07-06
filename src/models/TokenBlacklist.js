const mongoose = require('mongoose');
// Logout invalidation: token hashes live here until their natural expiry (TTL).
const TokenBlacklistSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true }
});
TokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('TokenBlacklist', TokenBlacklistSchema);
