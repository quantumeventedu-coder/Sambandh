// @ts-check
// routes-marketplace.js — native Sambandh marketplace (mounted at /api/marketplace).
//
// Consumers (requireAuth): browse budget-aware/local-first ranked listings, place
// orders on the existing Payment rail, run the escrow lifecycle, review purchases.
// Staff (market:manage): onboard partners, manage listings, act on orders.
//
// No third party: commission/escrow/ranking are all services/marketplace.js. Buyer
// money is only held once the linked Payment is actually 'captured', and payouts are
// only "released" when the buyer completes the order — enforced fail-closed.
const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('./routes-auth');
const { requireSuperOrScope } = require('./services/dev-auth');
const Partner = require('./models/Partner');
const Listing = require('./models/Listing');
const Order = require('./models/Order');
const Payment = require('./models/Payment');
const market = require('./services/marketplace');

const router = express.Router();
const staff = requireSuperOrScope('market:manage');

const msg = (/** @type {unknown} */ e) => (e instanceof Error ? e.message : String(e));

// ---- serialisers (never leak commission, contact, or internal fields to buyers) --
const pubPartner = (/** @type {any} */ p) => p && ({
  id: p._id, name: p.name, category: p.category, city: p.city,
  tier: p.tier, verified: !!p.verified, ratingAvg: p.ratingAvg || 0, ratingCount: p.ratingCount || 0
});
const pubListing = (/** @type {any} */ l) => l && ({
  id: l._id, partnerId: l.partnerId, title: l.title, description: l.description,
  category: l.category, kind: l.kind, priceCHF: l.priceCHF, tierBand: l.tierBand,
  city: l.city, featured: !!l.featured, stock: l.stock, active: l.active
});
const pubOrder = (/** @type {any} */ o) => o && ({
  id: o._id, listingId: o.listingId, partnerId: o.partnerId, kind: o.kind,
  amountCHF: o.amountCHF, status: o.status, escrowHeld: !!o.escrowHeld,
  scheduledFor: o.scheduledFor, createdAt: o.createdAt, paymentId: o.paymentId
});

// ==== Consumer: browse ======================================================
router.get('/listings', requireAuth, async (req, res, next) => {
  try {
    /** @type {Record<string, any>} */ const filter = { active: true };
    if (req.query.category) filter.category = String(req.query.category);
    if (req.query.city) filter.city = String(req.query.city);
    if (req.query.tierBand) filter.tierBand = String(req.query.tierBand);
    const listings = await Listing.find(filter).limit(500).lean();
    const partnerIds = [...new Set(listings.map((/** @type {any} */ l) => String(l.partnerId)))];
    const partners = await Partner.find({ _id: { $in: partnerIds }, active: true }).lean();
    const byId = new Map(partners.map((/** @type {any} */ p) => [String(p._id), p]));
    const items = listings
      .map((/** @type {any} */ l) => ({ listing: l, partner: byId.get(String(l.partnerId)) }))
      .filter((/** @type {any} */ x) => x.partner);   // hide listings whose partner is inactive

    const budgetMaxCHF = req.query.budgetMax != null ? Number(req.query.budgetMax) : null;
    const at = (req.query.lat != null && req.query.lng != null)
      ? { lat: Number(req.query.lat), lng: Number(req.query.lng) } : null;
    const ranked = market.rank(items, { budgetMaxCHF, at });
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    res.json({
      results: ranked.slice(0, limit).map(r => ({
        listing: pubListing(r.listing), partner: pubPartner(r.partner),
        score: r.score, factors: r.factors, sponsored: r.factors.placement > 0
      }))
    });
  } catch (err) { next(err); }
});

router.get('/listings/:id', requireAuth, async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id).lean();
    if (!listing || !listing.active) return res.status(404).json({ error: 'Listing not found' });
    const partner = await Partner.findById(listing.partnerId).lean();
    res.json({ listing: pubListing(listing), partner: pubPartner(partner) });
  } catch (err) { next(err); }
});

// ==== Consumer: order + escrow lifecycle ====================================
const orderSchema = z.object({
  listingId: z.string().min(1),
  scheduledFor: z.string().datetime().optional(),
  notes: z.string().max(1000).optional()
});

