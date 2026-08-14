// @ts-check
// services/court-marriage.js — the court-marriage assistant workflow.
//
// A FAIL-CLOSED state machine over a two-partner case. One partner proposes; the
// other must accept (mutual consent) before anything proceeds. Documents are pulled
// from each partner's vault and SHARED to the other (so both can see them). The
// Special Marriage Act's 30-day notice period is tracked and enforced — the case
// cannot be cleared for solemnisation until it has genuinely elapsed. Guidance only;
// no government filing, no third party (see data/court-marriage.js).

const market = require('./marketplace');            // atomicUpdate primitive (CAS)
const { bestEffort } = require('./best-effort');
const ref = require('../data/court-marriage');
const CourtMarriageCase = require('../models/CourtMarriageCase');

const OPEN_STATES = ['proposed', 'active', 'notice_period', 'objection_raised', 'clear_to_solemnize', 'solemnized'];
const TERMINAL = ['declined', 'cancelled', 'certificate_issued'];
const COOLDOWN_DAYS = 3;              // after a decline/cancel, before re-proposing to the same person
const MAX_PROPOSALS_PER_DAY = 5;      // per initiator, anti-spam

const isParticipant = (/** @type {any} */ k, /** @type {any} */ u) => String(k.initiatorId) === String(u) || String(k.partnerId) === String(u);
const otherParty = (/** @type {any} */ k, /** @type {any} */ u) => (String(k.initiatorId) === String(u) ? k.partnerId : k.initiatorId);

/** Fail-closed transition: only the mover that still sees `from` wins.
 * @param {any} caseId @param {string} from @param {Record<string,any>} set */
async function cas(caseId, from, set) {
  const won = await market.atomicUpdate(CourtMarriageCase, { _id: caseId, status: from }, { $set: { ...set, updatedAt: new Date() } });
  if (!won) throw new Error('The case changed before this action could apply');
  return won;
}

/** Checklist progress: perPartner docs need one from EACH partner; others need one.
 * @param {any} kase */
function documentProgress(kase) {
  const refs = ref.REQUIRED_DOCUMENTS[kase.act] || [];
  /** @type {Record<string, Set<string>>} */ const byReq = {};
  for (const a of (kase.documents || [])) (byReq[a.requirementKey] = byReq[a.requirementKey] || new Set()).add(String(a.byUserId));
  const items = refs.filter((d) => !d.conditional).map((d) => {
    const who = byReq[d.key] || new Set();
    const done = d.perPartner ? (who.has(String(kase.initiatorId)) && who.has(String(kase.partnerId))) : who.size >= 1;
    return { key: d.key, label: d.label, perPartner: d.perPartner, done };
  });
  return { complete: items.every((i) => i.done), items };
}
const allDocsComplete = (/** @type {any} */ k) => documentProgress(k).complete;

/** @param {{ initiatorId:any, partnerId:any, act:string, state?:string }} args */
async function proposeCase({ initiatorId, partnerId, act, state }) {
  if (!ref.isAct(act)) throw new Error('Unknown marriage act');
  if (String(partnerId) === String(initiatorId)) throw new Error('You cannot start a case with yourself');
  const User = require('../models/User');
  if (!(await User.findById(partnerId))) throw new Error('Partner not found');
  // Anti-harassment: only an ACTIVE mutual match (no block either way) can be proposed
  // to — reuses the same gate the verification/due-diligence verticals use.
  if (!(await require('./verification-service').sharesActiveMatch(initiatorId, partnerId))) {
    throw new Error('You can propose a court marriage only to an active mutual match');
  }
  const open = await CourtMarriageCase.findOne({
    $or: [{ initiatorId, partnerId }, { initiatorId: partnerId, partnerId: initiatorId }],
    status: { $in: OPEN_STATES }
  });
  if (open) throw new Error('There is already an open court-marriage case between you two');
  const recent = await CourtMarriageCase.findOne({
    initiatorId, partnerId, status: { $in: ['declined', 'cancelled'] },
    createdAt: { $gt: new Date(Date.now() - COOLDOWN_DAYS * 86400000) }
  });
  if (recent) throw new Error('A recent court-marriage proposal to this person was closed. Please try again later.');
  const dayCount = await CourtMarriageCase.countDocuments({ initiatorId, createdAt: { $gt: new Date(Date.now() - 86400000) } });
  if (dayCount >= MAX_PROPOSALS_PER_DAY) throw new Error('Daily proposal limit reached. Please try again tomorrow.');
  return CourtMarriageCase.create({ initiatorId, partnerId, act, state: state || null, status: 'proposed', createdAt: new Date(), updatedAt: new Date() });
}

