const mongoose = require('../db/odm');
// Permission-aware persistent memory (owner-scoped; never readable across users).
// category: episodic | semantic | project | procedural | explicit
// origin:   explicit (user saved) | inferred (extracted) | corrected (user fixed)
// History is append-only: an update never silently overwrites — the prior text,
// confidence and reason are kept in `history`.
const MemorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  category: { type: String, enum: ['episodic', 'semantic', 'project', 'procedural', 'explicit'], required: true },
  kind: String,                                  // preference|fact|decision|task|deadline|commitment|goal|question|event|procedure|note
  content: { type: String, required: true },     // enc:v1:…
  keyHashes: [String],                           // HMAC'd keywords: keyword search without plaintext terms at rest
  embedding: [Number],
  embeddingModel: String,
  entityIds: [String],
  source: { conversationId: String, messageId: String, kind: String },   // kind: assistant|explicit|correction
  origin: { type: String, enum: ['explicit', 'inferred', 'corrected'], default: 'inferred' },
  confidence: { type: Number, default: 0.6 },
  evidence: [{ conversationId: String, messageId: String, at: Date }],
  visibility: { type: String, enum: ['private'], default: 'private' },
  status: { type: String, enum: ['active', 'superseded', 'deleted'], default: 'active', index: true },
  supersededBy: String,
  dueAt: Date,                                   // tasks / deadlines / commitments
  resolvedAt: Date,
  version: { type: Number, default: 1 },
  history: [{ version: Number, content: String, confidence: Number, changedAt: Date, reason: String }],
  expiresAt: Date,
  accessCount: { type: Number, default: 0 },
  lastAccessedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Memory', MemorySchema);
