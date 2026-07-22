// tests/prelaunch-trial-purge.test.js — the two launch-prep features:
//   • early-access 30-day trial: pre-launch registrants get their 30 days (re)started
//     at launch, so gated time isn't burned. Idempotent.
//   • purge-test-data: owner wipes demo/test accounts (no real email, not admin),
//     keeping real + staff accounts.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';
process.env.SUPER_ADMIN_KEY = 'test-super-key';

const express = require('express');
const request = require('supertest');
const db = require('./helpers/pg-db');            // must precede model/route requires

const superRouter = require('../src/routes-superadmin');
const { errorHandler } = require('../src/lib/errors');
const site = require('../src/services/site-mode');
const User = require('../src/models/User');

const app = express();
app.use(express.json());
app.use('/api/superadmin', superRouter);
app.use(errorHandler());
const SK = { 'X-Super-Key': 'test-super-key' };

let seq = 6300000000;
const mkUser = (over = {}) => User.create({ phone: '+91' + (seq++), intent: ['dating'], ...over });

beforeAll(db.start);
afterAll(db.stop);
afterEach(async () => { await db.clear(); site._clearCacheForTests(); });

describe('early-access 30-day trial', () => {
  test('grantEarlyAccessTrials (re)starts 30 days for early-access members only', async () => {
    const early = await mkUser({ membership: { earlyAccess: true, joinFeePaid: true, tier: 'base', tierExpiresAt: new Date(Date.now() - 5 * 86400000) } }); // expired during gating
    const already = await mkUser({ membership: { earlyAccess: true, trialGrantedAt: new Date('2020-01-01'), tierExpiresAt: new Date('2020-02-01') } });
    const normal = await mkUser({ membership: { earlyAccess: false, tier: 'free' } });

    const n = await site.grantEarlyAccessTrials();
    expect(n).toBe(1);                                    // only the un-granted early-access user

    const e = await User.findById(early._id);
    expect(e.membership.tier).toBe('base');
    expect(e.membership.joinFeePaid).toBe(true);
    expect(e.membership.trialGrantedAt).toBeTruthy();
    const days = (new Date(e.membership.tierExpiresAt) - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(29); expect(days).toBeLessThan(31);   // ~30 days from now

    const a = await User.findById(already._id);
    expect(new Date(a.membership.trialGrantedAt).getFullYear()).toBe(2020);   // untouched (idempotent)
    const nrm = await User.findById(normal._id);
    expect(nrm.membership.trialGrantedAt == null).toBe(true);                 // non-early untouched
  });

  test('launching (setPrelaunch false) triggers the trial grant', async () => {
    const u = await mkUser({ membership: { earlyAccess: true } });
    await site.setPrelaunch(false);                       // owner opens the doors
    const after = await User.findById(u._id);
    expect(after.membership.trialGrantedAt).toBeTruthy();
    expect(after.membership.tier).toBe('base');
    await site.setPrelaunch(true);                        // reset for other tests
  });
});

describe('purge test/demo accounts', () => {
  const REALGMAIL = { email: 'owner@gmail.com' };

  test('keeps real-email + admin, deletes the rest; requires confirm', async () => {
    const real = await mkUser(REALGMAIL);
    const admin = await mkUser({ role: 'admin', email: 'staff@ex.com' });  // admin kept despite test email
    const test1 = await mkUser({ email: 'x@ex.com' });
    const test2 = await mkUser({ email: 'y@example.com' });
    const test3 = await mkUser({});                        // phone-only test account

    // without confirm → 400, nothing deleted
    const noConfirm = await request(app).post('/api/superadmin/purge-test-data').set(SK).send({});
    expect(noConfirm.status).toBe(400);
    expect(await User.countDocuments({})).toBe(5);

    const r = await request(app).post('/api/superadmin/purge-test-data').set(SK).send({ confirm: true });
    expect(r.status).toBe(200);
    expect(r.body.deleted).toBe(3);
    expect(r.body.kept).toBe(2);
    expect(await User.findById(real._id)).toBeTruthy();
    expect(await User.findById(admin._id)).toBeTruthy();
    expect(await User.findById(test1._id)).toBeFalsy();
    expect(await User.findById(test3._id)).toBeFalsy();
  });

  test('purge requires the super-admin key', async () => {
    await mkUser({});
    const r = await request(app).post('/api/superadmin/purge-test-data').send({ confirm: true });
    expect(r.status).toBe(401);
  });
});
