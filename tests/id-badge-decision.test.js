// tests/id-badge-decision.test.js — the government-ID BADGE decision (fully automated, no third party,
// document NEVER stored). It grants only when the bytes are authentic (Trust Engine not reject/hard-fail)
// AND the face on the ID matches the user's already-verified live selfie face; it fails CLOSED when the
// face can't be compared. The name is a soft corroborating signal only.

const { decideIdBadge } = require('../src/services/verify-engine');

const ME = Array(128).fill(0.1);        // the user's enrolled, proven-live selfie face
const STRANGER = Array(128).fill(0.9);  // a different person (distance ≫ the 0.55 cutoff)
const AUTHENTIC = { decision: 'secondary', hardFail: false };   // Trust Engine: not reject, not hard-fail
const pass = (r, n) => r.checks.find(c => c.check === n)?.pass;

describe('decideIdBadge', () => {
  test('authentic ID whose face matches the verified selfie → approved', () => {
    const r = decideIdBadge({ trust: AUTHENTIC, enrolledFace: ME, idFace: ME });
    expect(r.approved).toBe(true);
    expect(pass(r, 'authenticity')).toBe(true);
    expect(pass(r, 'id_face_match')).toBe(true);
  });

  test('a DIFFERENT face on the ID → rejected (it must be YOUR ID)', () => {
    const r = decideIdBadge({ trust: AUTHENTIC, enrolledFace: ME, idFace: STRANGER });
    expect(r.approved).toBe(false);
    expect(pass(r, 'id_face_match')).toBe(false);
    expect(r.reason).toMatch(/does not match/i);
  });

  test('no readable face on the ID → rejected (fail closed, not a silent pass)', () => {
    const r = decideIdBadge({ trust: AUTHENTIC, enrolledFace: ME, idFace: null });
    expect(r.approved).toBe(false);
    expect(r.reason).toMatch(/read a clear face/i);
  });

  test('no enrolled selfie face → nothing to bind to → rejected', () => {
    expect(decideIdBadge({ trust: AUTHENTIC, enrolledFace: null, idFace: ME }).approved).toBe(false);
  });

  test('an INAUTHENTIC document is rejected even if the face matches', () => {
    expect(decideIdBadge({ trust: { decision: 'reject' }, enrolledFace: ME, idFace: ME }).approved).toBe(false);
    expect(decideIdBadge({ trust: { decision: 'secondary', hardFail: true }, enrolledFace: ME, idFace: ME }).approved).toBe(false);
  });

  test('the name check is SOFT — a name mismatch cannot override an authentic face match', () => {
    const r = decideIdBadge({ trust: AUTHENTIC, enrolledFace: ME, idFace: ME, profileName: 'Asha', ocrName: 'Totally Different' });
    expect(r.approved).toBe(true);
    expect(pass(r, 'name_match')).toBe(false);   // recorded, but not decisive
  });
});
