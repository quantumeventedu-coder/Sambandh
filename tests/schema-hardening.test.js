// tests/schema-hardening.test.js — proves the invariants are enforced by the DATABASE, not just by
// app code. Each case writes THROUGH the real models and asserts Postgres itself rejects bad/orphan
// data (so a future code path that forgets a check still cannot corrupt the store).

const db = require('./helpers/pg-db');            // must precede model requires (sets the pg engine + hardens)
const User = require('../src/models/User');
const Payment = require('../src/models/Payment');
const Partner = require('../src/models/Partner');
const Listing = require('../src/models/Listing');
const Order = require('../src/models/Order');
const Coupon = require('../src/models/Coupon');
const { Types } = require('../src/db/odm');

const oid = () => new Types.ObjectId();
let seq = 9100000000;
const mkUser = () => User.create({ phone: '+91' + (seq++) });
const mkPartnerListing = async () => {
  const p = await Partner.create({ name: 'P', category: 'gift', active: true });
  const l = await Listing.create({ partnerId: p._id, category: 'gift', title: 'T', kind: 'product', priceCHF: 10, active: true });
  return { p, l };
};

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('DB-enforced schema (schema-hardening)', () => {
  test('ENUM: the database rejects an out-of-set Payment.status / purpose', async () => {
    const u = await mkUser();
    await expect(Payment.create({ userId: u._id, purpose: 'base_subscription', status: 'BOGUS' })).rejects.toThrow();
    await expect(Payment.create({ userId: u._id, purpose: 'NOT_A_PURPOSE', status: 'created' })).rejects.toThrow();
    const ok = await Payment.create({ userId: u._id, purpose: 'base_subscription', status: 'captured', amountCHF: 5 });
    expect(ok._id).toBeTruthy();                                   // a valid one is accepted
  });

  test('FOREIGN KEY: the database rejects an Order that references a ghost listing/partner', async () => {
    const u = await mkUser();
    const { p, l } = await mkPartnerListing();
    await expect(Order.create({ userId: u._id, listingId: oid(), partnerId: p._id, amountCHF: 10 })).rejects.toThrow();
    await expect(Order.create({ userId: u._id, listingId: l._id, partnerId: oid(), amountCHF: 10 })).rejects.toThrow();
    const ok = await Order.create({ userId: u._id, listingId: l._id, partnerId: p._id, amountCHF: 10 });
    expect(ok._id).toBeTruthy();                                   // real refs accepted
  });

  test('FOREIGN KEY: a CouponRedemption cannot reference a ghost coupon', async () => {
    const CouponRedemption = require('../src/models/CouponRedemption');
    const u = await mkUser();
    await expect(CouponRedemption.create({ couponId: oid(), userId: u._id, code: 'X', redemptionKey: 'k1' })).rejects.toThrow();
  });

  test('MONEY: the database rejects a negative Order / Payment amount', async () => {
    const u = await mkUser();
    const { p, l } = await mkPartnerListing();
    await expect(Order.create({ userId: u._id, listingId: l._id, partnerId: p._id, amountCHF: -1 })).rejects.toThrow();
    await expect(Payment.create({ userId: u._id, purpose: 'base_subscription', amountCHF: -5 })).rejects.toThrow();
  });

  test('RANGE: the database rejects a coupon percentOff outside 0..100', async () => {
    await expect(Coupon.create({ code: 'BADPCT', kind: 'percent', percentOff: 150, active: true, redeemedCount: 0 })).rejects.toThrow();
    const ok = await Coupon.create({ code: 'GOODPCT', kind: 'percent', percentOff: 50, active: true, redeemedCount: 0 });
    expect(ok._id).toBeTruthy();
  });

  test('hardenSchema is idempotent + version-gated (second run is a fast no-op)', async () => {
    const { hardenSchema } = require('../src/db/schema-hardening');
    const again = await hardenSchema({ silent: true });
    expect(again.upToDate).toBe(true);                            // marker short-circuits repeat work
  });
});
