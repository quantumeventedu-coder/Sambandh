// @ts-check
// routes-couple-location.js — CONSENTED, mutual, revocable, auto-expiring live-location
// sharing between two matched users (mounted at /api/couple/location).
//
// Privacy model (fail-closed on EVERY read/relay):
//  • A share needs a real, mutual match (sharesActiveMatch) and both sides opting in.
//  • A peer's position is visible ONLY while status==='active' AND both sharing AND unexpired.
//  • Either side can revoke instantly → status 'revoked', both fixes nulled, peer told at once.
//  • Auto-expires (hard cap); a nightly sweep also expires + nulls stragglers.
//  • Never covert: the request is announced (notification + socket) and shown as live/paused.
//  • Coordinates go only to the consented peer's socket room + the GET /peer response — and to
//    the SUPER-ADMIN oversight view (routes-superadmin) — never to ordinary admins/moderators.
const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('./routes-auth');
const { sharesActiveMatch } = require('./services/verification-service');
const market = require('./services/marketplace');   // atomicUpdate (CAS)
const LocationShare = require('./models/LocationShare');
const Chat = require('./models/Chat');

const router = express.Router();
const DURATION_CAP_MIN = 480;   // 8 h hard cap
const notify = (/** @type {any} */ uid, /** @type {any} */ n) => {
  try { return /** @type {any} */ (require('./routes-notifications')).deliverNotification(uid, n).catch(() => {}); }
  catch { return Promise.resolve(); }
};

/** Orient a share relative to the caller. @param {any} s @param {any} me */
function sideOf(s, me) {
  const iAmA = String(s.a) === String(me);
  return {
    iAmA,
    peerId: iAmA ? s.b : s.a,
    mySharingField: iAmA ? 'aSharing' : 'bSharing',
    myFixField: iAmA ? 'aFix' : 'bFix',
    mySharing: iAmA ? s.aSharing : s.bSharing,
    peerSharing: iAmA ? s.bSharing : s.aSharing,
    peerFix: iAmA ? s.bFix : s.aFix,
  };
}
/** Is the peer's live position visible right now? Fail-closed. @param {any} s */
function isLive(s) {
  return s.status === 'active' && !!s.aSharing && !!s.bSharing && new Date(s.expiresAt).getTime() > Date.now();
}
function isParticipant(/** @type {any} */ s, /** @type {any} */ me) {
  return s && (String(s.a) === String(me) || String(s.b) === String(me));
}
/** A participant's view of a share (never leaks the peer's fix unless live). @param {any} s @param {any} me */
function pubShare(s, me) {
  const side = sideOf(s, me);
  const live = isLive(s);
  return {
    id: s._id, status: s.status, live,
    iInitiated: String(s.a) === String(me),
    peerId: side.peerId, chatId: s.chatId,
    mySharing: !!side.mySharing, peerSharing: !!side.peerSharing,
    expiresAt: s.expiresAt,
    peerFix: live ? side.peerFix || null : null,   // only when live
  };
}
const emit = (/** @type {any} */ req, /** @type {any} */ uid, /** @type {string} */ ev, /** @type {any} */ data) => {
  const io = req.app.get('io'); if (io) io.to('user:' + uid).emit(ev, data);
};

const startSchema = z.object({ peerId: z.string().min(1), durationMins: z.number().int().positive().max(DURATION_CAP_MIN).optional() });

/** Create (or reuse) a share to `peerId`. Match-gated + never self; announced (never covert).
 * Shared by POST /shares (explicit peerId) and POST /shares/by-chat/:chatId (peer derived from
 * the chat, so the client never needs the peer's id).
 * @param {any} req @param {any} res @param {any} peerId @param {number} [durationMins] */
async function createOrReuseShare(req, res, peerId, durationMins) {
  if (String(peerId) === String(req.userId)) return res.status(400).json({ error: "You can't share with yourself." });
  if (!(await sharesActiveMatch(req.userId, peerId))) return res.status(403).json({ error: 'You can only share live location with a match.' });
  // One live/pending session per pair — reuse an existing one rather than stacking.
  const mine = await LocationShare.find({ pair: req.userId }).limit(50);
  const existing = mine.find((/** @type {any} */ s) => isParticipant(s, peerId) && (s.status === 'active' || s.status === 'pending'));
  if (existing) return res.status(200).json({ share: pubShare(existing, req.userId), reused: true });
  const mins = Math.min(durationMins || 60, DURATION_CAP_MIN);
  const share = await LocationShare.create({
    pair: [req.userId, peerId], a: req.userId, b: peerId,
    chatId: (await Chat.findOne({ participants: { $all: [req.userId, peerId] } }))?._id || null,
    status: 'pending', aSharing: true, bSharing: false, aFix: null, bFix: null,
    expiresAt: new Date(Date.now() + mins * 60000), createdAt: new Date(),
  });
  notify(peerId, { type: 'location_share_request', severity: 'info', title: 'Live location request 📍', body: 'Your match wants to share live location with you. Open it to accept — you can stop anytime.' });
  emit(req, peerId, 'location_share_request', { shareId: share._id });
  return res.status(201).json({ share: pubShare(share, req.userId) });
}

