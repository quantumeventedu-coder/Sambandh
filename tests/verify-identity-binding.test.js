// tests/verify-identity-binding.test.js — the selfie decision must bind to the PROVEN-LIVE face.
// Guards the fix for two confirmed audit findings: enrolment-poisoning (a real live face enrolling a
// junk/stranger descriptor to evade a ban) and the ID-match bypass. The descriptor we ENROL/dedup/match
// on is always the frames' own descriptor — never a raw client field — and a client-claimed face is
// accepted only if it IS the live face.

const { bindLiveIdentity } = require('../src/services/verify-engine');

const ME = Array(128).fill(0.1);       // the proven-live face (all frames carry it)
const STRANGER = Array(128).fill(0.9); // a different identity (distance ≫ 0.55 cutoff)

const framesOf = (d) => [{ descriptor: d }, { descriptor: d }, { descriptor: d }];
const LIVE = { live: true, reason: 'Liveness confirmed', checks: [{ check: 'motion', pass: true }] };
const NOT_LIVE = { live: false, reason: 'Liveness not proven (motion)', checks: [{ check: 'motion', pass: false }] };
const pass = (r, name) => r.checks.find(c => c.check === name)?.pass;

describe('bindLiveIdentity', () => {
  test('live capture, no client claims → approved and enrols the LIVE frame descriptor', () => {
    const r = bindLiveIdentity(LIVE, framesOf(ME), null, null);
    expect(r.approved).toBe(true);
    expect(r.enrolledDesc).toEqual(ME);                 // enrols the frames' face, not a client field
  });

  test('a client faceDescriptor that IS the live face is accepted; we still enrol the live descriptor', () => {
    const r = bindLiveIdentity(LIVE, framesOf(ME), ME, null);
    expect(r.approved).toBe(true);
    expect(pass(r, 'enrolment_bound_to_live')).toBe(true);
    expect(r.enrolledDesc).toEqual(ME);
  });

  test('ENROLMENT POISONING is rejected: real live face but a stranger/junk enrol descriptor', () => {
    const r = bindLiveIdentity(LIVE, framesOf(ME), STRANGER, null);
    expect(r.approved).toBe(false);
    expect(pass(r, 'enrolment_bound_to_live')).toBe(false);
    expect(r.reason).toMatch(/does not match the live capture/i);
    // Crucially, we would still only ever enrol the LIVE face, never the stranger's descriptor.
    expect(r.enrolledDesc).toEqual(ME);
  });

  test('ID match runs against the LIVE face: a matching ID face passes, a different one fails', () => {
    expect(bindLiveIdentity(LIVE, framesOf(ME), null, ME).approved).toBe(true);
    const bad = bindLiveIdentity(LIVE, framesOf(ME), null, STRANGER);
    expect(bad.approved).toBe(false);
    expect(pass(bad, 'id_face_match')).toBe(false);
    expect(bad.reason).toMatch(/does not match your ID/i);
  });

  test('no liveness → rejected regardless of matching descriptors', () => {
    const r = bindLiveIdentity(NOT_LIVE, framesOf(ME), ME, ME);
    expect(r.approved).toBe(false);
    expect(r.reason).toMatch(/liveness/i);
  });

  test('frames with no usable descriptor → not approved (nothing to bind to)', () => {
    const r = bindLiveIdentity(LIVE, [{ descriptor: null }, { descriptor: [1, 2, 3] }], null, null);
    expect(r.approved).toBe(false);
    expect(r.enrolledDesc).toBeNull();
  });
});
