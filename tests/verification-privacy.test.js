// tests/verification-privacy.test.js — verification documents live in a PRIVATE bucket (no
// public URL); admins view them via a short-lived signed URL.

const express = require('express');
const request = require('supertest');
const db = require('./helpers/pg-db');

jest.mock('../src/routes-auth', () => ({
  requireAuth: (req, _res, next) => next(),
  requireAdmin: (req, _res, next) => next(),
  requireSuperAdmin: (req, _res, next) => next(),
}));

const storage = require('../src/services/storage');
const adminRouter = require('../src/routes-superadmin');
const Verification = require('../src/models/Verification');

const app = express();
app.use(express.json());
app.use('/superadmin', adminRouter);

beforeAll(db.start); afterAll(db.stop); afterEach(db.clear);
const uid = () => new (require('../src/db/odm').Types.ObjectId)();

describe('private storage', () => {
  test('uploadPrivate returns a KEY (never a public URL); signedUrl + private delete work', async () => {
    const key = await storage.uploadPrivate('verification/x/id/secret.jpg', Buffer.from('img'), 'image/jpeg');
    expect(key).toBe('verification/x/id/secret.jpg');       // a bucket key, NOT a public URL
    expect(String(key)).not.toMatch(/\/public\//);
    const signed = await storage.signedUrl(key, 60);
    expect(typeof signed).toBe('string');                   // a viewable, short-lived link/path
    expect(await storage.deleteFile(key, { private: true })).toBe(true);
  });
});

describe('GET /superadmin/verifications/:id/doc/:index', () => {
  test('returns a signed URL for a private doc, and 410 once it has been purged', async () => {
    const v = await Verification.create({ userId: uid(), type: 'id', status: 'approved', documents: [{ type: 'passport', key: 'verification/x/id/a.jpg', private: true, uploadedAt: new Date() }] });
    const r = await request(app).get('/superadmin/verifications/' + v._id + '/doc/0');
    expect(r.status).toBe(200);
    expect(r.body.private).toBe(true);
    expect(r.body.url).toBeTruthy();

    const purged = await Verification.create({ userId: uid(), type: 'id', documents: [{ type: 'passport', uploadedAt: new Date() }] }); // key/url stripped by retention
    expect((await request(app).get('/superadmin/verifications/' + purged._id + '/doc/0')).status).toBe(410);
  });
});
