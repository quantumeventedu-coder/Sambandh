// tests/interpretation-engine.test.js — Batch 2: findings are structured codes,
// never prose; strength scales with converging factors.

const { interpret, TOPICS } = require('../src/services/interpretation-engine');
const { computeChart } = require('../src/services/astro-engine');

const GOLDEN = {
  bangalore_1990: { birthDate: '1990-05-15', birthTime: '10:30', birthPlace: { lat: 12.97, lng: 77.59 } },
  mumbai_1992: { birthDate: '1992-04-10', birthTime: '08:30', birthPlace: { lat: 19.07, lng: 72.87 } },
  chennai_2000: { birthDate: '2000-07-04', birthTime: '14:45', birthPlace: { lat: 13.08, lng: 80.27 } },
  notime_1985: { birthDate: '1985-01-01' }
};

describe('finding shape', () => {
  test.each(Object.entries(GOLDEN))('%s produces well-formed findings', (_name, inp) => {
    const findings = interpret(computeChart(inp));
    expect(Array.isArray(findings)).toBe(true);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(TOPICS).toContain(f.topic);
      expect(f.claim).toMatch(/^[a-z][a-z_]+$/);          // a code, not a sentence
      expect(f.strength).toBeGreaterThanOrEqual(1);
      expect(f.strength).toBeLessThanOrEqual(5);
      expect(Array.isArray(f.factors)).toBe(true);
      expect(f.factors.length).toBeGreaterThan(0);
      for (const factor of f.factors) expect(factor).toMatch(/^[a-z][a-z0-9_]+$/);
    }
  });
});

describe('NO finding contains English prose (the critical separation)', () => {
  test('every field is a code/number/array — no spaces, no sentences', () => {
    for (const inp of Object.values(GOLDEN)) {
      for (const f of interpret(computeChart(inp))) {
        expect(f.topic).not.toMatch(/\s/);
        expect(f.claim).not.toMatch(/\s/);
        for (const factor of f.factors) expect(factor).not.toMatch(/\s/);
        // only the four expected keys exist — no stray "text"/"description" field
        expect(Object.keys(f).sort()).toEqual(['claim', 'factors', 'strength', 'topic']);
      }
    }
  });
});

describe('strength scales with converging factors', () => {
  test('a claim with more supporting factors is stronger', () => {
    // A synthetic chart engineered so "restless" gets THREE factors (fire Moon +
    // Rahu dasha + Mars with Moon) vs a claim with one.
    const strongChart = {
      moonSign: 'Aries', nakshatra: 'Bharani',
      planets: { Sun: {}, Venus: {}, Saturn: {}, Mars: { sign: 0 }, Moon: { sign: 0 } },
      doshas: [], yogas: [], dasha: { current: { lord: 'Rahu' } }
    };
    const findings = interpret(strongChart);
    const restless = findings.find(f => f.claim === 'restless');
    expect(restless).toBeTruthy();
    expect(restless.factors.length).toBeGreaterThanOrEqual(2);
    expect(restless.strength).toBeGreaterThanOrEqual(3);

    const single = { moonSign: 'Taurus', nakshatra: 'Rohini', planets: { Sun: {}, Venus: {}, Saturn: {}, Mars: { sign: 5 }, Moon: { sign: 1 } }, doshas: [], yogas: [], dasha: { current: { lord: 'Jupiter' } } };
    const grounded = interpret(single).find(f => f.claim === 'grounded');
    expect(grounded.strength).toBe(2);   // one factor → weak
    expect(restless.strength).toBeGreaterThan(grounded.strength);
  });

  test('debilitated Venus yields the marriage idealization finding', () => {
    const chart = { moonSign: 'Gemini', nakshatra: 'Ardra', planets: { Sun: {}, Venus: { dignity: 'debilitated' }, Saturn: {}, Mars: { sign: 2 }, Moon: { sign: 2 } }, doshas: [], yogas: [], dasha: { current: { lord: 'Venus' } } };
    const f = interpret(chart).find(x => x.topic === 'marriage' && x.claim === 'idealizes_partner');
    expect(f).toBeTruthy();
    expect(f.factors).toContain('venus_debilitated');
  });
});

describe('robustness', () => {
  test('null/empty chart → empty findings, no throw', () => {
    expect(interpret(null)).toEqual([]);
    expect(interpret({})).toEqual([]);
  });

  test('deterministic — same chart, same findings', () => {
    const c = computeChart(GOLDEN.mumbai_1992);
    expect(interpret(c)).toEqual(interpret(c));
  });
});
