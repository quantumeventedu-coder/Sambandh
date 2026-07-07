const { NAKSHATRA_ATLAS, nakshatraByIndex, nakshatraByName, relationshipProfile } = require('../src/data/nakshatras');
const { YONI_ANIMALS, yoniCompatibility, animalForNakshatra } = require('../src/data/yoni');

describe('Nakshatra atlas (spec §1.3)', () => {
  test('has all 27 nakshatras with complete fields', () => {
    expect(NAKSHATRA_ATLAS).toHaveLength(27);
    for (const n of NAKSHATRA_ATLAS) {
      expect(n.name && n.title && n.symbol && n.gana && n.yoni && n.deity).toBeTruthy();
      expect(n.core && n.emotional && n.intimate).toBeTruthy();
      expect(['Deva', 'Manushya', 'Rakshasa']).toContain(n.gana);
    }
  });

  test('index aligns to astro NAKSHATRAS order (0=Ashwini, 3=Rohini, 26=Revati)', () => {
    expect(nakshatraByIndex(0).name).toBe('Ashwini');
    expect(nakshatraByIndex(3).name).toBe('Rohini');
    expect(nakshatraByIndex(26).name).toBe('Revati');
  });

  test('lookup by name is case-insensitive', () => {
    expect(nakshatraByName('rohini').index).toBe(3);
    expect(nakshatraByName('ASHWINI').index).toBe(0);
  });

  test('relationshipProfile returns a display headline', () => {
    expect(relationshipProfile(3).headline).toBe('Rohini (The Sensual Creator)');
  });
});

describe('Yoni intimate-compatibility (spec §1.5)', () => {
  test('exactly 14 animals', () => {
    expect(Object.keys(YONI_ANIMALS)).toHaveLength(14);
  });

  test('every nakshatra maps to a yoni animal', () => {
    for (const n of NAKSHATRA_ATLAS) expect(animalForNakshatra(n.name)).toBeTruthy();
  });

  test('scoring: identical=4, friendly=3, neutral=2, enemy=1, extreme=0', () => {
    expect(yoniCompatibility('Horse', 'Horse').score).toBe(4);
    expect(yoniCompatibility('Horse', 'Cat').score).toBe(3);
    expect(yoniCompatibility('Deer', 'Buffalo').score).toBe(2);
    expect(yoniCompatibility('Horse', 'Cow').score).toBe(1);
    expect(yoniCompatibility('Serpent', 'Mongoose').score).toBe(0);
    expect(yoniCompatibility('Elephant', 'Lion').score).toBe(0);
  });

  test('low scores raise a (gently-phrased) caution flag', () => {
    expect(yoniCompatibility('Serpent', 'Mongoose').caution).toBe(true);
    expect(yoniCompatibility('Horse', 'Horse').caution).toBe(false);
  });
});
