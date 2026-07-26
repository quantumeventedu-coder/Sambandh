// tests/commerce-and-trust.test.js — Phase 6: Trust Score surfacing + commerce recommender.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('./helpers/pg-db');            // must precede model/route requires

const { errorHandler } = require('../src/lib/errors');
const User = require('../src/models/User');
const Partner = require('../src/models/Partner');
const Listing = require('../src/models/Listing');
const trustScore = require('../src/services/trust-score');

const app = express();
app.use(express.json());
app.use('/api/me', require('../src/routes-me'));
app.use('/api/commerce', require('../src/routes-commerce'));
app.use(errorHandler());

let seq = 8500000000;
const mkUser = (over) => User.create({ phone: '+91' + (seq++), ...over });
const auth = (u) => ({ Authorization: 'Bearer ' + jwt.sign({ userId: String(u._id), phone: u.phone, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '30d' }) });

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('trust score', () => {
  test('weights sum correctly, level ladders, public badge is coarse', () => {
    const full = { phoneVerified: true, createdAt: new Date(Date.now() - 40 * 86400000), verification: { idVerified: true, selfieVerified: true, professionVerified: true, educationVerified: true, incomeVerified: true } };
    const r = trustScore.computeTrustScore(full);
    expect(r.score).toBe(100);                 // 10+30+15+20+10+10+5
    expect(r.level).toBe('fully_verified');
    const plain = { phoneVerified: false, createdAt: new Date(), verification: {} };
    expect(trustScore.computeTrustScore(plain)).toEqual({ score: 0, level: 'phone_only' });
    expect(trustScore.publicBadge(full)).toEqual({ level: 'fully_verified', verified: true });
    expect(trustScore.publicBadge(plain)).toEqual({ level: 'phone_only', verified: false });
  });

  test('GET /api/me/trust returns the breakdown + next steps', async () => {
    const u = await mkUser({ phoneVerified: true, verification: { selfieVerified: true } });
    const res = await request(app).get('/api/me/trust').set(auth(u));
    expect(res.status).toBe(200);
    expect(res.body.level).toBe('photo_verified');
    expect(res.body.factors.find((f) => f.key === 'phone').earned).toBe(true);
    expect(res.body.factors.find((f) => f.key === 'id').earned).toBe(false);
    expect(res.body.nextSteps.some((f) => f.key === 'id')).toBe(true);   // id not yet earned
  });
});

describe('commerce recommendations', () => {
  test('intent-personalised, trust-aware feed spans marketplace + consultants', async () => {
    const venue = await Partner.create({ name: 'Grand Venue', category: 'venue', active: true, verified: true });
    await Listing.create({ partnerId: venue._id, title: 'Wedding Hall', kind: 'service', priceCHF: 5000, active: true });
    const astro = await Partner.create({ name: 'Astro Guru', category: 'astrologer', active: true, verified: true });
    await Listing.create({ partnerId: astro._id, title: 'Kundali reading', kind: 'booking', priceCHF: 100, active: true });

    const user = await mkUser({ intent: ['marriage'], profile: { location: { lat: 19.07, lng: 72.87 } } });
    const res = await request(app).get('/api/commerce/recommendations').set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.context.categories).toContain('venue');
    expect(res.body.listings.some((c) => c.partner.name === 'Grand Venue')).toBe(true);
    expect(res.body.consultants.some((c) => c.partner.name === 'Astro Guru')).toBe(true);
    expect(res.body.listings[0].factors).toBeDefined();     // explainable
    expect(res.body.listings[0].partner.verified).toBe(true);
  });

  test('no intent → general feed of active partners', async () => {
    const gift = await Partner.create({ name: 'Gift Shop', category: 'gift', active: true });
    await Listing.create({ partnerId: gift._id, title: 'Gift box', kind: 'product', priceCHF: 20, active: true });
    const user = await mkUser({});
    const res = await request(app).get('/api/commerce/recommendations').set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.listings.some((c) => c.partner.name === 'Gift Shop')).toBe(true);
  });
});
