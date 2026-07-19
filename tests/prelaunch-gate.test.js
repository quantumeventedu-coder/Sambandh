// tests/prelaunch-gate.test.js — the pre-launch early-access gate, on real Postgres.
// In pre-launch: registered non-admins are blocked from the dating surface (403
// prelaunch); admins/moderators bypass; flipping the flag off opens the doors.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('./helpers/pg-db');            // must precede model/route requires

const authRouter = require('../src/routes-auth');
const discoverRouter = require('../src/routes-discover');
const { errorHandler } = require('../src/lib/errors');
const site = require('../src/services/site-mode');
const User = require('../src/models/User');
const AppConfig = require('../src/models/AppConfig');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/discover', discoverRouter);
app.use(errorHandler());

const token = (id, role) => 'Bearer ' + jwt.sign({ userId: String(id), role: role || 'user' }, process.env.JWT_SECRET, { expiresIn: '1d' });
let seq = 6200000000;
const mkUser = (over = {}) => User.create({ phone: '+91' + (seq++), intent: ['dating'], ...over });

beforeAll(db.start);
afterAll(db.stop);
afterEach(async () => { await db.clear(); site._clearCacheForTests(); });

describe('site-mode flag (fail-safe: gated by default)', () => {
  test('no config → pre-launch ON', async () => {
    site._clearCacheForTests();
    expect(await site.isPrelaunch()).toBe(true);
  });

  test('admins/moderators always bypass; users do not', async () => {
    site._clearCacheForTests();
    expect(await site.gatedFor('user')).toBe(true);
    expect(await site.gatedFor('admin')).toBe(false);
    expect(await site.gatedFor('moderator')).toBe(false);
    expect(await site.gatedFor('super_admin')).toBe(false);
  });

  test('setPrelaunch(false) opens the doors for everyone', async () => {
    await site.setPrelaunch(false);
    expect(await site.isPrelaunch()).toBe(false);
    expect(await site.gatedFor('user')).toBe(false);
    await site.setPrelaunch(true);
    expect(await site.gatedFor('user')).toBe(true);
  });
});

describe('the discover feed is gated in pre-launch', () => {
  test('a registered USER is blocked with 403 prelaunch', async () => {
    const u = await mkUser();
    site._clearCacheForTests();                    // no AppConfig → gated
    const r = await request(app).get('/api/discover').set('Authorization', token(u._id, 'user'));
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('prelaunch');
  });

  test('an ADMIN bypasses the gate (reaches the feed)', async () => {
    const u = await mkUser();
    site._clearCacheForTests();
    const r = await request(app).get('/api/discover').set('Authorization', token(u._id, 'admin'));
    expect(r.status).not.toBe(403);                // gate passed (feed may 200/empty)
  });

  test('once launched (prelaunch off), a user reaches the feed', async () => {
    const u = await mkUser();
    await site.setPrelaunch(false);
    const r = await request(app).get('/api/discover').set('Authorization', token(u._id, 'user'));
    expect(r.status).not.toBe(403);
  });

  test('likes are gated too', async () => {
    const u = await mkUser(); const other = await mkUser();
    site._clearCacheForTests();
    const r = await request(app).post('/api/discover/' + other._id + '/like').set('Authorization', token(u._id, 'user'));
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('prelaunch');
  });
});

describe('/auth/config exposes the flag to the app', () => {
  test('reports prelaunch true by default, false after launch', async () => {
    site._clearCacheForTests();
    let r = await request(app).get('/api/auth/config');
    expect(r.status).toBe(200);
    expect(r.body.prelaunch).toBe(true);
    await site.setPrelaunch(false);
    r = await request(app).get('/api/auth/config');
    expect(r.body.prelaunch).toBe(false);
  });
});
