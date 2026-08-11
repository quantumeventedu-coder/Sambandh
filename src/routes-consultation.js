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
const User = require('./models/User');
const market = require('./services/marketplace');
const coupons = require('./services/coupons');
const consult = require('./services/consultation');
const { sharesActiveMatch } = require('./services/verification-service');

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

// A consultant's PUBLIC profile — bio, credentials-at-a-glance, offerings + open-slot counts.
router.get('/consultants/:id', requireAuth, async (req, res, next) => {
  try {
    const partner = await Partner.findById(req.params.id).lean();
    if (!partner || partner.active === false || !consult.CONSULT_CATEGORIES.includes(partner.category)) return res.status(404).json({ error: 'Consultant not found' });
    const listings = await Listing.find({ partnerId: partner._id, active: true }).lean();
    const now = Date.now();
    const offerings = [];
    for (const l of listings) {
      const slots = await Slot.find({ listingId: l._id, status: 'open' }).lean();
      offerings.push({ listing: pubListing(l), openSlots: slots.filter((/** @type {any} */ s) => new Date(s.startsAt).getTime() > now).length });
    }
    res.json({
      partner: {
        id: partner._id, name: partner.name, category: partner.category, city: partner.city,
        verified: !!partner.verified, ratingAvg: partner.ratingAvg || 0, ratingCount: partner.ratingCount || 0,
        bio: partner.bio || '', languages: partner.languages || [], experienceYears: partner.experienceYears ?? null,
        photoUrl: partner.photoUrl || '', website: partner.website || '',
      },
      offerings,
    });
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
    const parsed = z.object({ slotId: z.string().min(1), couponCode: z.string().max(40).optional(), giftForUserId: z.string().max(64).optional() }).safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'slotId required' });
    const slot = await Slot.findById(parsed.data.slotId);
    if (!slot || slot.status !== 'open') return res.status(409).json({ error: 'Slot is not available' });
    const listing = await Listing.findById(slot.listingId);
    if (!listing || !listing.active) return res.status(404).json({ error: 'Offering unavailable' });
    const partner = await Partner.findById(slot.partnerId);
    if (!partner || !partner.active) return res.status(404).json({ error: 'Consultant unavailable' });

    // Gifting a session is only to a real, mutual match — never a stranger, never yourself.
    const giftFor = parsed.data.giftForUserId;
    if (giftFor) {
      if (String(giftFor) === String(req.userId)) return res.status(400).json({ error: "You can't gift yourself." });
      if (!(await sharesActiveMatch(req.userId, giftFor))) return res.status(403).json({ error: 'You can only gift a session to one of your matches.' });
    }
    // Validate a coupon (if any) BEFORE reserving the slot, so a bad code never strands it.
    if (parsed.data.couponCode) await coupons.validate(parsed.data.couponCode, 'marketplace_order', consult.priceForListing(listing), req.userId);
    const { order, session } = await consult.bookSlot({ userId: req.userId, listing, partner, slot, giftForUserId: giftFor });
    // Payable order on the REAL rail (dev + Razorpay), like marketplace/gift-pass/verification —
    // returns { devMode, orderId, key, amount, currency, payment, ... } that payDirectOrder drives.
    // Pay + confirm via the shared /marketplace/orders/:id/confirm-payment (which capture-gates escrow).
    let quoted;
    try {
      quoted = await /** @type {any} */ (require('./routes-payment')).createQuotedOrder({
        userId: req.userId, purpose: 'marketplace_order', amountCHF: order.amountCHF, label: listing.title,
        couponCode: parsed.data.couponCode, maxDiscountCHF: order.commissionCHF,   // discount is platform-funded, never the consultant payout
        metadata: { orderId: String(order._id), sessionId: String(session._id), listingId: String(listing._id), partnerId: String(partner._id) },
      });
    } catch (e) {
      // Roll back the slot reservation if pricing fails, so a bad coupon never strands it.
      await market.atomicUpdate(Slot, { _id: slot._id }, { $set: { status: 'open', orderId: null } }).catch(() => {});
      await market.transition(order, 'cancelled').catch(() => {});
      await Session.findByIdAndUpdate(session._id, { status: 'cancelled' }).catch(() => {});
      throw e;
    }
    await Order.findByIdAndUpdate(order._id, { paymentId: quoted.payment._id });
    res.status(201).json({ session: pubSession(session), order: quoted, marketplaceOrderId: order._id, listingTitle: listing.title });
  } catch (err) {
    if (err && /** @type {any} */ (err).coupon) return res.status(400).json({ error: msg(err) });   // invalid/exhausted coupon
    if (/available|taken/i.test(msg(err))) return res.status(409).json({ error: msg(err) });
    next(err);
  }
});

