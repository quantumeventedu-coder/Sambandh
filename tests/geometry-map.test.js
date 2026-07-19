// tests/geometry-map.test.js — the PURE landmarks→features math (public/geometry-map.js),
// exercised with synthetic 68-point faces so the discretisation is deterministic and
// honest: only forehead + eyes are ever produced, build/gait/hands are reported
// `unmeasured` (never guessed), every value is in the shared vocabulary, and there is
// no pixel/colour input path at all — complexion cannot influence any output.

const geo = require('../public/geometry-map');
const { CV_MEASURABLE } = require('../src/services/feature-guard');

// Build a synthetic 68-pt face. Only the indices the mapper reads are meaningful;
// the rest are valid filler. faceW is fixed at 100 so ratios are readable.
function makeFace({ eyeW = 25, eyeOpen = 9, browSpan = 85 } = {}) {
  const lm = Array.from({ length: 68 }, () => ({ x: 50, y: 0 }));
  const faceW = 100;
  lm[0] = { x: 0, y: 0 }; lm[16] = { x: faceW, y: 0 };          // face width
  lm[8] = { x: 50, y: 60 };                                     // chin
  lm[19] = { x: 30, y: -20 }; lm[24] = { x: 70, y: -20 };       // brow peaks → browMid (50,-20)
  lm[17] = { x: 50 - browSpan / 2, y: -20 };                    // outer brows → browSpan
  lm[26] = { x: 50 + browSpan / 2, y: -20 };
  // left eye (36 outer,39 inner,37/38 top,41/40 bottom) centred at x=32,y=0
  const eye = (cx, oIdx, iIdx, t1, t2, b1, b2) => {
    lm[oIdx] = { x: cx - eyeW / 2, y: 0 }; lm[iIdx] = { x: cx + eyeW / 2, y: 0 };
    lm[t1] = { x: cx - eyeW / 4, y: -eyeOpen / 2 }; lm[t2] = { x: cx + eyeW / 4, y: -eyeOpen / 2 };
    lm[b1] = { x: cx - eyeW / 4, y: eyeOpen / 2 }; lm[b2] = { x: cx + eyeW / 4, y: eyeOpen / 2 };
  };
  eye(32, 36, 39, 37, 38, 41, 40);
  eye(68, 42, 45, 43, 44, 47, 46);
  return lm;
}

describe('honesty of scope — never guesses what it cannot measure', () => {
  test('build, gait and hands are always reported unmeasured (need a body-pose model)', () => {
    const r = geo.geometryToFeatures(makeFace());
    expect(r.unmeasured).toEqual(expect.arrayContaining(['build', 'gait', 'hands']));
    expect(r.features).not.toHaveProperty('build');
    expect(r.features).not.toHaveProperty('gait');
    expect(r.features).not.toHaveProperty('hands');
  });

  test('every emitted value is in the shared CV vocabulary (agrees with feature-guard)', () => {
    const r = geo.geometryToFeatures(makeFace({ eyeW: 28, eyeOpen: 12, browSpan: 95 }));
    for (const [k, v] of Object.entries(r.features)) {
      expect(CV_MEASURABLE).toHaveProperty(k);
      expect(CV_MEASURABLE[k]).toContain(v);
    }
  });

  test('the function only accepts landmarks — there is no colour/pixel argument', () => {
    // 1-arity: a second (image/colour) argument cannot exist to influence output.
    expect(geo.geometryToFeatures.length).toBe(1);
  });
});

describe('eyes — size × openness discretisation', () => {
  test('wide + open → large', () => {
    expect(geo.geometryToFeatures(makeFace({ eyeW: 28, eyeOpen: 12 })).features.eyes).toBe('large');
  });
  test('open but not wide → soft', () => {
    expect(geo.geometryToFeatures(makeFace({ eyeW: 23, eyeOpen: 10 })).features.eyes).toBe('soft');
  });
  test('narrow opening, normal width → sharp', () => {
    expect(geo.geometryToFeatures(makeFace({ eyeW: 26, eyeOpen: 6 })).features.eyes).toBe('sharp');
  });
  test('narrow opening + small width → deepset', () => {
    expect(geo.geometryToFeatures(makeFace({ eyeW: 22, eyeOpen: 5 })).features.eyes).toBe('deepset');
  });
});

