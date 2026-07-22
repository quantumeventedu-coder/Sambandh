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
 * Active Sambandh Pro or Max membership (unexpired). The entitlement that unlocks
 * the full Nature Dial reading and another member's astrology.
 * @param {{membership?: {tier?: string, tierExpiresAt?: Date|string|null}}|null|undefined} user
 * @returns {boolean}
 */
function proOrMaxActive(user) {
  return !!user && ['pro', 'max'].includes(user.membership?.tier ?? '') && tierActive(user);
}

/**
 * Numeric rank for a tier name (unknown → 0 / free).
 * @param {string|undefined|null} tier
 * @returns {number}
 */
function tierRank(tier) { return TIER_RANK[tier ?? 'free'] ?? 0; }

module.exports = { TIER_RANK, tierActive, proOrMaxActive, tierRank };