/**
 * Batch-load the Order / Partner / Slot / Listing rows referenced by a set of sessions
 * in a fixed number of queries (no per-session round-trips). Returns id→doc maps.
 * @param {any[]} sessions
 */
async function loadSessionRefs(sessions) {
  const uniq = (/** @type {any[]} */ arr) => [...new Set(arr.map((v) => v && String(v)).filter(Boolean))];
  const orderIds = uniq(sessions.map((s) => s.orderId));
  const partnerIds = uniq(sessions.map((s) => s.partnerId));
  const slotIds = uniq(sessions.map((s) => s.slotId));
  const [orders, partners, slots] = await Promise.all([
    orderIds.length ? Order.find({ _id: { $in: orderIds } }).lean() : [],
    partnerIds.length ? Partner.find({ _id: { $in: partnerIds } }).select('name category city').lean() : [],
    slotIds.length ? Slot.find({ _id: { $in: slotIds } }).lean() : [],
  ]);
  const listingIds = uniq(orders.map((/** @type {any} */ o) => o.listingId));
  const listings = listingIds.length ? await Listing.find({ _id: { $in: listingIds } }).select('title').lean() : [];
  const byId = (/** @type {any[]} */ rows) => new Map(rows.map((/** @type {any} */ r) => [String(r._id), r]));
  return { orders: byId(orders), partners: byId(partners), slots: byId(slots), listings: byId(listings) };
}

