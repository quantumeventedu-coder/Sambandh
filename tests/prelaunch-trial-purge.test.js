// tests/prelaunch-trial-purge.test.js — the two launch-prep features + the bugs the
// adversarial review surfaced:
//   • trial (re)starts 30 days at launch WITHOUT downgrading a paid pro/max tier or
//     shortening an entitlement that already runs past 30 days; idempotent.
//   • paying DURING pre-launch flags membership.earlyAccess (not after launch).
//   • purge deletes demo/test accounts but is pre-launch-only and never removes
//     real-email / admin / early-access members.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';
process.env.SUPER_ADMIN_KEY = 'test-super-key';

const express = require('express');
const request = require('supertest');
const db = require('./helpers/pg-db');            // must precede model/route requires

const superRouter = require('../src/routes-superadmin');
const payment = require('../src/routes-payment');
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
const days = d => (new Date(d) - Date.now()) / 86400000;

beforeAll(db.start);
afterAll(db.stop);
afterEach(async () => { await db.clear(); site._clearCacheForTests(); });

describe('early-access 30-day trial', () => {
  test('(re)starts 30 days for un-granted early-access members only', async () => {
    const early = await mkUser({ membership: { earlyAccess: true, joinFeePaid: true, tier: 'base', tierExpiresAt: new Date(Date.now() - 5 * 86400000) } });
    const already = await mkUser({ membership: { earlyAccess: true, trialGrantedAt: new Date('2020-01-01'), tierExpiresAt: new Date('2020-02-01') } });
    const normal = await mkUser({ membership: { earlyAccess: false, tier: 'free' } });

    const r = await site.grantEarlyAccessTrials();
    expect(r.granted).toBe(1); expect(r.failed).toBe(0);

    const e = await User.findById(early._id);
    expect(e.membership.tier).toBe('base');
    expect(e.membership.joinFeePaid).toBe(true);
    expect(e.membership.trialGrantedAt).toBeTruthy();
    expect(days(e.membership.tierExpiresAt)).toBeGreaterThan(29);
    expect(days(e.membership.tierExpiresAt)).toBeLessThan(31);

    expect(new Date((await User.findById(already._id)).membership.trialGrantedAt).getFullYear()).toBe(2020); // idempotent
    expect((await User.findById(normal._id)).membership.trialGrantedAt == null).toBe(true);                  // non-early untouched
  });

  test('does NOT downgrade a paid pro/max tier', async () => {
    const maxUser = await mkUser({ membership: { earlyAccess: true, tier: 'max', joinFeePaid: true, tierExpiresAt: new Date(Date.now() - 2 * 86400000) } });
    await site.grantEarlyAccessTrials();
    const u = await User.findById(maxUser._id);
    expect(u.membership.tier).toBe('max');                         // kept, not downgraded to base
    expect(days(u.membership.tierExpiresAt)).toBeGreaterThan(29);  // and given ≥30 days
  });

  test('does NOT shorten an entitlement that already runs past 30 days', async () => {
    const longUser = await mkUser({ membership: { earlyAccess: true, tier: 'base', joinFeePaid: true, tierExpiresAt: new Date(Date.now() + 60 * 86400000) } });
    await site.grantEarlyAccessTrials();
    const u = await User.findById(longUser._id);
    expect(days(u.membership.tierExpiresAt)).toBeGreaterThan(55);  // ~60 days kept, not cut to 30
  });

  test('launching (setPrelaunch false) triggers the grant', async () => {
    const u = await mkUser({ membership: { earlyAccess: true } });
    await site.setPrelaunch(false);
    const after = await User.findById(u._id);
    expect(after.membership.trialGrantedAt).toBeTruthy();
    await site.setPrelaunch(true);
  });
});

describe('paying during pre-launch flags early-access', () => {
  test('activateTier sets earlyAccess in pre-launch, not after launch', async () => {
    site._clearCacheForTests();                                   // default: pre-launch ON
    const a = await mkUser({ profile: { gender: 'male' } });
    await payment.activateTier(a._id, 'base_subscription', null);
    expect((await User.findById(a._id)).membership.earlyAccess).toBe(true);

    await site.setPrelaunch(false);                              // launched
    const b = await mkUser({ profile: { gender: 'male' } });
    await payment.activateTier(b._id, 'base_subscription', null);
    expect(!!(await User.findById(b._id)).membership.earlyAccess).toBe(false);
    await site.setPrelaunch(true);
  });
});

describe('purge test/demo accounts (safe)', () => {
  test('pre-launch only — refuses once launched', async () => {
    await site.setPrelaunch(false);
    const r = await request(app).post('/api/superadmin/purge-test-data').set(SK).send({ confirm: true });
    expect(r.status).toBe(409);
    await site.setPrelaunch(true);
  });

  test('keeps real-email + admin + early-access; deletes the rest; needs confirm', async () => {
    site._clearCacheForTests();                                   // pre-launch ON
    const real = await mkUser({ email: 'owner@gmail.com' });
    const admin = await mkUser({ role: 'admin', email: 'staff@ex.com' });   // admin kept despite test email
    const earlyMember = await mkUser({ membership: { earlyAccess: true, joinFeePaid: true } }); // real pre-launch member
    const test1 = await mkUser({ email: 'x@ex.com' });
    const test2 = await mkUser({});                               // phone-only OLD junk (no earlyAccess)

    const noConfirm = await request(app).post('/api/superadmin/purge-test-data').set(SK).send({});
    expect(noConfirm.status).toBe(400);
    expect(await User.countDocuments({})).toBe(5);

    const r = await request(app).post('/api/superadmin/purge-test-data').set(SK).send({ confirm: true });
    expect(r.status).toBe(200);
    expect(r.body.deleted).toBe(2);
    expect(r.body.kept).toBe(3);
    expect(await User.findById(real._id)).toBeTruthy();
    expect(await User.findById(admin._id)).toBeTruthy();
    expect(await User.findById(earlyMember._id)).toBeTruthy();    // real early-access member protected
    expect(await User.findById(test1._id)).toBeFalsy();
    expect(await User.findById(test2._id)).toBeFalsy();
  });

  test('requires the super-admin key', async () => {
    await mkUser({});
    const r = await request(app).post('/api/superadmin/purge-test-data').send({ confirm: true });
    expect(r.status).toBe(401);
  });
});
