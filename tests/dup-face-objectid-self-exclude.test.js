// tests/dup-face-objectid-self-exclude.test.js — PRODUCTION type combo: User._id is an ObjectId, but the
// scan is called with req.userId as a HEX STRING (from the JWT). Self-exclusion `_id: { $ne: userId }`
// must still exclude the caller when the types differ — otherwise every re-verifying user is falsely
// flagged as a duplicate of themselves in prod (but not in tests that use string ids).

const db = require('./helpers/pg-db');
const User = require('../src/models/User');
const { Types } = require('../src/db/odm');
const { scanForDuplicateFace } = require('../src/services/face-engine');

const FACE_A = Array(128).fill(0.12);

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('scanForDuplicateFace self-exclusion with ObjectId _id vs hex-string userId', () => {
  test('re-scanning own face (ObjectId doc, string userId) is NOT a self-duplicate', async () => {
    const oid = new Types.ObjectId();
    await User.create({ _id: oid, phone: '+919000000001', faceDescriptor: FACE_A });
    const hits = await scanForDuplicateFace(oid.toString(), FACE_A);   // hex string, as in the real handler
    expect(hits).toEqual([]);                                          // must exclude self despite type diff
  });

  test('the same face on another ObjectId account is still caught (string userId caller)', async () => {
    const other = new Types.ObjectId();
    const me = new Types.ObjectId();
    await User.create({ _id: other, phone: '+919000000002', faceDescriptor: FACE_A });
    const hits = await scanForDuplicateFace(me.toString(), FACE_A);
    expect(hits.length).toBe(1);
    expect(String(hits[0].userId)).toBe(other.toString());
  });
});
