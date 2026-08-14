// tests/audit-fixes.test.js — proves the fixes for the confirmed audit findings:
//  • DPDP erasure destroys the vault (Aadhaar/passport/PAN), not just verification docs.
//  • a karma_escalation payment is single-use (atomic claim), never double-spent.
//  • a BANNED account is rejected at requireAuth — the session ends immediately, everywhere.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('./helpers/pg-db');
const User = require('../src/models/User');
const Payment = require('../src/models/Payment');

let seq = 9700000000;
const mkUser = (over = {}) => User.create({ phone: '+91' + (seq++), ...over });
const atomicUpdate = (/** @type {any} */ M, /** @type {any} */ f, /** @type {any} */ u) => M.atomicUpdate(f, u);

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('DPDP erasure destroys the vault', () => {
  test('eraseUser deletes the user’s VaultDocument + VaultShare rows (no recoverable identity docs)', async () => {
    const VaultDocument = require('../src/models/VaultDocument');
    const VaultShare = require('../src/models/VaultShare');
    const { eraseUser } = require('../src/services/account-erasure');
    const u = await mkUser(), other = await mkUser();
    const doc = await VaultDocument.create({ ownerId: u._id, label: 'Aadhaar', docType: 'aadhaar', storageKey: 'vault/x/y.enc' });
    await VaultShare.create({ documentId: doc._id, ownerId: u._id, granteeId: other._id, status: 'active' });
    expect(await VaultDocument.countDocuments({ ownerId: u._id })).toBe(1);
    await eraseUser(u._id);
    expect(await VaultDocument.countDocuments({ ownerId: u._id })).toBe(0);   // the sensitive doc is gone
    expect(await VaultShare.countDocuments({ ownerId: u._id })).toBe(0);      // and its shares
  });
});

describe('DPDP erasure is COMPLETE (no recoverable PII survives)', () => {
  test('erasure redacts consultation + community content, drops memberships, and deletes vault blobs from the PUBLIC bucket', async () => {
    const SessionMessage = require('../src/models/SessionMessage');
    const RoomMessage = require('../src/models/RoomMessage');
    const RoomMember = require('../src/models/RoomMember');
    const VaultDocument = require('../src/models/VaultDocument');
    const storage = require('../src/services/storage');
    const { eraseUser } = require('../src/services/account-erasure');
    const mongoose = require('../src/db/odm');

    const u = await mkUser();
    const sessionId = new mongoose.Types.ObjectId();
    const roomId = new mongoose.Types.ObjectId();
    await SessionMessage.create({ sessionId, from: u._id, text: 'my number is 98xxxxxxx' });
    await RoomMessage.create({ roomId, userId: u._id, handle: 'anon-7', text: 'hello room' });
    await RoomMember.create({ roomId, userId: u._id, handle: 'anon-7' });
    await VaultDocument.create({ ownerId: u._id, label: 'Aadhaar', docType: 'aadhaar', storageKey: 'vault/x/y.enc' });

    // The blob must be deleted from the bucket the vault WROTE to (public) — never with { private: true }.
    const del = jest.spyOn(storage, 'deleteFile').mockResolvedValue(true);
    await eraseUser(u._id);

    const vaultDeletes = del.mock.calls.filter(c => String(c[0]).startsWith('vault/'));
    expect(vaultDeletes.length).toBeGreaterThan(0);
    expect(vaultDeletes.every(c => !(c[1] && c[1].private))).toBe(true);   // NOT the private bucket
    del.mockRestore();

    // Consultation message content is gone (but the thread row stays for the consultant).
    const sm = await SessionMessage.findOne({ sessionId });
    expect(sm.text).toBe('[deleted]');
    // Community post is redacted AND un-linked from the user (userId/handle nulled → no re-attribution).
    const rm = await RoomMessage.findOne({ roomId });
    expect(rm.text).toBe('[deleted]');
    expect(rm.userId == null).toBe(true);
    // Membership is dropped outright.
    expect(await RoomMember.countDocuments({ userId: u._id })).toBe(0);
  });
});

describe('karma escalation payment is single-use', () => {
  test('a captured karma_escalation payment consumes exactly once — a second atomic claim fails', async () => {
    const u = await mkUser();
    const pay = await Payment.create({ userId: u._id, purpose: 'karma_escalation', status: 'captured', amountCHF: 5 });
    const first = await atomicUpdate(Payment, { _id: pay._id, escalationUsed: false }, { $set: { escalationUsed: true } });
    expect(first).toBeTruthy();                                               // one request wins the claim
    const second = await atomicUpdate(Payment, { _id: pay._id, escalationUsed: false }, { $set: { escalationUsed: true } });
    expect(second).toBeFalsy();                                               // the concurrent/duplicate loses → no double-use
  });
});

describe('liveness challenge is single-use (replay-safe)', () => {
  test('the atomic consume succeeds once; a replay of the same challenge fails', async () => {
    const LivenessChallenge = require('../src/models/LivenessChallenge');
    const u = await mkUser();
    const ch = await LivenessChallenge.create({ userId: u._id, actions: ['blink', 'turn_left'], status: 'pending', issuedAt: new Date() });
    const first = await atomicUpdate(LivenessChallenge, { _id: ch._id, userId: u._id, status: 'pending' }, { $set: { status: 'consumed', consumedAt: new Date() } });
    expect(first).toBeTruthy();                                               // the genuine submission wins
    const replay = await atomicUpdate(LivenessChallenge, { _id: ch._id, userId: u._id, status: 'pending' }, { $set: { status: 'consumed' } });
    expect(replay).toBeFalsy();                                               // a captured/replayed challenge is refused
  });
});

describe('banned account is blocked at requireAuth', () => {
  test('a banned user’s existing token is rejected (403), an active user passes', async () => {
    const { requireAuth } = require('../src/routes-auth');
    const app = express();
    app.get('/whoami', requireAuth, (_req, res) => res.json({ ok: true }));
    const active = await mkUser();
    const banned = await mkUser({ status: { banned: true, active: false } });
    const bearer = (u) => 'Bearer ' + jwt.sign({ userId: String(u._id), phone: u.phone, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '30d' });
    expect((await request(app).get('/whoami').set('Authorization', bearer(active))).status).toBe(200);
    expect((await request(app).get('/whoami').set('Authorization', bearer(banned))).status).toBe(403);
  });
});
