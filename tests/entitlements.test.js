// tests/entitlements.test.js — the tier ladder: what each tier unlocks, the Basic weekly swipe
// cap, the no-free lockout, and the route gates on the Astrology/Consultations/Marketplace verticals.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('./helpers/pg-db');
const User = require('../src/models/User');
const ent = require('../src/services/entitlements');

const app = express();
app.use(express.json());
app.use('/api/consultation', require('../src/routes-consultation'));
app.use('/api/marketplace', require('../src/routes-marketplace'));
const auth = (u) => ({ Authorization: 'Bearer ' + jwt.sign({ userId: String(u._id), phone: u.phone, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '30d' }) });

let seq = 9500000000;
const mk = (tier) => User.create({ phone: '+91' + (seq++), membership: tier ? { tier, tierExpiresAt: new Date(Date.now() + 30 * 86400000) } : {} });

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('tier resolution + feature ladder', () => {
  test('tierOf: unsubscribed / expired → free; active paid → its tier', async () => {
    expect(ent.tierOf(null)).toBe('free');
    expect(ent.tierOf(await mk(null))).toBe('free');
    expect(ent.tierOf(await mk('base'))).toBe('base');
    const expired = await User.create({ phone: '+91' + (seq++), membership: { tier: 'max', tierExpiresAt: new Date(Date.now() - 1000) } });
    expect(ent.tierOf(expired)).toBe('free');                       // expired paid tier → free
  });

  test('access ladder: astrology + consultations = Plus(pro), marketplace = Signature(max)', () => {
    const A = (tier, f) => ent.canAccess({ membership: { tier, tierExpiresAt: new Date(Date.now() + 1e9) } }, f);
    for (const f of ['astrology', 'consultations', 'marketplace']) expect(A('base', f)).toBe(false);   // Basic = dating only
    expect(A('pro', 'astrology')).toBe(true);
    expect(A('pro', 'consultations')).toBe(true);
    expect(A('pro', 'marketplace')).toBe(false);                    // marketplace is Signature-only
    expect(A('max', 'marketplace')).toBe(true);
    expect(A('free', 'astrology')).toBe(false);                     // no free access to anything
  });
});

describe('swipe budget', () => {
  test('Basic is capped at 400/week and blocks past it; Plus/Signature unlimited (never metered); no tier locked', async () => {
    const basic = await mk('base');
    await User.atomicUpdate({ _id: basic._id }, { $set: { swipeWeek: ent.weekKey(new Date()), swipeUsed: 399 } });
    expect(ent.swipeAllowance(await User.findById(basic._id)).ok).toBe(true);     // the 400th is allowed
    await ent.recordSwipe(basic._id);                                            // spend it → 400 used
    const blocked = ent.swipeAllowance(await User.findById(basic._id));
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toBe('limit');

    const plus = await mk('pro');
    expect(ent.swipeAllowance(plus).unlimited).toBe(true);
    await ent.recordSwipe(plus._id);                                             // no-op for unlimited
    expect((await User.findById(plus._id)).swipeUsed).toBeFalsy();               // meter never written

    const none = await mk(null);
    const locked = ent.swipeAllowance(none);
    expect(locked.ok).toBe(false);
    expect(locked.reason).toBe('locked');
  });
});

describe('route gates', () => {
  test('Consultations need Plus: Basic → 403, Plus → 200', async () => {
    const basic = await mk('base'), plus = await mk('pro');
    const denied = await request(app).get('/api/consultation/consultants').set(auth(basic));
    expect(denied.status).toBe(403);
    expect(denied.body.requiredPlan).toBe('Plus');
    expect((await request(app).get('/api/consultation/consultants').set(auth(plus))).status).toBe(200);
  });

  test('Marketplace needs Signature: Plus → 403, Signature → 200', async () => {
    const plus = await mk('pro'), signature = await mk('max');
    const denied = await request(app).get('/api/marketplace/listings').set(auth(plus));
    expect(denied.status).toBe(403);
    expect(denied.body.requiredPlan).toBe('Signature');
    expect((await request(app).get('/api/marketplace/listings').set(auth(signature))).status).toBe(200);
  });
});
