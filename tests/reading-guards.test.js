// tests/reading-guards.test.js — the reading engine's safety validators.
//
// These are the load-bearing rules of the whole feature: no astrology jargon
// reaches a user, and the future is never promised. Every test is capable of
// failing, and the spec's own before/after examples are used as fixtures so the
// guards are proven against the exact strings the product must never/always emit.

const {
  findJargon, isClean, hardFutureViolation, softenFuture, enforceGentleFuture
} = require('../src/services/reading-guards');

describe('jargon guard — banned terms are caught', () => {
  // The spec's "Banned" left-hand column — every one must be flagged.
  test.each([
    ['Moon in Purva Ashadha gives you an invincible spirit.', /moon|purva ashadha/i],
    ['Venus is debilitated so you are critical of partners.', /venus/i],
    ['Look for someone whose Moon steadies yours.', /moon/i],
    ['Mangal dosha is present.', /mangal|dosha/i],
    ['You are in a favourable Venus period.', /venus/i],
    ['Your 7th house shows marriage.', /house/i],
    ['This is due to your Mangal dosha and Saturn dasha.', /mangal|dosha|saturn|dasha/i],
    ['A strong Lagna gives confidence.', /lagna/i],
    ['Your Rahu is in the 10th house.', /rahu|house/i],
    ['Because your chart shows a Kaal Sarp yoga.', /because your chart|kaal sarp|yoga/i]
  ])('flags %j', (text) => {
    expect(isClean(text)).toBe(false);
    expect(findJargon(text)).toBeTruthy();
  });

  test.each([
    'aries', 'Scorpio', 'Libra rising', 'a Cancer sun', 'her Vrischika moon',
    'the nakshatra of your birth', 'guna milan', 'your kundali', 'navamsa chart'
  ])('flags the technical phrase %j', (text) => {
    expect(isClean(text)).toBe(false);
  });
});

describe('jargon guard — the target plain-language strings pass clean', () => {
  // The spec's "Target" right-hand column — every one must be allowed.
  test.each([
    "You don't quit — not on goals, not on people.",
    'You hold a picture of the right person so clearly that real people get measured against it and fall short.',
    "Your person is calm and steady — someone who doesn't flinch when you get intense.",
    "You bring heat to a relationship. With the wrong person that's friction. With the right one it's passion.",
    'The next few months are unusually open for you. Say yes more than you normally would.',
    'Grounded, warms up slowly.',
    'You get restless when things settle into routine.'
  ])('allows %j', (text) => {
    expect(isClean(text)).toBe(true);
    expect(findJargon(text)).toBeNull();
  });

  test('ordinary English that merely resembles nothing banned is clean', () => {
    expect(isClean('You are warm, direct, and a little impatient with small talk.')).toBe(true);
    expect(isClean('You light up around people you trust.')).toBe(true);   // "light up", not "sun"
  });

  test('empty / null input is treated as clean (nothing to leak)', () => {
    expect(isClean('')).toBe(true);
    expect(isClean(null)).toBe(true);
    expect(isClean(undefined)).toBe(true);
  });
});

describe('future guard — hard promises near a time reference are violations', () => {
  test.each([
    'You will meet someone next month.',
    'You are going to fall in love this year.',
    "You're destined to marry within a year.",
    'Success is guaranteed in the coming months.',
    'You shall find your person soon.'
  ])('flags %j', (text) => {
    expect(hardFutureViolation(text)).toBe(true);
  });

  test.each([
    'The next few months are unusually open for you.',        // gentle window — no hard-future word
    'You tend to move fast once you decide.',
    'You may find the right person when you stop measuring everyone against a picture.',
    'You are calm and steady.',                               // identity — no time reference
    'You will remember this'                                   // hard-future word but NO time reference
  ])('does NOT flag the gentle/identity form %j', (text) => {
    expect(hardFutureViolation(text)).toBe(false);
  });
});

describe('future guard — softening', () => {
  test('softens a hard promise into a window, and the result no longer violates', () => {
    const out = enforceGentleFuture('You will meet someone next month.');
    expect(out).toBe('You may meet someone next month.');
    expect(hardFutureViolation(out)).toBe(false);
  });

  test('softens "destined to" / "going to" / "guaranteed"', () => {
    expect(softenFuture('You are destined to lead.')).toMatch(/well-placed to lead/i);
    expect(softenFuture('It is going to work out.')).toMatch(/likely to work out/i);
    expect(softenFuture('This is guaranteed.')).toMatch(/likely/i);
  });

  test('a gentle statement is returned unchanged', () => {
    const gentle = 'The next few months are unusually open for you.';
    expect(enforceGentleFuture(gentle)).toBe(gentle);
  });

  test('enforceGentleFuture always yields a non-violating string (property over the violations)', () => {
    for (const t of [
      'You will win next week.', "You're going to be rich this year.",
      'You are fated to succeed tomorrow.', 'guaranteed love in the coming months'
    ]) {
      expect(hardFutureViolation(enforceGentleFuture(t))).toBe(false);
    }
  });
});