router.post('/orders', requireAuth, async (req, res, next) => {
  try {
    const parsed = orderSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'listingId required' });
    const listing = await Listing.findById(parsed.data.listingId);
    if (!listing || !listing.active) return res.status(404).json({ error: 'Listing not found' });
    const partner = await Partner.findById(listing.partnerId);
    if (!partner || !partner.active) return res.status(404).json({ error: 'Partner unavailable' });

    const order = await market.createOrder({
      userId: req.userId, listing, partner,
      scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : undefined,
      notes: parsed.data.notes
    });
    // Payment on the existing rail; escrow only holds once this is 'captured'.
    const payment = await Payment.create({
      userId: req.userId, purpose: 'marketplace_order', amountCHF: order.amountCHF,
      currency: 'CHF', status: 'created',
      metadata: { orderId: String(order._id), listingId: String(listing._id), partnerId: String(partner._id), commissionCHF: order.commissionCHF }
    });
    await Order.findByIdAndUpdate(order._id, { paymentId: payment._id });
    res.status(201).json({ order: pubOrder({ ...order, paymentId: payment._id }), payment: { id: payment._id, amountCHF: payment.amountCHF, status: payment.status } });
  } catch (err) {
    if (/stock|unavailable/i.test(msg(err))) return res.status(409).json({ error: msg(err) });
    next(err);
  }
});

/** Owner-only order fetch (throws 404 for other users' orders). @param {any} req @param {any} res */
async function myOrder(req, res) {
  const order = await Order.findById(req.params.id);
  if (!order || String(order.userId) !== String(req.userId)) { res.status(404).json({ error: 'Order not found' }); return null; }
  return order;
}

router.get('/orders', requireAuth, async (req, res, next) => {
  try {
    const orders = await Order.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ orders: orders.map(pubOrder) });
  } catch (err) { next(err); }
});

// Buyer confirms the linked payment was captured → escrow holds. (In production the
// payment webhook drives this; the guard makes escrow impossible without capture.)
router.post('/orders/:id/confirm-payment', requireAuth, async (req, res, next) => {
  try {
    const order = await myOrder(req, res); if (!order) return;
    const payment = order.paymentId ? await Payment.findById(order.paymentId) : null;
    if (!payment || payment.status !== 'captured') return res.status(402).json({ error: 'Payment not captured' });
    const updated = await market.transition(order, 'paid', { paymentId: payment._id });
    res.json({ order: pubOrder(updated) });
  } catch (err) { return res.status(409).json({ error: msg(err) }); }
});

// Buyer confirms the partner fulfilled → payout released from escrow. Must be
// 'fulfilled' first: this blocks the paid→disputed→completed self-release exploit —
// a disputed order can only be closed by staff via /resolve-dispute.
router.post('/orders/:id/complete', requireAuth, async (req, res, next) => {
  try {
    const order = await myOrder(req, res); if (!order) return;
    if (order.status !== 'fulfilled') return res.status(409).json({ error: 'Order is not awaiting your confirmation' });
    const updated = await market.transition(order, 'completed');
    res.json({ order: pubOrder(updated) });
  } catch (err) { return res.status(409).json({ error: msg(err) }); }
});

router.post('/orders/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const order = await myOrder(req, res); if (!order) return;
    const updated = await market.transition(order, 'cancelled');
    res.json({ order: pubOrder(updated) });
  } catch (err) { return res.status(409).json({ error: msg(err) }); }
});

router.post('/orders/:id/dispute', requireAuth, async (req, res, next) => {
  try {
    const order = await myOrder(req, res); if (!order) return;
    const updated = await market.transition(order, 'disputed', { disputeReason: String((req.body && req.body.reason) || '').slice(0, 500) });
    res.json({ order: pubOrder(updated) });
  } catch (err) { return res.status(409).json({ error: msg(err) }); }
});

router.post('/orders/:id/review', requireAuth, async (req, res, next) => {
  try {
    const order = await myOrder(req, res); if (!order) return;
    const rating = Number(req.body && req.body.rating);
    if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'rating must be 1–5' });
    const review = await market.addReview({ userId: req.userId, order, rating, text: req.body && req.body.text });
    res.status(201).json({ review: { id: review._id, rating: review.rating, text: review.text } });
  } catch (err) { return res.status(409).json({ error: msg(err) }); }
});

// ==== Staff: partners + listings (market:manage) ============================
const partnerSchema = z.object({
  name: z.string().min(1), category: z.enum(/** @type {any} */ (Partner.CATEGORIES)),
  city: z.string().optional(), location: z.object({ lat: z.number(), lng: z.number() }).optional(),
  email: z.string().email().optional(), phone: z.string().optional(),
  tier: z.enum(/** @type {any} */ (Partner.PARTNER_TIERS)).optional(),
  commissionRate: z.number().min(0).max(0.9).optional()
});

router.post('/partners', staff, async (req, res, next) => {
  try {
    const parsed = partnerSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'name + valid category required' });
    const st = /** @type {any} */ (req).staff;
    const actor = (st && st.email) || 'super-admin';
    const partner = await Partner.create({ ...parsed.data, createdBy: actor, createdAt: new Date() });
    res.status(201).json({ partner: { id: partner._id, ...parsed.data, verified: false, active: true } });
  } catch (err) { next(err); }
});

