// Tests for the recommendation engine — proves each signal is real logic, not a stub:
// learned taste from swipe history, reciprocity, engagement quality, ELO desirability,
// collaborative filtering, and the blended score with reasons.

// Runs on pg-odm + pglite (real Postgres). `db` must precede the model requires.
const db = require('./helpers/pg-db');
const rec = require('../src/services/recommender');
const User = require('../src/models/User');
const Like = require('../src/models/Like');
const Pass = require('../src/models/Pass');

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

const mk = (over = {}) => ({
  phone: '+91' + Math.floor(6000000000 + Math.random() * 3999999999),
  profile: { firstName: 'U', gender: 'female', age: 27, city: 'Mumbai', languages: ['hindi', 'english'], photos: [{ url: 'a' }, { url: 'b' }] },
  intent: ['dating'], lastActiveAt: new Date(),
  claims: { profession: { verified: false } },
  ...over
});
const viewer = () => ({ _id: new db.Types.ObjectId(), profile: { gender: 'male', age: 29, city: 'Mumbai', languages: ['hindi', 'english'] }, intent: ['dating'], signals: { desirability: 1500 } });

describe('featurize', () => {
  test('captures intent/language overlap, profession, age closeness, city', () => {
    const v = viewer();
    const f = rec.featurize(mk({ intent: ['dating'], claims: { profession: { verified: true } }, profile: { gender: 'female', age: 29, city: 'Mumbai', languages: ['hindi', 'english'], photos: [{}, {}, {}] } }), v);
    expect(f.intent).toBe(1);          // both ['dating']
    expect(f.language).toBe(1);        // identical languages
    expect(f.profession).toBe(1);
    expect(f.ageCloseness).toBe(1);    // same age
    expect(f.sameCity).toBe(1);
    expect(f.photos).toBe(1);
  });
});

describe('learnTaste', () => {
  test('returns null before enough swipes (cold start)', async () => {
    const v = viewer();
    expect(await rec.learnTaste(v)).toBeNull();
  });

  test('learns that the viewer prefers profession-verified profiles', async () => {
    const v = viewer();
    // Like 5 profession-verified users, pass 5 non-verified — everything else equal.
    for (let i = 0; i < 5; i++) {
      const liked = await User.create(mk({ claims: { profession: { verified: true } } }));
      await Like.create({ from: v._id, to: liked._id, createdAt: new Date() });
      const passed = await User.create(mk({ claims: { profession: { verified: false } } }));
      await Pass.create({ from: v._id, to: passed._id, createdAt: new Date(), expiresAt: new Date(Date.now() + 7 * 86400000) });
    }
    const taste = await rec.learnTaste(v);
    expect(taste).not.toBeNull();
    expect(taste.weights.profession).toBeGreaterThan(0.5); // strong positive preference
  });

  test('learns a negative preference (viewer passes far-apart ages)', async () => {
    const v = viewer(); // age 29
    for (let i = 0; i < 5; i++) {
      const liked = await User.create(mk({ profile: { ...mk().profile, age: 29 } }));   // same age
      await Like.create({ from: v._id, to: liked._id, createdAt: new Date() });
      const passed = await User.create(mk({ profile: { ...mk().profile, age: 55 } }));  // far age
      await Pass.create({ from: v._id, to: passed._id, createdAt: new Date(), expiresAt: new Date(Date.now() + 7 * 86400000) });
    }
    const taste = await rec.learnTaste(v);
    expect(taste.weights.ageCloseness).toBeGreaterThan(0.3);
  });
});

