// tests/coupons.test.js — discount coupons: correct pre-tax math, atomic caps, and the
// free (100%-off) checkout path testers use. Every cap/idempotency test asserts a property
// an attacker or a double-click would exploit if it regressed.

const express = require('express');
const request = require('supertest');
const crypto = require('crypto');
const db = require('./helpers/pg-db');
const { ID: TEST_USER_ID } = require('./payment.helpers');

jest.mock('../src/routes-auth', () => ({
  requireAuth: (req, _res, next) => { req.userId = require('./payment.helpers').userId(); next(); },
  requireAdmin: (req, _res, next) => { req.userId = require('./payment.helpers').userId(); next(); },
}));
jest.mock('../src/services/fx', () => ({
  convertFromCHF: jest.fn(async (chf, to) => (to === 'CHF' ? chf : chf * 100)),   // CHF→INR ×100
  ratesFromCHF: jest.fn(async () => ({ INR: 100 })), FALLBACK: { INR: 100 },
}));
jest.mock('razorpay', () => jest.fn().mockImplementation(() => ({
  orders: { create: jest.fn(async () => ({ id: 'order_live_TEST123' })) },
  payments: { refund: jest.fn(async () => ({ id: 'rfnd_1' })) },
})));
process.env.RAZORPAY_KEY_ID = 'rzp_live_testkey';
process.env.RAZORPAY_KEY_SECRET = 'test_secret_for_hmac';
process.env.DEV_PAYMENTS = 'false';

const paymentRouter = require('../src/routes-payment');
const User = require('../src/models/User');
const Coupon = require('../src/models/Coupon');
const coupons = require('../src/services/coupons');

const app = express();
app.use(express.json());
app.use('/payment', paymentRouter);

beforeAll(db.start);
afterAll(db.stop);
const commerce = require('../src/services/commerce-config');
afterEach(async () => { await db.clear(); jest.clearAllMocks(); commerce._resetCache(); });

const mkUser = async (gender = 'female', country = 'IN') => User.create({
  _id: TEST_USER_ID, phone: '+919000000001',
  profile: { firstName: 'T', gender, country, age: 30, city: 'Mumbai' },
});
const otherUser = () => new (require('../src/db/odm').Types.ObjectId)();
const mkCoupon = (over = {}) => coupons.create({ code: 'TEST' + Math.random().toString(36).slice(2, 7), kind: 'percent', percentOff: 50, ...over }, TEST_USER_ID);

describe('discount math (pre-tax, CHF, capped at base)', () => {
  test('percent and flat discounts, never below zero', () => {
    expect(coupons.discountFor({ kind: 'percent', percentOff: 50 }, 5)).toBe(2.5);
    expect(coupons.discountFor({ kind: 'flat', flatOffCHF: 2 }, 5)).toBe(2);
    expect(coupons.discountFor({ kind: 'flat', flatOffCHF: 999 }, 5)).toBe(5);   // capped at base
    expect(coupons.discountFor({ kind: 'percent', percentOff: 100 }, 5)).toBe(5);
  });
});

