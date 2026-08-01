// tests/consultation.test.js — bookable consultations on the marketplace core.
// Verifies per-minute pricing, ATOMIC slot booking (no double-booking), the full
// book→pay→session→complete→payout lifecycle, cancel/refund + slot release, owner
// isolation, and staff gating.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';
process.env.SUPER_ADMIN_KEY = 'test-super-key';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('./helpers/pg-db');            // must precede model/route requires

const { errorHandler } = require('../src/lib/errors');
const User = require('../src/models/User');
const Partner = require('../src/models/Partner');
const Listing = require('../src/models/Listing');
const Payment = require('../src/models/Payment');
const Order = require('../src/models/Order');
const Slot = require('../src/models/ConsultantSlot');
const Session = require('../src/models/Session');
const consult = require('../src/services/consultation');

const app = express();
app.use(express.json());
app.use('/api/consultation', require('../src/routes-consultation'));
app.use('/api/marketplace', require('../src/routes-marketplace'));   // booking pays/completes here
app.use(errorHandler());
const SK = { 'X-Super-Key': 'test-super-key' };

let seq = 7500000000;
const mkUser = () => User.create({ phone: '+91' + (seq++) });
const auth = (u) => ({ Authorization: 'Bearer ' + jwt.sign({ userId: String(u._id), phone: u.phone, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '30d' }) });

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

async function seedConsultant(over = {}) {
  const partner = await Partner.create({ name: 'Coach A', category: 'coach', active: true, ...over.partner });
  const listing = await Listing.create({ partnerId: partner._id, category: partner.category, title: '30-min session', kind: 'booking', priceCHF: 300, billing: 'per_minute', ratePerMinuteCHF: 10, durationMin: 30, active: true, ...over.listing });
  const slot = await Slot.create({ partnerId: partner._id, listingId: listing._id, startsAt: new Date(Date.now() + 3600000), durationMin: 30, status: 'open' });
  return { partner, listing, slot };
}

describe('consultation pricing', () => {
  test('per_minute price = rate × booked duration; flat uses priceCHF', () => {
    expect(consult.priceForListing({ billing: 'per_minute', ratePerMinuteCHF: 10, durationMin: 30 })).toBe(300);
    expect(consult.priceForListing({ billing: 'flat', priceCHF: 500 })).toBe(500);
  });
});

describe('atomic slot booking', () => {
  test('two concurrent bookings of one slot → exactly one wins', async () => {
    const { partner, listing, slot } = await seedConsultant();
    const u1 = await mkUser(), u2 = await mkUser();
    const results = await Promise.allSettled([
      consult.bookSlot({ userId: u1._id, listing, partner, slot }),
      consult.bookSlot({ userId: u2._id, listing, partner, slot })
    ]);
    expect(results.filter(r => r.status === 'fulfilled').length).toBe(1);
    expect(results.filter(r => r.status === 'rejected').length).toBe(1);
    expect((await Slot.findById(slot._id)).status).toBe('booked');
    expect(await Session.countDocuments({ slotId: slot._id })).toBe(1);   // no double-booking
  });
});

