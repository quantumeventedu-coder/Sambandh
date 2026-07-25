// tests/verification-services.test.js — consent-gated Verification Services.
// Covers the design-review must-fixes: server-derived mode, consent-before-any-check,
// deny→refund, revoke-after-completion→report frozen, coarse/no-PII report,
// self-only checks absent from third-party reports, money pinning + isolation.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';
process.env.SUPER_ADMIN_KEY = 'test-super-key';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('./helpers/pg-db');            // must precede model/route requires

const { errorHandler } = require('../src/lib/errors');
const User = require('../src/models/User');
const Chat = require('../src/models/Chat');
const Payment = require('../src/models/Payment');
const VerificationCase = require('../src/models/VerificationCase');
const Consent = require('../src/models/Consent');

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use('/api/verification-services', require('../src/routes-verification-services'));
app.use('/api/payment', require('../src/routes-payment'));
app.use(errorHandler());

let seq = 8100000000;
const auth = (u) => ({ Authorization: 'Bearer ' + jwt.sign({ userId: String(u._id), phone: u.phone, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '30d' }) });

/** A well-verified subject: ID + selfie + profession verified, live selfie primary photo. */
function verifiedSubject(over = {}) {
  return User.create({
    phone: '+91' + (seq++),
    phoneVerified: true,
    verification: { idVerified: true, selfieVerified: true, professionVerified: true, level: 'profession_verified' },
    claims: { profession: { title: 'Doctor', company: 'City Hospital', verified: true } },
    profile: { firstName: 'A', photos: [{ url: 'x', isPrimary: true, fromSelfie: true }] },
    preferences: {},
    ...over
  });
}
const plainUser = () => User.create({ phone: '+91' + (seq++), verification: {}, profile: {}, claims: {}, preferences: {} });
const match = (a, b) => Chat.create({ participants: [a._id, b._id], status: 'active' });

/** Pay a case's dev order via the shared payment rail, then confirm it on the case. */
async function payAndConfirm(requester, caseId, orderId) {
  const v = await request(app).post('/api/payment/verify').set(auth(requester)).send({ razorpay_order_id: orderId });
  expect(v.body.ok).toBe(true);
  return request(app).post(`/api/verification-services/cases/${caseId}/confirm-payment`).set(auth(requester));
}

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('catalogue', () => {
  test('GET /tiers lists tiers and flags self-only checks', async () => {
    const u = await plainUser();
    const res = await request(app).get('/api/verification-services/tiers').set(auth(u));
    expect(res.status).toBe(200);
    const dl = res.body.tiers.find((t) => t.id === 'dating_lite');
    expect(dl.priceCHF).toBe(5);
    const face = dl.checks.find((c) => c.name === 'face_uniqueness');
    expect(face.selfOnly).toBe(true);
    expect(face.thirdPartyAvailable).toBe(false);
  });
});

describe('self-mode', () => {
  test('create → pay → confirm completes with a coarse, PII-free report', async () => {
    const me = await verifiedSubject();
    const create = await request(app).post('/api/verification-services/cases').set(auth(me)).send({ tier: 'pre_marital' });
    expect(create.status).toBe(201);
    expect(create.body.case.mode).toBe('self');
    expect(create.body.consentRequested).toBe(false);
    const { case: { id }, order } = create.body;

    const done = await payAndConfirm(me, id, order.orderId);
    expect(done.body.case.status).toBe('completed');

    const view = await request(app).get(`/api/verification-services/cases/${id}`).set(auth(me));
    const rep = view.body.case.report;
    expect(rep.verifiedLevel).toBe('strong');                    // identity + claim verified (facts only)
    // every check is coarse: EXACTLY {name,kind,status,label}
    for (const c of rep.checks) expect(Object.keys(c).sort()).toEqual(['kind', 'label', 'name', 'status']);
    // no PII / internals leaked anywhere in the payload
    const blob = JSON.stringify(view.body);
    expect(blob).not.toMatch(/evidenceHash/);
    expect(blob).not.toMatch(/reasons|riskScore|karma|descriptor/i);
  });
});

