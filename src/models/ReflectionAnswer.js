const mongoose = require('../db/odm');
// One person's answer to a Reflect question. `sharing` is per answer:
// keep_private (only the author) | share_with_match | share_later.
const ReflectionAnswerSchema = new mongoose.Schema({
  journeyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Journey', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  questionKey: { type: String, required: true },
  value: mongoose.Schema.Types.Mixed,
  otherText: String,
  sharing: { type: String, enum: ['keep_private', 'share_with_match', 'share_later'], default: 'keep_private' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('ReflectionAnswer', ReflectionAnswerSchema);
