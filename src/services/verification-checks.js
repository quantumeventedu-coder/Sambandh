// @ts-check
// services/verification-checks.js — the in-house check evaluators for the
// Verification Services product. Every check is FAIL-SECURE (defaults to
// 'unknown', never fabricates a pass) and COARSE-BY-CONSTRUCTION: a result carries
// only { name, kind, status, label } — never the subject's raw documents,
// descriptors, exact scores, report counts, or any PII. Inference checks are
// labelled kind:'inference' so a reading is never shown as a fact.
//
// No third party: identity/face/risk/conduct all come from engines Sambandh
// already runs in-house (AAV Trust Engine, face-engine, risk-engine, KarmaBook).
//
// Two invariants enforced here, demanded by the design review:
//   · A document can NEVER become a 'verified' identity fact — with no OCR we
//     cannot bind a document to a person, so document_review proves FILE
//     authenticity only and tops out at 'clear' (never 'verified').
//   · Only FACT checks that come back 'verified' can raise the verification level;
//     inferences (conduct/risk) and bounded scans (face) never do.

const trust = require('./trust');
const face = require('./face-engine');
const risk = require('./risk-engine');
const KarmaBook = require('../models/KarmaBook');
const Report = require('../models/Report');

/** Status vocabulary shared by every check:
 *  verified       — a hard, platform-established fact, confirmed (facts only)
 *  clear          — checked, no adverse signal found (not an identity assertion)
 *  unverified     — a claim exists but is NOT verified
 *  unknown        — could not be determined (the fail-secure default)
 *  flagged        — an adverse signal was found; needs the requester's attention
 *  not_applicable — deliberately not offered in this context (e.g. third-party)
 * @typedef {'verified'|'clear'|'unverified'|'unknown'|'flagged'|'not_applicable'} CheckStatus */

/** @typedef {{ name:string, kind:'fact'|'inference', status:CheckStatus, label:string }} CheckResult */

/** Every check the product can run, and the tier that unlocks it. A check's NAME
 * is also its consent-scope category — the subject consents per category. */
const CHECK_CATEGORIES = [
  'identity_authenticity', 'face_uniqueness', 'photo_authenticity',
  'claim_consistency', 'conduct_history', 'risk_assessment', 'document_review'
];

// ---- fact checks (first-party: the subject's own platform state) ------------

/** Identity is 'verified' ONLY from a real platform badge (ID > selfie). A freshly
 * uploaded document proves file authenticity (see document_review), never identity,
 * so nothing here can be laundered into 'verified'.
 * @param {any} subject @returns {CheckResult} */
function identityAuthenticity(subject) {
  const v = subject.verification || {};
  if (v.idVerified) return { name: 'identity_authenticity', kind: 'fact', status: 'verified', label: 'Government ID verified on the platform' };
  if (v.selfieVerified) return { name: 'identity_authenticity', kind: 'fact', status: 'unverified', label: 'Live selfie verified; government ID not verified' };
  return { name: 'identity_authenticity', kind: 'fact', status: 'unknown', label: 'No identity verification on record' };
}

/** A live-verified selfie pinned as the primary photo is the strongest photo signal.
 * @param {any} subject @returns {CheckResult} */
function photoAuthenticity(subject) {
  const photos = (subject.profile && subject.profile.photos) || [];
  const primary = photos.find((/** @type {any} */ p) => p.isPrimary) || photos[0];
  if (primary && primary.fromSelfie) return { name: 'photo_authenticity', kind: 'fact', status: 'verified', label: 'Primary photo is a live-verified selfie' };
  if (photos.length) return { name: 'photo_authenticity', kind: 'fact', status: 'unverified', label: 'Photos present but not from a live-verified selfie' };
  return { name: 'photo_authenticity', kind: 'fact', status: 'unknown', label: 'No photos on record' };
}

