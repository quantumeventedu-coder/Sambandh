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
const { requireLaunched } = require('./services/site-mode');
const eventsSvc = require('./services/events');
const behavior = require('./services/behavior-engine');
const world = require('./services/world-graph');

const router = express.Router();

// GET /api/me/behavior — your own behavioural rhythm, derived live from your event
// stream (activity, consistency, drift, habits) + plain-language insight lines.
router.get('/behavior', requireAuth, async (req, res, next) => {
  try {
    const report = await eventsSvc.behaviorFor(req.userId);
    res.json({ report, insights: behavior.summarize(report) });
  } catch (err) { next(err); }
});

// GET /api/me/network — your relationship graph: connection + community counts,
// and friend-of-friend suggestions (people your matches have matched with).
router.get('/network', requireAuth, requireLaunched, async (req, res, next) => {
  try {
    const [ego, second] = await Promise.all([
      world.egoNetwork(req.userId),
      world.secondDegree(req.userId, { limit: 12 })
    ]);
    res.json({ ...ego, peopleYouMayKnow: second });
  } catch (err) { next(err); }
});

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
  aiTrainingConsent: z.boolean().optional(),
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

// GET /api/me/nakshatra — the requesting user's own nakshatra personality
// profile (Sambandh Intelligence spec §1.3 / §4.3). Needs birth data.
const intelligence = require('./services/intelligence');
router.get('/nakshatra', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).lean();
    const profile = intelligence.nakshatraProfile(user);
    if (!profile) return res.json({ profile: null, needsBirthData: true });
    res.json({ profile });
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

// ---- Geometric read (computer vision → temperament features) ----
// The single sanctioned server path for CV to touch `features`. All the ethical
// guardrails live in services/feature-guard.js: geometry only, NEVER complexion,
// separate consent, self-declared wins, and the output is a READING not a fact.

const featureGuard = require('./services/feature-guard');

// POST /api/me/cv-consent — opt in / out of the geometric read, explicitly. This
// is NOT implied by uploading a photo or by ID verification.
router.post('/cv-consent', requireAuth, async (req, res, next) => {
  try {
    const on = req.body?.geometry === true;
    await User.findByIdAndUpdate(req.userId, {
      'cvConsent.geometry': on,
      'cvConsent.at': new Date()
    });
    res.json({ ok: true, geometry: on });
  } catch (err) { next(err); }
});

// POST /api/me/geometric-read — apply candidate geometry measured in the browser
// (MediaPipe) to the user's features, through the guard. Body: { features: {...} }
// with discretised geometric values only. Rejects (403) without consent, (400) on
// any complexion term. Returns which fields were written, all as READINGS.
router.post('/geometric-read', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ error: 'User not found', code: 'not_found' });
    // Throws ForbiddenError (403) / ValidationError (400) → typed error handler.
    const patch = featureGuard.applyCvFeatures(user, req.body?.features || {});
    const updates = {};
    for (const k of patch.written) {
      updates['features.' + k] = patch.features[k];
      updates['featureSources.' + k] = 'cv';
    }
    if (patch.written.length) await User.findByIdAndUpdate(req.userId, updates);
    res.json({
      ok: true,
      written: patch.written,           // fields the CV filled (undeclared only)
      badge: 'reading',                 // never "verified" — line #2
      features: patch.features,
      sources: patch.featureSources
    });
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
