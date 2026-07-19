// tests/compatibility-engine.test.js — Part G: weighted 3-way fusion + the
// MARRIAGE GATE (enforced in the engine) + the reading guards.

const compat = require('../src/services/compatibility-engine');
const { computeCompatibility, rankingSignal, WEIGHTS } = compat;
const { isClean, hardFutureViolation } = require('../src/services/reading-guards');

const userWith = (over = {}) => ({
  intent: ['dating'],
  astrology: { birthDate: '1992-04-10', birthTime: '08:30', birthPlace: { lat: 19, lng: 72.8 } },
  features: { build: 'solid' },
  ...over
});
const marriage = u => ({ ...u, intent: ['marriage'] });

describe('the marriage gate (enforced in the engine, not the UI)', () => {
  const a = userWith(), b = userWith({ astrology: { birthDate: '1994-11-22', birthTime: '21:15', birthPlace: { lat: 28.6, lng: 77.2 } } });

  test('neither marriage-intent → hint only, no score, no sub-scores', () => {
    const r = computeCompatibility(a, b);
    expect(r.level).toBe('hint');
    expect(typeof r.hint).toBe('string');
    expect(r.score).toBeUndefined();
    expect(r.subScores).toBeUndefined();
  });

  test('only ONE side marriage-intent → still hint only', () => {
    const r = computeCompatibility(marriage(a), b);
    expect(r.level).toBe('hint');
    expect(r.score).toBeUndefined();
  });

  test('BOTH marriage-intent → full reading with score + sub-scores', () => {
    const r = computeCompatibility(marriage(a), marriage(b));
    expect(r.level).toBe('full');
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.reading.how_you_fit).toBeTruthy();
  });

  test('context intent overrides the stored intent (per-chat gate)', () => {
    // stored intent is dating, but the chat context says both marriage → unlocks.
    const r = computeCompatibility(a, b, { context: { intentA: ['marriage'], intentB: ['marriage'] } });
    expect(r.level).toBe('full');
  });
});

describe('weighted 3-way fusion', () => {
  const r = computeCompatibility(marriage(userWith()), marriage(userWith()));

  test('exposes chart, temperament and behaviour sub-scores in [0,1]', () => {
    for (const k of ['chart', 'temperament', 'behaviour']) {
      expect(r.subScores[k]).toBeGreaterThanOrEqual(0);
      expect(r.subScores[k]).toBeLessThanOrEqual(1);
    }
  });

  test('weights live in ONE named place and sum to 1', () => {
    expect(WEIGHTS.chart + WEIGHTS.temperament + WEIGHTS.behaviour).toBeCloseTo(1, 6);
  });

  test('the score equals the weighted blend of the sub-scores', () => {
    const expected = Math.round(100 * (WEIGHTS.chart * r.subScores.chart + WEIGHTS.temperament * r.subScores.temperament + WEIGHTS.behaviour * r.subScores.behaviour));
    expect(r.score).toBe(expected);
  });
});

describe('graceful degradation', () => {
  test('missing behaviour data is neutral, never throws', () => {
    const r = computeCompatibility(marriage(userWith()), marriage(userWith()));
    expect(r.subScores.behaviour).toBe(0.5);
  });

  test('no birth chart on one side → chart sub-score falls to neutral, still full', () => {
    const noChart = marriage(userWith({ astrology: null }));
    const r = computeCompatibility(noChart, marriage(userWith()));
    expect(r.level).toBe('full');
    expect(r.subScores.chart).toBe(0.5);
    expect(r.confidence).toBeLessThan(5);          // less real data → lower confidence
  });

  test('completely empty users do not throw', () => {
    expect(() => computeCompatibility({}, {})).not.toThrow();
    expect(() => computeCompatibility({ intent: ['marriage'] }, { intent: ['marriage'] })).not.toThrow();
  });
});

describe('reading guards hold on compatibility output (100 pairs)', () => {
  test('every surfaced string is jargon-free and future-safe', () => {
    for (let i = 0; i < 100; i++) {
      const a = marriage(userWith({ astrology: { birthDate: `19${70 + i % 30}-0${1 + i % 9}-1${i % 9}`, birthTime: '10:00', birthPlace: { lat: 19, lng: 73 } }, features: { build: ['solid', 'lean', 'balanced', 'sturdy'][i % 4] } }));
      const b = marriage(userWith({ astrology: { birthDate: `19${71 + i % 28}-0${1 + (i + 3) % 9}-2${i % 8}`, birthTime: '15:30', birthPlace: { lat: 13, lng: 80 } } }));
      const r = computeCompatibility(a, b);
      for (const s of [r.reading.how_you_fit, r.reading.whos_your_person]) {
        expect(isClean(s)).toBe(true);
        expect(hardFutureViolation(s)).toBe(false);   // windows, not fate
      }
    }
  });

  test('the pre-marriage hint is also jargon-free', () => {
    for (let i = 0; i < 30; i++) {
      const r = computeCompatibility(userWith(), userWith({ astrology: { birthDate: `1990-0${1 + i % 9}-15`, birthTime: '09:00', birthPlace: { lat: 19, lng: 73 } } }));
      expect(isClean(r.hint)).toBe(true);
    }
  });
});

describe('determinism', () => {
  test('same two users + context → identical result', () => {
    const a = marriage(userWith()), b = marriage(userWith());
    expect(computeCompatibility(a, b)).toEqual(computeCompatibility(a, b));
  });
});

describe('rankingSignal for discover (cheap, no chart recompute)', () => {
  test('returns a number in [0,1]', () => {
    const s = rankingSignal({ astrology: { nakshatra: 'Ashwini', rashi: 'Aries' } }, { astrology: { nakshatra: 'Bharani', rashi: 'Aries' } });
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });

  test('neutral 0.5 when astrology is missing (never blocks the feed)', () => {
    expect(rankingSignal({}, {})).toBe(0.5);
    expect(rankingSignal({ astrology: {} }, { astrology: { nakshatra: 'Rohini' } })).toBe(0.5);
  });
});

describe('discover integration keeps the recommender', () => {
  const fs = require('fs'); const path = require('path');
  const disc = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes-discover.js'), 'utf8');
  test('ranking uses rankingSignal as ONE input, and the recommender still scores', () => {
    expect(disc).toMatch(/compat\.rankingSignal\(me, u\)/);
    expect(disc).toMatch(/recommender\.score\(/);          // learned model still runs
    expect(disc).toMatch(/trainer\.getActiveModel/);       // and the neural/logistic model
  });
});
