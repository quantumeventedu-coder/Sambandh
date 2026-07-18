// services/events.js — the write/read gateway for the append-only behavioural
// event log (models/Event). record() is fire-and-forget: it must NEVER block or
// break the request path (behaviour capture is a background concern). stream()
// reads a user's ordered history for the behaviour engine; prune() bounds growth.

const Event = require('../models/Event');
const behavior = require('./behavior-engine');

// Known event types. New types can be added freely — the ontology is open and
// historical rows stay valid (spec §3.3). This set is documentation + a guard.
const TYPES = new Set([
  'UserJoined', 'ProfileUpdated', 'Liked', 'Passed', 'Matched',
  'MessageSent', 'RoomPosted', 'RoomJoined', 'Verified', 'Paid', 'LoggedIn'
]);

// Record one event. Fire-and-forget; swallows all errors.
/**
 * @param {string} type
 * @param {{ userId?: unknown, payload?: Record<string, unknown>, context?: Record<string, unknown> }} [opts]
 */
function record(type, { userId, payload = {}, context = {} } = {}) {
  if (!type || !userId) return;
  Event.create({ userId, type, payload, context, createdAt: new Date() })
    .catch(() => { /* the log must never break the product */ });
}

// A user's ordered event history (oldest → newest), optionally filtered.
async function stream(userId, { since = null, types = null, limit = 3000 } = {}) {
  const q = { userId };
  if (Array.isArray(types) && types.length) q.type = { $in: types };
  if (since) q.createdAt = { $gte: since };
  return Event.find(q).sort({ createdAt: 1 }).limit(limit).lean();
}

// Convenience: stream a user's events and run the behaviour engine over them.
async function behaviorFor(userId, opts = {}) {
  const evs = await stream(userId, { limit: 5000, ...opts });
  return behavior.analyze(evs);
}

// Retention: drop events older than N days (called from the nightly cron).
async function prune(olderThanDays = 180) {
  const cutoff = new Date(Date.now() - olderThanDays * 86400000);
  try { return await Event.deleteMany({ createdAt: { $lt: cutoff } }); }
  catch { return null; }
}

async function countFor(userId) {
  try { return await Event.countDocuments({ userId }); } catch { return 0; }
}

module.exports = { record, stream, behaviorFor, prune, countFor, TYPES };
