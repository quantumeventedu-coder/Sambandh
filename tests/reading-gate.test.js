// tests/reading-gate.test.js — the full Nature Dial reading (GET /api/reading/:userId)
// is a Sambandh Pro feature: free/base viewers get a locked teaser, pro/max (and
// admins/moderators, for oversight) get the full reading.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('./helpers/pg-db');            // must precede model/route requires

const readingRouter = require('../src/routes-reading');
const User = require('../src/models/User');

const app = express();
app.use(express.json());
app.use('/api/reading', readingRouter);

const token = (id, role) => 'Bearer ' + jwt.sign({ userId: String(id), role: role || 'user' }, process.env.JWT_SECRET, { expiresIn: '1d' });
let seq = 6400000000;
const CHART = { birthDate: '1992-04-10', birthTime: '08:30', birthPlace: { lat: 19, lng: 72.8 } };
const mkUser = (over = {}) => User.create({ phone: '+91' + (seq++), astrology: CHART, ...over });
const tier = (t) => ({ membership: { tier: t, joinFeePaid: true, tierExpiresAt: new Date(Date.now() + 30 * 86400000) } });

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('the full reading is gated to Pro/Max', () => {
  test('a FREE viewer gets a locked teaser (no reading content)', async () => {
    const viewer = await mkUser(tier('free'));
    const target = await mkUser();
    const r = await request(app).get('/api/reading/' + target._id).set('Authorization', token(viewer._id));
    expect(r.status).toBe(200);
    expect(r.body.locked).toBe(true);
    expect(r.body.requiredTier).toBe('pro');
    expect(r.body.line).toBeUndefined();
    expect(r.body.who).toBeUndefined();
  });

  test('a BASE viewer is also locked', async () => {
    const viewer = await mkUser(tier('base'));
    const target = await mkUser();
    const r = await request(app).get('/api/reading/' + target._id).set('Authorization', token(viewer._id));
    expect(r.body.locked).toBe(true);
  });

  test('a PRO viewer gets the full reading', async () => {
    const viewer = await mkUser(tier('pro'));
    const target = await mkUser();
    const r = await request(app).get('/api/reading/' + target._id).set('Authorization', token(viewer._id));
    expect(r.status).toBe(200);
    expect(r.body.locked).toBeUndefined();
    expect(typeof r.body.line).toBe('string');
    expect(typeof r.body.who).toBe('string');
  });

  test('a MAX viewer gets the full reading', async () => {
    const viewer = await mkUser(tier('max'));
    const target = await mkUser();
    const r = await request(app).get('/api/reading/' + target._id).set('Authorization', token(viewer._id));
    expect(r.body.locked).toBeUndefined();
    expect(r.body.line).toBeTruthy();
  });

  test('an expired Pro membership is treated as not active → locked', async () => {
    const viewer = await mkUser({ membership: { tier: 'pro', tierExpiresAt: new Date(Date.now() - 86400000) } });
    const target = await mkUser();
    const r = await request(app).get('/api/reading/' + target._id).set('Authorization', token(viewer._id));
    expect(r.body.locked).toBe(true);
  });

  test('an admin/moderator bypasses the gate (oversight)', async () => {
    const viewer = await mkUser(tier('free'));
    const target = await mkUser();
    const r = await request(app).get('/api/reading/' + target._id).set('Authorization', token(viewer._id, 'admin'));
    expect(r.body.locked).toBeUndefined();
    expect(r.body.line).toBeTruthy();
  });
});
