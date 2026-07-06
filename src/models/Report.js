const mongoose = require('../db/odm');
const ReportSchema = new mongoose.Schema({
  // 'user' = filed by a member; 'system' = auto-filed by the AI reputation engine (no reporterId)
  source: { type: String, enum: ['user', 'system'], default: 'user' },
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: function () { return this.source !== 'system'; } },
  reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat' },
  messageIds: [mongoose.Schema.Types.ObjectId],
  category: {
    type: String,
    enum: ['harassment', 'fake_profile', 'scam', 'underage', 'hate_speech', 'non_consensual_image', 'other'],
    required: true
  },
  description: { type: String, maxlength: 2000 },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'reviewing', 'resolved'], default: 'pending', index: true },
  autoEscalated: { type: Boolean, default: false }, // 5+ reporters in 7 days → senior moderator
  reviewedAt: Date, reviewedBy: String,
  action: { type: String, enum: ['warning', 'suspend_24h', 'suspend_7d', 'ban_permanent', 'no_action'] }
});
module.exports = mongoose.model('Report', ReportSchema);
