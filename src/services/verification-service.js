// @ts-check
// services/verification-service.js — consent-gated Verification Services orchestrator.
//
// A requester buys a tier of verification about a subject (themselves, or — with the
// subject's explicit, revocable Consent — an active mutual match). Platform-fulfilled:
// checks run on in-house engines (verification-checks.js); money rides the existing
// Payment rail; no partner, no escrow, no third party.
//
// The invariants (each traces to the pre-build adversarial design review):
//  · `mode` is DERIVED server-side from the identities, never taken from the client.
//  · Nothing runs until the case is PAID and consent is SATISFIED; other-mode consent
//    is re-verified INSIDE the atomic pending→processing transition, before any
//    subject data is read, bound strictly to the case's own Consent + scope.
//  · Completion and revocation contend on ONE field: the completion write is a CAS on
//    { status:'processing', subjectConsentRevoked:false } — a mid-run revoke makes it
//    match nothing, so the report is discarded and the revoke path owns the refund.
//  · Reports are COARSE at the persistence boundary ({name,kind,status,label} only) —
//    no raw scores, counts, reasons, documents or PII are ever stored or served.
//  · Third-party-derived safety signals (face-dup / conduct / risk) are SELF-ONLY and
//    never sold in an other-mode report.
//  · Payments are case-bound, purpose/amount-pinned, single-use; refunds are idempotent.

const crypto = require('crypto');
const market = require('./marketplace');            // atomicUpdate primitive (CAS)
const checkEngine = require('./verification-checks');
const VerificationCase = require('../models/VerificationCase');
const Consent = require('../models/Consent');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Chat = require('../models/Chat');

// First-party checks read ONLY the subject's own platform state → sharable with a
// consenting match. Self-only checks derive from the subject's private safety data or
// from signals involving OTHER users → never sold in a third-party report.
const FIRST_PARTY = ['identity_authenticity', 'photo_authenticity', 'claim_consistency'];
const SELF_ONLY = ['face_uniqueness', 'conduct_history', 'risk_assessment', 'document_review'];

/** Tiers: direct CHF price + the ordered check-set each unlocks.
 * @type {Record<string, { priceCHF:number, checks:string[] }>} */
const TIERS = {
  dating_lite: { priceCHF: 5, checks: ['identity_authenticity', 'face_uniqueness', 'photo_authenticity'] },
  pre_marital: { priceCHF: 19, checks: ['identity_authenticity', 'face_uniqueness', 'photo_authenticity', 'claim_consistency', 'conduct_history', 'risk_assessment'] },
  post_marital: { priceCHF: 39, checks: ['identity_authenticity', 'face_uniqueness', 'photo_authenticity', 'claim_consistency', 'conduct_history', 'risk_assessment', 'document_review'] }
};

const COOLDOWN_DAYS = 14;        // after a decline, the requester waits before re-asking
const MAX_CASES_PER_DAY = 10;    // per requester, anti-spam
const CONSENT_TTL_DAYS = 30;     // an unactioned/other-mode grant expires
// A server-side secret so evidenceHash cannot be brute-forced back to inputs; never sent to a client.
const PEPPER = process.env.EVIDENCE_PEPPER || process.env.JWT_SECRET || 'sambandh-evidence-pepper';
const DISCLAIMER = 'This report reflects platform records at the time shown and is shared with the subject\'s consent. Items marked as an insight are automated inferences, not verified facts. It is not a background check, a criminal-record search, or a judgement of character.';

const isTier = (/** @type {string} */ t) => Object.prototype.hasOwnProperty.call(TIERS, t);
const priceForTier = (/** @type {string} */ t) => (TIERS[t] ? TIERS[t].priceCHF : null);
const paymentRail = () => /** @type {any} */ (require('../routes-payment'));
/** Whitelist a check result to the only four fields we ever persist or serve.
 * @param {any} r */
const coarse = (r) => ({ name: r.name, kind: r.kind, status: r.status, label: r.label });

// ---- relationship / block gates -------------------------------------------

/** True if either party has blocked the other, or their shared chat is blocked.
 * @param {any} a @param {any} b */
async function blockedBetween(a, b) {
  const [ua, ub] = await Promise.all([User.findById(a), User.findById(b)]);
  const inList = (/** @type {any} */ u, /** @type {any} */ id) => Array.isArray(u && u.blockedUsers) && u.blockedUsers.some((/** @type {any} */ x) => String(x) === String(id));
  if (inList(ua, b) || inList(ub, a)) return true;
  const chat = await Chat.findOne({ participants: { $all: [a, b] } });
  return !!(chat && chat.status === 'blocked');
}

