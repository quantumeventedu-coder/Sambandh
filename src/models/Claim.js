const mongoose = require('../db/odm');
const ClaimSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
  type: { type: String, enum: ['exclusivity', 'intent', 'emotional', 'identity', 'experience', 'history', 'availability'], required: true },
  statement: String, normalized: String,
  strength: { type: String, enum: ['weak', 'moderate', 'strong'] },
  method: { type: String, enum: ['llm', 'rules'], default: 'rules' }, // how the claim was extracted
  createdAt: { type: Date, default: Date.now },
  contradicted: { type: Boolean, default: false }
});
ClaimSchema.index({ userId: 1, type: 1, createdAt: -1 });
module.exports = mongoose.model('Claim', ClaimSchema);
