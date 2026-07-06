const mongoose = require('../db/odm');
// A pass hides the profile from discover for 7 days (expiresAt TTL re-surfaces it)
const PassSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true }
});
PassSchema.index({ from: 1, to: 1 }, { unique: true });
PassSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('Pass', PassSchema);