/** True if the pair are an ACTIVE mutual match (a shared, non-blocked chat) and not blocked.
 * @param {any} a @param {any} b */
async function sharesActiveMatch(a, b) {
  if (await blockedBetween(a, b)) return false;
  const chat = await Chat.findOne({ participants: { $all: [a, b] }, status: { $ne: 'blocked' } });
  return !!chat;
}

// ---- consent evaluation ----------------------------------------------------

/** Is the case authorized to run right now? self-mode requires subject===requester;
 * other-mode requires the case's OWN granted, unexpired, unrevoked Consent whose scope
 * covers the first-party checks, with no active block. Reads the Consent fresh.
 * @param {any} kase */
async function consentSatisfied(kase) {
  if (kase.mode === 'self') return String(kase.subjectId) === String(kase.requesterId);
  const c = kase.consentId ? await Consent.findById(kase.consentId) : null;
  if (!c) return false;
  if (String(c._id) !== String(kase.consentId)) return false;
  if (String(c.subjectId) !== String(kase.subjectId)) return false;
  if (String(c.requesterId) !== String(kase.requesterId)) return false;
  if (c.status !== 'granted') return false;
  if (c.expiresAt && new Date(c.expiresAt) < new Date()) return false;
  const need = (kase.checks || []).filter((/** @type {string} */ n) => !SELF_ONLY.includes(n));
  if (!need.every((/** @type {string} */ n) => (c.scope || []).includes(n))) return false;
  if (await blockedBetween(kase.requesterId, kase.subjectId)) return false;
  return true;
}

// ---- case creation ---------------------------------------------------------

/**
 * Create a case. self-mode (subjectId omitted or === requester): no consent needed,
 * may include own documents. other-mode: subject must be an active mutual match; a
 * pending Consent is created; documents are rejected. Always creates a case-bound,
 * amount-pinned 'created' Payment. Nothing runs until paid + consent satisfied.
 * @param {{ requesterId:any, subjectId?:any, tier:string, documents?:{base64:string,filename?:string}[] }} args
 */
async function createCase({ requesterId, subjectId, tier, documents }) {
  if (!isTier(tier)) throw new Error('Unknown verification tier');
  const subjId = subjectId ? String(subjectId) : String(requesterId);
  const mode = subjId === String(requesterId) ? 'self' : 'other';
  const subject = await User.findById(subjId);
  if (!subject) throw new Error('Subject not found');
  const checks = TIERS[tier].checks.slice();
  const amountCHF = TIERS[tier].priceCHF;
  const hasDocs = Array.isArray(documents) && documents.length > 0;

  if (mode === 'other') {
    if (hasDocs) throw new Error('You cannot submit documents on behalf of another person');
    if (!(await sharesActiveMatch(requesterId, subjId))) throw new Error('You can request verification only for an active mutual match');
    const open = await VerificationCase.findOne({ requesterId, subjectId: subjId, status: { $in: ['pending', 'processing'] } });
    if (open) throw new Error('You already have an open verification request for this person');
    const recentDeclined = await VerificationCase.findOne({
      requesterId, subjectId: subjId, status: 'declined',
      createdAt: { $gt: new Date(Date.now() - COOLDOWN_DAYS * 86400000) }
    });
    if (recentDeclined) throw new Error('A recent request to verify this person was declined. Please try again later.');
    const dayCount = await VerificationCase.countDocuments({ requesterId, createdAt: { $gt: new Date(Date.now() - 86400000) } });
    if (dayCount >= MAX_CASES_PER_DAY) throw new Error('Daily verification-request limit reached. Please try again tomorrow.');
  }

  // Pre-evaluate self-submitted documents NOW (file authenticity only) and DISCARD the
  // raw bytes — ID buffers are never persisted; only the coarse finding is kept.
  /** @type {any} */
  let precomputed = null;
  if (mode === 'self' && hasDocs && checks.includes('document_review')) {
    const bufs = (documents || []).map((d) => ({ buf: Buffer.from(d.base64, 'base64'), filename: d.filename }));
    precomputed = { document_review: coarse(await checkEngine.documentReview(bufs, subject)) };
  }

  const kase = await VerificationCase.create({
    requesterId, subjectId: subjId, mode, tier, checks,
    status: 'pending', paid: false, amountCHF, precomputed,
    subjectConsentRevoked: false, createdAt: new Date()
  });

  let consent = null;
  if (mode === 'other') {
    consent = await Consent.create({
      subjectId: subjId, requesterId, purpose: 'verification_service', scope: checks,
      caseId: kase._id, status: 'pending',
      expiresAt: new Date(Date.now() + CONSENT_TTL_DAYS * 86400000), createdAt: new Date()
    });
    await VerificationCase.findByIdAndUpdate(kase._id, { consentId: consent._id });
    kase.consentId = consent._id;
  }

  const order = await paymentRail().createDirectOrder({
    userId: requesterId, purpose: 'verification_service', amountCHF,
    metadata: { caseId: String(kase._id), tier }
  });
  await VerificationCase.findByIdAndUpdate(kase._id, { paymentId: order.payment._id });
  kase.paymentId = order.payment._id;

  return { case: kase, consent, payment: order.payment, order: { orderId: order.orderId, devMode: order.devMode, key: order.key, amountCHF } };
}

