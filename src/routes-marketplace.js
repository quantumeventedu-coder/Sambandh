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
const User = require('./models/User');
const Review = require('./models/Review');
const market = require('./services/marketplace');
const coupons = require('./services/coupons');
const { sharesActiveMatch } = require('./services/verification-service');

const router = express.Router();
const staff = requireSuperOrScope('market:manage');

const msg = (/** @type {unknown} */ e) => (e instanceof Error ? e.message : String(e));
// In-app notify (best-effort; never blocks the response). Lazy require avoids a require cycle.
const notify = (/** @type {any} */ uid, /** @type {any} */ n) => {
  try { return /** @type {any} */ (require('./routes-notifications')).deliverNotification(uid, n).catch(() => {}); }
  catch { return Promise.resolve(); }
};

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
// `callerId` makes the address privacy-aware: the buyer of a GIFT must NEVER see the
// recipient's private delivery address. Pass req.userId at buyer/recipient-facing sites;
// omit it for staff serialisation (staff need the address to fulfil).
const pubOrder = (/** @type {any} */ o, /** @type {any} */ callerId = null) => o && ({
  id: o._id, listingId: o.listingId, partnerId: o.partnerId, kind: o.kind,
  amountCHF: o.amountCHF, status: o.status, escrowHeld: !!o.escrowHeld,
  giftForUserId: o.giftForUserId || null, giftStatus: o.giftStatus || 'none',
  shippingAddress: (o.giftForUserId && callerId && String(callerId) === String(o.userId)) ? null : (o.shippingAddress || null),
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
const addressSchema = z.object({
  name: z.string().min(1).max(120), phone: z.string().min(5).max(20),
  line1: z.string().min(1).max(200), line2: z.string().max(200).optional(),
  city: z.string().min(1).max(80), state: z.string().max(80).optional(),
  pincode: z.string().min(3).max(12), landmark: z.string().max(120).optional(),
  country: z.string().max(3).optional()
}).optional();
const orderSchema = z.object({
  listingId: z.string().min(1),
  scheduledFor: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
  shippingAddress: addressSchema,               // required for physical products (enforced in createOrder)
  giftForUserId: z.string().max(64).optional(), // buying a physical product as a gift for a match
  couponCode: z.string().max(40).optional()     // discount coupon applied at checkout
});

router.post('/orders', requireAuth, async (req, res, next) => {
  try {
    const parsed = orderSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'listingId required' });
    const listing = await Listing.findById(parsed.data.listingId);
    if (!listing || !listing.active) return res.status(404).json({ error: 'Listing not found' });
    const partner = await Partner.findById(listing.partnerId);
    if (!partner || !partner.active) return res.status(404).json({ error: 'Partner unavailable' });

    // Gifting is only ever to a real, mutual match — never a stranger, never yourself.
    const giftFor = parsed.data.giftForUserId;
    if (giftFor) {
      if (String(giftFor) === String(req.userId)) return res.status(400).json({ error: "You can't gift yourself." });
      if (!(await sharesActiveMatch(req.userId, giftFor))) return res.status(403).json({ error: 'You can only send a gift to one of your matches.' });
    }
    // Validate a coupon (if any) BEFORE reserving stock, so a bad code never strands inventory.
    if (parsed.data.couponCode) await coupons.validate(parsed.data.couponCode, 'marketplace_order', market.quote(listing, partner).amountCHF, req.userId);
    const order = await market.createOrder({
      userId: req.userId, listing, partner,
      scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : undefined,
      notes: parsed.data.notes,
      shippingAddress: parsed.data.shippingAddress,
      giftForUserId: giftFor
    });
    // Payable order on the REAL rail (dev + Razorpay), exactly like gift-pass/verification —
    // returns { devMode, orderId, key, amount, currency, payment, ... } that payDirectOrder drives.
    // Escrow still only holds once confirm-payment sees the linked Payment 'captured'.
    let quoted;
    try {
      quoted = await /** @type {any} */ (require('./routes-payment')).createQuotedOrder({
        userId: req.userId, purpose: 'marketplace_order', amountCHF: order.amountCHF, label: listing.title,
        couponCode: parsed.data.couponCode, maxDiscountCHF: order.commissionCHF,   // discount is platform-funded, never the partner payout
        metadata: { orderId: String(order._id), listingId: String(listing._id), partnerId: String(partner._id), commissionCHF: order.commissionCHF }
      });
    } catch (e) {
      await market.transition(order, 'cancelled').catch(() => {});   // roll back the reserved stock/escrow if pricing fails
      throw e;
    }
    await Order.findByIdAndUpdate(order._id, { paymentId: quoted.payment._id });
    res.status(201).json({ order: quoted, marketplaceOrderId: order._id, listingTitle: listing.title, isGift: !!giftFor });
  } catch (err) {
    if (err && /** @type {any} */ (err).coupon) return res.status(400).json({ error: msg(err) });   // invalid/exhausted coupon
    if (/delivery address/i.test(msg(err))) return res.status(400).json({ error: msg(err) });
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
    res.json({ orders: orders.map((/** @type {any} */ o) => pubOrder(o, req.userId)) });
  } catch (err) { next(err); }
});

