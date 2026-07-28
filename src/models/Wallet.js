const mongoose = require('../db/odm');

// A member's stored-value wallet. Single currency (set on first top-up). Balance is
// kept in INTEGER minor units so money math is float-safe (no 605.93 drift).
const WalletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  currency: { type: String, default: 'CHF' },
  balanceMinor: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Wallet', WalletSchema);
