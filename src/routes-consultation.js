// @ts-check
// routes-consultation.js — bookable consultations (mounted at /api/consultation).
//
// Discovery + slot booking + the live session. Money rides the marketplace core:
// booking creates a marketplace Order + Payment, so buyers pay via
// /api/marketplace/orders/:id/confirm-payment and release the payout via
// /api/marketplace/orders/:id/complete. This module owns slots + sessions only.
const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('./routes-auth');
const { requireSuperOrScope } = require('./services/dev-auth');
const Partner = require('./models/Partner');
const Listing = require('./models/Listing');
const Order = require('./models/Order');
const Slot = require('./models/ConsultantSlot');
const Session = require('./models/Session');
const market = require('./services/marketplace');
const consult = require('./services/consultation');

const router = express.Router();
const staff = requireSuperOrScope('market:manage');
const msg = (/** @type {unknown} */ e) => (e instanceof Error ? e.message : String(e));

const pubListing = (/** @type {any} */ l) => l && ({
  id: l._id, partnerId: l.partnerId, title: l.title, description: l.description, category: l.category,
  billing: l.billing, priceCHF: l.priceCHF, ratePerMinuteCHF: l.ratePerMinuteCHF, durationMin: l.durationMin
});
const pubPartner = (/** @type {any} */ p) => p && ({ id: p._id, name: p.name, category: p.category, city: p.city, verified: !!p.verified, ratingAvg: p.ratingAvg || 0, ratingCount: p.ratingCount || 0 });
const pubSlot = (/** @type {any} */ s) => s && ({ id: s._id, listingId: s.listingId, partnerId: s.partnerId, startsAt: s.startsAt, durationMin: s.durationMin, status: s.status });
const pubSession = (/** @type {any} */ s) => s && ({ id: s._id, orderId: s.orderId, partnerId: s.partnerId, status: s.status, startedAt: s.startedAt, endedAt: s.endedAt, actualMinutes: s.actualMinutes });

// ==== Consumer: discover consultation offerings =============================
router.get('/consultants', requireAuth, async (req, res, next) => {
  try {
    /** @type {Record<string, any>} */ const filter = { active: true, category: { $in: consult.CONSULT_CATEGORIES } };
    if (req.query.category && consult.CONSULT_CATEGORIES.includes(String(req.query.category))) filter.category = String(req.query.category);
    if (req.query.city) filter.city = String(req.query.city);
    const listings = await Listing.find(filter).limit(500).lean();
    const partnerIds = [...new Set(listings.map((/** @type {any} */ l) => String(l.partnerId)))];
    const partners = await Partner.find({ _id: { $in: partnerIds }, active: true }).lean();
    const byId = new Map(partners.map((/** @type {any} */ p) => [String(p._id), p]));
    const items = listings.map((/** @type {any} */ l) => ({ listing: l, partner: byId.get(String(l.partnerId)) })).filter((/** @type {any} */ x) => x.partner);
    const budgetMaxCHF = req.query.budgetMax != null ? Number(req.query.budgetMax) : null;
    const at = (req.query.lat != null && req.query.lng != null) ? { lat: Number(req.query.lat), lng: Number(req.query.lng) } : null;
    const ranked = market.rank(items, { budgetMaxCHF, at });
    res.json({ results: ranked.slice(0, 30).map((/** @type {any} */ r) => ({ listing: pubListing(r.listing), partner: pubPartner(r.partner), factors: r.factors })) });
  } catch (err) { next(err); }
});

// Open, future slots for a consultation offering.
router.get('/listings/:id/slots', requireAuth, async (req, res, next) => {
  try {
    const slots = await Slot.find({ listingId: req.params.id, status: 'open' }).sort({ startsAt: 1 }).limit(100).lean();
    const now = Date.now();
    res.json({ slots: slots.filter((/** @type {any} */ s) => new Date(s.startsAt).getTime() > now).map(pubSlot) });
  } catch (err) { next(err); }
});