// Buyer confirms the linked payment was captured → escrow holds. (In production the
// payment webhook drives this; the guard makes escrow impossible without capture.)
router.post('/orders/:id/confirm-payment', requireAuth, async (req, res, next) => {
  try {
    const order = await myOrder(req, res); if (!order) return;
    const payment = order.paymentId ? await Payment.findById(order.paymentId) : null;
    if (!payment || payment.status !== 'captured') return res.status(402).json({ error: 'Payment not captured' });
    // The order may have been cancelled/refunded or the gift declined BEFORE this (possibly
    // async UPI/webhook) capture landed — reverse the charge instead of stranding the buyer's
    // money in a dead-end 409. (A nightly sweep, market.reconcileStrandedOrders, is the backstop.)
    if (['cancelled', 'refunded'].includes(order.status) || order.giftStatus === 'declined') {
      await market.atomicUpdate(Payment, { _id: payment._id, status: 'captured' }, { $set: { status: 'refunded', refundedAt: new Date() } });
      return res.status(409).json({ error: 'This order is no longer active; the payment has been refunded.' });
    }
    const updated = await market.transition(order, 'paid', { paymentId: payment._id });
    // A gift only reaches the recipient once it's actually paid — notify them now to accept.
    if (order.giftForUserId) {
      const buyer = await User.findById(order.userId).select('profile.firstName').lean();
      const from = (buyer && buyer.profile && buyer.profile.firstName) || 'A match';
      const acceptHint = order.kind === 'product' ? 'Open Gifts to accept and choose your delivery address.' : 'Open it to accept.';
      notify(order.giftForUserId, { type: 'gift_received', severity: 'info', title: 'You’ve received a gift 🎁', body: `${from} sent you a gift. ${acceptHint}` });
    }
    res.json({ order: pubOrder(updated, req.userId) });
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
    res.json({ order: pubOrder(updated, req.userId) });
  } catch (err) { return res.status(409).json({ error: msg(err) }); }
});

router.post('/orders/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const order = await myOrder(req, res); if (!order) return;
    const updated = await market.transition(order, 'cancelled');
    res.json({ order: pubOrder(updated, req.userId) });
  } catch (err) { return res.status(409).json({ error: msg(err) }); }
});

