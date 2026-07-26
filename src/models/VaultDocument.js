// @ts-check
// models/VaultDocument.js — a user-owned, encrypted-at-rest document in the vault.
//
// The BYTES live in object storage as AES-256-GCM ciphertext (see services/vault.js);
// this row holds only metadata + the pointer + the plaintext SHA-256 (integrity /
// stable fingerprint). `storageKey` and `enc` are server-only and MUST NEVER be
// serialised to a client — access is always mediated by the authenticated content
// endpoint, which decrypts for an authorised caller only.
const mongoose = require('../db/odm');

const VAULT_DOC_TYPES = ['id', 'passport', 'driving_licence', 'pan', 'aadhaar',
  'marriage_certificate', 'birth_certificate', 'degree', 'income_proof',
  'medical', 'legal', 'photo', 'other'];

const VaultDocumentSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  label: { type: String, required: true },
  docType: { type: String, enum: VAULT_DOC_TYPES, default: 'other' },
  mime: { type: String, default: 'application/octet-stream' },
  size: { type: Number, default: 0 },                 // plaintext byte length
  storageKey: { type: String, required: true },       // object key of the ENCRYPTED blob (server-only)
  evidenceHash: { type: String },                     // sha256 of PLAINTEXT — integrity + fingerprint
  enc: { algo: { type: String, default: 'aes-256-gcm' }, keyVersion: { type: String } },
  trustDecision: { type: String },                    // AAV decision at upload (reject is blocked earlier)
  status: { type: String, enum: ['active', 'deleted'], default: 'active', index: true },
  createdAt: { type: Date, default: Date.now },
  deletedAt: Date
});

module.exports = mongoose.model('VaultDocument', VaultDocumentSchema);
module.exports.VAULT_DOC_TYPES = VAULT_DOC_TYPES;
