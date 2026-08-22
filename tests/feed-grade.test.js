// tests/feed-grade.test.js — a non-Signature member who applies the karma/Lakshan-grade filter must
// still get the feed (the filter is silently ignored), NOT a 403 that bricks the whole Discover surface.

const db = require('./helpers/pg-db');
const ME = '64b7f9c2e1a4d5f6a7b8c9d0';
jest.mock('../src/routes-auth', () => ({
  requireAuth: (req, _res, next) => { req.userId = ME; req.role = 'user'; next(); },
  requireLaunched: (_req, _res, next) => next(),
}));
jest.mock('../src/services/site-mode', () => ({ requireLaunched: (_req, _res, next) => next(), isPrelaunch: async () => false }));

const express = require('express');
const request = require('supertest');
const User = require('../src/models/User');
const router = require('../src/routes-discover');

const app = express();
app.use(express.json());
app.use('/discover', router);

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

const candidate = (i) => User.create({
  phone: '+91900000' + (200 + i),
  profile: { firstName: 'U' + i, gender: 'female', age: 28, city: 'X' },
  membership: { joinFeePaid: true }, verification: { selfieVerified: true }, status: { active: true },
});

test('a non-Signature (base) user applying karmaGrade gets the feed, not a 403', async () => {
  await User.create({ _id: ME, phone: '+919000000000', profile: { firstName: 'Me', gender: 'male', age: 30, city: 'X' }, membership: { joinFeePaid: true, tier: 'base' }, verification: { selfieVerified: true }, status: { active: true } });
  for (let i = 0; i < 3; i++) await candidate(i);
  const r = await request(app).get('/discover?karmaGrade=A&maxKm=anywhere');
  expect(r.status).toBe(200);                       // NOT 403 — the perk filter is ignored, feed still returns
  expect(Array.isArray(r.body.profiles)).toBe(true);
});
