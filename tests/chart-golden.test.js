// tests/chart-golden.test.js — Batch 1: the chart computation is deterministic,
// stable, and structurally correct.
//
// The engine (astro-engine.js) already computes the live app's charts. These lock
// its output for fixed birth inputs (regression), assert the invariants any correct
// sidereal engine must satisfy, and prove the unknown-birth-time path never
// fabricates a Lagna. Golden values were captured from the engine itself, so a
// drift in the math turns these red.

const { computeChart, SIGNS, NAK } = require('../src/services/astro-engine');

const CASES = {
  bangalore_1990: { in: { birthDate: '1990-05-15', birthTime: '10:30', birthPlace: { lat: 12.97, lng: 77.59 } },
    want: { sunSign: 'Aries', moonSign: 'Sagittarius', nakshatra: 'Uttara Ashadha', pada: 1, lagna: 'Cancer', dasha: 'Rahu' } },
  mumbai_1992: { in: { birthDate: '1992-04-10', birthTime: '08:30', birthPlace: { lat: 19.07, lng: 72.87 } },
    want: { sunSign: 'Pisces', moonSign: 'Gemini', nakshatra: 'Punarvasu', pada: 1, lagna: 'Taurus', dasha: 'Mercury' } },
  delhi_1994: { in: { birthDate: '1994-11-22', birthTime: '21:15', birthPlace: { lat: 28.61, lng: 77.20 } },
    want: { sunSign: 'Scorpio', moonSign: 'Gemini', nakshatra: 'Punarvasu', pada: 2, lagna: 'Cancer', dasha: 'Mercury' } },
  chennai_2000: { in: { birthDate: '2000-07-04', birthTime: '14:45', birthPlace: { lat: 13.08, lng: 80.27 } },
    want: { sunSign: 'Gemini', moonSign: 'Cancer', nakshatra: 'Ashlesha', pada: 3, lagna: 'Libra', dasha: 'Venus' } },
  notime_1985: { in: { birthDate: '1985-01-01' },
    want: { sunSign: 'Sagittarius', moonSign: 'Aries', nakshatra: 'Ashwini', pada: 3, lagna: null, dasha: 'Mars' } }
};

describe('golden charts reproduce exactly', () => {
  test.each(Object.entries(CASES))('%s', (_name, c) => {
    const chart = computeChart(c.in);
    expect(chart.sunSign).toBe(c.want.sunSign);
    expect(chart.moonSign).toBe(c.want.moonSign);
    expect(chart.nakshatra).toBe(c.want.nakshatra);
    expect(chart.nakshatraPada).toBe(c.want.pada);
    expect(chart.lagna ? chart.lagna.signName : null).toBe(c.want.lagna);
    expect(chart.dasha.current && chart.dasha.current.lord).toBe(c.want.dasha);
  });
});

describe('determinism', () => {
  test('same input → identical chart (no clock/hidden state)', () => {
    const a = computeChart(CASES.mumbai_1992.in);
    const b = computeChart(CASES.mumbai_1992.in);
    expect(a).toEqual(b);
  });
});

describe('structural invariants (any correct sidereal chart)', () => {
  const PLANETS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
  const DIGNITIES = ['exalted', 'debilitated', 'own sign', 'neutral'];
  test.each(Object.entries(CASES))('%s has valid planets/signs/nakshatras', (_name, c) => {
    const chart = computeChart(c.in);
    for (const p of PLANETS) {
      const b = chart.planets[p];
      expect(b).toBeTruthy();
      expect(SIGNS).toContain(b.signName);
      expect(NAK).toContain(b.nakshatra);
      expect(DIGNITIES).toContain(b.dignity);
      expect(b.pada).toBeGreaterThanOrEqual(1);
      expect(b.pada).toBeLessThanOrEqual(4);
      expect(SIGNS).toContain(b.navamsa);   // D9 present
      expect(SIGNS).toContain(b.dasamsa);   // D10 present
    }
  });
});

describe('unknown birth time never fabricates a Lagna', () => {
  const chart = computeChart(CASES.notime_1985.in);
  test('lagna is null and every planet house is null', () => {
    expect(chart.lagna).toBeNull();
    for (const p of Object.values(chart.planets)) expect(p.house).toBeNull();
  });
  test('but Moon sign, nakshatra and dasha are still produced', () => {
    expect(chart.moonSign).toBeTruthy();
    expect(NAK).toContain(chart.nakshatra);
    expect(chart.dasha.current).toBeTruthy();
  });
});

describe('Vimshottari dasha timeline', () => {
  const chart = computeChart(CASES.chennai_2000.in);
  test('9 ordered periods that bracket birth and place "now" inside the current one', () => {
    expect(chart.dasha.periods).toHaveLength(9);
    const birth = new Date(CASES.chennai_2000.in.birthDate).getTime();
    expect(new Date(chart.dasha.periods[0].start).getTime()).toBeLessThanOrEqual(birth);
    for (let i = 1; i < 9; i++) expect(chart.dasha.periods[i].start).toBe(chart.dasha.periods[i - 1].end);
    const cur = chart.dasha.current;
    expect(new Date(cur.start).getTime()).toBeLessThanOrEqual(Date.now());
    expect(new Date(cur.end).getTime()).toBeGreaterThan(Date.now());
  });
});

describe('robustness at date extremes + ayanamsa sanity', () => {
  test.each([
    ['1900-03-21', '06:00'],
    ['2100-09-23', '18:30']
  ])('%s does not crash and yields valid signs', (birthDate, birthTime) => {
    const chart = computeChart({ birthDate, birthTime, birthPlace: { lat: 19, lng: 73 } });
    expect(SIGNS).toContain(chart.sunSign);
    expect(SIGNS).toContain(chart.moonSign);
  });

  test('Lahiri ayanamsa is in the plausible modern range (~24°)', () => {
    const chart = computeChart(CASES.chennai_2000.in);
    expect(chart.ayanamsa).toBeGreaterThan(23);
    expect(chart.ayanamsa).toBeLessThan(26);
  });

  test('an invalid birth date returns null, not a garbage chart', () => {
    expect(computeChart({ birthDate: 'not-a-date' })).toBeNull();
    expect(computeChart(null)).toBeNull();
  });
});
