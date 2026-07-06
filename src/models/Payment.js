const mongoose = require('../db/odm');
const PaymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  purpose: { type: String, enum: ['base_subscription', 'join_fee', 'karma_escalation', 'pro_subscription', 'max_subscription', 'boost'], required: true },
  amountCHF: Number,
  currency: { type: String, default: 'CHF' },
  amountINR: Number, amountUSD: Number, // legacy, unused
  razorpayOrderId: String,
  razorpayPaymentId: { type: String, unique: true, sparse: true },
  razorpaySignature: String,
  status: { type: String, enum: ['created', 'captured', 'failed', 'refunded'], default: 'created' },
  method: String,
  createdAt: { type: Date, default: Date.now },
  capturedAt: Date, refundedAt: Date,
  metadata: mongoose.Schema.Types.Mixed
});
module.exports = mongoose.model('Payment', PaymentSchema);
