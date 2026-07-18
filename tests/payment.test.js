// tests/payment.test.js — money invariants. This file is the reason CI can block
// a payment-fix revert. Every test asserts a property an attacker would exploit if
// it regressed, and every one is demonstrably capable of failing (see the
// "negative control" tests, which prove the harness itself detects escalation).
//
// Two invariants are load-bearing:
//   1. PRICE IS SERVER-SIDE — gender comes from the DB, never the request. Female
//      pays CHF 5, male CHF 1; a caller must not be able to claim a cheaper gender.
//   2. PURPOSE IS SERVER-SIDE — /verify reads what was bought from the order row
//      written at create-order time, never from req.body. The Razorpay signature
//      covers order_id|payment_id ONLY, so a body-trusted purpose lets someone pay
//      CHF 1 for base and claim max (CHF 15).

const express = require('express');
const request = require('supertest');
const crypto = require('crypto');
// Real Postgres via pg-odm + pglite. Must precede the routes-payment/model requires.
const db = require('./helpers/pg-db');

// Must be the SAME id the auth mock injects, or every lookup silently misses.
const { ID: TEST_USER_ID } = require('./payment.helpers');

// Auth is not under test here — inject the user id directly.
jest.mock('../src/routes-auth', () => ({
  requireAuth: (req, _res, next) => { req.userId = require('./payment.helpers').userId(); next(); },
  requireAdmin: (req, _res, next) => { req.userId = require('./payment.helpers').userId(); next(); }
}));

// FX must never hit the network in tests. CHF→INR fixed at 100 for arithmetic we
// can assert exactly.
jest.mock('../src/services/fx', () => ({
  convertFromCHF: jest.fn(async (chf, to) => (to === 'CHF' ? chf : chf * 100)),
  ratesFromCHF: jest.fn(async () => ({ INR: 100 })),
  FALLBACK: { INR: 100 }
}));

// Razorpay must never hit the network. orders.create returns a deterministic id.
// (Inlined: a jest.mock factory is hoisted and may not close over outer variables.)
jest.mock('razorpay', () => jest.fn().mockImplementation(() => ({
  orders: { create: jest.fn(async () => ({ id: 'order_live_TEST123' })) },
  payments: { refund: jest.fn(async () => ({ id: 'rfnd_1' })) }
})));

// Force the LIVE payment path (not the dev simulator) — this is what production runs.
process.env.RAZORPAY_KEY_ID = 'rzp_live_testkey';
process.env.RAZORPAY_KEY_SECRET = 'test_secret_for_hmac';
process.env.DEV_PAYMENTS = 'false';

const paymentRouter = require('../src/routes-payment');
const User = require('../src/models/User');
const Payment = require('../src/models/Payment');

const app = express();
// The webhook is mounted with a RAW body in server.js (the signature is computed
// over the exact bytes Razorpay sent), so mirror that here or the HMAC is wrong.
app.use('/payment/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use('/payment', paymentRouter);

beforeAll(db.start);
afterAll(db.stop);
afterEach(async () => { await db.clear(); jest.clearAllMocks(); });

const mkUser = async (gender = 'male', country = 'IN') => User.create({
  _id: TEST_USER_ID,
  phone: '+919000000001',
  profile: { firstName: 'T', gender, country, age: 30, city: 'Mumbai' }
});

// A signature Razorpay would produce for this order/payment pair.
const sign = (orderId, paymentId) => crypto
  .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
  .update(orderId + '|' + paymentId).digest('hex');

describe('INVARIANT 1 — price is computed server-side from the stored gender', () => {
  test('male base_subscription is CHF 1', async () => {
    await mkUser('male');
    const r = await request(app).post('/payment/create-order').send({ purpose: 'base_subscription' });
    expect(r.status).toBe(200);
    expect(r.body.amountCHF).toBe(1);
  });

  test('female base_subscription is CHF 5', async () => {
    await mkUser('female');
    const r = await request(app).post('/payment/create-order').send({ purpose: 'base_subscription' });
    expect(r.body.amountCHF).toBe(5);
  });

  // The attack: a female user claims to be male to pay CHF 1 instead of CHF 5.
  test('a gender in the REQUEST BODY is ignored — DB gender wins', async () => {
    await mkUser('female');
    const r = await request(app).post('/payment/create-order')
      .send({ purpose: 'base_subscription', gender: 'male', amount: 1, amountCHF: 1 });
    expect(r.body.amountCHF).toBe(5);                       // not 1
    const row = await Payment.findOne({ razorpayOrderId: 'order_live_TEST123' });
    expect(row.amountCHF).toBe(5);
    expect(row.metadata.gender).toBe('female');
  });

  test('unknown purpose is rejected, not priced at zero', async () => {
    await mkUser('male');
    const r = await request(app).post('/payment/create-order').send({ purpose: 'free_stuff_please' });
    expect(r.status).toBe(400);
    expect(await Payment.countDocuments({})).toBe(0);
  });
});

describe('INVARIANT 2 — /verify takes the purpose from the ORDER, never the request', () => {
  // Buy the cheapest thing, then try to claim the most expensive at verify time.
  test('paying for base_subscription and claiming max_subscription grants only BASE', async () => {
    await mkUser('male');
    await request(app).post('/payment/create-order').send({ purpose: 'base_subscription' });

    const orderId = 'order_live_TEST123', paymentId = 'pay_live_1';
    const r = await request(app).post('/payment/verify').send({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: sign(orderId, paymentId),
      purpose: 'max_subscription'                            // ← the attack
    });

    expect(r.status).toBe(200);
    expect(r.body.purpose).toBe('base_subscription');        // server's answer, not the client's
    const user = await User.findById(TEST_USER_ID);
    expect(user.membership.tier).toBe('base');               // NOT 'max'
    const row = await Payment.findOne({ razorpayOrderId: orderId });
    expect(row.amountCHF).toBe(1);                           // they paid CHF 1 and got CHF 1 of value
    expect(row.purpose).toBe('base_subscription');
  });

  test('verify with no matching order is refused (nothing to authorise against)', async () => {
    await mkUser('male');
    const orderId = 'order_live_NEVER_CREATED', paymentId = 'pay_x';
    const r = await request(app).post('/payment/verify').send({
      razorpay_order_id: orderId, razorpay_payment_id: paymentId,
      razorpay_signature: sign(orderId, paymentId), purpose: 'max_subscription'
    });
    expect(r.status).toBe(404);
    const user = await User.findById(TEST_USER_ID);
    expect(user.membership?.tier).not.toBe('max');
  });

  test('a legitimate max_subscription purchase does grant max (guard is not just "always base")', async () => {
    // Negative control: proves the test above fails for the right reason.
    await mkUser('male');
    await request(app).post('/payment/create-order').send({ purpose: 'max_subscription' });
    const orderId = 'order_live_TEST123', paymentId = 'pay_live_2';
    const r = await request(app).post('/payment/verify').send({
      razorpay_order_id: orderId, razorpay_payment_id: paymentId,
      razorpay_signature: sign(orderId, paymentId)
    });
    expect(r.body.purpose).toBe('max_subscription');
    const user = await User.findById(TEST_USER_ID);
    expect(user.membership.tier).toBe('max');
    expect((await Payment.findOne({ razorpayOrderId: orderId })).amountCHF).toBe(15);
  });
});

describe('signature verification', () => {
  test('an invalid signature is rejected and captures nothing', async () => {
    await mkUser('male');
    await request(app).post('/payment/create-order').send({ purpose: 'base_subscription' });
    const r = await request(app).post('/payment/verify').send({
      razorpay_order_id: 'order_live_TEST123',
      razorpay_payment_id: 'pay_live_3',
      razorpay_signature: 'deadbeef-not-a-real-signature'
    });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/signature/i);
    const row = await Payment.findOne({ razorpayOrderId: 'order_live_TEST123' });
    expect(row.status).toBe('created');                      // never captured
    const user = await User.findById(TEST_USER_ID);
    expect(user.membership?.joinFeePaid).toBeFalsy();
  });

  test('missing payment fields are rejected', async () => {
    await mkUser('male');
    const r = await request(app).post('/payment/verify').send({ razorpay_order_id: 'order_live_TEST123' });
    expect(r.status).toBe(400);
  });
});

