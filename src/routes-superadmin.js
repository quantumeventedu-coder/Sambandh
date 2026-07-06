// routes-superadmin.js — owner-only oversight surface (SUPER_ADMIN_KEY holders).
//
// Privacy protocol (deliberate, keep intact):
//   · Only the super admin — never admins/moderators — can read chat content.
//   · Every content access REQUIRES a written reason and is written to the
//     immutable AuditLog (retained 3 years). The audit trail itself is visible
//     in the super admin panel, so oversight of the overseer is built in.
//   · Lawful basis: investigating illegal activity / imminent harm (IT Rules
//     2021 obligations); this is not a general browsing tool.

const express = require('express');
const mongoose = require('mongoose');
const User = require('./models/User');
const Chat = require('./models/Chat');
const Message = require('./models/Message');
const Report = require('./models/Report');
const Payment = require('./models/Payment');
const KarmaBook = require('./models/KarmaBook');
const Reputation = require('./models/Reputation');
const Verification = require('./models/Verification');
const Escalation = require('./models/Escalation');
const Notification = require('./models/Notification');
const AuditLog = require('./models/AuditLog');
const { requireSuperAdmin } = require('./routes-auth');

const router = express.Router();
router.use(requireSuperAdmin);

const audit = (action, targetType, targetId, detail) =>
  AuditLog.create({ actor: 'super-admin', action, targetType, targetId: String(targetId), detail });

const oid = v => mongoose.Types.ObjectId.isValid(v);

// ---- Platform overview ----------------------------------------------------
router.get('/stats', async (req, res, next) => {
  try {
    const dayStart = new Date(Date.now() - 24 * 3600 * 1000);
    const [users, verified, paid, pro, max, suspended, banned,
      chats, messages, messages24h, reportsPending, reportsEscalated,
      payments, escalations] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ 'verification.idVerified': true }),
      User.countDocuments({ 'membership.joinFeePaid': true }),
      User.countDocuments({ 'membership.tier': 'pro' }),
      User.countDocuments({ 'membership.tier': 'max' }),
      User.countDocuments({ 'status.suspended': true }),
      User.countDocuments({ 'status.banned': true }),
      Chat.countDocuments({}),
      Message.countDocuments({}),
      Message.countDocuments({ createdAt: { $gt: dayStart } }),
      Report.countDocuments({ status: 'pending' }),
      Report.countDocuments({ autoEscalated: true, status: { $ne: 'resolved' } }),
      Payment.aggregate([
        { $match: { status: 'captured' } },
        { $group: { _id: null, count: { $sum: 1 }, totalCHF: { $sum: '$amountCHF' } } }
      ]),
      Escalation.countDocuments({})
    ]);
    res.json({
      users: { total: users, verified, paid, pro, max, suspended, banned },
      chats: { total: chats, messages, messages24h },
      moderation: { reportsPending, reportsEscalated, karmaEscalations: escalations },
      revenue: { capturedPayments: payments[0]?.count || 0, totalCHF: +(payments[0]?.totalCHF || 0).toFixed(2) }
    });
  } catch (err) { next(err); }
});

// ---- User search & inspection ---------------------------------------------
router.get('/users', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const filter = {};
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ phone: rx }, { 'profile.firstName': rx }, { 'profile.displayName': rx }];
      if (oid(q)) filter.$or.push({ _id: q });
    }
    const users = await User.find(filter).sort({ createdAt: -1 }).limit(25)
      .select('phone profile.firstName profile.displayName profile.gender profile.age profile.city membership.tier membership.joinFeePaid verification.idVerified status createdAt lastActiveAt');
    const books = await KarmaBook.find({ userId: { $in: users.map(u => u._id) } }).select('userId score');
    const scoreBy = Object.fromEntries(books.map(b => [b.userId.toString(), b.score]));
    res.json({
      users: users.map(u => ({
        id: u._id, phone: u.phone,
        name: u.profile?.displayName || u.profile?.firstName || '—',
        gender: u.profile?.gender, age: u.profile?.age, city: u.profile?.city,
        tier: u.membership?.tier || 'free', joinFeePaid: !!u.membership?.joinFeePaid,
        idVerified: !!u.verification?.idVerified,
        karma: scoreBy[u._id.toString()] ?? 100,
        suspended: !!u.status?.suspended, banned: !!u.status?.banned,
        deletedAt: u.status?.deletedAt || null,
        createdAt: u.createdAt, lastActiveAt: u.lastActiveAt
      }))
    });
  } catch (err) { next(err); }
});

