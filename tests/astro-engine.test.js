// tests/astro-engine.test.js — the chart engine must NEVER throw on stored user data.
// Regression for the live "Internal server error" on the Astro tab: birthPlace coords
// held as strings/blank/NaN produced a non-finite ascendant, which masqueraded as a
// real Lagna, turned the whole-sign house math to NaN, and threw inside detectYogas —
// a 500 on GET /astro/chart. A non-finite ascendant must degrade to "no Lagna".

const engine = require('../src/services/astro-engine');

const BASE = { birthDate: '1990-05-15', birthTime: '08:30' };
const place = (lat, lng) => ({ ...BASE, birthPlace: { city: 'Guwahati', lat, lng } });

describe('computeChart never throws on real-world stored data', () => {
  const badCoordCases = {
    'string coords': place('26.14', '91.73'),
    'blank-string coords': place('', ''),
    'NaN coords': place(NaN, NaN),
    'non-numeric string coords': place('north', 'east'),
    'lat only (lng missing)': { ...BASE, birthPlace: { city: 'X', lat: 26.14 } },
    'null coords': place(null, null),
    'birthPlace is a bare string': { ...BASE, birthPlace: 'Guwahati' },
    'empty birthPlace object': { ...BASE, birthPlace: {} },
  };

  for (const [label, astro] of Object.entries(badCoordCases)) {
    test(`does not throw and returns a full chart — ${label}`, () => {
      let chart;
      expect(() => { chart = engine.computeChart(astro); }).not.toThrow();
      expect(chart).toBeTruthy();
      // The factual chart always survives; the interpretive layers are always arrays.
      expect(Object.keys(chart.planets)).toHaveLength(9);
      expect(Array.isArray(chart.yogas)).toBe(true);
      expect(Array.isArray(chart.doshas)).toBe(true);
    });
  }

  test('a non-finite coordinate yields NO Lagna (not a NaN one)', () => {
    for (const label of ['NaN coords', 'non-numeric string coords', 'blank-string coords', 'lat only (lng missing)']) {
      const chart = engine.computeChart(badCoordCases[label]);
      expect(chart.lagna).toBeNull();                         // never { sign: NaN }
      for (const p of Object.values(chart.planets)) expect(p.house).toBeNull();
    }
  });
});

describe('computeChart coerces valid string coordinates (no lost chart)', () => {
  test('string "26.14"/"91.73" computes the SAME Lagna as the numeric coords', () => {
    const numeric = engine.computeChart(place(26.14, 91.73));
    const strings = engine.computeChart(place('26.14', '91.73'));
    expect(numeric.lagna).not.toBeNull();
    expect(strings.lagna).toEqual(numeric.lagna);             // real Lagna, not dropped
    for (const p of Object.keys(numeric.planets)) {
      expect(strings.planets[p].house).toBe(numeric.planets[p].house);
    }
  });
});

describe('computeChart tolerates non-canonical birthDate storage', () => {
  test('a full ISO string and a Date object both parse to the calendar day', () => {
    const canonical = engine.computeChart(place(26.14, 91.73));
    const iso = engine.computeChart({ ...place(26.14, 91.73), birthDate: '1990-05-15T00:00:00.000Z' });
    const dateObj = engine.computeChart({ ...place(26.14, 91.73), birthDate: new Date('1990-05-15T00:00:00Z') });
    expect(iso.moonSign).toBe(canonical.moonSign);
    expect(dateObj.moonSign).toBe(canonical.moonSign);
  });
});
