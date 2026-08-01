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
const Chat = require('../src/models/Chat');
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
// A valid postal address — physical products (kind:'product') require one to be deliverable.
const ADDR = { name: 'Aarav', phone: '+919000000001', line1: '12 MG Road', city: 'Guwahati', state: 'Assam', pincode: '781001' };

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
    const order = await market.createOrder({ userId: user._id, listing, partner, shippingAddress: ADDR });
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
    const order = await market.createOrder({ userId: user._id, listing, partner, shippingAddress: ADDR });
    expect((await Listing.findById(listing._id)).stock).toBe(0);       // reserved
    await market.transition(order, 'paid');
    await market.transition(await Order.findById(order._id), 'cancelled');
    expect((await Listing.findById(listing._id)).stock).toBe(1);       // restored
  });
  test('out-of-stock order is rejected', async () => {
    const { partner, listing } = await seedPartnerListing({ listing: { stock: 0 } });
    const user = await mkUser();
    await expect(market.createOrder({ userId: user._id, listing, partner, shippingAddress: ADDR })).rejects.toThrow(/stock/i);
  });
});

describe('delivery: physical products require a postal address (GPS is never used to ship)', () => {
  test('a product order with NO address is rejected — and reserves no stock', async () => {
    const { partner, listing } = await seedPartnerListing({ listing: { stock: 5 } });
    const user = await mkUser();
    await expect(market.createOrder({ userId: user._id, listing, partner })).rejects.toThrow(/delivery address/i);
    expect((await Listing.findById(listing._id)).stock).toBe(5);   // rejected before reserving inventory
  });
  test('an incomplete address (missing PIN) is rejected', async () => {
    const { partner, listing } = await seedPartnerListing();
    const user = await mkUser();
    const bad = { name: 'A', phone: '+919000000001', line1: '12 MG Road', city: 'Guwahati' };  // no pincode
    await expect(market.createOrder({ userId: user._id, listing, partner, shippingAddress: bad })).rejects.toThrow(/delivery address/i);
  });
  test('a valid address is stored on the order (and a service order needs none)', async () => {
    const { partner, listing } = await seedPartnerListing();
    const user = await mkUser();
    const order = await market.createOrder({ userId: user._id, listing, partner, shippingAddress: ADDR });
    expect(order.shippingAddress.pincode).toBe('781001');
    expect(order.shippingAddress.country).toBe('IN');            // defaulted
    const svc = await Listing.create({ partnerId: partner._id, category: 'coach', title: 'Session', kind: 'service', priceCHF: 50, tierBand: 'essential', city: 'Guwahati', active: true });
    const sOrder = await market.createOrder({ userId: user._id, listing: svc, partner });  // no address needed
    expect(sOrder.shippingAddress).toBeNull();
  });
  test('the HTTP order route rejects a physical order without an address (400)', async () => {
    const pRes = await request(app).post('/api/marketplace/partners').set(SK).send({ name: 'Blooms', category: 'gift', city: 'Guwahati' });
    const lRes = await request(app).post(`/api/marketplace/partners/${pRes.body.partner.id}/listings`).set(SK).send({ title: 'Rose box', kind: 'product', priceCHF: 100, tierBand: 'essential', city: 'Guwahati' });
    const buyer = await mkUser();
    const noAddr = await request(app).post('/api/marketplace/orders').set(auth(buyer)).send({ listingId: lRes.body.listing.id });
    expect(noAddr.status).toBe(400);
    const withAddr = await request(app).post('/api/marketplace/orders').set(auth(buyer)).send({ listingId: lRes.body.listing.id, shippingAddress: ADDR });
    expect(withAddr.status).toBe(201);
    expect((await Order.findById(withAddr.body.marketplaceOrderId)).shippingAddress.pincode).toBe('781001');
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

    // place order → returns a payable order (dev/Razorpay) + the marketplace order id
    const oRes = await request(app).post('/api/marketplace/orders').set(auth(buyer)).send({ listingId });
    expect(oRes.status).toBe(201);
    const orderId = oRes.body.marketplaceOrderId;
    const paymentId = oRes.body.order.payment._id;

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
    // reviews are publicly readable per partner
    const rd = await request(app).get(`/api/marketplace/partners/${partnerId}/reviews`).set(auth(buyer));
    expect(rd.status).toBe(200);
    expect(rd.body.reviews.length).toBe(1);
    expect(rd.body.reviews[0].rating).toBe(5);
    expect(rd.body.reviews[0].verified).toBe(true);
  });

  test('another user cannot touch my order; staff endpoints need market:manage', async () => {
    const { partner, listing } = await seedPartnerListing();
    const buyer = await mkUser(); const stranger = await mkUser();
    const order = await market.createOrder({ userId: buyer._id, listing, partner, shippingAddress: ADDR });
    const asStranger = await request(app).post(`/api/marketplace/orders/${order._id}/cancel`).set(auth(stranger));
    expect(asStranger.status).toBe(404);   // owner isolation
    const noKey = await request(app).post('/api/marketplace/partners').send({ name: 'x', category: 'gift' });
    expect([401, 403]).toContain(noKey.status);
  });
});

