// tests/auth-password.test.js — the primary auth path: register + login + logout.
//
// This is how nearly every user actually gets in, and none of it was tested.
// Invariants pinned here:
//   · the password is never stored in readable form (bcrypt only)
//   · a wrong password and an unknown account are indistinguishable — same status,
//     same message, AND the same amount of bcrypt work (no enumeration oracle)
//   · duplicate accounts are refused
//   · logout actually ends the session (token blacklisted)

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const express = require('express');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Analytics/events must not touch a real store during auth tests.
jest.mock('../src/services/analytics', () => ({ track: jest.fn() }));
jest.mock('../src/services/events', () => ({ record: jest.fn(), stream: jest.fn(), behaviorFor: jest.fn() }));

const authRouter = require('../src/routes-auth');
const User = require('../src/models/User');

const app = express();
app.use(express.json());
app.use('/auth', authRouter);
app.get('/whoami', authRouter.requireAuth, (req, res) => res.json({ userId: req.userId }));

let mem;
beforeAll(async () => { mem = await MongoMemoryServer.create(); await mongoose.connect(mem.getUri('authpw-test')); });
afterAll(async () => { await mongoose.disconnect(); await mem.stop(); });
afterEach(async () => { await User.deleteMany({}); jest.clearAllMocks(); });

const reg = (over = {}) => request(app).post('/auth/register')
  .send({ email: 'a@example.com', password: 'correct-horse-battery', ...over });

describe('register', () => {
  test('creates the account and returns a token', async () => {
    const r = await reg();
    expect(r.status).toBe(200);
    expect(typeof r.body.token).toBe('string');
    expect(r.body.user.email).toBe('a@example.com');
  });

  test('the password is stored ONLY as a bcrypt hash', async () => {
    await reg({ password: 'correct-horse-battery' });
    const u = await User.findOne({ email: 'a@example.com' }).lean();
    const blob = JSON.stringify(u);
    expect(blob).not.toContain('correct-horse-battery');       // never in readable form, anywhere
    expect(u.passwordHash).toMatch(/^\$2[aby]\$/);             // a real bcrypt hash
    expect(await bcrypt.compare('correct-horse-battery', u.passwordHash)).toBe(true);
  });

  test('the email is normalised to lowercase', async () => {
    await reg({ email: 'MiXeD@Example.COM' });
    expect(await User.findOne({ email: 'mixed@example.com' })).toBeTruthy();
  });

  test('a duplicate email is refused with 409', async () => {
    await reg();
    const r = await reg();
    expect(r.status).toBe(409);
    expect(await User.countDocuments({})).toBe(1);
  });

  test('a duplicate email differing only in case is still refused', async () => {
    await reg({ email: 'dupe@example.com' });
    const r = await reg({ email: 'DUPE@example.com' });
    expect(r.status).toBe(409);
  });

  test.each([
    ['a password under 8 chars', { password: 'short' }],
    ['a malformed email', { email: 'not-an-email' }],
    ['neither email nor username', { email: undefined, password: 'correct-horse-battery' }]
  ])('rejects %s with 400 and creates nothing', async (_label, over) => {
    const r = await reg(over);
    expect(r.status).toBe(400);
    expect(await User.countDocuments({})).toBe(0);
  });

  test('a new account starts unpaid, unverified and not banned', async () => {
    await reg();
    const u = await User.findOne({ email: 'a@example.com' }).lean();
    expect(u.membership.joinFeePaid).toBe(false);
    expect(u.membership.tier).toBe('free');
    expect(u.status.banned).toBe(false);
    expect(u.verification.level).toBe('phone_only');
  });
});

describe('login', () => {
  test('the correct password is accepted', async () => {
    await reg();
    const r = await request(app).post('/auth/login')
      .send({ identifier: 'a@example.com', password: 'correct-horse-battery' });
    expect(r.status).toBe(200);
    expect(typeof r.body.token).toBe('string');
  });

  test('the identifier is case-insensitive', async () => {
    await reg();
    const r = await request(app).post('/auth/login')
      .send({ identifier: 'A@Example.COM', password: 'correct-horse-battery' });
    expect(r.status).toBe(200);
  });

  test('a wrong password is refused', async () => {
    await reg();
    const r = await request(app).post('/auth/login')
      .send({ identifier: 'a@example.com', password: 'wrong-password-here' });
    expect(r.status).toBe(401);
  });

  // Enumeration: the two failure modes must be indistinguishable.
  test('an unknown account and a wrong password give the IDENTICAL response', async () => {
    await reg();
    const wrong = await request(app).post('/auth/login')
      .send({ identifier: 'a@example.com', password: 'wrong-password-here' });
    const unknown = await request(app).post('/auth/login')
      .send({ identifier: 'nobody@example.com', password: 'wrong-password-here' });
    expect(unknown.status).toBe(wrong.status);
    expect(unknown.body).toEqual(wrong.body);       // same message — no "no such user"
  });

  // The fix this locks: login used to skip bcrypt entirely for unknown accounts,
  // so it answered measurably faster — revealing which emails are registered.
  test('an unknown account still performs a bcrypt compare (no timing oracle)', async () => {
    const spy = jest.spyOn(bcrypt, 'compare');
    await request(app).post('/auth/login')
      .send({ identifier: 'definitely-nobody@example.com', password: 'whatever-here' });
    expect(spy).toHaveBeenCalledTimes(1);           // work is done even with no user
    spy.mockRestore();
  });

  test('an account with no password set cannot be logged into with any password', async () => {
    await User.create({ email: 'oauth-only@example.com', createdAt: new Date() });   // e.g. Google-only
    const r = await request(app).post('/auth/login')
      .send({ identifier: 'oauth-only@example.com', password: 'anything-at-all' });
    expect(r.status).toBe(401);
  });

  test('a missing password is rejected as a bad request', async () => {
    const r = await request(app).post('/auth/login').send({ identifier: 'a@example.com' });
    expect(r.status).toBe(400);
  });
});

describe('logout ends the session', () => {
  test('the token stops working after logout', async () => {
    const token = (await reg()).body.token;
    expect((await request(app).get('/whoami').set('Authorization', 'Bearer ' + token)).status).toBe(200);

    const out = await request(app).post('/auth/logout').set('Authorization', 'Bearer ' + token);
    expect(out.status).toBe(200);

    const after = await request(app).get('/whoami').set('Authorization', 'Bearer ' + token);
    expect(after.status).toBe(401);                 // blacklisted
  });
});
