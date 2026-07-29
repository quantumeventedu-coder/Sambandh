// tests/location-admin.test.js — the admin location-oversight backend: /me/location appends a
// throttled trail, and the super-admin endpoints expose latest points + per-user trail.

const express = require('express');
const request = require('supertest');
const db = require('./helpers/pg-db');
const { ID: TEST_USER_ID } = require('./payment.helpers');

jest.mock('../src/routes-auth', () => ({
  requireAuth: (req, _res, next) => { req.userId = require('./payment.helpers').userId(); next(); },
  requireAdmin: (req, _res, next) => next(),
  requireSuperAdmin: (req, _res, next) => { req.userId = require('./payment.helpers').userId(); next(); },
}));

const meRouter = require('../src/routes-me');
const adminRouter = require('../src/routes-superadmin');
const User = require('../src/models/User');
const LocationPing = require('../src/models/LocationPing');

const app = express();
app.use(express.json());
app.use('/me', meRouter);
app.use('/superadmin', adminRouter);

beforeAll(db.start); afterAll(db.stop); afterEach(db.clear);
const mkUser = (over = {}) => User.create({ _id: TEST_USER_ID, phone: '+919000000001', profile: { firstName: 'Aarav', city: 'Mumbai' }, ...over });

describe('POST /me/location appends a throttled trail', () => {
  test('two fixes within the window → ONE ping; profile.location updated', async () => {
    await mkUser();
    await request(app).post('/me/location').send({ lat: 19.07, lng: 72.87, accuracy: 12 });
    await request(app).post('/me/location').send({ lat: 19.08, lng: 72.88, accuracy: 10 });
    expect(await LocationPing.countDocuments({ userId: TEST_USER_ID })).toBe(1);   // throttled to ~90s
    const u = await User.findById(TEST_USER_ID);
    expect(u.profile.location.lat).toBeCloseTo(19.08, 2);
  });
});

describe('GET /superadmin/locations', () => {
  test('returns a point for each user that has a location, with status flags', async () => {
    await mkUser({ verification: { idVerified: true }, lastActiveAt: new Date() });
    await request(app).post('/me/location').send({ lat: 12.97, lng: 77.59 });
    const r = await request(app).get('/superadmin/locations');
    expect(r.status).toBe(200);
    expect(r.body.points.length).toBe(1);
    expect(r.body.points[0]).toMatchObject({ name: 'Aarav', verified: true, active: true });
    expect(r.body.points[0].lat).toBeCloseTo(12.97, 2);
  });

  test('a user without a location is not plotted', async () => {
    await mkUser();   // no /me/location call → no profile.location
    const r = await request(app).get('/superadmin/locations');
    expect(r.body.points.length).toBe(0);
  });
});

describe('POST /me/bg-location-consent (native background-location opt-in)', () => {
  test('grant then revoke updates the recorded consent', async () => {
    await mkUser();
    const g = await request(app).post('/me/bg-location-consent').send({ consent: true });
    expect(g.body.consent).toBe(true);
    expect((await User.findById(TEST_USER_ID)).preferences.backgroundLocationConsent).toBe(true);
    const r = await request(app).post('/me/bg-location-consent').send({ consent: false });
    expect(r.body.consent).toBe(false);
    expect((await User.findById(TEST_USER_ID)).preferences.backgroundLocationConsent).toBe(false);
  });
});

describe('device recognition + delete', () => {
  const { parseUA } = require('../src/services/device');
  test('parseUA classifies common devices', () => {
    expect(parseUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Safari').type).toBe('iPhone');
    expect(parseUA('Mozilla/5.0 (Linux; Android 14; Pixel) Chrome/126').type).toBe('Android');
    expect(parseUA('Mozilla/5.0 (Windows NT 10.0; Win64) Chrome/126').type).toBe('Windows PC');
  });

  test('/me/location records the device from the User-Agent, and it appears on the map point', async () => {
    await mkUser();
    await request(app).post('/me/location').set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari').send({ lat: 19, lng: 72 });
    expect((await User.findById(TEST_USER_ID)).lastDevice.type).toBe('iPhone');
    const r = await request(app).get('/superadmin/locations');
    expect(r.body.points[0].device.type).toBe('iPhone');
  });

  test('the super-admin delete action erases the user', async () => {
    await mkUser();
    const r = await request(app).post('/superadmin/users/' + TEST_USER_ID + '/action').send({ action: 'delete', reason: 'test cleanup' });
    expect(r.body.deleted).toBe(true);
    expect(await User.findById(TEST_USER_ID)).toBeNull();
  });
});

describe('GET /superadmin/users/:id/location-trail', () => {
  test('returns the trail and a dwell duration', async () => {
    await mkUser();
    const now = Date.now();
    await LocationPing.create({ userId: TEST_USER_ID, lat: 19.0, lng: 72.8, at: new Date(now - 40 * 60000) });
    await LocationPing.create({ userId: TEST_USER_ID, lat: 19.0001, lng: 72.8001, at: new Date(now - 10 * 60000) }); // ~15 m away
    const r = await request(app).get('/superadmin/users/' + TEST_USER_ID + '/location-trail?days=7');
    expect(r.status).toBe(200);
    expect(r.body.points).toBe(2);
    expect(r.body.trail.length).toBe(2);
    expect(r.body.dwellMs).toBeGreaterThanOrEqual(29 * 60000);   // ~30 min within 150 m of the latest
  });
});
