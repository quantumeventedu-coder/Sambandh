// tests/marketplace.test.js — the native marketplace: money-critical engine +
// end-to-end escrow lifecycle over HTTP. Verifies commission math, FAIL-CLOSED
// state transitions, budget-aware/local-first ranking, escrow-only-after-capture,
// owner isolation, staff gating, and verified-purchase reviews.

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
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');
const market = require('../src/services/marketplace');

const app = express();
app.use(express.json());
app.use('/api/marketplace', require('../src/routes-marketplace'));
app.use(errorHandler());
const SK = { 'X-Super-Key': 'test-super-key' };

let seq = 7300000000;
const mkUser = () => User.create({ phone: '+91' + (seq++) });
const tokenFor = (u) => jwt.sign({ userId: String(u._id), phone: u.phone, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '30d' });
const auth = (u) => ({ Authorization: 'Bearer ' + tokenFor(u) });

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

// helpers to spin up a partner + listing quickly
async function seedPartnerListing(over = {}) {
  const partner = await Partner.create({ name: 'Blooms', category: 'gift', city: 'Guwahati', active: true, ...over.partner });
  const listing = await Listing.create({ partnerId: partner._id, category: partner.category, title: 'Rose box', kind: 'product', priceCHF: 100, tierBand: 'essential', city: 'Guwahati', active: true, ...over.listing });
  return { partner, listing };
}

describe('engine: commission quote', () => {
  test('category default and rounding', () => {
    const q = market.quote({ priceCHF: 100 }, { category: 'gift' }); // gift → 0.15
    expect(q.commissionCHF).toBe(15);
    expect(q.partnerPayoutCHF).toBe(85);
    const q2 = market.quote({ priceCHF: 99.99 }, { category: 'coach' }); // coach → 0.25
    expect(q2.commissionCHF).toBe(25);        // 24.9975 → 25.00
    expect(q2.partnerPayoutCHF).toBe(74.99);
  });
  test('partner commissionRate overrides the category default', () => {
    const q = market.quote({ priceCHF: 200 }, { category: 'gift', commissionRate: 0.2 });
    expect(q.commissionCHF).toBe(40);
    expect(q.partnerPayoutCHF).toBe(160);
  });
});

describe('engine: escrow state machine is fail-closed', () => {
  test('illegal transitions throw; the happy path releases escrow on completion', async () => {
    const { partner, listing } = await seedPartnerListing();
    const user = await mkUser();
    const order = await market.createOrder({ userId: user._id, listing, partner });
    await expect(market.transition(order, 'completed')).rejects.toThrow(/Illegal/); // created → completed forbidden

    const paid = await market.transition(order, 'paid');
    expect(paid.escrowHeld).toBe(true);
    const confirmed = await market.transition(await Order.findById(order._id), 'confirmed');
    const fulfilled = await market.transition(await Order.findById(confirmed._id), 'fulfilled');
    const completed = await market.transition(await Order.findById(fulfilled._id), 'completed');
    expect(completed.escrowHeld).toBe(false);
    expect(completed.escrowReleasedAt).toBeInstanceOf(Date);
  });
  test('cancelling a paid order drops escrow and restocks', async () => {
    const { partner, listing } = await seedPartnerListing({ listing: { stock: 1 } });
    const user = await mkUser();
    const order = await market.createOrder({ userId: user._id, listing, partner });
    expect((await Listing.findById(listing._id)).stock).toBe(0);       // reserved
    await market.transition(order, 'paid');
    await market.transition(await Order.findById(order._id), 'cancelled');
    expect((await Listing.findById(listing._id)).stock).toBe(1);       // restored
  });
  test('out-of-stock order is rejected', async () => {
    const { partner, listing } = await seedPartnerListing({ listing: { stock: 0 } });
    const user = await mkUser();
    await expect(market.createOrder({ userId: user._id, listing, partner })).rejects.toThrow(/stock/i);
  });
});

