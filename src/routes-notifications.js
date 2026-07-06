// routes-notifications.js — user notifications

const express = require('express');
const Notification = require('./models/Notification');
const { requireAuth } = require('./routes-auth');

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

module.exports = router;
