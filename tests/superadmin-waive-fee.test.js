// tests/superadmin-waive-fee.test.js — the owner-only "Waive fee" action: the super
// admin can approve/comp a member's join fee so they skip the pay gate. Owner-gated.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';
process.env.SUPER_ADMIN_KEY = 'test-super-key';

const express = require('express');
const request = require('supertest');
const db = require('./helpers/pg-db');            // must precede model/route requires

const superRouter = require('../src/routes-superadmin');
const { errorHandler } = require('../src/lib/errors');
const User = require('../src/models/User');

const app = express();
app.use(express.json());
app.use('/api/superadmin', superRouter);
app.use(errorHandler());
const SK = { 'X-Super-Key': 'test-super-key' };

let seq = 6800000000;
const mkUser = (over = {}) => User.create({ phone: '+91' + (seq++), ...over });
const act = (id, body, headers = SK) => request(app).post('/api/superadmin/users/' + id + '/action').set(headers).send(body);

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('super-admin waive_fee', () => {
  test('waives the join fee and grants a paid (base) membership', async () => {
    const u = await mkUser({ membership: { joinFeePaid: false, tier: 'free' } });
    const r = await act(u._id, { action: 'waive_fee', reason: 'razorpay reviewer access' });
    expect(r.status).toBe(200);
    const after = await User.findById(u._id);
    expect(after.membership.joinFeePaid).toBe(true);
    expect(after.membership.tier).toBe('base');
    expect(new Date(after.membership.tierExpiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  test('keeps an existing higher tier (does not downgrade pro→base)', async () => {
    const u = await mkUser({ membership: { joinFeePaid: false, tier: 'pro' } });
    await act(u._id, { action: 'waive_fee', reason: 'comp' });
    expect((await User.findById(u._id)).membership.tier).toBe('pro');
  });

  test('is owner-only — no super key is rejected', async () => {
    const u = await mkUser();
    const r = await act(u._id, { action: 'waive_fee', reason: 'nope' }, {});
    expect([401, 403]).toContain(r.status);
    expect((await User.findById(u._id)).membership && (await User.findById(u._id)).membership.joinFeePaid).toBeFalsy();
  });
});