describe('engine: budget-aware + local-first ranking', () => {
  test('over-budget items rank below in-budget ones', () => {
    const partner = { category: 'gift', tier: 'standard', verified: false, ratingCount: 0 };
    const cheap = { priceCHF: 80, location: null };
    const dear = { priceCHF: 1000, location: null };
    const ranked = market.rank([{ listing: dear, partner }, { listing: cheap, partner }], { budgetMaxCHF: 100 });
    expect(ranked[0].listing).toBe(cheap);
    expect(ranked[0].factors.budgetFit).toBe(1);
    expect(ranked[1].factors.budgetFit).toBeLessThan(0.5);
  });
  test('out-of-delivery-radius items get zero proximity', () => {
    const partner = { category: 'florist', tier: 'standard', verified: false, ratingCount: 0 };
    const near = { priceCHF: 50, location: { lat: 26.14, lng: 91.73 }, deliveryRadiusKm: 20 };
    const far = { priceCHF: 50, location: { lat: 19.07, lng: 72.87 }, deliveryRadiusKm: 20 }; // ~2000km away
    const at = { lat: 26.15, lng: 91.74 };
    const ranked = market.rank([{ listing: far, partner }, { listing: near, partner }], { at });
    expect(ranked[0].listing).toBe(near);
    expect(ranked.find(r => r.listing === far).factors.proximity).toBe(0);
  });
});

describe('routes: full escrow lifecycle end-to-end', () => {
  test('order → capture-gated escrow → fulfil → complete → review', async () => {
    // staff onboards a partner + listing
    const pRes = await request(app).post('/api/marketplace/partners').set(SK).send({ name: 'Lens Co', category: 'photographer', city: 'Guwahati' });
    expect(pRes.status).toBe(201);
    const partnerId = pRes.body.partner.id;
    const lRes = await request(app).post(`/api/marketplace/partners/${partnerId}/listings`).set(SK).send({ title: 'Pre-wedding shoot', kind: 'service', priceCHF: 300, tierBand: 'premium', city: 'Guwahati' });
    expect(lRes.status).toBe(201);
    const listingId = lRes.body.listing.id;

    const buyer = await mkUser();
    // browse
    const browse = await request(app).get('/api/marketplace/listings?category=photographer&city=Guwahati').set(auth(buyer));
    expect(browse.status).toBe(200);
    expect(browse.body.results.length).toBe(1);

    // place order → creates a Payment (not yet captured)
    const oRes = await request(app).post('/api/marketplace/orders').set(auth(buyer)).send({ listingId });
    expect(oRes.status).toBe(201);
    const orderId = oRes.body.order.id;
    const paymentId = oRes.body.payment.id;

    // escrow cannot hold before capture
    const early = await request(app).post(`/api/marketplace/orders/${orderId}/confirm-payment`).set(auth(buyer));
    expect(early.status).toBe(402);

    // simulate the payment rail capturing the charge
    await Payment.findByIdAndUpdate(paymentId, { status: 'captured' });
    const paid = await request(app).post(`/api/marketplace/orders/${orderId}/confirm-payment`).set(auth(buyer));
    expect(paid.status).toBe(200);
    expect(paid.body.order.status).toBe('paid');
    expect(paid.body.order.escrowHeld).toBe(true);

    // buyer cannot complete before the partner fulfils
    const tooEarly = await request(app).post(`/api/marketplace/orders/${orderId}/complete`).set(auth(buyer));
    expect(tooEarly.status).toBe(409);

    // staff confirms + fulfils, buyer completes → escrow released
    await request(app).post(`/api/marketplace/orders/${orderId}/confirm`).set(SK);
    await request(app).post(`/api/marketplace/orders/${orderId}/fulfill`).set(SK);
    const done = await request(app).post(`/api/marketplace/orders/${orderId}/complete`).set(auth(buyer));
    expect(done.status).toBe(200);
    expect(done.body.order.status).toBe('completed');
    expect(done.body.order.escrowHeld).toBe(false);

    // verified-purchase review updates partner rating
    const rev = await request(app).post(`/api/marketplace/orders/${orderId}/review`).set(auth(buyer)).send({ rating: 5, text: 'Great' });
    expect(rev.status).toBe(201);
    expect((await Partner.findById(partnerId)).ratingAvg).toBe(5);
    // second review on same order is rejected
    const rev2 = await request(app).post(`/api/marketplace/orders/${orderId}/review`).set(auth(buyer)).send({ rating: 1 });
    expect(rev2.status).toBe(409);
  });

  test('another user cannot touch my order; staff endpoints need market:manage', async () => {
    const { partner, listing } = await seedPartnerListing();
    const buyer = await mkUser(); const stranger = await mkUser();
    const order = await market.createOrder({ userId: buyer._id, listing, partner });
    const asStranger = await request(app).post(`/api/marketplace/orders/${order._id}/cancel`).set(auth(stranger));
    expect(asStranger.status).toBe(404);   // owner isolation
    const noKey = await request(app).post('/api/marketplace/partners').send({ name: 'x', category: 'gift' });
    expect([401, 403]).toContain(noKey.status);
  });
});