describe('booking → session → payout lifecycle', () => {
  test('book, pay, start, end, then buyer completes → payout released', async () => {
    const { slot } = await seedConsultant();
    const buyer = await mkUser();
    const bRes = await request(app).post('/api/consultation/book').set(auth(buyer)).send({ slotId: String(slot._id) });
    expect(bRes.status).toBe(201);
    const sessionId = bRes.body.session.id, orderId = bRes.body.marketplaceOrderId, paymentId = bRes.body.order.payment._id;
    expect(bRes.body.order.amountCHF).toBe(300);   // 10/min × 30 min (payable quoted order)

    await Payment.findByIdAndUpdate(paymentId, { status: 'captured' });
    const pay = await request(app).post(`/api/marketplace/orders/${orderId}/confirm-payment`).set(auth(buyer));
    expect(pay.body.order.status).toBe('paid');

    const start = await request(app).post(`/api/consultation/sessions/${sessionId}/start`).set(SK);
    expect(start.body.session.status).toBe('active');
    expect((await Order.findById(orderId)).status).toBe('confirmed');

    const end = await request(app).post(`/api/consultation/sessions/${sessionId}/end`).set(SK);
    expect(end.body.session.status).toBe('ended');
    expect((await Order.findById(orderId)).status).toBe('fulfilled');

    const done = await request(app).post(`/api/marketplace/orders/${orderId}/complete`).set(auth(buyer));
    expect(done.body.order.status).toBe('completed');
    expect(done.body.order.escrowHeld).toBe(false);   // payout released
  });

  test('cancel before fulfilment frees the slot and refunds a captured payment', async () => {
    const { slot } = await seedConsultant();
    const buyer = await mkUser();
    const bRes = await request(app).post('/api/consultation/book').set(auth(buyer)).send({ slotId: String(slot._id) });
    const sessionId = bRes.body.session.id, orderId = bRes.body.marketplaceOrderId, paymentId = bRes.body.order.payment._id;
    await Payment.findByIdAndUpdate(paymentId, { status: 'captured' });
    await request(app).post(`/api/marketplace/orders/${orderId}/confirm-payment`).set(auth(buyer));
    const cancel = await request(app).post(`/api/consultation/sessions/${sessionId}/cancel`).set(auth(buyer));
    expect(cancel.status).toBe(200);
    expect((await Slot.findById(slot._id)).status).toBe('open');        // slot freed
    expect((await Payment.findById(paymentId)).status).toBe('refunded'); // money reversed
    expect((await Order.findById(orderId)).status).toBe('cancelled');
  });
});

describe('access control', () => {
  test('owner isolation on cancel; start/end need staff; staff can publish slots', async () => {
    const { listing, slot } = await seedConsultant();
    const buyer = await mkUser(), stranger = await mkUser();
    const bRes = await request(app).post('/api/consultation/book').set(auth(buyer)).send({ slotId: String(slot._id) });
    const sessionId = bRes.body.session.id;
    expect((await request(app).post(`/api/consultation/sessions/${sessionId}/cancel`).set(auth(stranger))).status).toBe(404);
    expect([401, 403]).toContain((await request(app).post(`/api/consultation/sessions/${sessionId}/start`).set(auth(buyer))).status);
    const pub = await request(app).post(`/api/consultation/listings/${listing._id}/slots`).set(SK).send({ startsAt: new Date(Date.now() + 7200000).toISOString(), durationMin: 45 });
    expect(pub.status).toBe(201);
    expect(pub.body.slot.status).toBe('open');
  });
});

describe('booking notifications', () => {
  const Notification = require('../src/models/Notification');
  const settle = () => new Promise(r => setTimeout(r, 80));   // best-effort notify is fire-and-forget
  test('booking then cancelling both notify the buyer', async () => {
    const { slot } = await seedConsultant();
    const buyer = await mkUser();
    const bRes = await request(app).post('/api/consultation/book').set(auth(buyer)).send({ slotId: String(slot._id) });
    await settle();
    expect(await Notification.countDocuments({ userId: buyer._id, type: 'appointment' })).toBeGreaterThanOrEqual(1);
    await request(app).post(`/api/consultation/sessions/${bRes.body.session.id}/cancel`).set(auth(buyer));
    await settle();
    expect(await Notification.countDocuments({ userId: buyer._id, type: 'appointment' })).toBeGreaterThanOrEqual(2);
  });
});

describe('my appointments (enriched sessions)', () => {
  test('GET /sessions returns consultant, offering, scheduled time, price + order status', async () => {
    const { slot } = await seedConsultant();
    const buyer = await mkUser();
    const bRes = await request(app).post('/api/consultation/book').set(auth(buyer)).send({ slotId: String(slot._id) });
    const orderId = bRes.body.marketplaceOrderId, paymentId = bRes.body.order.payment._id;
    await Payment.findByIdAndUpdate(paymentId, { status: 'captured' });
    await request(app).post(`/api/marketplace/orders/${orderId}/confirm-payment`).set(auth(buyer));
    const r = await request(app).get('/api/consultation/sessions').set(auth(buyer));
    expect(r.status).toBe(200);
    expect(r.body.sessions.length).toBe(1);
    const s = r.body.sessions[0];
    expect(s.partnerName).toBe('Coach A');
    expect(s.title).toBe('30-min session');
    expect(s.amountCHF).toBe(300);
    expect(s.orderStatus).toBe('paid');
    expect(s.scheduledFor).toBeTruthy();
  });
});