// ---- payment confirmation --------------------------------------------------

/**
 * Confirm the case's captured payment, then run if ready. Pins purpose + amount +
 * ownership + case-binding; never trusts a client-supplied paymentId. Idempotent.
 * @param {any} caseId @param {any} requesterId
 */
async function confirmPayment(caseId, requesterId) {
  const kase = await VerificationCase.findById(caseId);
  if (!kase) throw new Error('Case not found');
  if (String(kase.requesterId) !== String(requesterId)) throw new Error('Not your case');
  if (kase.paid) return await runCaseIfReady(kase._id);   // idempotent
  if (kase.status !== 'pending') {
    // The case already ended (e.g. the subject declined) before/while the payment
    // captured — reverse a late capture rather than stranding it, then return.
    await refundCasePayment(kase._id);
    return kase;
  }

  const pay = kase.paymentId ? await Payment.findById(kase.paymentId) : null;
  if (!pay) throw new Error('Payment not found');
  if (String((pay.metadata || {}).caseId) !== String(kase._id)) throw new Error('Payment is not bound to this case');
  if (pay.purpose !== 'verification_service') throw new Error('Wrong payment purpose');
  if (Number(pay.amountCHF) !== Number(priceForTier(kase.tier))) throw new Error('Payment amount mismatch');
  if (pay.status !== 'captured') throw new Error('Payment is not captured yet');

  // Refund any OTHER captured payment bound to this case (double-charge safety net).
  const dupes = await Payment.find({ 'metadata.caseId': String(kase._id), status: 'captured' });
  for (const o of dupes) {
    if (String(o._id) === String(pay._id)) continue;
    await market.atomicUpdate(Payment, { _id: o._id, status: 'captured' }, { $set: { status: 'refunded', refundedAt: new Date() } });
  }

  await market.atomicUpdate(VerificationCase, { _id: kase._id, paid: false }, { $set: { paid: true } });
  return await runCaseIfReady(kase._id);
}

// ---- the run (single-runner, consent re-verified in the critical section) --

/**
 * Run the case iff paid && consent satisfied && still pending. Wins an atomic
 * pending→processing CAS so exactly one caller executes; re-verifies consent inside
 * the critical section BEFORE reading any subject data; completes via a CAS that a
 * mid-run revoke defeats. Idempotent — safe to call from confirm-payment and grant.
 * @param {any} caseId
 */
async function runCaseIfReady(caseId) {
  let kase = await VerificationCase.findById(caseId);
  if (!kase || kase.status !== 'pending' || !kase.paid) return kase;
  if (kase.mode === 'self' && String(kase.subjectId) !== String(kase.requesterId)) return kase; // defence in depth
  if (!(await consentSatisfied(kase))) return kase;                                              // fast pre-check

  const won = await market.atomicUpdate(VerificationCase, { _id: kase._id, status: 'pending' }, { $set: { status: 'processing' } });
  if (!won) return await VerificationCase.findById(kase._id);

  // Re-verify INSIDE the critical section, before touching subject data.
  kase = await VerificationCase.findById(kase._id);
  if (!kase) return null;
  if (kase.subjectConsentRevoked || !(await consentSatisfied(kase))) {
    await market.atomicUpdate(VerificationCase, { _id: kase._id, status: 'processing' }, { $set: { status: 'pending' } });
    await haltAndRefund(kase._id);   // consent vanished — halt + refund, no data read
    return await VerificationCase.findById(kase._id);
  }

  // Authorized. Execute the checks. A deleted subject, or any engine error, must
  // never strand a paid case in 'processing' — halt + refund on any failure.
  const subject = await User.findById(kase.subjectId);
  if (!subject) { await haltAndRefund(kase._id); return await VerificationCase.findById(kase._id); }
  try {
    const consent = kase.consentId ? await Consent.findById(kase.consentId) : null;
    const scope = consent ? (consent.scope || []) : (kase.checks || []);
    const pre = kase.precomputed || {};
    const results = [];
    for (const name of kase.checks) {
      if (kase.mode === 'other' && SELF_ONLY.includes(name)) {
        results.push({ name, kind: 'fact', status: 'not_applicable', label: 'Not available for third-party verification' });
      } else if (pre[name]) {
        results.push(coarse(pre[name]));
      } else {
        results.push(coarse(await checkEngine.runCheck(name, { subject, scope, mode: kase.mode })));
      }
    }
    const report = buildReport(kase, results);
    const evidenceHash = crypto.createHash('sha256').update(JSON.stringify(report) + PEPPER).digest('hex');

    // Completion contends with revocation on ONE field. A mid-run revoke flips
    // subjectConsentRevoked → this CAS matches nothing → discard the report.
    const done = await market.atomicUpdate(
      VerificationCase,
      { _id: kase._id, status: 'processing', subjectConsentRevoked: false },
      { $set: { status: 'completed', report, evidenceHash, completedAt: new Date() } }
    );
    return done || await VerificationCase.findById(kase._id);
  } catch (err) {
    await haltAndRefund(kase._id);   // never leave a paid case stuck in 'processing'
    throw err;
  }
}

