// @ts-check
// models/VaultShare.js — an owner's revocable grant of read access to ONE vault
// document to ONE other user. The owner is always the grantor (it is their own
// data); a grant is `active` until the owner revokes it or it expires. Access is
// the ONLY thing a share confers — never write/delete/re-share.
const mongoose = require('../db/odm');

const VAULT_SHARE_STATES = ['active', 'revoked'];

const VaultShareSchema = new mongoose.Schema({
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'VaultDocument', required: true, index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  granteeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: VAULT_SHARE_STATES, default: 'active', index: true },
  expiresAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  revokedAt: Date
});

module.exports = mongoose.model('VaultShare', VaultShareSchema);
module.exports.VAULT_SHARE_STATES = VAULT_SHARE_STATES;
