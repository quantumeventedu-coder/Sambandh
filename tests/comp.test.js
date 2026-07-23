// tests/comp.test.js — the comp (join-fee waiver) allowlist used to give payment
// reviewers / internal testers free access. Must ONLY comp explicitly-listed emails.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const db = require('./helpers/pg-db');            // must precede model/route requires
const User = require('../src/models/User');
const comp = require('../src/services/comp');

beforeAll(db.start);
afterAll(db.stop);
afterEach(async () => { await db.clear(); delete process.env.COMP_MEMBER_EMAILS; });

describe('comp allowlist', () => {
  test('isComped matches ONLY listed emails (case-insensitive), never by pattern', () => {
    process.env.COMP_MEMBER_EMAILS = 'razorpay-review@sambandh.online, tester@x.com';
    expect(comp.isComped('razorpay-review@sambandh.online')).toBe(true);
    expect(comp.isComped('RAZORPAY-REVIEW@sambandh.online')).toBe(true);
    expect(comp.isComped('someone@else.com')).toBe(false);
    expect(comp.isComped('review@sambandh.online')).toBe(false);   // not a substring match
    expect(comp.isComped('')).toBe(false);
    expect(comp.isComped(null)).toBe(false);
  });

  test('applyComp waives the join fee for a listed user and is idempotent', async () => {
    process.env.COMP_MEMBER_EMAILS = 'rev@sambandh.online';
    const u = await User.create({ email: 'rev@sambandh.online', membership: { joinFeePaid: false, tier: 'free' } });
    await comp.applyComp(u);
    const after = await User.findById(u._id);
    expect(after.membership.joinFeePaid).toBe(true);
    expect(after.membership.tier).toBe('base');
    expect(u.membership.joinFeePaid).toBe(true);          // mutated in place for the response
    await comp.applyComp(after);                          // idempotent
    expect((await User.findById(u._id)).membership.joinFeePaid).toBe(true);
  });

  test('applyComp leaves a non-listed user untouched (no free memberships by accident)', async () => {
    process.env.COMP_MEMBER_EMAILS = 'rev@sambandh.online';
    const u = await User.create({ email: 'normal@x.com', membership: { joinFeePaid: false, tier: 'free' } });
    await comp.applyComp(u);
    const after = await User.findById(u._id);
    expect(after.membership.joinFeePaid).toBeFalsy();
    expect(after.membership.tier).toBe('free');
  });

  test('with no allowlist set, nobody is comped', async () => {
    const u = await User.create({ email: 'rev@sambandh.online', membership: { joinFeePaid: false, tier: 'free' } });
    await comp.applyComp(u);
    expect((await User.findById(u._id)).membership.joinFeePaid).toBeFalsy();
  });
});
