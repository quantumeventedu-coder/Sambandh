// tests/profile-photos-preserve.test.js — editing photos must NOT wipe the existing gallery. The edit
// UI can only send newly-picked files, so the server must carry over the photos already on the profile.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const express = require('express');
const request = require('supertest');
const db = require('./helpers/pg-db');
jest.mock('../src/services/analytics', () => ({ track: jest.fn() }));
jest.mock('../src/services/events', () => ({ record: jest.fn(), stream: jest.fn(), behaviorFor: jest.fn() }));
// Storage must not hit the network — return a deterministic URL per upload. (mock-prefixed so jest
// allows the factory to reference it.)
let mockUp = 0;
jest.mock('../src/services/storage', () => ({
  uploadToR2: jest.fn(async () => `https://cdn.test/new_${mockUp++}.jpg`),
  uploadPrivate: jest.fn(async () => 'k'), UPLOADS_ROOT: '/tmp',
}));

const authRouter = require('../src/routes-auth');
const User = require('../src/models/User');

const app = express();
app.use(express.json({ limit: '12mb' }));
app.use('/auth', authRouter);

beforeAll(db.start);
afterAll(db.stop);
afterEach(async () => { await db.clear(); jest.clearAllMocks(); mockUp = 0; });

const tiny = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]).toString('base64');

test('adding one photo preserves the existing gallery (no silent wipe)', async () => {
  const reg = await request(app).post('/auth/register').send({ email: 'p@example.com', password: 'correct-horse-battery' });
  const token = reg.body.token;
  // Seed an existing gallery: verified selfie + two uploaded photos.
  const u = await User.findOne({ email: 'p@example.com' });
  await User.findByIdAndUpdate(u._id, { 'profile.photos': [
    { url: 'https://cdn.test/selfie.jpg', isPrimary: true, fromSelfie: true, uploadedAt: new Date() },
    { url: 'https://cdn.test/A.jpg', isPrimary: false, uploadedAt: new Date() },
    { url: 'https://cdn.test/B.jpg', isPrimary: false, uploadedAt: new Date() },
  ] });

  // The edit UI PATCHes ONLY the newly-picked file.
  const r = await request(app).patch('/auth/profile').set('Authorization', 'Bearer ' + token)
    .send({ photos: [{ base64: tiny, filename: 'new.jpg' }] });
  expect(r.status).toBe(200);

  const after = (await User.findOne({ email: 'p@example.com' })).profile.photos;
  const urls = after.map(p => p.url);
  expect(urls).toContain('https://cdn.test/selfie.jpg');   // selfie kept, still primary
  expect(urls).toContain('https://cdn.test/A.jpg');        // existing gallery preserved
  expect(urls).toContain('https://cdn.test/B.jpg');
  expect(after.some(p => p.url.startsWith('https://cdn.test/new_'))).toBe(true);  // new one added
  expect(after.find(p => p.fromSelfie).isPrimary).toBe(true);
});