router.post('/orders/:id/dispute', requireAuth, async (req, res, next) => {
  try {
    const order = await myOrder(req, res); if (!order) return;
    const updated = await market.transition(order, 'disputed', { disputeReason: String((req.body && req.body.reason) || '').slice(0, 500) });
    res.json({ order: pubOrder(updated, req.userId) });
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

// Public: read a partner's verified-purchase reviews (newest first).
router.get('/partners/:id/reviews', requireAuth, async (req, res, next) => {
  try {
    const reviews = await Review.find({ partnerId: req.params.id }).sort({ createdAt: -1 }).limit(50).lean();
    const userIds = [...new Set(reviews.map((/** @type {any} */ rv) => rv.userId && String(rv.userId)).filter(Boolean))];
    const users = await User.find({ _id: { $in: userIds } }).select('profile.firstName').lean();
    const uById = new Map(users.map((/** @type {any} */ u) => [String(u._id), u]));
    const out = reviews.map((/** @type {any} */ rv) => {
      const u = uById.get(String(rv.userId));
      return { id: rv._id, rating: rv.rating, text: rv.text || '', by: (u && u.profile && u.profile.firstName) || 'Verified buyer', verified: !!rv.verifiedPurchase, at: rv.createdAt };
    });
    res.json({ reviews: out, count: out.length });
  } catch (err) { next(err); }
});

// ==== Gift recipient: accept (with a PRIVATE address) or decline =============
/** Owner-check keyed on the RECIPIENT (giftForUserId), not the buyer. Scoped to PHYSICAL products —
 * a consultation-booking gift must be accepted/declined via /consultation (which also frees the slot
 * and transfers the session); routing it through here would corrupt that state. @param {any} req @param {any} res */
async function myGift(req, res) {
  const order = await Order.findById(req.params.id);
  if (!order || String(order.giftForUserId) !== String(req.userId) || order.kind !== 'product') { res.status(404).json({ error: 'Gift not found' }); return null; }
  return order;
}

// Gifts awaiting me — only ones the buyer has actually paid for (status paid+).
router.get('/orders/gifts', requireAuth, async (req, res, next) => {
  try {
    const pending = await Order.find({ giftForUserId: req.userId, giftStatus: 'pending' }).sort({ createdAt: -1 }).limit(100).lean();
    const paid = pending.filter((/** @type {any} */ o) => o.kind === 'product' && ['paid', 'confirmed', 'fulfilled'].includes(o.status));   // consultation gifts live under /consultation/gifts
    const out = [];
    for (const o of paid) {
      const [listing, buyer] = await Promise.all([
        Listing.findById(o.listingId).lean(),
        User.findById(o.userId).select('profile.firstName').lean(),
      ]);
      out.push({
        id: o._id, kind: o.kind, amountCHF: o.amountCHF, status: o.status,
        listing: listing ? { title: listing.title, description: listing.description } : null,
        from: (buyer && buyer.profile && buyer.profile.firstName) || 'A match',
        needsAddress: o.kind === 'product', createdAt: o.createdAt,
      });
    }
    res.json({ gifts: out });
  } catch (err) { next(err); }
});

// Recipient accepts + (for products) supplies THEIR OWN address. Atomic pending→accepted.
router.post('/orders/:id/accept-gift', requireAuth, async (req, res, next) => {
  try {
    const order = await myGift(req, res); if (!order) return;
    if (order.giftStatus !== 'pending') return res.status(409).json({ error: 'This gift is no longer pending.' });
    let addr = null;
    if (order.kind === 'product') {
      addr = market.normalizeAddress(req.body && req.body.shippingAddress);
      if (!addr) return res.status(400).json({ error: 'A delivery address (name, phone, street, city, PIN) is required.' });
    }
    const won = await market.atomicUpdate(Order, { _id: order._id, giftStatus: 'pending' }, { $set: { giftStatus: 'accepted', shippingAddress: addr, giftRespondedAt: new Date() } });
    if (!won) return res.status(409).json({ error: 'This gift is no longer pending.' });
    notify(order.userId, { type: 'gift_received', severity: 'info', title: 'Your gift was accepted 🎁', body: 'Your match accepted your gift — it will be prepared for delivery.' });
    const fresh = await Order.findById(order._id).lean();
    res.json({ ok: true, order: pubOrder(fresh, req.userId) });
  } catch (err) { next(err); }
});

// Recipient declines → escrow-safe reversal of the buyer's payment. The money reversal is
// AUTHORITATIVE and runs FIRST: we only mark the gift 'declined' once the refund actually
// succeeded, we never swallow the failure into a false "refunded", and we handle every money
// state that still holds funds — INCLUDING 'disputed' (so a disputed gift can't be left stranded
// or later resolved to a payout). A failed reversal stays retryable (giftStatus remains 'pending').
router.post('/orders/:id/decline-gift', requireAuth, async (req, res, next) => {
  try {
    const order = await myGift(req, res); if (!order) return;
    if (order.giftStatus !== 'pending') return res.status(409).json({ error: 'This gift is no longer pending.' });
    if (['fulfilled', 'completed'].includes(order.status)) return res.status(409).json({ error: 'This gift has already been prepared for delivery.' });
    let refunded = false;
    try {
      if (order.status === 'created') { await market.transition(order, 'cancelled'); refunded = true; }
      else if (['paid', 'confirmed', 'disputed'].includes(order.status)) { await market.transition(order, 'refunded'); refunded = true; }
      // (already 'cancelled'/'refunded' → nothing to reverse; refunded stays false)
    } catch { return res.status(409).json({ error: 'Could not process the decline right now — please try again.' }); }
    // Mark declined only AFTER a successful (or unnecessary) reversal. The transition's own CAS
    // on status is the serialisation point, so concurrent declines can't double-refund.
    await market.atomicUpdate(Order, { _id: order._id, giftStatus: 'pending' }, { $set: { giftStatus: 'declined', giftRespondedAt: new Date() } });
    notify(order.userId, { type: 'gift_received', severity: 'info', title: 'Your gift was declined', body: refunded ? 'Your match declined the gift; the payment has been refunded.' : 'Your match declined the gift.' });
    res.json({ ok: true, declined: true, refunded });
  } catch (err) { next(err); }
});

// Giftable matches for the picker — REVEALED matches only (you gift someone you know);
// an anonymous match's identity is never exposed here. Gift creation is still gated by
// sharesActiveMatch server-side, so this is only the convenience list.
router.get('/gift-recipients', requireAuth, async (req, res, next) => {
  try {
    const Chat = require('./models/Chat');
    const chats = await Chat.find({ participants: req.userId, status: 'active' }).limit(50).lean();
    const out = [];
    for (const c of chats) {
      const otherId = (c.participants || []).find((/** @type {any} */ p) => String(p) !== String(req.userId));
      if (!otherId) continue;
      if (c.anonymity && c.anonymity.isAnonymous && !c.anonymity.revealedAt) continue;   // keep anonymous matches anonymous
      const u = await User.findById(otherId).select('profile.firstName profile.photos').lean();
      if (!u) continue;
      out.push({ userId: otherId, name: (u.profile && u.profile.firstName) || 'Match', photo: (u.profile && u.profile.photos && u.profile.photos[0] && u.profile.photos[0].url) || null });
    }
    res.json({ recipients: out });
  } catch (err) { next(err); }
});

// ==== Staff: partners + listings (market:manage) ============================
/** The acting staff member's email (or the owner). @param {any} req */
const actorOf = (req) => (req.staff && req.staff.email) || 'super-admin';
/** Full staff-facing partner detail — KYB fields + document metadata (never raw bytes/URLs). @param {any} p */
const staffPartner = (p) => p && ({
  id: p._id, name: p.name, category: p.category, type: p.type || 'individual',
  legalName: p.legalName, registration: p.registration || { kind: 'none' },
  contactPerson: p.contactPerson || {}, address: p.address, website: p.website,
  city: p.city, email: p.email, phone: p.phone, tier: p.tier || 'standard',
  bio: p.bio || '', languages: p.languages || [], experienceYears: p.experienceYears ?? null, photoUrl: p.photoUrl || '',
  verified: !!p.verified, active: p.active !== false, suspended: !!p.suspended, suspendReason: p.suspendReason,
  verification: p.verification || { status: 'unverified' },
  documents: (p.documents || []).map((/** @type {any} */ d, /** @type {number} */ i) => ({ index: i, type: d.type, evidenceHash: d.evidenceHash, aavDecision: d.aavDecision, mime: d.mime, size: d.size, uploadedBy: d.uploadedBy, uploadedAt: d.uploadedAt })),
  commissionRate: p.commissionRate, ratingAvg: p.ratingAvg || 0, ratingCount: p.ratingCount || 0,
  onboardedBy: p.onboardedBy, createdAt: p.createdAt
});

const partnerSchema = z.object({
  name: z.string().min(1), category: z.enum(/** @type {any} */ (Partner.CATEGORIES)),
  type: z.enum(/** @type {any} */ (Partner.PARTNER_TYPES)).optional(),
  legalName: z.string().max(200).optional(),
  registration: z.object({ kind: z.enum(/** @type {any} */ (Partner.REG_KINDS)), number: z.string().max(60).optional() }).optional(),
  contactPerson: z.object({ name: z.string().max(120).optional(), email: z.string().email().optional(), phone: z.string().max(30).optional() }).optional(),
  address: z.string().max(400).optional(), website: z.string().max(200).optional(),
  city: z.string().optional(), location: z.object({ lat: z.number(), lng: z.number() }).optional(),
  email: z.string().email().optional(), phone: z.string().optional(),
  tier: z.enum(/** @type {any} */ (Partner.PARTNER_TIERS)).optional(),
  commissionRate: z.number().min(0).max(0.9).optional()
});

router.post('/partners', staff, async (req, res, next) => {
  try {
    const parsed = partnerSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'name + valid category required' });
    const actor = actorOf(/** @type {any} */(req));
    const partner = await Partner.create({
      ...parsed.data, onboardedBy: actor, createdBy: actor,
      verification: { status: 'unverified' }, verified: false, active: true, createdAt: new Date()
    });
    res.status(201).json({ partner: staffPartner(partner) });
  } catch (err) { next(err); }
});

router.get('/partners', staff, async (req, res, next) => {
  try {
    /** @type {Record<string, any>} */ const filter = {};
    if (req.query.category) filter.category = String(req.query.category);
    if (req.query.status) filter['verification.status'] = String(req.query.status);
    const partners = await Partner.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    res.json({ partners: partners.map(staffPartner) });
  } catch (err) { next(err); }
});

router.get('/partners/:id', staff, async (req, res, next) => {
  try {
    const p = await Partner.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Partner not found' });
    res.json({ partner: staffPartner(p) });
  } catch (err) { next(err); }
});

router.patch('/partners/:id', staff, async (req, res, next) => {
  try {
    /** @type {Record<string, any>} */ const set = {};
    const b = req.body || {};
    for (const k of ['name', 'legalName', 'address', 'website', 'city', 'email', 'phone']) if (typeof b[k] === 'string') set[k] = b[k];
    // Consumer-facing profile fields.
    if (typeof b.bio === 'string') set.bio = b.bio.slice(0, 1500);
    if (typeof b.photoUrl === 'string') set.photoUrl = b.photoUrl.slice(0, 500);
    if (b.experienceYears != null && Number.isFinite(Number(b.experienceYears))) set.experienceYears = Math.max(0, Math.min(80, Math.round(Number(b.experienceYears))));
    if (Array.isArray(b.languages)) set.languages = b.languages.filter((/** @type {any} */ x) => typeof x === 'string').slice(0, 12);
    if (b.type && Partner.PARTNER_TYPES.includes(b.type)) set.type = b.type;
    if (b.category && Partner.CATEGORIES.includes(b.category)) set.category = b.category;
    // Nested KYB objects: set only the subfields provided (never wipe the rest).
    if (b.registration && typeof b.registration === 'object') {
      if (Partner.REG_KINDS.includes(b.registration.kind)) set['registration.kind'] = b.registration.kind;
      if (typeof b.registration.number === 'string') set['registration.number'] = b.registration.number.slice(0, 60);
    }
    if (b.contactPerson && typeof b.contactPerson === 'object') {
      const cp = b.contactPerson;
      if (typeof cp.name === 'string') set['contactPerson.name'] = cp.name.slice(0, 120);
      if (typeof cp.phone === 'string') set['contactPerson.phone'] = cp.phone.slice(0, 30);
      if (typeof cp.email === 'string' && cp.email) {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cp.email)) return res.status(400).json({ error: 'Invalid contact email' });
        set['contactPerson.email'] = cp.email.slice(0, 120);
      }
    }
    // active + suspended are coupled: suspending deactivates; reactivating clears suspension.
    if (typeof b.suspended === 'boolean') { set.suspended = b.suspended; set.suspendedAt = b.suspended ? new Date() : null; if (b.suspended) { set.active = false; set.suspendReason = String(b.suspendReason || '').slice(0, 300); } }
    if (b.active === true) { set.active = true; set.suspended = false; set.suspendedAt = null; }
    else if (b.active === false) set.active = false;
    if (b.tier && Partner.PARTNER_TIERS.includes(b.tier)) set.tier = b.tier;
    if (typeof b.commissionRate === 'number' && b.commissionRate >= 0 && b.commissionRate <= 0.9) set.commissionRate = b.commissionRate;
    if (!Object.keys(set).length) return res.status(400).json({ error: 'Nothing to update' });
    const p = await Partner.findByIdAndUpdate(req.params.id, set, { new: true });
    if (!p) return res.status(404).json({ error: 'Partner not found' });
    res.json({ partner: staffPartner(p) });
  } catch (err) { next(err); }
});

