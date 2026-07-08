// routes-community.js — the Community: open, topic-based anonymous rooms.
// Sambandh isn't only for couples — friends, professionals, newcomers and
// support-seekers get a verified, honest space too. Every member posts under a
// STABLE per-room pseudonym; their real identity is never exposed to the room.
// Verified, paying members only (keeps it real). Moderated by the flag engine.

const express = require('express');
const User = require('./models/User');
const Room = require('./models/Room');
const RoomMessage = require('./models/RoomMessage');
const RoomMember = require('./models/RoomMember');
const Report = require('./models/Report');
const { requireAuth } = require('./routes-auth');
const flagEngine = require('./services/flag-engine');

const router = express.Router();

// ---- Stable anonymous handle per (user, room) ----
const ADJ = ['Quiet', 'Curious', 'Bright', 'Gentle', 'Bold', 'Wise', 'Swift', 'Calm', 'Kind', 'Sharp',
  'Warm', 'Cool', 'Brave', 'Clever', 'Mellow', 'Vivid', 'Noble', 'Lucid', 'Jolly', 'Zesty'];
const ANIMAL = ['Tiger', 'Otter', 'Falcon', 'Panda', 'Heron', 'Lynx', 'Koel', 'Ibis', 'Bison', 'Crane',
  'Gecko', 'Mynah', 'Civet', 'Nilgai', 'Serow', 'Sloth', 'Peacock', 'Langur', 'Dolphin', 'Hornbill'];
function handleFor(userId, roomId) {
  const s = String(userId) + ':' + String(roomId);
  let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ADJ[h % ADJ.length] + ' ' + ANIMAL[(Math.floor(h / ADJ.length)) % ANIMAL.length];
}

// Only verified, active, paying members may see or post in the community.
async function requireMember(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: 'Not found' });
    if (user.status?.banned || user.status?.suspended) return res.status(403).json({ error: 'Account not eligible.' });
    if (!user.verification?.selfieVerified) return res.status(403).json({ error: 'Complete photo verification to join the community.' });
    if (!user.membership?.joinFeePaid) return res.status(403).json({ error: 'An active membership is required to join the community (from CHF 1/month).' });
    req.member = user;
    next();
  } catch (e) { next(e); }
}

// GET /community/rooms — public rooms + private rooms you've joined
router.get('/rooms', requireAuth, requireMember, async (req, res, next) => {
  try {
    const mine = await RoomMember.find({ userId: req.userId }).select('roomId');
    const joinedIds = mine.map(m => m.roomId);
    const joined = new Set(joinedIds.map(id => id.toString()));
    // "not private" covers public rooms and older rooms created before the field existed.
    const rooms = await Room.find({ $or: [{ visibility: { $ne: 'private' } }, { _id: { $in: joinedIds } }] }).sort({ lastMessageAt: -1 });
    res.json({
      rooms: rooms.map(r => ({
        slug: r.slug, name: r.name, topic: r.topic, category: r.category, description: r.description,
        icon: r.icon, memberCount: r.memberCount, messageCount: r.messageCount, lastMessageAt: r.lastMessageAt,
        visibility: r.visibility || 'public', joined: joined.has(r._id.toString()),
        mine: r.createdBy && r.createdBy.toString() === req.userId,
        // only reveal the invite code to members of a private room
        code: (r.visibility === 'private' && joined.has(r._id.toString())) ? r.code : undefined
      }))
    });
  } catch (e) { next(e); }
});

// POST /community/rooms — create a public or private room
router.post('/rooms', requireAuth, requireMember, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 60);
    if (name.length < 3) return res.status(400).json({ error: 'Room name must be at least 3 characters.' });
    const visibility = req.body.visibility === 'private' ? 'private' : 'public';
    const description = String(req.body.description || '').trim().slice(0, 200);
    const base = (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)) || 'room';
    let slug = base, n = 1;
    while (await Room.findOne({ slug })) slug = base + '-' + (++n);
    const code = visibility === 'private' ? require('crypto').randomBytes(4).toString('hex') : undefined;
    const room = await Room.create({
      slug, name, description, topic: description, category: 'general', icon: (req.body.icon || '💬').slice(0, 4),
      visibility, code, createdBy: req.userId, createdAt: new Date(), lastMessageAt: new Date(), memberCount: 1
    });
    await RoomMember.create({ roomId: room._id, userId: req.userId, handle: handleFor(req.userId, room._id), joinedAt: new Date() });
    res.json({ ok: true, slug: room.slug, visibility, code });
  } catch (e) { next(e); }
});

