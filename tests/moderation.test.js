// Tests for the image-moderation decision policy (NSFWJS class scores → allow/
// review/block). Pure logic; the classification itself runs client-side.

const { classifyDecision, screenPhotos } = require('../src/services/moderation');

describe('classifyDecision', () => {
  test('a clearly neutral photo is allowed', () => {
    const r = classifyDecision({ neutral: 0.97, drawing: 0.01, sexy: 0.01, hentai: 0, porn: 0.01 });
    expect(r.decision).toBe('allow');
    expect(r.category).toBe('neutral');
  });

  test('explicit content is blocked', () => {
    expect(classifyDecision({ neutral: 0.05, sexy: 0.2, hentai: 0.05, porn: 0.7 }).decision).toBe('block');
    expect(classifyDecision({ neutral: 0.1, hentai: 0.65, porn: 0.2, sexy: 0.05 }).decision).toBe('block');
  });

  test('suggestive-but-not-explicit is sent to human review', () => {
    const r = classifyDecision({ neutral: 0.2, sexy: 0.78, hentai: 0.0, porn: 0.02, drawing: 0 });
    expect(r.decision).toBe('review');
  });

  test('nsfwScore weights porn/hentai fully and sexy half', () => {
    const r = classifyDecision({ neutral: 0.5, sexy: 0.4, hentai: 0, porn: 0.1 });
    expect(r.nsfwScore).toBeCloseTo(0.1 + 0.5 * 0.4, 3); // 0.30
  });

  test('handles missing / partial scores without throwing', () => {
    expect(classifyDecision({}).decision).toBe('allow');
    expect(classifyDecision({ porn: 1 }).decision).toBe('block');
  });
});

describe('screenPhotos', () => {
  test('separates blocked, review and allowed photos by index', () => {
    const { blocked, review, decisions } = screenPhotos([
      { neutral: 0.98, porn: 0.01 },              // allow
      { porn: 0.9 },                              // block
      { neutral: 0.2, sexy: 0.8 },                // review
      undefined                                   // no scores → skipped
    ]);
    expect(blocked).toEqual([1]);
    expect(review).toEqual([2]);
    expect(decisions[0].decision).toBe('allow');
    expect(decisions[3]).toBeNull();
  });
});