/** Are the stated profession / education claims backed by a platform verification?
 * In other-mode, a field the subject has chosen NOT to show others is omitted from
 * the check entirely (field-level visibility is honoured even under consent).
 * Labels are fixed templates — the actual title/company/degree is never echoed.
 * @param {any} subject @param {{ mode?: 'self'|'other' }} [opts] @returns {CheckResult} */
function claimConsistency(subject, opts = {}) {
  const v = subject.verification || {};
  const c = subject.claims || {};
  const prefs = subject.preferences || {};
  const showProfession = !(opts.mode === 'other' && prefs.showProfessionToOthers === false);
  let verified = 0, unverified = 0, stated = 0;
  if (showProfession && c.profession && c.profession.title) { stated++; v.professionVerified ? verified++ : unverified++; }
  if (c.education && c.education.degree) { stated++; v.educationVerified ? verified++ : unverified++; }
  if (!stated) return { name: 'claim_consistency', kind: 'fact', status: 'unknown', label: 'No shareable profession or education claims' };
  if (unverified === 0) return { name: 'claim_consistency', kind: 'fact', status: 'verified', label: 'All shareable profession/education claims are platform-verified' };
  if (verified === 0) return { name: 'claim_consistency', kind: 'fact', status: 'unverified', label: 'Profession/education claims are stated but not verified' };
  return { name: 'claim_consistency', kind: 'fact', status: 'unverified', label: 'Some claims verified, some only stated' };
}

// ---- SELF-ONLY checks (self-verification only — see verification-service.js) --
// These derive from either the subject's private safety data or platform-wide
// signals involving OTHER users, so they are NEVER sold in a third-party report.

/** Duplicate-face is a bounded scan (face-engine caps the comparison set), so a
 * no-hit result is a bounded INFERENCE, not an authoritative fact — only a hit is
 * authoritative. Never contributes to the verification level.
 * @param {any} subject @returns {Promise<CheckResult>} */
async function faceUniqueness(subject) {
  const d = subject.faceDescriptor;
  if (!face.isValidDescriptor(d)) return { name: 'face_uniqueness', kind: 'inference', status: 'unknown', label: 'No enrolled face to compare' };
  const dupes = await face.scanForDuplicateFace(subject._id, face.normalizeDescriptor(d));
  if (dupes.length) return { name: 'face_uniqueness', kind: 'inference', status: 'flagged', label: 'This face appears on more than one account' };
  return { name: 'face_uniqueness', kind: 'inference', status: 'clear', label: 'No duplicate face found among accounts scanned' };
}

/** Conduct history as a COARSE band + a safety flag. Deliberately no raw karma
 * score, no report counts, no report categories — those would over-share.
 * @param {any} subject @returns {Promise<CheckResult>} */
async function conductHistory(subject) {
  const book = await KarmaBook.findOne({ userId: subject._id });
  const score = (book && typeof book.score === 'number') ? book.score : 100;
  const criticalFraud = ((book && book.fraudFlags) || []).some((/** @type {any} */ f) => f.severity === 'critical');
  const upheld = await Report.countDocuments({
    reportedUserId: subject._id, status: 'resolved',
    action: { $in: ['warning', 'suspend_24h', 'suspend_7d', 'ban_permanent'] }
  });
  const band = score >= 85 ? 'strong' : score >= 60 ? 'fair' : 'needs attention';
  if (upheld > 0 || criticalFraud) return { name: 'conduct_history', kind: 'inference', status: 'flagged', label: `Conduct history: ${band}; a prior safety action is on record` };
  return { name: 'conduct_history', kind: 'inference', status: 'clear', label: `Conduct history: ${band}; no prior safety actions` };
}

/** Automated risk insight as a COARSE band only. The underlying reasons (device
 * clustering, photo reuse, velocity …) are internal safety signals and are NEVER
 * exposed.
 * @param {any} subject @returns {Promise<CheckResult>} */
