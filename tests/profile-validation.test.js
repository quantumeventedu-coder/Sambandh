// tests/profile-validation.test.js — onboarding must not be blocked by a best-effort
// browser moderation layer returning null, and validation errors must name the real
// failing field (regression for "Invalid profile data (intent: max 2)" shown when a
// photo carried nsfw:null after the NSFW model failed to load).

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('./helpers/pg-db');            // must precede model/route requires

const authRoutes = require('../src/routes-auth');
const { errorHandler } = require('../src/lib/errors');
const User = require('../src/models/User');

const app = express();
app.use(express.json({ limit: '15mb' }));
app.use('/api/auth', authRoutes);
app.use(errorHandler());

let seq = 7700000000;
const mkUser = () => User.create({ phone: '+91' + (seq++) });
const auth = (u) => ({ Authorization: 'Bearer ' + jwt.sign({ userId: String(u._id), phone: u.phone, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '30d' }) });

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('profile PATCH validation', () => {
  test('a photo with nsfw:null is accepted — moderation is best-effort, never blocks onboarding', async () => {
    const u = await mkUser();
    const res = await request(app).patch('/api/auth/profile').set(auth(u))
      .send({ photos: [{ base64: 'AAECAwQF', filename: 'me.jpg', nsfw: null }] });
    expect(res.status).not.toBe(400);   // before the fix this 400'd on nsfw:null
  });

  test('validation errors name the ACTUAL field, not a fixed "intent" hint', async () => {
    const u = await mkUser();
    const res = await request(app).patch('/api/auth/profile').set(auth(u))
      .send({ intent: ['marriage', 'dating', 'casual'] });   // 3 > max 2
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/intent/);
    // and a genuinely-different bad field reports itself (not "intent")
    const res2 = await request(app).patch('/api/auth/profile').set(auth(u))
      .send({ bio: 'x'.repeat(600) });   // bio max 500
    expect(res2.status).toBe(400);
    expect(res2.body.error).toMatch(/bio/);
  });
});
