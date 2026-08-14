// @ts-check
// services/vault.js — the encrypted document vault.
//
// Documents are encrypted with AES-256-GCM (node:crypto — in-house, no third party)
// BEFORE they touch object storage, so the stored blob is ciphertext even though the
// storage bucket is public. Plaintext is only ever produced server-side, for an
// authorised caller, by the content endpoint. Every upload is scanned by the AAV
// Trust Engine first, so a malicious / unsupported file is never stored.
//
// Blob layout: iv(12) || authTag(16) || ciphertext. GCM authenticates the ciphertext
// (tamper → decrypt throws); the stored plaintext SHA-256 is a second integrity check.
//
// Key: a dedicated 32-byte VAULT_KEY (64 hex) if set; otherwise derived deterministically
// from JWT_SECRET via scrypt. `enc.keyVersion` records which, so keys can be rotated
// without losing the ability to read older documents.

const crypto = require('crypto');
const storage = require('./storage');
const trust = require('./trust');
const VaultDocument = require('../models/VaultDocument');
const VaultShare = require('../models/VaultShare');
const AuditLog = require('../models/AuditLog');

const MAX_BYTES = 12 * 1024 * 1024;   // aligns with file-guard's cap
/** @type {Record<string,string>} */
const MIME_FOR = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' };
// A scrypt salt is a PUBLIC key-derivation parameter, not a secret — it fixes the
// derived key so documents stay decryptable. Not a credential.
const KDF_SALT = 'sambandh-vault-v1'; // gitleaks:allow (public scrypt salt, not a secret)

/** The key to encrypt NEW documents with (prefers a dedicated VAULT_KEY). @returns {{ key:Buffer, version:string }} */
function currentKeyInfo() {
  const hex = process.env.VAULT_KEY;
  if (hex && /^[0-9a-fA-F]{64}$/.test(hex)) return { key: Buffer.from(hex, 'hex'), version: 'env-v1' };
  const secret = process.env.JWT_SECRET || 'sambandh-dev-secret';
  return { key: crypto.scryptSync(secret, KDF_SALT, 32), version: 'jwt-v1' };
}

/** Resolve the key a document was ENCRYPTED under, by its stored keyVersion — so
 * introducing or rotating VAULT_KEY never orphans older documents. A blob with no
 * recorded version is legacy jwt-v1. @param {string} [version] @returns {Buffer} */
function keyForVersion(version) {
  if (version === 'env-v1') {
    const hex = process.env.VAULT_KEY;
    if (hex && /^[0-9a-fA-F]{64}$/.test(hex)) return Buffer.from(hex, 'hex');
    throw new Error('VAULT_KEY is required to read this document but is not set');
  }
  const secret = process.env.JWT_SECRET || 'sambandh-dev-secret';
  return crypto.scryptSync(secret, KDF_SALT, 32);   // jwt-v1 / legacy
}

/** @param {Buffer} buf @returns {{ blob:Buffer, keyVersion:string }} */
function encrypt(buf) {
  const { key, version } = currentKeyInfo();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(buf), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { blob: Buffer.concat([iv, tag, ct]), keyVersion: version };
}

/** Decrypt using the key that matches the blob's stored version. A GCM auth-tag
 * failure (tamper / wrong key) is normalised so the route returns 422, not 500.
 * @param {Buffer} blob @param {string} [keyVersion] @returns {Buffer} */
function decrypt(blob, keyVersion) {
  if (!Buffer.isBuffer(blob) || blob.length < 28) throw new Error('Corrupt vault blob');
  const key = keyForVersion(keyVersion || 'jwt-v1');
  const iv = blob.subarray(0, 12), tag = blob.subarray(12, 28), ct = blob.subarray(28);
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]);
  } catch { throw new Error('Integrity check failed'); }
}

/** @param {any} actor @param {string} action @param {any} targetId @param {any} detail */
async function audit(actor, action, targetId, detail) {
  try { await AuditLog.create({ actor: String(actor), action, targetType: 'vault_document', targetId: String(targetId), detail }); }
  catch { /* audit must never break the operation */ }
}

/**
 * Store a document: AAV-scan → reject unsafe/unsupported → hash → encrypt → upload
 * ciphertext under a random key → persist metadata. Returns the metadata row (no bytes).
 * @param {{ ownerId:any, buf:Buffer, mime?:string, label:string, docType?:string }} args
 */
