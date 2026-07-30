// tests/couple-location.test.js — consented, mutual, revocable, auto-expiring live-location
// sharing between matched users. Verifies fail-closed visibility (one-sided opt-in never
// reveals; revoke/expiry stop instantly), match-gating, relay via /me/location, the nightly
// sweep, and super-admin-only oversight.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const express = require('express');
const request = require('supertest');
const db = require('./helpers/pg-db');

jest.mock('../src/routes-auth', () => ({
  requireAuth: (req, _res, next) => { req.userId = req.headers['x-test-user']; next(); },
  requireAdmin: (req, _res, next) => next(),
  requireSuperAdmin: (req, _res, next) => next(),
}));

const couple = require('../src/routes-couple-location');
const meRouter = require('../src/routes-me');
const adminRouter = require('../src/routes-superadmin');
const User = require('../src/models/User');
const Chat = require('../src/models/Chat');
const LocationShare = require('../src/models/LocationShare');

const app = express();
app.use(express.json());
app.use('/api/couple/location', couple);
app.use('/api/me', meRouter);
app.use('/superadmin', adminRouter);

beforeAll(db.start); afterAll(db.stop); afterEach(db.clear);

let seq = 8100000000;
const mkUser = () => User.create({ phone: '+91' + (seq++), profile: { firstName: 'U' + (seq % 1000) } });
const as = (u) => ({ 'x-test-user': String(u._id) });
const match = (a, b) => Chat.create({ participants: [a._id, b._id], status: 'active' });
const startShare = (a, b, body = {}) => request(app).post('/api/couple/location/shares').set(as(a)).send({ peerId: String(b._id), ...body });
const pushFix = (u, lat, lng) => request(app).post('/api/me/location').set(as(u)).send({ lat, lng });

