// @ts-check
// routes-pro.js — self-serve PROFESSIONAL dashboard (mounted at /api/pro).
//
// A member applies to become a professional → a Partner is created and OWNED by their app
// account (Partner.ownerUserId, one per user). They then manage their own profile, consultation
// offerings, availability slots, appointments (start/end their own sessions), and see earnings.
// The trust badge (verification) is still staff-decided — self-serve never sets `verified`.
const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('./routes-auth');
const Partner = require('./models/Partner');
const Listing = require('./models/Listing');
const Order = require('./models/Order');
const Slot = require('./models/ConsultantSlot');
const Session = require('./models/Session');
const User = require('./models/User');
const consult = require('./services/consultation');
const market = require('./services/marketplace');

const router = express.Router();
const msg = (/** @type {unknown} */ e) => (e instanceof Error ? e.message : String(e));

const myPartner = (/** @type {any} */ userId) => Partner.findOne({ ownerUserId: userId });
const pubMe = (/** @type {any} */ p) => p && ({
  id: p._id, name: p.name, category: p.category, city: p.city, bio: p.bio || '',
  languages: p.languages || [], experienceYears: p.experienceYears ?? null, photoUrl: p.photoUrl || '',
  verified: !!p.verified, verificationStatus: (p.verification && p.verification.status) || 'unverified',
  ratingAvg: p.ratingAvg || 0, ratingCount: p.ratingCount || 0,
});
const pubL = (/** @type {any} */ l) => l && ({ id: l._id, title: l.title, billing: l.billing, priceCHF: l.priceCHF, ratePerMinuteCHF: l.ratePerMinuteCHF, durationMin: l.durationMin, active: l.active });

// Apply to become a professional → creates a Partner owned by me (verification pending).
router.post('/apply', requireAuth, async (req, res, next) => {
  try {
    if (await myPartner(req.userId)) return res.status(409).json({ error: 'You already have a professional profile.' });
    const parsed = z.object({ name: z.string().min(2).max(120), category: z.enum(/** @type {any} */ (consult.CONSULT_CATEGORIES)), bio: z.string().max(1500).optional(), city: z.string().max(80).optional() }).safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'name + a valid consultation category are required' });
    const p = await Partner.create({
      name: parsed.data.name, category: parsed.data.category, bio: parsed.data.bio || '', city: parsed.data.city,
      ownerUserId: req.userId, active: true, verified: false, verification: { status: 'pending' },
      onboardedBy: 'self', createdAt: new Date(),
    });
    res.status(201).json({ partner: pubMe(p) });
  } catch (err) { next(err); }
});

// My professional profile + offerings.
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const p = await myPartner(req.userId);
    if (!p) return res.json({ partner: null });
    const listings = await Listing.find({ partnerId: p._id }).lean();
    res.json({ partner: pubMe(p), listings: listings.map(pubL) });
  } catch (err) { next(err); }
});

// Update my profile (never touches `verified`).
router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const p = await myPartner(req.userId); if (!p) return res.status(404).json({ error: 'No professional profile' });
    const b = req.body || {}; /** @type {Record<string, any>} */ const set = {};
    if (typeof b.name === 'string' && b.name.trim()) set.name = b.name.slice(0, 120);
    if (typeof b.bio === 'string') set.bio = b.bio.slice(0, 1500);
    if (typeof b.city === 'string') set.city = b.city.slice(0, 80);
    if (typeof b.photoUrl === 'string') set.photoUrl = b.photoUrl.slice(0, 500);
    if (Array.isArray(b.languages)) set.languages = b.languages.filter((/** @type {any} */ x) => typeof x === 'string').slice(0, 12);
    if (b.experienceYears != null && Number.isFinite(Number(b.experienceYears))) set.experienceYears = Math.max(0, Math.min(80, Math.round(Number(b.experienceYears))));
    await Partner.findByIdAndUpdate(p._id, set);
    res.json({ partner: pubMe(await Partner.findById(p._id)) });
  } catch (err) { next(err); }
});

// Create a consultation offering.
router.post('/listings', requireAuth, async (req, res, next) => {
  try {
    const p = await myPartner(req.userId); if (!p) return res.status(404).json({ error: 'No professional profile' });
    const parsed = z.object({
      title: z.string().min(2).max(120), billing: z.enum(['flat', 'per_minute']).optional(),
      priceCHF: z.number().positive().max(100000).optional(), ratePerMinuteCHF: z.number().positive().max(1000).optional(),
      durationMin: z.number().int().positive().max(600).optional(),
    }).safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'title + price required' });
    const d = parsed.data, billing = d.billing || 'flat';
    if (billing === 'per_minute' && !(d.ratePerMinuteCHF && d.durationMin)) return res.status(400).json({ error: 'per_minute needs ratePerMinuteCHF + durationMin' });
    if (billing === 'flat' && !d.priceCHF) return res.status(400).json({ error: 'flat needs priceCHF' });
    const listing = await Listing.create({
      partnerId: p._id, category: p.category, title: d.title, kind: 'booking', billing,
      priceCHF: billing === 'flat' ? d.priceCHF : market.round2((d.ratePerMinuteCHF || 0) * (d.durationMin || 0)),
      ratePerMinuteCHF: d.ratePerMinuteCHF || null, durationMin: d.durationMin || null, city: p.city, active: true, createdAt: new Date(),
    });
    res.status(201).json({ listing: pubL(listing) });
  } catch (err) { next(err); }
});

