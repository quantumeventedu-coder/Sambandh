// @ts-check
// services/marketplace.js — in-house marketplace engine: commission, escrow order
// state machine, budget-aware + local-first ranking, and review aggregation.
//
// No third party: money moves on the platform's existing Payment rail; commission,
// escrow and payout accounting are computed here. The order state machine is
// FAIL-CLOSED — any transition not explicitly allowed throws, so money can never
// skip a state (e.g. a payout can't be "released" before the buyer confirms).

const Order = require('../models/Order');
const Listing = require('../models/Listing');
const Partner = require('../models/Partner');
const Review = require('../models/Review');

/** Category → default commission (0..1). A partner may override via commissionRate.
 * @type {Record<string, number>} */
const DEFAULT_COMMISSION = {
  venue: 0.10, photographer: 0.15, makeup: 0.15, wedding_planner: 0.12, jewellery: 0.08,
  clothing: 0.12, hotel: 0.15, travel: 0.12, gift: 0.15, florist: 0.15, caterer: 0.10,
  decor: 0.12, invitations: 0.15, restaurant: 0.10, coach: 0.25, counselor: 0.25,
  astrologer: 0.25, lawyer: 0.20, financial_advisor: 0.20, fitness: 0.20,
  nutritionist: 0.20, home: 0.12, furniture: 0.10, other: 0.15
};
const FALLBACK_COMMISSION = 0.15;
/** @type {Record<string, number>} */
const PARTNER_TIER_BONUS = { standard: 0, gold: 0.04, platinum: 0.07, enterprise: 0.10 };

/** Allowed order transitions (fail-closed: anything not listed throws).
 * @type {Record<string, string[]>} */
const TRANSITIONS = {
  created: ['paid', 'cancelled'],
  paid: ['confirmed', 'cancelled', 'refunded', 'disputed'],
  confirmed: ['fulfilled', 'cancelled', 'refunded', 'disputed'],
  fulfilled: ['completed', 'disputed'],
  disputed: ['completed', 'refunded'],
  completed: [],
  cancelled: [],
  refunded: []
};

