// tests/vault.test.js — encrypted document vault.
// Verifies: AES-256-GCM round-trip + tamper detection, ciphertext-at-rest, upload
// AAV gate (malware/unsupported blocked), owner isolation, consent sharing +
// revoke + expiry, soft delete, and that metadata never leaks storageKey/enc.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('./helpers/pg-db');            // must precede model/route requires

const { errorHandler } = require('../src/lib/errors');
const User = require('../src/models/User');
const VaultDocument = require('../src/models/VaultDocument');
const vault = require('../src/services/vault');
const storage = require('../src/services/storage');

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use('/api/vault', require('../src/routes-vault'));
app.use(errorHandler());

let seq = 8200000000;
const mkUser = () => User.create({ phone: '+91' + (seq++) });
const auth = (u) => ({ Authorization: 'Bearer ' + jwt.sign({ userId: String(u._id), phone: u.phone, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '30d' }) });

// A minimal, valid PNG (magic 89 50 4E 47 …) — passes file-guard, stored fine.
const PNG_B64 = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100', 'hex').toString('base64');
// A Windows executable header — file-guard hard-fails this.
const EXE_B64 = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64, 0x90)]).toString('base64');

const upload = (u, body) => request(app).post('/api/vault/documents').set(auth(u)).send({ base64: PNG_B64, label: 'My ID', docType: 'id', ...body });

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('encryption', () => {
  test('AES-256-GCM round-trips; ciphertext differs; tamper is detected', () => {
    const plain = Buffer.from('secret passport bytes \x00\x01\x02');
    const { blob } = vault.encrypt(plain);
    expect(blob.equals(plain)).toBe(false);
    expect(blob.length).toBeGreaterThanOrEqual(28);
    expect(vault.decrypt(blob).equals(plain)).toBe(true);
    const tampered = Buffer.from(blob); tampered[tampered.length - 1] ^= 0xff;
    expect(() => vault.decrypt(tampered)).toThrow();               // GCM auth-tag fails
  });
});

describe('store + retrieve', () => {
  test('upload → content round-trips; bytes are ciphertext at rest; metadata hides internals', async () => {
    const me = await mkUser();
    const res = await upload(me);
    expect(res.status).toBe(201);
    const id = res.body.document.id;
    // metadata never exposes the storage pointer or key material
    expect(res.body.document.storageKey).toBeUndefined();
    expect(res.body.document.enc).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/storageKey|keyVersion|"enc"/);

    // content endpoint returns the ORIGINAL bytes
    const content = await request(app).get(`/api/vault/documents/${id}/content`).set(auth(me)).buffer(true).parse((r, cb) => { const chunks = []; r.on('data', (c) => chunks.push(c)); r.on('end', () => cb(null, Buffer.concat(chunks))); });
    expect(content.status).toBe(200);
    expect(Buffer.from(content.body).equals(Buffer.from(PNG_B64, 'base64'))).toBe(true);

    // at rest the stored blob is ciphertext, not the plaintext
    const doc = await VaultDocument.findById(id);
    const blob = await storage.readFile(doc.storageKey);
    expect(blob.equals(Buffer.from(PNG_B64, 'base64'))).toBe(false);
    expect(blob.length).toBeGreaterThanOrEqual(28);
  });

  test('a malicious / unsupported file is blocked at upload', async () => {
    const me = await mkUser();
    const res = await request(app).post('/api/vault/documents').set(auth(me)).send({ base64: EXE_B64, label: 'bad', docType: 'other' });
    expect(res.status).toBe(400);
    expect(await VaultDocument.countDocuments({ ownerId: me._id })).toBe(0);
  });
});

describe('access control', () => {
  test('a stranger cannot see metadata or content (404, not 403)', async () => {
    const me = await mkUser(), stranger = await mkUser();
    const id = (await upload(me)).body.document.id;
    expect((await request(app).get(`/api/vault/documents/${id}`).set(auth(stranger))).status).toBe(404);
    expect((await request(app).get(`/api/vault/documents/${id}/content`).set(auth(stranger))).status).toBe(404);
  });

  test('share grants read access; revoke removes it', async () => {
    const me = await mkUser(), friend = await mkUser();
    const id = (await upload(me)).body.document.id;
    const share = await request(app).post(`/api/vault/documents/${id}/share`).set(auth(me)).send({ granteeId: String(friend._id) });
    expect(share.status).toBe(201);
    expect((await request(app).get(`/api/vault/documents/${id}/content`).set(auth(friend))).status).toBe(200);
    // shared-with-me lists it
    const inbox = await request(app).get('/api/vault/shared-with-me').set(auth(friend));
    expect(inbox.body.documents.some((d) => d.id === id)).toBe(true);
    // revoke → access gone
    await request(app).post(`/api/vault/shares/${share.body.share.id}/revoke`).set(auth(me));
    expect((await request(app).get(`/api/vault/documents/${id}/content`).set(auth(friend))).status).toBe(404);
  });

  test('an expired share grants no access', async () => {
    const me = await mkUser(), friend = await mkUser();
    const id = (await upload(me)).body.document.id;
    await request(app).post(`/api/vault/documents/${id}/share`).set(auth(me)).send({ granteeId: String(friend._id), expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect((await request(app).get(`/api/vault/documents/${id}/content`).set(auth(friend))).status).toBe(404);
  });

  test('only the owner can share', async () => {
    const me = await mkUser(), friend = await mkUser(), other = await mkUser();
    const id = (await upload(me)).body.document.id;
    const bad = await request(app).post(`/api/vault/documents/${id}/share`).set(auth(friend)).send({ granteeId: String(other._id) });
    expect(bad.status).toBe(404);
  });
});

describe('deletion', () => {
  test('delete makes the document inaccessible and revokes shares', async () => {
    const me = await mkUser(), friend = await mkUser();
    const id = (await upload(me)).body.document.id;
    await request(app).post(`/api/vault/documents/${id}/share`).set(auth(me)).send({ granteeId: String(friend._id) });
    expect((await request(app).delete(`/api/vault/documents/${id}`).set(auth(me))).status).toBe(200);
    expect((await request(app).get(`/api/vault/documents/${id}/content`).set(auth(me))).status).toBe(404);
    expect((await request(app).get(`/api/vault/documents/${id}/content`).set(auth(friend))).status).toBe(404);
    expect((await VaultDocument.findById(id)).status).toBe('deleted');
  });
});