// My appointments — enriched with consultant, offering, scheduled time, price, and order status
// so the client can render a real "My appointments" screen (upcoming / completed / cancelled).
router.get('/sessions', requireAuth, async (req, res, next) => {
  try {
    // The attendee's sessions, PLUS any I booked as a gift and have handed off (bookedBy me, attended by someone else).
    const mine = await Session.find({ userId: req.userId }).limit(100).lean();
    const sent = (await Session.find({ bookedByUserId: req.userId }).limit(100).lean()).filter((/** @type {any} */ s) => String(s.userId) !== String(req.userId));
    const sessions = [...mine, ...sent].sort((/** @type {any} */ a, /** @type {any} */ b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const refs = await loadSessionRefs(sessions);
    const out = sessions.map((/** @type {any} */ s) => {
      const order = refs.orders.get(String(s.orderId));
      const partner = refs.partners.get(String(s.partnerId));
      const slot = s.slotId ? refs.slots.get(String(s.slotId)) : null;
      const listing = order ? refs.listings.get(String(order.listingId)) : null;
      return {
        ...pubSession(s),
        partnerName: (partner && partner.name) || 'Consultant',
        category: (partner && partner.category) || null,
        city: (partner && partner.city) || null,
        title: (listing && listing.title) || 'Consultation',
        listingId: (slot && slot.listingId) || (order && order.listingId) || null,
        scheduledFor: (slot && slot.startsAt) || (order && order.scheduledFor) || null,
        durationMin: (slot && slot.durationMin) || null,
        amountCHF: order ? order.amountCHF : null,
        orderStatus: (order && order.status) || null,
        isGiftSent: String(s.bookedByUserId) === String(req.userId) && String(s.userId) !== String(req.userId),   // I gifted this to someone
        giftStatus: (order && order.giftStatus) || 'none',
      };
    });
    res.json({ sessions: out });
  } catch (err) { next(err); }
});

// Consultation GIFTS awaiting me (recipient) — the buyer paid; I accept (attend) or decline (they're refunded).
router.get('/gifts', requireAuth, async (req, res, next) => {
  try {
    const sessions = await Session.find({ giftForUserId: req.userId }).sort({ createdAt: -1 }).limit(100).lean();
    const refs = await loadSessionRefs(sessions);
    // only real, paid, awaiting-acceptance gifts
    const pending = sessions.filter((/** @type {any} */ s) => {
      const order = refs.orders.get(String(s.orderId));
      return order && order.giftStatus === 'pending' && ['paid', 'confirmed'].includes(order.status);
    });
    const buyerIds = [...new Set(pending.map((/** @type {any} */ s) => s.bookedByUserId && String(s.bookedByUserId)).filter(Boolean))];
    const buyers = buyerIds.length ? await User.find({ _id: { $in: buyerIds } }).select('profile.firstName').lean() : [];
    const buyerById = new Map(buyers.map((/** @type {any} */ b) => [String(b._id), b]));
    const out = pending.map((/** @type {any} */ s) => {
      const order = refs.orders.get(String(s.orderId));
      const partner = refs.partners.get(String(s.partnerId));
      const slot = s.slotId ? refs.slots.get(String(s.slotId)) : null;
      const listing = refs.listings.get(String(order.listingId));
      const buyer = buyerById.get(String(s.bookedByUserId));
      return {
        id: s._id, title: (listing && listing.title) || 'Consultation',
        partnerName: (partner && partner.name) || 'Consultant',
        from: (buyer && buyer.profile && buyer.profile.firstName) || 'A match',
        scheduledFor: (slot && slot.startsAt) || null, durationMin: (slot && slot.durationMin) || null,
        amountCHF: order.amountCHF,
      };
    });
    res.json({ gifts: out });
  } catch (err) { next(err); }
});

/** A consultation gift owner-check keyed on the RECIPIENT (giftForUserId). @param {any} req @param {any} res */
async function myConsultGift(req, res) {
  const session = await Session.findById(req.params.id);
  if (!session || String(session.giftForUserId) !== String(req.userId)) { res.status(404).json({ error: 'Gift not found' }); return null; }
  return session;
}

// Recipient accepts a gifted session → the session ATTENDANCE transfers to them; the order's
// gift gate opens so the consultant can start. (The buyer stays the payer who completes the order.)
router.post('/sessions/:id/accept-gift', requireAuth, async (req, res, next) => {
  try {
    const session = await myConsultGift(req, res); if (!session) return;
    const order = await Order.findById(session.orderId);
    if (!order || order.giftStatus !== 'pending') return res.status(409).json({ error: 'This gift is no longer pending.' });
    const won = await market.atomicUpdate(Order, { _id: order._id, giftStatus: 'pending' }, { $set: { giftStatus: 'accepted', giftRespondedAt: new Date() } });
    if (!won) return res.status(409).json({ error: 'This gift is no longer pending.' });
    await Session.findByIdAndUpdate(session._id, { userId: req.userId });   // recipient is now the attendee
    res.json({ ok: true, accepted: true });
  } catch (err) { next(err); }
});

// Recipient declines → refund the buyer (escrow-safe), free the slot, cancel the session.
router.post('/sessions/:id/decline-gift', requireAuth, async (req, res, next) => {
  try {
    const session = await myConsultGift(req, res); if (!session) return;
    const order = await Order.findById(session.orderId);
    if (!order || order.giftStatus !== 'pending') return res.status(409).json({ error: 'This gift is no longer pending.' });
    // CLAIM the decline atomically FIRST — giftStatus is the single serialization point shared with
    // accept-gift, so a concurrent accept can't also apply its side effect. Only if we win do we
    // reverse the money, free the slot and cancel the session.
    const won = await market.atomicUpdate(Order, { _id: order._id, giftStatus: 'pending' }, { $set: { giftStatus: 'declined', giftRespondedAt: new Date() } });
    if (!won) return res.status(409).json({ error: 'This gift is no longer pending.' });
    // Reverse the buyer's money (escrow-safe). If it throws, giftStatus is already 'declined', so the
    // nightly market.reconcileStrandedOrders sweep reverses the still-captured payment.
    try {
      if (order.status === 'created') await market.transition(order, 'cancelled');
      else if (['paid', 'confirmed', 'disputed'].includes(order.status)) await market.transition(order, 'refunded');
    } catch { /* declined; reconciliation backstops the refund */ }
    await market.atomicUpdate(Slot, { _id: session.slotId }, { $set: { status: 'open', orderId: null } });
    await Session.findByIdAndUpdate(session._id, { status: 'cancelled' });
    res.json({ ok: true, declined: true });
  } catch (err) { next(err); }
});

/** Load a session owned by the caller (404 otherwise). @param {any} req @param {any} res */
async function mySession(req, res) {
  const s = await Session.findById(req.params.id);
  if (!s || String(s.userId) !== String(req.userId)) { res.status(404).json({ error: 'Session not found' }); return null; }
  return s;
}

// Reschedule a scheduled booking to another OPEN slot of the SAME offering — keeps the same
// order/payment (no refund/re-charge). Atomic: reserve the new slot before freeing the old.
router.post('/sessions/:id/reschedule', requireAuth, async (req, res, next) => {
  try {
    const session = await mySession(req, res); if (!session) return;
    if (session.status !== 'scheduled') return res.status(409).json({ error: 'Only a scheduled appointment can be rescheduled.' });
    const parsed = z.object({ slotId: z.string().min(1) }).safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'slotId required' });
    const [oldSlot, newSlot] = await Promise.all([Slot.findById(session.slotId), Slot.findById(parsed.data.slotId)]);
    if (!newSlot || newSlot.status !== 'open' || new Date(newSlot.startsAt).getTime() < Date.now()) return res.status(409).json({ error: 'That slot is not available' });
    if (!oldSlot || String(newSlot.listingId) !== String(oldSlot.listingId)) return res.status(400).json({ error: 'Pick a slot for the same offering' });
    const reserved = await market.atomicUpdate(Slot, { _id: newSlot._id, status: 'open' }, { $set: { status: 'booked', orderId: String(session.orderId) } });
    if (!reserved) return res.status(409).json({ error: 'That slot was just taken' });
    try {
      await Session.findByIdAndUpdate(session._id, { slotId: newSlot._id });                                   // repoint FIRST (the critical link)
      await market.atomicUpdate(Slot, { _id: session.slotId }, { $set: { status: 'open', orderId: null } });   // free the old
      await Order.findByIdAndUpdate(session.orderId, { scheduledFor: new Date(newSlot.startsAt) });
    } catch (e) {
      await market.atomicUpdate(Slot, { _id: newSlot._id }, { $set: { status: 'open', orderId: null } }).catch(() => {});   // release the just-reserved slot so it never leaks
      throw e;
    }
    res.json({ ok: true, scheduledFor: newSlot.startsAt });
  } catch (err) { next(err); }   // real errors surface as 500, not a misleading 409 (the genuine conflicts return 409 explicitly above)
});

