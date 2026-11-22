// intelligence/lakshan.js — Lakshan Intelligence: evidence-grounded, explainable,
// correctable assessments.
//
// Principles enforced in code:
//  1. Two statements differing is NEVER treated as dishonesty by itself.
//  2. Every assessment records both statements, their timestamps and sources,
//     the exact conflicting details, the time gap, the context considered, an
//     epistemic label for each statement, a classification, a confidence and a
//     plain-language explanation.
//  3. Automated analysis only opens an assessment. It has NO public effect until
//     a human moderator confirms it; only confirmed assessments move the public
//     (reviewed) Lakshan score or show a flag to other members.
//  4. The person concerned can always see their own assessments and respond:
//     acknowledge, correct, or appeal (which returns it to human review).
//  5. No sensitive-trait or personality profiling: only the claim types the
//     Karma Book already extracts (identity facts, intent, exclusivity…).

const LakshanAssessment = require('../models/LakshanAssessment');
const KarmaBook = require('../models/KarmaBook');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const metrics = require('./metrics');
const { encryptText, decryptText } = require('./security');

const DAY = 86400000;
// Penalty applied to the REVIEWED (public) score only after a human confirms.
const REVIEWED_PENALTY = { low: 3, medium: 7, high: 12 };

function splitNormalized(claim) {
  const n = String((claim && claim.normalized) || '');
  const i = n.indexOf(':');
  return i >= 0 ? { key: n.slice(0, i).trim(), val: n.slice(i + 1).trim() } : { key: n.trim(), val: '' };
}

function ageFromDob(dob, at) {
  const d = new Date(dob);
  if (isNaN(d)) return null;
  const ref = at ? new Date(at) : new Date();
  let a = ref.getUTCFullYear() - d.getUTCFullYear();
  const m = ref.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && ref.getUTCDate() < d.getUTCDate())) a--;
  return a;
}

// What kind of knowledge is this statement? (verified vs self-reported vs claim)
function epistemicLabel(claim, user) {
  const { key, val } = splitNormalized(claim);
  if (!user) return 'unverified_claim';
  const v = user.verification || {};
  if (key === 'age' && v.idVerified && user.profile && user.profile.dob) {
    const verifiedAge = ageFromDob(user.profile.dob, claim.createdAt);
    if (verifiedAge != null && String(verifiedAge) === String(val)) return 'verified_fact';
  }
  if ((key === 'job' || key === 'work') && v.professionVerified && user.claims && user.claims.profession && user.claims.profession.title &&
      String(user.claims.profession.title).toLowerCase().includes(String(val).toLowerCase())) return 'verified_fact';
  if (key === 'age' && user.profile && String(user.profile.age) === String(val)) return 'self_reported';
  return 'unverified_claim';
}

// Steps 3–9 of the contradiction pipeline: pure function, fully testable.
function analyse({ claimType, prior, current, user = null, differentChat = true, severityHint = 'medium' }) {
  const p = splitNormalized(prior), c = splitNormalized(current);
  const gapDays = Math.abs((new Date(current.createdAt) - new Date(prior.createdAt)) / DAY);
  const notes = [];
  const details = [];
  if (p.val || c.val) details.push({ field: p.key || claimType, prior: p.val || String(prior.statement || '').slice(0, 80), current: c.val || String(current.statement || '').slice(0, 80) });
  notes.push(`The statements were made ${gapDays < 1 ? 'on the same day' : Math.round(gapDays) + ' day(s) apart'}${differentChat ? ', in different conversations' : ', in the same conversation'}.`);

  const eP = epistemicLabel(prior, user), eC = epistemicLabel(current, user);
  let classification = 'insufficient_evidence';
  let confidence = 0.3;

  if (p.val && c.val && p.val.toLowerCase() === c.val.toLowerCase()) {
    return { classification: 'not_contradictory', confidence: 0.9, gapDays, details, notes: [...notes, 'Both statements say the same thing.'], epistemic: [eP, eC] };
  }

  if (claimType === 'identity' && p.key === 'age') {
    const diff = Math.abs(Number(c.val) - Number(p.val));
    if (Number.isFinite(diff) && diff === 1 && gapDays > 0) {
      classification = 'outdated_information'; confidence = 0.7;
      notes.push('A one-year difference can be explained by a birthday between the two statements.');
    } else if (eP === 'verified_fact' || eC === 'verified_fact') {
      classification = 'conflicting_evidence'; confidence = 0.85;
      notes.push('One of the stated ages matches the ID-verified date of birth; the other does not.');
    } else {
      classification = 'conflicting_evidence'; confidence = gapDays <= 90 ? 0.6 : 0.4;
      notes.push('Neither age is ID-verified, so this rests on self-reported statements only.');
    }
  } else if (claimType === 'identity' && (p.key === 'job' || p.key === 'work')) {
    if (gapDays > 30) { classification = 'possible_context'; confidence = 0.5; notes.push('Jobs change; over a month passed between the statements.'); }
    else { classification = 'conflicting_evidence'; confidence = eP === 'verified_fact' || eC === 'verified_fact' ? 0.75 : 0.5; }
  } else if (claimType === 'identity' && p.key === 'marital') {
    if (gapDays > 60) { classification = 'possible_context'; confidence = 0.45; notes.push('Marital status can genuinely change over two months.'); }
    else { classification = 'conflicting_evidence'; confidence = 0.65; }
  } else if (claimType === 'intent') {
    if (gapDays > 30) { classification = 'outdated_information'; confidence = 0.6; notes.push('People are allowed to change what they are looking for; the statements are over a month apart.'); }
    else { classification = differentChat ? 'conflicting_evidence' : 'possible_context'; confidence = differentChat ? 0.5 : 0.35; notes.push('Different intentions told to different people close in time can also reflect genuine uncertainty.'); }
  } else if (claimType === 'exclusivity') {
    if (differentChat && gapDays <= 7) { classification = 'conflicting_evidence'; confidence = 0.7; notes.push('Exclusivity was stated in two different conversations within a week.'); }
    else { classification = 'possible_context'; confidence = 0.35; notes.push('Exclusivity statements far apart in time can both have been true when made.'); }
  } else {
    classification = 'insufficient_evidence'; confidence = 0.3;
    notes.push('This kind of statement is too subjective to treat as a factual inconsistency.');
  }
  if (severityHint === 'high' && classification === 'conflicting_evidence') confidence = Math.min(0.95, confidence + 0.05);
  return { classification, confidence: +confidence.toFixed(2), gapDays: +gapDays.toFixed(1), details, notes, epistemic: [eP, eC] };
}

