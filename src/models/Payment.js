const mongoose = require('../db/odm');
const PaymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  purpose: { type: String, enum: ['base_subscription', 'join_fee', 'karma_escalation', 'pro_subscription', 'max_subscription', 'base_annual', 'pro_annual', 'max_annual', 'boost', 'marketplace_order', 'verification_service', 'gift_pass', 'wallet_topup'], required: true },
  amountCHF: Number,
  currency: { type: String, default: 'CHF' },
  amountINR: Number, amountUSD: Number, // legacy, unused
  razorpayOrderId: String,
  razorpayPaymentId: { type: String, unique: true, sparse: true },
  razorpaySignature: String,
  // 'refunding' is a transient claim state: the refund path atomically flips
  // captured→refunding BEFORE calling the gateway, so concurrent cancels/refunds
  // can't double-refund; it settles to 'refunded' (or rolls back to 'captured').
  status: { type: String, enum: ['created', 'captured', 'failed', 'refunding', 'refunded'], default: 'created' },
  method: String,
  // Tax-invoice number, assigned ONCE (idempotently) when a receipt is first generated for
  // a captured payment. Empty string = not yet invoiced (a scalar default so the assignment
  // can be an atomic conditional set on invoiceNo:'').
  invoiceNo: { type: String, default: '' },
  invoiceAt: Date,
  // Single-use guard for a karma_escalation payment — a scalar default so the "consume" can be an
  // ATOMIC conditional set (escalationUsed:false → true), preventing one paid escalation being used twice.
  escalationUsed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  capturedAt: Date, refundedAt: Date,
  metadata: mongoose.Schema.Types.Mixed
});
module.exports = mongoose.model('Payment', PaymentSchema);
