// @ts-check
// services/matchmaking.js — turn a mutual like into a match.
//
// This is the ONE place that creates the shared Chat, posts the system "you matched" message,
// notifies both people, emits the realtime event, and logs the match. It was previously inlined in
// the discover like-route, reachable only through HTTP; extracting it makes match creation reusable
// (a super-like, an admin tool, a re-match flow can all call it) and unit-testable in isolation.

const Like = require('../models/Like');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const events = require('./events');

/** A display name for the match message that never leaks more than the profile already shows. @param {any} u @param {string} fallback */
function displayName(u, fallback) {
  return (u && u.profile && (u.profile.displayName || u.profile.firstName)) || fallback;
}

/**
 * If `otherId` has already liked `meId`, create (or return) their match. IDEMPOTENT: a second call
 * finds the existing chat and creates nothing (newMatch:false), so a double-like or a retry can't
 * mint two chats or fire the notifications twice.
 * @param {{ meId:any, otherId:any, me:any, other:any, io?:any }} args
 *   meId/otherId — the two user ids; me/other — their loaded User docs (for names + intent);
 *   io — the socket.io server (optional; skipped when absent, e.g. in tests).
 * @returns {Promise<{ matched:boolean, newMatch:boolean, chatId?:any }>}
 */
async function createMatchOnMutualLike({ meId, otherId, me, other, io }) {
  const reciprocal = await Like.findOne({ from: otherId, to: meId });
  if (!reciprocal) return { matched: false, newMatch: false };

  const existing = await Chat.findOne({ participants: { $all: [meId, otherId], $size: 2 } });
  if (existing) return { matched: true, newMatch: false, chatId: existing._id };

  const chat = await Chat.create({
    participants: [meId, otherId],
    createdAt: new Date(), lastMessageAt: new Date(), messageCount: 1,
    anonymity: { isAnonymous: false, userA_revealed: false, userB_revealed: false },
    intent: (me && me.intent || [])[0] || 'dating',
    status: 'active',
  });
  const nameA = displayName(me, 'You');
  const nameB = displayName(other, 'they');
  await Message.create({
    chatId: chat._id, from: meId, to: otherId,
    text: `You matched! ${nameA} and ${nameB} both liked each other.`,
    type: 'system', createdAt: new Date(),
  });
  const { deliverNotification } = require('../routes-notifications'); // lazy require avoids a cycle
  for (const uid of [meId, otherId]) {
    await deliverNotification(uid, {
      type: 'new_match', severity: 'info',
      title: 'New match!',
      body: 'You both liked each other. Say hello — good conversations build good Karma.',
    });
  }
  if (io) {
    io.to('user:' + otherId).emit('new_match', { chatId: chat._id });
    io.to('user:' + meId).emit('new_match', { chatId: chat._id });
  }
  require('./analytics').track('match_created', meId, { withUserId: otherId });
  events.record('Matched', { userId: meId, payload: { withUserId: otherId, chatId: chat._id } });
  events.record('Matched', { userId: otherId, payload: { withUserId: meId, chatId: chat._id } });
  return { matched: true, newMatch: true, chatId: chat._id };
}

module.exports = { createMatchOnMutualLike };
