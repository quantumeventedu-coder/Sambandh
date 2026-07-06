// Tests for our own face verification — descriptor distance, validation, match,
// and duplicate-face (ban-evasion) detection. No external service.

const f = require('../src/services/face-engine');

// Build a 128-d descriptor; `base` shifts every value so we can control distance.
const desc = (base = 0.1, jitter = 0) => Array.from({ length: 128 }, (_, i) => base + jitter * Math.sin(i));

describe('faceDistance + validation', () => {
  test('identical descriptors have distance 0', () => {
    const d = desc(0.1, 0.05);
    expect(f.faceDistance(d, d)).toBe(0);
  });

  test('isValidDescriptor accepts a real 128-d vector and rejects garbage', () => {
    expect(f.isValidDescriptor(desc(0.1, 0.05))).toBe(true);
    expect(f.isValidDescriptor(new Array(127).fill(0.1))).toBe(false);   // wrong length
    expect(f.isValidDescriptor(new Array(128).fill(0))).toBe(false);     // blank/black frame
    expect(f.isValidDescriptor('not a vector')).toBe(false);
  });

  test('normalizeDescriptor handles arrays, keyed objects, and JSON strings', () => {
    expect(f.normalizeDescriptor([1, 2, 3])).toEqual([1, 2, 3]);
    expect(f.normalizeDescriptor({ 0: 1, 1: 2 })).toEqual([1, 2]);
    expect(f.normalizeDescriptor('[4,5,6]')).toEqual([4, 5, 6]);
  });
});

describe('matchFaces', () => {
  test('near-identical faces match; distant faces do not', () => {
    const a = desc(0.10, 0.02);
    const near = desc(0.10, 0.021);        // tiny perturbation → same person
    const far = desc(0.9, 0.3);            // very different → different person
    expect(f.matchFaces(a, near).matched).toBe(true);
    expect(f.matchFaces(a, far).matched).toBe(false);
    expect(f.matchFaces(a, a).distance).toBe(0);
  });
});

describe('findDuplicateFaces (ban-evasion / duplicate identity)', () => {
  test('flags the same face on another account and ignores different faces', () => {
    const mine = desc(0.10, 0.02);
    const others = [
      { userId: 'A', descriptor: desc(0.10, 0.021) }, // same person, different account
      { userId: 'B', descriptor: desc(0.9, 0.3) },    // unrelated person
      { userId: 'C', descriptor: desc(0.85, 0.25) }   // unrelated person
    ];
    const hits = f.findDuplicateFaces(mine, others);
    expect(hits.map(h => h.userId)).toEqual(['A']);
    expect(hits[0].distance).toBeLessThan(f.FACE_MATCH_THRESHOLD);
  });

  test('returns nothing when there are no duplicates', () => {
    const mine = desc(0.10, 0.02);
    const hits = f.findDuplicateFaces(mine, [{ userId: 'X', descriptor: desc(0.9, 0.3) }]);
    expect(hits).toHaveLength(0);
  });
});