// Publish an availability slot on MY listing.
router.post('/listings/:id/slots', requireAuth, async (req, res, next) => {
  try {
    const p = await myPartner(req.userId); if (!p) return res.status(404).json({ error: 'No professional profile' });
    const listing = await Listing.findById(req.params.id);
    if (!listing || String(listing.partnerId) !== String(p._id)) return res.status(404).json({ error: 'Listing not found' });
    const parsed = z.object({ startsAt: z.string().datetime(), durationMin: z.number().int().positive().max(600).optional() }).safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'startsAt (ISO) required' });
    const slot = await consult.publishSlot({ partner: p, listing, startsAt: parsed.data.startsAt, durationMin: parsed.data.durationMin });
    res.status(201).json({ slot: { id: slot._id, listingId: slot.listingId, startsAt: slot.startsAt, durationMin: slot.durationMin, status: slot.status } });
  } catch (err) { next(err); }
});

// My upcoming/open slots (to manage availability).
router.get('/slots', requireAuth, async (req, res, next) => {
  try {
    const p = await myPartner(req.userId); if (!p) return res.json({ slots: [] });
    const now = Date.now();
    const slots = await Slot.find({ partnerId: p._id, status: 'open' }).sort({ startsAt: 1 }).limit(200).lean();
    res.json({ slots: slots.filter((/** @type {any} */ s) => new Date(s.startsAt).getTime() > now).map((/** @type {any} */ s) => ({ id: s._id, listingId: s.listingId, startsAt: s.startsAt, durationMin: s.durationMin })) });
  } catch (err) { next(err); }
});

// Close an OPEN (unbooked) slot of mine.
router.post('/slots/:id/close', requireAuth, async (req, res, next) => {
  try {
    const p = await myPartner(req.userId); if (!p) return res.status(404).json({ error: 'No professional profile' });
    const slot = await Slot.findById(req.params.id);
    if (!slot || String(slot.partnerId) !== String(p._id)) return res.status(404).json({ error: 'Slot not found' });
    const won = await market.atomicUpdate(Slot, { _id: slot._id, status: 'open' }, { $set: { status: 'cancelled' } });
    if (!won) return res.status(409).json({ error: 'Only an open (unbooked) slot can be closed.' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// My appointments (consultant side) — start/end below.
router.get('/appointments', requireAuth, async (req, res, next) => {
  try {
    const p = await myPartner(req.userId); if (!p) return res.json({ appointments: [] });
    const sessions = await Session.find({ partnerId: p._id }).sort({ createdAt: -1 }).limit(100).lean();
    const out = [];
    for (const s of sessions) {
      const [order, slot, u] = await Promise.all([
        Order.findById(s.orderId).lean(),
        s.slotId ? Slot.findById(s.slotId).lean() : null,
        User.findById(s.userId).select('profile.firstName').lean(),
      ]);
      out.push({
        id: s._id, status: s.status, orderStatus: (order && order.status) || null,
        client: (u && u.profile && u.profile.firstName) || 'Client',
        scheduledFor: (slot && slot.startsAt) || (order && order.scheduledFor) || null,
        amountCHF: order ? order.amountCHF : null, payoutCHF: order ? order.partnerPayoutCHF : null,
      });
    }
    res.json({ appointments: out });
  } catch (err) { next(err); }
});

async function ownerSessionAction(/** @type {any} */ req, /** @type {any} */ res, /** @type {'start'|'end'} */ action) {
  const p = await myPartner(req.userId); if (!p) return res.status(404).json({ error: 'No professional profile' });
  const session = await Session.findById(req.params.id);
  if (!session || String(session.partnerId) !== String(p._id)) return res.status(404).json({ error: 'Appointment not found' });
  try {
    const updated = action === 'start' ? await consult.startSession(session) : await consult.endSession(session);
    res.json({ session: { id: session._id, status: updated.status } });
  } catch (err) { res.status(409).json({ error: msg(err) }); }
}
router.post('/appointments/:id/start', requireAuth, (req, res) => ownerSessionAction(req, res, 'start'));
router.post('/appointments/:id/end', requireAuth, (req, res) => ownerSessionAction(req, res, 'end'));

// Earnings snapshot — released (paid out on completed orders) + pending (in escrow).
router.get('/earnings', requireAuth, async (req, res, next) => {
  try {
    const p = await myPartner(req.userId); if (!p) return res.json({ released: 0, pending: 0, completedOrders: 0, currency: 'CHF' });
    const orders = await Order.find({ partnerId: p._id }).limit(5000).lean();
    let released = 0, pending = 0, completedOrders = 0;
    for (const o of orders) {
      if (o.status === 'completed') { released += o.partnerPayoutCHF || 0; completedOrders++; }
      else if (['paid', 'confirmed', 'fulfilled'].includes(o.status)) pending += o.partnerPayoutCHF || 0;
    }
    res.json({ released: market.round2(released), pending: market.round2(pending), completedOrders, currency: 'CHF' });
  } catch (err) { next(err); }
});

module.exports = router;