const round2 = (/** @type {number} */ n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Commission split for a listing sold by a partner.
 * @param {{priceCHF:number}} listing
 * @param {{category:string, commissionRate?:number|null}} partner
 */
function quote(listing, partner) {
  const amountCHF = round2(listing.priceCHF);
  const rate = (partner.commissionRate != null)
    ? partner.commissionRate
    : (DEFAULT_COMMISSION[partner.category] ?? FALLBACK_COMMISSION);
  const commissionCHF = round2(amountCHF * rate);
  const partnerPayoutCHF = round2(amountCHF - commissionCHF);
  return { amountCHF, commissionRate: rate, commissionCHF, partnerPayoutCHF };
}

/**
 * Create an order (status 'created'). Decrements finite stock (rejects if none).
 * @param {{ userId:any, listing:any, partner:any, scheduledFor?:Date, notes?:string }} args
 */
async function createOrder({ userId, listing, partner, scheduledFor, notes }) {
  if (!listing || !listing.active) throw new Error('Listing unavailable');
  if (!partner || !partner.active) throw new Error('Partner unavailable');
  if (typeof listing.stock === 'number') {
    if (listing.stock <= 0) throw new Error('Out of stock');
    await Listing.findByIdAndUpdate(listing._id, { stock: listing.stock - 1 });
  }
  const q = quote(listing, partner);
  return Order.create({
    userId, listingId: listing._id, partnerId: partner._id, kind: listing.kind,
    amountCHF: q.amountCHF, commissionRate: q.commissionRate,
    commissionCHF: q.commissionCHF, partnerPayoutCHF: q.partnerPayoutCHF,
    status: 'created', escrowHeld: false, scheduledFor, notes, createdAt: new Date(), updatedAt: new Date()
  });
}

/**
 * Transition an order. FAIL-CLOSED: throws on any disallowed move.
 * Applies escrow side effects (hold on pay, release on complete, restock on
 * cancel/refund) so accounting always matches state.
 * @param {any} order  the current Order doc
 * @param {'paid'|'confirmed'|'fulfilled'|'completed'|'cancelled'|'refunded'|'disputed'} to
 * @param {{ paymentId?:any, disputeReason?:string }} [opts]
 */
async function transition(order, to, opts = {}) {
  if (!order) throw new Error('Order not found');
  const allowed = TRANSITIONS[order.status];
  if (!allowed) throw new Error(`Unknown order status: ${order.status}`);
  if (!allowed.includes(to)) throw new Error(`Illegal transition ${order.status} → ${to}`);

  /** @type {Record<string, any>} */
  const set = { status: to, updatedAt: new Date() };

  if (to === 'paid') { set.escrowHeld = true; if (opts.paymentId) set.paymentId = opts.paymentId; }
  if (to === 'completed') { set.escrowHeld = false; set.escrowReleasedAt = new Date(); }   // payout released to partner
  if (to === 'disputed') { set.disputeReason = String(opts.disputeReason || 'unspecified'); }

  // Money returns to the buyer — escrow drops without releasing a payout — and the
  // reserved stock is restored.
  if (to === 'cancelled' || to === 'refunded') {
    set.escrowHeld = false;
    if (typeof order.listingId !== 'undefined') {
      const listing = await Listing.findById(order.listingId);
      if (listing && typeof listing.stock === 'number') {
        await Listing.findByIdAndUpdate(listing._id, { stock: listing.stock + 1 });
      }
    }
  }

  await Order.findByIdAndUpdate(order._id, set);
  return { ...order, ...set };
}

// ---- Budget-aware + local-first ranking -----------------------------------
/** Great-circle distance (km) between two lat/lng points.
 * @param {{lat:number,lng:number}|null|undefined} a
 * @param {{lat:number,lng:number}|null|undefined} b */
function distanceKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371, toRad = (/** @type {number} */ d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Rank {listing, partner} pairs for a buyer. Explainable — returns per-item factors.
 * Budget and range are the plan's guardrails: an item priced far over budget, or
 * out of a partner's delivery radius, is pushed DOWN, never surfaced as "best".
 * Featured/tier gives a modest, capped nudge and can NEVER override budget/range.
 * @param {{listing:any, partner:any}[]} items
 * @param {{ budgetMaxCHF?:number|null, at?:{lat:number,lng:number}|null, now?:Date }} [ctx]
 */
function rank(items, ctx = {}) {
  const now = ctx.now || new Date();
  const scored = items.map(({ listing, partner }) => {
    // budget fit: 1 at/under budget, decaying above, ~0 beyond 1.5×.
    let budgetFit = 1;
    if (ctx.budgetMaxCHF != null && ctx.budgetMaxCHF > 0) {
      const over = listing.priceCHF / ctx.budgetMaxCHF;
      budgetFit = over <= 1 ? 1 : Math.max(0, 1 - (over - 1) / 0.5);
    }
    // proximity: 1 nearby, decaying with distance; out of delivery radius → 0.
    let proximity = 0.5; // neutral when no location known
    const dist = distanceKm(ctx.at, listing.location);
    if (dist != null) {
      if (listing.deliveryRadiusKm != null && dist > listing.deliveryRadiusKm) proximity = 0;
      else proximity = Math.max(0, 1 - dist / 50); // full within same city, fades by ~50km
    }
    const ratingScore = (partner.ratingCount > 0) ? (partner.ratingAvg / 5) : 0.5;
    const trust = partner.verified ? 1 : 0;
    const isFeatured = listing.featured && (!listing.featuredUntil || new Date(listing.featuredUntil) > now);
    const placement = Math.min(0.15, (isFeatured ? 0.05 : 0) + (PARTNER_TIER_BONUS[partner.tier] || 0));

    const factors = { budgetFit, proximity, rating: ratingScore, trust, placement };
    // Weights: relevance (budget+proximity) dominates; placement is a small nudge.
    const score = round2(0.35 * budgetFit + 0.30 * proximity + 0.15 * ratingScore + 0.10 * trust + 1.0 * placement);
    return { listing, partner, score, factors };
  });
  return scored.sort((a, b) => b.score - a.score);
}

/**
 * Add a verified-purchase review for a completed order and refresh partner rating.
 * @param {{ userId:any, order:any, rating:number, text?:string }} args
 */
async function addReview({ userId, order, rating, text }) {
  if (!order) throw new Error('Order not found');
  if (String(order.userId) !== String(userId)) throw new Error('Not your order');
  if (order.status !== 'completed') throw new Error('Only completed orders can be reviewed');
  if (await Review.findOne({ orderId: order._id })) throw new Error('Order already reviewed');
  const r = Math.max(1, Math.min(5, Math.round(rating)));
  const review = await Review.create({
    userId, partnerId: order.partnerId, listingId: order.listingId, orderId: order._id,
    rating: r, text: text ? String(text).slice(0, 2000) : undefined, verifiedPurchase: true, createdAt: new Date()
  });
  const all = await Review.find({ partnerId: order.partnerId }).lean();
  const count = all.length;
  const avg = count ? round2(all.reduce((/** @type {number} */ s, /** @type {any} */ x) => s + (x.rating || 0), 0) / count) : 0;
  await Partner.findByIdAndUpdate(order.partnerId, { ratingAvg: avg, ratingCount: count });
  return review;
}

module.exports = {
  DEFAULT_COMMISSION, FALLBACK_COMMISSION, TRANSITIONS,
  quote, createOrder, transition, rank, distanceKm, addReview, round2
};
