// @ts-check
// routes-commerce.js — personalised commerce recommendations (mounted at /api/commerce).
//
// One trust-aware feed across the marketplace + consultation verticals, personalised
// by the caller's intent + location. Explainable: each item carries the ranking
// factors. Partner cards include the coarse verification badge (trust surfacing).
const express = require('express');
const { requireAuth } = require('./routes-auth');
const User = require('./models/User');
const rec = require('./services/commerce-recommender');

const router = express.Router();

const pubListing = (/** @type {any} */ l) => l && ({
  id: l._id, partnerId: l.partnerId, title: l.title, category: l.category, kind: l.kind,
  priceCHF: l.priceCHF, billing: l.billing, ratePerMinuteCHF: l.ratePerMinuteCHF, durationMin: l.durationMin,
  city: l.city, featured: !!l.featured
});
const pubPartner = (/** @type {any} */ p) => p && ({
  id: p._id, name: p.name, category: p.category, city: p.city,
  verified: !!p.verified, tier: p.tier, ratingAvg: p.ratingAvg || 0, ratingCount: p.ratingCount || 0
});
const card = (/** @type {any} */ r) => ({ listing: pubListing(r.listing), partner: pubPartner(r.partner), factors: r.factors });

// GET /api/commerce/recommendations[?category=&budgetMax=]
router.get('/recommendations', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const budgetMaxCHF = req.query.budgetMax != null ? Number(req.query.budgetMax) : null;
    const out = await rec.recommend({
      user,
      category: req.query.category ? String(req.query.category) : undefined,
      budgetMaxCHF: Number.isFinite(budgetMaxCHF) ? budgetMaxCHF : null
    });
    res.json({ context: out.context, listings: out.listings.map(card), consultants: out.consultants.map(card) });
  } catch (err) { next(err); }
});

module.exports = router;
