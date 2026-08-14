// @ts-check
// services/membership.js — single source of truth for membership tier checks so
// the reading gate, the astro gate and the payment/activation logic can't drift.

/** Ordered tiers: a higher rank is a strictly better entitlement.
 * @type {Record<string, number>} */
const TIER_RANK = { free: 0, base: 1, pro: 2, max: 3 };

/**
 * Is the member's paid entitlement still active (not expired)?
 * @param {{membership?: {tierExpiresAt?: Date|string|null}}|null|undefined} user
 * @returns {boolean}
 */
function tierActive(user) {
  if (!user || !user.membership) return false;
  const exp = user.membership.tierExpiresAt;
  return !exp || new Date(exp) > new Date();
}

/**
 * Active Plus/Signature membership — the astrology/readings entitlement.
 * @deprecated Prefer `require('./entitlements').canAccess(user, 'astrology')` directly. Kept as a
 * thin delegating alias so the tier→feature rule lives in ONE place and the two can never drift.
 * (Lazy require avoids the entitlements↔membership import cycle.)
 * @param {any} user @returns {boolean}
 */
function proOrMaxActive(user) {
  return require('./entitlements').canAccess(user, 'astrology');
}

/**
 * Numeric rank for a tier name (unknown → 0 / free).
 * @param {string|undefined|null} tier
 * @returns {number}
 */
function tierRank(tier) { return TIER_RANK[tier ?? 'free'] ?? 0; }

module.exports = { TIER_RANK, tierActive, proOrMaxActive, tierRank };