const LABEL = {
  conflicting_evidence: 'These two statements appear to be inconsistent.',
  possible_context: 'These statements differ, but there is a plausible explanation.',
  outdated_information: 'The earlier statement may simply be out of date.',
  not_contradictory: 'These statements do not actually conflict.',
  insufficient_evidence: 'There is not enough evidence to treat this as an inconsistency.'
};
const EPI = { verified_fact: 'verified', self_reported: 'self-reported (matches the profile)', unverified_claim: 'an unverified statement in chat' };

function explain(a) {
  const d = a.details && a.details[0];
  return [
    LABEL[a.classification],
    d ? `Earlier: "${d.prior}". Later: "${d.current}".` : '',
    `The earlier statement is ${EPI[a.epistemic[0]] || 'unverified'}; the later one is ${EPI[a.epistemic[1]] || 'unverified'}.`,
    ...a.notes,
    `Confidence: ${Math.round(a.confidence * 100)}%. This is an automated observation, not a conclusion that anyone was dishonest. It has no effect on how others see you unless a human reviewer confirms it, and you can add context, correct it or appeal at any time.`
  ].filter(Boolean).join(' ');
}

// Steps 1–10 end to end: record an OPEN, explainable assessment.
async function assessContradiction({ userId, newClaim, priorClaim, severity = 'medium' }) {
  const user = await User.findById(userId).select('profile.dob profile.age verification claims.profession').lean().catch(() => null);
  const differentChat = String(priorClaim.chatId || '') !== String(newClaim.chatId || '');
  const a = analyse({ claimType: newClaim.type, prior: priorClaim, current: newClaim, user, differentChat, severityHint: severity });
  if (a.classification === 'not_contradictory') { metrics.bump('lakshan.discarded_not_contradictory'); return null; }
  const doc = await LakshanAssessment.create({
    userId, kind: 'contradiction', claimType: newClaim.type,
    statements: [
      { role: 'prior', text: encryptText(priorClaim.statement || priorClaim.normalized || ''), at: priorClaim.createdAt, epistemic: a.epistemic[0], source: { kind: 'chat', chatId: String(priorClaim.chatId || ''), claimId: String(priorClaim._id || '') } },
      { role: 'new', text: encryptText(newClaim.statement || newClaim.normalized || ''), at: newClaim.createdAt, epistemic: a.epistemic[1], source: { kind: 'chat', chatId: String(newClaim.chatId || ''), claimId: String(newClaim._id || '') } }
    ],
    conflictingDetails: a.details, timeGapDays: a.gapDays, contextNotes: a.notes,
    classification: a.classification, confidence: a.confidence, explanation: explain(a),
    status: 'open', publicEffect: false
  });
  metrics.bump('lakshan.assessments.' + a.classification);
  return doc;
}

