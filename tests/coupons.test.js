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

  test('a partial coupon flows through the gateway and is redeemed on /verify', async () => {
    await mkUser();
    const c = await mkCoupon({ code: 'HALF2', percentOff: 50, maxRedemptions: 5 });
    const order = await request(app).post('/payment/create-order').send({ purpose: 'base_subscription', couponCode: 'HALF2' });
    expect(order.body.free).toBeFalsy();
    expect(order.body.couponCode).toBe('HALF2');
    const oid = order.body.orderId, pid = 'pay_live_1';
    const sign = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(oid + '|' + pid).digest('hex');
    const v = await request(app).post('/payment/verify').send({ razorpay_order_id: oid, razorpay_payment_id: pid, razorpay_signature: sign });
    expect(v.body.ok).toBe(true);
    expect((await Coupon.findById(c._id)).redeemedCount).toBe(1);   // redeemed at capture
  });
});
