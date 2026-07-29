const mongoose = require('../db/odm');
const VerificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['id', 'selfie', 'profession', 'education', 'income', 'medical_license', 'bar_license', 'ca_license'], required: true },
  claim: mongoose.Schema.Types.Mixed,
  // `key` is the storage object path (bucket-relative), stored so the retention job can
  // reliably HARD-DELETE the original from cloud/local storage (not just clear the URL).
  // `private:true` docs live in the PRIVATE storage bucket (no public URL) — viewed only via a
  // short-lived signed URL. `key` is the object path (for signed-URL + hard-delete).
  documents: [{ type: { type: String }, url: String, key: String, private: Boolean, value: String, uploadedAt: Date }],
  documentsPurgedAt: Date,   // set when the originals were deleted by the 30-day retention job
  status: { type: String, enum: ['pending', 'in_review', 'approved', 'rejected', 'expired'], default: 'pending', index: true },
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: Date, reviewedBy: String,
  reviewMethod: { type: String, enum: ['manual', 'digilocker', 'api_lookup', 'automated'] },
  rejectionReason: String, expiresAt: Date
});
VerificationSchema.index({ type: 1, status: 1 });
module.exports = mongoose.model('Verification', VerificationSchema);