// POST /community/join-by-code — join a private room with its invite code
router.post('/join-by-code', requireAuth, requireMember, async (req, res, next) => {
  try {
    const code = String(req.body.code || '').trim().toLowerCase();
    if (!code) return res.status(400).json({ error: 'Enter an invite code.' });
    const room = await Room.findOne({ code, visibility: 'private' });
    if (!room) return res.status(404).json({ error: 'No private room with that code.' });
    const existing = await RoomMember.findOne({ roomId: room._id, userId: req.userId });
    if (!existing) {
      await RoomMember.create({ roomId: room._id, userId: req.userId, handle: handleFor(req.userId, room._id), joinedAt: new Date() });
      await Room.findByIdAndUpdate(room._id, { $inc: { memberCount: 1 } });
    }
    res.json({ ok: true, slug: room.slug, name: room.name });
  } catch (e) { next(e); }
});

// POST /community/rooms/:slug/join
router.post('/rooms/:slug/join', requireAuth, requireMember, async (req, res, next) => {
  try {
    const room = await Room.findOne({ slug: req.params.slug });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const handle = handleFor(req.userId, room._id);
    const existing = await RoomMember.findOne({ roomId: room._id, userId: req.userId });
    if (room.visibility === 'private' && !existing) return res.status(403).json({ error: 'This is a private room — join with its invite code.' });
    if (!existing) {
      await RoomMember.create({ roomId: room._id, userId: req.userId, handle, joinedAt: new Date() });
      await Room.findByIdAndUpdate(room._id, { $inc: { memberCount: 1 } });
    }
    res.json({ ok: true, handle });
  } catch (e) { next(e); }
});

// GET /community/rooms/:slug/messages?after=<iso> — recent messages (poll-friendly)
router.get('/rooms/:slug/messages', requireAuth, requireMember, async (req, res, next) => {
  try {
    const room = await Room.findOne({ slug: req.params.slug });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.visibility === 'private' && !(await RoomMember.findOne({ roomId: room._id, userId: req.userId }))) {
      return res.status(403).json({ error: 'This is a private room — join with its invite code.' });
    }
    const q = { roomId: room._id };
    if (req.query.after) { const d = new Date(req.query.after); if (!isNaN(d)) q.createdAt = { $gt: d }; }
    const rows = await RoomMessage.find(q).sort({ createdAt: -1 }).limit(60);
    rows.reverse();
    const myHandle = handleFor(req.userId, room._id);
    res.json({
      room: { slug: room.slug, name: room.name, topic: room.topic, memberCount: room.memberCount, category: room.category },
      myHandle,
      messages: rows.map(m => ({ id: m._id, handle: m.handle, text: m.text, createdAt: m.createdAt, mine: m.handle === myHandle }))
    });
  } catch (e) { next(e); }
});

