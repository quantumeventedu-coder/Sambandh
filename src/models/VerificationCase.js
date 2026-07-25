// @ts-check
// models/VerificationCase.js — a purchased verification engagement.
//
// A requester buys a tier of verification about a subject (themselves, or — with
// the subject's explicit Consent — a mutual match). The case is FAIL-CLOSED: it
// only runs its checks once BOTH (a) the payment is captured and (b) consent is
// satisfied (implicit in self-mode, an explicit granted Consent in other-mode).
// The produced `report` deliberately excludes the subject's raw private data — it
// carries only coarse per-check status + honest, inference-labelled findings.
const mongoose = require('../db/odm');

const CASE_STATES = ['pending', 'processing', 'completed', 'declined', 'cancelled', 'refunded'];
const CASE_MODES = ['self', 'other'];

const VerificationCaseSchema = new mongoose.Schema({
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  mode: { type: String, enum: CASE_MODES, required: true },
  tier: { type: String, required: true },
  checks: { type: [String], default: [] },
  status: { type: String, enum: CASE_STATES, default: 'pending', index: true },
  paid: { type: Boolean, default: false },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  amountCHF: { type: Number, default: null },
  consentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consent', default: null },
  // Coarse findings computed at intake (e.g. self-submitted document authenticity),
  // so the raw ID bytes are evaluated once and DISCARDED, never persisted.
  precomputed: { type: mongoose.Schema.Types.Mixed, default: null },
  // The delivered result. Coarse + honest by construction (no raw subject PII).
  report: { type: mongoose.Schema.Types.Mixed, default: null },
  evidenceHash: { type: String, default: null },      // sha256 of the canonical result — tamper-evidence
  // Set true if the subject withdraws consent AFTER completion: freezes the report
  // and blocks all further access (the requester's live view is cut off).
  subjectConsentRevoked: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  completedAt: Date
});

module.exports = mongoose.model('VerificationCase', VerificationCaseSchema);
module.exports.CASE_STATES = CASE_STATES;
module.exports.CASE_MODES = CASE_MODES;