describe('hardening: fixes from the adversarial money-review', () => {
  test('atomic stock reservation prevents oversell under concurrency', async () => {
    const { partner, listing } = await seedPartnerListing({ listing: { stock: 1 } });
    const u1 = await mkUser(), u2 = await mkUser();
    const results = await Promise.allSettled([
      market.createOrder({ userId: u1._id, listing, partner, shippingAddress: ADDR }),
      market.createOrder({ userId: u2._id, listing, partner, shippingAddress: ADDR })
    ]);
    expect(results.filter(r => r.status === 'fulfilled').length).toBe(1);
    const failed = results.filter(r => r.status === 'rejected');
    expect(failed.length).toBe(1);
    expect(failed[0].reason.message).toMatch(/stock/i);
    expect((await Listing.findById(listing._id)).stock).toBe(0);
    expect(await Order.countDocuments({ listingId: listing._id })).toBe(1);   // no oversell
  });

  test('compare-and-set: only one concurrent transition from a status wins', async () => {
    const { partner, listing } = await seedPartnerListing();
    const user = await mkUser();
    const order = await market.createOrder({ userId: user._id, listing, partner, shippingAddress: ADDR });
    const results = await Promise.allSettled([market.transition(order, 'paid'), market.transition(order, 'paid')]);
    expect(results.filter(r => r.status === 'fulfilled').length).toBe(1);
    expect(results.filter(r => r.status === 'rejected').length).toBe(1);
    expect((await Order.findById(order._id)).status).toBe('paid');
  });

  test('concurrent cancel + refund restocks exactly once', async () => {
    const { partner, listing } = await seedPartnerListing({ listing: { stock: 1 } });
    const user = await mkUser();
    const order = await market.createOrder({ userId: user._id, listing, partner, shippingAddress: ADDR });   // stock 1→0, reserved
    await market.transition(order, 'paid');
    const paidOrder = await Order.findById(order._id);
    const results = await Promise.allSettled([market.transition(paidOrder, 'cancelled'), market.transition(paidOrder, 'refunded')]);
    expect(results.filter(r => r.status === 'fulfilled').length).toBe(1);   // only one terminal move wins
    expect((await Listing.findById(listing._id)).stock).toBe(1);            // restored once, not twice
  });

  test('cancelling a paid order reverses the captured Payment (no stranded funds)', async () => {
    const { partner, listing } = await seedPartnerListing();
    const user = await mkUser();
    const order = await market.createOrder({ userId: user._id, listing, partner, shippingAddress: ADDR });
    const payment = await Payment.create({ userId: user._id, purpose: 'marketplace_order', amountCHF: order.amountCHF, status: 'captured' });
    await market.transition(order, 'paid', { paymentId: payment._id });
    await market.transition(await Order.findById(order._id), 'cancelled');
    expect((await Payment.findById(payment._id)).status).toBe('refunded');
  });

  test('buyer cannot self-release the payout via paid → disputed → complete', async () => {
    const pRes = await request(app).post('/api/marketplace/partners').set(SK).send({ name: 'Coach Co', category: 'coach' });
    const partnerId = pRes.body.partner.id;
    const lRes = await request(app).post(`/api/marketplace/partners/${partnerId}/listings`).set(SK).send({ title: 'Session', kind: 'service', priceCHF: 100 });
    const listingId = lRes.body.listing.id;
    const buyer = await mkUser();
    const oRes = await request(app).post('/api/marketplace/orders').set(auth(buyer)).send({ listingId });
    const orderId = oRes.body.marketplaceOrderId, paymentId = oRes.body.order.payment._id;
    await Payment.findByIdAndUpdate(paymentId, { status: 'captured' });
    await request(app).post(`/api/marketplace/orders/${orderId}/confirm-payment`).set(auth(buyer));
    await request(app).post(`/api/marketplace/orders/${orderId}/dispute`).set(auth(buyer)).send({ reason: 'stalling' });
    const escape = await request(app).post(`/api/marketplace/orders/${orderId}/complete`).set(auth(buyer));
    expect(escape.status).toBe(409);                       // cannot complete a disputed order
    const o = await Order.findById(orderId);
    expect(o.status).toBe('disputed');
    expect(o.escrowHeld).toBe(true);                       // payout NOT released
    const resolved = await request(app).post(`/api/marketplace/orders/${orderId}/resolve-dispute`).set(SK).send({ outcome: 'complete' });
    expect(resolved.body.order.status).toBe('completed');  // only staff can close it
  });

  test('sponsored, over-budget listing cannot outrank an at-budget one (hard gate)', () => {
    const sponsored = { category: 'gift', tier: 'enterprise', verified: true, ratingCount: 10, ratingAvg: 5 };
    const plain = { category: 'gift', tier: 'standard', verified: false, ratingCount: 0 };
    const ranked = market.rank([
      { listing: { priceCHF: 120, location: null, featured: true }, partner: sponsored }, // 20% over, featured+enterprise
      { listing: { priceCHF: 100, location: null }, partner: plain }                      // at budget, plain
    ], { budgetMaxCHF: 100 });
    expect(ranked[0].listing.priceCHF).toBe(100);   // the affordable one wins regardless of sponsorship
  });

  test('PATCH rejects string/float stock and string price (parity with create)', async () => {
    const { listing } = await seedPartnerListing({ listing: { stock: 5, priceCHF: 100 } });
    await request(app).patch(`/api/marketplace/listings/${listing._id}`).set(SK).send({ stock: '0', priceCHF: '50' });
    let after = await Listing.findById(listing._id);
    expect(after.stock).toBe(5); expect(after.priceCHF).toBe(100);    // strings ignored
    await request(app).patch(`/api/marketplace/listings/${listing._id}`).set(SK).send({ stock: 2.5 });
    expect((await Listing.findById(listing._id)).stock).toBe(5);      // float stock ignored
  });
});

