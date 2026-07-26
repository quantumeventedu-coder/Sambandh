// @ts-check
// models/CourtMarriageCase.js — a two-partner court-marriage workflow.
//
// Created by one partner (proposed); the other must ACCEPT before anything proceeds
// (mutual consent). From there it is a FAIL-CLOSED state machine that organises the
// required documents (pulled from each partner's vault and shared to the other),
// records the statutory notice period, and tracks solemnisation → registration →
// certificate. Only the two partners can ever see the case.
const mongoose = require('../db/odm');

const CM_STATES = ['proposed', 'active', 'notice_period', 'objection_raised',
  'clear_to_solemnize', 'solemnized', 'certificate_issued', 'declined', 'cancelled'];

const CourtMarriageCaseSchema = new mongoose.Schema({
  initiatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  act: { type: String, enum: ['special_marriage', 'hindu_marriage'], required: true },
  state: { type: String, default: null },          // jurisdiction (Indian state), optional
  status: { type: String, enum: CM_STATES, default: 'proposed', index: true },
  // Attached documents: a pointer to a vault doc + the share created for the partner.
  documents: [{
    requirementKey: String,
    vaultDocumentId: { type: mongoose.Schema.Types.ObjectId, ref: 'VaultDocument' },
    byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    shareId: { type: mongoose.Schema.Types.ObjectId, ref: 'VaultShare' },
    attachedAt: Date
  }],
  witnesses: [{ name: String, addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, addedAt: Date }],
  noticeFiledAt: Date,
  noticePeriodEndsAt: Date,
  objection: { reason: String, raisedAt: Date, resolvedAt: Date },
  solemnizedAt: Date,
  certificateDocumentId: { type: mongoose.Schema.Types.ObjectId, ref: 'VaultDocument', default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CourtMarriageCase', CourtMarriageCaseSchema);
module.exports.CM_STATES = CM_STATES;