// Request to share live location with a match (explicit peerId).
router.post('/shares', requireAuth, async (req, res, next) => {
  try {
    const parsed = startSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'peerId required' });
    return await createOrReuseShare(req, res, parsed.data.peerId, parsed.data.durationMins);
  } catch (err) { next(err); }
});

// Same, but the peer is derived from a chat the caller is in — so the client (which never sees
// a match's userId in the anonymous-first chat list) can start a share without it.
router.post('/shares/by-chat/:chatId', requireAuth, async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat || !(chat.participants || []).some((/** @type {any} */ p) => String(p) === String(req.userId))) return res.status(404).json({ error: 'Chat not found' });
    const peerId = (chat.participants || []).find((/** @type {any} */ p) => String(p) !== String(req.userId));
    if (!peerId) return res.status(400).json({ error: 'No peer in this chat' });
    const durationMins = Number(req.body && req.body.durationMins) || 60;
    return await createOrReuseShare(req, res, peerId, durationMins);
  } catch (err) { next(err); }
});

// The invited peer accepts → both sharing, session goes live.
router.post('/shares/:id/accept', requireAuth, async (req, res, next) => {
  try {
    const s = await LocationShare.findById(req.params.id);
    if (!s || String(s.b) !== String(req.userId)) return res.status(404).json({ error: 'Request not found' });
    if (s.status !== 'pending') return res.status(409).json({ error: 'This request is no longer pending.' });
    if (new Date(s.expiresAt).getTime() < Date.now()) return res.status(409).json({ error: 'This request has expired.' });
    const won = await market.atomicUpdate(LocationShare, { _id: s._id, status: 'pending' }, { $set: { status: 'active', bSharing: true } });
    if (!won) return res.status(409).json({ error: 'This request is no longer pending.' });
    emit(req, s.a, 'location_share_active', { shareId: s._id });
    emit(req, s.b, 'location_share_active', { shareId: s._id });
    notify(s.a, { type: 'location_share_request', severity: 'info', title: 'Live location is on 📍', body: 'Your match accepted. You are now sharing live location with each other.' });
    res.json({ ok: true, share: pubShare(await LocationShare.findById(s._id), req.userId) });
  } catch (err) { next(err); }
});

// The invited peer declines.
router.post('/shares/:id/decline', requireAuth, async (req, res, next) => {
  try {
    const s = await LocationShare.findById(req.params.id);
    if (!s || String(s.b) !== String(req.userId)) return res.status(404).json({ error: 'Request not found' });
    if (s.status !== 'pending') return res.status(409).json({ error: 'This request is no longer pending.' });
    await market.atomicUpdate(LocationShare, { _id: s._id, status: 'pending' }, { $set: { status: 'declined' } });
    emit(req, s.a, 'location_share_ended', { shareId: s._id });
    res.json({ ok: true, declined: true });
  } catch (err) { next(err); }
});

// Either side revokes → INSTANT stop: status revoked, both fixes nulled, peer told at once.
router.post('/shares/:id/revoke', requireAuth, async (req, res, next) => {
  try {
    const s = await LocationShare.findById(req.params.id);
    if (!s || !isParticipant(s, req.userId)) return res.status(404).json({ error: 'Share not found' });
    const side = sideOf(s, req.userId);
    await market.atomicUpdate(LocationShare, { _id: s._id }, { $set: { status: 'revoked', [side.mySharingField]: false, aFix: null, bFix: null, revokedAt: new Date(), revokedBy: req.userId } });
    emit(req, s.a, 'location_share_ended', { shareId: s._id });
    emit(req, s.b, 'location_share_ended', { shareId: s._id });
    res.json({ ok: true, revoked: true });
  } catch (err) { next(err); }
});

// Cold-open / poll-fallback read of the peer's latest position. Fail-closed.
router.get('/shares/:id/peer', requireAuth, async (req, res, next) => {
  try {
    const s = await LocationShare.findById(req.params.id);
    if (!s || !isParticipant(s, req.userId)) return res.status(404).json({ error: 'Share not found' });
    if (!isLive(s)) return res.json({ live: false, peerFix: null, status: s.status });
    // Defense-in-depth: a block/unmatch since creation cuts reads too, even if the sweep hasn't run.
    if (!(await sharesActiveMatch(s.a, s.b))) return res.json({ live: false, peerFix: null, status: 'revoked' });
    const side = sideOf(s, req.userId);
    res.json({ live: true, peerFix: side.peerFix || null, expiresAt: s.expiresAt });
  } catch (err) { next(err); }
});

