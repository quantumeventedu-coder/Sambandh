// routes-chat.js — REST endpoints for chats (Socket.io handles real-time)

const express = require('express');
const Chat = require('./models/Chat');
const Message = require('./models/Message');
const User = require('./models/User');
const { requireAuth } = require('./routes-auth');

const router = express.Router();

// Free-tier limits (spec §2.4.4, amended July 2026): male 10 msgs + 3 new
// chats/day; female, non-binary and other 20 msgs + 5 new chats/day.
// Paid tiers (Sambandh Pro / Max) are unlimited for everyone.
// Limits reset at midnight IST (UTC+5:30).
const FREE_LIMITS = {
  male: { messages: 10, newChats: 3 },
  female: { messages: 20, newChats: 5 },
  non_binary: { messages: 20, newChats: 5 },
  other: { messages: 20, newChats: 5 }
};

function istDayStart() {
  const IST_OFFSET = 5.5 * 3600 * 1000;
  const nowIST = Date.now() + IST_OFFSET;
  return new Date(Math.floor(nowIST / 86400000) * 86400000 - IST_OFFSET);
}

// Pro/Max = unlimited. Base members keep the gendered daily allowance.
function tierIsActive(user) {
  return ['pro', 'max'].includes(user.membership?.tier) &&
    (!user.membership?.tierExpiresAt || user.membership.tierExpiresAt > new Date());
}

async function checkDailyLimits(user, kind) {
  if (tierIsActive(user)) return null; // Sambandh Pro / Max: unlimited
  const limits = FREE_LIMITS[user.profile?.gender];
  if (!limits) return null; // unknown gender value: fail open
  const dayStart = istDayStart();

  if (kind === 'message') {
    const sent = await Message.countDocuments({
      from: user._id, type: 'text', createdAt: { $gte: dayStart }
    });
    if (sent >= limits.messages) return `Daily limit reached: ${limits.messages} messages/day on the base membership. Upgrade to Sambandh+ for unlimited messaging.`;
  } else if (kind === 'newChat') {
    const started = await Chat.countDocuments({
      'participants.0': user._id, createdAt: { $gte: dayStart }
    });
    if (started >= limits.newChats) return `Daily limit reached: ${limits.newChats} new chats/day on the base membership. Upgrade to Sambandh+ for unlimited chats.`;
  }
  return null;
}

// Get all my conversations
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const chats = await Chat.find({
      participants: req.userId,
      status: 'active',
      deletedBy: { $ne: req.userId }
    }).sort({ lastMessageAt: -1 }).limit(50);

    // Enrich with last message + other participant info
    const enriched = await Promise.all(chats.map(async chat => {
      const lastMsg = await Message.findOne({ chatId: chat._id })
        .sort({ createdAt: -1 }).limit(1);
      const otherId = chat.participants.find(p => p.toString() !== req.userId);
      const other = await User.findById(otherId).select('profile.firstName profile.photos verification.level');

      const unreadCount = await Message.countDocuments({
        chatId: chat._id, to: req.userId, readAt: null, deleted: false, type: { $ne: 'system' }
      });

      const revealed = !!chat.anonymity.revealedAt;
      return {
        chatId: chat._id,
        other: chat.anonymity.isAnonymous && !revealed
          ? { displayName: 'Anonymous', anonymous: true }
          : { displayName: other?.profile?.firstName, photo: other?.profile?.photos?.[0]?.url, verified: other?.verification?.level },
        lastMessage: lastMsg ? { text: lastMsg.text, from: lastMsg.from, createdAt: lastMsg.createdAt } : null,
        intent: chat.intent,
        anonymous: chat.anonymity.isAnonymous && !revealed,
        unreadCount
      };
    }));

    res.json({ chats: enriched });
  } catch (err) { next(err); }
});