// ==== Consumer: book a slot =================================================
router.post('/book', requireAuth, async (req, res, next) => {
  try {
    const parsed = z.object({ slotId: z.string().min(1) }).safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'slotId required' });
    const slot = await Slot.findById(parsed.data.slotId);
    if (!slot || slot.status !== 'open') return res.status(409).json({ error: 'Slot is not available' });
    const listing = await Listing.findById(slot.listingId);
    if (!listing || !listing.active) return res.status(404).json({ error: 'Offering unavailable' });
    const partner = await Partner.findById(slot.partnerId);
    if (!partner || !partner.active) return res.status(404).json({ error: 'Consultant unavailable' });

    const { order, session } = await consult.bookSlot({ userId: req.userId, listing, partner, slot });
    // Payable order on the REAL rail (dev + Razorpay), like marketplace/gift-pass/verification —
    // returns { devMode, orderId, key, amount, currency, payment, ... } that payDirectOrder drives.
    // Pay + confirm via the shared /marketplace/orders/:id/confirm-payment (which capture-gates escrow).
    const quoted = await /** @type {any} */ (require('./routes-payment')).createQuotedOrder({
      userId: req.userId, purpose: 'marketplace_order', amountCHF: order.amountCHF, label: listing.title,
      metadata: { orderId: String(order._id), sessionId: String(session._id), listingId: String(listing._id), partnerId: String(partner._id) },
    });
    await Order.findByIdAndUpdate(order._id, { paymentId: quoted.payment._id });
    res.status(201).json({ session: pubSession(session), order: quoted, marketplaceOrderId: order._id, listingTitle: listing.title });
  } catch (err) {
    if (/available|taken/i.test(msg(err))) return res.status(409).json({ error: msg(err) });
    next(err);
  }
});

// My sessions.
router.get('/sessions', requireAuth, async (req, res, next) => {
  try { res.json({ sessions: (await Session.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(100).lean()).map(pubSession) }); }
  catch (err) { next(err); }
});

/** Load a session owned by the caller (404 otherwise). @param {any} req @param {any} res */
async function mySession(req, res) {
  const s = await Session.findById(req.params.id);
  if (!s || String(s.userId) !== String(req.userId)) { res.status(404).json({ error: 'Session not found' }); return null; }
  return s;
}

// Buyer cancels a booking before it's fulfilled → refund + free the slot.
router.post('/sessions/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const session = await mySession(req, res); if (!session) return;
    const updated = await consult.cancelBooking(session);
    res.json({ session: pubSession(updated) });
  } catch (err) { return res.status(409).json({ error: msg(err) }); }
});

// ==== Staff / consultant: availability + running the session ================
router.post('/listings/:id/slots', staff, async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    const partner = await Partner.findById(listing.partnerId);
    if (!partner || !consult.CONSULT_CATEGORIES.includes(partner.category)) return res.status(400).json({ error: 'Not a consultation listing' });
    const parsed = z.object({ startsAt: z.string().datetime(), durationMin: z.number().int().positive().max(600).optional() }).safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'startsAt (ISO) required' });
    const slot = await consult.publishSlot({ partner, listing, startsAt: parsed.data.startsAt, durationMin: parsed.data.durationMin });
    res.status(201).json({ slot: pubSlot(slot) });
  } catch (err) { next(err); }
});

async function staffSessionAction(/** @type {any} */ req, /** @type {any} */ res, /** @type {'start'|'end'} */ action) {
  const session = await Session.findById(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  try {
    const updated = action === 'start' ? await consult.startSession(session) : await consult.endSession(session);
    res.json({ session: pubSession(updated) });
  } catch (err) { res.status(409).json({ error: msg(err) }); }
}
router.post('/sessions/:id/start', staff, (req, res) => staffSessionAction(req, res, 'start'));
router.post('/sessions/:id/end', staff, (req, res) => staffSessionAction(req, res, 'end'));

module.exports = router;
