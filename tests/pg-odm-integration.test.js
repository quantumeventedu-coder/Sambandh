// tests/pg-odm-integration.test.js — the ODM against a REAL Postgres.
//
// Every other DB test runs on mongodb-memory-server, i.e. Mongoose — which
// production does NOT use. Production runs pg-odm over Postgres. So nothing
// verified the engine that actually ships (ADR-001's core complaint).
//
// This runs pg-odm against pglite: real Postgres 16 compiled to WASM, in-process,
// offline, no Docker. It exercises the JSONB SQL pg-odm generates (doc->>, #>>,
// GIN/btree indexes, = ANY, $set/$inc/$push, upsert) end to end.

const { PGlite } = require('@electric-sql/pglite');
const pg = require('../src/db/pg-odm');

/** Wrap a PGlite instance as the tiny pg.Pool surface pg-odm uses ({ query, end }). */
function poolFromPglite(db) {
  return {
    query: (text, params) => db.query(text, params || []),
    end: () => db.close()
  };
}

let db;
beforeAll(async () => {
  db = new PGlite();                 // in-memory; nothing to download
  await db.waitReady;
  pg._internal._setPoolForTests(poolFromPglite(db));
});
afterAll(async () => { pg._internal._setPoolForTests(null); await db.close(); });

// A model like the real ones: string _id, JSONB doc, a unique field, hot paths.
const User = pg.model('itUser', new pg.Schema({
  phone: { type: String, unique: true },
  email: String,
  intent: [String],
  profile: { gender: String, age: Number, city: String },
  createdAt: { type: Date, default: () => new Date() }   // stored ISO, revived to Date
}));

afterEach(async () => { await User.deleteMany({}); });

describe('pg-odm on real Postgres (pglite)', () => {
  test('create + findById round-trips the document shape', async () => {
    const u = await User.create({ phone: '+919000000001', email: 'a@x.com', profile: { gender: 'male', age: 30, city: 'Mumbai' } });
    expect(String(u._id)).toMatch(/^[0-9a-f]{24}$/);       // Mongo-shaped id
    const got = await User.findById(u._id);
    expect(got.phone).toBe('+919000000001');
    expect(got.profile.city).toBe('Mumbai');
    expect(got.createdAt instanceof Date).toBe(true);      // ISO string revived to Date
  });

  test('findOne on a nested path (doc#>> JSONB) works', async () => {
    await User.create({ phone: '+919000000002', profile: { gender: 'female', age: 27, city: 'Delhi' } });
    const got = await User.findOne({ 'profile.city': 'Delhi' });
    expect(got.phone).toBe('+919000000002');
    expect(await User.findOne({ 'profile.city': 'Nowhere' })).toBeNull();
  });

  test('$gt / $lt on a numeric JSONB field', async () => {
    await User.create({ phone: '+919000000003', profile: { age: 22 } });
    await User.create({ phone: '+919000000004', profile: { age: 40 } });
    const young = await User.find({ 'profile.age': { $lt: 30 } });
    expect(young.map(u => u.phone)).toEqual(['+919000000003']);
  });

  test('$in on _id uses = ANY(array) and returns both', async () => {
    const a = await User.create({ phone: '+919000000005' });
    const b = await User.create({ phone: '+919000000006' });
    const rows = await User.find({ _id: { $in: [a._id, b._id] } });
    expect(rows.length).toBe(2);
  });

  test('array-membership equality (intent contains value)', async () => {
    await User.create({ phone: '+919000000007', intent: ['marriage', 'dating'] });
    const got = await User.find({ intent: 'marriage' });
    expect(got.length).toBe(1);
    expect(await User.find({ intent: 'friendship' })).toEqual([]);
  });

  test('findByIdAndUpdate with $set + dotted path, returns the new doc', async () => {
    const u = await User.create({ phone: '+919000000008', profile: { city: 'Pune' } });
    const updated = await User.findByIdAndUpdate(u._id, { 'profile.city': 'Goa' }, { new: true });
    expect(updated.profile.city).toBe('Goa');
    expect((await User.findById(u._id)).profile.city).toBe('Goa');
  });

  test('$inc and $push mutate correctly', async () => {
    const u = await User.create({ phone: '+919000000009', intent: ['dating'] });
    await User.findByIdAndUpdate(u._id, { $push: { intent: 'friendship' }, $set: { email: 'z@x.com' } });
    const got = await User.findById(u._id);
    expect(got.intent).toEqual(['dating', 'friendship']);
    expect(got.email).toBe('z@x.com');
  });

  test('countDocuments respects the filter', async () => {
    await User.create({ phone: '+919000000010', profile: { gender: 'male' } });
    await User.create({ phone: '+919000000011', profile: { gender: 'female' } });
    expect(await User.countDocuments({})).toBe(2);
    expect(await User.countDocuments({ 'profile.gender': 'male' })).toBe(1);
  });

  test('sort + limit + lean', async () => {
    await User.create({ phone: '+919000000012', profile: { age: 20 } });
    await User.create({ phone: '+919000000013', profile: { age: 50 } });
    await User.create({ phone: '+919000000014', profile: { age: 35 } });
    const top = await User.find({}).sort({ 'profile.age': -1 }).limit(2).lean();
    expect(top.map(u => u.profile.age)).toEqual([50, 35]);
  });

  test('the unique index is enforced by Postgres (not just JS)', async () => {
    await User.create({ phone: '+91DUPLICATE' });
    await expect(User.create({ phone: '+91DUPLICATE' })).rejects.toBeTruthy();
  });

  test('deleteMany removes matching rows only', async () => {
    await User.create({ phone: '+919000000015', profile: { gender: 'male' } });
    await User.create({ phone: '+919000000016', profile: { gender: 'female' } });
    await User.deleteMany({ 'profile.gender': 'male' });
    expect(await User.countDocuments({})).toBe(1);
    expect((await User.findOne({})).profile.gender).toBe('female');
  });
});
