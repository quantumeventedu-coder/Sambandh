// tests/astro-gate.test.js — another member's raw chart / compatibility is a Pro/Max
// feature, same as the Nature Dial reading. A free/base viewer used to get the FULL
// kundali (planets, houses, dashas) via /api/astro/chart/:userId — strictly more than
// the paid reading. These tests pin the tier lock (post-launch).

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('./helpers/pg-db');            // must precede model/route requires
const { launch } = require('./helpers/launch');

const astroRouter = require('../src/routes-astro');
const User = require('../src/models/User');

const app = express();
app.use(express.json());
app.use('/api/astro', astroRouter);

const token = (id, role) => 'Bearer ' + jwt.sign({ userId: String(id), role: role || 'user' }, process.env.JWT_SECRET, { expiresIn: '1d' });
let seq = 7700000000;
const CHART = { birthDate: '1992-04-10', birthTime: '08:30', birthPlace: { lat: 19, lng: 72.8 } };
const mkUser = (over = {}) => User.create({ phone: '+91' + (seq++), astrology: CHART, ...over });
const tier = (t) => ({ membership: { tier: t, joinFeePaid: true, tierExpiresAt: new Date(Date.now() + 30 * 86400000) } });

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);
beforeEach(launch);   // the tier gate is what's under test here, not the launch gate

describe("another member's astrology is gated to Pro/Max", () => {
  test('a FREE viewer gets a locked teaser on /chart/:userId, not the chart', async () => {
    const viewer = await mkUser(tier('free'));
    const target = await mkUser();
    const r = await request(app).get('/api/astro/chart/' + target._id).set('Authorization', token(viewer._id));
    expect(r.status).toBe(200);
    expect(r.body.locked).toBe(true);
    expect(r.body.requiredTier).toBe('pro');
    expect(r.body.chart).toBeUndefined();      // the raw kundali must NOT leak
  });

  test('a BASE viewer is also locked', async () => {
    const viewer = await mkUser(tier('base'));
    const target = await mkUser();
    const r = await request(app).get('/api/astro/chart/' + target._id).set('Authorization', token(viewer._id));
    expect(r.body.locked).toBe(true);
  });

  test('a PRO viewer gets the full chart', async () => {
    const viewer = await mkUser(tier('pro'));
    const target = await mkUser();
    const r = await request(app).get('/api/astro/chart/' + target._id).set('Authorization', token(viewer._id));
    expect(r.body.locked).toBeUndefined();
    expect(r.body.chart).toBeTruthy();
  });

  test('/compat/:userId is likewise gated for a free viewer', async () => {
    const viewer = await mkUser(tier('free'));
    const target = await mkUser();
    const r = await request(app).get('/api/astro/compat/' + target._id).set('Authorization', token(viewer._id));
    expect(r.body.locked).toBe(true);
    expect(r.body.compat).toBeUndefined();
  });

  test('an admin bypasses the tier gate (oversight)', async () => {
    const viewer = await mkUser(tier('free'));
    const target = await mkUser();
    const r = await request(app).get('/api/astro/chart/' + target._id).set('Authorization', token(viewer._id, 'admin'));
    expect(r.body.locked).toBeUndefined();
    expect(r.body.chart).toBeTruthy();
  });
});
