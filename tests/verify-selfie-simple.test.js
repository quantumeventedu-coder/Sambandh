// tests/verify-selfie-simple.test.js — with the liveness challenge OFF (LIVENESS_REQUIRED unset, the
// current default), POST /verification/selfie is SIMPLE FACE DETECTION: a valid client-detected face
// descriptor is approved, enrolled as the proven face, and set as the primary photo; a missing/invalid
// descriptor (no real face detected) is a clean 400 — never an approval of a blank frame.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';
delete process.env.LIVENESS_REQUIRED;              // default = simple mode

const express = require('express');
const request = require('supertest');
const db = require('./helpers/pg-db');

const UID = '64b7f9c2e1a4d5f6a7b8c9d0';
jest.mock('../src/routes-auth', () => ({
  requireAuth: (req, _res, next) => { req.userId = UID; req.role = 'user'; next(); },
  requireAdmin: (_req, _res, next) => next(),
  requireSuperAdmin: (_req, _res, next) => next(),
}));
jest.mock('../src/services/storage', () => ({
  uploadPrivate: jest.fn(async (key) => key),
  uploadToR2: jest.fn(async (key) => `https://cdn.test/${key}`),
  uploadFile: jest.fn(async (key) => `https://cdn.test/${key}`),
}));
jest.mock('../src/services/analytics', () => ({ track: jest.fn() }));

const User = require('../src/models/User');
const router = require('../src/routes-verification');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/verification', router);
app.use((err, _req, res, _next) => res.status(500).json({ error: String(err && err.message || err) }));

const VALID_FACE = Array(128).fill(0.12);          // a well-formed, non-zero 128-d descriptor
const TINY_JPEG_B64 = Buffer.from([0xFF, 0xD8, 0xFF, 0xD9]).toString('base64');

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

async function makeUser() {
  await User.create({ _id: UID, phone: '+919000000020', profile: { firstName: 'Sid', photos: [] }, verification: {} });
}

describe('POST /verification/selfie — simple face detection (liveness off)', () => {
  test('a valid detected face is approved, enrolled, and set as the primary photo — no challenge needed', async () => {
    await makeUser();
    const r = await request(app).post('/verification/selfie').send({ base64: TINY_JPEG_B64, faceDescriptor: VALID_FACE });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('approved');
    expect(r.body.photoSet).toBe(true);

    const u = await User.findById(UID);
    expect(u.verification.selfieVerified).toBe(true);
    expect(Array.isArray(u.faceDescriptor)).toBe(true);        // the detected face was enrolled
    expect(u.faceDescriptor.length).toBe(128);
    const primary = (u.profile.photos || []).find(p => p.isPrimary);
    expect(primary).toBeTruthy();
    expect(primary.fromSelfie).toBe(true);                     // selfie becomes the first profile photo
  });

  test('no face descriptor (no real face detected) → clean 400, never an approval', async () => {
    await makeUser();
    const r = await request(app).post('/verification/selfie').send({ base64: TINY_JPEG_B64 });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/no face detected/i);
    const u = await User.findById(UID);
    expect(u.verification.selfieVerified).toBeFalsy();         // not verified on a faceless frame
  });

  test('a malformed (too-short) descriptor → 400, not approved', async () => {
    await makeUser();
    const r = await request(app).post('/verification/selfie').send({ base64: TINY_JPEG_B64, faceDescriptor: [1, 2, 3] });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/no face detected/i);
  });
});
