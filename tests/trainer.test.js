const trainer = require('../src/services/trainer');

describe('self-learning match model', () => {
  const viewer = {
    profile: { age: 30, languages: ['Hindi'], location: { lat: 19.07, lng: 72.87 } },
    intent: ['marriage'], signals: { desirability: 1500 }
  };
  const candidate = {
    profile: { age: 31, languages: ['Hindi', 'English'], location: { lat: 19.10, lng: 72.90 }, photos: [{ url: 'x' }] },
    intent: ['marriage'], signals: { desirability: 1520 },
    verification: { trustScore: 80, idVerified: true }
  };

  test('featuresFor returns a fixed-length numeric vector aligned with FEATURE_NAMES', () => {
    const f = trainer.featuresFor(viewer, candidate);
    expect(f).toHaveLength(trainer.FEATURE_NAMES.length);
    expect(f.every(v => typeof v === 'number' && !Number.isNaN(v))).toBe(true);
    // all engineered features are normalised to [0,1]
    expect(f.every(v => v >= 0 && v <= 1)).toBe(true);
  });

  test('richer features reflect reputation, karma, profession, activity, same-city', () => {
    const cand = {
      profile: { age: 30, city: 'Mumbai', photos: [{ url: 'x' }] },
      intent: ['marriage'], signals: { desirability: 1500 },
      verification: { trustScore: 80, idVerified: true },
      claims: { profession: { verified: true } },
      lastActiveAt: new Date(),
      _karmaScore: 90,
      _rep: { scores: { depth: 8, responsive: 9 } }
    };
    const v2 = { profile: { age: 30, city: 'Mumbai', languages: ['Hindi'] }, intent: ['marriage'], signals: { desirability: 1500 } };
    const f = trainer.featuresFor(v2, cand, 5);
    const idx = n => trainer.FEATURE_NAMES.indexOf(n);
    expect(f).toHaveLength(14);
    expect(f[idx('professionVerified')]).toBe(1);
    expect(f[idx('sameCity')]).toBe(1);
    expect(f[idx('karma')]).toBeCloseTo(0.9, 5);
    expect(f[idx('active')]).toBeGreaterThan(0.9);
    expect(f[idx('repDepth')]).toBeCloseTo(0.8, 5);
    expect(f[idx('repResponsive')]).toBeCloseTo(0.9, 5);
    expect(f.every(v => v >= 0 && v <= 1)).toBe(true);
  });

  test('missing reputation/karma default to neutral, never a guess', () => {
    const bare = { profile: { age: 30 }, intent: [], signals: {} };
    const f = trainer.featuresFor(viewer, bare);
    const idx = n => trainer.FEATURE_NAMES.indexOf(n);
    expect(f[idx('karma')]).toBe(1);          // no KarmaBook → treated as clean (100)
    expect(f[idx('repDepth')]).toBe(0.5);     // no Reputation → neutral
    expect(f[idx('repResponsive')]).toBe(0.5);
    expect(f[idx('active')]).toBe(0);         // no lastActiveAt → not-recently-active
  });

  test('shared intent + language + verified id reflect in the vector', () => {
    const f = trainer.featuresFor(viewer, candidate);
    const idx = n => trainer.FEATURE_NAMES.indexOf(n);
    expect(f[idx('sharedIntent')]).toBe(1);
    expect(f[idx('sharedLanguage')]).toBe(1);
    expect(f[idx('idVerified')]).toBe(1);
    expect(f[idx('hasPhoto')]).toBe(1);
  });

  test('predictWith returns a probability, and is monotonic in a positive weight', () => {
    const model = {
      weights: [5, 0, 0, 0, 0, 0, 0, 0], bias: -2.5, featureNames: trainer.FEATURE_NAMES
    };
    const close = { profile: { age: 30 }, intent: [], signals: {} };       // ageCloseness ~1
    const far = { profile: { age: 55 }, intent: [], signals: {} };         // ageCloseness low
    const pClose = trainer.predictWith(model, viewer, close, 10);
    const pFar = trainer.predictWith(model, viewer, far, 10);
    expect(pClose).toBeGreaterThan(0);
    expect(pClose).toBeLessThan(1);
    expect(pClose).toBeGreaterThan(pFar); // higher ageCloseness → higher probability
  });

  test('predictWith returns null when no model is trained', () => {
    expect(trainer.predictWith(null, viewer, candidate, 5)).toBeNull();
  });

  test('predictWith serves the NEURAL model (kind:"mlp") through the same interface', () => {
    const { trainMLP } = require('../src/services/nn');
    // Train a tiny MLP on the exact 8-feature contract, then serve it via predictWith.
    const rng = require('../src/services/nn').makeRng(9);
    const X = [], y = [];
    for (let i = 0; i < 200; i++) {
      const f = Array.from({ length: trainer.FEATURE_NAMES.length }, () => rng());
      // like iff shared intent AND close age (an interaction) — index via FEATURE_NAMES
      const ii = trainer.FEATURE_NAMES.indexOf('sharedIntent');
      const ai = trainer.FEATURE_NAMES.indexOf('ageCloseness');
      X.push(f); y.push((f[ii] > 0.5 && f[ai] > 0.5) ? 1 : 0);
    }
    const { model } = trainMLP(X, y, { hidden: [12, 6], epochs: 150, seed: 2 });
    model.featureNames = trainer.FEATURE_NAMES;
    const p = trainer.predictWith(model, viewer, candidate, 10);
    expect(typeof p).toBe('number');
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
  });
});
