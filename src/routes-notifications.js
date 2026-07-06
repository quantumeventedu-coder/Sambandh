// routes-notifications.js — user notifications + web-push subscriptions

const express = require('express');
const Notification = require('./models/Notification');
const User = require('./models/User');
const { requireAuth } = require('./routes-auth');
const { vapidPublicKey } = require('./services/notify');

const router = express.Router();

// GET /api/notifications
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.userId })
      .sort({ createdAt: -1 }).limit(50);
    const unread = await Notification.countDocuments({ userId: req.userId, read: false });
    res.json({ notifications, unread });
  } catch (err) { next(err); }
});

// GET /api/notifications/vapid-key — public key the browser needs to subscribe
router.get('/vapid-key', (req, res) => res.json({ key: vapidPublicKey() }));

// POST /api/notifications/subscribe — store a browser web-push subscription
router.post('/subscribe', requireAuth, async (req, res, next) => {
  try {
    const sub = req.body?.subscription || req.body;
    if (!sub || !sub.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
    const user = await User.findById(req.userId);
    const subs = (user.pushSubscriptions || []).filter(s => (s.raw || s).endpoint !== sub.endpoint);
    subs.push({ raw: sub, endpoint: sub.endpoint, createdAt: new Date() });
    await User.findByIdAndUpdate(req.userId, { pushSubscriptions: subs.slice(-5) }); // keep last 5 devices
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/notifications/unsubscribe
router.post('/unsubscribe', requireAuth, async (req, res, next) => {
  try {
    const endpoint = req.body?.endpoint;
    const user = await User.findById(req.userId);
    const subs = (user.pushSubscriptions || []).filter(s => (s.raw || s).endpoint !== endpoint);
    await User.findByIdAndUpdate(req.userId, { pushSubscriptions: subs });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', requireAuth, async (req, res, next) => {
  try {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { read: true }, { new: true });
    if (!n) return res.status(404).json({ error: 'Notification not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Shared delivery helper: creates the in-app notification, web-pushes it to the
// user's registered browsers (pruning dead subscriptions), and emails the user
// for important events. Any route can call this instead of Notification.create.
async function deliverNotification(userId, { type, title, body, severity = 'info' }) {
  const { sendWebPush, sendEventEmail } = require('./services/notify');
  const notif = await Notification.create({ userId, type, title, body, severity, read: false, createdAt: new Date() });
  try {
    const user = await User.findById(userId);
    if (user?.pushSubscriptions?.length) {
      const { dead } = await sendWebPush(user.pushSubscriptions, { title, body, url: '/app#/notifications' });
      if (dead.length) {
        const kept = user.pushSubscriptions.filter((_, i) => !dead.includes(i));
        await User.findByIdAndUpdate(userId, { pushSubscriptions: kept });
      }
    }
    // Email for the things people actually want off-app: matches, moderation, safety.
    if (user?.email && ['new_match', 'account_suspended', 'account_under_review', 'moderation_warning'].includes(type)) {
      await sendEventEmail(user.email, title, body).catch(() => {});
    }
  } catch (e) { console.warn('[NOTIFY] delivery:', e.message); }
  return notif;
}

router.deliverNotification = deliverNotification;
module.exports = router;