// Buyer cancels a booking before it's fulfilled → refund + free the slot.
router.post('/sessions/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const session = await mySession(req, res); if (!session) return;
    const updated = await consult.cancelBooking(session);
    res.json({ session: pubSession(updated) });
  } catch (err) { return res.status(409).json({ error: msg(err) }); }
});

// ==== Booking-scoped chat (client ↔ consultant) =============================
const SessionMessage = require('./models/SessionMessage');
/** The peer user of a session (consultant↔client), null if none, undefined if not a participant.
 * @param {any} session @param {any} userId */
async function sessionPeerOf(session, userId) {
  if (String(session.userId) === String(userId)) {
    const partner = await Partner.findById(session.partnerId).select('ownerUserId').lean();
    return (partner && partner.ownerUserId) || null;   // I'm the client → peer is the consultant
  }
  const partner = await Partner.findById(session.partnerId).select('ownerUserId').lean();
  if (partner && String(partner.ownerUserId) === String(userId)) return session.userId;   // I'm the consultant → peer is the client
  return undefined;   // not a participant
}
/** Load a session the caller participates in (client or owning consultant). @param {any} req @param {any} res */
async function participantSession(req, res) {
  const s = await Session.findById(req.params.id);
  if (!s) { res.status(404).json({ error: 'Session not found' }); return null; }
  const peer = await sessionPeerOf(s, req.userId);
  if (peer === undefined) { res.status(404).json({ error: 'Session not found' }); return null; }
  return { session: s, peerId: peer };
}
router.get('/sessions/:id/thread', requireAuth, async (req, res, next) => {
  try {
    const p = await participantSession(req, res); if (!p) return;
    const msgs = await SessionMessage.find({ sessionId: req.params.id }).sort({ at: 1 }).limit(500).lean();
    res.json({ messages: msgs.map((/** @type {any} */ m) => ({ id: m._id, mine: String(m.from) === String(req.userId), text: m.text, at: m.at })) });
  } catch (err) { next(err); }
});
router.post('/sessions/:id/thread', requireAuth, async (req, res, next) => {
  try {
    const p = await participantSession(req, res); if (!p) return;
    const text = String((req.body && req.body.text) || '').trim().slice(0, 4000);
    if (!text) return res.status(400).json({ error: 'text required' });
    const m = await SessionMessage.create({ sessionId: req.params.id, from: req.userId, text, at: new Date() });
    if (p.peerId) { const io = req.app.get('io'); if (io) io.to('user:' + p.peerId).emit('session_message', { sessionId: req.params.id, from: req.userId, text, at: m.at }); }
    res.status(201).json({ ok: true, message: { id: m._id, mine: true, text, at: m.at } });
  } catch (err) { next(err); }
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
