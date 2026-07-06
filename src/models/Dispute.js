const mongoose = require('mongoose');
const DisputeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  flagId: mongoose.Schema.Types.ObjectId,
  flagCategory: { type: String, enum: ['lie', 'contradiction', 'manipulation'] },
  reason: String,
  status: { type: String, enum: ['pending', 'reviewing', 'upheld', 'rejected'], default: 'pending' },
  reviewedBy: String, reviewedAt: Date, resolution: String,
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Dispute', DisputeSchema);
