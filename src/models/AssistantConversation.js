const mongoose = require('../db/odm');
// One Setu Guide (assistant) conversation. Owned by exactly one user; never shared.
// `context` pins what the conversation is about (a match's chat, a profile, a journey…)
// so the engine loads ONLY platform data that user is authorised to see.
const AssistantConversationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, default: 'New conversation' },
  context: { kind: String, refId: String },          // kind: general|chat|profile|journey|community
  summary: String,                                     // encrypted rolling summary (enc:v1:…)
  summaryEmbedding: [Number],                          // for related-conversation retrieval
  entityIds: [String],                                 // KG entities mentioned here
  messageCount: { type: Number, default: 0 },
  lastMessageAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  deletedAt: Date
});
module.exports = mongoose.model('AssistantConversation', AssistantConversationSchema);