// ---- KYB: submit an authentication document (AAV-scanned, encrypted at rest) ----
const partnerDocSchema = z.object({ type: z.enum(/** @type {any} */ (Partner.PARTNER_DOC_TYPES)), base64: z.string().min(1), filename: z.string().optional() });
router.post('/partners/:id/documents', staff, async (req, res, next) => {
  try {
    const p = await Partner.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Partner not found' });
    const parsed = partnerDocSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'type + document required' });
    const buf = Buffer.from(parsed.data.base64, 'base64');
    if (!buf.length) return res.status(400).json({ error: 'Empty document' });
    if (buf.length > 12 * 1024 * 1024) return res.status(400).json({ error: 'Document too large (max 12 MB)' });
    const t = await require('./services/trust').evaluateDocument(buf, { filename: parsed.data.filename, userId: String(p._id) });
    if (t.decision === 'reject') return res.status(400).json({ error: 'Only image or PDF documents are accepted, and the file failed the security scan' });
    const crypto = require('crypto');
    const vault = require('./services/vault');
    const { blob, keyVersion } = vault.encrypt(buf);
    const key = `partners/${p._id}/docs/${crypto.randomBytes(10).toString('hex')}.enc`;
    await require('./services/storage').uploadFile(key, blob, 'application/octet-stream');
    const doc = {
      type: parsed.data.type, storageKey: key, keyVersion,
      evidenceHash: crypto.createHash('sha256').update(buf).digest('hex'),
      mime: t.fileType ? `application/${t.fileType}` : 'application/octet-stream',
      size: buf.length, aavDecision: t.decision, uploadedBy: actorOf(/** @type {any} */(req)), uploadedAt: new Date()
    };
    // New evidence → back to pending review; drop the trust badge until re-verified.
    await Partner.findByIdAndUpdate(p._id, { $push: { documents: doc }, $set: { 'verification.status': 'pending', verified: false, verifiedAt: null } });
    res.status(201).json({ document: { type: doc.type, evidenceHash: doc.evidenceHash, aavDecision: t.decision, uploadedAt: doc.uploadedAt } });
  } catch (err) { next(err); }
});

