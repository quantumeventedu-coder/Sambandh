const { computeCompatibility, attachmentCompat, loveLanguageCompat, bigFiveCompat } = require('../src/services/compatibility');

const perfectOcean = { openness: { score: 0.85 }, conscientiousness: { score: 0.85 }, extraversion: { score: 0.85 }, agreeableness: { score: 0.85 }, neuroticism: { score: 0.25 } };

describe('compatibility formula (spec §4.2)', () => {
  test('component weights sum to 100% (with birth time)', () => {
    const w = computeCompatibility({}).weights;
    expect(Object.values(w).reduce((s, x) => s + x, 0)).toBeCloseTo(1, 6);
  });

  test('attachment matrix matches the spec', () => {
    expect(attachmentCompat('Secure', 'Avoidant (Dismissive)')).toBe(1.0);
    expect(attachmentCompat('Anxious (Preoccupied)', 'Secure')).toBe(0.8);
    expect(attachmentCompat('Anxious (Preoccupied)', 'Avoidant (Dismissive)')).toBe(0.2);
    expect(attachmentCompat('Avoidant (Dismissive)', 'Avoidant (Dismissive)')).toBe(0.6);
    expect(attachmentCompat('Disorganised (Fearful)', 'Secure')).toBe(0.5);
    expect(attachmentCompat('Anxious (Preoccupied)', 'Anxious (Preoccupied)')).toBe(0.3);
  });

  test('love language: same 1.0, adjacent 0.7, opposite 0.4', () => {
    expect(loveLanguageCompat('Words of Affirmation', 'Words of Affirmation')).toBe(1.0);
    expect(loveLanguageCompat('Words of Affirmation', 'Quality Time')).toBe(0.7);
    expect(loveLanguageCompat('Physical Touch', 'Acts of Service')).toBe(0.4);
  });

  test('big five: identical profiles align near 1.0', () => {
    expect(bigFiveCompat(perfectOcean, perfectOcean)).toBeGreaterThan(0.95);
  });

  test('a perfect pairing is capped at 99 (never 100)', () => {
    const r = computeCompatibility({
      gunaMilan: { total: 36, max: 36, doshas: [] }, yoniScore: 4, ganaScore: 6,
      attachmentA: 'Secure', attachmentB: 'Secure', oceanA: perfectOcean, oceanB: perfectOcean,
      loveA: 'Words of Affirmation', loveB: 'Words of Affirmation', engagement: 1,
      karmaGradeA: 'A', karmaGradeB: 'A', sameIntent: true, sharedLanguage: true
    });
    expect(r.score).toBeLessThanOrEqual(99);
    expect(r.score).toBeGreaterThanOrEqual(90);
  });

  test('critical safety flag forces the score to 0', () => {
    expect(computeCompatibility({ criticalFlag: true, karmaGradeA: 'A', karmaGradeB: 'A' }).score).toBe(0);
  });

  test('a D/F karma grade caps the score at 40', () => {
    const r = computeCompatibility({ karmaGradeA: 'D', karmaGradeB: 'A', gunaMilan: { total: 36, max: 36 }, yoniScore: 4, ganaScore: 6, engagement: 1 });
    expect(r.score).toBeLessThanOrEqual(40);
  });

  test('doshas and low-yoni cautions surface as warnings', () => {
    const r = computeCompatibility({ gunaMilan: { total: 18, max: 36, doshas: ['Nadi dosha (same nadi)'] }, yoniScore: 0 });
    expect(r.warnings.some(x => /Nadi/.test(x))).toBe(true);
    expect(r.warnings.some(x => /intimate energies/i.test(x))).toBe(true);
  });

  test('missing birth time shifts Vedic weight to engagement', () => {
    const w = computeCompatibility({ hasBirthTime: false }).weights;
    expect(w.vedic).toBe(0.10);
    expect(w.engagement).toBe(0.30);
  });
});
