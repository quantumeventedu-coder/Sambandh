// @ts-check
// models/Listing.js — a product or service a Partner offers on the marketplace.
//
// `tierBand` is the plan's affordability lane (Essential / Premium / Elite) — the
// ranking uses it together with the buyer's budget so a middle-class user is never
// pushed ₹50-lakh options. `kind` distinguishes an instant product sale from a
// service/booking that a partner must confirm before fulfilment.
const mongoose = require('../db/odm');

const LISTING_KINDS = ['product', 'service', 'booking'];
const TIER_BANDS = ['essential', 'premium', 'elite'];

const ListingSchema = new mongoose.Schema({
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
  title: { type: String, required: true },
  description: String,
  category: { type: String, index: true },     // mirrors Partner.category for direct filtering
  kind: { type: String, enum: LISTING_KINDS, default: 'product' },
  priceCHF: { type: Number, required: true },   // charged amount, same currency as Payment
  tierBand: { type: String, enum: TIER_BANDS, default: 'essential', index: true },
  city: { type: String, index: true },
  location: { lat: Number, lng: Number },
  deliveryRadiusKm: { type: Number, default: null }, // null → national / not location-bound
  featured: { type: Boolean, default: false },
  featuredUntil: Date,
  stock: { type: Number, default: null },       // null → unlimited (services); number → decremented on order
  active: { type: Boolean, default: true, index: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Listing', ListingSchema);
module.exports.LISTING_KINDS = LISTING_KINDS;
module.exports.TIER_BANDS = TIER_BANDS;
