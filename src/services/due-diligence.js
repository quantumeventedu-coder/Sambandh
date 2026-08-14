// @ts-check
// services/due-diligence.js — consent-gated, subject-curated trust dossier.
//
// Reuses the primitives rather than re-implementing them: consent gating + the
// mutual-match/block gates from verification-service, the fail-secure FIRST-PARTY
// check evaluators from verification-checks, and the vault for the subject's shared
// documents. Free (no payment). The dossier NEVER contains self-only/other-derived
// safety signals — only the subject's own first-party facts + what they choose to
// share. Revoking cuts off access and revokes every document share.

const market = require('./marketplace');            // atomicUpdate primitive (CAS)
const { bestEffort } = require('./best-effort');
const checks = require('./verification-checks');
const vault = require('./vault');
const vsvc = require('./verification-service');      // reuse sharesActiveMatch / blockedBetween
const Consent = require('../models/Consent');
const DueDiligenceCase = require('../models/DueDiligenceCase');
const User = require('../models/User');
const VaultDocument = require('../models/VaultDocument');

const OPEN = ['pending', 'active'];
const COOLDOWN_DAYS = 7;              // after a denial/revocation, before re-requesting the same person
const MAX_REQUESTS_PER_DAY = 5;      // per requester, anti-spam
const FIRST_PARTY = ['identity_authenticity', 'photo_authenticity', 'claim_consistency'];
const DISCLAIMER = 'Shared with the subject\'s consent and revocable at any time. Verification items are point-in-time platform signals; documents are provided by the subject. This is not a background check, a criminal-record search, or a judgement of character.';
/** @param {any} r */
const coarse = (r) => ({ name: r.name, kind: r.kind, status: r.status, label: r.label });

/** @param {{ requesterId:any, subjectId:any }} a */
async function requestDossier({ requesterId, subjectId }) {
  if (String(requesterId) === String(subjectId)) throw new Error('You cannot run due diligence on yourself');
  const subject = await User.findById(subjectId);
  if (!subject) throw new Error('Subject not found');
  if (!(await vsvc.sharesActiveMatch(requesterId, subjectId))) throw new Error('You can request a dossier only from an active mutual match');
  const open = await DueDiligenceCase.findOne({ requesterId, subjectId, status: { $in: OPEN } });
  if (open) throw new Error('You already have an open dossier request for this person');
  const recent = await DueDiligenceCase.findOne({
    requesterId, subjectId, status: { $in: ['declined', 'revoked'] },
    createdAt: { $gt: new Date(Date.now() - COOLDOWN_DAYS * 86400000) }
  });
  if (recent) throw new Error('A recent dossier request to this person was closed. Please try again later.');
  const dayCount = await DueDiligenceCase.countDocuments({ requesterId, createdAt: { $gt: new Date(Date.now() - 86400000) } });
  if (dayCount >= MAX_REQUESTS_PER_DAY) throw new Error('Daily dossier-request limit reached. Please try again tomorrow.');
  const kase = await DueDiligenceCase.create({ requesterId, subjectId, status: 'pending', sharedDocs: [], createdAt: new Date() });
  const consent = await Consent.create({ subjectId, requesterId, purpose: 'due_diligence', scope: ['verification', 'documents'], caseId: kase._id, status: 'pending', createdAt: new Date() });
  await DueDiligenceCase.findByIdAndUpdate(kase._id, { consentId: consent._id });
  kase.consentId = consent._id;
  return { case: kase, consent };
}