describe('gift to a match: private (blind) delivery', () => {
  const matchThem = (a, b) => Chat.create({ participants: [a._id, b._id], status: 'active' });
  async function paidGift() {
    const { partner, listing } = await seedPartnerListing();               // product 'Rose box'
    const buyer = await mkUser(), recipient = await mkUser();
    await matchThem(buyer, recipient);
    const oRes = await request(app).post('/api/marketplace/orders').set(auth(buyer)).send({ listingId: String(listing._id), giftForUserId: String(recipient._id) });
    const orderId = oRes.body.marketplaceOrderId, paymentId = oRes.body.order.payment._id;
    await Payment.findByIdAndUpdate(paymentId, { status: 'captured' });
    await request(app).post(`/api/marketplace/orders/${orderId}/confirm-payment`).set(auth(buyer));   // → paid, recipient notified
    return { partner, listing, buyer, recipient, orderId, paymentId };
  }

  test('gifting needs no buyer address, but must be a real match (never a stranger/self)', async () => {
    const { listing } = await seedPartnerListing();
    const buyer = await mkUser(), other = await mkUser();
    const stranger = await request(app).post('/api/marketplace/orders').set(auth(buyer)).send({ listingId: String(listing._id), giftForUserId: String(other._id) });
    expect(stranger.status).toBe(403);
    const self = await request(app).post('/api/marketplace/orders').set(auth(buyer)).send({ listingId: String(listing._id), giftForUserId: String(buyer._id) });
    expect(self.status).toBe(400);
    await matchThem(buyer, other);
    const ok = await request(app).post('/api/marketplace/orders').set(auth(buyer)).send({ listingId: String(listing._id), giftForUserId: String(other._id) });
    expect(ok.status).toBe(201);                                           // no shippingAddress needed
    const ord = await Order.findById(ok.body.marketplaceOrderId);
    expect(ord.giftStatus).toBe('pending');
    expect(ord.shippingAddress).toBeNull();
  });

  test('recipient accepts with a PRIVATE address the buyer never sees; fulfilment gated until then', async () => {
    const { buyer, recipient, orderId } = await paidGift();
    // staff cannot advance a gift that is not yet accepted
    const preConfirm = await request(app).post(`/api/marketplace/orders/${orderId}/confirm`).set(SK);
    expect(preConfirm.status).toBe(409);

    // recipient sees the paid, pending gift
    const gifts = await request(app).get('/api/marketplace/orders/gifts').set(auth(recipient));
    expect(gifts.body.gifts.length).toBe(1);
    expect(gifts.body.gifts[0].needsAddress).toBe(true);

    // recipient accepts with their own address
    const RA = { name: 'Meera', phone: '+919111111111', line1: '9 Fancy Bazar', city: 'Guwahati', pincode: '781001' };
    const acc = await request(app).post(`/api/marketplace/orders/${orderId}/accept-gift`).set(auth(recipient)).send({ shippingAddress: RA });
    expect(acc.status).toBe(200);

    // the BUYER never sees the recipient's address
    const buyerView = await request(app).get('/api/marketplace/orders').set(auth(buyer));
    const bo = buyerView.body.orders.find(o => String(o.id) === String(orderId));
    expect(bo.giftStatus).toBe('accepted');
    expect(bo.shippingAddress).toBeNull();

    // staff (fulfilment) CAN see it, and can now confirm + fulfil
    expect((await Order.findById(orderId)).shippingAddress.pincode).toBe('781001');
    await request(app).post(`/api/marketplace/orders/${orderId}/confirm`).set(SK);
    const okFulfil = await request(app).post(`/api/marketplace/orders/${orderId}/fulfill`).set(SK);
    expect(okFulfil.status).toBe(200);
  });

  test('declining a paid gift refunds the buyer and drops escrow', async () => {
    const { recipient, orderId, paymentId } = await paidGift();
    const dec = await request(app).post(`/api/marketplace/orders/${orderId}/decline-gift`).set(auth(recipient));
    expect(dec.status).toBe(200);
    const ord = await Order.findById(orderId);
    expect(ord.giftStatus).toBe('declined');
    expect(ord.status).toBe('refunded');
    expect(ord.escrowHeld).toBe(false);
    expect((await Payment.findById(paymentId)).status).toBe('refunded');
  });

  test('a stranger cannot accept or decline my gift', async () => {
    const { orderId } = await paidGift();
    const stranger = await mkUser();
    const a = await request(app).post(`/api/marketplace/orders/${orderId}/accept-gift`).set(auth(stranger)).send({ shippingAddress: ADDR });
    expect(a.status).toBe(404);
    const d = await request(app).post(`/api/marketplace/orders/${orderId}/decline-gift`).set(auth(stranger));
    expect(d.status).toBe(404);
  });

  test('a late capture on a CANCELLED order is reversed, not stranded (confirm-payment)', async () => {
    const { listing } = await seedPartnerListing();
    const buyer = await mkUser();
    const oRes = await request(app).post('/api/marketplace/orders').set(auth(buyer)).send({ listingId: String(listing._id), shippingAddress: ADDR });
    const orderId = oRes.body.marketplaceOrderId, paymentId = oRes.body.order.payment._id;
    await request(app).post(`/api/marketplace/orders/${orderId}/cancel`).set(auth(buyer));   // cancel the still-'created' order
    await Payment.findByIdAndUpdate(paymentId, { status: 'captured' });                       // gateway captures LATE
    const cp = await request(app).post(`/api/marketplace/orders/${orderId}/confirm-payment`).set(auth(buyer));
    expect(cp.status).toBe(409);
    expect((await Payment.findById(paymentId)).status).toBe('refunded');                      // money returned, not stranded
  });

  test('reconcileStrandedOrders reverses a capture that landed after cancel (nightly backstop)', async () => {
    const { partner, listing } = await seedPartnerListing();
    const buyer = await mkUser();
    const order = await market.createOrder({ userId: buyer._id, listing, partner, shippingAddress: ADDR });
    const payment = await Payment.create({ userId: buyer._id, purpose: 'marketplace_order', amountCHF: order.amountCHF, razorpayOrderId: 'late1', status: 'created' });
    await Order.findByIdAndUpdate(order._id, { paymentId: payment._id });
    await market.transition(order, 'cancelled');
    await Payment.findByIdAndUpdate(payment._id, { status: 'captured' });                     // late capture on a dead order
    const r = await market.reconcileStrandedOrders();
    expect(r.reclaimed).toBeGreaterThanOrEqual(1);
    expect((await Payment.findById(payment._id)).status).toBe('refunded');
  });

  test('declining a DISPUTED gift refunds it — no stranded escrow, honest refund flag', async () => {
    const { buyer, recipient, orderId, paymentId } = await paidGift();
    await request(app).post(`/api/marketplace/orders/${orderId}/dispute`).set(auth(buyer)).send({ reason: 'slow' });
    const dec = await request(app).post(`/api/marketplace/orders/${orderId}/decline-gift`).set(auth(recipient));
    expect(dec.status).toBe(200);
    expect(dec.body.refunded).toBe(true);
    const o = await Order.findById(orderId);
    expect(o.status).toBe('refunded');
    expect(o.escrowHeld).toBe(false);
    expect((await Payment.findById(paymentId)).status).toBe('refunded');
  });

  test('a still-pending (disputed) gift cannot be resolved to completed → no payout without acceptance', async () => {
    const { buyer, orderId } = await paidGift();
    await request(app).post(`/api/marketplace/orders/${orderId}/dispute`).set(auth(buyer)).send({ reason: 'slow' });
    const resolve = await request(app).post(`/api/marketplace/orders/${orderId}/resolve-dispute`).set(SK).send({ outcome: 'complete' });
    expect(resolve.status).toBe(409);                       // gift gate blocks completed without acceptance
    const o = await Order.findById(orderId);
    expect(o.status).toBe('disputed');
    expect(o.escrowHeld).toBe(true);                        // payout NOT released to the partner
  });

  test('gift-recipients lists revealed matches and hides anonymous ones', async () => {
    const me = await mkUser(), friend = await mkUser(), secret = await mkUser();
    await Chat.create({ participants: [me._id, friend._id], status: 'active' });                          // revealed by default
    await Chat.create({ participants: [me._id, secret._id], status: 'active', anonymity: { isAnonymous: true } });
    const r = await request(app).get('/api/marketplace/gift-recipients').set(auth(me));
    expect(r.status).toBe(200);
    const ids = r.body.recipients.map((/** @type {any} */ x) => String(x.userId));
    expect(ids).toContain(String(friend._id));
    expect(ids).not.toContain(String(secret._id));
  });
});
