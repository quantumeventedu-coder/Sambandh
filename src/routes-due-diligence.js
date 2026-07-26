// @ts-check
// routes-due-diligence.js — consent-gated trust dossier (mounted at /api/due-diligence).
//
// Requester asks a mutual match for a dossier; the subject grants/denies/revokes and
// curates which vault documents to include. The requester sees the compiled dossier
// only while consent is granted; document bytes are fetched via /api/vault (the
// subject's share makes them readable). Only the two parties can see the case.
const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('./routes-auth');
const dd = require('./services/due-diligence');
const DueDiligenceCase = require('./models/DueDiligenceCase');

const router = express.Router();
const msg = (/** @type {unknown} */ e) => (e instanceof Error ? e.message : String(e));

/** @param {any} res @param {unknown} e */
function fail(res, e) {
  const m = msg(e);
  if (/not your|only the subject|mutual match/i.test(m)) return res.status(403).json({ error: m });
  if (/not found/i.test(m)) return res.status(404).json({ error: m });
  return res.status(409).json({ error: m });
}

/** @param {any} k */
const pubCase = (k) => ({
  id: k._id, requesterId: k.requesterId, subjectId: k.subjectId, status: k.status,
  sharedDocCount: (k.sharedDocs || []).length, createdAt: k.createdAt
});

// ---- requester: request a dossier + list -----------------------------------
router.post('/cases', requireAuth, async (req, res) => {
  try {
    const p = z.object({ subjectId: z.string().min(1) }).safeParse(req.body || {});
    if (!p.success) return res.status(400).json({ error: 'subjectId is required' });
    const out = await dd.requestDossier({ requesterId: req.userId, subjectId: p.data.subjectId });
    res.status(201).json({ case: pubCase(out.case) });
  } catch (e) { return fail(res, e); }
});

router.get('/cases', requireAuth, async (req, res, next) => {
  try {
    const cases = await DueDiligenceCase.find({ requesterId: req.userId }).sort({ createdAt: -1 }).limit(100);
    res.json({ cases: cases.map(pubCase) });
  } catch (e) { next(e); }
});

// subject: dossier requests about me (pending)
router.get('/incoming', requireAuth, async (req, res, next) => {
  try {
    const cases = await DueDiligenceCase.find({ subjectId: req.userId, status: { $in: ['pending', 'active'] } }).sort({ createdAt: -1 }).limit(100);
    res.json({ cases: cases.map(pubCase) });
  } catch (e) { next(e); }
});

/** Load a case the caller participates in. @param {any} req @param {any} res */
async function mine(req, res) {
  const kase = await DueDiligenceCase.findById(req.params.id);
  if (!kase || (String(kase.requesterId) !== String(req.userId) && String(kase.subjectId) !== String(req.userId))) { res.status(404).json({ error: 'Case not found' }); return null; }
  return kase;
}

// requester → compiled dossier (access-gated); subject → status only
router.get('/cases/:id', requireAuth, async (req, res, next) => {
  try {
    const kase = await mine(req, res); if (!kase) return;
    if (String(kase.requesterId) === String(req.userId)) {
      if (!(await dd.canView(kase))) return res.status(403).json({ error: 'The dossier is not available (pending, declined, or withdrawn)' });
      return res.json({ case: pubCase(kase), dossier: await dd.compile(kase) });
    }
    res.json({ case: pubCase(kase) });   // subject view
  } catch (e) { next(e); }
});

// ---- subject: grant / deny / revoke / add a document -----------------------
function subjectAction(/** @type {(kase:any, req:any) => Promise<any>} */ handler) {
  return async (/** @type {any} */ req, /** @type {any} */ res) => {
    try {
      const kase = await mine(req, res); if (!kase) return;
      const updated = await handler(kase, req);
      res.json({ case: pubCase(updated) });
    } catch (e) { return fail(res, e); }
  };
}

router.post('/cases/:id/grant', requireAuth, subjectAction((k, req) => dd.decide({ kase: k, subjectId: req.userId, decision: 'granted' })));
router.post('/cases/:id/deny', requireAuth, subjectAction((k, req) => dd.decide({ kase: k, subjectId: req.userId, decision: 'denied' })));
router.post('/cases/:id/revoke', requireAuth, subjectAction((k, req) => dd.revoke({ kase: k, subjectId: req.userId })));
router.post('/cases/:id/documents', requireAuth, subjectAction((k, req) => dd.shareDocument({ kase: k, subjectId: req.userId, vaultDocumentId: String((req.body || {}).vaultDocumentId || '') })));

module.exports = router;
