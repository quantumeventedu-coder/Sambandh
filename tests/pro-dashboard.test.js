// tests/pro-dashboard.test.js — self-serve professional dashboard: apply (Partner owned by the
// user), manage offerings + availability, see appointments (consultant side), start/end own
// sessions (owner-authorised, no staff key), and earnings. Money reuses the reviewed rails.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('./helpers/pg-db');

const { errorHandler } = require('../src/lib/errors');
const User = require('../src/models/User');
const Payment = require('../src/models/Payment');

const app = express();
app.use(express.json());
app.use('/api/pro', require('../src/routes-pro'));
app.use('/api/consultation', require('../src/routes-consultation'));
app.use('/api/marketplace', require('../src/routes-marketplace'));
app.use(errorHandler());

let seq = 7700000000;
// A client booking a consultation needs the Plus tier; give test members an active one.
const mkUser = () => User.create({ phone: '+91' + (seq++), membership: { tier: 'max', tierExpiresAt: new Date(Date.now() + 30 * 86400000) } });
const auth = (u) => ({ Authorization: 'Bearer ' + jwt.sign({ userId: String(u._id), phone: u.phone, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '30d' }) });
const applyPro = (u) => request(app).post('/api/pro/apply').set(auth(u)).send({ name: 'Dr A', category: 'counselor', bio: 'Hi', city: 'Pune' });
const mkListing = (u) => request(app).post('/api/pro/listings').set(auth(u)).send({ title: 'Therapy', billing: 'flat', priceCHF: 80 });
const futureIso = () => new Date(Date.now() + 3600000).toISOString();

beforeAll(db.start); afterAll(db.stop); afterEach(db.clear);

describe('professional dashboard (self-serve)', () => {
  test('apply → profile (pending, not verified) + listing + slot; one profile per user', async () => {
    const pro = await mkUser();
    const ap = await applyPro(pro);
    expect(ap.status).toBe(201);
    expect(ap.body.partner.verificationStatus).toBe('pending');
    expect(ap.body.partner.verified).toBe(false);                              // self-serve never grants the badge
    expect((await applyPro(pro)).status).toBe(409);                            // one profile per user
    const lst = await mkListing(pro); expect(lst.status).toBe(201);
    const slot = await request(app).post(`/api/pro/listings/${lst.body.listing.id}/slots`).set(auth(pro)).send({ startsAt: futureIso(), durationMin: 45 });
    expect(slot.status).toBe(201);
    expect((await request(app).get('/api/pro/slots').set(auth(pro))).body.slots.length).toBe(1);
  });

  test('client books → pro sees the appointment → start/end → earnings released on buyer-complete', async () => {
    const pro = await mkUser(), client = await mkUser();
    await applyPro(pro);
    const listingId = (await mkListing(pro)).body.listing.id;
    const slotId = (await request(app).post(`/api/pro/listings/${listingId}/slots`).set(auth(pro)).send({ startsAt: futureIso() })).body.slot.id;
    const bRes = await request(app).post('/api/consultation/book').set(auth(client)).send({ slotId });
    const orderId = bRes.body.marketplaceOrderId, paymentId = bRes.body.order.payment._id;
    await Payment.findByIdAndUpdate(paymentId, { status: 'captured' });
    await request(app).post(`/api/marketplace/orders/${orderId}/confirm-payment`).set(auth(client));

    const appts = await request(app).get('/api/pro/appointments').set(auth(pro));
    expect(appts.body.appointments.length).toBe(1);
    const sessionId = appts.body.appointments[0].id;
    // owner-authorised start/end — no staff key
    expect((await request(app).post(`/api/pro/appointments/${sessionId}/start`).set(auth(pro))).body.session.status).toBe('active');
    expect((await request(app).post(`/api/pro/appointments/${sessionId}/end`).set(auth(pro))).body.session.status).toBe('ended');

    expect((await request(app).get('/api/pro/earnings').set(auth(pro))).body.pending).toBeGreaterThan(0);   // in escrow
    await request(app).post(`/api/marketplace/orders/${orderId}/complete`).set(auth(client));               // buyer releases
    const earn = await request(app).get('/api/pro/earnings').set(auth(pro));
    expect(earn.body.released).toBeGreaterThan(0);
    expect(earn.body.completedOrders).toBe(1);
  });

  test('ownership: a non-owner cannot close my slot or start my session', async () => {
    const pro = await mkUser(), other = await mkUser();
    await applyPro(pro);
    const listingId = (await mkListing(pro)).body.listing.id;
    const slotId = (await request(app).post(`/api/pro/listings/${listingId}/slots`).set(auth(pro)).send({ startsAt: futureIso() })).body.slot.id;
    expect((await request(app).post(`/api/pro/slots/${slotId}/close`).set(auth(other))).status).toBe(404);   // not their profile
    expect((await request(app).post(`/api/pro/slots/${slotId}/close`).set(auth(pro))).status).toBe(200);     // owner closes own slot
  });
});
