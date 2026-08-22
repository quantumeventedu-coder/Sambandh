// tests/id-not-stored.test.js — the government-ID badge route ANALYSES the document in memory and
// NEVER stores it: no object-storage upload, no document key on the record — only the derived verdict +
// evidence hash. And it authenticates: authentic bytes + the ID's face matching the verified selfie face.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const express = require('express');
const request = require('supertest');
const db = require('./helpers/pg-db');

const UID = '64b7f9c2e1a4d5f6a7b8c9d0';
jest.mock('../src/routes-auth', () => ({
  requireAuth: (req, _res, next) => { req.userId = UID; next(); },
  requireAdmin: (req, _res, next) => next(),
  requireSuperAdmin: (req, _res, next) => next(),
}));
// Control the authenticity verdict so the test exercises the STORAGE + face-match behaviour, not the
// Trust Engine's byte analysis (covered by its own tests).
jest.mock('../src/services/trust', () => ({
  evaluateDocument: jest.fn(async () => ({ decision: 'secondary', hardFail: false, fileType: 'jpeg', score: 728, evidenceHash: 'deadbeef', signals: {}, c2pa: false })),
}));

const storage = require('../src/services/storage');
const User = require('../src/models/User');
const Verification = require('../src/models/Verification');
const router = require('../src/routes-verification');

const app = express();
app.use(express.json({ limit: '12mb' }));
app.use('/verification', router);

beforeAll(db.start);
afterAll(db.stop);
afterEach(async () => { await db.clear(); jest.clearAllMocks(); });

const ME = Array(128).fill(0.1);                 // the user's enrolled, verified selfie face
const tinyJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]).toString('base64');
const mkUser = () => User.create({ _id: UID, phone: '+919000000002', profile: { firstName: 'Asha', gender: 'female', country: 'IN', age: 30 }, faceDescriptor: ME, verification: { selfieVerified: true } });
const postId = (idFaceDescriptor) => request(app).post('/verification/id').send({ method: 'upload', idType: 'passport', document: { base64: tinyJpeg, filename: 'id.jpg' }, idFaceDescriptor });

describe('ID badge: analyse in memory, never store the document', () => {
  test('authentic ID whose face matches the selfie → approved, and the image is NEVER stored', async () => {
    await mkUser();
    const up = jest.spyOn(storage, 'uploadPrivate');
    const r = await postId(ME);
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('approved');
    expect(up).not.toHaveBeenCalled();                              // the ID image is never uploaded to storage
    const v = await Verification.findOne({ userId: UID, type: 'id' });
    expect(v.documents.length).toBe(0);                             // no stored document key on the record
    expect(v.claim.evidenceHash).toBe('deadbeef');                  // only the derived hash is kept
    expect((await User.findById(UID)).verification.idVerified).toBe(true);
  });

  test('a DIFFERENT face on the ID → rejected, and still nothing is stored', async () => {
    await mkUser();
    const up = jest.spyOn(storage, 'uploadPrivate');
    const r = await postId(Array(128).fill(0.9));                    // a stranger's face
    expect(r.body.status).toBe('rejected');
    expect(up).not.toHaveBeenCalled();
    expect((await User.findById(UID)).verification.idVerified).toBeFalsy();
  });
});