/** @param {any} kase @param {any[]} results */
function buildReport(kase, results) {
  /** @type {Record<string, number>} */
  const summary = { verified: 0, clear: 0, unverified: 0, unknown: 0, flagged: 0, not_applicable: 0 };
  for (const r of results) summary[r.status] = (summary[r.status] || 0) + 1;
  return {
    tier: kase.tier, mode: kase.mode, generatedAt: new Date(),
    verifiedLevel: checkEngine.verifiedLevel(results),
    summary, checks: results.map(coarse), disclaimer: DISCLAIMER
  };
}

// ---- consent decisions -----------------------------------------------------

/** @param {any} consentId @param {any} subjectId */
async function grantConsent(consentId, subjectId) {
  const c = await Consent.findById(consentId);
  if (!c || String(c.subjectId) !== String(subjectId)) throw new Error('Consent request not found');
  const won = await market.atomicUpdate(Consent, { _id: c._id, status: 'pending' }, { $set: { status: 'granted', decidedAt: new Date() } });
  if (!won) return { consent: c, case: await VerificationCase.findById(c.caseId) };
  const kase = await runCaseIfReady(c.caseId);
  return { consent: won, case: kase };
}

/** @param {any} consentId @param {any} subjectId */
async function denyConsent(consentId, subjectId) {
  const c = await Consent.findById(consentId);
  if (!c || String(c.subjectId) !== String(subjectId)) throw new Error('Consent request not found');
  const won = await market.atomicUpdate(Consent, { _id: c._id, status: 'pending' }, { $set: { status: 'denied', decidedAt: new Date() } });
  if (!won) return { consent: c, refunded: false };
  const moved = await haltAndRefund(c.caseId);
  return { consent: won, refunded: !!moved };
}

/** Withdraw a prior grant. Before completion → halt + refund; after completion →
 * freeze the report (block access), no refund. Contends with the runner via the
 * subjectConsentRevoked flag + a CAS out of a pre-completed state.
 * @param {any} consentId @param {any} subjectId */
async function revokeConsent(consentId, subjectId) {
  const c = await Consent.findById(consentId);
  if (!c || String(c.subjectId) !== String(subjectId)) throw new Error('Consent not found');
  if (c.status === 'pending') return await denyConsent(consentId, subjectId);
  if (c.status !== 'granted') throw new Error('Consent is not active');
  const won = await market.atomicUpdate(Consent, { _id: c._id, status: 'granted' }, { $set: { status: 'revoked', revokedAt: new Date() } });
  if (!won) return { consent: c, refunded: false };

  // Flag UNCONDITIONALLY so any in-flight completion CAS fails. Atomic $set merge —
  // a whole-doc write here could clobber a concurrently-committed completion.
  await market.atomicUpdate(VerificationCase, { _id: c.caseId }, { $set: { subjectConsentRevoked: true } });
  // Refund iff we can move the case OUT of a pre-completed state (else it completed → block).
  let moved = await market.atomicUpdate(VerificationCase, { _id: c.caseId, status: 'processing' }, { $set: { status: 'declined' } });
  if (!moved) moved = await market.atomicUpdate(VerificationCase, { _id: c.caseId, status: 'pending' }, { $set: { status: 'declined' } });
  if (moved) await refundCasePayment(c.caseId);
  return { consent: won, refunded: !!moved };
}