async function riskAssessment(subject) {
  const a = await risk.assessUser(subject._id);
  if (!a) return { name: 'risk_assessment', kind: 'inference', status: 'unknown', label: 'Not enough signal for a risk insight' };
  const adverse = a.tier === 'high' || a.tier === 'critical';
  return {
    name: 'risk_assessment', kind: 'inference',
    status: adverse ? 'flagged' : 'clear',
    label: adverse ? 'Automated safety insight: elevated' : 'Automated safety insight: no elevated risk'
  };
}

/** AAV Trust Engine over freshly, consentedly-submitted documents (self-mode only).
 * This proves DOCUMENT/FILE authenticity, NOT identity — with no OCR we cannot bind
 * a document to a person, so this can never yield 'verified'. Tops out at 'clear'.
 * @param {{buf:Buffer, filename?:string}[]} freshDocs @param {any} subject @returns {Promise<CheckResult>} */
async function documentReview(freshDocs, subject) {
  if (!freshDocs || !freshDocs.length) return { name: 'document_review', kind: 'fact', status: 'unknown', label: 'No document submitted for review' };
  let anyReject = false, allAuto = true;
  for (const doc of freshDocs) {
    const t = await trust.evaluateDocument(doc.buf, { filename: doc.filename, userId: String(subject._id) });
    if (t.decision === 'reject') anyReject = true;
    if (t.decision !== 'auto') allAuto = false;
  }
  if (anyReject) return { name: 'document_review', kind: 'fact', status: 'flagged', label: 'A submitted document failed the authenticity engine' };
  if (allAuto) return { name: 'document_review', kind: 'fact', status: 'clear', label: 'Submitted document(s) passed automated authenticity (file authenticity only, not identity)' };
  return { name: 'document_review', kind: 'fact', status: 'unknown', label: 'Document authenticity could not be confirmed' };
}

/**
 * Run one named check within the granted scope. A check NOT in `scope` is skipped
 * fail-secure ('unknown', not run) — this is the per-category consent enforcement.
 * @param {string} name
 * @param {{ subject:any, scope:string[], mode?:'self'|'other', freshDocs?:{buf:Buffer,filename?:string}[] }} ctx
 * @returns {Promise<CheckResult>}
 */
async function runCheck(name, { subject, scope, mode, freshDocs }) {
  if (!scope.includes(name)) return { name, kind: 'fact', status: 'unknown', label: 'Not authorized by consent scope' };
  switch (name) {
    case 'identity_authenticity': return identityAuthenticity(subject);
    case 'face_uniqueness': return faceUniqueness(subject);
    case 'photo_authenticity': return photoAuthenticity(subject);
    case 'claim_consistency': return claimConsistency(subject, { mode });
    case 'conduct_history': return conductHistory(subject);
    case 'risk_assessment': return riskAssessment(subject);
    case 'document_review': return documentReview(freshDocs || [], subject);
    default: return { name, kind: 'fact', status: 'unknown', label: 'Unknown check' };
  }
}

/** The overall verification level, derived ONLY from hard FACT checks that came
 * back 'verified' — inferences (conduct/risk/face) and 'clear' facts never raise it.
 * @param {CheckResult[]} results */
function verifiedLevel(results) {
  const factVerified = new Set(results.filter(r => r.kind === 'fact' && r.status === 'verified').map(r => r.name));
  const anyFlagged = results.some(r => r.status === 'flagged');
  if (anyFlagged) return 'attention';
  if (factVerified.has('identity_authenticity') && factVerified.has('claim_consistency')) return 'strong';
  if (factVerified.has('identity_authenticity') || factVerified.has('photo_authenticity')) return 'basic';
  return 'unverified';
}

module.exports = {
  CHECK_CATEGORIES, runCheck, verifiedLevel,
  // exported for unit tests
  identityAuthenticity, faceUniqueness, photoAuthenticity, claimConsistency,
  conductHistory, riskAssessment, documentReview
};