describe('idempotency — a replayed verify never double-grants', () => {
  test('verifying twice captures once', async () => {
    await mkUser('male');
    await request(app).post('/payment/create-order').send({ purpose: 'base_subscription' });
    const orderId = 'order_live_TEST123', paymentId = 'pay_live_4';
    const body = {
      razorpay_order_id: orderId, razorpay_payment_id: paymentId,
      razorpay_signature: sign(orderId, paymentId)
    };
    const first = await request(app).post('/payment/verify').send(body);
    const second = await request(app).post('/payment/verify').send(body);
    expect(first.body.ok).toBe(true);
    expect(second.body.ok).toBe(true);
    expect(second.body.alreadyProcessed).toBe(true);
    expect(await Payment.countDocuments({ razorpayOrderId: orderId })).toBe(1);
  });
});

describe('webhook — only Razorpay may call it', () => {
  // Send a raw STRING, not a Buffer: supertest re-serializes a Buffer body, so the
  // bytes signed would not be the bytes sent and every signature would mismatch.
  const body = () => JSON.stringify({ event: 'payment.captured' });
  const hookSign = (raw) => crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '')
    .update(raw).digest('hex');

  beforeAll(() => { process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret'; });

  test('a correctly-signed webhook is accepted', async () => {
    const b = body();
    const r = await request(app).post('/payment/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', hookSign(b))
      .send(b);
    expect(r.status).toBe(200);
  });

  test('an unsigned webhook is rejected', async () => {
    const b = body();
    const r = await request(app).post('/payment/webhook')
      .set('Content-Type', 'application/json')
      .send(b);
    expect(r.status).toBe(400);
  });

  test('a wrongly-signed webhook is rejected (anyone could POST this URL)', async () => {
    const b = body();
    const r = await request(app).post('/payment/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'deadbeef')
      .send(b);
    expect(r.status).toBe(400);
  });

  // Fail closed: with no configured secret there is no way to authenticate the
  // caller, so we must refuse rather than hash against `undefined`.
  test('with no webhook secret configured, nothing is accepted', async () => {
    const saved = process.env.RAZORPAY_WEBHOOK_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    try {
      const b = body();
      const r = await request(app).post('/payment/webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', 'anything')
        .send(b);
      expect(r.status).toBeGreaterThanOrEqual(400);   // refused, never 200
    } finally { process.env.RAZORPAY_WEBHOOK_SECRET = saved; }
  });
});

describe('pricing endpoint', () => {
  test('quotes live-converted local currency for an Indian user', async () => {
    await mkUser('female', 'IN');
    const r = await request(app).get('/payment/pricing');
    expect(r.status).toBe(200);
    expect(r.body.currency).toBe('INR');
    expect(r.body.symbol).toBe('₹');
    expect(r.body.base.female).toBe(500);      // CHF 5 × 100
    expect(r.body.base.yours).toBe(500);       // matches their stored gender
    expect(r.body.max).toBe(1500);             // CHF 15 × 100
  });
});
