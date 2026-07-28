// @ts-check
// services/doc-retention.js — HARD-DELETE stored verification-document originals.
//
// The privacy promise is "your ID document is auto-deleted after 30 days". The old cron only
// `fs.unlink`ed the LOCAL uploads dir — in production the originals live in Supabase Storage,
// so nothing was actually deleted. This deletes the real objects (cloud OR local) when a
// verification passes its retention window, and when an account is erased, then strips the
// URLs from the record so no reference to the original remains.

const Verification = require('../models/Verification');
const storage = require('./storage');

/** The bucket-relative object key for a stored document — prefer the persisted `key`, else
 * parse it out of the URL (public/authenticated Supabase URL, or a local /uploads/ path).
 * @param {any} doc @returns {string|null} */
function keyOf(doc) {
  if (doc && doc.key) return doc.key;
  const u = String((doc && doc.url) || '');
  const m = u.match(/\/object\/(?:public|authenticated|sign)\/[^/]+\/(.+?)(?:\?|$)/) || u.match(/\/uploads\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Hard-delete every stored object referenced by these documents. Returns how many were
 * deleted. Best-effort per object (a failed delete doesn't stop the rest). @param {any[]} docs */
async function deleteDocs(docs) {
  let n = 0;
  for (const d of (docs || [])) {
    const k = keyOf(d);
    if (k && await storage.deleteFile(k)) n++;
  }
  return n;
}

/**
 * Purge document ORIGINALS for verifications past their `expiresAt` (the 30-day window set at
 * submission). Deletes the stored objects and clears the URLs; the verification record itself
 * (decision, audit fields) is kept — only the raw document is removed.
 * @param {Date} [now] @returns {Promise<{ records:number, files:number }>}
 */
async function purgeExpiredDocuments(now = new Date()) {
  const expired = await Verification.find({ expiresAt: { $lt: now } }).limit(2000);
  let records = 0, files = 0;
  for (const v of expired) {
    if (!v.documents || !v.documents.length) continue;        // nothing to purge (already done)
    files += await deleteDocs(v.documents);
    await Verification.findByIdAndUpdate(v._id, { $set: { documents: [], documentsPurgedAt: now } });
    records++;
  }
  return { records, files };
}

/**
 * Delete ALL stored document originals for a user (used when an account is erased — the DB
 * rows are removed elsewhere; this removes the image files they pointed to).
 * @param {any} userId @returns {Promise<number>} number of objects deleted
 */
async function purgeUserDocuments(userId) {
  const vs = await Verification.find({ userId });
  let files = 0;
  for (const v of vs) files += await deleteDocs(v.documents);
  return files;
}

module.exports = { purgeExpiredDocuments, purgeUserDocuments, keyOf, deleteDocs };
