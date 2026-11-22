const mongoose = require('../db/odm');
// Admin-managed model registry entry (self-hosted first). No secrets are stored
// here: `apiKeyEnv` names the env var that holds an endpoint's key, if any.
const IntelligenceModelSchema = new mongoose.Schema({
  modelKey: { type: String, required: true, unique: true },
  label: String,
  provider: { type: String, enum: ['openai', 'ollama', 'anthropic', 'builtin'], required: true },
  baseUrl: String,
  model: String,
  tasks: [String],                 // chat|reasoning|extraction|classification|summarization|embedding
  tier: { type: String, enum: ['small', 'large'], default: 'small' },
  priority: { type: Number, default: 50 },
  enabled: { type: Boolean, default: true },
  version: String,
  quantization: String,
  contextWindow: Number,
  maxTokens: Number,
  timeoutMs: Number,
  capabilities: { tools: Boolean, json: Boolean, stream: Boolean },
  apiKeyEnv: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('IntelligenceModel', IntelligenceModelSchema);
