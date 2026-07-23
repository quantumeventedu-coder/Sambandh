// tests/trainer-stale.test.js — the self-learning trainer must fail GRACEFULLY on
// stale/incompatible examples (a pile of old swipe rows whose feature vectors no
// longer match the schema) instead of crashing with a 500. Regression for the
// "Internal server error" on Train now (evalSet referenced the function `train`,
// and the row count was checked before alignment).

const db = require('./helpers/pg-db');            // must precede model/route requires
const trainer = require('../src/services/trainer');
const TrainingExample = require('../src/models/TrainingExample');

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('trainer resilience', () => {
  test('many STALE examples (wrong feature length) → trained:false, have 0, no throw', async () => {
    for (let i = 0; i < 50; i++) {
      await TrainingExample.create({ kind: 'swipe', features: [0.1, 0.2, 0.3], label: i % 2 }); // 3 ≠ 14
    }
    const r = await trainer.train({ minExamples: 40 });
    expect(r.trained).toBe(false);
    expect(r.examples).toBe(0);                    // aligned count, honest — matches the neural model
    expect(r.reason).toMatch(/have 0/);
  });

  test('enough VALID examples → trains cleanly (no crash on the eval split)', async () => {
    const n = trainer.FEATURE_NAMES.length;
    for (let i = 0; i < 60; i++) {
      const features = Array.from({ length: n }, (_, k) => ((i + k) % 10) / 10);
      await TrainingExample.create({ kind: 'swipe', features, label: i % 2 });
    }
    const r = await trainer.train({ minExamples: 40 });
    expect(r.trained).toBe(true);
    expect(typeof r.accuracy).toBe('number');
    expect(Number.isNaN(r.accuracy)).toBe(false);
  });
});
