const mongoose = require('../db/odm');
// An explainable, evidence-grounded Lakshan assessment. Automated analysis only
// ever produces an OPEN assessment; it has NO public effect until a human
// moderator confirms it (status 'confirmed'). The subject can always respond:
// acknowledge, correct, or appeal, and a correction/appeal goes back to review.
const LakshanAssessmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },  // the subject
  kind: { type: String, enum: ['contradiction', 'claim_check'], default: 'contradiction' },
  claimType: String,
  statements: [{
    role: String,                      // prior | new
    text: String,                      // enc:v1:… (shown only to the subject and reviewers)
    at: Date,
    epistemic: String,                 // verified_fact|self_reported|unverified_claim|inference
    source: { kind: String, chatId: String, messageId: String, claimId: String }
  }],
  conflictingDetails: [{ field: String, prior: String, current: String }],
  timeGapDays: Number,
  contextNotes: [String],
  classification: { type: String, enum: ['conflicting_evidence', 'possible_context', 'outdated_information', 'not_contradictory', 'insufficient_evidence'], required: true },
  confidence: { type: Number, default: 0 },
  explanation: String,
  status: { type: String, enum: ['open', 'acknowledged', 'corrected', 'appealed', 'confirmed', 'dismissed'], default: 'open', index: true },
  userResponse: { action: String, text: String, at: Date },
  review: { by: String, decision: String, notes: String, at: Date },
  publicEffect: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('LakshanAssessment', LakshanAssessmentSchema);