describe('other-mode consent gate', () => {
  test('mode is server-derived; no check runs before the subject grants consent', async () => {
    const requester = await plainUser();
    const subject = await verifiedSubject();
    await match(requester, subject);

    // Client tries to spoof self-mode to skip consent — the field is ignored.
    const create = await request(app).post('/api/verification-services/cases').set(auth(requester))
      .send({ tier: 'pre_marital', subjectId: String(subject._id), mode: 'self' });
    expect(create.status).toBe(201);
    expect(create.body.case.mode).toBe('other');                 // derived, not trusted
    expect(create.body.consentRequested).toBe(true);
    const { case: { id }, order } = create.body;

    // Pay + confirm — still NOT run (awaiting consent).
    const afterPay = await payAndConfirm(requester, id, order.orderId);
    expect(afterPay.body.case.status).toBe('pending');
    expect((await VerificationCase.findById(id)).report).toBeFalsy();

    // Subject grants → now it runs.
    const reqs = await request(app).get('/api/verification-services/consent-requests').set(auth(subject));
    const consentId = reqs.body.requests[0].id;
    const grant = await request(app).post(`/api/verification-services/consent-requests/${consentId}/grant`).set(auth(subject));
    expect(grant.body.caseStatus).toBe('completed');

    // Report excludes self-only checks as not_applicable (no third-party-derived data).
    const view = await request(app).get(`/api/verification-services/cases/${id}`).set(auth(requester));
    const byName = Object.fromEntries(view.body.case.report.checks.map((c) => [c.name, c]));
    expect(byName.face_uniqueness.status).toBe('not_applicable');
    expect(byName.conduct_history.status).toBe('not_applicable');
    expect(byName.risk_assessment.status).toBe('not_applicable');
    expect(byName.identity_authenticity.status).toBe('verified'); // first-party fact is present
  });

  test('other-mode requires an active mutual match', async () => {
    const requester = await plainUser();
    const stranger = await verifiedSubject();                    // no shared chat
    const res = await request(app).post('/api/verification-services/cases').set(auth(requester))
      .send({ tier: 'dating_lite', subjectId: String(stranger._id) });
    expect(res.status).toBe(403);
  });

  test('a block between the pair prevents a case', async () => {
    const requester = await plainUser();
    const subject = await verifiedSubject();
    await match(requester, subject);
    await User.findByIdAndUpdate(subject._id, { blockedUsers: [requester._id] });
    const res = await request(app).post('/api/verification-services/cases').set(auth(requester))
      .send({ tier: 'dating_lite', subjectId: String(subject._id) });
    expect(res.status).toBe(403);
  });

  test('one open case per pair (dedup)', async () => {
    const requester = await plainUser();
    const subject = await verifiedSubject();
    await match(requester, subject);
    const first = await request(app).post('/api/verification-services/cases').set(auth(requester)).send({ tier: 'dating_lite', subjectId: String(subject._id) });
    expect(first.status).toBe(201);
    const second = await request(app).post('/api/verification-services/cases').set(auth(requester)).send({ tier: 'dating_lite', subjectId: String(subject._id) });
    expect(second.status).toBe(409);
  });
});

describe('money + consent lifecycle', () => {
  test('deny refunds the captured payment and declines the case', async () => {
    const requester = await plainUser();
    const subject = await verifiedSubject();
    await match(requester, subject);
    const create = await request(app).post('/api/verification-services/cases').set(auth(requester)).send({ tier: 'dating_lite', subjectId: String(subject._id) });
    const { case: { id }, order, payment } = create.body;
    await payAndConfirm(requester, id, order.orderId);
    expect((await Payment.findById(payment.id)).status).toBe('captured');

    const reqs = await request(app).get('/api/verification-services/consent-requests').set(auth(subject));
    const deny = await request(app).post(`/api/verification-services/consent-requests/${reqs.body.requests[0].id}/deny`).set(auth(subject));
    expect(deny.body.refunded).toBe(true);
    expect((await VerificationCase.findById(id)).status).toBe('declined');
    expect((await Payment.findById(payment.id)).status).toBe('refunded');
  });

  test('revoke AFTER completion freezes the report and does not refund', async () => {
    const requester = await plainUser();
    const subject = await verifiedSubject();
    await match(requester, subject);
    const create = await request(app).post('/api/verification-services/cases').set(auth(requester)).send({ tier: 'dating_lite', subjectId: String(subject._id) });
    const { case: { id }, order, payment } = create.body;
    await payAndConfirm(requester, id, order.orderId);
    const reqs = await request(app).get('/api/verification-services/consent-requests').set(auth(subject));
    const consentId = reqs.body.requests[0].id;
    await request(app).post(`/api/verification-services/consent-requests/${consentId}/grant`).set(auth(subject));
    expect((await VerificationCase.findById(id)).status).toBe('completed');

    const revoke = await request(app).post(`/api/verification-services/consent-requests/${consentId}/revoke`).set(auth(subject));
    expect(revoke.body.refunded).toBe(false);                    // already completed → no refund
    expect((await Payment.findById(payment.id)).status).toBe('captured');
    const view = await request(app).get(`/api/verification-services/cases/${id}`).set(auth(requester));
    expect(view.status).toBe(403);                               // report access withdrawn
  });

  test('confirm-payment before capture is rejected; amount is pinned server-side', async () => {
    const me = await verifiedSubject();
    const create = await request(app).post('/api/verification-services/cases').set(auth(me)).send({ tier: 'post_marital' });
    const { case: { id }, payment } = create.body;
    expect(payment.amountCHF).toBe(39);                          // pinned from the tier, not the client
    const early = await request(app).post(`/api/verification-services/cases/${id}/confirm-payment`).set(auth(me));
    expect(early.status).toBe(409);                              // not captured yet
  });
});

