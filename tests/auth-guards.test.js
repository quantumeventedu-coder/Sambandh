// tests/auth-guards.test.js — the authorisation boundary.
//
// routes-auth.js was at 0% coverage: nothing tested who is allowed through the
// door. The most important invariant in the whole product lives here —
//
//   NON-NEGOTIABLE: moderators can NEVER read chat content. Only SUPER_ADMIN_KEY
//   opens super-admin routes. requireSuperAdmin must reject the admin key.
//
// Every test asserts a specific allow/deny, and the allow-path tests prove the
// guards are discriminating rather than simply refusing everything.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';
process.env.SUPER_ADMIN_KEY = 'super-key-9f2c1a77b4e6d3aa';
process.env.ADMIN_API_KEY = 'admin-key-1c4e7b90a2f5d8bb';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const authRouter = require('../src/routes-auth');
const { requireAuth, requireAdmin, requireSuperAdmin } = authRouter;
const TokenBlacklist = require('../src/models/TokenBlacklist');

const app = express();
app.use(express.json());
app.get('/user', requireAuth, (req, res) => res.json({ userId: req.userId, role: req.role }));
app.get('/admin', requireAdmin, (req, res) => res.json({ userId: req.userId, role: req.role }));
app.get('/super', requireSuperAdmin, (req, res) => res.json({ userId: req.userId, role: req.role }));

const USER_ID = '64b7f9c2e1a4d5f6a7b8c9d0';
const sign = (over = {}, opts = {}) => jwt.sign(
  { userId: USER_ID, phone: '+919000000001', role: 'user', ...over },
  process.env.JWT_SECRET, { expiresIn: '30d', ...opts }
);
const bearer = t => ['Authorization', 'Bearer ' + t];

let mem;
beforeAll(async () => { mem = await MongoMemoryServer.create(); await mongoose.connect(mem.getUri('auth-test')); });
afterAll(async () => { await mongoose.disconnect(); await mem.stop(); });
afterEach(async () => { await TokenBlacklist.deleteMany({}); });

describe('requireAuth', () => {
  test('a valid token is accepted and identifies the user', async () => {
    const r = await request(app).get('/user').set(...bearer(sign()));
    expect(r.status).toBe(200);
    expect(r.body.userId).toBe(USER_ID);
  });

  test('no token → 401', async () => {
    const r = await request(app).get('/user');
    expect(r.status).toBe(401);
    expect(r.body.error).toMatch(/missing token/i);
  });

  test('a garbage token → 401', async () => {
    const r = await request(app).get('/user').set(...bearer('not.a.jwt'));
    expect(r.status).toBe(401);
  });

  // Forgery: a token signed with the attacker's own secret must not be trusted.
  test('a token signed with a DIFFERENT secret → 401', async () => {
    const forged = jwt.sign({ userId: USER_ID, role: 'admin' }, 'attacker-secret', { expiresIn: '30d' });
    const r = await request(app).get('/user').set(...bearer(forged));
    expect(r.status).toBe(401);
  });

  test('an expired token → 401', async () => {
    const r = await request(app).get('/user').set(...bearer(sign({}, { expiresIn: '-1s' })));
    expect(r.status).toBe(401);
  });

  test('"none" algorithm forgery → 401', async () => {
    const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
      + '.' + Buffer.from(JSON.stringify({ userId: USER_ID, role: 'admin' })).toString('base64url') + '.';
    const r = await request(app).get('/user').set(...bearer(none));
    expect(r.status).toBe(401);
  });

  test('a blacklisted (logged-out) token → 401', async () => {
    const token = sign();
    await TokenBlacklist.create({
      tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 30 * 86400000)     // schema requires it (TTL cleanup)
    });
    const r = await request(app).get('/user').set(...bearer(token));
    expect(r.status).toBe(401);
    expect(r.body.error).toMatch(/session ended/i);
  });
});

describe('requireSuperAdmin — the privacy boundary', () => {
  test('the correct super key is accepted', async () => {
    const r = await request(app).get('/super').set('X-Super-Key', process.env.SUPER_ADMIN_KEY);
    expect(r.status).toBe(200);
    expect(r.body.role).toBe('super_admin');
  });

  // THE non-negotiable: a moderator must never reach chat content.
  test('the ADMIN key does NOT open super-admin routes', async () => {
    const r = await request(app).get('/super').set('X-Super-Key', process.env.ADMIN_API_KEY);
    expect(r.status).toBe(401);
  });

  test('the admin key in its own header does not open super-admin routes either', async () => {
    const r = await request(app).get('/super').set('X-Admin-Key', process.env.ADMIN_API_KEY);
    expect(r.status).toBe(401);
  });

  test('a user token with role=admin does NOT open super-admin routes', async () => {
    const r = await request(app).get('/super').set(...bearer(sign({ role: 'admin' })));
    expect(r.status).toBe(401);
  });

  test('no key → 401', async () => {
    expect((await request(app).get('/super')).status).toBe(401);
  });

  test('a wrong key → 401', async () => {
    const r = await request(app).get('/super').set('X-Super-Key', 'super-key-9f2c1a77b4e6d3ab'); // 1 char off
    expect(r.status).toBe(401);
  });

  // Fail closed: if the secret is not configured, nothing may authenticate.
  test('when SUPER_ADMIN_KEY is unset, every request is rejected', async () => {
    const saved = process.env.SUPER_ADMIN_KEY;
    delete process.env.SUPER_ADMIN_KEY;
    try {
      expect((await request(app).get('/super')).status).toBe(401);
      // An attacker sending a literal "undefined" must not slip through.
      expect((await request(app).get('/super').set('X-Super-Key', 'undefined')).status).toBe(401);
    } finally { process.env.SUPER_ADMIN_KEY = saved; }
  });
});

describe('requireAdmin', () => {
  test('the admin key is accepted', async () => {
    const r = await request(app).get('/admin').set('X-Admin-Key', process.env.ADMIN_API_KEY);
    expect(r.status).toBe(200);
    expect(r.body.role).toBe('admin');
  });

  test('the super key also passes admin routes (full access includes admin)', async () => {
    const r = await request(app).get('/admin').set('X-Super-Key', process.env.SUPER_ADMIN_KEY);
    expect(r.status).toBe(200);
    expect(r.body.role).toBe('super_admin');
  });

  test('a moderator token is accepted', async () => {
    const r = await request(app).get('/admin').set(...bearer(sign({ role: 'moderator' })));
    expect(r.status).toBe(200);
  });

  test('an ordinary user token is refused (403, authenticated but not authorised)', async () => {
    const r = await request(app).get('/admin').set(...bearer(sign({ role: 'user' })));
    expect(r.status).toBe(403);
  });

  test('no credentials → 401', async () => {
    expect((await request(app).get('/admin')).status).toBe(401);
  });

  test('a wrong admin key falls through to token auth and is refused', async () => {
    const r = await request(app).get('/admin').set('X-Admin-Key', 'nope');
    expect(r.status).toBe(401);
  });

  test('when ADMIN_API_KEY is unset, the key path cannot authenticate', async () => {
    const saved = process.env.ADMIN_API_KEY;
    delete process.env.ADMIN_API_KEY;
    try {
      expect((await request(app).get('/admin').set('X-Admin-Key', 'undefined')).status).toBe(401);
    } finally { process.env.ADMIN_API_KEY = saved; }
  });
});
