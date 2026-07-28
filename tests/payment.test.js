// tests/payment.test.js — money invariants. This file is the reason CI can block
// a payment-fix revert. Every test asserts a property an attacker would exploit if
// it regressed, and every one is demonstrably capable of failing (see the
// "negative control" tests, which prove the harness itself detects escalation).
//
// Two invariants are load-bearing:
//   1. PRICE IS SERVER-SIDE — the amount is computed on the server from the stored
//      user, never taken from the request. Base is a single flat CHF 5 for everyone;
//      a caller must not be able to substitute a cheaper amount via the request body.
//   2. PURPOSE IS SERVER-SIDE — /verify reads what was bought from the order row
//      written at create-order time, never from req.body. The Razorpay signature
//      covers order_id|payment_id ONLY, so a body-trusted purpose lets someone pay
//      CHF 5 for base and claim max (CHF 25).

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
const commerce = require('../src/services/commerce-config');
afterEach(async () => { await db.clear(); jest.clearAllMocks(); commerce._resetCache(); });

const mkUser = async (gender = 'male', country = 'IN') => User.create({
  _id: TEST_USER_ID,
  phone: '+919000000001',
  profile: { firstName: 'T', gender, country, age: 30, city: 'Mumbai' }
});

// A signature Razorpay would produce for this order/payment pair.
const sign = (orderId, paymentId) => crypto
  .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
  .update(orderId + '|' + paymentId).digest('hex');

describe('INVARIANT 1 — the amount is computed server-side, never from the request', () => {
  test('base_subscription is a flat CHF 5 for a male member', async () => {
    await mkUser('male');
    const r = await request(app).post('/payment/create-order').send({ purpose: 'base_subscription' });
    expect(r.status).toBe(200);
    expect(r.body.amountCHF).toBe(5);
  });

  test('base_subscription is the same flat CHF 5 for a female member (no gender differential)', async () => {
    await mkUser('female');
    const r = await request(app).post('/payment/create-order').send({ purpose: 'base_subscription' });
    expect(r.body.amountCHF).toBe(5);
  });

  // The attack: a caller puts a cheaper amount in the body and hopes it is trusted.
  test('an amount in the REQUEST BODY is ignored — the server prices it', async () => {
    await mkUser('female');
    const r = await request(app).post('/payment/create-order')
      .send({ purpose: 'base_subscription', gender: 'male', amount: 1, amountCHF: 1 });
    expect(r.body.amountCHF).toBe(5);                       // not the 1 they sent
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
    expect(row.amountCHF).toBe(5);                           // they paid CHF 5 (base) and got CHF 5 of value
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
    expect((await Payment.findOne({ razorpayOrderId: orderId })).amountCHF).toBe(25);
  });
});

