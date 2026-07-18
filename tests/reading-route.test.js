// tests/reading-route.test.js — the reading endpoints + the self-declare feature
// intake, on real Postgres (pglite). Asserts the routes return jargon-free strings
// and that the marriage-intent gate on the deeper pair reading holds.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
// Real Postgres via pg-odm + pglite. Must precede the model/route requires.
const db = require('./helpers/pg-db');

const authRouter = require('../src/routes-auth');
const readingRouter = require('../src/routes-reading');
const guards = require('../src/services/reading-guards');
const User = require('../src/models/User');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/reading', readingRouter);

const token = (id) => 'Bearer ' + jwt.sign({ userId: String(id), role: 'user' }, process.env.JWT_SECRET, { expiresIn: '1d' });

const CHART = { birthDate: '1990-05-15', birthTime: '10:30', birthPlace: { city: 'Test', lat: 12.97, lng: 77.59 } };
const mkUser = (over = {}) => User.create({
  phone: '+91' + Math.floor(6000000000 + Math.random() * 3999999999),
  astrology: CHART, intent: ['marriage'], ...over
});

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('feature intake — self-declared only, validated', () => {
  test('a valid features patch is stored on the user', async () => {
    const u = await mkUser();
    const r = await request(app).patch('/api/auth/profile').set('Authorization', token(u._id))
      .send({ languages: ['hindi'], features: { eyes: 'sharp', voice: 'deep', build: 'solid' } });
    expect(r.status).toBe(200);
    const saved = await User.findById(u._id);
    expect(saved.features.eyes).toBe('sharp');
    expect(saved.features.voice).toBe('deep');
    expect(saved.features.build).toBe('solid');
  });

  test('a value outside the fixed dropdown is rejected (400)', async () => {
    const u = await mkUser();
    const r = await request(app).patch('/api/auth/profile').set('Authorization', token(u._id))
      .send({ languages: ['hindi'], features: { eyes: 'hazel-with-flecks' } });   // not an allowed enum
    expect(r.status).toBe(400);
  });

  test('a partial features patch keeps the fields it did not touch', async () => {
    const u = await mkUser({ features: { eyes: 'soft' } });
    await request(app).patch('/api/auth/profile').set('Authorization', token(u._id))
      .send({ languages: ['hindi'], features: { voice: 'clear' } });
    const saved = await User.findById(u._id);
    expect(saved.features.eyes).toBe('soft');    // untouched
    expect(saved.features.voice).toBe('clear');  // added
  });
});

describe('GET /api/reading/me — full reading, jargon-free', () => {
  test('returns four answer cards and a nature line, all clean', async () => {
    const u = await mkUser({ features: { eyes: 'sharp', build: 'solid' } });
    const r = await request(app).get('/api/reading/me').set('Authorization', token(u._id));
    expect(r.status).toBe(200);
    for (const q of ['who_you_are', 'your_pattern', 'your_person', 'your_timing']) {
      expect(r.body.reading[q].answer.length).toBeGreaterThan(0);
      expect(guards.findJargon(r.body.reading[q].answer)).toBeNull();
      expect(guards.hardFutureViolation(r.body.reading[q].answer)).toBe(false);
    }
    expect(guards.findJargon(r.body.line)).toBeNull();
  });

  test('401 without a token', async () => {
    expect((await request(app).get('/api/reading/me')).status).toBe(401);
  });
});

describe('GET /api/reading/:userId — what a profile shows', () => {
  test('returns a clean nature line + who-they-are', async () => {
    const me = await mkUser();
    const other = await mkUser({ features: { voice: 'quick', gait: 'fast' } });
    const r = await request(app).get('/api/reading/' + other._id).set('Authorization', token(me._id));
    expect(r.status).toBe(200);
    expect(guards.findJargon(r.body.line)).toBeNull();
    expect(guards.findJargon(r.body.who)).toBeNull();
  });
});

describe('GET /api/reading/compat/:userId — gated on mutual marriage intent', () => {
  test('NOT unlocked when the other person has not set marriage intent — only a hint', async () => {
    const me = await mkUser({ intent: ['marriage'] });
    const other = await mkUser({ intent: ['dating'] });
    const r = await request(app).get('/api/reading/compat/' + other._id).set('Authorization', token(me._id));
    expect(r.status).toBe(200);
    expect(r.body.unlocked).toBe(false);
    expect(r.body.answer).toBeUndefined();          // nothing deep leaks
    expect(guards.findJargon(r.body.hint)).toBeNull();
  });

  test('unlocked when BOTH have marriage intent — a deeper reading, still clean', async () => {
    const me = await mkUser({ intent: ['marriage'] });
    const other = await mkUser({ intent: ['marriage', 'dating'] });
    const r = await request(app).get('/api/reading/compat/' + other._id).set('Authorization', token(me._id));
    expect(r.status).toBe(200);
    expect(r.body.unlocked).toBe(true);
    expect(r.body.answer.length).toBeGreaterThan(0);
    expect(guards.findJargon(r.body.answer)).toBeNull();
  });
});
