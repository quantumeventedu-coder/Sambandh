// routes-me.js — account: settings, pause, data export (DPDP Act 2023)

const express = require('express');
const { z } = require('zod');
const User = require('./models/User');
const Chat = require('./models/Chat');
const Message = require('./models/Message');
const Claim = require('./models/Claim');
const KarmaBook = require('./models/KarmaBook');
const Payment = require('./models/Payment');
const Verification = require('./models/Verification');
const Notification = require('./models/Notification');
const { requireAuth } = require('./routes-auth');

const router = express.Router();

// GET /api/me/data-export — full JSON export (legally required, DPDP Act 2023)
router.get('/data-export', requireAuth, async (req, res, next) => {
  try {
    const [user, chats, karma, claims, payments, verifications, notifications] = await Promise.all([
      User.findById(req.userId).lean(),
      Chat.find({ participants: req.userId }).lean(),
      KarmaBook.findOne({ userId: req.userId }).lean(),
      Claim.find({ userId: req.userId }).lean(),
      Payment.find({ userId: req.userId }).lean(),
      Verification.find({ userId: req.userId }).lean(),
      Notification.find({ userId: req.userId }).lean()
    ]);
    const messages = await Message.find({ from: req.userId }).lean();

    res.setHeader('Content-Disposition', 'attachment; filename="sambandh-data-export.json"');
    res.json({
      exportedAt: new Date(),
      account: user,
      chats,
      messagesSent: messages,
      karmaBook: karma,
      claims,
      payments,
      verifications,
      notifications
    });
  } catch (err) { next(err); }
});

// PATCH /api/me/settings — privacy + matching preferences
const channelEnum = z.enum(['push', 'email', 'both', 'none']);
const settingsSchema = z.object({
  interestedInGenders: z.array(z.enum(['male', 'female', 'non_binary', 'other'])).optional(),
  ageRange: z.object({ min: z.number().min(18).max(60), max: z.number().min(18).max(60) }).optional(),
  maxDistanceKm: z.number().optional(),
  intentFilter: z.array(z.enum(['marriage', 'dating', 'casual', 'friendship'])).optional(),
  anonymousModeEnabled: z.boolean().optional(),
  showProfessionToOthers: z.boolean().optional(),
  showAstrologyToOthers: z.boolean().optional(),
  allowNSFWChats: z.boolean().optional(),
  // Karma Book updates are deliberately absent — always delivered (spec §2.8.3)
  notificationPrefs: z.object({
    new_match: channelEnum.optional(),
    new_message: channelEnum.optional(),
    message_while_away: channelEnum.optional(),
    verification: channelEnum.optional(),
    system: channelEnum.optional()
  }).optional()
});

router.patch('/settings', requireAuth, async (req, res, next) => {
  try {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });

    const updates = {};
    for (const [k, v] of Object.entries(parsed.data)) {
      if (k === 'notificationPrefs') {
        for (const [nk, nv] of Object.entries(v)) updates[`preferences.notificationPrefs.${nk}`] = nv;
      } else {
        updates['preferences.' + k] = v;
      }
    }
    const user = await User.findByIdAndUpdate(req.userId, updates, { new: true });
    res.json({ ok: true, preferences: user.preferences });
  } catch (err) { next(err); }
});

// POST /api/me/location — save precise device GPS (browser Geolocation).
// Powers accurate distance in discover. Reverse-geocodes to the nearest known
// city (offline, from our own dataset — no third-party maps) for display.
const { CITIES, haversineKm } = require('./data/cities');
const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000).optional()
});
function nearestCity(lat, lng) {
  let best = null, bestKm = Infinity;
  for (const [name, state, clat, clng] of CITIES) {
    const km = haversineKm(lat, lng, clat, clng);
    if (km !== null && km < bestKm) { bestKm = km; best = { name, state }; }
  }
  return best;
}
router.post('/location', requireAuth, async (req, res, next) => {
  try {
    const parsed = locationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid coordinates' });
    const { lat, lng, accuracy } = parsed.data;
    const updates = {
      'profile.location': { lat, lng, accuracy: accuracy ?? null, updatedAt: new Date() }
    };
    // Fill city/state from our own dataset only if the user hasn't set them.
    const me = await User.findById(req.userId).select('profile.city profile.state').lean();
    if (!me?.profile?.city) {
      const c = nearestCity(lat, lng);
      if (c) { updates['profile.city'] = c.name; updates['profile.state'] = c.state; }
    }
    const user = await User.findByIdAndUpdate(req.userId, updates, { new: true });
    res.json({ ok: true, city: user.profile?.city || null, state: user.profile?.state || null });
  } catch (err) { next(err); }
});

// POST /api/me/pause — hide profile from discover without deleting
router.post('/pause', requireAuth, async (req, res, next) => {
  try {
    const { paused = true } = req.body;
    await User.findByIdAndUpdate(req.userId, { 'status.active': !paused });
    res.json({ ok: true, paused });
  } catch (err) { next(err); }
});

// ---- Blocking (spec §2.4.5, §2.8.5) ----

// GET /api/me/blocked — list blocked users
router.get('/blocked', requireAuth, async (req, res, next) => {
  try {
    const me = await User.findById(req.userId).populate('blockedUsers', 'profile.firstName profile.displayName profile.city');
    res.json({
      blocked: (me.blockedUsers || []).map(u => ({
        userId: u._id,
        name: u.profile?.displayName || u.profile?.firstName || 'User',
        city: u.profile?.city
      }))
    });
  } catch (err) { next(err); }
});

// POST /api/me/block/:userId — block a user (silent; blocks any active chat too)
router.post('/block/:userId', requireAuth, async (req, res, next) => {
  try {
    if (req.params.userId === req.userId) return res.status(400).json({ error: 'Cannot block yourself' });
    const target = await User.findById(req.params.userId);
    if (!target) return res.status(404).json({ error: 'User not found' });

    await User.findByIdAndUpdate(req.userId, { $addToSet: { blockedUsers: req.params.userId } });
    await Chat.updateMany(
      { participants: { $all: [req.userId, req.params.userId], $size: 2 } },
      { status: 'blocked' });

    res.json({ ok: true }); // the blocked user is never notified
  } catch (err) { next(err); }
});

// DELETE /api/me/block/:userId — unblock (existing chats stay blocked per spec)
router.delete('/block/:userId', requireAuth, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.userId, { $pull: { blockedUsers: req.params.userId } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---- Incognito blocklist: hide my profile from specific users ----

router.get('/incognito', requireAuth, async (req, res, next) => {
  try {
    const me = await User.findById(req.userId).populate('incognitoBlockList', 'profile.firstName profile.displayName');
    res.json({
      list: (me.incognitoBlockList || []).map(u => ({
        userId: u._id, name: u.profile?.displayName || u.profile?.firstName || 'User'
      }))
    });
  } catch (err) { next(err); }
});

router.post('/incognito/:userId', requireAuth, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.userId, { $addToSet: { incognitoBlockList: req.params.userId } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/incognito/:userId', requireAuth, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.userId, { $pull: { incognitoBlockList: req.params.userId } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
