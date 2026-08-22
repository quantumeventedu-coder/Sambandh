// tests/dup-face-self-exclude.test.js — the duplicate-face scan MUST exclude the caller's own account.
// A user re-verifying matches their OWN saved descriptor; if scanForDuplicateFace doesn't exclude self
// (a real pg-odm `$ne` risk), every already-enrolled user would be auto-flagged as ban-evasion. It must
// also still catch the SAME face on a DIFFERENT account.

const db = require('./helpers/pg-db');
const User = require('../src/models/User');
const { scanForDuplicateFace } = require('../src/services/face-engine');

const FACE_A = Array(128).fill(0.12);
const FACE_B = Array(128).fill(0.80);   // far from A (distance ≫ 0.55)
const A = '64b7f9c2e1a4d5f6a7b80001';
const B = '64b7f9c2e1a4d5f6a7b80002';

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('scanForDuplicateFace self-exclusion', () => {
  test('a user re-scanning their OWN face is NOT a duplicate of themselves', async () => {
    await User.create({ _id: A, phone: '+919000000001', faceDescriptor: FACE_A });
    const hits = await scanForDuplicateFace(A, FACE_A);   // same user, same face
    expect(hits).toEqual([]);                             // self must be excluded → no false ban-evasion flag
  });

  test('the SAME face on a DIFFERENT account is still caught', async () => {
    await User.create({ _id: A, phone: '+919000000001', faceDescriptor: FACE_A });
    const hits = await scanForDuplicateFace(B, FACE_A);   // B submits A's face
    expect(hits.length).toBe(1);
    expect(String(hits[0].userId)).toBe(A);
    expect(hits[0].distance).toBeLessThan(0.55);
  });

  test('a genuinely different face on another account is NOT flagged', async () => {
    await User.create({ _id: A, phone: '+919000000001', faceDescriptor: FACE_A });
    const hits = await scanForDuplicateFace(B, FACE_B);   // B's own different face
    expect(hits).toEqual([]);
  });
});
