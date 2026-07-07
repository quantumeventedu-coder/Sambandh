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
});