// View a submitted document (decrypted server-side, staff only).
router.get('/partners/:id/documents/:index/content', staff, async (req, res, next) => {
  try {
    const p = await Partner.findById(req.params.id);
    const doc = p && (p.documents || [])[Number(req.params.index)];
    if (!doc || !doc.storageKey) return res.status(404).json({ error: 'Document not found' });
    const vault = require('./services/vault');
    const blob = await require('./services/storage').readFile(doc.storageKey);
    const buf = vault.decrypt(blob, doc.keyVersion);
    res.setHeader('Content-Type', doc.mime || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // PDFs are downloaded, never rendered inline (active content is caught by the AAV
    // scan, but attachment is defence in depth); images may be viewed inline.
    res.setHeader('Content-Disposition', (doc.mime === 'application/pdf' ? 'attachment' : 'inline') + '; filename="partner-document"');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buf);
  } catch (err) {
    if (/integrity|corrupt/i.test(msg(err))) return res.status(422).json({ error: 'Document integrity check failed' });
    next(err);
  }
});

// ---- KYB decision: verify / reject (named staff member, audit-logged) ----
async function partnerAudit(/** @type {any} */ req, /** @type {string} */ action, /** @type {any} */ partnerId, /** @type {any} */ detail) {
  try { await require('./models/AuditLog').create({ actor: actorOf(/** @type {any} */(req)), action, targetType: 'partner', targetId: String(partnerId), detail }); }
  catch { /* audit must not break the op */ }
}
router.post('/partners/:id/verify', staff, async (req, res, next) => {
  try {
    const p = await Partner.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Partner not found' });
    const actor = actorOf(/** @type {any} */(req));
    const updated = await Partner.findByIdAndUpdate(p._id, {
      verified: true, verifiedAt: new Date(),
      'verification.status': 'verified', 'verification.reviewedBy': actor, 'verification.reviewedAt': new Date(),
      'verification.notes': String((req.body || {}).notes || '').slice(0, 500)
    }, { new: true });
    await partnerAudit(req, 'partner_verified', p._id, { name: p.name });
    res.json({ partner: staffPartner(updated) });
  } catch (err) { next(err); }
});
router.post('/partners/:id/reject', staff, async (req, res, next) => {
  try {
    const reason = String((req.body || {}).reason || '').slice(0, 500);
    if (!reason) return res.status(400).json({ error: 'A rejection reason is required' });
    const p = await Partner.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Partner not found' });
    const updated = await Partner.findByIdAndUpdate(p._id, {
      verified: false, 'verification.status': 'rejected', 'verification.reviewedBy': actorOf(/** @type {any} */(req)),
      'verification.reviewedAt': new Date(), 'verification.notes': reason
    }, { new: true });
    await partnerAudit(req, 'partner_rejected', p._id, { reason });
    res.json({ partner: staffPartner(updated) });
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