// POST /community/rooms/:slug/messages — post (moderated)
router.post('/rooms/:slug/messages', requireAuth, requireMember, async (req, res, next) => {
  try {
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Message is empty' });
    if (text.length > 1000) return res.status(400).json({ error: 'Message too long (max 1000 characters).' });
    const room = await Room.findOne({ slug: req.params.slug });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const alreadyMember = await RoomMember.findOne({ roomId: room._id, userId: req.userId });
    if (room.visibility === 'private' && !alreadyMember) return res.status(403).json({ error: 'This is a private room — join with its invite code.' });

    // Moderation — run the flag engine; block scam / off-platform / controlling messages.
    const scan = flagEngine.scan({ messages: [{ text, createdAt: new Date() }], context: {} });
    const bad = scan.flags.find(f => ['MONEY_REQUEST_RULE', 'ISOLATION_RULE', 'OFFPLATFORM_RULE', 'COERCION_RULE'].includes(f.ruleId) || f.severity === 'critical');
    if (bad) {
      await Report.create({
        source: 'system', reportedUserId: req.userId,
        category: bad.ruleId === 'MONEY_REQUEST_RULE' ? 'scam' : 'other',
        description: `Community message blocked (${bad.detects}) in #${room.slug}: ${text.slice(0, 180)}`,
        status: 'pending', createdAt: new Date()
      }).catch(() => {});
      return res.status(422).json({ error: 'That message looks unsafe (money request, off-platform, or controlling language) and was not posted.' });
    }

    const handle = handleFor(req.userId, room._id);
    if (!alreadyMember) {
      await RoomMember.create({ roomId: room._id, userId: req.userId, handle });
      await Room.findByIdAndUpdate(room._id, { $inc: { memberCount: 1 } });
    }

    const msg = await RoomMessage.create({ roomId: room._id, userId: req.userId, handle, text, createdAt: new Date() });
    await Room.findByIdAndUpdate(room._id, { $inc: { messageCount: 1 }, lastMessageAt: new Date() });

    const payload = { id: msg._id, handle, text, createdAt: msg.createdAt };
    const io = req.app.get('io');           // realtime broadcast on a Socket.io host
    if (io) io.to('room:' + room.slug).emit('room_message', { slug: room.slug, message: payload });

    res.json({ ok: true, message: { ...payload, mine: true } });
  } catch (e) { next(e); }
});

// POST /community/messages/:id/report
router.post('/messages/:id/report', requireAuth, requireMember, async (req, res, next) => {
  try {
    const msg = await RoomMessage.findById(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    await Report.create({
      source: 'user', reporterId: req.userId, reportedUserId: msg.userId,
      category: ['harassment', 'hate_speech', 'scam', 'other'].includes(req.body.category) ? req.body.category : 'other',
      description: 'Community message reported: ' + String(req.body.reason || msg.text).slice(0, 200),
      status: 'pending', createdAt: new Date()
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---- Default rooms (idempotent seed; called from server ready()) ----
const DEFAULT_ROOMS = [
  { slug: 'welcome', name: 'Welcome to Sambandh', topic: 'New here? Say hi.', category: 'general', icon: '👋', description: 'Introduce yourself anonymously and meet the community.' },
  { slug: 'founders', name: 'Founders & Builders', topic: 'Startups, side-projects, collaborations', category: 'professional', icon: '🚀', description: 'Founders, engineers and creators — find collaborators and co-founders.' },
  { slug: 'career', name: 'Careers & Mentorship', topic: 'Jobs, growth, advice', category: 'professional', icon: '💼', description: 'Professional advice, referrals and mentorship across fields.' },
  { slug: 'friends-blr', name: 'Friends in Bengaluru', topic: 'Meet people in your city', category: 'city', icon: '🌆', description: 'Make friends and plan meetups in Bengaluru.' },
  { slug: 'friends-mumbai', name: 'Friends in Mumbai', topic: 'Meet people in your city', category: 'city', icon: '🌊', description: 'Make friends and plan meetups in Mumbai.' },
  { slug: 'trekkers', name: 'Trekkers & Travel', topic: 'Trails, trips, travel buddies', category: 'interest', icon: '🏔️', description: 'Find travel buddies and share trails.' },
  { slug: 'books-films', name: 'Books & Films', topic: 'What are you reading / watching?', category: 'interest', icon: '📚', description: 'Recommendations, discussions and watch-parties.' },
  { slug: 'wellness', name: 'Wellness & Support', topic: 'A kind, moderated space', category: 'support', icon: '🌿', description: 'A gentle, anonymous space to talk about wellbeing. Not a substitute for professional help.' },
  { slug: 'astrology', name: 'Astrology & Kundali', topic: 'Charts, nakshatras, compatibility', category: 'interest', icon: '✨', description: 'Talk astrology — your nakshatra, doshas and what your chart means.' }
];

async function seedRooms() {
  if (await Room.countDocuments() > 0) return;
  for (const r of DEFAULT_ROOMS) await Room.create({ ...r, createdAt: new Date(), lastMessageAt: new Date() });
  console.log(`[SEED] ${DEFAULT_ROOMS.length} community rooms ready.`);
}

module.exports = router;
module.exports.seedRooms = seedRooms;
module.exports.handleFor = handleFor;
