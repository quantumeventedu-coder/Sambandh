const mongoose = require('../db/odm');

// Single owner-editable configuration document (key: 'singleton'). Holds the
// admin-controllable LLM settings + usage meter. Config here OVERRIDES env; env
// is only the fallback/default. Managed from the super-admin panel.
const AppConfigSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'singleton', index: true },
  llm: {
    enabled: { type: Boolean, default: true },
    provider: { type: String, default: 'anthropic' },
    apiKey: String,                                   // overrides ANTHROPIC_API_KEY when set
    model: { type: String, default: 'claude-haiku-4-5-20251001' },
    maxTokens: { type: Number, default: 1024 },
    temperature: Number,
    features: {                                       // per-feature kill switches
      karma: { type: Boolean, default: true },
      reputation: { type: Boolean, default: true },
      api: { type: Boolean, default: true }
    }
  },
  llmUsage: {
    calls: { type: Number, default: 0 },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    errors: { type: Number, default: 0 },
    lastUsedAt: Date
  },
  // In-house self-learning match model (services/trainer.js).
  learnedModel: {
    weights: [Number],
    bias: Number,
    featureNames: [String],
    trainedAt: Date,
    examples: Number,
    accuracy: Number,
    auto: { type: Boolean, default: false }   // nightly auto-retrain
  },
  updatedAt: Date
});

module.exports = mongoose.model('AppConfig', AppConfigSchema);
