// tests/payment-tier.test.js — activateTier must never DOWNGRADE an active higher
// tier or SHORTEN paid time. The old logic overwrote tier+expiry on any tier change,
// so buying base while an active max ran silently destroyed the remaining max.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const db = require('./helpers/pg-db');            // must precede model/route requires
jest.mock('../src/services/analytics', () => ({ track: jest.fn() }));

const { activateTier } = require('../src/routes-payment');
const User = require('../src/models/User');

const DAY = 86400000;
let seq = 7100000000;
const mkUser = (membership) => User.create({ phone: '+91' + (seq++), membership });
const pay = { _id: 'pay-test', amountCHF: 1 };
const endMs = (u) => new Date(u.membership.tierExpiresAt).getTime();

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('activateTier never downgrades or shortens', () => {
  test('buying BASE while an active MAX runs keeps MAX and extends (no downgrade, no lost time)', async () => {
    const u = await mkUser({ tier: 'max', joinFeePaid: true, tierExpiresAt: new Date(Date.now() + 25 * DAY) });
    await activateTier(u._id, 'base_subscription', pay);
    const after = await User.findById(u._id);
    expect(after.membership.tier).toBe('max');                       // NOT downgraded to base
    expect(endMs(after)).toBeGreaterThan(Date.now() + 54 * DAY);     // 25 remaining + 30 stacked
  });

  test('buying the SAME tier stacks onto the current expiry', async () => {
    const u = await mkUser({ tier: 'base', joinFeePaid: true, tierExpiresAt: new Date(Date.now() + 10 * DAY) });
    await activateTier(u._id, 'base_subscription', pay);
    const after = await User.findById(u._id);
    expect(after.membership.tier).toBe('base');
    expect(endMs(after)).toBeGreaterThan(Date.now() + 39 * DAY);     // 10 + 30
  });

  test('UPGRADING base → pro switches tier and never ends before the old entitlement', async () => {
    const u = await mkUser({ tier: 'base', joinFeePaid: true, tierExpiresAt: new Date(Date.now() + 100 * DAY) });
    await activateTier(u._id, 'pro_subscription', pay);
    const after = await User.findById(u._id);
    expect(after.membership.tier).toBe('pro');                       // upgraded
    expect(endMs(after)).toBeGreaterThan(Date.now() + 99 * DAY);     // max(now+30, now+100) → not shortened
  });

  test('a fresh member (no active tier) gets 30 days from now', async () => {
    const u = await mkUser({ tier: 'free', joinFeePaid: false });
    await activateTier(u._id, 'base_subscription', pay);
    const after = await User.findById(u._id);
    expect(after.membership.tier).toBe('base');
    expect(endMs(after)).toBeGreaterThan(Date.now() + 29 * DAY);
    expect(endMs(after)).toBeLessThan(Date.now() + 31 * DAY);
  });
});
