// tests/reading-engine.test.js — the deterministic reading backbone.
//
// Proves the acceptance criteria: same inputs → same backbone; confidence tracks
// how many layers agree; NO astrology jargon in any user-facing output; a
// one-layer reading renders low-confidence and softened; timing is never a hard
// promise.

const engine = require('../src/services/reading-engine');
const guards = require('../src/services/reading-guards');
const R = require('../src/data/reading-rules');
const astro = require('../src/services/astro-engine');

// --- synthetic layer fixtures (minimal shapes the rules read) ---
const earthMoon = { moonSign: 'Taurus', planets: { Venus: {}, Saturn: {}, Sun: {} }, doshas: [], dasha: { current: { lord: 'Jupiter' } } };
const mangalFireRahu = { moonSign: 'Aries', planets: { Venus: {}, Saturn: {}, Sun: {} }, doshas: [{ name: 'Mangal Dosha (Manglik)' }], dasha: { current: { lord: 'Rahu' } } };
const groundedFeatures = { build: 'solid', voice: 'deep' };
const groundedBehaviour = { bigFive: { conscientiousness: { level: 'high' } } };

describe('confidence tracks layer agreement', () => {
  test('all three layers agree → confidence 5, stated firmly (not softened)', () => {
    const inputs = { chart: earthMoon, features: groundedFeatures, behaviour: groundedBehaviour };
    const { tag, confidence } = engine.dominant(engine.gather(inputs));
    expect(tag).toBe('grounded');
    expect(confidence).toBe(5);
    const r = engine.read('who_you_are', inputs);
    expect(r.confidence).toBe(5);
    expect(r.sourceLayers.sort()).toEqual(['behaviour', 'chart', 'features']);
    expect(r.answer).not.toMatch(/you might find|probably/i);   // firm, not hedged
  });

  test('one layer → confidence 2, softened', () => {
    const r = engine.read('who_you_are', { features: { build: 'lean' } });   // → restless, features only
    expect(r.confidence).toBe(2);
    expect(r.sourceLayers).toEqual(['features']);
    expect(r.answer).toMatch(/^you might find that/i);          // softened
  });

  test('two layers → confidence 4', () => {
    const inputs = { chart: earthMoon, features: groundedFeatures };          // chart + features agree
    expect(engine.dominant(engine.gather(inputs)).confidence).toBe(4);
  });

  test('no inputs → safe fallback, low confidence, still clean', () => {
    const r = engine.read('who_you_are', {});
    expect(r.confidence).toBe(1);
    expect(guards.isClean(r.answer)).toBe(true);
    expect(r.answer).toBe(R.SAFE_FALLBACK.who_you_are);
  });
});

describe('determinism', () => {
  test('the same inputs always produce the same backbone', () => {
    const inputs = { chart: mangalFireRahu, features: { eyes: 'sharp', voice: 'quick' }, behaviour: { attachment: { style: 'Anxious (Preoccupied)' } } };
    const a = engine.readAll(inputs);
    const b = engine.readAll(inputs);
    expect(a).toEqual(b);
  });
});

describe('who_you_are prefers the chart phrasing when the chart supports the tag', () => {
  test('grounded from chart uses the chart line', () => {
    const r = engine.read('who_you_are', { chart: earthMoon, features: groundedFeatures, behaviour: groundedBehaviour });
    expect(r.answer).toBe("You're steady, and you build things to last.");
  });
});

describe('your_person uses the concrete love-language fit when chat behaviour is present', () => {
  test('quality-time love language yields the "shows up" line (softened at low confidence)', () => {
    const r = engine.read('your_person', { chart: earthMoon, behaviour: { loveLanguage: { primary: 'Quality Time' } } });
    expect(r.answer).toContain('shows up and gives you their time');
    // High confidence (three layers agree) keeps it firm.
    const firm = engine.read('your_person', { chart: earthMoon, features: groundedFeatures, behaviour: { loveLanguage: { primary: 'Quality Time' }, bigFive: { conscientiousness: { level: 'high' } } } });
    expect(firm.answer).toBe('Someone who actually shows up and gives you their time.');
  });
});

describe('your_timing is gentle — never a hard promise', () => {
  test.each([
    ['Jupiter', 'benefic → open window'],
    ['Saturn', 'harder → inward season'],
    [undefined, 'no chart → safe fallback']
  ])('timing under %s is not a hard-future violation', (lord) => {
    const chart = lord ? { moonSign: 'Taurus', planets: {}, doshas: [], dasha: { current: { lord } } } : undefined;
    const r = engine.read('your_timing', chart ? { chart } : {});
    expect(guards.hardFutureViolation(r.answer)).toBe(false);
    expect(guards.isClean(r.answer)).toBe(true);
  });
});

