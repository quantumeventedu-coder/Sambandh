const mongoose = require('mongoose');
const EscalationSchema = new mongoose.Schema({
  viewingUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  flagType: String,
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Escalation', EscalationSchema);
