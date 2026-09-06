// tests/verify-selfie-storage-resilient.test.js — a verification must NEVER 500 because image storage
// failed. Storing the selfie (private bucket, for admin review) and the profile photo (public bucket) are
// both secondary to the decision; if the bucket is misconfigured/unreachable, the user must still be
// verified. Regression guard for the "server error during verification, both methods, multiple users"
// incident, where uploadPrivate threw BEFORE the decision and 500'd every attempt.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';
delete process.env.LIVENESS_REQUIRED;

const express = require('express');
const request = require('supertest');
const db = require('./helpers/pg-db');

const UID = '64b7f9c2e1a4d5f6a7b8c9d0';
jest.mock('../src/routes-auth', () => ({
  requireAuth: (req, _res, next) => { req.userId = UID; req.role = 'user'; next(); },
  requireAdmin: (_req, _res, next) => next(),
  requireSuperAdmin: (_req, _res, next) => next(),
}));
// Storage is DOWN: both the private-doc and public-photo uploads throw.
jest.mock('../src/services/storage', () => ({
  uploadPrivate: jest.fn(async () => { throw new Error('Supabase Storage upload failed (400): bucket not found'); }),
  uploadToR2: jest.fn(async () => { throw new Error('Supabase Storage upload failed (400): bucket not found'); }),
  uploadFile: jest.fn(async () => { throw new Error('Supabase Storage upload failed (400): bucket not found'); }),
}));
jest.mock('../src/services/analytics', () => ({ track: jest.fn() }));

const User = require('../src/models/User');
const router = require('../src/routes-verification');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/verification', router);
app.use((err, _req, res, _next) => res.status(500).json({ error: String(err && err.message || err) }));

const VALID_FACE = Array(128).fill(0.12);
const TINY_JPEG_B64 = Buffer.from([0xFF, 0xD8, 0xFF, 0xD9]).toString('base64');

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('POST /verification/selfie — resilient to storage failure', () => {
  test('a valid face is still APPROVED and enrolled when BOTH uploads throw — never a 500', async () => {
    await User.create({ _id: UID, phone: '+919000000030', profile: { firstName: 'Sid', photos: [] }, verification: {} });
    const r = await request(app).post('/verification/selfie').send({ base64: TINY_JPEG_B64, faceDescriptor: VALID_FACE });

    expect(r.status).toBe(200);                       // NOT 500 — storage failure must not block verification
    expect(r.body.status).toBe('approved');

    const u = await User.findById(UID);
    expect(u.verification.selfieVerified).toBe(true); // verified despite storage being down
    expect(Array.isArray(u.faceDescriptor)).toBe(true);
    expect(u.faceDescriptor.length).toBe(128);        // face still enrolled (for the duplicate scan)
  });
});