describe('reciprocity + score blend', () => {
  test('a candidate whose stated prefs exclude the viewer scores far lower', async () => {
    const v = viewer(); // male, age 29
    const wantsYou = mk({ preferences: { interestedInGenders: ['male'], ageRange: { min: 25, max: 35 } }, signals: { desirability: 1500 } });
    const excludesYou = mk({ preferences: { interestedInGenders: ['female'], ageRange: { min: 18, max: 24 } }, signals: { desirability: 1500 } });
    const ctx = { taste: null, coLike: new Map(), myDesir: 1500, seed: 1 };
    const a = rec.score(ctx, v, { ...wantsYou, _id: new db.Types.ObjectId() }, { km: 3, rep: null, base: 0.7 });
    const b = rec.score(ctx, v, { ...excludesYou, _id: new db.Types.ObjectId() }, { km: 3, rep: null, base: 0.7 });
    expect(a.score).toBeGreaterThan(b.score);
    expect(a.reasons).toContain('Likely to like you back');
  });

  test('engagement quality lifts responsive users and sinks ghosters', () => {
    const v = viewer();
    const cand = { ...mk({ signals: { desirability: 1500 } }), _id: new db.Types.ObjectId() };
    const ctx = { taste: null, coLike: new Map(), myDesir: 1500, seed: 1 };
    const good = rec.score(ctx, v, cand, { km: 3, base: 0.6, rep: { scores: { responsive: 9, depth: 9, respect: 9 }, redFlags: {} } });
    const bad = rec.score(ctx, v, cand, { km: 3, base: 0.6, rep: { scores: { responsive: 3, depth: 3, respect: 3 }, redFlags: { ghostingIncidents: 3, blockedByOthers: 2, reportsAgainst: 1 } } });
    expect(good.score).toBeGreaterThan(bad.score);
  });

  test('collaborative-filtering boost raises a co-liked candidate', () => {
    const v = viewer();
    const cand = { ...mk({ signals: { desirability: 1500 } }), _id: new db.Types.ObjectId() };
    const base = { km: 3, base: 0.6, rep: null };
    const cold = rec.score({ taste: null, coLike: new Map(), myDesir: 1500, seed: 1 }, v, cand, base);
    const warm = rec.score({ taste: null, coLike: new Map([[String(cand._id), 1]]), myDesir: 1500, seed: 1 }, v, cand, base);
    expect(warm.score).toBeGreaterThan(cold.score);
    expect(warm.reasons).toContain('Popular with people like you');
  });
});

describe('desirability (ELO) via recordSwipe', () => {
  test('a like raises the target desirability and increments likesReceived', async () => {
    const v = await User.create(mk({ signals: { desirability: 1500 } }));
    const t = await User.create(mk({ signals: { desirability: 1500 } }));
    await rec.recordSwipe(v._id, t._id, true);
    const after = await User.findById(t._id);
    expect(after.signals.desirability).toBeGreaterThan(1500);
    expect(after.signals.likesReceived).toBe(1);
  });

  test('a pass lowers the target desirability and increments passesReceived', async () => {
    const v = await User.create(mk({ signals: { desirability: 1500 } }));
    const t = await User.create(mk({ signals: { desirability: 1500 } }));
    await rec.recordSwipe(v._id, t._id, false);
    const after = await User.findById(t._id);
    expect(after.signals.desirability).toBeLessThan(1500);
    expect(after.signals.passesReceived).toBe(1);
  });

  test('a like from a high-desirability user moves the needle more', async () => {
    const vHigh = await User.create(mk({ signals: { desirability: 2400 } }));
    const vLow = await User.create(mk({ signals: { desirability: 900 } }));
    const t1 = await User.create(mk({ signals: { desirability: 1500 } }));
    const t2 = await User.create(mk({ signals: { desirability: 1500 } }));
    await rec.recordSwipe(vHigh._id, t1._id, true);
    await rec.recordSwipe(vLow._id, t2._id, true);
    const [a, b] = await Promise.all([User.findById(t1._id), User.findById(t2._id)]);
    expect(a.signals.desirability).toBeGreaterThan(b.signals.desirability);
  });

  test('desirability is clamped to a sane band', async () => {
    const v = await User.create(mk({ signals: { desirability: 2400 } }));
    const t = await User.create(mk({ signals: { desirability: 2495 } }));
    for (let i = 0; i < 20; i++) await rec.recordSwipe(v._id, t._id, true);
    const after = await User.findById(t._id);
    expect(after.signals.desirability).toBeLessThanOrEqual(2500);
  });
});
