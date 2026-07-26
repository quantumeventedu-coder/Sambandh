// tests/partner-kyb.test.js — staff partner authentication (KYB) management.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';
process.env.SUPER_ADMIN_KEY = 'test-super-key';

const express = require('express');
const request = require('supertest');
const db = require('./helpers/pg-db');            // must precede model/route requires

const { errorHandler } = require('../src/lib/errors');
const Partner = require('../src/models/Partner');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/marketplace', require('../src/routes-marketplace'));
app.use(errorHandler());
const SK = { 'X-Super-Key': 'test-super-key' };

const PNG_B64 = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100', 'hex').toString('base64');
const EXE_B64 = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64, 0x90)]).toString('base64');

const createPartner = (over) => request(app).post('/api/marketplace/partners').set(SK).send({
  name: 'Astro Guru', category: 'astrologer', type: 'organization', legalName: 'Astro Guru Pvt Ltd',
  registration: { kind: 'gst', number: '22AAAAA0000A1Z5' },
  contactPerson: { name: 'R. Sharma', email: 'r@astro.in', phone: '+919000000000' },
  city: 'Pune', ...over
});

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('KYB partner authentication', () => {
  test('create captures the KYB fields; partner starts unverified', async () => {
    const res = await createPartner();
    expect(res.status).toBe(201);
    const p = res.body.partner;
    expect(p.type).toBe('organization');
    expect(p.legalName).toBe('Astro Guru Pvt Ltd');
    expect(p.registration.kind).toBe('gst');
    expect(p.verification.status).toBe('unverified');
    expect(p.verified).toBe(false);
  });

  test('a document is AAV-scanned, stored (encrypted), and moves the partner to pending', async () => {
    const id = (await createPartner()).body.partner.id;
    const up = await request(app).post(`/api/marketplace/partners/${id}/documents`).set(SK).send({ type: 'gst_certificate', base64: PNG_B64, filename: 'gst.png' });
    expect(up.status).toBe(201);
    const detail = await request(app).get(`/api/marketplace/partners/${id}`).set(SK);
    expect(detail.body.partner.verification.status).toBe('pending');
    expect(detail.body.partner.documents.length).toBe(1);
    // metadata only — never the raw storage key or bytes
    expect(JSON.stringify(detail.body)).not.toMatch(/storageKey|keyVersion/);
    // and the encrypted document round-trips through the staff content endpoint
    const content = await request(app).get(`/api/marketplace/partners/${id}/documents/0/content`).set(SK).buffer(true).parse((r, cb) => { const c = []; r.on('data', (d) => c.push(d)); r.on('end', () => cb(null, Buffer.concat(c))); });
    expect(Buffer.from(content.body).equals(Buffer.from(PNG_B64, 'base64'))).toBe(true);
  });

  test('a malicious document is rejected and not stored', async () => {
    const id = (await createPartner()).body.partner.id;
    const up = await request(app).post(`/api/marketplace/partners/${id}/documents`).set(SK).send({ type: 'other', base64: EXE_B64, filename: 'x.exe' });
    expect(up.status).toBe(400);
    expect((await Partner.findById(id)).documents.length).toBe(0);
  });

  test('verify sets the trust badge + a named reviewer; reject records the reason', async () => {
    const id = (await createPartner()).body.partner.id;
    const v = await request(app).post(`/api/marketplace/partners/${id}/verify`).set(SK).send({ notes: 'GST confirmed' });
    expect(v.body.partner.verified).toBe(true);
    expect(v.body.partner.verification.status).toBe('verified');
    expect(v.body.partner.verification.reviewedBy).toBeTruthy();

    const r = await request(app).post(`/api/marketplace/partners/${id}/reject`).set(SK).send({ reason: 'Docs mismatch' });
    expect(r.body.partner.verified).toBe(false);
    expect(r.body.partner.verification.status).toBe('rejected');
    expect(r.body.partner.verification.notes).toBe('Docs mismatch');
    expect((await request(app).post(`/api/marketplace/partners/${id}/reject`).set(SK).send({})).status).toBe(400); // reason required
  });

  test('suspend deactivates the partner; edit updates KYB fields', async () => {
    const id = (await createPartner()).body.partner.id;
    const s = await request(app).patch(`/api/marketplace/partners/${id}`).set(SK).send({ suspended: true, suspendReason: 'complaint' });
    expect(s.body.partner.suspended).toBe(true);
    expect(s.body.partner.active).toBe(false);
    const e = await request(app).patch(`/api/marketplace/partners/${id}`).set(SK).send({ legalName: 'New Legal Name', registration: { kind: 'cin', number: 'U12345' } });
    expect(e.body.partner.legalName).toBe('New Legal Name');
    expect(e.body.partner.registration.kind).toBe('cin');
  });

  test('reactivating a suspended partner clears the suspension (coupled flags)', async () => {
    const id = (await createPartner()).body.partner.id;
    await request(app).patch(`/api/marketplace/partners/${id}`).set(SK).send({ suspended: true, suspendReason: 'x' });
    const r = await request(app).patch(`/api/marketplace/partners/${id}`).set(SK).send({ active: true });
    expect(r.body.partner.active).toBe(true);
    expect(r.body.partner.suspended).toBe(false);
  });

  test('a new document during re-review drops the verified badge', async () => {
    const id = (await createPartner()).body.partner.id;
    await request(app).post(`/api/marketplace/partners/${id}/verify`).set(SK).send({});
    expect((await request(app).get(`/api/marketplace/partners/${id}`).set(SK)).body.partner.verified).toBe(true);
    await request(app).post(`/api/marketplace/partners/${id}/documents`).set(SK).send({ type: 'other', base64: PNG_B64, filename: 'x.png' });
    const d = (await request(app).get(`/api/marketplace/partners/${id}`).set(SK)).body.partner;
    expect(d.verified).toBe(false);
    expect(d.verification.status).toBe('pending');
  });

  test('editing one contact subfield preserves the others; an invalid email is rejected', async () => {
    const id = (await createPartner()).body.partner.id;   // seeds contactPerson.name 'R. Sharma'
    await request(app).patch(`/api/marketplace/partners/${id}`).set(SK).send({ contactPerson: { phone: '+919111111111' } });
    const p = (await request(app).get(`/api/marketplace/partners/${id}`).set(SK)).body.partner;
    expect(p.contactPerson.phone).toBe('+919111111111');
    expect(p.contactPerson.name).toBe('R. Sharma');       // preserved, not wiped
    expect((await request(app).patch(`/api/marketplace/partners/${id}`).set(SK).send({ contactPerson: { email: 'not-an-email' } })).status).toBe(400);
  });

  test('the staff endpoints reject an unauthenticated request', async () => {
    expect((await request(app).get('/api/marketplace/partners')).status).toBe(401);
    expect((await request(app).post('/api/marketplace/partners').send({ name: 'x', category: 'gift' })).status).toBe(401);
  });
});
