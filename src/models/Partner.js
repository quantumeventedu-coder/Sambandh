// @ts-check
// models/Partner.js — a business on the Sambandh marketplace (venue, photographer,
// jeweller, hotel, restaurant, coach, counsellor, astrologer, gift shop, …).
//
// Partners are onboarded by staff (market:manage scope). Their listings appear in
// budget-aware, local-first ranking. The `tier` drives the paid "Partner Program"
// (Gold/Platinum/Enterprise) featured placement; `verified` grants the trust badge.
const mongoose = require('../db/odm');

/** Marketplace categories. Commission defaults live in services/marketplace.js. */
const CATEGORIES = [
  'venue', 'photographer', 'makeup', 'wedding_planner', 'jewellery', 'clothing',
  'hotel', 'travel', 'gift', 'florist', 'caterer', 'decor', 'invitations',
  'restaurant', 'coach', 'counselor', 'astrologer', 'lawyer', 'financial_advisor',
  'fitness', 'nutritionist', 'home', 'furniture', 'other'
];
const PARTNER_TIERS = ['standard', 'gold', 'platinum', 'enterprise'];

const PartnerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, enum: CATEGORIES, required: true, index: true },
  city: { type: String, index: true },
  location: { lat: Number, lng: Number },   // for local-first ranking (haversine in JS)
  email: { type: String, lowercase: true, trim: true },
  phone: String,
  tier: { type: String, enum: PARTNER_TIERS, default: 'standard', index: true },
  verified: { type: Boolean, default: false },   // "Verified Business" badge
  verifiedAt: Date,
  // commission override (0..1). Null → category default from services/marketplace.js.
  commissionRate: { type: Number, default: null },
  active: { type: Boolean, default: true, index: true },
  ratingAvg: { type: Number, default: 0 },        // denormalised from Review
  ratingCount: { type: Number, default: 0 },
  createdBy: String,                              // staff email
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Partner', PartnerSchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.PARTNER_TIERS = PARTNER_TIERS;
