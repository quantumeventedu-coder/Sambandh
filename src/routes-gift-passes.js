// @ts-check
// routes-gift-passes.js — the Sambandh Gift Pass system (mounted at /api/gift-passes).
//
// Buy a pass, share its code anywhere, redeem it inside Sambandh. The code + redeem
// link are shown ONLY to the purchaser (and in the wallet). Redemption is one-time.
const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('./routes-auth');
const gp = require('./services/gift-pass');
const GiftPass = require('./models/GiftPass');

const router = express.Router();
const msg = (/** @type {unknown} */ e) => (e instanceof Error ? e.message : String(e));

function fail(/** @type {any} */ res, /** @type {unknown} */ e) {
  const m = msg(e);
  if (/not found|invalid gift/i.test(m)) return res.status(404).json({ error: m });
  if (/not your/i.test(m)) return res.status(403).json({ error: m });
  return res.status(409).json({ error: m });
}

/** @param {any} p @param {boolean} owner — the purchaser sees the code + redeem link. */
const pub = (p, owner) => ({
  id: p._id, passType: p.passType, label: (gp.CATALOG[p.passType] || {}).label || p.passType,
  status: p.status, amountCHF: p.amountCHF, message: p.message || '',
  deliverAt: p.deliverAt, expiresAt: p.expiresAt, createdAt: p.createdAt, redeemedAt: p.redeemedAt,
  ...(owner ? { code: p.code, redeemUrl: '/app#/redeem/' + p.code } : {})
});

// ---- catalogue -------------------------------------------------------------
router.get('/catalog', requireAuth, (req, res) => res.json({ passes: gp.catalog() }));

// ---- purchase --------------------------------------------------------------
const buySchema = z.object({
  passType: z.string().min(1),
  message: z.string().max(500).optional(),
  deliverAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional()
});
router.post('/purchase', requireAuth, async (req, res) => {
  try {
    const p = buySchema.safeParse(req.body || {});
    if (!p.success) return res.status(400).json({ error: 'passType is required' });
    const out = await gp.purchasePass({ purchaserId: req.userId, ...p.data });
    res.status(201).json({
      pass: pub(out.pass, true),
      order: out.order && { orderId: out.order.orderId, devMode: out.order.devMode, key: out.order.key, amountCHF: out.pass.amountCHF },
      payment: out.order && out.order.payment && { id: out.order.payment._id, amountCHF: out.order.payment.amountCHF, status: out.order.payment.status }
    });
  } catch (e) { return fail(res, e); }
});

router.post('/:id/confirm-payment', requireAuth, async (req, res) => {
  try {
    const pass = await gp.confirmPurchase(req.params.id, req.userId);
    res.json({ pass: pub(pass, true) });
  } catch (e) { return fail(res, e); }
});

// ---- redeem (any user, by code) --------------------------------------------
router.post('/redeem', requireAuth, async (req, res) => {
  try {
    const p = z.object({ code: z.string().min(1) }).safeParse(req.body || {});
    if (!p.success) return res.status(400).json({ error: 'A gift code is required' });
    const pass = await gp.redeem({ code: p.data.code, redeemerId: req.userId });
    res.json({ ok: true, pass: pub(pass, false), unlocked: (gp.CATALOG[pass.passType] || {}).label });
  } catch (e) { return fail(res, e); }
});

// ---- wallet ----------------------------------------------------------------
router.get('/wallet', requireAuth, async (req, res, next) => {
  try {
    const w = await gp.wallet(req.userId);
    res.json({ purchased: w.purchased.map((/** @type {any} */ p) => pub(p, true)), received: w.received.map((/** @type {any} */ p) => pub(p, false)) });
  } catch (e) { next(e); }
});

// ---- one pass (purchaser) + revoke ----------------------------------------
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const p = await GiftPass.findById(req.params.id);
    if (!p || String(p.purchaserId) !== String(req.userId)) return res.status(404).json({ error: 'Gift pass not found' });
    res.json({ pass: pub(p, true) });
  } catch (e) { next(e); }
});

router.post('/:id/revoke', requireAuth, async (req, res) => {
  try {
    const pass = await gp.revoke({ passId: req.params.id, purchaserId: req.userId });
    res.json({ ok: true, pass: pub(pass, true) });
  } catch (e) { return fail(res, e); }
});

module.exports = router;
