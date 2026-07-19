// tests/feature-guard.test.js — the guardrails that MUST hold before any CV code
// is allowed to write temperament features. These encode the two hard ethical
// lines of the product as executable policy:
//   Line 1: complexion / skin-tone is NEVER a character signal.
//   Line 2: a CV-derived feature is a READING, never "verified".
// Plus: separate consent, geometry-only vocabulary, and "self-declared wins".

const fg = require('../src/services/feature-guard');

describe('LINE 1 — complexion/skin-tone is never a character signal', () => {
  test('assertGeometricOnly rejects a complexion KEY', () => {
    for (const bad of ['skinTone', 'complexion', 'skin', 'colour', 'fairness']) {
      expect(() => fg.assertGeometricOnly({ [bad]: 'anything' })).toThrow(/complexion|skin|not a CV-measurable/i);
    }
  });

  test('assertGeometricOnly rejects a complexion VALUE on an allowed field', () => {
    for (const bad of ['fair', 'wheatish', 'dusky', 'dark']) {
      expect(() => fg.assertGeometricOnly({ eyes: bad })).toThrow(/complexion|skin|not an allowed value/i);
    }
  });

  test('applyCvFeatures throws hard if CV ever emits a complexion field', () => {
    const user = { cvConsent: { geometry: true } };
    expect(() => fg.applyCvFeatures(user, { complexion: 'fair' })).toThrow(/complexion|skin/i);
    expect(() => fg.applyCvFeatures(user, { build: 'dusky' })).toThrow(/complexion|skin/i);
  });

  test('the complexion regex has no false positives on real geometric values', () => {
    // none of the legitimate vocabulary trips the skin/colour guard
    for (const [k, vals] of Object.entries(fg.CV_MEASURABLE)) {
      expect(fg.COMPLEXION_RE.test(k)).toBe(false);
      for (const v of vals) expect(fg.COMPLEXION_RE.test(v)).toBe(false);
    }
  });
});

describe('LINE 2 — a CV-derived feature is a reading, never verified', () => {
  test('featureBadgeKind is "reading" for every provenance (no path to fact)', () => {
    expect(fg.featureBadgeKind('cv')).toBe('reading');
    expect(fg.featureBadgeKind('self')).toBe('reading');
    expect(fg.featureBadgeKind(undefined)).toBe('reading');
    expect(fg.featureBadgeKind('verified')).toBe('reading');   // even if asked, never "fact"
  });
});

describe('separate consent is required', () => {
  test('no consent → refuses to write (403-style ForbiddenError)', () => {
    expect(() => fg.applyCvFeatures({}, { build: 'solid' })).toThrow(/consent/i);
    expect(() => fg.applyCvFeatures({ cvConsent: { geometry: false } }, { build: 'solid' })).toThrow(/consent/i);
  });

  test('consent via the user record OR an explicit opts flag unlocks the write', () => {
    expect(fg.applyCvFeatures({ cvConsent: { geometry: true } }, { build: 'solid' }).written).toEqual(['build']);
    expect(fg.applyCvFeatures({}, { build: 'solid' }, { consent: true }).written).toEqual(['build']);
  });

  test('photo/verification consent does NOT imply geometry consent', () => {
    // a user who is photo-verified but never opted into the geometric read
    const user = { verification: { selfieVerified: true }, cvConsent: { geometry: false } };
    expect(() => fg.applyCvFeatures(user, { eyes: 'sharp' })).toThrow(/consent/i);
  });
});

describe('geometry-only vocabulary + graceful dropping', () => {
  const user = { cvConsent: { geometry: true } };

  test('drops non-measurable fields and invalid values silently, keeps valid geometry', () => {
    const r = fg.applyCvFeatures(user, {
      build: 'solid',            // valid → kept
      eyes: 'purple',            // invalid value → dropped
      voice: 'deep',             // not CV-measurable → dropped
      height: '183cm'            // unknown field → dropped
    });
    expect(r.features).toEqual({ build: 'solid' });
    expect(r.featureSources).toEqual({ build: 'cv' });
    expect(r.written).toEqual(['build']);
  });

  test('CV-written fields are provenance-tagged cv (→ reading badge)', () => {
    const r = fg.applyCvFeatures(user, { forehead: 'broad', gait: 'measured' });
    expect(r.featureSources.forehead).toBe('cv');
    expect(fg.featureBadgeKind(r.featureSources.forehead)).toBe('reading');
  });
});

describe('self-declared always wins over a CV guess', () => {
  test('CV never overwrites a field the user declared themselves', () => {
    const user = {
      features: { build: 'lean', eyes: 'soft' },
      featureSources: { build: 'self', eyes: 'self' },
      cvConsent: { geometry: true }
    };
    const r = fg.applyCvFeatures(user, { build: 'solid', eyes: 'sharp', forehead: 'high' });
    expect(r.features.build).toBe('lean');       // user's word kept
    expect(r.features.eyes).toBe('soft');         // user's word kept
    expect(r.features.forehead).toBe('high');     // only the undeclared field filled
    expect(r.written).toEqual(['forehead']);
    expect(r.featureSources.build).toBe('self');
  });

  test('a pre-existing untagged (legacy self-declared) value is not overwritten', () => {
    const user = { features: { build: 'lean' }, featureSources: {}, cvConsent: { geometry: true } };
    const r = fg.applyCvFeatures(user, { build: 'solid' });
    expect(r.features.build).toBe('lean');
    expect(r.written).toEqual([]);
  });

  test('determinism — same input yields the same patch', () => {
    const call = () => fg.applyCvFeatures({ cvConsent: { geometry: true } }, { build: 'solid', forehead: 'broad' });
    expect(call()).toEqual(call());
  });
});