describe('couple live-location: consent + fail-closed', () => {
  test('cannot share with a non-match or with yourself', async () => {
    const a = await mkUser(), b = await mkUser();
    expect((await startShare(a, b)).status).toBe(403);          // not a match
    expect((await request(app).post('/api/couple/location/shares').set(as(a)).send({ peerId: String(a._id) })).status).toBe(400);
  });

  test('request → accept → both sharing → peer visible only once live', async () => {
    const a = await mkUser(), b = await mkUser(); await match(a, b);
    const req = await startShare(a, b);
    expect(req.status).toBe(201);
    const id = req.body.share.id;
    // pending: one-sided opt-in must NOT reveal
    expect((await request(app).get(`/api/couple/location/shares/${id}/peer`).set(as(b))).body.live).toBe(false);
    const acc = await request(app).post(`/api/couple/location/shares/${id}/accept`).set(as(b));
    expect(acc.status).toBe(200);
    expect(acc.body.share.live).toBe(true);
    await pushFix(a, 26.14, 91.73);                             // a's fix relays into the active share
    const peer = await request(app).get(`/api/couple/location/shares/${id}/peer`).set(as(b));
    expect(peer.body.live).toBe(true);
    expect(peer.body.peerFix.lat).toBeCloseTo(26.14, 2);
  });

  test('only the invited peer can accept; a stranger cannot read or revoke', async () => {
    const a = await mkUser(), b = await mkUser(), c = await mkUser(); await match(a, b);
    const id = (await startShare(a, b)).body.share.id;
    expect((await request(app).post(`/api/couple/location/shares/${id}/accept`).set(as(a))).status).toBe(404);  // initiator isn't the invitee
    expect((await request(app).post(`/api/couple/location/shares/${id}/accept`).set(as(c))).status).toBe(404);  // stranger
    expect((await request(app).get(`/api/couple/location/shares/${id}/peer`).set(as(c))).status).toBe(404);
    expect((await request(app).post(`/api/couple/location/shares/${id}/revoke`).set(as(c))).status).toBe(404);
  });

  test('revoke instantly stops sharing and nulls both fixes', async () => {
    const a = await mkUser(), b = await mkUser(); await match(a, b);
    const id = (await startShare(a, b)).body.share.id;
    await request(app).post(`/api/couple/location/shares/${id}/accept`).set(as(b));
    await pushFix(a, 26.14, 91.73);
    expect((await request(app).post(`/api/couple/location/shares/${id}/revoke`).set(as(a))).status).toBe(200);
    expect((await request(app).get(`/api/couple/location/shares/${id}/peer`).set(as(b))).body.live).toBe(false);
    const s = await LocationShare.findById(id);
    expect(s.status).toBe('revoked'); expect(s.aFix).toBeNull(); expect(s.bFix).toBeNull();
  });

  test('expiry serves nothing at read-time and the sweep nulls the straggler', async () => {
    const a = await mkUser(), b = await mkUser(); await match(a, b);
    const id = (await startShare(a, b, { durationMins: 5 })).body.share.id;
    await request(app).post(`/api/couple/location/shares/${id}/accept`).set(as(b));
    await pushFix(a, 26.14, 91.73);
    await LocationShare.findByIdAndUpdate(id, { expiresAt: new Date(Date.now() - 1000) });   // force past the cap
    expect((await request(app).get(`/api/couple/location/shares/${id}/peer`).set(as(b))).body.live).toBe(false);  // fail-closed at read
    const r = await couple.sweepExpiredShares();
    expect(r.expired).toBeGreaterThanOrEqual(1);
    const s = await LocationShare.findById(id);
    expect(s.status).toBe('expired'); expect(s.aFix).toBeNull();
  });

  test('a fix pushed while still PENDING is never relayed or revealed', async () => {
    const a = await mkUser(), b = await mkUser(); await match(a, b);
    const id = (await startShare(a, b)).body.share.id;
    await pushFix(a, 26.14, 91.73);                             // b hasn't accepted → share is 'pending'
    expect((await request(app).get(`/api/couple/location/shares/${id}/peer`).set(as(b))).body.live).toBe(false);
    expect((await LocationShare.findById(id)).aFix).toBeNull(); // relay only runs for 'active' shares
  });

  test('the block/unmatch hook (revokeSharesForPair) instantly severs an active share', async () => {
    const a = await mkUser(), b = await mkUser(); await match(a, b);
    const id = (await startShare(a, b)).body.share.id;
    await request(app).post(`/api/couple/location/shares/${id}/accept`).set(as(b));
    await pushFix(a, 26.14, 91.73);
    await couple.revokeSharesForPair(null, String(a._id), String(b._id));   // exactly what block/unmatch calls
    expect((await request(app).get(`/api/couple/location/shares/${id}/peer`).set(as(b))).body.live).toBe(false);
    const s = await LocationShare.findById(id);
    expect(s.status).toBe('revoked'); expect(s.aFix).toBeNull(); expect(s.bFix).toBeNull();
  });

  test('once the match is severed, reads fail closed and the next relay revokes (relationship re-check)', async () => {
    const a = await mkUser(), b = await mkUser(); const chat = await match(a, b);
    const id = (await startShare(a, b)).body.share.id;
    await request(app).post(`/api/couple/location/shares/${id}/accept`).set(as(b));
    await Chat.findByIdAndUpdate(chat._id, { status: 'blocked' });   // simulate block/unmatch → sharesActiveMatch false
    expect((await request(app).get(`/api/couple/location/shares/${id}/peer`).set(as(b))).body.live).toBe(false);  // read fail-closed
    await pushFix(a, 27, 92);                                        // next fix severs rather than relays
    const s = await LocationShare.findById(id);
    expect(s.status).toBe('revoked'); expect(s.aFix).toBeNull();
  });

  test('a fix pushed after revoke never resurrects the share (status-guarded relay write)', async () => {
    const a = await mkUser(), b = await mkUser(); await match(a, b);
    const id = (await startShare(a, b)).body.share.id;
    await request(app).post(`/api/couple/location/shares/${id}/accept`).set(as(b));
    await request(app).post(`/api/couple/location/shares/${id}/revoke`).set(as(a));
    await pushFix(a, 27, 92);
    const s = await LocationShare.findById(id);
    expect(s.status).toBe('revoked'); expect(s.aFix).toBeNull();
  });

  test('super-admin oversight excludes expired shares (no stale fix served pre-sweep)', async () => {
    const a = await mkUser(), b = await mkUser(); await match(a, b);
    const id = (await startShare(a, b)).body.share.id;
    await request(app).post(`/api/couple/location/shares/${id}/accept`).set(as(b));
    await LocationShare.findByIdAndUpdate(id, { expiresAt: new Date(Date.now() - 1000) });
    const r = await request(app).get('/superadmin/location-shares').set(as(a));
    expect(r.body.shares.length).toBe(0);
  });

  test('start-by-chat derives the peer from the chat (client never needs the peer id)', async () => {
    const a = await mkUser(), b = await mkUser(); const chat = await match(a, b);
    const r = await request(app).post(`/api/couple/location/shares/by-chat/${chat._id}`).set(as(a)).send({});
    expect(r.status).toBe(201);
    expect(String(r.body.share.peerId)).toBe(String(b._id));
    // a non-participant cannot start a share off someone else's chat
    const c = await mkUser();
    expect((await request(app).post(`/api/couple/location/shares/by-chat/${chat._id}`).set(as(c)).send({})).status).toBe(404);
  });

  test('super-admin oversight lists active shares (ordinary admins have no such route)', async () => {
    const a = await mkUser(), b = await mkUser(); await match(a, b);
    const id = (await startShare(a, b)).body.share.id;
    await request(app).post(`/api/couple/location/shares/${id}/accept`).set(as(b));
    const r = await request(app).get('/superadmin/location-shares').set(as(a));
    expect(r.status).toBe(200);
    expect(r.body.shares.length).toBe(1);
    expect(r.body.shares[0].status).toBe('active');
  });
});
