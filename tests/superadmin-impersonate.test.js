// tests/superadmin-impersonate.test.js — the owner "experience as" (impersonation).
// Mints a short-lived PREVIEW token per role; preview accounts are flagged and must
// NOT count toward the real dashboard numbers.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';
process.env.SUPER_ADMIN_KEY = 'test-super-key';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('./helpers/pg-db');            // must precede model/route requires

const superRouter = require('../src/routes-superadmin');
const { errorHandler } = require('../src/lib/errors');
const User = require('../src/models/User');
const Employee = require('../src/models/Employee');

const app = express();
app.use(express.json());
app.use('/api/superadmin', superRouter);
app.use(errorHandler());
const SK = { 'X-Super-Key': 'test-super-key' };
const imp = (as, h = SK) => request(app).post('/api/superadmin/impersonate').set(h).send({ as });

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('experience-as / impersonate', () => {
  test('as user → /app token for a flagged preview user (paid so it skips the gate)', async () => {
    const r = await imp('user');
    expect(r.status).toBe(200);
    expect(r.body.url).toBe('/app');
    expect(jwt.verify(r.body.token, process.env.JWT_SECRET).role).toBe('user');
    const u = await User.findOne({ email: 'preview-user@sambandh.local' });
    expect(u.preview).toBe(true);
    expect(u.membership.joinFeePaid).toBe(true);
  });

  test('as admin → token carries the admin role', async () => {
    const r = await imp('admin');
    expect(jwt.verify(r.body.token, process.env.JWT_SECRET).role).toBe('admin');
  });

  test('as developer → /developer.html staff token', async () => {
    const r = await imp('developer');
    expect(r.status).toBe(200);
    expect(r.body.url).toBe('/developer.html');
    const dec = jwt.verify(r.body.token, process.env.JWT_SECRET);
    expect(dec.kind).toBe('staff');
    const e = await Employee.findOne({ email: 'preview-developer@sambandh.local' });
    expect(e.preview).toBe(true);
    expect(e.scopes).toContain('prompt:run');
  });

  test('preview accounts are EXCLUDED from dashboard counts', async () => {
    await imp('user');   // only a preview user exists
    const r = await request(app).get('/api/superadmin/prelaunch').set(SK);
    expect(r.status).toBe(200);
    expect(r.body.registered).toBe(0);   // preview must not inflate "registered"
    expect(r.body.paid).toBe(0);
  });

  test('unknown role → 400; no super key → rejected', async () => {
    expect((await imp('wizard')).status).toBe(400);
    const r = await imp('user', {});
    expect([401, 403]).toContain(r.status);
  });
});
