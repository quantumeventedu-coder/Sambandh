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
  // Race-safe idempotency: `${userId}:${type}:${ref}` for a ref-bound entry, else unset.
  // A DB-level partial-unique index makes a ref-bound credit/debit apply AT MOST ONCE even
  // under true concurrency — a duplicate insert fails (23505) and the caller treats it as
  // already-applied. Unset (null) entries are exempt (many ledger rows carry no ref).
  idemKey: { type: String, unique: true },
  purpose: String,      // what it paid for (e.g. base_subscription)
  note: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('WalletTransaction', WalletTransactionSchema);
