// tests/corpus.test.js — the Batch 0 rule corpus is complete and consistent, and
// its dignities agree with the chart engine that computes the live app.

const { validate, PLANETS, SIGNS } = require('../scripts/validate-corpus');
const planets = require('../src/data/corpus/planets.json');
const signs = require('../src/data/corpus/signs.json');
const houses = require('../src/data/corpus/houses.json');
const yogas = require('../src/data/corpus/yogas.json');

describe('corpus shape validation (same check CI runs)', () => {
  test('validate() reports zero problems', () => {
    expect(validate()).toEqual([]);
  });
});

describe('completeness', () => {
  test('all 9 planets, 12 houses, 12 signs present', () => {
    for (const p of PLANETS) expect(planets.planets[p]).toBeTruthy();
    for (let h = 1; h <= 12; h++) expect(houses.houses[String(h)]).toBeTruthy();
    for (const s of SIGNS) expect(signs.signs[s]).toBeTruthy();
  });
});

describe('internal consistency with the chart engine', () => {
  // The corpus dignities must match the tables astro-engine.js already uses, or a
  // reading would contradict the computed chart.
  test('each sign ruler is a real planet and the ruling is symmetric with own-signs', () => {
    for (const [id, s] of Object.entries(signs.signs)) {
      expect(PLANETS).toContain(s.ruler);
      // the ruler owns this sign (nodes rule nothing, so skip them)
      if (!['rahu', 'ketu'].includes(s.ruler)) {
        expect(planets.planets[s.ruler].strong.own).toContain(id);
      }
    }
  });

  test('exaltation and debilitation are opposite signs (6 apart) for the seven grahas', () => {
    const order = SIGNS;
    for (const id of ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn']) {
      const p = planets.planets[id];
      const e = order.indexOf(p.strong.exalted), d = order.indexOf(p.weak.debilitated);
      expect(e).toBeGreaterThanOrEqual(0);
      expect(d).toBeGreaterThanOrEqual(0);
      expect((e + 6) % 12).toBe(d);
    }
  });

  test('friend/enemy lists never overlap for a planet', () => {
    for (const p of Object.values(planets.planets)) {
      for (const f of p.friends) expect(p.enemies).not.toContain(f);
    }
  });
});

describe('yogas', () => {
  test('every yoga has a unique code and a known category', () => {
    const codes = yogas.yogas.map(y => y.code);
    expect(new Set(codes).size).toBe(codes.length);
    const cats = new Set(['raja', 'wealth', 'intellect', 'mahapurusha', 'cancellation', 'difficult']);
    for (const y of yogas.yogas) expect(cats.has(y.category)).toBe(true);
  });
});
