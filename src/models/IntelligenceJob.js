const mongoose = require('../db/odm');
// Durable background job (memory extraction, consolidation, research agent…).
// Works on a persistent host (interval worker) AND on serverless (cron drain).
const IntelligenceJobSchema = new mongoose.Schema({
  type: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  payload: mongoose.Schema.Types.Mixed,
  status: { type: String, enum: ['queued', 'running', 'done', 'failed', 'cancelled'], default: 'queued', index: true },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  runAt: { type: Date, default: Date.now },
  lockedUntil: Date,
  progress: [{ at: Date, step: String, detail: String }],
  result: mongoose.Schema.Types.Mixed,
  error: String,
  cancelRequested: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  finishedAt: Date
});
module.exports = mongoose.model('IntelligenceJob', IntelligenceJobSchema);
