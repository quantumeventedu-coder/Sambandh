// tests/gift-pass.test.js — the Sambandh Gift Pass system.
// Covers purchase → activate → one-time redeem → membership grant, plus the
// money/fraud guards: no redeem before payment, no double-redeem, expiry, revoke+refund.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('./helpers/pg-db');            // must precede model/route requires

const { errorHandler } = require('../src/lib/errors');
const User = require('../src/models/User');
const GiftPass = require('../src/models/GiftPass');
const Payment = require('../src/models/Payment');

const app = express();
app.use(express.json());
app.use('/api/gift-passes', require('../src/routes-gift-passes'));
app.use('/api/payment', require('../src/routes-payment'));
app.use(errorHandler());

let seq = 8600000000;
const mkUser = () => User.create({ phone: '+91' + (seq++) });
const auth = (u) => ({ Authorization: 'Bearer ' + jwt.sign({ userId: String(u._id), phone: u.phone, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '30d' }) });

async function purchase(buyer, passType = 'premium_1m') {
  const r = await request(app).post('/api/gift-passes/purchase').set(auth(buyer)).send({ passType });
  return r.body; // { pass:{id,code,...}, order:{orderId}, payment }
}
async function activate(buyer, bought) {
  await request(app).post('/api/payment/verify').set(auth(buyer)).send({ razorpay_order_id: bought.order.orderId });
  return (await request(app).post(`/api/gift-passes/${bought.pass.id}/confirm-payment`).set(auth(buyer))).body.pass;
}

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('catalogue + purchase', () => {
  test('catalogue lists passes; purchase pins the amount and mints a code', async () => {
    const buyer = await mkUser();
    const cat = await request(app).get('/api/gift-passes/catalog').set(auth(buyer));
    expect(cat.body.passes.some((p) => p.id === 'premium_1m' && p.priceCHF === 15)).toBe(true);
    const bought = await purchase(buyer, 'premium_1m');
    expect(bought.pass.amountCHF).toBe(15);
    expect(bought.pass.code).toMatch(/^SB-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(bought.pass.status).toBe('created');   // not redeemable until paid
  });

  test('purchase returns a PAYABLE order (regression: no more "complete payment" dead-end)', async () => {
    const buyer = await mkUser();
    const bought = await purchase(buyer, 'premium_1m');
    const order = bought.order;
    // The client needs all of this to open the gateway; without it the flow dead-ended.
    expect(order.orderId).toBeTruthy();
    expect(order.amount).toBeGreaterThan(0);            // minor units actually charged
    expect(order.currency).toBeTruthy();                // buyer's local currency, not raw CHF
    expect(order.amountCHF).toBe(15);                   // CHF base still pinned for confirm
    // Charged like every other order: base + tax + gateway fee, itemised.
    expect(order.breakdown).toBeTruthy();
    expect(order.breakdown.taxTotal).toBeGreaterThanOrEqual(0);
    expect(order.breakdown.gatewayFee).toBeGreaterThanOrEqual(0);
    expect(order.breakdown.total).toBeCloseTo(order.amountMajor, 5);
  });
});

describe('redeem lifecycle', () => {
  test('activate → recipient redeems → membership granted, one-time only', async () => {
    const buyer = await mkUser(), recipient = await mkUser();
    const bought = await purchase(buyer, 'premium_1m');
    const pass = await activate(buyer, bought);
    expect(pass.status).toBe('active');

    const red = await request(app).post('/api/gift-passes/redeem').set(auth(recipient)).send({ code: pass.code });
    expect(red.body.ok).toBe(true);
    const u = await User.findById(recipient._id);
    expect(u.membership.tier).toBe('max');                                   // real entitlement granted
    expect(new Date(u.membership.tierExpiresAt).getTime()).toBeGreaterThan(Date.now() + 25 * 86400000);

    // one-time: a second redeem (by anyone) fails
    const again = await request(app).post('/api/gift-passes/redeem').set(auth(await mkUser())).send({ code: pass.code });
    expect(again.status).toBe(409);
    expect((await GiftPass.findById(pass.id)).status).toBe('redeemed');
  });

  test('a code cannot be redeemed before the purchase is paid', async () => {
    const buyer = await mkUser(), recipient = await mkUser();
    const bought = await purchase(buyer, 'chat_pass');                        // NOT activated
    const r = await request(app).post('/api/gift-passes/redeem').set(auth(recipient)).send({ code: bought.pass.code });
    expect(r.status).toBe(409);
  });

  test('an invalid code is rejected', async () => {
    const u = await mkUser();
    expect((await request(app).post('/api/gift-passes/redeem').set(auth(u)).send({ code: 'SB-ZZZZ-ZZZZ-ZZZZ' })).status).toBe(404);
  });

  test('an expired pass cannot be redeemed', async () => {
    const buyer = await mkUser(), recipient = await mkUser();
    const bought = await purchase(buyer, 'premium_1m');
    const pass = await activate(buyer, bought);
    await GiftPass.findByIdAndUpdate(pass.id, { expiresAt: new Date(Date.now() - 1000) });
    expect((await request(app).post('/api/gift-passes/redeem').set(auth(recipient)).send({ code: pass.code })).status).toBe(409);
  });
});

describe('revoke + refund', () => {
  test('an unredeemed active pass can be revoked and the buyer refunded', async () => {
    const buyer = await mkUser();
    const bought = await purchase(buyer, 'premium_1m');
    const pass = await activate(buyer, bought);
    expect((await Payment.findById(bought.payment.id)).status).toBe('captured');
    const rev = await request(app).post(`/api/gift-passes/${pass.id}/revoke`).set(auth(buyer));
    expect(rev.body.pass.status).toBe('revoked');
    expect((await Payment.findById(bought.payment.id)).status).toBe('refunded');
  });

  test('a redeemed pass cannot be revoked', async () => {
    const buyer = await mkUser(), recipient = await mkUser();
    const pass = await activate(buyer, await purchase(buyer, 'premium_1m'));
    await request(app).post('/api/gift-passes/redeem').set(auth(recipient)).send({ code: pass.code });
    expect((await request(app).post(`/api/gift-passes/${pass.id}/revoke`).set(auth(buyer))).status).toBe(409);
  });
});

describe('security-review fixes', () => {
  const gp = require('../src/services/gift-pass');

  test('a refunded pass is revoked and cannot be redeemed', async () => {
    const buyer = await mkUser(), recipient = await mkUser();
    const bought = await purchase(buyer, 'premium_1m');
    const pass = await activate(buyer, bought);
    await Payment.findByIdAndUpdate(bought.payment.id, { status: 'refunded' });
    await gp.handlePaymentRefund(await Payment.findById(bought.payment.id));   // reconcile
    expect((await GiftPass.findById(pass.id)).status).toBe('revoked');
    expect((await request(app).post('/api/gift-passes/redeem').set(auth(recipient)).send({ code: pass.code })).status).toBe(409);
  });

  test("confirm-payment on someone else's pass returns 404 (no existence leak)", async () => {
    const buyer = await mkUser(), other = await mkUser();
    const bought = await purchase(buyer, 'premium_1m');
    expect((await request(app).post(`/api/gift-passes/${bought.pass.id}/confirm-payment`).set(auth(other))).status).toBe(404);
  });

  test('a 1-year pass grants a real calendar year (not 360 days)', async () => {
    const buyer = await mkUser(), recipient = await mkUser();
    const pass = await activate(buyer, await purchase(buyer, 'premium_1y'));
    await request(app).post('/api/gift-passes/redeem').set(auth(recipient)).send({ code: pass.code });
    const u = await User.findById(recipient._id);
    expect(new Date(u.membership.tierExpiresAt).getTime()).toBeGreaterThan(Date.now() + 360 * 86400000);
  });

  test('two premium months stack — a grant never shortens the entitlement', async () => {
    const buyer = await mkUser(), recipient = await mkUser();
    const p1 = await activate(buyer, await purchase(buyer, 'premium_1m'));
    await request(app).post('/api/gift-passes/redeem').set(auth(recipient)).send({ code: p1.code });
    const after1 = new Date((await User.findById(recipient._id)).membership.tierExpiresAt).getTime();
    const p2 = await activate(buyer, await purchase(buyer, 'premium_1m'));
    await request(app).post('/api/gift-passes/redeem').set(auth(recipient)).send({ code: p2.code });
    const after2 = new Date((await User.findById(recipient._id)).membership.tierExpiresAt).getTime();
    expect(after2).toBeGreaterThan(after1 + 25 * 86400000);   // stacked another month
  });
});

describe('wallet', () => {
  test('the wallet shows purchased and received passes', async () => {
    const buyer = await mkUser(), recipient = await mkUser();
    const pass = await activate(buyer, await purchase(buyer, 'premium_1m'));
    await request(app).post('/api/gift-passes/redeem').set(auth(recipient)).send({ code: pass.code });
    const buyerWallet = await request(app).get('/api/gift-passes/wallet').set(auth(buyer));
    expect(buyerWallet.body.purchased.some((p) => p.id === pass.id && p.code)).toBe(true);   // buyer sees the code
    const recipWallet = await request(app).get('/api/gift-passes/wallet').set(auth(recipient));
    expect(recipWallet.body.received.some((p) => p.id === pass.id)).toBe(true);
    expect(recipWallet.body.received[0].code).toBeUndefined();                                 // recipient never sees the code
  });
});
