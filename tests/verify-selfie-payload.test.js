// tests/verify-selfie-payload.test.js — POST /verification/selfie must reject a malformed `base64`
// (missing, or a truthy NON-string like a number/object) with a clean 400, never a raw 500. A non-string
// value passes a bare `!base64` check but then throws inside Buffer.from(base64,'base64'); the type guard
// stops it before that. Regression guard for the audit finding at routes-verification.js:185.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const express = require('express');
const request = require('supertest');

const UID = '64b7f9c2e1a4d5f6a7b8c9d0';
jest.mock('../src/routes-auth', () => ({
  requireAuth: (req, _res, next) => { req.userId = UID; req.role = 'user'; next(); },
  requireLaunched: (_req, _res, next) => next(),
  requireAdmin: (_req, _res, next) => next(),
  requireSuperAdmin: (_req, _res, next) => next(),
}));

const router = require('../src/routes-verification');
const app = express();
app.use(express.json());
app.use('/verification', router);
// Convert a thrown error into a 500 (mirrors the app's error middleware) so a regression shows as 500.
app.use((err, _req, res, _next) => res.status(500).json({ error: String(err && err.message || err) }));

describe('POST /verification/selfie — payload validation', () => {
  test('a numeric base64 is rejected with 400 (not a 500 from Buffer.from)', async () => {
    const r = await request(app).post('/verification/selfie').send({ base64: 12345 });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/required/i);
  });

  test('an object base64 is rejected with 400', async () => {
    const r = await request(app).post('/verification/selfie').send({ base64: { foo: 'bar' } });
    expect(r.status).toBe(400);
  });

  test('a missing base64 is rejected with 400', async () => {
    const r = await request(app).post('/verification/selfie').send({});
    expect(r.status).toBe(400);
  });
});