describe('forehead — brow-breadth proxy (approximate, confidence-capped)', () => {
  test('wide brow span → broad', () => {
    expect(geo.geometryToFeatures(makeFace({ browSpan: 95 })).features.forehead).toBe('broad');
  });
  test('narrow brow span → narrow', () => {
    expect(geo.geometryToFeatures(makeFace({ browSpan: 76 })).features.forehead).toBe('narrow');
  });
  test('mid brow span → high or even (never broad/narrow)', () => {
    const f = geo.geometryToFeatures(makeFace({ browSpan: 85 })).features.forehead;
    expect(['high', 'even']).toContain(f);
  });
  test('forehead confidence is capped (no hairline in 68-pt)', () => {
    const r = geo.geometryToFeatures(makeFace({ browSpan: 95 }));
    expect(r.confidence.forehead).toBeLessThanOrEqual(0.6);
  });
});

describe('body pose → build (structural proportion only)', () => {
  // synthetic keypoints: shoulders at y=0, hips lower; widths/heights set the ratios
  const pose = ({ sw, hipW, torsoH, score }) => ({
    left_shoulder: { x: 50 - sw / 2, y: 0, score },
    right_shoulder: { x: 50 + sw / 2, y: 0, score },
    left_hip: { x: 50 - hipW / 2, y: torsoH, score },
    right_hip: { x: 50 + hipW / 2, y: torsoH, score }
  });

  test('narrow frame for its height → lean', () => {
    expect(geo.poseToFeatures(pose({ sw: 20, hipW: 16, torsoH: 100 })).features.build).toBe('lean');
  });
  test('broad + tapered (V) → solid', () => {
    expect(geo.poseToFeatures(pose({ sw: 60, hipW: 30, torsoH: 70 })).features.build).toBe('solid');
  });
  test('broad but shoulders≈hips (blocky) → sturdy', () => {
    expect(geo.poseToFeatures(pose({ sw: 60, hipW: 58, torsoH: 70 })).features.build).toBe('sturdy');
  });
  test('mid breadth → balanced', () => {
    expect(geo.poseToFeatures(pose({ sw: 45, hipW: 38, torsoH: 70 })).features.build).toBe('balanced');
  });

  test('only build is produced — gait + hands stay unmeasured (never guessed)', () => {
    const r = geo.poseToFeatures(pose({ sw: 45, hipW: 38, torsoH: 70 }));
    expect(r.unmeasured).toEqual(['gait', 'hands']);
    expect(r.features).not.toHaveProperty('gait');
    expect(r.features).not.toHaveProperty('hands');
  });

  test('the emitted build value is in the shared vocabulary', () => {
    const v = geo.poseToFeatures(pose({ sw: 60, hipW: 30, torsoH: 70 })).features.build;
    expect(CV_MEASURABLE.build).toContain(v);
  });

  test('missing keypoints → nothing measured (build also unmeasured), no throw', () => {
    for (const bad of [null, {}, { left_shoulder: { x: 1, y: 2 } }, { left_shoulder: { x: 'a', y: 0 }, right_shoulder: {}, left_hip: {}, right_hip: {} }]) {
      const r = geo.poseToFeatures(bad);
      expect(r.features).toEqual({});
      expect(r.unmeasured).toContain('build');
    }
  });

  test('no colour/pixel argument (arity 1) + low keypoint scores lower confidence', () => {
    expect(geo.poseToFeatures.length).toBe(1);
    const hi = geo.poseToFeatures(pose({ sw: 60, hipW: 30, torsoH: 70, score: 1 })).confidence.build;
    const lo = geo.poseToFeatures(pose({ sw: 60, hipW: 30, torsoH: 70, score: 0.3 })).confidence.build;
    expect(lo).toBeLessThan(hi);
    expect(hi).toBeLessThanOrEqual(0.6);   // single-frame 2-D read is capped
  });
});

describe('robustness + determinism', () => {
  test('too-few / malformed landmarks → empty features, still marks unmeasured', () => {
    for (const bad of [null, [], [{ x: 1, y: 2 }], Array(68).fill({ x: 'a', y: 0 })]) {
      const r = geo.geometryToFeatures(bad);
      expect(r.features).toEqual({});
      expect(r.unmeasured).toContain('build');
    }
  });

  test('same landmarks → identical output', () => {
    const f = makeFace({ eyeW: 27, eyeOpen: 11, browSpan: 90 });
    expect(geo.geometryToFeatures(f)).toEqual(geo.geometryToFeatures(f));
  });

  test('confidentFeatures drops readings below the threshold', () => {
    const r = geo.geometryToFeatures(makeFace());
    const forced = { features: { eyes: 'large', forehead: 'broad' }, confidence: { eyes: 0.9, forehead: 0.2 } };
    expect(geo.confidentFeatures(forced, 0.45)).toEqual({ eyes: 'large' });   // forehead dropped
    // at 0.7 the capped-confidence forehead (0.6) is dropped, the eyes reading kept
    expect(geo.confidentFeatures(r, 0.7)).toEqual({ eyes: r.features.eyes });
  });
});