router.get('/partners', staff, async (req, res, next) => {
  try { res.json({ partners: (await Partner.find({}).sort({ createdAt: -1 }).limit(500).lean()) }); }
  catch (err) { next(err); }
});

router.patch('/partners/:id', staff, async (req, res, next) => {
  try {
    /** @type {Record<string, any>} */ const set = {};
    const b = req.body || {};
    if (typeof b.verified === 'boolean') { set.verified = b.verified; if (b.verified) set.verifiedAt = new Date(); }
    if (typeof b.active === 'boolean') set.active = b.active;
    if (b.tier && Partner.PARTNER_TIERS.includes(b.tier)) set.tier = b.tier;
    if (typeof b.commissionRate === 'number' && b.commissionRate >= 0 && b.commissionRate <= 0.9) set.commissionRate = b.commissionRate;
    if (!Object.keys(set).length) return res.status(400).json({ error: 'Nothing to update' });
    await Partner.findByIdAndUpdate(req.params.id, set);
    res.json({ ok: true, updated: Object.keys(set) });
  } catch (err) { next(err); }
});

const listingSchema = z.object({
  title: z.string().min(1), description: z.string().max(4000).optional(),
  kind: z.enum(/** @type {any} */ (Listing.LISTING_KINDS)).optional(),
  priceCHF: z.number().positive().max(10000000), tierBand: z.enum(/** @type {any} */ (Listing.TIER_BANDS)).optional(),
  city: z.string().optional(), location: z.object({ lat: z.number(), lng: z.number() }).optional(),
  deliveryRadiusKm: z.number().positive().max(20000).optional(), stock: z.number().int().nonnegative().max(1000000).optional()
});

router.post('/partners/:id/listings', staff, async (req, res, next) => {
  try {
    const partner = await Partner.findById(req.params.id);
    if (!partner) return res.status(404).json({ error: 'Partner not found' });
    const parsed = listingSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'title + positive priceCHF required' });
    const listing = await Listing.create({ partnerId: partner._id, category: partner.category, ...parsed.data, createdAt: new Date() });
    res.status(201).json({ listing: pubListing(listing) });
  } catch (err) { next(err); }
});

router.get('/partners/:id/listings', staff, async (req, res, next) => {
  try { res.json({ listings: (await Listing.find({ partnerId: req.params.id }).lean()).map(pubListing) }); }
  catch (err) { next(err); }
});

router.patch('/listings/:id', staff, async (req, res, next) => {
  try {
    /** @type {Record<string, any>} */ const set = {};
    const b = req.body || {};
    // Strict types (parity with create): reject "0"/floats that would corrupt money/stock.
    if (typeof b.priceCHF === 'number' && b.priceCHF > 0 && b.priceCHF <= 10000000) set.priceCHF = b.priceCHF;
    if (typeof b.active === 'boolean') set.active = b.active;
    if (typeof b.featured === 'boolean') { set.featured = b.featured; if (b.featured && b.featuredUntil) set.featuredUntil = new Date(b.featuredUntil); }
    if (Number.isInteger(b.stock) && b.stock >= 0 && b.stock <= 1000000) set.stock = b.stock;
    if (b.tierBand && Listing.TIER_BANDS.includes(b.tierBand)) set.tierBand = b.tierBand;
    if (!Object.keys(set).length) return res.status(400).json({ error: 'Nothing to update' });
    await Listing.findByIdAndUpdate(req.params.id, set);
    res.json({ ok: true, updated: Object.keys(set) });
  } catch (err) { next(err); }
});

// ==== Staff: fulfilment side of the escrow lifecycle ========================
/** @param {any} req @param {any} res @param {any} to @param {any} [opts] */
async function staffTransition(req, res, to, opts) {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  try { const updated = await market.transition(order, to, opts); res.json({ order: pubOrder(updated) }); }
  catch (err) { res.status(409).json({ error: msg(err) }); }
}
router.post('/orders/:id/confirm', staff, (req, res) => staffTransition(req, res, 'confirmed'));
router.post('/orders/:id/fulfill', staff, (req, res) => staffTransition(req, res, 'fulfilled'));
router.post('/orders/:id/refund', staff, (req, res) => staffTransition(req, res, 'refunded'));
router.post('/orders/:id/resolve-dispute', staff, (req, res) => {
  const outcome = (req.body && req.body.outcome) === 'refund' ? 'refunded' : 'completed';
  return staffTransition(req, res, outcome);
});

module.exports = router;
