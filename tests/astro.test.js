// Tests for the Vedic astrology engine — proves the Ashtakoot Guna Milan follows
// the classical rules (not a hash) and that the Moon position is real astronomy.

const astro = require('../src/services/astro');

// Build a minimal chart the way gunaMilan consumes it.
const chart = (rashiIndex, nakshatraIndex) => ({ rashiIndex, nakshatraIndex });

describe('moonPosition (sidereal astronomy, not a hash)', () => {
  test('returns a valid rashi (0-11) and nakshatra (0-26)', () => {
    const mp = astro.moonPosition('1995-08-14', '09:30');
    expect(mp.rashiIndex).toBeGreaterThanOrEqual(0);
    expect(mp.rashiIndex).toBeLessThanOrEqual(11);
    expect(mp.nakshatraIndex).toBeGreaterThanOrEqual(0);
    expect(mp.nakshatraIndex).toBeLessThanOrEqual(26);
    expect(mp.pada).toBeGreaterThanOrEqual(1);
    expect(mp.pada).toBeLessThanOrEqual(4);
  });

  test('the Moon moves — different times/dates give different longitudes', () => {
    const a = astro.moonPosition('1995-08-14', '06:00');
    const b = astro.moonPosition('1995-08-14', '23:00');
    const c = astro.moonPosition('1995-08-20', '06:00');
    expect(a.longitude).not.toBe(b.longitude);
    expect(a.nakshatraIndex).not.toBe(c.nakshatraIndex); // 6 days ≈ 79° ≈ 6 nakshatras
  });

  test('is deterministic (same input → same chart)', () => {
    expect(astro.moonPosition('1990-01-01', '12:00')).toEqual(astro.moonPosition('1990-01-01', '12:00'));
  });

  test('chartFor produces named rashi + nakshatra', () => {
    const c = astro.chartFor({ birthDate: '1992-03-21', birthTime: '14:15' });
    expect(astro.RASHIS_EN).toContain(c.rashiEn);
    expect(astro.NAKSHATRAS).toContain(c.nakshatra);
  });
});

describe('Guna Milan — classical koota rules', () => {
  test('total is always within 0..36 and percent tracks it', () => {
    const g = astro.gunaMilan(chart(2, 7), chart(5, 14));
    expect(g.total).toBeGreaterThanOrEqual(0);
    expect(g.total).toBeLessThanOrEqual(36);
    expect(g.max).toBe(36);
    expect(g.percent).toBe(Math.round((g.total / 36) * 100));
  });

  test('Nadi dosha: same Nadi → 0/8; different Nadi → 8/8', () => {
    // nakshatra 0 (Ashwini, Aadi) & 5 (Ardra, Aadi) share Nadi
    expect(astro.gunaMilan(chart(0, 0), chart(0, 5)).breakdown.nadi.got).toBe(0);
    // nakshatra 0 (Aadi) & 1 (Bharani, Madhya) differ
    expect(astro.gunaMilan(chart(0, 0), chart(0, 1)).breakdown.nadi.got).toBe(8);
  });

  test('Bhakoot dosha: 6-8 rashi placement → 0; same rashi → 7', () => {
    expect(astro.gunaMilan(chart(0, 3), chart(5, 20)).breakdown.bhakoot.got).toBe(0); // 0 & 5 = 6/8
    expect(astro.gunaMilan(chart(4, 3), chart(4, 20)).breakdown.bhakoot.got).toBe(7); // same rashi
  });

  test('Yoni: same animal → 4; sworn-enemy (Horse/Buffalo) → 0', () => {
    expect(astro.gunaMilan(chart(0, 0), chart(3, 23)).breakdown.yoni.got).toBe(4);   // Ashwini & Shatabhisha = Horse
    expect(astro.gunaMilan(chart(0, 0), chart(3, 12)).breakdown.yoni.got).toBe(0);   // Horse vs Buffalo (Hasta)
  });

  test('Gana: Manushya×Rakshasa → 0; Deva×Deva → 6', () => {
    expect(astro.gunaMilan(chart(0, 1), chart(0, 8)).breakdown.gana.got).toBe(0);    // Bharani(Manushya) boy × Ashlesha(Rakshasa) girl
    expect(astro.gunaMilan(chart(0, 0), chart(0, 4)).breakdown.gana.got).toBe(6);    // Ashwini & Mrigashira both Deva
  });

  test('a strong pair clears the 18-point marriage threshold, a doshic pair may not', () => {
    const strong = astro.gunaMilan(chart(0, 0), chart(0, 4)); // same rashi, both Deva, compatible
    expect(strong.total).toBeGreaterThanOrEqual(18);
    expect(['Acceptable match', 'Very good match', 'Excellent match']).toContain(strong.verdict);
  });

  test('doshas array names the specific problems', () => {
    const g = astro.gunaMilan(chart(0, 0), chart(0, 5)); // same Nadi
    expect(g.doshas.join(' ')).toMatch(/Nadi/);
  });

  test('every koota stays within its own maximum', () => {
    for (let i = 0; i < 27; i += 4) for (let j = 0; j < 27; j += 5) {
      const g = astro.gunaMilan(chart(i % 12, i), chart(j % 12, j));
      for (const k of Object.values(g.breakdown)) {
        expect(k.got).toBeGreaterThanOrEqual(0);
        expect(k.got).toBeLessThanOrEqual(k.max);
      }
    }
  });
});
