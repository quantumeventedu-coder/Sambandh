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
/** What kind of entity the partner is (for KYB / authentication). */
const PARTNER_TYPES = ['individual', 'firm', 'organization', 'institution'];
/** Registration identifiers used to authenticate a business (India-first). */
const REG_KINDS = ['gst', 'cin', 'pan', 'udyam', 'license', 'none'];
/** The KYB verification lifecycle, decided by staff. */
const PARTNER_VERIFY_STATES = ['unverified', 'pending', 'verified', 'rejected'];
/** Document types a partner submits to be authenticated. */
const PARTNER_DOC_TYPES = ['registration_certificate', 'gst_certificate', 'pan_card', 'id_proof', 'address_proof', 'license', 'other'];

const PartnerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, enum: CATEGORIES, required: true, index: true },
  // ---- who they are (KYB / authentication) ----
  type: { type: String, enum: PARTNER_TYPES, default: 'individual', index: true },
  legalName: String,                              // registered legal name (may differ from display name)
  registration: {
    kind: { type: String, enum: REG_KINDS, default: 'none' },
    number: String                               // GSTIN / CIN / PAN / Udyam / licence number
  },
  contactPerson: { name: String, email: String, phone: String },   // the human accountable for the entity
  address: String,
  website: String,
  // Submitted authentication documents (each AAV-scanned before it is stored).
  documents: [{
    type: { type: String, enum: PARTNER_DOC_TYPES },
    url: String, storageKey: String, keyVersion: String, evidenceHash: String, mime: String, size: Number,
    aavDecision: String, uploadedBy: String, uploadedAt: Date
  }],
  // The KYB decision, made by a named staff member.
  verification: {
    status: { type: String, enum: PARTNER_VERIFY_STATES, default: 'unverified', index: true },
    reviewedBy: String, reviewedAt: Date, notes: String, evidenceHash: String
  },
  // ---- consumer-facing profile (shown on the public professional page) ----
  bio: String,                                    // short professional bio
  languages: [String],                            // languages spoken
  experienceYears: { type: Number, default: null },
  photoUrl: String,                               // profile photo (public bucket URL)
  city: { type: String, index: true },
  location: { lat: Number, lng: Number },   // for local-first ranking (haversine in JS)
  email: { type: String, lowercase: true, trim: true },
  phone: String,
  tier: { type: String, enum: PARTNER_TIERS, default: 'standard', index: true },
  verified: { type: Boolean, default: false },   // "Verified Business" badge (mirrors verification.status)
  verifiedAt: Date,
  // commission override (0..1). Null → category default from services/marketplace.js.
  commissionRate: { type: Number, default: null },
  active: { type: Boolean, default: true, index: true },
  suspended: { type: Boolean, default: false },
  suspendReason: String, suspendedAt: Date,
  ratingAvg: { type: Number, default: 0 },        // denormalised from Review
  ratingCount: { type: Number, default: 0 },
  onboardedBy: String,                            // staff email who created the partner
  createdBy: String,                              // staff email (legacy alias)
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Partner', PartnerSchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.PARTNER_TIERS = PARTNER_TIERS;
module.exports.PARTNER_TYPES = PARTNER_TYPES;
module.exports.REG_KINDS = REG_KINDS;
module.exports.PARTNER_VERIFY_STATES = PARTNER_VERIFY_STATES;
module.exports.PARTNER_DOC_TYPES = PARTNER_DOC_TYPES;
