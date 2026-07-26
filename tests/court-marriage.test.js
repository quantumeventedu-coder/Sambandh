// tests/court-marriage.test.js — the court-marriage assistant workflow.
// Covers the fail-closed state machine end-to-end: mutual-consent accept, vault-backed
// document checklist, the Special Marriage Act 30-day notice period, witness gate,
// solemnisation → certificate, plus isolation, dedup and the Hindu-Marriage path.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('./helpers/pg-db');            // must precede model/route requires

const { errorHandler } = require('../src/lib/errors');
const User = require('../src/models/User');
const CourtMarriageCase = require('../src/models/CourtMarriageCase');
const ref = require('../src/data/court-marriage');
const vault = require('../src/services/vault');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/court-marriage', require('../src/routes-court-marriage'));
app.use(errorHandler());

let seq = 8300000000;
const mkUser = () => User.create({ phone: '+91' + (seq++) });
const auth = (u) => ({ Authorization: 'Bearer ' + jwt.sign({ userId: String(u._id), phone: u.phone, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '30d' }) });
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100', 'hex');

const uploadDoc = (u) => vault.storeDocument({ ownerId: u._id, buf: PNG, label: 'doc', docType: 'other' });
const post = (u, id, path, body) => request(app).post(`/api/court-marriage/cases/${id}/${path}`).set(auth(u)).send(body || {});

/** Attach every mandatory document for the act (both partners for perPartner items). */
async function completeDocs(id, A, B, act) {
  for (const d of ref.REQUIRED_DOCUMENTS[act].filter((x) => !x.conditional)) {
    for (const u of (d.perPartner ? [A, B] : [A])) {
      const doc = await uploadDoc(u);
      await post(u, id, 'documents', { requirementKey: d.key, vaultDocumentId: String(doc._id) });
    }
  }
}

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('special marriage — full lifecycle', () => {
  test('propose → accept → docs → notice → clear → solemnize → certificate', async () => {
    const A = await mkUser(), B = await mkUser();
    const propose = await request(app).post('/api/court-marriage/cases').set(auth(A)).send({ partnerId: String(B._id), act: 'special_marriage' });
    expect(propose.status).toBe(201);
    const id = propose.body.case.id;
    expect(propose.body.case.status).toBe('proposed');

    // only the invited partner can accept
    expect((await post(A, id, 'accept')).status).toBe(403);
    expect((await post(B, id, 'accept')).body.case.status).toBe('active');

    // notice cannot be filed before the checklist is complete
    expect((await post(A, id, 'file-notice')).status).toBe(409);
    await completeDocs(id, A, B, 'special_marriage');
    expect((await request(app).get(`/api/court-marriage/cases/${id}`).set(auth(A))).body.case.progress.complete).toBe(true);

    expect((await post(A, id, 'file-notice')).body.case.status).toBe('notice_period');
    // cannot clear until the 30-day period elapses
    expect((await post(A, id, 'clear')).status).toBe(409);
    await CourtMarriageCase.findByIdAndUpdate(id, { noticePeriodEndsAt: new Date(Date.now() - 1000) });
    expect((await post(A, id, 'clear')).body.case.status).toBe('clear_to_solemnize');

    // solemnisation needs the statutory 3 witnesses
    expect((await post(A, id, 'solemnize')).status).toBe(409);
    for (const n of ['Asha', 'Bhola', 'Chandra']) await post(A, id, 'witnesses', { name: n });
    expect((await post(A, id, 'solemnize')).body.case.status).toBe('solemnized');

    const certDoc = await uploadDoc(A);
    const cert = await post(A, id, 'certificate', { vaultDocumentId: String(certDoc._id) });
    expect(cert.body.case.status).toBe('certificate_issued');
    expect(String(cert.body.case.certificateDocumentId)).toBe(String(certDoc._id));
  });

  test('an attached document is shared to the partner (they can read it)', async () => {
    const A = await mkUser(), B = await mkUser();
    const id = (await request(app).post('/api/court-marriage/cases').set(auth(A)).send({ partnerId: String(B._id), act: 'special_marriage' })).body.case.id;
    await post(B, id, 'accept');
    const doc = await uploadDoc(A);
    await post(A, id, 'documents', { requirementKey: 'dob_proof', vaultDocumentId: String(doc._id) });
    expect(await vault.canAccess(await require('../src/models/VaultDocument').findById(doc._id), B._id)).toBe(true);
  });
});

describe('access + consent', () => {
  test('a stranger cannot see the case', async () => {
    const A = await mkUser(), B = await mkUser(), C = await mkUser();
    const id = (await request(app).post('/api/court-marriage/cases').set(auth(A)).send({ partnerId: String(B._id), act: 'special_marriage' })).body.case.id;
    expect((await request(app).get(`/api/court-marriage/cases/${id}`).set(auth(C))).status).toBe(404);
  });

  test('partner can decline; one open case per pair', async () => {
    const A = await mkUser(), B = await mkUser();
    const first = await request(app).post('/api/court-marriage/cases').set(auth(A)).send({ partnerId: String(B._id), act: 'special_marriage' });
    const dup = await request(app).post('/api/court-marriage/cases').set(auth(A)).send({ partnerId: String(B._id), act: 'special_marriage' });
    expect(dup.status).toBe(409);
    expect((await post(B, first.body.case.id, 'decline')).body.case.status).toBe('declined');
    // after decline, a fresh proposal is allowed
    expect((await request(app).post('/api/court-marriage/cases').set(auth(A)).send({ partnerId: String(B._id), act: 'special_marriage' })).status).toBe(201);
  });
});

describe('hindu marriage — no statutory notice period', () => {
  test('propose → accept → docs → clear (no notice) → solemnize with 2 witnesses', async () => {
    const A = await mkUser(), B = await mkUser();
    const id = (await request(app).post('/api/court-marriage/cases').set(auth(A)).send({ partnerId: String(B._id), act: 'hindu_marriage' })).body.case.id;
    await post(B, id, 'accept');
    // a notice period does not apply
    expect((await post(A, id, 'file-notice')).status).toBe(409);
    await completeDocs(id, A, B, 'hindu_marriage');
    expect((await post(A, id, 'clear')).body.case.status).toBe('clear_to_solemnize');
    await post(A, id, 'witnesses', { name: 'W1' });
    await post(A, id, 'witnesses', { name: 'W2' });
    expect((await post(A, id, 'solemnize')).body.case.status).toBe('solemnized');
  });
});

describe('reference', () => {
  test('GET /requirements returns the checklist + disclaimer', async () => {
    const u = await mkUser();
    const res = await request(app).get('/api/court-marriage/requirements?act=special_marriage').set(auth(u));
    expect(res.status).toBe(200);
    expect(res.body.noticePeriodDays).toBe(30);
    expect(res.body.witnessesRequired).toBe(3);
    expect(res.body.disclaimer).toMatch(/not legal advice/i);
  });
});
