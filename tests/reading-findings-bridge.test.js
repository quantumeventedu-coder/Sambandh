// tests/reading-findings-bridge.test.js — Batch 3/4 refine: the reading engine's
// CHART layer is now DRIVEN BY the Batch 2 interpretation findings (one chart→meaning
// authority), with CHART_SIGNALS reduced to phrasing. Two guarantees:
//   1. EQUIVALENCE — each chart phrase-rule's own test(chart) fires IFF its factor is
//      active in interpret(chart). If either definition ever drifts, this fails.
//   2. FAITHFULNESS — every CHART_SIGNAL carries a factor, and that factor is a real
//      factor the interpretation engine can emit.

const { interpret, CONTRIBUTIONS } = require('../src/services/interpretation-engine');
const { computeChart } = require('../src/services/astro-engine');
const R = require('../src/data/reading-rules');

// A spread of real charts (varied element/dignity/dasha) so most factors get exercised.
const INPUTS = [
  { birthDate: '1990-05-15', birthTime: '10:30', birthPlace: { lat: 12.97, lng: 77.59 } },
  { birthDate: '1992-04-10', birthTime: '08:30', birthPlace: { lat: 19.07, lng: 72.87 } },
  { birthDate: '2000-07-04', birthTime: '14:45', birthPlace: { lat: 13.08, lng: 80.27 } },
  { birthDate: '1985-01-01' },
  { birthDate: '1978-11-30', birthTime: '23:10', birthPlace: { lat: 28.61, lng: 77.20 } },
  { birthDate: '1995-03-21', birthTime: '06:05', birthPlace: { lat: 22.57, lng: 88.36 } },
  { birthDate: '1988-09-09', birthTime: '17:40', birthPlace: { lat: 17.38, lng: 78.48 } },
  { birthDate: '2003-12-25', birthTime: '12:00', birthPlace: { lat: 26.85, lng: 80.94 } }
];
const CHARTS = INPUTS.map(computeChart);

describe('faithfulness — every chart phrase-rule maps to a real interpretation factor', () => {
  test('each CHART_SIGNAL carries a factor', () => {
    for (const s of R.CHART_SIGNALS) expect(typeof s.factor).toBe('string');
  });

  test('each factor is one the interpretation engine can actually emit', () => {
    const known = new Set(CONTRIBUTIONS.map(c => c.factor));
    for (const s of R.CHART_SIGNALS) expect(known.has(s.factor)).toBe(true);
  });
});

describe('equivalence — the old per-rule test and the new findings-driven firing agree', () => {
  test('for every chart, rule.test(chart) === factor-is-active (no drift)', () => {
    for (const chart of CHARTS) {
      const active = new Set(interpret(chart).flatMap(f => f.factors));
      for (const s of R.CHART_SIGNALS) {
        let fired = false;
        try { fired = !!s.test(chart); } catch { fired = false; }
        expect(fired).toBe(active.has(s.factor));   // the two definitions coincide, always
      }
    }
  });
});

describe('the reading engine now consumes findings (single authority, no drift)', () => {
  const reading = require('../src/services/reading-engine');

  test('chart-layer signals in gather() exactly match the findings-driven set', () => {
    for (const chart of CHARTS) {
      const active = new Set(interpret(chart).flatMap(f => f.factors));
      const expectedTags = R.CHART_SIGNALS.filter(s => active.has(s.factor)).map(s => s.tag).sort();
      const gotTags = reading.gather({ chart }).filter(s => s.layer === 'chart').map(s => s.tag).sort();
      expect(gotTags).toEqual(expectedTags);
    }
  });

  test('readings stay jargon-free after the rewire', () => {
    const { isClean } = require('../src/services/reading-guards');
    for (const chart of CHARTS) {
      const all = reading.readAll({ chart });
      for (const q of Object.keys(all)) expect(isClean(all[q].answer)).toBe(true);
    }
  });
});
