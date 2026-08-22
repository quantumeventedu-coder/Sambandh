// tests/profession-not-stored.test.js — the profession route analyses the proof document in memory and
// NEVER stores it, authenticates it (Trust Engine) + confirms it names the employer, and NEVER
// auto-approves a regulated profession on an unchecked registration number (fail-closed → in_review).

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
jest.mock('../src/services/trust', () => ({
  evaluateDocument: jest.fn(async () => ({ decision: 'secondary', hardFail: false, fileType: 'jpeg', score: 728, evidenceHash: 'profhash', signals: {}, c2pa: false })),
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

const tinyJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]).toString('base64');
const mkUser = () => User.create({ _id: UID, phone: '+919000000012', profile: { firstName: 'Sid', gender: 'male', country: 'IN', age: 30 } });

describe('profession verification: analyse in memory, never store; registry fail-closed', () => {
  test('an authentic document naming the employer → approved, and the image is NEVER stored', async () => {
    await mkUser();
    const up = jest.spyOn(storage, 'uploadPrivate');
    const r = await request(app).post('/verification/profession').send({
      category: 'engineer', title: 'Engineer', company: 'Infosys',
      documents: [{ type: 'offer_letter', base64: tinyJpeg, filename: 'offer.jpg' }],
      ocrText: 'OFFER LETTER — Infosys Limited is pleased to offer you the role of Software Engineer.',
    });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('approved');
    expect(up).not.toHaveBeenCalled();                              // proof document never uploaded
    const v = await Verification.findOne({ userId: UID, type: 'profession' });
    expect(v.documents.length).toBe(0);                             // no stored document key
    expect(v.claim.evidenceHash).toBe('profhash');
    expect((await User.findById(UID)).claims.profession.verified).toBe(true);
  });

  test('a document that does NOT name the employer → rejected, nothing stored', async () => {
    await mkUser();
    const up = jest.spyOn(storage, 'uploadPrivate');
    const r = await request(app).post('/verification/profession').send({
      category: 'engineer', title: 'Engineer', company: 'Infosys',
      documents: [{ type: 'offer_letter', base64: tinyJpeg, filename: 'offer.jpg' }],
      ocrText: 'A letter that never mentions the employer.',
    });
    expect(r.body.status).toBe('rejected');
    expect(up).not.toHaveBeenCalled();
    expect((await User.findById(UID)).claims?.profession?.verified).toBeFalsy();
  });

  test('a regulated profession + registration number is NOT auto-approved (fail-closed → in_review)', async () => {
    await mkUser();
    const r = await request(app).post('/verification/profession').send({
      category: 'doctor', title: 'Physician', company: 'AIIMS', registrationNumber: 'NMC-999999',
    });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('in_review');                        // never a free instant fake credential
    expect((await User.findById(UID)).claims?.profession?.verified).toBeFalsy();
  });
});
