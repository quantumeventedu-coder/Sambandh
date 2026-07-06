const mongoose = require('../db/odm');
const MessageSchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, maxlength: 5000 },
  type: { type: String, enum: ['text', 'image', 'voice', 'system'], default: 'text' },
  createdAt: { type: Date, default: Date.now },
  readAt: Date,
  attachments: [{ url: String, type: String, size: Number }],
  moderation: {
    flagged: { type: Boolean, default: false },
    flagReason: String,
    containsNSFW: { type: Boolean, default: false },
    containsPII: { type: Boolean, default: false },
    moderatedAt: Date
  },
  behaviorSignals: { sentiment: String, respectScore: Number, analyzedAt: Date },
  deleted: { type: Boolean, default: false }
});
MessageSchema.index({ chatId: 1, createdAt: 1 });
MessageSchema.index({ 'moderation.flagged': 1 });
module.exports = mongoose.model('Message', MessageSchema);
