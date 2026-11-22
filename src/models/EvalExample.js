const mongoose = require('../db/odm');
// Evaluation dataset row: created ONLY for users who opted in to AI improvement
// (preferences.aiTrainingConsent). PII is redacted before storage; no user id.
const EvalExampleSchema = new mongoose.Schema({
  kind: { type: String, default: 'assistant_feedback' },
  prompt: String,
  answer: String,
  rating: Number,
  reason: String,
  correction: String,
  modelId: String,
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('EvalExample', EvalExampleSchema);
