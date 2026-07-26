// @ts-check
// routes-court-marriage.js — the court-marriage assistant (mounted at /api/court-marriage).
//
// Both partners drive one shared case; only the two of them can see it. Documents are
// referenced from the vault (shared to the partner on attach) — bytes are fetched via
// /api/vault, never here. Guidance only; Sambandh does not file with any government.
const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('./routes-auth');
const cm = require('./services/court-marriage');
const ref = require('./data/court-marriage');
const CourtMarriageCase = require('./models/CourtMarriageCase');

const router = express.Router();
const msg = (/** @type {unknown} */ e) => (e instanceof Error ? e.message : String(e));

/** @param {any} res @param {unknown} e */
function fail(res, e) {
  const m = msg(e);
  if (/not your|only the invited|mutual match/i.test(m)) return res.status(403).json({ error: m });
  if (/not found/i.test(m)) return res.status(404).json({ error: m });
  return res.status(409).json({ error: m });
}

/** @param {any} k */
const pubCase = (k) => ({
  id: k._id, initiatorId: k.initiatorId, partnerId: k.partnerId, act: k.act, state: k.state, status: k.status,
  documents: (k.documents || []).map((/** @type {any} */ d) => ({ requirementKey: d.requirementKey, vaultDocumentId: d.vaultDocumentId, byUserId: d.byUserId, attachedAt: d.attachedAt })),
  witnesses: (k.witnesses || []).map((/** @type {any} */ w) => ({ name: w.name, addedBy: w.addedBy })),
  noticeFiledAt: k.noticeFiledAt, noticePeriodEndsAt: k.noticePeriodEndsAt,
  objection: (k.objection && k.objection.raisedAt) ? { reason: k.objection.reason, raisedAt: k.objection.raisedAt, resolvedAt: k.objection.resolvedAt } : null,
  solemnizedAt: k.solemnizedAt, certificateDocumentId: k.certificateDocumentId,
  progress: cm.documentProgress(k), createdAt: k.createdAt
});

// ---- reference checklist ---------------------------------------------------
router.get('/requirements', requireAuth, (req, res) => {
  const act = String(req.query.act || 'special_marriage');
  if (!ref.isAct(act)) return res.status(400).json({ error: 'Unknown act' });
  res.json({
    act, documents: ref.REQUIRED_DOCUMENTS[act], steps: ref.STEPS[act],
    noticePeriodDays: ref.NOTICE_PERIOD_DAYS[act], witnessesRequired: ref.WITNESSES_REQUIRED[act],
    disclaimer: ref.DISCLAIMER
  });
});

// ---- propose / list --------------------------------------------------------
const proposeSchema = z.object({
  partnerId: z.string().min(1),
  act: z.enum(['special_marriage', 'hindu_marriage']),
  state: z.string().max(60).optional()
});
router.post('/cases', requireAuth, async (req, res) => {
  try {
    const p = proposeSchema.safeParse(req.body || {});
    if (!p.success) return res.status(400).json({ error: 'partnerId and a valid act are required' });
    const kase = await cm.proposeCase({ initiatorId: req.userId, partnerId: p.data.partnerId, act: p.data.act, state: p.data.state });
    res.status(201).json({ case: pubCase(kase) });
  } catch (e) { return fail(res, e); }
});

router.get('/cases', requireAuth, async (req, res, next) => {
  try {
    const cases = await CourtMarriageCase.find({ $or: [{ initiatorId: req.userId }, { partnerId: req.userId }] }).sort({ updatedAt: -1 }).limit(100);
    res.json({ cases: cases.map(pubCase) });
  } catch (e) { next(e); }
});

/** Load a case the caller participates in (404 otherwise). @param {any} req @param {any} res */
async function mine(req, res) {
  const kase = await CourtMarriageCase.findById(req.params.id);
  if (!kase || !cm.isParticipant(kase, req.userId)) { res.status(404).json({ error: 'Case not found' }); return null; }
  return kase;
}

router.get('/cases/:id', requireAuth, async (req, res, next) => {
  try { const kase = await mine(req, res); if (!kase) return; res.json({ case: pubCase(kase) }); }
  catch (e) { next(e); }
});

/** Wrap a service action: load the caller's case, run it, return the updated case.
 * @param {(kase:any, req:any) => Promise<any>} handler */
function action(handler) {
  return async (/** @type {any} */ req, /** @type {any} */ res) => {
    try {
      const kase = await mine(req, res); if (!kase) return;
      const updated = await handler(kase, req);
      res.json({ case: pubCase(updated) });
    } catch (e) { return fail(res, e); }
  };
}

router.post('/cases/:id/accept', requireAuth, action((k, req) => cm.acceptCase({ kase: k, userId: req.userId })));
router.post('/cases/:id/decline', requireAuth, action((k, req) => cm.declineCase({ kase: k, userId: req.userId })));
router.post('/cases/:id/documents', requireAuth, action((k, req) => cm.attachDocument({ kase: k, userId: req.userId, requirementKey: String((req.body || {}).requirementKey || ''), vaultDocumentId: String((req.body || {}).vaultDocumentId || '') })));
router.post('/cases/:id/witnesses', requireAuth, action((k, req) => cm.addWitness({ kase: k, userId: req.userId, name: String((req.body || {}).name || '') })));
router.post('/cases/:id/file-notice', requireAuth, action((k, req) => cm.fileNotice({ kase: k, userId: req.userId })));
router.post('/cases/:id/clear', requireAuth, action((k, req) => cm.clearToSolemnize({ kase: k, userId: req.userId })));
router.post('/cases/:id/objection', requireAuth, action((k, req) => cm.raiseObjection({ kase: k, userId: req.userId, reason: (req.body || {}).reason })));
router.post('/cases/:id/resolve-objection', requireAuth, action((k, req) => cm.resolveObjection({ kase: k, userId: req.userId })));
router.post('/cases/:id/solemnize', requireAuth, action((k, req) => cm.markSolemnized({ kase: k, userId: req.userId })));
router.post('/cases/:id/certificate', requireAuth, action((k, req) => cm.issueCertificate({ kase: k, userId: req.userId, vaultDocumentId: String((req.body || {}).vaultDocumentId || '') })));
router.post('/cases/:id/cancel', requireAuth, action((k, req) => cm.cancelCase({ kase: k, userId: req.userId })));

module.exports = router;
