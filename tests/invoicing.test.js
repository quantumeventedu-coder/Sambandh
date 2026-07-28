// tests/invoicing.test.js — tax invoices / receipts: atomic numbering, idempotent
// assignment, and a faithful breakdown (matches exactly what was charged).

const express = require('express');
const request = require('supertest');
const db = require('./helpers/pg-db');
const { ID: TEST_USER_ID } = require('./payment.helpers');

jest.mock('../src/routes-auth', () => ({
  requireAuth: (req, _res, next) => { req.userId = require('./payment.helpers').userId(); next(); },
  requireAdmin: (req, _res, next) => { req.userId = require('./payment.helpers').userId(); next(); },
}));
jest.mock('../src/services/fx', () => ({ convertFromCHF: jest.fn(async (c, t) => (t === 'CHF' ? c : c * 100)), ratesFromCHF: jest.fn(async () => ({ INR: 100 })), FALLBACK: { INR: 100 } }));
jest.mock('razorpay', () => jest.fn().mockImplementation(() => ({ orders: { create: jest.fn(async () => ({ id: 'order_live_TEST123' })) }, payments: { refund: jest.fn(async () => ({ id: 'r' })) } })));
process.env.RAZORPAY_KEY_ID = 'rzp_live_testkey';
process.env.RAZORPAY_KEY_SECRET = 'test_secret_for_hmac';
process.env.DEV_PAYMENTS = 'false';

const paymentRouter = require('../src/routes-payment');
const User = require('../src/models/User');
const Payment = require('../src/models/Payment');
const invoicing = require('../src/services/invoicing');

const app = express();
app.use(express.json());
app.use('/payment', paymentRouter);

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

const mkUser = () => User.create({ _id: TEST_USER_ID, phone: '+919000000001', profile: { firstName: 'Aarav', gender: 'female', country: 'IN', city: 'Mumbai' } });
const otherId = () => new (require('../src/db/odm').Types.ObjectId)();
const capturedSub = (over = {}) => Payment.create({
  userId: TEST_USER_ID, purpose: 'base_subscription', amountCHF: 5, currency: 'INR', status: 'captured',
  method: 'card', capturedAt: new Date(), createdAt: new Date(),
  metadata: { grossBase: 500, discountLocal: 0, base: 500, taxName: 'GST', taxRate: 18, taxTotal: 90, gatewayFee: 15.93, total: 605.93, symbol: '₹' },
  ...over,
});

describe('financial-year + atomic invoice numbering', () => {
  test('fyLabel runs April→March', () => {
    expect(invoicing.fyLabel('2026-07-01')).toBe('2026-27');
    expect(invoicing.fyLabel('2026-03-31')).toBe('2025-26');
  });
  test('numbers are sequential and never duplicate', async () => {
    const a = await invoicing.nextInvoiceNo('SB', '2026-07-01');
    const b = await invoicing.nextInvoiceNo('SB', '2026-07-01');
    expect(a).toBe('SB/2026-27/00001');
    expect(b).toBe('SB/2026-27/00002');
  });
});

describe('assignInvoice — once, idempotently', () => {
  test('a payment keeps ONE number across repeat views', async () => {
    const p = await capturedSub();
    const n1 = await invoicing.assignInvoice(p);
    const p2 = await Payment.findById(p._id);
    const n2 = await invoicing.assignInvoice(p2);
    expect(n2).toBe(n1);                                   // same number, not a second one
    expect((await Payment.findById(p._id)).invoiceNo).toBe(n1);
  });
});

describe('buildReceipt — faithful to the charged breakdown', () => {
  test('an India subscription splits into IGST by default and totals correctly', async () => {
    const p = await capturedSub(); await invoicing.assignInvoice(p);
    const r = invoicing.buildReceipt(await Payment.findById(p._id), { profile: { firstName: 'Aarav', country: 'IN' } }, await invoicing.getBusiness());
    expect(r.kind).toBe('Tax Invoice');
    expect(r.items[0].taxableValue).toBe(500);
    expect(r.taxTotal).toBe(90);
    expect(r.taxLines).toHaveLength(1);
    expect(r.taxLines[0].label).toMatch(/IGST @ 18%/);
    expect(r.gatewayFee).toBe(15.93);
    expect(r.total).toBe(605.93);
    expect(r.invoiceNo).toBe(p.invoiceNo);
  });

  test('intra-state supply splits into CGST + SGST', async () => {
    await invoicing.updateBusiness({ legalName: 'Sambandh Pvt Ltd', gstin: '27ABCDE1234F1Z5', state: 'Maharashtra', stateCode: '27', country: 'IN' });
    const p = await capturedSub(); await invoicing.assignInvoice(p);
    const r = invoicing.buildReceipt(await Payment.findById(p._id), { profile: { firstName: 'A', country: 'IN', state: 'Maharashtra' } }, await invoicing.getBusiness());
    expect(r.taxLines.map((l) => l.label)).toEqual([expect.stringMatching(/CGST @ 9%/), expect.stringMatching(/SGST @ 9%/)]);
    expect(r.taxLines[0].amount + r.taxLines[1].amount).toBeCloseTo(90, 2);
    expect(r.seller.gstin).toBe('27ABCDE1234F1Z5');
  });

  test('shows SAC code, place of supply, and reverse-charge status', async () => {
    const p = await capturedSub(); await invoicing.assignInvoice(p);
    const r = invoicing.buildReceipt(await Payment.findById(p._id), { profile: { firstName: 'A', country: 'IN', state: 'Karnataka' } }, await invoicing.getBusiness());
    expect(r.items[0].sac).toBe('998439');       // default SAC, editable per business
    expect(r.placeOfSupply).toBe('Karnataka');
    expect(r.reverseCharge).toBe('No');
  });

  test('a wallet top-up is a non-taxable receipt', async () => {
    const p = await capturedSub({ purpose: 'wallet_topup', metadata: { topupAmount: 1000, gatewayFee: 27, total: 1027, currency: 'INR', symbol: '₹' } });
    await invoicing.assignInvoice(p);
    const r = invoicing.buildReceipt(await Payment.findById(p._id), { profile: {} }, await invoicing.getBusiness());
    expect(r.kind).toBe('Payment Receipt');
    expect(r.taxTotal).toBe(0);
    expect(r.total).toBe(1027);
  });
});

describe('GET /payment/receipt/:id', () => {
  test('returns the receipt for the caller’s own captured payment', async () => {
    await mkUser();
    const p = await capturedSub();
    const r = await request(app).get('/payment/receipt/' + p._id);
    expect(r.status).toBe(200);
    expect(r.body.receipt.invoiceNo).toMatch(/SB\/\d{4}-\d{2}\/\d{5}/);
    expect(r.body.receipt.total).toBe(605.93);
  });
  test('refuses another user’s payment (404) and an uncaptured one (400)', async () => {
    await mkUser();
    const notMine = await Payment.create({ userId: otherId(), purpose: 'base_subscription', currency: 'INR', status: 'captured', metadata: {} });
    expect((await request(app).get('/payment/receipt/' + notMine._id)).status).toBe(404);
    const unpaid = await capturedSub({ status: 'created' });
    expect((await request(app).get('/payment/receipt/' + unpaid._id)).status).toBe(400);
  });
});