/** Subject grants or denies. @param {{ kase:any, subjectId:any, decision:'granted'|'denied' }} a */
async function decide({ kase, subjectId, decision }) {
  if (String(kase.subjectId) !== String(subjectId)) throw new Error('Not your request');
  const c = kase.consentId ? await Consent.findById(kase.consentId) : null;
  if (!c || c.purpose !== 'due_diligence') throw new Error('Request not found');
  const won = await market.atomicUpdate(Consent, { _id: c._id, status: 'pending' }, { $set: { status: decision, decidedAt: new Date() } });
  if (!won) return await DueDiligenceCase.findById(kase._id);
  await market.atomicUpdate(DueDiligenceCase, { _id: kase._id, status: 'pending' }, { $set: { status: decision === 'granted' ? 'active' : 'declined' } });
  return await DueDiligenceCase.findById(kase._id);
}

/** Subject withdraws — revokes consent, the case, and every document share. @param {{ kase:any, subjectId:any }} a */
async function revoke({ kase, subjectId }) {
  if (String(kase.subjectId) !== String(subjectId)) throw new Error('Not your request');
  const c = kase.consentId ? await Consent.findById(kase.consentId) : null;
  if (!c || !['pending', 'granted'].includes(c.status)) throw new Error('Consent is not active');
  await market.atomicUpdate(Consent, { _id: c._id }, { $set: { status: 'revoked', revokedAt: new Date() } });
  for (const sd of (kase.sharedDocs || [])) {
    if (sd.shareId) await bestEffort(vault.revokeShare({ shareId: sd.shareId, ownerId: subjectId }), { op: 'due-diligence:revoke-vault-share', ownerId: String(subjectId) });
  }
  await market.atomicUpdate(DueDiligenceCase, { _id: kase._id }, { $set: { status: 'revoked', revokedAt: new Date() } });
  return await DueDiligenceCase.findById(kase._id);
}

/** Subject adds one of their vault documents to the dossier (shared to the requester).
 * @param {{ kase:any, subjectId:any, vaultDocumentId:any }} a */
async function shareDocument({ kase, subjectId, vaultDocumentId }) {
  if (String(kase.subjectId) !== String(subjectId)) throw new Error('Only the subject can add documents');
  if (kase.status !== 'active') throw new Error('The dossier is not active');
  const doc = await VaultDocument.findById(vaultDocumentId);
  if (!doc || doc.status !== 'active' || String(doc.ownerId) !== String(subjectId)) throw new Error('Vault document not found');
  const share = await vault.shareDocument({ doc, ownerId: subjectId, granteeId: kase.requesterId });
  await DueDiligenceCase.findByIdAndUpdate(kase._id, { $push: { sharedDocs: { vaultDocumentId: doc._id, shareId: share._id, sharedAt: new Date() } } });
  return await DueDiligenceCase.findById(kase._id);
}

/** May the requester view the compiled dossier right now? @param {any} kase */
async function canView(kase) {
  if (kase.status !== 'active') return false;
  const c = kase.consentId ? await Consent.findById(kase.consentId) : null;
  if (!(c && c.status === 'granted')) return false;
  if (await vsvc.blockedBetween(kase.requesterId, kase.subjectId)) return false;   // a block cuts off access
  return true;
}

/** Compile the coarse dossier — first-party verification + subject-shared documents. @param {any} kase */
async function compile(kase) {
  const subject = await User.findById(kase.subjectId);
  const results = [];
  for (const name of FIRST_PARTY) results.push(coarse(await checks.runCheck(name, { subject, scope: FIRST_PARTY, mode: 'other' })));
  const docs = await VaultDocument.find({ _id: { $in: (kase.sharedDocs || []).map((/** @type {any} */ s) => s.vaultDocumentId) }, status: 'active' }).lean();
  return {
    verification: {
      verifiedLevel: checks.verifiedLevel(results),
      trustLevel: (subject && subject.verification && subject.verification.level) || 'phone_only',
      checks: results
    },
    documents: docs.map((/** @type {any} */ d) => ({ id: d._id, label: d.label, docType: d.docType, mime: d.mime, evidenceHash: d.evidenceHash })),
    disclaimer: DISCLAIMER
  };
}

module.exports = { requestDossier, decide, revoke, shareDocument, canView, compile, OPEN, FIRST_PARTY };
