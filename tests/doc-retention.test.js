// tests/doc-retention.test.js — the "auto-deleted after 30 days" promise, made real.
// Verifies the retention job HARD-DELETES stored document objects (cloud or local) and
// strips the URLs — not just the old local-only fs.unlink that never touched production.

const db = require('./helpers/pg-db');
const storage = require('../src/services/storage');
const Verification = require('../src/models/Verification');
const retention = require('../src/services/doc-retention');

beforeAll(db.start); afterAll(db.stop); afterEach(db.clear);
const uid = () => new (require('../src/db/odm').Types.ObjectId)();
const doc = (over = {}) => ({ type: 'passport', key: 'verification/u/id/a.jpg', private: true, uploadedAt: new Date(), ...over });

describe('keyOf — resolve the storage object key', () => {
  test('prefers the stored key, else parses the URL (Supabase public / local)', () => {
    expect(retention.keyOf({ key: 'verification/x/id/a.jpg' })).toBe('verification/x/id/a.jpg');
    expect(retention.keyOf({ url: 'https://p.supabase.co/storage/v1/object/public/uploads/verification/x/id/a.jpg' })).toBe('verification/x/id/a.jpg');
    expect(retention.keyOf({ url: '/uploads/verification/x/id/a.jpg' })).toBe('verification/x/id/a.jpg');
    expect(retention.keyOf({ value: 'digilocker_token' })).toBeNull();     // no file to delete
  });
});

describe('purgeExpiredDocuments', () => {
  test('deletes originals + clears URLs for EXPIRED verifications, leaves fresh ones', async () => {
    const spy = jest.spyOn(storage, 'deleteFile').mockResolvedValue(true);
    const u = uid();
    const expired = await Verification.create({ userId: u, type: 'id', status: 'approved', documents: [doc({ key: 'verification/u/id/OLD.jpg' })], expiresAt: new Date(Date.now() - 1000) });
    const fresh = await Verification.create({ userId: u, type: 'id', status: 'approved', documents: [doc({ key: 'verification/u/id/NEW.jpg' })], expiresAt: new Date(Date.now() + 1e9) });

    const res = await retention.purgeExpiredDocuments(new Date());
    expect(res).toEqual({ records: 1, files: 1 });
    expect(spy).toHaveBeenCalledWith('verification/u/id/OLD.jpg', { private: true });
    expect(spy).not.toHaveBeenCalledWith('verification/u/id/NEW.jpg', { private: true });

    const e = await Verification.findById(expired._id);
    expect(e.documents.length).toBe(0);              // URL/reference gone
    expect(e.documentsPurgedAt).toBeTruthy();
    expect((await Verification.findById(fresh._id)).documents.length).toBe(1);   // untouched
    spy.mockRestore();
  });

  test('idempotent — a second run finds nothing left to purge', async () => {
    const spy = jest.spyOn(storage, 'deleteFile').mockResolvedValue(true);
    await Verification.create({ userId: uid(), type: 'id', documents: [doc({ key: 'k' })], expiresAt: new Date(Date.now() - 1000) });
    await retention.purgeExpiredDocuments();
    expect((await retention.purgeExpiredDocuments()).records).toBe(0);
    spy.mockRestore();
  });
});

describe('purgeUserDocuments — account erasure removes the image files', () => {
  test('deletes every stored object for the user', async () => {
    const spy = jest.spyOn(storage, 'deleteFile').mockResolvedValue(true);
    const u = uid();
    await Verification.create({ userId: u, type: 'id', documents: [doc({ key: 'k1' })] });
    await Verification.create({ userId: u, type: 'selfie', documents: [doc({ type: 'selfie', key: 'k2' })] });
    const n = await retention.purgeUserDocuments(u);
    expect(n).toBe(2);
    expect(spy).toHaveBeenCalledWith('k1', { private: true });
    expect(spy).toHaveBeenCalledWith('k2', { private: true });
    spy.mockRestore();
  });
});
