// tests/dpdp-lifecycle.test.js — India DPDP Act 2023 data-lifecycle guarantees,
// exercised against REAL Postgres (pglite): the two rights that must actually work
// end-to-end —
//   • Right to access / portability  → GET /api/me/data-export
//   • Right to erasure               → POST /api/auth/delete-account (30-day grace)
// The load-bearing assertion is the ISOLATION one: a user's export must contain
// THEIR data and never another member's private records.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('./helpers/pg-db');            // must precede model/route requires

const authRouter = require('../src/routes-auth');
const meRouter = require('../src/routes-me');
const User = require('../src/models/User');
const Claim = require('../src/models/Claim');
const Notification = require('../src/models/Notification');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/me', meRouter);

const token = (id) => 'Bearer ' + jwt.sign({ userId: String(id), role: 'user' }, process.env.JWT_SECRET, { expiresIn: '1d' });
let seq = 6000000000;
const mkUser = (over = {}) => User.create({ phone: '+91' + (seq++), intent: ['dating'], ...over });

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('right to access — data export (DPDP §11)', () => {
  test('returns the requester’s own account plus their related records', async () => {
    const u = await mkUser({ email: 'asha@example.com', astrology: { birthDate: '1992-04-10' } });
    await Claim.create({ userId: u._id, chatId: u._id, type: 'identity', statement: 'i am a teacher', strength: 'moderate' });
    await Notification.create({ userId: u._id, type: 'system', title: 'hi', body: 'welcome' });

    const r = await request(app).get('/api/me/data-export').set('Authorization', token(u._id));
    expect(r.status).toBe(200);
    // portable, machine-readable, and attachment-dispositioned
    expect(r.headers['content-disposition']).toMatch(/attachment.*\.json/);
    expect(String(r.body.account._id)).toBe(String(u._id));
    expect(r.body.account.email).toBe('asha@example.com');   // the USER's own PII is included (it's theirs)
    expect(r.body.claims).toHaveLength(1);
    expect(r.body.notifications).toHaveLength(1);
    // every declared section is present (completeness — no silent omissions)
    for (const k of ['account', 'chats', 'messagesSent', 'karmaBook', 'claims', 'payments', 'verifications', 'notifications']) {
      expect(r.body).toHaveProperty(k);
    }
  });

  test('ISOLATION: one member’s export never leaks another member’s private records', async () => {
    const asha = await mkUser({ email: 'asha@example.com' });
    const bhavesh = await mkUser({ email: 'bhavesh@example.com' });
    await Claim.create({ userId: bhavesh._id, chatId: bhavesh._id, type: 'identity', statement: 'bhavesh secret', strength: 'moderate' });
    await Notification.create({ userId: bhavesh._id, type: 'system', title: 'private', body: 'for bhavesh only' });

    const r = await request(app).get('/api/me/data-export').set('Authorization', token(asha._id));
    expect(r.status).toBe(200);
    expect(r.body.claims).toHaveLength(0);              // none of Bhavesh's claims
    expect(r.body.notifications).toHaveLength(0);
    const blob = JSON.stringify(r.body);
    expect(blob).not.toContain('bhavesh secret');
    expect(blob).not.toContain('bhavesh@example.com');  // no other member's email anywhere in the file
  });

  test('export requires authentication', async () => {
    const r = await request(app).get('/api/me/data-export');
    expect(r.status).toBe(401);
  });
});

describe('right to erasure — delete account with 30-day grace (DPDP §12)', () => {
  test('delete queues erasure: sets deletedAt and deactivates, but keeps the grace window', async () => {
    const u = await mkUser();
    const r = await request(app).post('/api/auth/delete-account').set('Authorization', token(u._id));
    expect(r.status).toBe(200);
    expect(r.body.message).toMatch(/30 days/);

    const after = await User.findById(u._id);
    expect(after.status.active).toBe(false);
    expect(after.status.deletedAt).toBeTruthy();
    // within grace the record still exists (recoverable) — erasure is queued, not instant
    const within = Date.now() - new Date(after.status.deletedAt).getTime();
    expect(within).toBeLessThan(30 * 86400000);
  });

  test('erasure requires authentication (nobody can delete another account)', async () => {
    const r = await request(app).post('/api/auth/delete-account');
    expect(r.status).toBe(401);
  });

  test('a deleted account past the grace window is locked out at login', async () => {
    // Simulate a deletion 31 days ago — beyond recovery.
    const u = await mkUser({ username: 'oldacct', status: { active: false, deletedAt: new Date(Date.now() - 31 * 86400000) } });
    const passwordHash = require('bcryptjs').hashSync('correct-horse-battery', 10);
    await User.findByIdAndUpdate(u._id, { passwordHash });

    const r = await request(app).post('/api/auth/login').send({ identifier: 'oldacct', password: 'correct-horse-battery' });
    expect(r.status).toBe(403);
    expect(r.body.error).toMatch(/deleted/i);
  });

  test('a deletion within grace is CANCELLED by logging back in (recovery)', async () => {
    const u = await mkUser({ username: 'revive', status: { active: false, deletedAt: new Date(Date.now() - 2 * 86400000) } });
    const passwordHash = require('bcryptjs').hashSync('correct-horse-battery', 10);
    await User.findByIdAndUpdate(u._id, { passwordHash });

    const r = await request(app).post('/api/auth/login').send({ identifier: 'revive', password: 'correct-horse-battery' });
    expect(r.status).toBe(200);
    const after = await User.findById(u._id);
    expect(after.status.active).toBe(true);
    expect(after.status.deletedAt == null).toBe(true);   // deletion reversed
  });
});