describe('NO jargon in ANY user-facing output, across a matrix of inputs', () => {
  const charts = [earthMoon, mangalFireRahu,
    { moonSign: 'Cancer', planets: { Venus: { dignity: 'debilitated' }, Saturn: { dignity: 'exalted', house: 7 }, Sun: { dignity: 'own sign' } }, doshas: [], dasha: { current: { lord: 'Venus' } } },
    { moonSign: 'Gemini', planets: { Venus: {}, Saturn: {}, Sun: {} }, doshas: [], dasha: { current: { lord: 'Saturn' } } }];
  const featureSets = [undefined, groundedFeatures, { forehead: 'broad', hands: 'long', gait: 'fast' }, { eyes: 'deepset', build: 'sturdy' }];
  const behaviours = [undefined, groundedBehaviour,
    { attachment: { style: 'Avoidant (Dismissive)' }, bigFive: { neuroticism: { level: 'high' } }, loveLanguage: { primary: 'Physical Touch' } }];

  test('every question, every combination, is jargon-free and non-empty', () => {
    let checked = 0;
    for (const chart of charts) for (const features of featureSets) for (const behaviour of behaviours) {
      const inputs = { chart, features, behaviour };
      for (const q of engine.QUESTIONS) {
        const r = engine.read(q, inputs);
        expect(typeof r.answer).toBe('string');
        expect(r.answer.length).toBeGreaterThan(0);
        expect(guards.findJargon(r.answer)).toBeNull();
        checked++;
      }
      expect(guards.findJargon(engine.discoverLine(inputs))).toBeNull();
    }
    expect(checked).toBeGreaterThan(100);   // a real matrix, not a token check
  });
});

describe('every authored rule phrase is itself jargon-clean', () => {
  test('reading-rules strings never contain a banned term', () => {
    const strings = [];
    for (const s of R.CHART_SIGNALS) strings.push(s.who, s.pattern, s.person);
    for (const field of Object.values(R.FEATURE_TEMPERAMENT)) for (const v of Object.values(field)) strings.push(v.phrase);
    strings.push(...Object.values(R.PERSON_FIT), ...Object.values(R.DISCOVER_LINE), ...Object.values(R.TAG_ADJ),
      ...Object.values(R.TIMING), ...Object.values(R.SAFE_FALLBACK));
    for (const s of strings) expect(guards.findJargon(s)).toBeNull();
  });
});

describe('discoverLine', () => {
  test('returns a clean short label; empty input → default', () => {
    expect(engine.discoverLine({ chart: earthMoon })).toBe('Grounded, warms up slowly');
    expect(engine.discoverLine({})).toBe('Warm and direct');
    expect(guards.isClean(engine.discoverLine({ chart: mangalFireRahu }))).toBe(true);
  });
});

describe('compatibility (pair reading)', () => {
  test('no charts → tag-only line, still clean, low confidence', () => {
    const r = engine.compatibility({ features: { build: 'lean' } }, { features: { build: 'solid' } });
    expect(r.question).toBe('compatibility');
    expect(guards.isClean(r.answer)).toBe(true);
    expect(r.answer).toMatch(/you're .*they're /i);
    expect(r.confidence).toBe(2);
  });

  test('real computed charts → clean line + score-based confidence', () => {
    const a = astro.computeChart({ birthDate: '1992-04-10', birthTime: '08:30', birthPlace: { lat: 19.07, lng: 72.87 } });
    const b = astro.computeChart({ birthDate: '1994-11-22', birthTime: '21:15', birthPlace: { lat: 28.61, lng: 77.20 } });
    const r = engine.compatibility({ chart: a }, { chart: b });
    expect(guards.isClean(r.answer)).toBe(true);
    expect(r.confidence).toBeGreaterThanOrEqual(3);
  });
});

describe('integration: a real computed chart reads clean end-to-end', () => {
  test('readAll on a real chart + features + behaviour has zero jargon', () => {
    const chart = astro.computeChart({ birthDate: '1990-05-15', birthTime: '10:30', birthPlace: { lat: 12.97, lng: 77.59 } });
    const inputs = { chart, features: { eyes: 'sharp', voice: 'deep', build: 'solid' }, behaviour: { attachment: { style: 'Secure' }, loveLanguage: { primary: 'Acts of Service' } } };
    const all = engine.readAll(inputs);
    for (const q of engine.QUESTIONS) {
      expect(guards.findJargon(all[q].answer)).toBeNull();
      expect(guards.hardFutureViolation(all[q].answer)).toBe(false);
    }
  });
});
