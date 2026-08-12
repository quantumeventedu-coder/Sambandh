// @ts-check
// services/entitlements.js — SINGLE source of truth for what each membership tier unlocks.
//
// The tier ladder (display names in parentheses; internal names renamed in a later step):
//   free       → NONE. There is no free tier: an unsubscribed member must buy Basic to use the app.
//   base   (Basic)     → core dating only, capped swipes/week, unlimited messaging with matches.
//   pro    (Plus)      → unlimited swipes + Astrology + Consultations.
//   max    (Signature) → unlimited swipes + Astrology + Consultations + Marketplace.
//
// Every number lives here so pricing/limits are tuned in one place, never scattered across routes.

const membership = require('./membership');
const User = require('../models/User');

/** null swipesPerWeek = unlimited. `features` are the verticals a tier may enter.
 * @type {Record<string, { label: string, swipesPerWeek: number|null, astrology: boolean, consultations: boolean, marketplace: boolean }>} */
const TIER_ENTITLEMENTS = {
  free: { label: 'Free', swipesPerWeek: 0, astrology: false, consultations: false, marketplace: false },
  base: { label: 'Basic', swipesPerWeek: 400, astrology: false, consultations: false, marketplace: false },
  pro: { label: 'Plus', swipesPerWeek: null, astrology: true, consultations: true, marketplace: false },
  max: { label: 'Signature', swipesPerWeek: null, astrology: true, consultations: true, marketplace: true },
};

/** The LOWEST tier that grants a given feature — used for "requires X" upgrade prompts.
 * @type {Record<string, string>} */
const REQUIRED_TIER = {
  astrology: 'pro', consultations: 'pro', marketplace: 'max',
};

/** Resolve a user's EFFECTIVE tier: 'free' unless they hold an active paid tier we recognise.
 * @param {any} user @returns {string} */
function tierOf(user) {
  if (!user || !membership.tierActive(user)) return 'free';
  const t = user.membership && user.membership.tier;
  return (t && TIER_ENTITLEMENTS[t]) ? t : 'free';
}

/** @param {any} user */
function entitlementsFor(user) { return TIER_ENTITLEMENTS[tierOf(user)] || TIER_ENTITLEMENTS.free; }

/** Can this user enter a vertical? @param {any} user @param {'astrology'|'consultations'|'marketplace'} feature */
function canAccess(user, feature) { return !!entitlementsFor(user)[feature]; }

/** Weekly swipe allowance: a number, or null = unlimited. 0 = locked (no tier). @param {any} user */
function swipeLimitPerWeek(user) { return entitlementsFor(user).swipesPerWeek; }

/** Public label for a tier name (Basic / Plus / Signature). @param {string} tier */
function labelFor(tier) { return (TIER_ENTITLEMENTS[tier] && TIER_ENTITLEMENTS[tier].label) || 'Free'; }

// ---- weekly swipe meter -------------------------------------------------------------------------
// A swipe = acting on one profile (like OR pass). Stored as two TOP-LEVEL user fields (swipeWeek,
// swipeUsed) so pg-odm's atomic $inc — which can't target a nested path — can move the counter.
// Swipe caps are not money, so a tiny concurrency over-allowance is acceptable; the check is a
// read + a guarded increment, not a hardened CAS.

/** ISO week key like "2026-W33" — a deterministic, timezone-stable window boundary. @param {Date} d */
function weekKey(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;                 // Mon=1..Sun=7
  t.setUTCDate(t.getUTCDate() + 4 - day);         // nearest Thursday → ISO week anchor
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((t.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * Try to spend one weekly swipe. Returns { ok, reason?, used?, limit? }.
 *  - unlimited tier (limit null) → always ok, no write.
 *  - no tier (limit 0)           → { ok:false, reason:'locked' } (must subscribe).
 *  - capped tier                 → ok until `used >= limit`, then { ok:false, reason:'limit' }.
 * @param {any} userId @param {Date} [now]
 */
async function consumeSwipe(userId, now = new Date()) {
  const user = await User.findById(userId);
  if (!user) return { ok: false, reason: 'locked' };
  const limit = swipeLimitPerWeek(user);
  if (limit == null) return { ok: true };                                  // unlimited (Plus/Signature)
  if (limit <= 0) return { ok: false, reason: 'locked', limit: 0 };        // no tier
  const wk = weekKey(now);
  const sameWeek = user.swipeWeek === wk;
  const used = sameWeek ? (Number(user.swipeUsed) || 0) : 0;
  if (used >= limit) return { ok: false, reason: 'limit', used, limit };
  if (sameWeek) await User.atomicUpdate({ _id: userId }, { $inc: { swipeUsed: 1 } });
  else await User.atomicUpdate({ _id: userId }, { $set: { swipeWeek: wk, swipeUsed: 1 } });
  return { ok: true, used: used + 1, limit };
}

/** Read-only meter snapshot for display (no spend). @param {any} user @param {Date} [now] */
function swipeStatus(user, now = new Date()) {
  const limit = swipeLimitPerWeek(user);
  if (limit == null) return { unlimited: true, tier: tierOf(user) };
  const used = user.swipeWeek === weekKey(now) ? (Number(user.swipeUsed) || 0) : 0;
  return { unlimited: false, used, limit, remaining: Math.max(0, limit - used), tier: tierOf(user) };
}

// ---- route gate ---------------------------------------------------------------------------------
/**
 * Express middleware: allow the request only if the member's tier grants `feature`, else 403 with
 * the plan they'd need. Requires an authenticated req.userId (mount AFTER requireAuth).
 * @param {'astrology'|'consultations'|'marketplace'} feature
 */
function requireEntitlement(feature) {
  return async (/** @type {any} */ req, /** @type {any} */ res, /** @type {any} */ next) => {
    try {
      const user = await User.findById(req.userId);
      if (canAccess(user, feature)) return next();
      const need = REQUIRED_TIER[feature];
      return res.status(403).json({
        error: `This is a ${labelFor(need)} feature. Upgrade to unlock it.`,
        upgrade: true, feature, requiredTier: need, requiredPlan: labelFor(need), currentTier: tierOf(user),
      });
    } catch (e) { next(e); }
  };
}

module.exports = {
  TIER_ENTITLEMENTS, REQUIRED_TIER, tierOf, entitlementsFor, canAccess,
  swipeLimitPerWeek, labelFor, consumeSwipe, swipeStatus, weekKey, requireEntitlement,
};
