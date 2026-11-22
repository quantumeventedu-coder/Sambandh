// routes-v1.js — the versioned API surface for the native apps (Android / iOS)
// and any future client. Everything under /api/v1/* is the same backend as the
// website: v1-native endpoints live here; every other /api/v1/<x> path is an
// alias of /api/<x> (see the rewrite in server.js), so web and apps can never
// drift apart.

const express = require('express');
const DeviceToken = require('./models/DeviceToken');
const { requireAuth } = require('./routes-auth');
const publicRoutes = require('./routes-public');

const router = express.Router();
const BASE = () => (process.env.PUBLIC_BASE_URL || 'https://www.sambandh.online').replace(/\/+$/, '');

// App bootstrap: version gate + feature switches + canonical links.
router.get('/meta', async (req, res) => {
  let status = {};
  try {
    const cfg = await require('./intelligence/config').get();
    const sp = await require('./intelligence/web/search').provider();
    status = { assistant: cfg.assistantEnabled, memory: cfg.memoryEnabled, webResearch: cfg.webResearchEnabled && sp.name !== 'none' };
  } catch { status = { assistant: true, memory: true, webResearch: false }; }
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({
    brand: 'Sambandh Setu', apiVersion: '1',
    minAppVersion: { android: process.env.MIN_ANDROID_VERSION || '1.0.0', ios: process.env.MIN_IOS_VERSION || '1.0.0' },
    features: { ...status, journey: true, publicProfiles: true, realtimeChat: !process.env.VERCEL, pushNotifications: require('./services/push-mobile').configured() },
    auth: { scheme: 'Bearer', header: 'Authorization', refresh: 'automatic (a renewed token is returned near expiry)' },
    realtime: { transport: 'socket.io', path: '/socket.io', availableOn: process.env.VERCEL ? 'persistent hosts only' : 'this host' },
    links: { web: BASE(), app: BASE() + '/app', profile: BASE() + '/u/{username}', privacy: BASE() + '/#privacy', grievance: 'grievance@sambandh.in' }
  });
});

// Push registration (FCM token for Android, APNs-via-FCM token for iOS).
router.post('/devices', requireAuth, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!['android', 'ios', 'web'].includes(b.platform)) return res.status(400).json({ error: 'platform must be android, ios or web' });
    if (typeof b.token !== 'string' || b.token.length < 20 || b.token.length > 4096) return res.status(400).json({ error: 'a valid push token is required' });
    const doc = await DeviceToken.findOneAndUpdate(
      { token: b.token },
      { $set: { userId: req.userId, platform: b.platform, appVersion: String(b.appVersion || '').slice(0, 20), deviceName: String(b.deviceName || '').slice(0, 60), lastSeenAt: new Date() }, $setOnInsert: { token: b.token, createdAt: new Date() } },
      { upsert: true, new: true }
    );
    res.status(201).json({ ok: true, id: String(doc._id) });
  } catch (e) { next(e); }
});

router.delete('/devices/:token', requireAuth, async (req, res, next) => {
  try {
    const r = await DeviceToken.deleteOne({ token: req.params.token, userId: req.userId });
    res.json({ ok: true, deleted: (r && (r.deletedCount != null ? r.deletedCount : r.n)) || 0 });
  } catch (e) { next(e); }
});

router.get('/devices', requireAuth, async (req, res, next) => {
  try {
    const rows = await DeviceToken.find({ userId: req.userId }).sort({ lastSeenAt: -1 }).lean();
    res.json({ devices: rows.map(d => ({ id: String(d._id), platform: d.platform, appVersion: d.appVersion, deviceName: d.deviceName, lastSeenAt: d.lastSeenAt })) });
  } catch (e) { next(e); }
});

router.use('/public', publicRoutes.api);

// Paths served natively by this router (everything else is rewritten to /api/*).
const NATIVE = /^\/api\/v1\/(meta|devices|public)(\/|\?|$)/;

module.exports = router;
module.exports.NATIVE = NATIVE;
