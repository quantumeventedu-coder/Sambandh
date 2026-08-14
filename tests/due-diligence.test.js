// tests/due-diligence.test.js — consent-gated, subject-curated trust dossier.
// Covers: mutual-match gate, subject grant → active, subject-shared vault document
// readable by the requester, dossier compilation, and revoke cutting off both the
// dossier and every document share.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('./helpers/pg-db');            // must precede model/route requires

const { errorHandler } = require('../src/lib/errors');
const User = require('../src/models/User');
const Chat = require('../src/models/Chat');
const VaultDocument = require('../src/models/VaultDocument');
const vault = require('../src/services/vault');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/due-diligence', require('../src/routes-due-diligence'));
app.use(errorHandler());

let seq = 8400000000;
const auth = (u) => ({ Authorization: 'Bearer ' + jwt.sign({ userId: String(u._id), phone: u.phone, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '30d' }) });
const verifiedSubject = () => User.create({ phone: '+91' + (seq++), verification: { idVerified: true, selfieVerified: true, level: 'id_verified' }, profile: { photos: [{ isPrimary: true, fromSelfie: true }] }, claims: {} });
const plainUser = () => User.create({ phone: '+91' + (seq++), verification: {}, profile: {}, claims: {} });
const match = (a, b) => Chat.create({ participants: [a._id, b._id], status: 'active' });
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100', 'hex');

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('dossier lifecycle', () => {
  test('request → grant → subject shares doc → requester sees dossier → revoke cuts off', async () => {
    const requester = await plainUser(), subject = await verifiedSubject();
    await match(requester, subject);

    const req = await request(app).post('/api/due-diligence/cases').set(auth(requester)).send({ subjectId: String(subject._id) });
    expect(req.status).toBe(201);
    const id = req.body.case.id;

    // requester can't view before consent
    expect((await request(app).get(`/api/due-diligence/cases/${id}`).set(auth(requester))).status).toBe(403);
    // only the subject can grant
    expect((await request(app).post(`/api/due-diligence/cases/${id}/grant`).set(auth(requester))).status).toBe(403);
    expect((await request(app).post(`/api/due-diligence/cases/${id}/grant`).set(auth(subject))).body.case.status).toBe('active');

    // subject shares one of their vault documents
    const doc = await vault.storeDocument({ ownerId: subject._id, buf: PNG, label: 'passport', docType: 'passport' });
    await request(app).post(`/api/due-diligence/cases/${id}/documents`).set(auth(subject)).send({ vaultDocumentId: String(doc._id) });
    expect(await vault.userCanReadDoc(await VaultDocument.findById(doc._id), requester._id)).toBe(true);

    // requester now sees a compiled dossier: verification + the shared document
    const view = await request(app).get(`/api/due-diligence/cases/${id}`).set(auth(requester));
    expect(view.status).toBe(200);
    expect(view.body.dossier.verification.verifiedLevel).toBe('basic');   // identity verified (first-party fact)
    expect(view.body.dossier.documents.some((d) => String(d.id) === String(doc._id))).toBe(true);
    expect(view.body.dossier.disclaimer).toMatch(/not a background check/i);

    // subject revokes → dossier gone AND the document share is revoked
    expect((await request(app).post(`/api/due-diligence/cases/${id}/revoke`).set(auth(subject))).body.case.status).toBe('revoked');
    expect((await request(app).get(`/api/due-diligence/cases/${id}`).set(auth(requester))).status).toBe(403);
    expect(await vault.userCanReadDoc(await VaultDocument.findById(doc._id), requester._id)).toBe(false);
  });
});

describe('gates', () => {
  test('a dossier can be requested only from an active mutual match', async () => {
    const requester = await plainUser(), stranger = await verifiedSubject();  // no shared chat
    expect((await request(app).post('/api/due-diligence/cases').set(auth(requester)).send({ subjectId: String(stranger._id) })).status).toBe(403);
  });

  test('one open dossier per pair; deny closes it; cooldown blocks immediate re-request', async () => {
    const requester = await plainUser(), subject = await verifiedSubject();
    await match(requester, subject);
    const first = await request(app).post('/api/due-diligence/cases').set(auth(requester)).send({ subjectId: String(subject._id) });
    expect(first.status).toBe(201);
    expect((await request(app).post('/api/due-diligence/cases').set(auth(requester)).send({ subjectId: String(subject._id) })).status).toBe(409);
    expect((await request(app).post(`/api/due-diligence/cases/${first.body.case.id}/deny`).set(auth(subject))).body.case.status).toBe('declined');
    // a post-decline cooldown blocks immediate re-requesting the same person (anti-pester)
    expect((await request(app).post('/api/due-diligence/cases').set(auth(requester)).send({ subjectId: String(subject._id) })).status).toBe(409);
  });

  test('blocking the requester after a grant cuts off the dossier', async () => {
    const requester = await plainUser(), subject = await verifiedSubject();
    await match(requester, subject);
    const id = (await request(app).post('/api/due-diligence/cases').set(auth(requester)).send({ subjectId: String(subject._id) })).body.case.id;
    await request(app).post(`/api/due-diligence/cases/${id}/grant`).set(auth(subject));
    expect((await request(app).get(`/api/due-diligence/cases/${id}`).set(auth(requester))).status).toBe(200);
    await User.findByIdAndUpdate(subject._id, { blockedUsers: [requester._id] });   // subject blocks
    expect((await request(app).get(`/api/due-diligence/cases/${id}`).set(auth(requester))).status).toBe(403);
  });
});
