// tests/cv-route.test.js — the server write-path for the geometric read, end-to-end
// on real Postgres (pglite). The browser measures geometry (MediaPipe, later) and
// POSTs discretised field values; the server MUST route every write through
// feature-guard, so the same ethical lines hold at the HTTP boundary:
//   • no consent            → 403
//   • any complexion term   → 400 (never stored)
//   • CV output             → badge:"reading", provenance "cv"
//   • self-declared value   → never overwritten by CV

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('./helpers/pg-db');            // must precede model/route requires

const authRouter = require('../src/routes-auth');
const meRouter = require('../src/routes-me');
const { errorHandler } = require('../src/lib/errors');
const User = require('../src/models/User');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/me', meRouter);
app.use(errorHandler());                          // typed errors → status + code

const token = (id) => 'Bearer ' + jwt.sign({ userId: String(id), role: 'user' }, process.env.JWT_SECRET, { expiresIn: '1d' });
let seq = 6100000000;
const mkUser = (over = {}) => User.create({ phone: '+91' + (seq++), intent: ['dating'], ...over });

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('POST /api/me/cv-consent', () => {
  test('records explicit opt-in with a timestamp', async () => {
    const u = await mkUser();
    const r = await request(app).post('/api/me/cv-consent').set('Authorization', token(u._id)).send({ geometry: true });
    expect(r.status).toBe(200);
    expect(r.body.geometry).toBe(true);
    const after = await User.findById(u._id);
    expect(after.cvConsent.geometry).toBe(true);
    expect(after.cvConsent.at).toBeTruthy();
  });

  test('requires auth', async () => {
    expect((await request(app).post('/api/me/cv-consent').send({ geometry: true })).status).toBe(401);
  });
});

describe('POST /api/me/geometric-read — guarded write path', () => {
  test('without consent → 403, nothing written', async () => {
    const u = await mkUser();
    const r = await request(app).post('/api/me/geometric-read').set('Authorization', token(u._id))
      .send({ features: { build: 'solid' } });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('forbidden');
    const after = await User.findById(u._id);
    expect(after.features?.build == null).toBe(true);
  });

  test('with consent → writes geometry, tagged cv, badge reading', async () => {
    const u = await mkUser({ cvConsent: { geometry: true } });
    const r = await request(app).post('/api/me/geometric-read').set('Authorization', token(u._id))
      .send({ features: { build: 'solid', forehead: 'broad', voice: 'deep' /* dropped: not measurable */ } });
    expect(r.status).toBe(200);
    expect(r.body.badge).toBe('reading');
    expect(r.body.written.sort()).toEqual(['build', 'forehead']);
    const after = await User.findById(u._id);
    expect(after.features.build).toBe('solid');
    expect(after.featureSources.build).toBe('cv');
    expect(after.features.voice == null).toBe(true);           // non-geometric field never stored
  });

  test('a complexion term is rejected (400) and NEVER stored', async () => {
    const u = await mkUser({ cvConsent: { geometry: true } });
    const r = await request(app).post('/api/me/geometric-read').set('Authorization', token(u._id))
      .send({ features: { skinTone: 'fair', build: 'solid' } });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('validation');
    const after = await User.findById(u._id);
    expect(after.features?.build == null).toBe(true);          // whole write rejected, not partial
    expect(JSON.stringify(after)).not.toMatch(/skinTone|fair/);
  });

  test('CV never overwrites a self-declared feature', async () => {
    const u = await mkUser({ cvConsent: { geometry: true } });
    // user self-declares build via the profile form (stamped source:self)
    await request(app).patch('/api/auth/profile').set('Authorization', token(u._id))
      .send({ languages: ['hindi'], features: { build: 'lean' } });
    // CV then tries to set build + a new field
    const r = await request(app).post('/api/me/geometric-read').set('Authorization', token(u._id))
      .send({ features: { build: 'solid', eyes: 'sharp' } });
    expect(r.status).toBe(200);
    expect(r.body.written).toEqual(['eyes']);                  // build not touched
    const after = await User.findById(u._id);
    expect(after.features.build).toBe('lean');                 // user's word survives
    expect(after.featureSources.build).toBe('self');
    expect(after.featureSources.eyes).toBe('cv');
  });
});