// My active/pending shares (badge + resume).
router.get('/shares', requireAuth, async (req, res, next) => {
  try {
    const mine = await LocationShare.find({ pair: req.userId }).sort({ createdAt: -1 }).limit(50);
    const out = mine.filter((/** @type {any} */ s) => ['pending', 'active'].includes(s.status)).map((/** @type {any} */ s) => pubShare(s, req.userId));
    res.json({ shares: out });
  } catch (err) { next(err); }
});

/** Instantly revoke every active/pending share between two users (both fixes nulled, both told).
 * Called when they block/unmatch so sharing STOPS immediately rather than lingering to expiry.
 * @param {any} io @param {any} a @param {any} b */
async function revokeSharesForPair(io, a, b) {
  try {
    const shares = await LocationShare.find({ pair: a }).limit(50);
    for (const s of shares) {
      if (!isParticipant(s, b) || !['active', 'pending'].includes(s.status)) continue;
      const won = await market.atomicUpdate(LocationShare, { _id: s._id }, { $set: { status: 'revoked', aSharing: false, bSharing: false, aFix: null, bFix: null, revokedAt: new Date() } });
      if (won && io) { io.to('user:' + s.a).emit('location_share_ended', { shareId: s._id }); io.to('user:' + s.b).emit('location_share_ended', { shareId: s._id }); }
    }
  } catch { /* best-effort */ }
}

// Relay a fresh fix from POST /me/location to the peer(s) of any active share. The write is a
// STATUS-GUARDED atomic CAS so a concurrent revoke/decline/expire defeats it (never resurrects a
// stopped share, never emits a post-stop fix), and the relationship is RE-CHECKED so a block/
// unmatch since creation instantly severs the share. Best-effort; fail-closed on consent + relation.
async function relayLiveFix(/** @type {any} */ io, /** @type {any} */ userId, /** @type {number} */ lat, /** @type {number} */ lng, /** @type {any} */ accuracy) {
  try {
    const now = Date.now();
    const shares = await LocationShare.find({ pair: userId, status: 'active' }).limit(20);
    for (const s of shares) {
      if (new Date(s.expiresAt).getTime() < now || !s.aSharing || !s.bSharing) continue;
      // A block/unmatch after creation must instantly stop it — sever + tell both, don't relay.
      if (!(await sharesActiveMatch(s.a, s.b))) {
        const won = await market.atomicUpdate(LocationShare, { _id: s._id, status: 'active' }, { $set: { status: 'revoked', aFix: null, bFix: null, revokedAt: new Date() } });
        if (won && io) { io.to('user:' + s.a).emit('location_share_ended', { shareId: s._id }); io.to('user:' + s.b).emit('location_share_ended', { shareId: s._id }); }
        continue;
      }
      const iAmA = String(s.a) === String(userId);
      const at = new Date();
      // Guarded write: only lands while the row is STILL 'active'; a racing revoke/decline/expire-
      // sweep (all of which flip status off 'active') defeats it, so it can never resurrect a stopped
      // share or emit a post-stop fix. (Expiry is checked above on the read; the sweep flips status.)
      const won = await market.atomicUpdate(LocationShare, { _id: s._id, status: 'active' }, { $set: { [iAmA ? 'aFix' : 'bFix']: { lat, lng, accuracy: accuracy ?? null, at } } });
      if (won && io) io.to('user:' + (iAmA ? s.b : s.a)).emit('peer_location', { shareId: s._id, lat, lng, accuracy: accuracy ?? null, at });
    }
  } catch { /* relay is best-effort */ }
}

// Nightly backstop: expire + null any share past its hard cap that's still pending/active.
async function sweepExpiredShares(now = new Date()) {
  let expired = 0;
  const live = await LocationShare.find({ status: 'active' }).limit(5000);
  const pend = await LocationShare.find({ status: 'pending' }).limit(5000);
  for (const s of [...live, ...pend]) {
    if (new Date(s.expiresAt).getTime() < now.getTime()) {
      const won = await market.atomicUpdate(LocationShare, { _id: s._id, status: s.status }, { $set: { status: 'expired', aFix: null, bFix: null } });
      if (won) expired++;
    }
  }
  return { expired };
}

module.exports = router;
module.exports.relayLiveFix = relayLiveFix;
module.exports.revokeSharesForPair = revokeSharesForPair;
module.exports.sweepExpiredShares = sweepExpiredShares;
