// @ts-check
// routes-verification-services.js — the Verification Services product
// (mounted at /api/verification-services).
//
// Consumer buys a verification tier about themselves or a consenting match; the
// subject grants/denies/revokes consent; the requester reads a coarse, honest
// report. `mode` is NEVER taken from the client — it is derived server-side from
// the identities. Money rides the shared Payment rail: a case's Payment is created
// here and captured by the normal /api/payment/verify flow before confirm-payment.
const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('./routes-auth');
const svc = require('./services/verification-service');
const VerificationCase = require('./models/VerificationCase');
const Consent = require('./models/Consent');

const router = express.Router();
const msg = (/** @type {unknown} */ e) => (e instanceof Error ? e.message : String(e));

/** Map a service error to an HTTP status without leaking internals.
 * @param {any} res @param {unknown} e */
function fail(res, e) {
  const m = msg(e);
  if (/not found/i.test(m)) return res.status(404).json({ error: m });
  if (/not your|mutual match|blocked/i.test(m)) return res.status(403).json({ error: m });
  if (/already|limit|declined|cannot|no longer|not captured|mismatch|not bound|wrong purpose|not active/i.test(m)) return res.status(409).json({ error: m });
  return res.status(400).json({ error: m });
}

const pubCase = (/** @type {any} */ k) => ({
  id: k._id, tier: k.tier, mode: k.mode, status: k.status,
  subjectId: k.subjectId, paid: !!k.paid, createdAt: k.createdAt, completedAt: k.completedAt
});
const pubConsentReq = (/** @type {any} */ c) => ({
  id: c._id, requesterId: c.requesterId, purpose: c.purpose, scope: c.scope,
  caseId: c.caseId, status: c.status, createdAt: c.createdAt, expiresAt: c.expiresAt
});

// ---- catalogue -------------------------------------------------------------
router.get('/tiers', requireAuth, (req, res) => res.json({ tiers: svc.tiersPublic() }));

// ---- requester: create a case ----------------------------------------------
const createSchema = z.object({
  tier: z.enum(['dating_lite', 'pre_marital', 'post_marital']),
  subjectId: z.string().min(1).optional(),                       // omitted → verify yourself
  documents: z.array(z.object({ base64: z.string().min(1), filename: z.string().optional() })).max(5).optional()
});

router.post('/cases', requireAuth, async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid request' });
    const { tier, subjectId, documents } = parsed.data;
    const out = await svc.createCase({ requesterId: req.userId, subjectId, tier, documents });
    res.status(201).json({
      case: pubCase(out.case),
      consentRequested: !!out.consent,
      order: out.order,
      payment: { id: out.payment._id, amountCHF: out.payment.amountCHF, status: out.payment.status }
    });
  } catch (err) { return fail(res, err); }
});

// ---- requester: confirm payment (after the shared /payment/verify captures it) ---
router.post('/cases/:id/confirm-payment', requireAuth, async (req, res, next) => {
  try {
    const kase = await svc.confirmPayment(req.params.id, req.userId);
    if (!kase) return res.status(404).json({ error: 'Case not found' });
    res.json({ case: pubCase(kase) });
  } catch (err) { return fail(res, err); }
});

// ---- requester: my cases ---------------------------------------------------
router.get('/cases', requireAuth, async (req, res, next) => {
  try {
    const cases = await VerificationCase.find({ requesterId: req.userId }).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ cases: cases.map(pubCase) });
  } catch (err) { next(err); }
});

// ---- requester: one case + its report (access-gated) -----------------------
router.get('/cases/:id', requireAuth, async (req, res, next) => {
  try {
    const kase = await VerificationCase.findById(req.params.id);
    if (!kase || String(kase.requesterId) !== String(req.userId)) return res.status(404).json({ error: 'Case not found' });
    if (kase.status === 'completed' && !(await svc.canViewReport(kase))) {
      return res.status(403).json({ error: 'Access to this report was withdrawn by the subject or the consent expired' });
    }
    res.json({ case: svc.reportDTO(kase) });
  } catch (err) { next(err); }
});

// ---- subject: consent requests about me ------------------------------------
router.get('/consent-requests', requireAuth, async (req, res, next) => {
  try {
    const reqs = await Consent.find({ subjectId: req.userId, status: 'pending' }).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ requests: reqs.map(pubConsentReq) });
  } catch (err) { next(err); }
});

// ---- subject: grant / deny / revoke ----------------------------------------
router.post('/consent-requests/:id/grant', requireAuth, async (req, res, next) => {
  try {
    const out = await svc.grantConsent(req.params.id, req.userId);
    res.json({ ok: true, consent: pubConsentReq(out.consent), caseStatus: out.case && out.case.status });
  } catch (err) { return fail(res, err); }
});

router.post('/consent-requests/:id/deny', requireAuth, async (req, res, next) => {
  try {
    const out = await svc.denyConsent(req.params.id, req.userId);
    res.json({ ok: true, consent: pubConsentReq(out.consent), refunded: !!out.refunded });
  } catch (err) { return fail(res, err); }
});

router.post('/consent-requests/:id/revoke', requireAuth, async (req, res, next) => {
  try {
    const out = await svc.revokeConsent(req.params.id, req.userId);
    res.json({ ok: true, consent: pubConsentReq(out.consent), refunded: !!out.refunded });
  } catch (err) { return fail(res, err); }
});

module.exports = router;
