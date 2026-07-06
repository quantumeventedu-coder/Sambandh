const mongoose = require('../db/odm');
const VerificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['id', 'selfie', 'profession', 'education', 'income', 'medical_license', 'bar_license', 'ca_license'], required: true },
  claim: mongoose.Schema.Types.Mixed,
  documents: [{ type: { type: String }, url: String, value: String, uploadedAt: Date }],
  status: { type: String, enum: ['pending', 'in_review', 'approved', 'rejected', 'expired'], default: 'pending', index: true },
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: Date, reviewedBy: String,
  reviewMethod: { type: String, enum: ['manual', 'digilocker', 'api_lookup', 'automated'] },
  rejectionReason: String, expiresAt: Date
});
VerificationSchema.index({ type: 1, status: 1 });
module.exports = mongoose.model('Verification', VerificationSchema);
