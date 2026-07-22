// tests/auth-failopen.test.js — the OTP fail-open that let anyone take over any
// account. In production the login code must NEVER be returned in the response
// body, DEV_MODE must not switch on merely because Firebase is unset, and if no
// email delivery is configured the request must fail CLOSED (503), not silently
// pretend to send while echoing nothing / relaxing limits.

// Set BEFORE requiring routes-auth so IS_PROD / DEV_MODE resolve at module load.
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';
delete process.env.FIREBASE_PROJECT_ID;   // the old bug: absence → DEV_MODE=true
delete process.env.DEV_MODE;               // and no explicit opt-in either

const express = require('express');
const request = require('supertest');
const db = require('./helpers/pg-db');

jest.mock('../src/services/analytics', () => ({ track: jest.fn() }));
jest.mock('../src/services/events', () => ({ record: jest.fn(), stream: jest.fn(), behaviorFor: jest.fn() }));
// Control email-delivery configuration via env; never actually open a socket.
jest.mock('../src/services/notify', () => ({
  sendOtpEmail: jest.fn().mockResolvedValue(true),
  emailConfigured: () => !!(process.env.SMTP_URL || process.env.SMTP_HOST)
}));
const notify = require('../src/services/notify');

const authRouter = require('../src/routes-auth');
const app = express();
app.use(express.json());
app.use('/auth', authRouter);

beforeAll(db.start);
afterAll(db.stop);
afterEach(async () => { await db.clear(); delete process.env.SMTP_HOST; jest.clearAllMocks(); });

describe('production email OTP is never disclosed in the response', () => {
  test('with email delivery configured: 200, code emailed, but NOT echoed', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    const r = await request(app).post('/auth/request-otp').send({ email: 'victim@example.com' });
    expect(r.status).toBe(200);
    expect(r.body.devOtp).toBeUndefined();          // the critical assertion
    expect(r.body.devMode).toBe(false);
    expect(notify.sendOtpEmail).toHaveBeenCalledTimes(1);   // actually delivered, not echoed
  });

  test('with NO email delivery configured: fail closed (503), still no code', async () => {
    const r = await request(app).post('/auth/request-otp').send({ email: 'victim@example.com' });
    expect(r.status).toBe(503);
    expect(r.body.devOtp).toBeUndefined();
    expect(notify.sendOtpEmail).not.toHaveBeenCalled();
  });
});

describe('production does not fall into DEV_MODE when Firebase is unset', () => {
  test('phone request-otp does not echo a dev code', async () => {
    const r = await request(app).post('/auth/request-otp').send({ phone: '+919876543210' });
    expect(r.body.devOtp).toBeUndefined();          // DEV_MODE would have leaked it
    expect(r.body.devMode).not.toBe(true);
  });
});