router.get('/users/:id', async (req, res, next) => {
  try {
    if (!oid(req.params.id)) return res.status(400).json({ error: 'Invalid user id' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const [karma, reputation, payments, reportsAgainst, reportsBy, verifications, chatCount] = await Promise.all([
      KarmaBook.findOne({ userId: user._id }),
      Reputation.findOne({ userId: user._id }),
      Payment.find({ userId: user._id }).sort({ createdAt: -1 }).limit(30),
      Report.find({ reportedUserId: user._id }).sort({ createdAt: -1 }).limit(30),
      Report.find({ reporterId: user._id }).sort({ createdAt: -1 }).limit(30),
      Verification.find({ userId: user._id }).sort({ submittedAt: -1 }).limit(20),
      Chat.countDocuments({ participants: user._id })
    ]);

    await audit('sa_user_viewed', 'user', user._id, { phone: user.phone });
    res.json({ user, karma, reputation, payments, reportsAgainst, reportsBy, verifications, chatCount });
  } catch (err) { next(err); }
});

router.get('/users/:id/chats', async (req, res, next) => {
  try {
    if (!oid(req.params.id)) return res.status(400).json({ error: 'Invalid user id' });
    const chats = await Chat.find({ participants: req.params.id })
      .sort({ lastMessageAt: -1 }).limit(100);
    const otherIds = chats.map(c => c.participants.find(p => p.toString() !== req.params.id)).filter(Boolean);
    const others = await User.find({ _id: { $in: otherIds } }).select('profile.firstName profile.displayName phone');
    const nameBy = Object.fromEntries(others.map(u => [u._id.toString(),
      (u.profile?.displayName || u.profile?.firstName || '—') + ' (' + u.phone + ')']));
    res.json({
      chats: chats.map(c => {
        const other = c.participants.find(p => p.toString() !== req.params.id);
        return {
          chatId: c._id, with: other ? (nameBy[other.toString()] || other) : '—',
          withUserId: other || null,
          messageCount: c.messageCount, lastMessageAt: c.lastMessageAt,
          anonymous: !!c.anonymity?.isAnonymous, status: c.status, intent: c.intent
        };
      })
    });
  } catch (err) { next(err); }
});

// ---- Chat content inspection — reason REQUIRED, always audited -------------
router.get('/chats/:chatId/messages', async (req, res, next) => {
  try {
    if (!oid(req.params.chatId)) return res.status(400).json({ error: 'Invalid chat id' });
    const reason = String(req.query.reason || '').trim();
    if (reason.length < 10) {
      return res.status(400).json({
        error: 'A written reason (min 10 characters) is required to view chat content. It is recorded permanently in the audit log.'
      });
    }
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    const participants = await User.find({ _id: { $in: chat.participants } })
      .select('profile.firstName profile.displayName phone');
    const nameBy = Object.fromEntries(participants.map(u => [u._id.toString(),
      u.profile?.displayName || u.profile?.firstName || u.phone]));

    const messages = await Message.find({ chatId: chat._id }).sort({ createdAt: 1 }).limit(500);

    await audit('sa_chat_inspected', 'chat', chat._id, {
      reason,
      participants: chat.participants.map(p => p.toString()),
      messagesReturned: messages.length
    });

    res.json({
      chat: {
        chatId: chat._id, status: chat.status, intent: chat.intent,
        anonymous: !!chat.anonymity?.isAnonymous, messageCount: chat.messageCount,
        participants: chat.participants.map(p => ({ userId: p, name: nameBy[p.toString()] || '—' }))
      },
      messages: messages.map(m => ({
        from: nameBy[m.from.toString()] || m.from, fromId: m.from,
        text: m.deleted ? '[deleted]' : m.text,
        createdAt: m.createdAt, readAt: m.readAt || null
      })),
      auditNote: 'This access was recorded in the audit log with your stated reason.'
    });
  } catch (err) { next(err); }
});

// ---- Emergency account controls (audited, reason required) -----------------
router.post('/users/:id/action', async (req, res, next) => {
  try {
    if (!oid(req.params.id)) return res.status(400).json({ error: 'Invalid user id' });
    const { action } = req.body;
    const reason = String(req.body.reason || '').trim();
    if (reason.length < 5) return res.status(400).json({ error: 'A reason is required for account actions.' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const notify = (type, title, body, severity = 'critical') => Notification.create({
      userId: user._id, type, title, body, severity, createdAt: new Date(), read: false
    });

    if (action === 'warn') {
      await notify('moderation_warning', 'Official warning',
        'Your account received an official warning from the Sambandh safety team: ' + reason, 'warning');
    } else if (action === 'suspend_24h' || action === 'suspend_7d') {
      const hours = action === 'suspend_24h' ? 24 : 168;
      await User.findByIdAndUpdate(user._id, {
        'status.suspended': true,
        suspension: { endsAt: new Date(Date.now() + hours * 3600 * 1000), reason }
      });
      await notify('account_suspended', 'Account suspended',
        `Your account is suspended for ${hours} hours. Reason: ${reason}`);
    } else if (action === 'ban') {
      await User.findByIdAndUpdate(user._id, { 'status.banned': true, 'status.active': false });
      await notify('account_suspended', 'Account permanently banned',
        'Your account has been permanently banned. Reason: ' + reason);
    } else if (action === 'unsuspend') {
      await User.findByIdAndUpdate(user._id, { 'status.suspended': false, suspension: null });
    } else if (action === 'unban') {
      await User.findByIdAndUpdate(user._id, { 'status.banned': false, 'status.active': true });
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }

    await audit('sa_account_action', 'user', user._id, { action, reason });
    res.json({ ok: true, action });
  } catch (err) { next(err); }
});

// ---- The oversight trail ----------------------------------------------------
router.get('/audit', async (req, res, next) => {
  try {
    const limit = Math.min(500, parseInt(req.query.limit) || 100);
    const entries = await AuditLog.find().sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ entries });
  } catch (err) { next(err); }
});

module.exports = router;
