const mongoose = require('../db/odm');

// Append-only wallet ledger — every credit/debit, for auditability. Amounts are signed
// integer minor units (+credit / -debit); balanceAfterMinor is the wallet balance
// immediately after this entry.
const WalletTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['topup', 'spend', 'refund', 'adjustment'], required: true },
  amountMinor: Number,
  currency: String,
  balanceAfterMinor: Number,
  ref: String,          // paymentId / orderId
  purpose: String,      // what it paid for (e.g. base_subscription)
  note: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('WalletTransaction', WalletTransactionSchema);