/** Halt a not-yet-completed case (deny / run-time consent loss) and refund. @param {any} caseId */
async function haltAndRefund(caseId) {
  let moved = await market.atomicUpdate(VerificationCase, { _id: caseId, status: 'pending' }, { $set: { status: 'declined' } });
  if (!moved) moved = await market.atomicUpdate(VerificationCase, { _id: caseId, status: 'processing' }, { $set: { status: 'declined' } });
  if (moved) await refundCasePayment(caseId);
  return !!moved;
}

/** Idempotent: reverse the case's captured payment exactly once (captured→refunded CAS). @param {any} caseId */
async function refundCasePayment(caseId) {
  const kase = await VerificationCase.findById(caseId);
  if (!kase || !kase.paymentId) return;
  await market.atomicUpdate(Payment, { _id: kase.paymentId, status: 'captured' }, { $set: { status: 'refunded', refundedAt: new Date() } });
  // Prod money movement on the rail is handled by the admin/Razorpay refund path;
  // automated flows only reverse the ledger here — consistent with marketplace.transition().
}

/**
 * Periodic reconciliation (nightly cron). Closes the two "money-in / nothing-out"
 * gaps that pure subject inaction or a late capture can open, both via idempotent CAS:
 *  (1) a paid, pending other-mode case whose consent has EXPIRED → mark the consent
 *      expired, decline the case, and refund;
 *  (2) any captured payment still bound to an already-DECLINED case (a capture that
 *      landed after the decline) → refund.
 * @param {Date} [now]
 */
async function sweepStaleCases(now = new Date()) {
  let expired = 0, reclaimed = 0;
  const stalePaid = await VerificationCase.find({ mode: 'other', status: 'pending', paid: true }).limit(1000);
  for (const kase of stalePaid) {
    const c = kase.consentId ? await Consent.findById(kase.consentId) : null;
    if (c && c.status === 'pending' && c.expiresAt && new Date(c.expiresAt) < now) {
      await market.atomicUpdate(Consent, { _id: c._id, status: 'pending' }, { $set: { status: 'expired' } });
      if (await haltAndRefund(kase._id)) expired++;
    }
  }
  const declined = await VerificationCase.find({ status: 'declined' }).limit(2000);
  for (const kase of declined) {
    if (!kase.paymentId) continue;
    const won = await market.atomicUpdate(Payment, { _id: kase.paymentId, status: 'captured' }, { $set: { status: 'refunded', refundedAt: new Date() } });
    if (won) reclaimed++;
  }
  return { expired, reclaimed };
}

// ---- read models -----------------------------------------------------------

/** Requester-facing DTO — coarse report only, never internal Case fields or evidenceHash. @param {any} kase */
function reportDTO(kase) {
  const r = kase.report || null;
  return {
    id: String(kase._id), tier: kase.tier, mode: kase.mode, status: kase.status,
    createdAt: kase.createdAt, completedAt: kase.completedAt,
    report: r ? {
      tier: r.tier, mode: r.mode, generatedAt: r.generatedAt, verifiedLevel: r.verifiedLevel,
      summary: r.summary, checks: (r.checks || []).map(coarse), disclaimer: r.disclaimer
    } : null
  };
}

/** May the requester view this report right now? @param {any} kase */
async function canViewReport(kase) {
  if (kase.subjectConsentRevoked) return false;
  if (kase.mode === 'other') {
    const c = kase.consentId ? await Consent.findById(kase.consentId) : null;
    if (!c || c.status !== 'granted') return false;
    if (c.expiresAt && new Date(c.expiresAt) < new Date()) return false;
    if (await blockedBetween(kase.requesterId, kase.subjectId)) return false;   // a block also cuts off access
  }
  return true;
}

/** Public tier catalogue — discloses which checks are unavailable for third-party cases. */
function tiersPublic() {
  return Object.entries(TIERS).map(([id, t]) => ({
    id, priceCHF: t.priceCHF,
    checks: t.checks.map((name) => ({ name, selfOnly: SELF_ONLY.includes(name), thirdPartyAvailable: FIRST_PARTY.includes(name) }))
  }));
}

module.exports = {
  TIERS, FIRST_PARTY, SELF_ONLY, isTier, priceForTier, tiersPublic,
  createCase, confirmPayment, runCaseIfReady,
  grantConsent, denyConsent, revokeConsent, haltAndRefund, refundCasePayment, sweepStaleCases,
  consentSatisfied, blockedBetween, sharesActiveMatch, reportDTO, canViewReport
};