function viewForSubject(d) {
  return {
    id: String(d._id), kind: d.kind, claimType: d.claimType, classification: d.classification, confidence: d.confidence,
    explanation: d.explanation, status: d.status, publicEffect: !!d.publicEffect, timeGapDays: d.timeGapDays,
    conflictingDetails: d.conflictingDetails || [], contextNotes: d.contextNotes || [],
    statements: (d.statements || []).map(s => ({ role: s.role, text: decryptText(s.text), at: s.at, epistemic: s.epistemic })),
    userResponse: d.userResponse || null, review: d.review ? { decision: d.review.decision, at: d.review.at, notes: d.review.notes } : null,
    createdAt: d.createdAt, updatedAt: d.updatedAt
  };
}

async function listForSubject(userId) {
  const rows = await LakshanAssessment.find({ userId }).sort({ createdAt: -1 }).limit(100).lean();
  return rows.map(viewForSubject);
}

async function getForSubject(userId, id) {
  const d = await LakshanAssessment.findOne({ _id: id, userId }).lean();
  return d ? viewForSubject(d) : null;
}

// Subject's response: acknowledge | correct | appeal.
async function respond(userId, id, { action, text = '' }) {
  if (!['acknowledge', 'correct', 'appeal'].includes(action)) throw Object.assign(new Error('action must be acknowledge, correct or appeal'), { status: 400 });
  const d = await LakshanAssessment.findOne({ _id: id, userId }).lean();
  if (!d) return null;
  if (['confirmed', 'dismissed'].includes(d.status) && action !== 'appeal') throw Object.assign(new Error('This assessment was already reviewed — you can still appeal it.'), { status: 409 });
  const status = action === 'acknowledge' ? 'acknowledged' : action === 'correct' ? 'corrected' : 'appealed';
  const upd = await LakshanAssessment.findOneAndUpdate({ _id: id, userId }, { $set: { status, userResponse: { action, text: String(text).slice(0, 1000), at: new Date() }, updatedAt: new Date() } }, { new: true });
  await AuditLog.create({ actor: String(userId), action: 'lakshan_subject_' + action, targetType: 'lakshan_assessment', targetId: String(id) }).catch(() => {});
  metrics.bump('lakshan.responses.' + action);
  return viewForSubject(upd.toObject ? upd.toObject() : upd);
}

async function reviewQueue({ limit = 50 } = {}) {
  const rows = await LakshanAssessment.find({ status: { $in: ['open', 'corrected', 'appealed'] } }).sort({ createdAt: 1 }).limit(limit).lean();
  return rows.map(d => ({ ...viewForSubject(d), userId: String(d.userId) }));
}

async function recomputeReviewedScore(userId) {
  const confirmed = await LakshanAssessment.find({ userId, status: 'confirmed' }).lean();
  let score = 100;
  for (const a of confirmed) score -= REVIEWED_PENALTY[a.confidence >= 0.75 ? 'high' : a.confidence >= 0.5 ? 'medium' : 'low'];
  score = Math.max(0, score);
  await KarmaBook.findOneAndUpdate({ userId }, { $set: { reviewedScore: score }, $setOnInsert: { userId } }, { upsert: true, new: true });
  return score;
}

// Human review: confirm (public effect) or dismiss. Recorded in the audit log.
async function review(id, { decision, notes = '', by = 'moderator' }) {
  if (!['confirm', 'dismiss'].includes(decision)) throw Object.assign(new Error('decision must be confirm or dismiss'), { status: 400 });
  const d = await LakshanAssessment.findById(id).lean();
  if (!d) return null;
  const status = decision === 'confirm' ? 'confirmed' : 'dismissed';
  const upd = await LakshanAssessment.findOneAndUpdate({ _id: id }, { $set: { status, publicEffect: decision === 'confirm', review: { by: String(by), decision, notes: String(notes).slice(0, 1000), at: new Date() }, updatedAt: new Date() } }, { new: true });
  const reviewedScore = await recomputeReviewedScore(d.userId);
  await AuditLog.create({ actor: String(by), action: 'lakshan_review_' + decision, targetType: 'lakshan_assessment', targetId: String(id), detail: { reviewedScore } }).catch(() => {});
  metrics.bump('lakshan.reviews.' + decision);
  return { ...viewForSubject(upd.toObject ? upd.toObject() : upd), reviewedScore };
}

// What other members may see: only human-confirmed assessments.
async function confirmedSummary(userId) {
  const rows = await LakshanAssessment.find({ userId, status: 'confirmed' }).lean();
  const byType = {};
  for (const r of rows) byType[r.claimType || 'other'] = (byType[r.claimType || 'other'] || 0) + 1;
  return { confirmed: rows.length, byType };
}

module.exports = { analyse, explain, assessContradiction, listForSubject, getForSubject, respond, reviewQueue, review, confirmedSummary, recomputeReviewedScore, epistemicLabel, ageFromDob };
