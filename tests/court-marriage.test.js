// tests/court-marriage.test.js — the court-marriage assistant workflow.
// Covers the fail-closed state machine end-to-end plus the security-review fixes:
// mutual-match/block gate, server-anchored (un-backdatable) notice clock, cooldown,
// and shares revoked when a case is cancelled.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('./helpers/pg-db');            // must precede model/route requires

const { errorHandler } = require('../src/lib/errors');
const User = require('../src/models/User');
const Chat = require('../src/models/Chat');
const CourtMarriageCase = require('../src/models/CourtMarriageCase');
const VaultDocument = require('../src/models/VaultDocument');
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

const match = (a, b) => Chat.create({ participants: [a._id, b._id], status: 'active' });
async function pair() { const a = await mkUser(), b = await mkUser(); await match(a, b); return [a, b]; }
const propose = (u, partner, act) => request(app).post('/api/court-marriage/cases').set(auth(u)).send({ partnerId: String(partner._id), act: act || 'special_marriage' });
const post = (u, id, path, body) => request(app).post(`/api/court-marriage/cases/${id}/${path}`).set(auth(u)).send(body || {});
const uploadDoc = (u) => vault.storeDocument({ ownerId: u._id, buf: PNG, label: 'doc', docType: 'other' });

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
    const [A, B] = await pair();
    const p = await propose(A, B, 'special_marriage');
    expect(p.status).toBe(201);
    const id = p.body.case.id;

    expect((await post(A, id, 'accept')).status).toBe(403);          // only the invited partner
    expect((await post(B, id, 'accept')).body.case.status).toBe('active');

    expect((await post(A, id, 'file-notice')).status).toBe(409);     // not before docs complete
    await completeDocs(id, A, B, 'special_marriage');
    expect((await post(A, id, 'file-notice')).body.case.status).toBe('notice_period');

    expect((await post(A, id, 'clear')).status).toBe(409);           // 30 days not elapsed
    await CourtMarriageCase.findByIdAndUpdate(id, { noticePeriodEndsAt: new Date(Date.now() - 1000) });
    expect((await post(A, id, 'clear')).body.case.status).toBe('clear_to_solemnize');

    expect((await post(A, id, 'solemnize')).status).toBe(409);       // needs 3 witnesses
    for (const n of ['Asha', 'Bhola', 'Chandra']) await post(A, id, 'witnesses', { name: n });
    expect((await post(A, id, 'solemnize')).body.case.status).toBe('solemnized');

    const certDoc = await uploadDoc(A);
    expect((await post(A, id, 'certificate', { vaultDocumentId: String(certDoc._id) })).body.case.status).toBe('certificate_issued');
  });
});

describe('security-review fixes', () => {
  test('a court marriage can be proposed only to an active mutual match', async () => {
    const A = await mkUser(), B = await mkUser();                    // NOT matched
    expect((await propose(A, B)).status).toBe(403);
  });

  test('a blocked partner cannot be proposed to', async () => {
    const [A, B] = await pair();
    await User.findByIdAndUpdate(B._id, { blockedUsers: [A._id] });
    expect((await propose(A, B)).status).toBe(403);
  });

  test('the notice clock is server-anchored — a client filedAt cannot shorten it', async () => {
    const [A, B] = await pair();
    const id = (await propose(A, B, 'special_marriage')).body.case.id;
    await post(B, id, 'accept');
    await completeDocs(id, A, B, 'special_marriage');
    await post(A, id, 'file-notice', { filedAt: '2000-01-01' });     // attempt to backdate
    const kase = await CourtMarriageCase.findById(id);
    expect(new Date(kase.noticePeriodEndsAt).getTime()).toBeGreaterThan(Date.now() + 25 * 86400000); // ~30d out
    expect((await post(A, id, 'clear')).status).toBe(409);           // genuinely not elapsed
  });

  test('cancelling a case revokes the document shares it created', async () => {
    const [A, B] = await pair();
    const id = (await propose(A, B)).body.case.id;
    await post(B, id, 'accept');
    const doc = await uploadDoc(A);
    await post(A, id, 'documents', { requirementKey: 'dob_proof', vaultDocumentId: String(doc._id) });
    expect(await vault.userCanReadDoc(await VaultDocument.findById(doc._id), B._id)).toBe(true);
    await post(A, id, 'cancel');
    expect(await vault.userCanReadDoc(await VaultDocument.findById(doc._id), B._id)).toBe(false);
  });

  test('decline; then a cooldown blocks an immediate re-proposal', async () => {
    const [A, B] = await pair();
    const first = await propose(A, B);
    expect((await propose(A, B)).status).toBe(409);                  // one open per pair
    expect((await post(B, first.body.case.id, 'decline')).body.case.status).toBe('declined');
    expect((await propose(A, B)).status).toBe(409);                  // cooldown after decline
  });
});

describe('access + reference', () => {
  test('a stranger cannot see the case', async () => {
    const [A, B] = await pair();
    const C = await mkUser();
    const id = (await propose(A, B)).body.case.id;
    expect((await request(app).get(`/api/court-marriage/cases/${id}`).set(auth(C))).status).toBe(404);
  });

  test('hindu marriage: no notice period; solemnise with 2 witnesses', async () => {
    const [A, B] = await pair();
    const id = (await propose(A, B, 'hindu_marriage')).body.case.id;
    await post(B, id, 'accept');
    expect((await post(A, id, 'file-notice')).status).toBe(409);     // no notice period applies
    await completeDocs(id, A, B, 'hindu_marriage');
    expect((await post(A, id, 'clear')).body.case.status).toBe('clear_to_solemnize');
    await post(A, id, 'witnesses', { name: 'W1' });
    await post(A, id, 'witnesses', { name: 'W2' });
    expect((await post(A, id, 'solemnize')).body.case.status).toBe('solemnized');
  });

  test('GET /requirements returns the checklist + disclaimer', async () => {
    const u = await mkUser();
    const res = await request(app).get('/api/court-marriage/requirements?act=special_marriage').set(auth(u));
    expect(res.body.noticePeriodDays).toBe(30);
    expect(res.body.witnessesRequired).toBe(3);
    expect(res.body.disclaimer).toMatch(/not legal advice/i);
  });
});