async function storeDocument({ ownerId, buf, mime, label, docType }) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) throw new Error('Empty document');
  if (buf.length > MAX_BYTES) throw new Error('Document too large (max 12 MB)');
  const t = await trust.evaluateDocument(buf, { userId: String(ownerId), filename: label });
  if (t.decision === 'reject') throw new Error('Only image or PDF documents are accepted, and the file failed the security scan');

  const evidenceHash = crypto.createHash('sha256').update(buf).digest('hex');
  const { blob, keyVersion } = encrypt(buf);
  const storageKey = `vault/${ownerId}/${crypto.randomBytes(16).toString('hex')}.enc`;
  await storage.uploadFile(storageKey, blob, 'application/octet-stream');

  const doc = await VaultDocument.create({
    ownerId, label: String(label || 'Untitled').slice(0, 200), docType: docType || 'other',
    // Prefer the AAV-DETECTED type over any client-claimed mime — the content
    // endpoint serves with this, so a client can't induce content-type confusion.
    mime: (t.fileType && MIME_FOR[t.fileType]) || mime || 'application/octet-stream',
    size: buf.length, storageKey, evidenceHash,
    enc: { algo: 'aes-256-gcm', keyVersion }, trustDecision: t.decision,
    status: 'active', createdAt: new Date()
  });
  await audit(ownerId, 'vault_stored', doc._id, { docType: doc.docType, size: doc.size });
  return doc;
}

/** May this user READ this vault document? Owner always; an active, unexpired grantee share
 * otherwise. (Named distinctly from entitlements.canAccess — a different concept entirely.)
 * @param {any} doc @param {any} userId */
async function userCanReadDoc(doc, userId) {
  if (String(doc.ownerId) === String(userId)) return true;
  const share = await VaultShare.findOne({ documentId: doc._id, granteeId: userId, status: 'active' });
  if (!share) return false;
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) return false;
  return true;
}

/** Decrypt and return the plaintext for an authorised caller. Verifies integrity twice
 * (GCM tag + plaintext hash). @param {{ doc:any, requesterId:any }} args */
async function getContent({ doc, requesterId }) {
  if (!doc || doc.status !== 'active') throw new Error('Document not found');
  if (!(await userCanReadDoc(doc, requesterId))) throw new Error('Not authorized');
  const blob = await storage.readFile(doc.storageKey);
  const buf = decrypt(blob, doc.enc && doc.enc.keyVersion);
  if (doc.evidenceHash && crypto.createHash('sha256').update(buf).digest('hex') !== doc.evidenceHash) {
    throw new Error('Integrity check failed');
  }
  return { buf, mime: doc.mime };
}

/** Owner grants a grantee read access (revocable, optionally time-boxed).
 * @param {{ doc:any, ownerId:any, granteeId:any, expiresAt?:string }} args */
async function shareDocument({ doc, ownerId, granteeId, expiresAt }) {
  if (String(doc.ownerId) !== String(ownerId)) throw new Error('Not your document');
  if (String(granteeId) === String(ownerId)) throw new Error('Cannot share with yourself');
  const User = require('../models/User');
  if (!(await User.findById(granteeId))) throw new Error('Recipient not found');
  const exp = expiresAt ? new Date(expiresAt) : null;
  const existing = await VaultShare.findOne({ documentId: doc._id, granteeId });
  if (existing) {
    const updated = await VaultShare.findByIdAndUpdate(existing._id,
      { status: 'active', revokedAt: null, expiresAt: exp, createdAt: new Date() }, { new: true });
    await audit(ownerId, 'vault_shared', doc._id, { granteeId: String(granteeId), renewed: true });
    return updated;
  }
  const share = await VaultShare.create({ documentId: doc._id, ownerId, granteeId, status: 'active', expiresAt: exp, createdAt: new Date() });
  await audit(ownerId, 'vault_shared', doc._id, { granteeId: String(granteeId) });
  return share;
}

/** @param {{ shareId:any, ownerId:any }} args */
async function revokeShare({ shareId, ownerId }) {
  const share = await VaultShare.findById(shareId);
  if (!share || String(share.ownerId) !== String(ownerId)) throw new Error('Share not found');
  const updated = await VaultShare.findByIdAndUpdate(share._id, { status: 'revoked', revokedAt: new Date() }, { new: true });
  await audit(ownerId, 'vault_share_revoked', share.documentId, { shareId: String(shareId) });
  return updated;
}

/** Soft-delete the row, revoke every share, and best-effort hard-delete the ciphertext.
 * @param {{ doc:any, ownerId:any }} args */
async function deleteDocument({ doc, ownerId }) {
  if (String(doc.ownerId) !== String(ownerId)) throw new Error('Not your document');
  await VaultDocument.findByIdAndUpdate(doc._id, { status: 'deleted', deletedAt: new Date() });
  await VaultShare.updateMany({ documentId: doc._id, status: 'active' }, { $set: { status: 'revoked', revokedAt: new Date() } });
  await storage.deleteFile(doc.storageKey);
  await audit(ownerId, 'vault_deleted', doc._id, {});
  return true;
}

module.exports = {
  MAX_BYTES, storeDocument, getContent, userCanReadDoc, shareDocument, revokeShare, deleteDocument,
  encrypt, decrypt   // exported for unit tests
};
