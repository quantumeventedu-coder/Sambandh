// tests/developer-console.test.js — the internal STAFF console. Pins the security
// invariants: no account enumeration, staff-token-only (a dating-user JWT can't get
// in), scope-gated tools, super-admin roster bootstrap, a PII-safe support lookup,
// and 2FA on login.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';
process.env.SUPER_ADMIN_KEY = 'super-admin-key-16+chars-long';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('./helpers/pg-db');            // must precede model/route requires

const devRouter = require('../src/routes-developer');
const Employee = require('../src/models/Employee');
const User = require('../src/models/User');
const { currentTotp } = require('../src/services/twofa');

const app = express();
app.use(express.json());
app.use('/api/developer', devRouter);
const SUPER = { 'X-Super-Key': process.env.SUPER_ADMIN_KEY };

const base = '/api/developer';
async function createStaff(over = {}) {
  const r = await request(app).post(base + '/roster').set(SUPER).send({
    name: over.name || 'Asha Dev', email: over.email || 'asha@sambandh.online',
    department: over.department || 'engineering', role: over.role || 'software', level: over.level
  });
  return r;
}
const login = (email, password, extra = {}) => request(app).post(base + '/login').send({ email, password, ...extra });
const staffTok = (r) => ({ 'X-Staff-Token': r.body.token });

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('roster bootstrap (super-admin key)', () => {
  test('super key creates staff and returns a one-time temp password; never the hash', async () => {
    const r = await createStaff();
    expect(r.status).toBe(201);
    expect(typeof r.body.tempPassword).toBe('string');
    expect(r.body.tempPassword.length).toBeGreaterThanOrEqual(10);
    expect(JSON.stringify(r.body)).not.toMatch(/passwordHash/);
    expect(r.body.staff.scopes).toContain('ops:read');    // default scopes for 'software'
  });

  test('a normal request (no super key, no staff token) cannot touch the roster', async () => {
    const r = await request(app).get(base + '/roster');
    expect(r.status).toBe(401);
  });
});

describe('login + no enumeration', () => {
  test('valid temp password logs in and returns a staff token', async () => {
    const c = await createStaff();
    const r = await login('asha@sambandh.online', c.body.tempPassword);
    expect(r.status).toBe(200);
    expect(typeof r.body.token).toBe('string');
    expect(r.body.staff.email).toBe('asha@sambandh.online');
  });
  test('wrong password and unknown email both 401 (no enumeration)', async () => {
    await createStaff();
    const wrong = await login('asha@sambandh.online', 'nope');
    const unknown = await login('ghost@sambandh.online', 'nope');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toBe(unknown.body.error);
  });
});

describe('staff-token-only', () => {
  test('a dating-user JWT (kind != staff) is rejected', async () => {
    const userToken = jwt.sign({ userId: '650000000000000000000001', role: 'user' }, process.env.JWT_SECRET);
    const r = await request(app).get(base + '/me').set('X-Staff-Token', userToken);
    expect(r.status).toBe(401);
  });
  test('no token → 401', async () => {
    expect((await request(app).get(base + '/me')).status).toBe(401);
  });
});

describe('scope gating', () => {
  test("a 'software' engineer can read ops but NOT product metrics", async () => {
    const c = await createStaff();                       // software: ops/logs/flags/db, no metrics
    const s = await login('asha@sambandh.online', c.body.tempPassword);
    const ops = await request(app).get(base + '/ops/overview').set(staffTok(s));
    const metrics = await request(app).get(base + '/ops/metrics').set(staffTok(s));
    expect(ops.status).toBe(200);
    expect(metrics.status).toBe(403);
  });
});

describe('support lookup is PII-safe', () => {
  test('returns only minimal fields — never phone/email/birth data', async () => {
    const u = await User.create({ phone: '+919000000001', email: 'member@x.com', firstName: 'Riya', city: 'Pune', astrology: { birthDate: '1995-01-01' }, membership: { tier: 'base' } });
    const c = await createStaff({ email: 'sup@sambandh.online', department: 'support', role: 'customer_support' });
    // grant support:act explicitly (not a default scope)
    await request(app).patch(base + '/roster/' + c.body.staff.id).set(SUPER).send({ scopes: ['support:read', 'support:act'] });
    const s = await login('sup@sambandh.online', c.body.tempPassword);
    const r = await request(app).get(base + '/support/user/' + u._id).set(staffTok(s));
    expect(r.status).toBe(200);
    const blob = JSON.stringify(r.body);
    expect(blob).not.toMatch(/919000000001/);        // no phone
    expect(blob).not.toMatch(/member@x\.com/);        // no email
    expect(blob).not.toMatch(/1995-01-01/);           // no birth date
    expect(r.body.user.firstName).toBe('Riya');       // the allowed field
  });
});

describe('2FA on login', () => {
  test('once enabled, login demands the TOTP code', async () => {
    const c = await createStaff();
    const s = await login('asha@sambandh.online', c.body.tempPassword);
    await request(app).post(base + '/2fa/setup').set(staffTok(s)).send({});
    const emp = await Employee.findOne({ email: 'asha@sambandh.online' });
    const code = currentTotp(emp.security.totp.secret);
    const enabled = await request(app).post(base + '/2fa/enable').set(staffTok(s)).send({ totp: code });
    expect(enabled.status).toBe(200);
    expect(Array.isArray(enabled.body.backupCodes)).toBe(true);

    // now a password-only login is not enough
    const noCode = await login('asha@sambandh.online', c.body.tempPassword);
    expect(noCode.body.twoFactorRequired).toBe(true);
    const withCode = await login('asha@sambandh.online', c.body.tempPassword, { totp: currentTotp(emp.security.totp.secret) });
    expect(withCode.status).toBe(200);
    expect(typeof withCode.body.token).toBe('string');
  });
});