describe('review-hardening (money never stranded)', () => {
  test('a capture landing AFTER a decline is refunded, not stranded', async () => {
    const requester = await plainUser();
    const subject = await verifiedSubject();
    await match(requester, subject);
    const create = await request(app).post('/api/verification-services/cases').set(auth(requester)).send({ tier: 'dating_lite', subjectId: String(subject._id) });
    const { case: { id }, order, payment } = create.body;
    // subject denies while the payment is still 'created'
    const reqs = await request(app).get('/api/verification-services/consent-requests').set(auth(subject));
    await request(app).post(`/api/verification-services/consent-requests/${reqs.body.requests[0].id}/deny`).set(auth(subject));
    expect((await VerificationCase.findById(id)).status).toBe('declined');
    // payment captures late via the shared rail
    await request(app).post('/api/payment/verify').set(auth(requester)).send({ razorpay_order_id: order.orderId });
    expect((await Payment.findById(payment.id)).status).toBe('captured');
    // requester confirms → late charge reversed, clean declined state, no error
    const confirm = await request(app).post(`/api/verification-services/cases/${id}/confirm-payment`).set(auth(requester));
    expect(confirm.status).toBe(200);
    expect(confirm.body.case.status).toBe('declined');
    expect((await Payment.findById(payment.id)).status).toBe('refunded');
  });

  test('a subject deleted after granting → case refunded, never stuck in processing', async () => {
    const requester = await plainUser();
    const subject = await verifiedSubject();
    await match(requester, subject);
    const create = await request(app).post('/api/verification-services/cases').set(auth(requester)).send({ tier: 'dating_lite', subjectId: String(subject._id) });
    const { case: { id }, order, payment } = create.body;
    const reqs = await request(app).get('/api/verification-services/consent-requests').set(auth(subject));
    await request(app).post(`/api/verification-services/consent-requests/${reqs.body.requests[0].id}/grant`).set(auth(subject));
    expect((await VerificationCase.findById(id)).status).toBe('pending');   // not run (unpaid)
    await User.deleteOne({ _id: subject._id });                            // subject vanishes
    await request(app).post('/api/payment/verify').set(auth(requester)).send({ razorpay_order_id: order.orderId });
    const confirm = await request(app).post(`/api/verification-services/cases/${id}/confirm-payment`).set(auth(requester));
    expect(confirm.body.case.status).toBe('declined');
    expect((await Payment.findById(payment.id)).status).toBe('refunded');
  });

  test('nightly sweep refunds a paid case whose consent expired unactioned', async () => {
    const requester = await plainUser();
    const subject = await verifiedSubject();
    await match(requester, subject);
    const create = await request(app).post('/api/verification-services/cases').set(auth(requester)).send({ tier: 'dating_lite', subjectId: String(subject._id) });
    const { case: { id }, order, payment } = create.body;
    await request(app).post('/api/payment/verify').set(auth(requester)).send({ razorpay_order_id: order.orderId });
    await request(app).post(`/api/verification-services/cases/${id}/confirm-payment`).set(auth(requester));
    const kase = await VerificationCase.findById(id);
    expect(kase.status).toBe('pending');
    expect(kase.paid).toBe(true);
    await Consent.findByIdAndUpdate(kase.consentId, { expiresAt: new Date(Date.now() - 1000) }); // force expiry

    const r = await require('../src/services/verification-service').sweepStaleCases();
    expect(r.expired).toBeGreaterThanOrEqual(1);
    expect((await VerificationCase.findById(id)).status).toBe('declined');
    expect((await Payment.findById(payment.id)).status).toBe('refunded');
    expect((await Consent.findById(kase.consentId)).status).toBe('expired');
  });
});

describe('access control', () => {
  test('only the requester can view a case; the subject cannot', async () => {
    const requester = await plainUser();
    const subject = await verifiedSubject();
    await match(requester, subject);
    const create = await request(app).post('/api/verification-services/cases').set(auth(requester)).send({ tier: 'dating_lite', subjectId: String(subject._id) });
    const id = create.body.case.id;
    const asSubject = await request(app).get(`/api/verification-services/cases/${id}`).set(auth(subject));
    expect(asSubject.status).toBe(404);
  });
});

describe('honesty invariants', () => {
  test('a submitted document never becomes a verified identity fact', async () => {
    const me = await verifiedSubject({ verification: { selfieVerified: true, level: 'photo_verified' } }); // no ID badge
    // a clean small PNG document
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100', 'hex');
    const create = await request(app).post('/api/verification-services/cases').set(auth(me))
      .send({ tier: 'post_marital', documents: [{ base64: png.toString('base64'), filename: 'id.png' }] });
    const { case: { id }, order } = create.body;
    await payAndConfirm(me, id, order.orderId);
    const view = await request(app).get(`/api/verification-services/cases/${id}`).set(auth(me));
    const byName = Object.fromEntries(view.body.case.report.checks.map((c) => [c.name, c]));
    // identity is NOT verified (no ID badge); document_review never returns 'verified'
    expect(byName.identity_authenticity.status).toBe('unverified');
    expect(byName.document_review.status).not.toBe('verified');
  });
});