describe('validate — rejects the invalid cases', () => {
  test('inactive / expired / not-applicable / below-min / exhausted / per-user', async () => {
    await mkUser();
    const base = 'base_subscription';
    const inactive = await mkCoupon({ active: false });
    await expect(coupons.validate(inactive.code, base, 5, TEST_USER_ID)).rejects.toThrow(/isn’t valid/);
    const expired = await mkCoupon({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    await expect(coupons.validate(expired.code, base, 5, TEST_USER_ID)).rejects.toThrow(/expired/);
    const scoped = await mkCoupon({ appliesTo: ['gift_pass'] });
    await expect(coupons.validate(scoped.code, base, 5, TEST_USER_ID)).rejects.toThrow(/doesn’t apply/);
    const minc = await mkCoupon({ minAmountCHF: 10 });
    await expect(coupons.validate(minc.code, base, 5, TEST_USER_ID)).rejects.toThrow(/minimum/);
    const empty = await mkCoupon({ maxRedemptions: 0 });
    await expect(coupons.validate(empty.code, base, 5, TEST_USER_ID)).rejects.toThrow(/fully redeemed/);
  });
});

describe('redeem — atomic caps + idempotency', () => {
  test('total cap: remaining decrements; a fresh order past the cap is refused', async () => {
    const c = await mkCoupon({ maxRedemptions: 1, perUserLimit: 5 });
    await coupons.redeem({ coupon: c, userId: TEST_USER_ID, orderRef: 'o1' });
    expect((await Coupon.findById(c._id)).remaining).toBe(0);
    const fresh = await Coupon.findById(c._id);
    await expect(coupons.redeem({ coupon: fresh, userId: otherUser(), orderRef: 'o2' })).rejects.toThrow(/fully redeemed/);
  });

  test('idempotent per order — a retried redemption does not double-consume', async () => {
    const c = await mkCoupon({ maxRedemptions: 5 });
    await coupons.redeem({ coupon: c, userId: TEST_USER_ID, orderRef: 'same' });
    await coupons.redeem({ coupon: await Coupon.findById(c._id), userId: TEST_USER_ID, orderRef: 'same' });
    expect((await Coupon.findById(c._id)).remaining).toBe(4);   // decremented ONCE
  });

  test('per-user limit of 1 blocks the same user on a second order', async () => {
    const c = await mkCoupon({ maxRedemptions: 10, perUserLimit: 1 });
    await coupons.redeem({ coupon: c, userId: TEST_USER_ID, orderRef: 'a' });
    await expect(coupons.redeem({ coupon: await Coupon.findById(c._id), userId: TEST_USER_ID, orderRef: 'b' }))
      .rejects.toThrow(/already used/);
    expect((await Coupon.findById(c._id)).remaining).toBe(9);   // the blocked attempt rolled back
  });

  test('a swept-then-late-captured reservation cannot push a user past perUserLimit', async () => {
    // The exploit: reserve o1, let the abandonment sweep release it, take the freed slot with o2, then
    // pay o1 LATE — the re-consume branch must re-check the per-user cap and REFUSE, not silently hand
    // the user a second active redemption of a one-per-customer coupon.
    const CouponRedemption = require('../src/models/CouponRedemption');
    const c = await mkCoupon({ maxRedemptions: 10, perUserLimit: 1 });
    await coupons.redeem({ coupon: c, userId: TEST_USER_ID, orderRef: 'o1', committed: false });      // reserved at create-order
    await coupons.release({ coupon: await Coupon.findById(c._id), orderRef: 'o1' });                   // sweep releases the abandoned reservation
    await coupons.redeem({ coupon: await Coupon.findById(c._id), userId: TEST_USER_ID, orderRef: 'o2' }); // a NEW order takes the freed slot (the user's ONE use)
    await coupons.redeem({ coupon: await Coupon.findById(c._id), userId: TEST_USER_ID, orderRef: 'o1', committed: false }); // o1 pays late → re-consume

    const active = (await CouponRedemption.find({ couponId: c._id, userId: TEST_USER_ID })).filter((/** @type {any} */ r) => !r.released);
    expect(active.length).toBe(1);                              // exactly ONE active redemption, never two
    expect(String(active[0].orderRef)).toBe('o2');             // the genuine one; the late o1 stays released
  });
});

describe('checkout integration', () => {
  test('preview applies the discount PRE-tax (GST on the reduced base)', async () => {
    await mkUser();
    const c = await mkCoupon({ code: 'HALF', percentOff: 50 });
    const r = await request(app).post('/payment/coupon/preview').send({ code: 'half', purpose: 'base_subscription' });
    expect(r.status).toBe(200);
    expect(r.body.discountLocal).toBe(250);              // 50% of INR 500 base
    expect(r.body.breakdown.base).toBe(250);             // taxable base is the DISCOUNTED base
    expect(r.body.breakdown.grossBase).toBe(500);
    expect(r.body.free).toBe(false);
    expect(r.body.amountMajor).toBeLessThan(590);        // less than the undiscounted 500+90 GST
  });

  test('a 100%-off coupon activates membership with NO gateway charge (the tester path)', async () => {
    await mkUser();
    const c = await mkCoupon({ code: 'TESTER100', kind: 'percent', percentOff: 100, maxRedemptions: 3, perUserLimit: 1 });
    const r = await request(app).post('/payment/create-order').send({ purpose: 'base_subscription', couponCode: 'tester100' });
    expect(r.status).toBe(200);
    expect(r.body.free).toBe(true);
    expect(r.body.activated).toBe(true);
    expect((await User.findById(TEST_USER_ID)).membership.tier).toBe('base');   // full access, no payment
    const after = await Coupon.findById(c._id);
    expect(after.remaining).toBe(2);                     // one redemption consumed
    expect(after.redeemedCount).toBe(1);
  });

  test('an exhausted coupon is refused at create-order (no activation)', async () => {
    await mkUser();
    await mkCoupon({ code: 'ONCE', percentOff: 100, maxRedemptions: 1 });
    await request(app).post('/payment/create-order').send({ purpose: 'base_subscription', couponCode: 'ONCE' });   // consumes it
    await db.clear();                                                     // wipe the user's redemption+membership, keep testing the cap
    // Re-create the (now-exhausted) coupon state by draining a fresh 0-remaining coupon:
    await mkUser();
    await mkCoupon({ code: 'DRAINED', percentOff: 50, maxRedemptions: 0 });
    const r = await request(app).post('/payment/create-order').send({ purpose: 'base_subscription', couponCode: 'DRAINED' });
    expect(r.status).toBe(400);
    expect(r.body.couponError).toBe('EXHAUSTED');
  });

  test('a bad coupon code fails create-order loudly (never charges full price silently)', async () => {
    await mkUser();
    const r = await request(app).post('/payment/create-order').send({ purpose: 'base_subscription', couponCode: 'NOPE' });
    expect(r.status).toBe(400);
    expect(r.body.couponError).toBe('INVALID');
  });

  test('a partial coupon flows through the gateway and is redeemed exactly once (create-order reserve, /verify confirm)', async () => {
    await mkUser();
    const c = await mkCoupon({ code: 'HALF2', percentOff: 50, maxRedemptions: 5 });
    const order = await request(app).post('/payment/create-order').send({ purpose: 'base_subscription', couponCode: 'HALF2' });
    expect(order.body.free).toBeFalsy();
    expect(order.body.couponCode).toBe('HALF2');
    expect((await Coupon.findById(c._id)).redeemedCount).toBe(1);   // RESERVED at create-order
    const oid = order.body.orderId, pid = 'pay_live_1';
    const sign = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(oid + '|' + pid).digest('hex');
    const v = await request(app).post('/payment/verify').send({ razorpay_order_id: oid, razorpay_payment_id: pid, razorpay_signature: sign });
    expect(v.body.ok).toBe(true);
    expect((await Coupon.findById(c._id)).redeemedCount).toBe(1);   // /verify is an idempotent confirm — NOT a second consume
  });

  const CouponRedemption = require('../src/models/CouponRedemption');
  const age = () => CouponRedemption.updateMany({}, { $set: { at: new Date(Date.now() - 3 * 3600 * 1000) } });

  test('an ABANDONED paid membership checkout is reclaimed by the sweep (committed:false + backfilled paymentId)', async () => {
    await mkUser();
    const c = await mkCoupon({ code: 'MEMAB', percentOff: 50, maxRedemptions: 5 });
    const order = await request(app).post('/payment/create-order').send({ purpose: 'base_subscription', couponCode: 'MEMAB' });
    expect(order.body.free).toBeFalsy();
    expect((await Coupon.findById(c._id)).remaining).toBe(4);        // reserved at create
    const row = await CouponRedemption.findOne({ orderRef: order.body.breakdown.couponOrderRef });
    expect(row.committed).toBe(false);                              // paid → sweepable
    expect(row.paymentId).toBeTruthy();                            // backfilled so the sweep can check status
    // Never verify (abandon) → the sweep reclaims the held slot.
    await age();
    const r = await coupons.releaseStaleReservations(new Date(), 120);
    expect(r.released).toBe(1);
    expect((await Coupon.findById(c._id)).remaining).toBe(5);
  });

  test('a VERIFIED paid membership commits the reservation, so the sweep never touches it', async () => {
    await mkUser();
    const c = await mkCoupon({ code: 'MEMOK', percentOff: 50, maxRedemptions: 5 });
    const order = await request(app).post('/payment/create-order').send({ purpose: 'base_subscription', couponCode: 'MEMOK' });
    const oid = order.body.orderId, pid = 'pay_live_ok';
    const sign = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(oid + '|' + pid).digest('hex');
    await request(app).post('/payment/verify').send({ razorpay_order_id: oid, razorpay_payment_id: pid, razorpay_signature: sign });
    await age();
    const r = await coupons.releaseStaleReservations(new Date(), 120);
    expect(r.released).toBe(0);                                     // committed at /verify → excluded
    expect((await Coupon.findById(c._id)).remaining).toBe(4);       // real use retained
  });

  test('a free (100%-off) membership grant is committed:true and never swept', async () => {
    await mkUser();
    const c = await mkCoupon({ code: 'MEMFREE', kind: 'percent', percentOff: 100, maxRedemptions: 3, perUserLimit: 1 });
    const r0 = await request(app).post('/payment/create-order').send({ purpose: 'base_subscription', couponCode: 'MEMFREE' });
    expect(r0.body.free).toBe(true);
    expect((await Coupon.findById(c._id)).remaining).toBe(2);
    await age();
    const r = await coupons.releaseStaleReservations(new Date(), 120);
    expect(r.released).toBe(0);                                     // committed:true → excluded
    expect((await Coupon.findById(c._id)).remaining).toBe(2);       // free grant retained
  });

  test('cancelling a coupon membership releases the coupon on refund', async () => {
    await mkUser();
    const c = await mkCoupon({ code: 'MEMREF', percentOff: 50, maxRedemptions: 5 });
    const order = await request(app).post('/payment/create-order').send({ purpose: 'base_subscription', couponCode: 'MEMREF' });
    const oid = order.body.orderId, pid = 'pay_live_ref';
    const sign = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(oid + '|' + pid).digest('hex');
    await request(app).post('/payment/verify').send({ razorpay_order_id: oid, razorpay_payment_id: pid, razorpay_signature: sign });
    expect((await Coupon.findById(c._id)).remaining).toBe(4);       // committed use
    const cancel = await request(app).post('/payment/cancel-subscription').send({});
    expect(cancel.status).toBe(200);
    expect((await Coupon.findById(c._id)).remaining).toBe(5);       // released on refund
  });

  test('an ADMIN refund of a coupon membership also releases the coupon', async () => {
    const Payment = require('../src/models/Payment');
    await mkUser();
    const c = await mkCoupon({ code: 'ADMREF', percentOff: 50, maxRedemptions: 5 });
    const order = await request(app).post('/payment/create-order').send({ purpose: 'base_subscription', couponCode: 'ADMREF' });
    const oid = order.body.orderId, pid = 'pay_live_adm';
    const sign = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(oid + '|' + pid).digest('hex');
    await request(app).post('/payment/verify').send({ razorpay_order_id: oid, razorpay_payment_id: pid, razorpay_signature: sign });
    const payment = await Payment.findOne({ razorpayOrderId: oid });
    expect((await Coupon.findById(c._id)).remaining).toBe(4);
    const refund = await request(app).post(`/payment/admin/${payment._id}/refund`).send({});
    expect(refund.status).toBe(200);
    expect((await Coupon.findById(c._id)).remaining).toBe(5);       // released on admin refund too
  });
});

describe('review fixes — cap reserved up front, per-user race-safe, numeric guards', () => {
  test('the PAID path RESERVES the cap at create-order — a second checkout past the cap is refused (not deferred to /verify)', async () => {
    await mkUser();
    await mkCoupon({ code: 'CAP1', percentOff: 50, maxRedemptions: 1 });
    const a = await request(app).post('/payment/create-order').send({ purpose: 'base_subscription', couponCode: 'CAP1' });
    expect(a.status).toBe(200);                                     // reserved
    const b = await request(app).post('/payment/create-order').send({ purpose: 'base_subscription', couponCode: 'CAP1' });
    expect([400, 409]).toContain(b.status);                         // cap enforced BEFORE the discounted charge
    expect(b.body.couponError).toBe('EXHAUSTED');
  });

  test('perUserLimit > 1 is enforced by slot keys; a free coupon cannot be re-redeemed by the same user', async () => {
    const c = await mkCoupon({ maxRedemptions: 20, perUserLimit: 2 });
    await coupons.redeem({ coupon: c, userId: TEST_USER_ID, orderRef: 'x1' });
    await coupons.redeem({ coupon: await Coupon.findById(c._id), userId: TEST_USER_ID, orderRef: 'x2' });
    await expect(coupons.redeem({ coupon: await Coupon.findById(c._id), userId: TEST_USER_ID, orderRef: 'x3' }))
      .rejects.toThrow(/already used/);                             // 3rd blocked at limit 2

    await mkUser();
    await mkCoupon({ code: 'FREE1', percentOff: 100, perUserLimit: 1, maxRedemptions: 10 });
    const f1 = await request(app).post('/payment/create-order').send({ purpose: 'base_subscription', couponCode: 'FREE1' });
    expect(f1.body.free).toBe(true);
    const f2 = await request(app).post('/payment/create-order').send({ purpose: 'base_subscription', couponCode: 'FREE1' });
    expect([400, 409]).toContain(f2.status);                       // second free activation refused
    expect(f2.body.couponError).toBe('PER_USER');
  });

  test('update() moves remaining by the DELTA — concurrent-safe, never clobbered', async () => {
    const c = await mkCoupon({ maxRedemptions: 100 });
    await coupons.redeem({ coupon: c, userId: otherUser(), orderRef: 'r1' });
    await coupons.redeem({ coupon: await Coupon.findById(c._id), userId: otherUser(), orderRef: 'r2' });
    expect((await Coupon.findById(c._id)).remaining).toBe(98);
    await coupons.update(c._id, { maxRedemptions: 200 });          // +100 delta
    expect((await Coupon.findById(c._id)).remaining).toBe(198);    // 98 + 100 (NOT 200 − stale)
    expect((await Coupon.findById(c._id)).maxRedemptions).toBe(200);
  });

  test('a non-numeric cap is REJECTED, not silently made unlimited', async () => {
    await expect(mkCoupon({ maxRedemptions: '20 seats' })).rejects.toThrow(/must be a number/);
  });
});

describe('release + stale-reservation reclaim (abandoned-checkout safety)', () => {
  const Payment = require('../src/models/Payment');
  const CouponRedemption = require('../src/models/CouponRedemption');
  const oid = () => new (require('../src/db/odm').Types.ObjectId)();

  test('release() gives the cap slot back exactly once (idempotent, no double-restore)', async () => {
    const c = await mkCoupon({ code: 'REL', percentOff: 50, maxRedemptions: 5, perUserLimit: 5 });
    await coupons.redeem({ coupon: c, userId: TEST_USER_ID, orderRef: 'r1', paymentId: oid() });
    expect((await Coupon.findById(c._id)).remaining).toBe(4);
    expect(await coupons.release({ coupon: await Coupon.findById(c._id), orderRef: 'r1' })).toBe(true);
    expect((await Coupon.findById(c._id)).remaining).toBe(5);              // restored
    expect((await Coupon.findById(c._id)).redeemedCount).toBe(0);
    // A second release is a no-op — the counter can never be inflated past its cap.
    expect(await coupons.release({ coupon: await Coupon.findById(c._id), orderRef: 'r1' })).toBe(false);
    expect((await Coupon.findById(c._id)).remaining).toBe(5);
  });

  test('releaseStaleReservations reclaims an abandoned (uncommitted, aged) reservation but leaves a committed one', async () => {
    const c = await mkCoupon({ code: 'SWEEP', percentOff: 50, maxRedemptions: 5, perUserLimit: 5 });
    const u2 = oid();
    // Abandoned: reserved at create (committed:false), payment never captured.
    const payA = await Payment.create({ userId: TEST_USER_ID, purpose: 'marketplace_order', amountCHF: 5, currency: 'INR', razorpayOrderId: 'oA', status: 'created', createdAt: new Date() });
    await coupons.redeem({ coupon: c, userId: TEST_USER_ID, orderRef: 'oA', paymentId: payA._id, committed: false });
    // Real use: reserved then CAPTURED → committed (out of the sweep's scope entirely).
    const payB = await Payment.create({ userId: u2, purpose: 'marketplace_order', amountCHF: 5, currency: 'INR', razorpayOrderId: 'oB', status: 'captured', createdAt: new Date() });
    await coupons.redeem({ coupon: await Coupon.findById(c._id), userId: u2, orderRef: 'oB', paymentId: payB._id, committed: false });
    await coupons.commitReservation({ coupon: await Coupon.findById(c._id), orderRef: 'oB' });
    expect((await Coupon.findById(c._id)).remaining).toBe(3);              // both reserved
    await CouponRedemption.updateMany({}, { $set: { at: new Date(Date.now() - 3 * 3600 * 1000) } });   // age both
    const r = await coupons.releaseStaleReservations(new Date(), 120);
    expect(r.released).toBe(1);                                            // only the abandoned (uncommitted) one
    expect((await Coupon.findById(c._id)).remaining).toBe(4);              // A returned, B (committed) kept
  });

  test('a committed (captured) reservation never enters the sweep candidate set — no starvation as volume grows', async () => {
    const c = await mkCoupon({ code: 'CMT', percentOff: 50, maxRedemptions: 5, perUserLimit: 5 });
    const pay = await Payment.create({ userId: TEST_USER_ID, purpose: 'marketplace_order', amountCHF: 5, currency: 'INR', razorpayOrderId: 'oC', status: 'captured', createdAt: new Date() });
    await coupons.redeem({ coupon: c, userId: TEST_USER_ID, orderRef: 'oC', paymentId: pay._id, committed: false });
    await coupons.commitReservation({ coupon: await Coupon.findById(c._id), orderRef: 'oC' });
    await CouponRedemption.updateMany({}, { $set: { at: new Date(Date.now() - 3 * 3600 * 1000) } });   // aged, but committed
    const r = await coupons.releaseStaleReservations(new Date(), 120);
    expect(r.released).toBe(0);
    expect((await Coupon.findById(c._id)).remaining).toBe(4);              // real use retained
  });

  test('an uncommitted reservation still inside the checkout window is NOT swept', async () => {
    const c = await mkCoupon({ code: 'FRESH', percentOff: 50, maxRedemptions: 5 });
    const pay = await Payment.create({ userId: TEST_USER_ID, purpose: 'marketplace_order', amountCHF: 5, currency: 'INR', razorpayOrderId: 'oF', status: 'created', createdAt: new Date() });
    await coupons.redeem({ coupon: c, userId: TEST_USER_ID, orderRef: 'oF', paymentId: pay._id, committed: false });
    const r = await coupons.releaseStaleReservations(new Date(), 120);     // reservation is brand-new
    expect(r.released).toBe(0);
    expect((await Coupon.findById(c._id)).remaining).toBe(4);
  });

  test('a LATE capture on an already-swept reservation RE-CONSUMES the slot — never over-issues past the cap', async () => {
    const c = await mkCoupon({ code: 'LATE', percentOff: 50, maxRedemptions: 1, perUserLimit: 5 });
    const pay = await Payment.create({ userId: TEST_USER_ID, purpose: 'marketplace_order', amountCHF: 5, currency: 'INR', razorpayOrderId: 'oL', status: 'created', createdAt: new Date() });
    await coupons.redeem({ coupon: c, userId: TEST_USER_ID, orderRef: 'oL', paymentId: pay._id, committed: false });
    expect((await Coupon.findById(c._id)).remaining).toBe(0);              // last unit reserved
    await CouponRedemption.updateMany({}, { $set: { at: new Date(Date.now() - 3 * 3600 * 1000) } });
    expect((await coupons.releaseStaleReservations(new Date(), 120)).released).toBe(1);
    expect((await Coupon.findById(c._id)).remaining).toBe(1);              // slot returned by the sweep
    // Payment captures LATE (async UPI/webhook). redeemOrderCoupon → redeem() on the SAME ref must
    // re-consume the slot, not hand out a discount past the cap.
    await coupons.redeem({ coupon: await Coupon.findById(c._id), userId: TEST_USER_ID, orderRef: 'oL', paymentId: pay._id });
    expect((await Coupon.findById(c._id)).remaining).toBe(0);              // re-consumed — cap respected
    const row = await CouponRedemption.findOne({ redemptionKey: String(c._id) + ':oL' });
    expect(row.released).toBe(false);
    expect(row.committed).toBe(true);
  });

  test('an abandoned checkout does NOT lock a user out of a one-time (perUserLimit) coupon', async () => {
    const c = await mkCoupon({ code: 'ONCE1', percentOff: 50, maxRedemptions: 5, perUserLimit: 1 });
    const pay = await Payment.create({ userId: TEST_USER_ID, purpose: 'marketplace_order', amountCHF: 5, currency: 'INR', razorpayOrderId: 'oX', status: 'created', createdAt: new Date() });
    await coupons.redeem({ coupon: c, userId: TEST_USER_ID, orderRef: 'oX', paymentId: pay._id, committed: false });
    // With an ACTIVE reservation, a second attempt is correctly PER_USER-blocked.
    await expect(coupons.validate('ONCE1', 'marketplace_order', 5, TEST_USER_ID)).rejects.toThrow(/already used/);
    // Abandon → sweep releases the slot.
    await CouponRedemption.updateMany({}, { $set: { at: new Date(Date.now() - 3 * 3600 * 1000) } });
    await coupons.releaseStaleReservations(new Date(), 120);
    // The user is NO LONGER locked out — validate passes and a fresh redemption succeeds (no slot collision).
    const v = await coupons.validate('ONCE1', 'marketplace_order', 5, TEST_USER_ID);
    expect(v.coupon).toBeTruthy();
    const again = await coupons.redeem({ coupon: await Coupon.findById(c._id), userId: TEST_USER_ID, orderRef: 'oY', paymentId: oid(), committed: false });
    expect(again._id).toBeTruthy();
    expect((await Coupon.findById(c._id)).remaining).toBe(4);
  });

  test('re-consume past a re-filled cap keeps lockstep (remaining/redeemedCount), so a later refund reverses cleanly — no over-issue', async () => {
    const c = await mkCoupon({ code: 'DRIFT', percentOff: 50, maxRedemptions: 1, perUserLimit: 5 });
    const payA = await Payment.create({ userId: TEST_USER_ID, purpose: 'marketplace_order', amountCHF: 5, currency: 'INR', razorpayOrderId: 'dA', status: 'created', createdAt: new Date() });
    await coupons.redeem({ coupon: c, userId: TEST_USER_ID, orderRef: 'dA', paymentId: payA._id, committed: false });   // remaining 1→0, count 1
    await CouponRedemption.updateMany({ orderRef: 'dA' }, { $set: { at: new Date(Date.now() - 3 * 3600 * 1000) } });
    await coupons.releaseStaleReservations(new Date(), 120);                                                            // release A: remaining 0→1, count 1→0
    const u2 = oid();
    const payB = await Payment.create({ userId: u2, purpose: 'marketplace_order', amountCHF: 5, currency: 'INR', razorpayOrderId: 'dB', status: 'captured', createdAt: new Date() });
    await coupons.redeem({ coupon: await Coupon.findById(c._id), userId: u2, orderRef: 'dB', paymentId: payB._id, committed: false });   // B takes freed slot: remaining 1→0, count 0→1
    await coupons.commitReservation({ coupon: await Coupon.findById(c._id), orderRef: 'dB' });
    expect((await Coupon.findById(c._id)).redeemedCount).toBe(1);
    // A's payment captures LATE → re-consume. The cap is full, so remaining goes NEGATIVE (honest
    // over-subscription) while the redemption is counted — remaining + redeemedCount stays == maxRedemptions.
    await coupons.redeem({ coupon: await Coupon.findById(c._id), userId: TEST_USER_ID, orderRef: 'dA', paymentId: payA._id });
    const mid = await Coupon.findById(c._id);
    expect(mid.remaining).toBe(-1);             // over-subscribed, not floored (keeps lockstep)
    expect(mid.redeemedCount).toBe(2);          // both real redemptions counted
    // A is later refunded → release reverses A cleanly: remaining −1→0, count 2→1. B still holds the
    // one real use, so remaining stays 0 → a third buyer is EXHAUSTED (no over-issue past the cap).
    await coupons.release({ coupon: mid, orderRef: 'dA' });
    const after = await Coupon.findById(c._id);
    expect(after.remaining).toBe(0);
    expect(after.redeemedCount).toBe(1);
    await expect(coupons.validate('DRIFT', 'marketplace_order', 5, oid())).rejects.toThrow(/fully redeemed/);
  });

  test('a refund whose immediate release is lost is still reclaimed by the sweep (markSweepable backstop)', async () => {
    const c = await mkCoupon({ code: 'RFND', percentOff: 50, maxRedemptions: 5, perUserLimit: 5 });
    const pay = await Payment.create({ userId: TEST_USER_ID, purpose: 'marketplace_order', amountCHF: 5, currency: 'INR', razorpayOrderId: 'rR', status: 'captured', createdAt: new Date() });
    await coupons.redeem({ coupon: c, userId: TEST_USER_ID, orderRef: 'rR', paymentId: pay._id, committed: false });
    await coupons.commitReservation({ coupon: await Coupon.findById(c._id), orderRef: 'rR' });   // captured → committed (out of sweep scope)
    expect((await Coupon.findById(c._id)).remaining).toBe(4);
    // Order refunded: payment→refunded + markSweepable ran, but the immediate release was LOST (simulated).
    await Payment.findByIdAndUpdate(pay._id, { status: 'refunded' });
    await coupons.markSweepable('rR');
    await CouponRedemption.updateMany({}, { $set: { at: new Date(Date.now() - 3 * 3600 * 1000) } });
    const r = await coupons.releaseStaleReservations(new Date(), 120);
    expect(r.released).toBe(1);                                   // the sweep genuinely backstops the refund now
    expect((await Coupon.findById(c._id)).remaining).toBe(5);
  });

  test('releasing a MIDDLE reservation of a multi-use (perUserLimit>1) coupon frees its slot for reuse — no false PER_USER', async () => {
    const c = await mkCoupon({ code: 'MULTI', percentOff: 50, maxRedemptions: 10, perUserLimit: 2 });
    const u = String(TEST_USER_ID);
    const rA = await coupons.redeem({ coupon: c, userId: TEST_USER_ID, orderRef: 'mA', paymentId: oid(), committed: false });
    const rB = await coupons.redeem({ coupon: await Coupon.findById(c._id), userId: TEST_USER_ID, orderRef: 'mB', paymentId: oid(), committed: false });
    expect(rA.userLimitKey).toBe(`${c._id}:${u}:0`);
    expect(rB.userLimitKey).toBe(`${c._id}:${u}:1`);
    // At the per-user limit, a third is blocked.
    await expect(coupons.redeem({ coupon: await Coupon.findById(c._id), userId: TEST_USER_ID, orderRef: 'mC', paymentId: oid(), committed: false })).rejects.toThrow(/already used/);
    // Release the MIDDLE reservation (slot 0), then a new redemption reuses slot 0 rather than
    // colliding with the still-active slot 1.
    await coupons.release({ coupon: await Coupon.findById(c._id), orderRef: 'mA' });
    const rC = await coupons.redeem({ coupon: await Coupon.findById(c._id), userId: TEST_USER_ID, orderRef: 'mC2', paymentId: oid(), committed: false });
    expect(rC.userLimitKey).toBe(`${c._id}:${u}:0`);           // freed slot reused, not a collision
  });

  test('a cancelled/refunded FREE grant (no paymentId) is reclaimed by the sweep once markSweepable runs', async () => {
    const c = await mkCoupon({ code: 'FREE0', percentOff: 100, maxRedemptions: 3, perUserLimit: 5 });
    // A free grant reserves with NO paymentId + committed:true (the createQuotedOrder free branch).
    await coupons.redeem({ coupon: c, userId: TEST_USER_ID, orderRef: 'fr1', purpose: 'marketplace_order' });
    expect((await Coupon.findById(c._id)).remaining).toBe(2);
    // Its order is refunded: markSweepable returns it to scope, but the immediate release is lost.
    await coupons.markSweepable('fr1');
    await CouponRedemption.updateMany({}, { $set: { at: new Date(Date.now() - 3 * 3600 * 1000) } });
    const r = await coupons.releaseStaleReservations(new Date(), 120);
    expect(r.released).toBe(1);                                  // no-paymentId row IS reclaimed now
    expect((await Coupon.findById(c._id)).remaining).toBe(3);
  });

  test('a guarded (sweep) release refuses a reservation that committed under it — no over-issue off a stale snapshot', async () => {
    const c = await mkCoupon({ code: 'RACE', percentOff: 50, maxRedemptions: 5, perUserLimit: 5 });
    const pay = await Payment.create({ userId: TEST_USER_ID, purpose: 'marketplace_order', amountCHF: 5, currency: 'INR', razorpayOrderId: 'rc', status: 'created', createdAt: new Date() });
    await coupons.redeem({ coupon: c, userId: TEST_USER_ID, orderRef: 'rc', paymentId: pay._id, committed: false });
    // The payment captured + committed AFTER the sweep would have snapshotted it as 'created'.
    await coupons.commitReservation({ coupon: await Coupon.findById(c._id), orderRef: 'rc' });
    const did = await coupons.release({ coupon: await Coupon.findById(c._id), orderRef: 'rc', onlyIfUncommitted: true });
    expect(did).toBe(false);                                    // guarded release refuses the committed row
    expect((await Coupon.findById(c._id)).remaining).toBe(4);   // real captured use NOT wrongly reclaimed
  });

  test('reconcileStrandedOrders releases the coupon a late capture re-consumed on a dead order', async () => {
    const market = require('../src/services/marketplace');
    const Order = require('../src/models/Order');
    const Partner = require('../src/models/Partner'), Listing = require('../src/models/Listing');
    const c = await mkCoupon({ code: 'STRND', percentOff: 50, maxRedemptions: 5, perUserLimit: 5 });
    // The captured payment carries the coupon refs; the reservation is in the re-consumed state
    // (active + committed) a late capture would leave after the order was already cancelled.
    const pay = await Payment.create({ userId: TEST_USER_ID, purpose: 'marketplace_order', amountCHF: 5, currency: 'INR', razorpayOrderId: 'st1', status: 'captured', createdAt: new Date(), metadata: { couponCode: 'STRND', couponOrderRef: 'st1' } });
    await coupons.redeem({ coupon: c, userId: TEST_USER_ID, orderRef: 'st1', paymentId: pay._id, committed: true });
    expect((await Coupon.findById(c._id)).remaining).toBe(4);
    // Real listing/partner so the order satisfies the DB foreign keys (a real order always has them).
    const p = await Partner.create({ name: 'P', category: 'gift', active: true });
    const listing = await Listing.create({ partnerId: p._id, category: 'gift', title: 'T', kind: 'product', priceCHF: 5, active: true });
    await Order.create({ userId: TEST_USER_ID, listingId: listing._id, partnerId: p._id, amountCHF: 5, status: 'cancelled', paymentId: pay._id });   // dead order, stranded capture
    const r = await market.reconcileStrandedOrders();
    expect(r.reclaimed).toBe(1);
    expect((await Payment.findById(pay._id)).status).toBe('refunded');
    expect((await Coupon.findById(c._id)).remaining).toBe(5);   // the re-consumed slot is given back, not leaked
  });

  test('the sweep self-heals a captured reservation whose commit was lost (committed:false + captured)', async () => {
    const c = await mkCoupon({ code: 'HEAL', percentOff: 50, maxRedemptions: 5, perUserLimit: 5 });
    const pay = await Payment.create({ userId: TEST_USER_ID, purpose: 'marketplace_order', amountCHF: 5, currency: 'INR', razorpayOrderId: 'hl', status: 'captured', createdAt: new Date() });
    await coupons.redeem({ coupon: c, userId: TEST_USER_ID, orderRef: 'hl', paymentId: pay._id, committed: false });   // commit "lost" → stays committed:false
    await CouponRedemption.updateMany({}, { $set: { at: new Date(Date.now() - 3 * 3600 * 1000) } });
    const r = await coupons.releaseStaleReservations(new Date(), 120);
    expect(r.released).toBe(0);                                  // captured → never released
    expect((await Coupon.findById(c._id)).remaining).toBe(4);    // slot retained
    expect((await CouponRedemption.findOne({ redemptionKey: String(c._id) + ':hl' })).committed).toBe(true);   // healed out of the candidate set
  });

  test('sweep self-heals a NO-paymentId row whose payment (found by couponOrderRef) captured — never released', async () => {
    const c = await mkCoupon({ code: 'NOBACK', percentOff: 50, maxRedemptions: 5, perUserLimit: 5 });
    // Lost backfill: reservation committed:false with NO paymentId, but a CAPTURED payment carrying
    // its couponOrderRef exists (the /verify capture happened, commit + backfill both lost).
    const pay = await Payment.create({ userId: TEST_USER_ID, purpose: 'base_subscription', amountCHF: 5, currency: 'INR', razorpayOrderId: 'nb', status: 'captured', createdAt: new Date(), metadata: { couponCode: 'NOBACK', couponOrderRef: 'nb' } });
    expect(pay._id).toBeTruthy();
    await coupons.redeem({ coupon: c, userId: TEST_USER_ID, orderRef: 'nb', committed: false });   // no paymentId
    await CouponRedemption.updateMany({}, { $set: { at: new Date(Date.now() - 3 * 3600 * 1000) } });
    const r = await coupons.releaseStaleReservations(new Date(), 120);
    expect(r.released).toBe(0);                                  // captured (found via couponOrderRef) → NOT released
    expect((await Coupon.findById(c._id)).remaining).toBe(4);    // real use retained
    expect((await CouponRedemption.findOne({ redemptionKey: String(c._id) + ':nb' })).committed).toBe(true);   // self-healed
  });

  test('capture→commit gap: commitReservation RE-CONSUMES a slot the racing sweep released — no over-issue past the cap', async () => {
    const c = await mkCoupon({ code: 'GAP', percentOff: 50, maxRedemptions: 1, perUserLimit: 5 });
    const pay = await Payment.create({ userId: TEST_USER_ID, purpose: 'marketplace_order', amountCHF: 5, currency: 'INR', razorpayOrderId: 'gp', status: 'created', createdAt: new Date(), metadata: { couponCode: 'GAP', couponOrderRef: 'gp' } });
    await coupons.redeem({ coupon: c, userId: TEST_USER_ID, orderRef: 'gp', paymentId: pay._id, committed: false });   // reserve at create
    expect((await Coupon.findById(c._id)).remaining).toBe(0);
    // Interleaving D<R<C: (D) redeem at capture read released:false and returned WITHOUT committing;
    // (R) the sweep releases off a stale 'created' snapshot (its CAS guards committed:false, still true):
    expect(await coupons.release({ coupon: await Coupon.findById(c._id), orderRef: 'gp', onlyIfUncommitted: true })).toBe(true);
    expect((await Coupon.findById(c._id)).remaining).toBe(1);   // slot handed back by the racing sweep
    // (C) /verify's commitReservation runs on the genuinely-CAPTURED payment → must re-consume, not leak.
    await Payment.findByIdAndUpdate(pay._id, { status: 'captured' });   // the capture that preceded this commit
    await coupons.commitReservation({ coupon: await Coupon.findById(c._id), orderRef: 'gp' });
    const after = await Coupon.findById(c._id);
    expect(after.remaining).toBe(0);                            // slot reclaimed — cap honored, no over-issue
    const row = await CouponRedemption.findOne({ redemptionKey: String(c._id) + ':gp' });
    expect(row.committed).toBe(true);
    expect(row.released).toBe(false);
    await expect(coupons.validate('GAP', 'marketplace_order', 5, oid())).rejects.toThrow(/fully redeemed/);   // the 1 real use holds
  });

  test('a REFUND-released row is NOT re-consumed by a racing commitReservation (payment is refunded, not captured)', async () => {
    const c = await mkCoupon({ code: 'RFRACE', percentOff: 50, maxRedemptions: 5, perUserLimit: 5 });
    const pay = await Payment.create({ userId: TEST_USER_ID, purpose: 'base_subscription', amountCHF: 5, currency: 'INR', razorpayOrderId: 'rf', status: 'captured', createdAt: new Date(), metadata: { couponCode: 'RFRACE', couponOrderRef: 'rf' } });
    await coupons.redeem({ coupon: c, userId: TEST_USER_ID, orderRef: 'rf', paymentId: pay._id, committed: false });
    await coupons.commitReservation({ coupon: await Coupon.findById(c._id), orderRef: 'rf' });   // committed at capture
    expect((await Coupon.findById(c._id)).remaining).toBe(4);
    // Refund: payment→refunded, then release correctly returns the slot.
    await Payment.findByIdAndUpdate(pay._id, { status: 'refunded' });
    await coupons.markSweepable('rf');
    await coupons.release({ coupon: await Coupon.findById(c._id), orderRef: 'rf' });
    expect((await Coupon.findById(c._id)).remaining).toBe(5);       // returned by the refund
    // A duplicate/racing commitReservation (e.g. sweep self-heal off a stale 'captured' snapshot)
    // must NOT reclaim the slot — the payment is now refunded, not a live capture.
    await coupons.commitReservation({ coupon: await Coupon.findById(c._id), orderRef: 'rf' });
    expect((await Coupon.findById(c._id)).remaining).toBe(5);       // NOT re-consumed — no slot leak
  });
});
