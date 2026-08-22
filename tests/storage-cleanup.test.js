// tests/storage-cleanup.test.js — the super-admin storage reclaim: report + hard-delete stored
// verification-document ORIGINALS, keeping every verification record and verdict. Safe cleanup of the
// blobs left over from before ID/profession docs were analysed in memory.

process.env.SUPER_ADMIN_KEY = 'test-super-key';

const db = require('./helpers/pg-db');
const express = require('express');
const request = require('supertest');
const storage = require('../src/services/storage');
const Verification = require('../src/models/Verification');
const User = require('../src/models/User');
const router = require('../src/routes-superadmin');

const app = express();
app.use(express.json());
app.use('/superadmin', router);
const SK = { 'X-Super-Key': 'test-super-key' };

beforeAll(db.start);
afterAll(db.stop);
afterEach(async () => { await db.clear(); jest.clearAllMocks(); });

describe('super-admin storage reclaim', () => {
  test('reports stored blobs, hard-deletes them, and KEEPS the verdict', async () => {
    const u = await User.create({ phone: '+919000000020' });
    await Verification.create({ userId: u._id, type: 'id', status: 'approved', claim: { evidenceHash: 'h1' },
      documents: [{ type: 'passport', key: 'verification/x/id/y.jpg', private: true }] });
    const del = jest.spyOn(storage, 'deleteFile').mockResolvedValue(true);

    const rep = await request(app).get('/superadmin/storage-report').set(SK);
    expect(rep.status).toBe(200);
    expect(rep.body.storedDocumentBlobs).toBe(1);
    expect(rep.body.recordsHoldingStoredDocs).toBe(1);

    const r = await request(app).post('/superadmin/purge-verification-documents').set(SK).send({ confirm: true });
    expect(r.status).toBe(200);
    expect(r.body.deletedFiles).toBe(1);
    expect(del).toHaveBeenCalled();

    const v = await Verification.findOne({ userId: u._id });
    expect(v.documents.length).toBe(0);            // the raw blob doc is gone
    expect(v.status).toBe('approved');             // the verdict is kept
    expect(v.claim.evidenceHash).toBe('h1');       // and the evidence hash
  });

  test('a record with only value refs (link/number) is untouched', async () => {
    const u = await User.create({ phone: '+919000000021' });
    await Verification.create({ userId: u._id, type: 'profession', status: 'in_review', claim: {},
      documents: [{ type: 'registration_number', value: 'NMC-1', uploadedAt: new Date() }] });
    jest.spyOn(storage, 'deleteFile').mockResolvedValue(true);
    const r = await request(app).post('/superadmin/purge-verification-documents').set(SK).send({ confirm: true });
    expect(r.body.deletedFiles).toBe(0);
    const v = await Verification.findOne({ userId: u._id });
    expect(v.documents.length).toBe(1);            // value ref preserved
  });

  test('purge requires confirm:true, and the super key is required', async () => {
    expect((await request(app).post('/superadmin/purge-verification-documents').set(SK).send({})).status).toBe(400);
    expect((await request(app).get('/superadmin/storage-report')).status).toBeGreaterThanOrEqual(400);
  });
});