// Get messages for a chat
router.get('/:chatId/messages', requireAuth, async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat || !chat.participants.some(p => p.toString() === req.userId)) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const before = req.query.before ? new Date(req.query.before) : new Date();
    const messages = await Message.find({
      chatId: chat._id,
      createdAt: { $lt: before },
      deleted: false
    }).sort({ createdAt: -1 }).limit(50);

    // Opening a chat marks incoming messages as read
    await Message.updateMany(
      { chatId: chat._id, to: req.userId, readAt: null },
      { readAt: new Date() });

    res.json({ messages: messages.reverse() });
  } catch (err) { next(err); }
});

// Start a new chat (or return existing)
router.post('/start', requireAuth, async (req, res, next) => {
  try {
    const { withUserId, anonymous = false } = req.body;
    if (!withUserId) return res.status(400).json({ error: 'withUserId required' });
    if (withUserId === req.userId) return res.status(400).json({ error: 'Cannot chat with yourself' });

    // Both users must be verified, and neither may have blocked the other
    const me = await User.findById(req.userId);
    const them = await User.findById(withUserId);
    if (!them) return res.status(404).json({ error: 'User not found' });
    if ((me.blockedUsers || []).some(b => b.toString() === withUserId) ||
        (them.blockedUsers || []).some(b => b.toString() === req.userId)) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!me.verification.selfieVerified || !them.verification.selfieVerified) {
      return res.status(403).json({ error: 'Both users must complete photo verification first' });
    }
    if (!me.membership.joinFeePaid) {
      return res.status(403).json({ error: 'An active membership is required to chat (from CHF 1/month)' });
    }
    if (me.status?.suspended) return res.status(403).json({ error: 'Account suspended' });

    const limitError = await checkDailyLimits(me, 'newChat');
    if (limitError) return res.status(429).json({ error: limitError });

    // Check for existing chat
    const existing = await Chat.findOne({
      participants: { $all: [req.userId, withUserId], $size: 2 }
    });
    if (existing) return res.json({ chatId: existing._id, existing: true });

    const chat = await Chat.create({
      participants: [req.userId, withUserId],
      createdAt: new Date(),
      lastMessageAt: new Date(),
      messageCount: 0,
      anonymity: { isAnonymous: anonymous, userA_revealed: false, userB_revealed: false },
      intent: req.body.intent || 'dating',
      status: 'active',
      moderation: { flaggedMessages: 0, isNSFW: false }
    });

    res.json({ chatId: chat._id, existing: false });
  } catch (err) { next(err); }
});

// Send message (also goes through Socket.io for real-time, but REST works as fallback)
router.post('/:chatId/messages', requireAuth, async (req, res, next) => {
  try {
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Empty message' });
    if (text.length > 5000) return res.status(400).json({ error: 'Message too long' });

    const chat = await Chat.findById(req.params.chatId);
    if (!chat || !chat.participants.some(p => p.toString() === req.userId)) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    if (chat.status !== 'active') return res.status(400).json({ error: 'Chat not active' });

    const me = await User.findById(req.userId);
    if (me.status?.suspended) return res.status(403).json({ error: 'Account suspended' });
    const limitError = await checkDailyLimits(me, 'message');
    if (limitError) return res.status(429).json({ error: limitError });

    const to = chat.participants.find(p => p.toString() !== req.userId);

    const msg = await Message.create({
      chatId: chat._id,
      from: req.userId,
      to,
      text,
      type: 'text',
      createdAt: new Date(),
      moderation: { flagged: false, containsNSFW: false, containsPII: false },
      deleted: false
    });

    const updated = await Chat.findByIdAndUpdate(chat._id, {
      lastMessageAt: new Date(),
      $inc: { messageCount: 1 }
    }, { new: true });

    // Real-time delivery to the recipient
    const io = req.app.get('io');
    if (io) io.to('chat:' + chat._id).emit('new_message', {
      chatId: chat._id, message: msg, from: req.userId, createdAt: msg.createdAt
    });

    // Karma Book every 30 messages (rule-based always, LLM-augmented with a key);
    // reputation scoring is LLM-only. Async — never blocks the send.
    if (updated.messageCount % 30 === 0) {
      const { processChatBatch } = require('./karma-book');
      processChatBatch(chat._id).catch(e => console.error('[KARMA]', e.message));
      // Reputation self-gates via the admin-controlled LLM service.
      const { analyzeChat } = require('./reputation-engine');
      analyzeChat(chat._id).catch(e => console.error('[REPUTATION]', e.message));
    }

    res.json({ message: msg });
  } catch (err) { next(err); }
});

