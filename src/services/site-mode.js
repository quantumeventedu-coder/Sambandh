// @ts-check
// src/services/site-mode.js — pre-launch gate state (owner-controlled).
//
// In pre-launch, anyone can register, pay the base fee and build their profile, but
// the dating features (Discover/Chats/matching) are gated behind an "early access"
// waiting room until launch. Admins/moderators bypass. The flag lives on the
// AppConfig singleton so the owner flips it from the super-admin panel with no
// redeploy. Cached briefly to avoid a DB hit per request.
//
// Semantics: pre-launch is ON by default — only an EXPLICIT `false` opens the doors.
// So a fresh DB / missing field means gated (fail-safe for a launch that hasn't
// happened yet).

const AppConfig = require('../models/AppConfig');

let _cache = { at: 0, on: true };
const TTL_MS = 15000;

/** Roles that always bypass the gate. */
const BYPASS_ROLES = new Set(['admin', 'moderator', 'super_admin']);

/** @param {string|undefined} role @returns {boolean} */
function roleBypasses(role) { return !!role && BYPASS_ROLES.has(role); }

/**
 * Is the site in pre-launch (gated) mode? Cached ~15s.
 * @returns {Promise<boolean>}
 */
async function isPrelaunch() {
  if (Date.now() - _cache.at < TTL_MS) return _cache.on;
  let on = true;                                  // fail-safe default: gated
  try {
    const doc = await AppConfig.findOne({ key: 'singleton' }).lean();
    if (doc && doc.prelaunch === false) on = false;
  } catch { /* DB not ready → stay gated */ }
  _cache = { at: Date.now(), on };
  return on;
}

/**
 * Set pre-launch on/off (super-admin only). Clears the cache so the change is
 * visible immediately.
 * @param {boolean} on
 * @returns {Promise<boolean>} the new value
 */
async function setPrelaunch(on) {
  const value = !!on;
  await AppConfig.findOneAndUpdate(
    { key: 'singleton' },
    { $set: { prelaunch: value, updatedAt: new Date() } },
    { upsert: true, new: true }
  );
  _cache = { at: Date.now(), on: value };
  // LAUNCH (on → false): every early-access member (registered + paid during
  // pre-launch) gets their 30 days (re)started NOW, so the gated time isn't burned.
  // Idempotent via trialGrantedAt so re-flipping never re-grants.
  if (!value) await grantEarlyAccessTrials();
  return value;
}

/**
 * Grant a fresh 30-day base membership to early-access members who haven't been
 * granted yet. Called at launch. Returns the number granted.
 * @returns {Promise<number>}
 */
async function grantEarlyAccessTrials() {
  const User = require('../models/User');
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 30 * 86400000);
  try {
    const r = await User.updateMany(
      { 'membership.earlyAccess': true, 'membership.trialGrantedAt': { $exists: false } },
      { $set: { 'membership.tier': 'base', 'membership.joinFeePaid': true, 'membership.tierExpiresAt': trialEnd, 'membership.trialGrantedAt': now } }
    );
    return (r && (r.modifiedCount ?? r.nModified)) || 0;
  } catch { return 0; }
}

/**
 * Should THIS request be gated? True when pre-launch is on and the caller is not an
 * admin/moderator. Convenience for route guards.
 * @param {string|undefined} role
 * @returns {Promise<boolean>}
 */
async function gatedFor(role) {
  if (roleBypasses(role)) return false;
  return isPrelaunch();
}

function _clearCacheForTests() { _cache = { at: 0, on: true }; }

module.exports = { isPrelaunch, setPrelaunch, gatedFor, grantEarlyAccessTrials, roleBypasses, BYPASS_ROLES, _clearCacheForTests };
