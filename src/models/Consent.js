// @ts-check
// models/Consent.js — an explicit, scoped, revocable grant by a SUBJECT allowing a
// REQUESTER to run a bounded action on the subject's data.
//
// This is the consent primitive for consent-gated products (verification services
// now; due-diligence later). Nothing that examines another person's data may run
// until a matching Consent is `granted`, and the subject can `revoke` at any time.
// Fail-secure: absence of a granted, unexpired, unrevoked Consent = no permission.
const mongoose = require('../db/odm');

const CONSENT_STATES = ['pending', 'granted', 'denied', 'revoked', 'expired'];

const ConsentSchema = new mongoose.Schema({
  // Whose data is examined (the person who must consent).
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  // Who is asking (the person who benefits from the grant).
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  // What the consent is for.
  purpose: { type: String, required: true },
  // The exact check/data categories the subject authorizes — enforced per-check.
  scope: { type: [String], default: [] },
  // The engagement this consent belongs to (1:1 with a VerificationCase for now).
  caseId: { type: mongoose.Schema.Types.ObjectId, index: true },
  status: { type: String, enum: CONSENT_STATES, default: 'pending', index: true },
  decidedAt: Date,          // when granted or denied
  revokedAt: Date,          // when the subject withdrew a prior grant
  expiresAt: Date,          // optional hard expiry of the grant
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Consent', ConsentSchema);
module.exports.CONSENT_STATES = CONSENT_STATES;