// Block a chat (mutual — neither side can message)
router.post('/:chatId/block', requireAuth, async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat || !chat.participants.some(p => p.toString() === req.userId)) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    await Chat.findByIdAndUpdate(chat._id, { status: 'blocked' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Delete chat from my view only
router.delete('/:chatId', requireAuth, async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat || !chat.participants.some(p => p.toString() === req.userId)) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    const updated = await Chat.findByIdAndUpdate(chat._id,
      { $addToSet: { deletedBy: req.userId } }, { new: true });
    // Both sides deleted → archive (spec §2.4.5)
    if (chat.participants.every(p => updated.deletedBy.includes(p.toString()))) {
      await Chat.findByIdAndUpdate(chat._id, { status: 'archived' });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Reveal identity in anonymous chat — mutual consent, 48h request expiry (spec §2.4.3)
router.post('/:chatId/reveal', requireAuth, async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat || !chat.participants.some(p => p.toString() === req.userId)) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    if (!chat.anonymity.isAnonymous) return res.status(400).json({ error: 'Not an anonymous chat' });
    if (chat.anonymity.revealedAt) return res.json({ ok: true, bothRevealed: true });

    const other = chat.participants.find(p => p.toString() !== req.userId);
    const a = chat.anonymity;
    const pendingFromOther = a.revealRequestedBy &&
      a.revealRequestedBy.toString() === other.toString() &&
      a.revealRequestedAt > new Date(Date.now() - 48 * 3600 * 1000);

    if (pendingFromOther) {
      // Both sides have now consented → reveal is permanent
      await Chat.findByIdAndUpdate(chat._id, {
        'anonymity.userA_revealed': true,
        'anonymity.userB_revealed': true,
        'anonymity.revealedAt': new Date()
      });
      await Message.create({
        chatId: chat._id, from: req.userId, to: other,
        text: 'Identities revealed. Say hello!', type: 'system', createdAt: new Date()
      });
      const Notification = require('./models/Notification');
      for (const uid of chat.participants) {
        await Notification.create({
          userId: uid, type: 'reveal_accepted', severity: 'info',
          title: 'Identities revealed',
          body: 'You both agreed to reveal. Names and photos are now visible in this chat.'
        });
      }
      const io = req.app.get('io');
      if (io) io.to('chat:' + chat._id).emit('reveal_accepted', { chatId: chat._id });
      return res.json({ ok: true, bothRevealed: true });
    }

    // Register (or refresh) my reveal request
    const me = await User.findById(req.userId);
    await Chat.findByIdAndUpdate(chat._id, {
      'anonymity.revealRequestedBy': req.userId,
      'anonymity.revealRequestedAt': new Date()
    });
    await Message.create({
      chatId: chat._id, from: req.userId, to: other,
      text: `${me.profile?.displayName || 'Someone'} wants to reveal identities. Tap Reveal to agree — the request expires in 48 hours.`,
      type: 'system', createdAt: new Date()
    });
    const io = req.app.get('io');
    if (io) io.to('user:' + other.toString()).emit('reveal_request', { chatId: chat._id });

    res.json({ ok: true, bothRevealed: false, expiresInHours: 48 });
  } catch (err) { next(err); }
});

router.checkDailyLimits = checkDailyLimits; // shared with the Socket.io path
module.exports = router;
