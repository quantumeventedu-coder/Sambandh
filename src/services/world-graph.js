// services/world-graph.js — Sambandh's relationship graph (the architecture
// manual's "World Model", built HONESTLY over entities that actually exist:
// users as nodes; matches, shared communities, shared languages/intent/city as
// edges). It answers real networking questions — mutual connections, how two
// people are connected, and friend-of-friend (2nd-degree) discovery — without
// inventing fictional ontologies. Pure core (testable) + thin DB wrappers.

const Chat = require('../models/Chat');
const RoomMember = require('../models/RoomMember');
const Room = require('../models/Room');
const User = require('../models/User');

const idStr = x => String(x);
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

// ---------------------------------------------------------------------------
// Pure core — no I/O, unit-testable with plain objects.
// ---------------------------------------------------------------------------

function intersectIds(a = [], b = []) {
  const B = new Set(b.map(idStr));
  return [...new Set(a.map(idStr))].filter(x => B.has(x));
}

// How two people are connected, from already-fetched pieces.
function sharedContext({ aUser, bUser, aConnIds = [], bConnIds = [], aRooms = [], bRooms = [] }) {
  const mutualConnections = intersectIds(aConnIds, bConnIds);
  const aRoomSlugs = new Set(aRooms.map(r => r.slug));
  const sharedCommunities = bRooms.filter(r => aRoomSlugs.has(r.slug)).map(r => ({ slug: r.slug, title: r.title }));
  const sharedLanguages = intersectIds(aUser?.profile?.languages || [], bUser?.profile?.languages || []);
  const sharedIntent = intersectIds(aUser?.intent || [], bUser?.intent || []);
  const sameCity = !!(aUser?.profile?.city && bUser?.profile?.city && aUser.profile.city === bUser.profile.city);
  // A blended tie-strength ∈ [0,1] — mutuals and shared communities weigh most.
  const strength = clamp(
    Math.min(mutualConnections.length, 4) * 0.18 +
    Math.min(sharedCommunities.length, 3) * 0.18 +
    (sameCity ? 0.15 : 0) +
    Math.min(sharedLanguages.length, 2) * 0.08 +
    (sharedIntent.length ? 0.12 : 0)
  );
  return { mutualConnections, sharedCommunities, sharedLanguages, sharedIntent, sameCity, strength: +strength.toFixed(2) };
}

// One-line human description of a connection (or null if there's nothing to say).
function connectionLabel(ctx) {
  if (!ctx) return null;
  const bits = [];
  const mc = ctx.mutualConnections.length;
  if (mc) bits.push(`${mc} mutual connection${mc > 1 ? 's' : ''}`);
  if (ctx.sharedCommunities.length) bits.push(`both in ${ctx.sharedCommunities.map(c => c.title || c.slug).join(', ')}`);
  if (ctx.sameCity) bits.push('same city');
  if (ctx.sharedLanguages.length) bits.push(`share ${ctx.sharedLanguages.join('/')}`);
  if (!bits.length) return null;
  const s = bits.join(' · ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// DB wrappers — fetch the pieces the pure core needs.
// ---------------------------------------------------------------------------

// A user's direct connections = the people they've MATCHED with (a mutual tie,
// represented by a shared Chat). Likes are one-directional and not counted here.
async function connectionsOf(userId) {
  const chats = await Chat.find({ participants: userId }).select('participants').lean();
  const ids = new Set();
  for (const c of chats) for (const p of (c.participants || [])) if (idStr(p) !== idStr(userId)) ids.add(idStr(p));
  return [...ids];
}

async function communitiesOf(userId) {
  const mems = await RoomMember.find({ userId }).select('roomId').lean();
  const roomIds = mems.map(m => m.roomId);
  if (!roomIds.length) return [];
  const rooms = await Room.find({ _id: { $in: roomIds } }).select('slug title').lean();
  return rooms.map(r => ({ slug: r.slug, title: r.title }));
}

// "How you're connected" between two users.
async function between(aId, bId) {
  const [aUser, bUser, aConnIds, bConnIds, aRooms, bRooms] = await Promise.all([
    User.findById(aId).select('profile.languages profile.city intent').lean(),
    User.findById(bId).select('profile.languages profile.city intent').lean(),
    connectionsOf(aId), connectionsOf(bId),
    communitiesOf(aId), communitiesOf(bId)
  ]);
  const ctx = sharedContext({ aUser, bUser, aConnIds, bConnIds, aRooms, bRooms });
  return { ...ctx, label: connectionLabel(ctx) };
}

// A user's ego network summary.
async function egoNetwork(userId) {
  const [connections, communities] = await Promise.all([connectionsOf(userId), communitiesOf(userId)]);
  return { connections: connections.length, communities };
}

// Friend-of-friend discovery: people your matches have matched with, whom you
// haven't yet, ranked by how many of your connections link to them. Two queries.
async function secondDegree(userId, { limit = 20 } = {}) {
  const me = idStr(userId);
  const first = await connectionsOf(userId);
  if (!first.length) return [];
  const firstSet = new Set(first.map(idStr));
  const chats = await Chat.find({ participants: { $in: first } }).select('participants').lean();
  const counts = new Map();                      // candidateId → # of my connections linking to them
  for (const c of chats) {
    const parts = (c.participants || []).map(idStr);
    const connector = parts.find(p => firstSet.has(p));
    for (const p of parts) {
      if (p === me || p === connector || firstSet.has(p)) continue;
      counts.set(p, (counts.get(p) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, mutuals]) => ({ userId: id, mutualConnections: mutuals }));
}

module.exports = {
  // pure core
  intersectIds, sharedContext, connectionLabel,
  // db wrappers
  connectionsOf, communitiesOf, between, egoNetwork, secondDegree
};
