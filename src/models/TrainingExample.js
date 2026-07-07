const mongoose = require('../db/odm');

// Anonymised organic training data for the in-house match model
// (services/trainer.js). Deliberately holds NO user id, name, or text — only a
// numeric feature vector and the binary outcome. Written only for users who
// opted in (preferences.aiTrainingConsent).
const TrainingExampleSchema = new mongoose.Schema({
  kind: { type: String, default: 'swipe', index: true },
  features: [Number],
  label: Number,               // 1 = liked, 0 = passed
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TrainingExample', TrainingExampleSchema);
