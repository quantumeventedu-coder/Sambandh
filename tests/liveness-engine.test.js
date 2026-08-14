// tests/liveness-engine.test.js — proves the IN-HOUSE active-liveness CV works: it detects real
// blinks + head turns from 68-point landmark geometry, holds identity across frames, and REJECTS a
// static photo, an identity swap, an expired challenge, and too-short captures.

const liveness = require('../src/services/liveness-engine');

const DESC = Array(128).fill(0.1);       // one "person"
const OTHER = Array(128).fill(0.9);      // a different person (descriptor distance ≫ 0.55 cutoff)

/** Build a 68-landmark frame with a target eye-aspect-ratio and head-yaw. Only the indices the engine
 * reads (both eyes, nose tip, eye corners) carry signal; the rest are valid filler. */
function face(ear, yaw, t, descriptor = DESC) {
  const lm = Array.from({ length: 68 }, () => ({ x: 0, y: 0 }));
  const v = ear * 15;                     // right/left eye horizontal span = 30 ⇒ EAR = 2v/30 = ear
  // right eye 36(outer) 37 38 39(inner) 40 41
  lm[36] = { x: 100, y: 150 }; lm[39] = { x: 130, y: 150 };
  lm[37] = { x: 110, y: 150 - v }; lm[41] = { x: 110, y: 150 + v };
  lm[38] = { x: 120, y: 150 - v }; lm[40] = { x: 120, y: 150 + v };
  // left eye 42(outer) 43 44 45(inner) 46 47
  lm[42] = { x: 200, y: 150 }; lm[45] = { x: 230, y: 150 };
  lm[43] = { x: 210, y: 150 - v }; lm[47] = { x: 210, y: 150 + v };
  lm[44] = { x: 220, y: 150 - v }; lm[46] = { x: 220, y: 150 + v };
  // nose tip 30: yaw = (noseX - center)/eyeSpan, with eyeOuterR(36)=100, eyeOuterL(45)=230 ⇒ span 130, center 165
  lm[30] = { x: 165 + yaw * 130, y: 180 };
  return { landmarks: lm, descriptor, t };
}

// A genuine capture: blink, then a left turn, then a right turn, over ~2.1s.
const liveCapture = () => [
  face(0.30, 0, 0), face(0.10, 0, 300), face(0.30, 0, 600),        // blink (EAR valley)
  face(0.30, -0.30, 900), face(0.30, 0, 1200),                     // turn left  (yaw < -0.18)
  face(0.30, 0.30, 1500), face(0.30, 0, 1800), face(0.30, 0, 2100),// turn right (yaw > +0.18)
];

describe('liveness CV primitives', () => {
  test('eyeAspectRatio + headYaw are computed from landmark geometry', () => {
    const f = face(0.30, -0.30, 0);
    expect(liveness.eyeAspectRatio(f.landmarks)).toBeCloseTo(0.30, 2);
    expect(liveness.headYaw(f.landmarks)).toBeCloseTo(-0.30, 2);
  });
});

describe('verifyLiveness', () => {
  test('a real blink + left + right capture PASSES its challenge', () => {
    const r = liveness.verifyLiveness({ actions: ['blink', 'turn_left', 'turn_right'], issuedAt: 0 }, liveCapture(), 1000);
    expect(r.live).toBe(true);
  });

  test('a STATIC photo (no blink, no turn, no motion) is REJECTED', () => {
    const still = Array.from({ length: 10 }, (_, i) => face(0.30, 0, i * 200));
    const r = liveness.verifyLiveness({ actions: ['blink', 'turn_left'], issuedAt: 0 }, still, 1000);
    expect(r.live).toBe(false);
    expect(r.checks.find(c => c.check === 'motion').pass).toBe(false);
    expect(r.checks.find(c => c.check === 'action:blink').pass).toBe(false);
  });

  test('an IDENTITY SWAP mid-capture is REJECTED', () => {
    const frames = liveCapture();
    frames[3] = face(0.30, -0.30, 900, OTHER);                     // a different face sneaks in
    const r = liveness.verifyLiveness({ actions: ['blink', 'turn_left'], issuedAt: 0 }, frames, 1000);
    expect(r.live).toBe(false);
    expect(r.checks.find(c => c.check === 'identity_consistent').pass).toBe(false);
  });

  test('an EXPIRED challenge is REJECTED even with a perfect capture', () => {
    const r = liveness.verifyLiveness({ actions: ['blink'], issuedAt: 0 }, liveCapture(), liveness.CHALLENGE_TTL_MS + 1);
    expect(r.live).toBe(false);
    expect(r.reason).toMatch(/expired/i);
  });

  test('too few frames / too short a capture is REJECTED', () => {
    const short = [face(0.30, 0, 0), face(0.10, 0, 100), face(0.30, 0, 200)];   // 3 frames, 200ms
    expect(liveness.verifyLiveness({ actions: ['blink'], issuedAt: 0 }, short, 1000).live).toBe(false);
  });

  test('the WRONG action fails: a blink-only capture cannot satisfy a turn challenge', () => {
    const blinkOnly = [
      face(0.30, 0, 0), face(0.10, 0, 300), face(0.30, 0, 600), face(0.28, 0, 900),
      face(0.30, 0, 1200), face(0.12, 0, 1500), face(0.30, 0, 1800), face(0.30, 0, 2100),
    ];
    const r = liveness.verifyLiveness({ actions: ['blink', 'turn_left'], issuedAt: 0 }, blinkOnly, 1000);
    expect(r.live).toBe(false);
    expect(r.checks.find(c => c.check === 'action:turn_left').pass).toBe(false);
    expect(r.checks.find(c => c.check === 'action:blink').pass).toBe(true);   // the blink WAS seen
  });

  test('randomActions yields 2–3 distinct valid actions', () => {
    let rng = 0.42; const seq = liveness.randomActions(() => (rng = (rng * 9301 + 49297) % 233280 / 233280));
    expect(seq.length).toBeGreaterThanOrEqual(2);
    expect(new Set(seq).size).toBe(seq.length);
    expect(seq.every(a => liveness.ACTIONS.includes(a))).toBe(true);
  });
});
