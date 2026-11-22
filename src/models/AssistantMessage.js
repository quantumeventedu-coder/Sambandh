const mongoose = require('../db/odm');
// A single turn in a Setu Guide conversation. `content` is encrypted at rest.
// Citations / memory references make every answer traceable to its evidence.
const AssistantMessageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssistantConversation', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },            // enc:v1:…
  citations: [mongoose.Schema.Types.Mixed],             // [{ n, title, url, domain, quality, fetchedAt }]
  memoryRefs: [String],                                 // Memory ids used to answer
  knowledgeRefs: [String],                              // internal knowledge-base chunk ids
  model: { id: String, provider: String, mode: String },
  latencyMs: Number,
  tokens: { input: Number, output: Number },
  safety: { flags: [String], status: String },
  feedback: { rating: Number, reason: String, correction: String, at: Date },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('AssistantMessage', AssistantMessageSchema);
