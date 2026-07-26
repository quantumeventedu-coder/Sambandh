// @ts-check
// services/commerce-recommender.js — a trust-aware, context-aware commerce feed.
//
// Recommends relevant marketplace listings and consultants to a user, personalised by
// their relationship intent (→ category set), their location, and — via the shared
// marketplace ranking engine — the partner's verification/rating. Reuses market.rank
// (which already applies the budget/range HARD guardrails and a capped trust nudge),
// so paid placement can never override affordability, deliverability, or trust. No new
// scoring is invented here — this layer only chooses WHAT to rank for WHOM.

const market = require('./marketplace');
const consult = require('./consultation');
const Listing = require('../models/Listing');
const Partner = require('../models/Partner');

/** Relationship intent → relevant partner categories.
 * @type {Record<string, string[]>} */
const INTENT_CATEGORIES = {
  marriage: ['venue', 'photographer', 'makeup', 'wedding_planner', 'jewellery', 'clothing', 'caterer', 'decor', 'invitations', 'astrologer', 'hotel'],
  dating: ['restaurant', 'gift', 'florist', 'photographer', 'hotel', 'travel'],
  casual: ['restaurant', 'gift', 'travel'],
  friendship: ['restaurant', 'travel', 'gift'],
  networking: ['coach', 'financial_advisor', 'counselor']
};

const CONSULT_SET = new Set(consult.CONSULT_CATEGORIES);

/**
 * @param {{ user:any, category?:string, budgetMaxCHF?:number|null, limitEach?:number }} args
 * @returns {Promise<{ context:any, listings:any[], consultants:any[] }>}
 */
async function recommend({ user, category, budgetMaxCHF = null, limitEach = 12 }) {
  const loc = user && user.profile && user.profile.location;
  const at = (loc && loc.lat != null && loc.lng != null) ? { lat: loc.lat, lng: loc.lng } : null;
  const intents = Array.isArray(user && user.intent) ? user.intent : [];
  const cats = category ? [category] : [...new Set(intents.flatMap((/** @type {string} */ i) => INTENT_CATEGORIES[i] || []))];

  // Partners in scope (by category when we have one), then their active listings.
  /** @type {Record<string, any>} */ const partnerFilter = { active: true };
  if (cats.length) partnerFilter.category = { $in: cats };
  const partners = await Partner.find(partnerFilter).limit(500).lean();
  if (!partners.length) return { context: { intents, categories: cats, located: !!at }, listings: [], consultants: [] };
  const byId = new Map(partners.map((/** @type {any} */ p) => [String(p._id), p]));
  const listings = await Listing.find({ partnerId: { $in: partners.map((/** @type {any} */ p) => p._id) }, active: true }).limit(600).lean();

  const items = listings.map((/** @type {any} */ l) => ({ listing: l, partner: byId.get(String(l.partnerId)) })).filter((/** @type {any} */ x) => x.partner);
  const marketItems = items.filter((/** @type {any} */ x) => !CONSULT_SET.has(x.partner.category));
  const consultItems = items.filter((/** @type {any} */ x) => CONSULT_SET.has(x.partner.category));
  const rank = (/** @type {any[]} */ arr) => market.rank(arr, { budgetMaxCHF, at }).slice(0, limitEach);

  return { context: { intents, categories: cats, located: !!at }, listings: rank(marketItems), consultants: rank(consultItems) };
}

module.exports = { recommend, INTENT_CATEGORIES };
