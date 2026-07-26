// @ts-check
// models/DueDiligenceCase.js — a consent-gated, subject-curated trust dossier.
//
// A requester asks a mutual match for a dossier; the SUBJECT must consent, and can
// revoke at any time. Unlike the paid Verification Services product, this is free and
// SUBJECT-CURATED: it compiles only first-party verification signals plus the vault
// documents the subject themselves chooses to share. Revoking cuts off the requester
// and revokes every document share created for the case. Only the two parties see it.
const mongoose = require('../db/odm');

const DD_STATES = ['pending', 'active', 'declined', 'revoked', 'closed'];

const DueDiligenceCaseSchema = new mongoose.Schema({
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  consentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consent', default: null },
  status: { type: String, enum: DD_STATES, default: 'pending', index: true },
  // Vault documents the subject shared into this dossier (share revoked on revoke/close).
  sharedDocs: [{
    vaultDocumentId: { type: mongoose.Schema.Types.ObjectId, ref: 'VaultDocument' },
    shareId: { type: mongoose.Schema.Types.ObjectId, ref: 'VaultShare' },
    sharedAt: Date
  }],
  createdAt: { type: Date, default: Date.now },
  revokedAt: Date
});

module.exports = mongoose.model('DueDiligenceCase', DueDiligenceCaseSchema);
module.exports.DD_STATES = DD_STATES;