describe('annual billing — priced correctly and grants a full year', () => {
  test('base_annual is CHF 48', async () => {
    await mkUser('female');
    const r = await request(app).post('/payment/create-order').send({ purpose: 'base_annual' });
    expect(r.status).toBe(200);
    expect(r.body.amountCHF).toBe(48);
  });

  test('a verified pro_annual purchase grants pro for ~365 days', async () => {
    await mkUser('male');
    await request(app).post('/payment/create-order').send({ purpose: 'pro_annual' });
    const orderId = 'order_live_TEST123', paymentId = 'pay_live_annual';
    const r = await request(app).post('/payment/verify').send({
      razorpay_order_id: orderId, razorpay_payment_id: paymentId,
      razorpay_signature: sign(orderId, paymentId)
    });
    expect(r.body.purpose).toBe('pro_annual');
    const user = await User.findById(TEST_USER_ID);
    expect(user.membership.tier).toBe('pro');
    const days = (new Date(user.membership.tierExpiresAt).getTime() - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(360);
    expect(days).toBeLessThan(370);
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

describe('itemized checkout — base + tax + gateway fee is server-authoritative', () => {
  test('an India subscription breaks down GST 18% + 2.7% gateway fee and charges the total', async () => {
    await mkUser('female', 'IN');
    const r = await request(app).post('/payment/create-order').send({ purpose: 'base_subscription' });
    expect(r.status).toBe(200);
    expect(r.body.amountCHF).toBe(5);                 // canonical CHF base unchanged
    expect(r.body.currency).toBe('INR');
    const b = r.body.breakdown;
    expect(b.base).toBe(500);                          // CHF 5 × 100 (mocked fx)
    expect(b.taxName).toBe('GST');
    expect(b.taxRate).toBe(18);
    expect(b.taxTotal).toBe(90);                       // 18% of 500
    expect(b.gatewayFeePct).toBe(2.7);
    expect(b.gatewayFee).toBe(15.93);                  // 2.7% of 590
    expect(b.total).toBe(605.93);                      // 500 + 90 + 15.93
    expect(r.body.amount).toBe(60593);                 // the minor units actually charged
    // the breakdown is persisted, so /verify + refunds read it from the DB
    const row = await Payment.findOne({ razorpayOrderId: 'order_live_TEST123' });
    expect(row.amountCHF).toBe(5);
    expect(row.metadata.total).toBe(605.93);
    expect(row.metadata.taxRate).toBe(18);
    expect(row.metadata.country).toBe('IN');
  });

  test('a US subscription applies the gateway fee but 0 tax (state sales tax is operator-configured)', async () => {
    await mkUser('male', 'US');
    const r = await request(app).post('/payment/create-order').send({ purpose: 'base_subscription' });
    expect(r.body.currency).toBe('USD');
    expect(r.body.breakdown.taxRate).toBe(0);
    expect(r.body.breakdown.taxTotal).toBe(0);
    expect(r.body.breakdown.gatewayFee).toBe(13.5);    // 2.7% of 500
    expect(r.body.breakdown.total).toBe(513.5);
  });

  test('a zero-decimal currency (JPY) is NOT multiplied by 100 for the gateway', async () => {
    await commerce.updateCommerce({ countries: { JP: { currency: 'JPY', taxName: 'CT', categories: { subscription: 0, default: 0 } } } });
    await mkUser('male', 'JP');
    const r = await request(app).post('/payment/create-order').send({ purpose: 'base_subscription' });
    expect(r.body.currency).toBe('JPY');
    // base 500 (mock fx) + 0 tax + 2.7% fee = 513.5; JPY minor = round(513.5) = 514, NOT 51350
    expect(r.body.amount).toBe(Math.round(r.body.breakdown.total));
    expect(r.body.amount).toBeLessThan(1000);
  });

  test('GET /payment/quote returns the display breakdown without creating an order', async () => {
    await mkUser('male', 'IN');
    const r = await request(app).get('/payment/quote').query({ purpose: 'pro_subscription' });
    expect(r.status).toBe(200);
    expect(r.body.chf).toBe(12);
    expect(r.body.base).toBe(1200);
    expect(r.body.taxTotal).toBe(216);                 // 18% of 1200
    expect(r.body.gatewayFee).toBe(38.23);             // 2.7% of 1416
    expect(r.body.total).toBe(1454.23);
    expect(await Payment.countDocuments({})).toBe(0);  // quote must not create an order
  });
});

describe('cancellation — pro-rated within the window, refused after', () => {
  const DAY = 86400000;
  test('cancelling within the window refunds the unused fraction and frees the tier', async () => {
    await User.create({
      _id: TEST_USER_ID, phone: '+919000000009',
      profile: { firstName: 'T', gender: 'female', country: 'IN', age: 30, city: 'Mumbai' },
      membership: { tier: 'base', joinFeePaid: true, paidAt: new Date(), tierExpiresAt: new Date(Date.now() + 30 * DAY) },
    });
    await Payment.create({
      userId: TEST_USER_ID, purpose: 'base_subscription', amountCHF: 5, currency: 'INR',
      razorpayOrderId: 'order_live_TEST123', razorpayPaymentId: 'pay_live_cancel',
      status: 'captured', capturedAt: new Date(), metadata: { total: 605.93, amountLocal: 605.93 },
    });
    const r = await request(app).post('/payment/cancel-subscription').send({});
    expect(r.status).toBe(200);
    expect(r.body.refunded).toBe(true);
    expect(r.body.currency).toBe('INR');
    expect(r.body.fraction).toBeGreaterThan(0.99);       // ~all of the 30 days unused
    expect(r.body.refundAmount).toBeGreaterThan(600);    // ~605.93 × ~1
    const user = await User.findById(TEST_USER_ID);
    expect(user.membership.tier).toBe('free');
    expect(user.membership.tierExpiresAt == null).toBe(true);
    expect((await Payment.findOne({ razorpayPaymentId: 'pay_live_cancel' })).status).toBe('refunded');
  });

  test('a second cancel never double-refunds (payment refunded exactly once)', async () => {
    await User.create({
      _id: TEST_USER_ID, phone: '+919000000011',
      profile: { firstName: 'T', gender: 'female', country: 'IN', age: 30, city: 'Mumbai' },
      membership: { tier: 'base', joinFeePaid: true, paidAt: new Date(), tierExpiresAt: new Date(Date.now() + 30 * DAY) },
    });
    await Payment.create({
      userId: TEST_USER_ID, purpose: 'base_subscription', amountCHF: 5, currency: 'INR',
      razorpayOrderId: 'order_live_TEST200', razorpayPaymentId: 'pay_live_dc',
      status: 'captured', capturedAt: new Date(), metadata: { total: 605.93 },
    });
    const first = await request(app).post('/payment/cancel-subscription').send({});
    expect(first.status).toBe(200);
    const second = await request(app).post('/payment/cancel-subscription').send({});
    expect([400, 409]).toContain(second.status);         // refused, not a second refund
    // the payment is refunded exactly once (its terminal state is 'refunded', not re-refundable)
    expect((await Payment.findOne({ razorpayPaymentId: 'pay_live_dc' })).status).toBe('refunded');
    expect(await Payment.countDocuments({ userId: TEST_USER_ID, status: 'refunded' })).toBe(1);
  });

  test('cancelling after the 2-day window is refused; membership is untouched', async () => {
    await User.create({
      _id: TEST_USER_ID, phone: '+919000000010',
      profile: { firstName: 'T', gender: 'male', country: 'IN', age: 30, city: 'Mumbai' },
      membership: { tier: 'base', joinFeePaid: true, paidAt: new Date(Date.now() - 5 * DAY), tierExpiresAt: new Date(Date.now() + 25 * DAY) },
    });
    await Payment.create({
      userId: TEST_USER_ID, purpose: 'base_subscription', amountCHF: 5, currency: 'INR',
      razorpayOrderId: 'order_live_TEST124', razorpayPaymentId: 'pay_live_late',
      status: 'captured', capturedAt: new Date(Date.now() - 5 * DAY), metadata: { total: 605.93 },
    });
    const r = await request(app).post('/payment/cancel-subscription').send({});
    expect(r.status).toBe(403);
    const user = await User.findById(TEST_USER_ID);
    expect(user.membership.tier).toBe('base');
  });
});

describe('wallet — top-up credits on capture; pay-from-wallet debits base+tax and activates', () => {
  const walletSvc = require('../src/services/wallet');

  test('top-up charges amount + gateway fee; /verify credits the wallet the amount only', async () => {
    await mkUser('female', 'IN');
    const topup = await request(app).post('/payment/wallet/topup').send({ amount: 1000 });
    expect(topup.status).toBe(200);
    expect(topup.body.purpose).toBe('wallet_topup');
    expect(topup.body.topupAmount).toBe(1000);
    expect(topup.body.amountMajor).toBe(1027);             // 1000 + 2.7% gateway fee
    const orderId = 'order_live_TEST123', paymentId = 'pay_live_wt';
    const v = await request(app).post('/payment/verify').send({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sign(orderId, paymentId) });
    expect(v.body.purpose).toBe('wallet_topup');
    const w = await request(app).get('/payment/wallet');
    expect(w.body.currency).toBe('INR');
    expect(w.body.balance).toBe(1000);                     // credited the amount, NOT amount+fee
  });

  test('pay-from-wallet debits base+tax with NO gateway fee, and activates the tier', async () => {
    await mkUser('female', 'IN');
    await walletSvc.credit(TEST_USER_ID, 700, 'INR', { type: 'topup' });
    const r = await request(app).post('/payment/pay-wallet').send({ purpose: 'base_subscription' });
    expect(r.status).toBe(200);
    expect(r.body.paidFromWallet).toBe(true);
    expect(r.body.amount).toBe(590);                       // base 500 + GST 90, NO 2.7% fee
    expect(r.body.balance).toBe(110);                      // 700 - 590
    expect((await User.findById(TEST_USER_ID)).membership.tier).toBe('base');
  });

  test('pay-from-wallet with insufficient balance returns 402 and grants nothing', async () => {
    await mkUser('male', 'IN');
    await walletSvc.credit(TEST_USER_ID, 100, 'INR', { type: 'topup' });
    const r = await request(app).post('/payment/pay-wallet').send({ purpose: 'base_subscription' });
    expect(r.status).toBe(402);
    expect((await User.findById(TEST_USER_ID)).membership?.tier).not.toBe('base');
    expect((await walletSvc.getWallet(TEST_USER_ID)).balance).toBe(100);   // untouched
  });

  test('a duplicate pay-from-wallet is rejected — the wallet is debited only once', async () => {
    await mkUser('female', 'IN');
    await walletSvc.credit(TEST_USER_ID, 2000, 'INR', { type: 'topup' });
    const a = await request(app).post('/payment/pay-wallet').send({ purpose: 'base_subscription' });
    expect(a.status).toBe(200);
    const b = await request(app).post('/payment/pay-wallet').send({ purpose: 'base_subscription' });
    expect(b.status).toBe(409);                                            // duplicate rejected
    expect((await walletSvc.getWallet(TEST_USER_ID)).balance).toBe(1410);  // 2000 - 590, once
  });

  test('admin refund of a WALLET-PAID membership returns the money to the WALLET (never lost)', async () => {
    await mkUser('female', 'IN');
    await walletSvc.credit(TEST_USER_ID, 700, 'INR', { type: 'topup' });
    const pay = await request(app).post('/payment/pay-wallet').send({ purpose: 'base_subscription' });
    expect(pay.body.balance).toBe(110);
    const refund = await request(app).post(`/payment/admin/${pay.body.paymentId}/refund`).send({});
    expect(refund.status).toBe(200);
    expect(refund.body.destination).toBe('wallet');
    expect((await walletSvc.getWallet(TEST_USER_ID)).balance).toBe(700);   // 110 + 590 back to wallet
    expect((await User.findById(TEST_USER_ID)).membership.tier).toBe('free');
  });

  test('admin refund of a wallet TOP-UP claws the credited funds back out of the wallet', async () => {
    await mkUser('female', 'IN');
    await request(app).post('/payment/wallet/topup').send({ amount: 1000 });
    const orderId = 'order_live_TEST123', paymentId = 'pay_live_wt';
    await request(app).post('/payment/verify').send({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sign(orderId, paymentId) });
    expect((await walletSvc.getWallet(TEST_USER_ID)).balance).toBe(1000);
    const topupPay = await Payment.findOne({ userId: TEST_USER_ID, purpose: 'wallet_topup' });
    const refund = await request(app).post(`/payment/admin/${topupPay._id}/refund`).send({});
    expect(refund.status).toBe(200);
    expect((await walletSvc.getWallet(TEST_USER_ID)).balance).toBe(0);     // clawed back — no double money
  });

  test('pay-from-wallet with the SAME idempotency key debits once (retry-safe, no double buy)', async () => {
    await mkUser('female', 'IN');
    await walletSvc.credit(TEST_USER_ID, 2000, 'INR', { type: 'topup' });
    const key = 'idem-abc-123';
    const a = await request(app).post('/payment/pay-wallet').send({ purpose: 'base_subscription', idempotencyKey: key });
    expect(a.status).toBe(200);
    expect(a.body.duplicate).toBeFalsy();
    const b = await request(app).post('/payment/pay-wallet').send({ purpose: 'base_subscription', idempotencyKey: key });
    expect(b.status).toBe(200);
    expect(b.body.duplicate).toBe(true);                                    // deduped, not re-bought
    expect((await walletSvc.getWallet(TEST_USER_ID)).balance).toBe(1410);   // 2000 - 590, ONCE
  });

  test('admin refund of a top-up is REFUSED once the funds are spent (no double money)', async () => {
    await mkUser('female', 'IN');
    await request(app).post('/payment/wallet/topup').send({ amount: 700 });
    const orderId = 'order_live_TEST123', paymentId = 'pay_live_wt';
    await request(app).post('/payment/verify').send({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sign(orderId, paymentId) });
    await request(app).post('/payment/pay-wallet').send({ purpose: 'base_subscription' });   // spend 590 → 110 left
    const topupPay = await Payment.findOne({ userId: TEST_USER_ID, purpose: 'wallet_topup' });
    const refund = await request(app).post(`/payment/admin/${topupPay._id}/refund`).send({});
    expect(refund.status).toBe(409);                                        // can't claw back spent funds
    expect((await walletSvc.getWallet(TEST_USER_ID)).balance).toBe(110);    // untouched
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
    expect(r.body.base.yours).toBe(500);       // flat base — same for everyone
    expect(r.body.pro).toBe(1200);             // CHF 12 × 100
    expect(r.body.max).toBe(2500);             // CHF 25 × 100
    expect(r.body.annual.base).toBe(4800);     // CHF 48 × 100
    expect(r.body.annual.pro).toBe(12000);     // CHF 120 × 100
    expect(r.body.annual.max).toBe(24000);     // CHF 240 × 100
  });
});
