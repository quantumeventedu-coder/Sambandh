const mongoose = require('../db/odm');
const KarmaBookSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  score: { type: Number, default: 100, min: 0, max: 100 },
  lies: [{
    claimId: mongoose.Schema.Types.ObjectId,
    severity: { type: String, enum: ['low', 'medium', 'high'] },
    reason: String, factCheckable: Boolean, evidenceCount: Number, recordedAt: Date
  }],
  contradictions: [{
    claimId: mongoose.Schema.Types.ObjectId,
    conflictsWith: mongoose.Schema.Types.ObjectId,
    type: { type: String },
    severity: { type: String, enum: ['low', 'medium', 'high'] },
    reason: String, recordedAt: Date
  }],
  manipulationFlags: [{
    pattern: String,
    confidence: { type: String, enum: ['low', 'medium', 'high'] },
    evidence: String, recordedAt: Date
  }],
  fraudFlags: [{
    type: { type: String },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
    detail: String, recordedAt: Date
  }],
  activitySignals: mongoose.Schema.Types.Mixed,
  timesNotified: { type: Number, default: 0 },
  lastUpdatedAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('KarmaBook', KarmaBookSchema);