/** @param {{ kase:any, userId:any }} a */
async function acceptCase({ kase, userId }) {
  if (String(kase.partnerId) !== String(userId)) throw new Error('Only the invited partner can accept');
  return cas(kase._id, 'proposed', { status: 'active' });
}
/** @param {{ kase:any, userId:any }} a */
async function declineCase({ kase, userId }) {
  if (String(kase.partnerId) !== String(userId)) throw new Error('Only the invited partner can decline');
  return cas(kase._id, 'proposed', { status: 'declined' });
}

/** Attach a vault document (owned by the caller) and share it to the other partner.
 * @param {{ kase:any, userId:any, requirementKey:string, vaultDocumentId:any }} a */
async function attachDocument({ kase, userId, requirementKey, vaultDocumentId }) {
  if (!isParticipant(kase, userId)) throw new Error('Not your case');
  if (kase.status !== 'active') throw new Error('Documents can be attached only while the case is active');
  if (!(ref.REQUIRED_DOCUMENTS[kase.act] || []).some((d) => d.key === requirementKey)) throw new Error('Unknown document requirement');
  const VaultDocument = require('../models/VaultDocument');
  const doc = await VaultDocument.findById(vaultDocumentId);
  if (!doc || doc.status !== 'active' || String(doc.ownerId) !== String(userId)) throw new Error('Vault document not found');
  const share = await require('./vault').shareDocument({ doc, ownerId: userId, granteeId: otherParty(kase, userId) });
  await CourtMarriageCase.findByIdAndUpdate(kase._id, {
    $push: { documents: { requirementKey, vaultDocumentId: doc._id, byUserId: userId, shareId: share._id, attachedAt: new Date() } },
    $set: { updatedAt: new Date() }
  });
  return await CourtMarriageCase.findById(kase._id);
}

/** @param {{ kase:any, userId:any, name:string }} a */
async function addWitness({ kase, userId, name }) {
  if (!isParticipant(kase, userId)) throw new Error('Not your case');
  if (!name || !String(name).trim()) throw new Error('Witness name is required');
  await CourtMarriageCase.findByIdAndUpdate(kase._id, {
    $push: { witnesses: { name: String(name).slice(0, 120), addedBy: userId, addedAt: new Date() } },
    $set: { updatedAt: new Date() }
  });
  return await CourtMarriageCase.findById(kase._id);
}

/** File the statutory notice (Special Marriage Act) — starts the 30-day clock. The
 * clock is anchored to SERVER time, never a client-supplied date, so the mandatory
 * period cannot be backdated away. @param {{ kase:any, userId:any }} a */
async function fileNotice({ kase, userId }) {
  if (!isParticipant(kase, userId)) throw new Error('Not your case');
  if (kase.act !== 'special_marriage') throw new Error('A notice period applies only to Special Marriage Act cases');
  if (kase.status !== 'active') throw new Error('The case is not ready to file notice');
  if (!allDocsComplete(kase)) throw new Error('Attach all required documents before filing notice');
  const filed = new Date();
  const ends = new Date(filed.getTime() + ref.NOTICE_PERIOD_DAYS.special_marriage * 86400000);
  return cas(kase._id, 'active', { status: 'notice_period', noticeFiledAt: filed, noticePeriodEndsAt: ends });
}

/** Clear the case for solemnisation. SMA: notice period must have elapsed with no
 * open objection. HMA: documents must be complete. @param {{ kase:any, userId:any }} a */
