const mongoose = require('mongoose');
const ChatSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  createdAt: { type: Date, default: Date.now },
  lastMessageAt: { type: Date, default: Date.now },
  messageCount: { type: Number, default: 0 },
  anonymity: {
    isAnonymous: { type: Boolean, default: false },
    userA_revealed: { type: Boolean, default: false },
    userB_revealed: { type: Boolean, default: false },
    revealRequestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    revealRequestedAt: Date,
    revealedAt: Date
  },
  intent: { type: String, enum: ['marriage', 'dating', 'casual', 'friendship'] },
  status: { type: String, enum: ['active', 'archived', 'blocked'], default: 'active' },
  moderation: {
    flaggedMessages: { type: Number, default: 0 },
    lastFlagReviewedAt: Date,
    isNSFW: { type: Boolean, default: false }
  },
  engagement: {
    balanceScore: Number, avgResponseTimeMinutes: Number,
    deepConversationFlag: Boolean, lastComputedAt: Date
  },
  deletedBy: [String]
});
ChatSchema.index({ participants: 1 });
ChatSchema.index({ lastMessageAt: -1 });
module.exports = mongoose.model('Chat', ChatSchema);
