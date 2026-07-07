const mongoose = require('../db/odm');

// Keys for the reusable AI API — lets the owner's OTHER apps call Sambandh's
// LLM gateway. Only the sha256 hash is stored; the plaintext key is shown once
// at creation. A short prefix is kept for display ("sbk_live_ab12…").
const ApiKeySchema = new mongoose.Schema({
  name: { type: String, required: true },        // e.g. "EdurankAI", "internal-cron"
  prefix: { type: String, index: true },         // first chars, for display + fast lookup
  keyHash: { type: String, unique: true, index: true }, // sha256 of the full key
  disabled: { type: Boolean, default: false },
  scopes: { type: [String], default: ['ai:complete'] },
  rateLimitPerMin: { type: Number, default: 60 },
  calls: { type: Number, default: 0 },
  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  lastUsedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ApiKey', ApiKeySchema);