async function clearToSolemnize({ kase, userId }) {
  if (!isParticipant(kase, userId)) throw new Error('Not your case');
  if (kase.act === 'special_marriage') {
    if (kase.status !== 'notice_period') throw new Error('File the notice and complete the notice period first');
    if (!kase.noticePeriodEndsAt || new Date(kase.noticePeriodEndsAt) > new Date()) throw new Error('The 30-day notice period has not elapsed yet');
    return cas(kase._id, 'notice_period', { status: 'clear_to_solemnize' });
  }
  if (kase.status !== 'active') throw new Error('The case is not active');
  if (!allDocsComplete(kase)) throw new Error('Attach all required documents first');
  return cas(kase._id, 'active', { status: 'clear_to_solemnize' });
}

/** @param {{ kase:any, userId:any, reason?:string }} a */
async function raiseObjection({ kase, userId, reason }) {
  if (!isParticipant(kase, userId)) throw new Error('Not your case');
  if (kase.status !== 'notice_period') throw new Error('Objections apply only during the notice period');
  return cas(kase._id, 'notice_period', { status: 'objection_raised', objection: { reason: String(reason || 'unspecified').slice(0, 500), raisedAt: new Date() } });
}
/** @param {{ kase:any, userId:any }} a */
async function resolveObjection({ kase, userId }) {
  if (!isParticipant(kase, userId)) throw new Error('Not your case');
  if (kase.status !== 'objection_raised') throw new Error('There is no objection to resolve');
  const prev = kase.objection || {};
  return cas(kase._id, 'objection_raised', { status: 'notice_period', objection: { reason: prev.reason, raisedAt: prev.raisedAt, resolvedAt: new Date() } });
}

/** @param {{ kase:any, userId:any }} a */
async function markSolemnized({ kase, userId }) {
  if (!isParticipant(kase, userId)) throw new Error('Not your case');
  if (kase.status !== 'clear_to_solemnize') throw new Error('The case is not cleared for solemnisation');
  const need = ref.WITNESSES_REQUIRED[kase.act];
  if ((kase.witnesses || []).length < need) throw new Error(`At least ${need} witnesses are required`);
  return cas(kase._id, 'clear_to_solemnize', { status: 'solemnized', solemnizedAt: new Date() });
}

/** Record the issued marriage certificate (a vault doc, shared to the partner).
 * @param {{ kase:any, userId:any, vaultDocumentId:any }} a */
async function issueCertificate({ kase, userId, vaultDocumentId }) {
  if (!isParticipant(kase, userId)) throw new Error('Not your case');
  if (kase.status !== 'solemnized') throw new Error('The marriage must be solemnised first');
  const VaultDocument = require('../models/VaultDocument');
  const doc = await VaultDocument.findById(vaultDocumentId);
  if (!doc || doc.status !== 'active' || String(doc.ownerId) !== String(userId)) throw new Error('Vault document not found');
  await require('./vault').shareDocument({ doc, ownerId: userId, granteeId: otherParty(kase, userId) });
  return cas(kase._id, 'solemnized', { status: 'certificate_issued', certificateDocumentId: doc._id });
}

/** Withdraw the vault document shares this case created (best-effort). @param {any} kase */
async function revokeCaseShares(kase) {
  const vault = require('./vault');
  for (const d of (kase.documents || [])) {
    if (d.shareId && d.byUserId) await bestEffort(vault.revokeShare({ shareId: d.shareId, ownerId: d.byUserId }), { op: 'court-marriage:revoke-vault-share', ownerId: String(d.byUserId) });
  }
}

/** @param {{ kase:any, userId:any }} a */
async function cancelCase({ kase, userId }) {
  if (!isParticipant(kase, userId)) throw new Error('Not your case');
  if (TERMINAL.includes(kase.status)) throw new Error('This case is already closed');
  const won = await cas(kase._id, kase.status, { status: 'cancelled' });
  await revokeCaseShares(kase);   // a cancelled case must not leave the ex-partner read access
  return won;
}

module.exports = {
  OPEN_STATES, TERMINAL, isParticipant, documentProgress,
  proposeCase, acceptCase, declineCase, attachDocument, addWitness,
  fileNotice, clearToSolemnize, raiseObjection, resolveObjection,
  markSolemnized, issueCertificate, cancelCase
};
