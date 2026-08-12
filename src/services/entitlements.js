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

/** Atomic update across both ODM backends (pg-odm exposes the static; Mongoose needs findOneAndUpdate).
 * @param {any} Model @param {any} filter @param {any} update */
function atomicUpdate(Model, filter, update) {
  return typeof Model.atomicUpdate === 'function' ? Model.atomicUpdate(filter, update) : Model.findOneAndUpdate(filter, update, { new: true });
}

/**
 * READ-ONLY: may this user spend a swipe? Returns { ok, unlimited?, reason?, used?, limit? }. No write.
 * The caller checks this ONLY for a genuinely new action (see recordSwipe) and, on ok, writes first
 * then records — so a failed write never spends the budget.
 *  - unlimited tier (limit null) → { ok:true, unlimited:true }.
 *  - no tier (limit 0)           → { ok:false, reason:'locked' } (must subscribe).
 *  - capped tier                 → ok until used >= limit, then { ok:false, reason:'limit' }.
 * @param {any} user @param {Date} [now]
 */
function swipeAllowance(user, now = new Date()) {
  const limit = swipeLimitPerWeek(user);
  if (limit == null) return { ok: true, unlimited: true };
  if (limit <= 0) return { ok: false, reason: 'locked', limit: 0 };
  const used = user && user.swipeWeek === weekKey(now) ? (Number(user.swipeUsed) || 0) : 0;
  if (used >= limit) return { ok: false, reason: 'limit', used, limit };
  return { ok: true, used, limit };
}

/** Charge one weekly swipe — call ONLY after a new like/pass write succeeded. No-op for unlimited/
 * locked tiers. Best-effort (a lost increment under-charges, the safe direction). @param {any} userId @param {Date} [now] */
async function recordSwipe(userId, now = new Date()) {
  const user = await User.findById(userId);
  if (!user) return;
  const limit = swipeLimitPerWeek(user);
  if (limit == null || limit <= 0) return;                                  // unlimited or locked → nothing to meter
  const wk = weekKey(now);
  if (user.swipeWeek === wk) await atomicUpdate(User, { _id: userId }, { $inc: { swipeUsed: 1 } });
  else await atomicUpdate(User, { _id: userId }, { $set: { swipeWeek: wk, swipeUsed: 1 } });
}

/** Next weekly reset — 00:00 UTC on the coming Monday (when the swipe meter rolls over). @param {Date} now */
function nextWeekReset(now) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysToMonday = ((8 - (d.getUTCDay() || 7)) % 7) || 7;   // next Monday (never today)
  d.setUTCDate(d.getUTCDate() + daysToMonday);
  return d;
}

/** Read-only meter snapshot for the UI (no spend): how many swipes left this week, the plan, and
 * when it resets — so the client can show a counter and an upgrade nudge. @param {any} user @param {Date} [now] */
function swipeStatus(user, now = new Date()) {
  const tier = tierOf(user);
  const limit = swipeLimitPerWeek(user);
  const plan = labelFor(tier);
  if (limit == null) return { unlimited: true, tier, plan };
  const used = user && user.swipeWeek === weekKey(now) ? (Number(user.swipeUsed) || 0) : 0;
  return { unlimited: false, used, limit, remaining: Math.max(0, limit - used), tier, plan, resetsAt: nextWeekReset(now) };
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
      if (!user) return res.status(401).json({ error: 'Account not found' });   // valid token, gone user → auth error, not an upsell
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
  swipeLimitPerWeek, labelFor, swipeAllowance, recordSwipe, swipeStatus, weekKey, requireEntitlement,
};
