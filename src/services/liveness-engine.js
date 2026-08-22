// @ts-check
// services/liveness-engine.js — IN-HOUSE active-liveness verification (no third party, no keys).
//
// The problem it solves: a 128-d face descriptor proves "this is a face that matches an ID", but a
// PRINTED PHOTO of that face produces the same descriptor — so descriptor-match alone is spoofable,
// and approving on it is a verification fail-open. Active liveness closes that: the server issues a
// RANDOM, single-use, time-boxed action challenge (blink / turn left / turn right); the client (which
// already runs @vladmandic/face-api locally) captures per-FRAME 68-point landmarks + a face
// descriptor while the user performs it; the SERVER re-derives the liveness signals from the raw
// landmarks — a real blink (eye-aspect-ratio valley), real head yaw in the requested directions,
// identity held constant across frames, and motion over plausible real time. A static photo can't
// blink or turn on command; a generic pre-recorded clip won't match the random challenge; a
// single-use nonce stops replay. (A real-time deepfake could still beat active liveness — a trained
// passive anti-spoof model is the documented next hardening. This defeats the common photo/replay
// attacks, which the previous descriptor-only path did not.)
//
// Trust model: identical to the existing descriptor flow — the client sends the landmark/descriptor
// evidence and the server does the math (so a client can't just claim "I blinked"). A future
// hardening is server-side re-detection from the raw frames (tfjs-node) for full anti-tamper.

const faceEngine = require('./face-engine');

// ---- tunables (all in ONE place) ---------------------------------------------------------------
const ACTIONS = /** @type {const} */ (['blink', 'turn_left', 'turn_right']);
const MIN_FRAMES = 8;              // enough temporal samples to see a valley / a turn
const MAX_FRAMES = 300;            // cap the sequence so a huge payload can't burn CPU (O(n) descriptor compares)
const MIN_DURATION_MS = 1200;      // the capture must span real time, not a burst of one frame
const MAX_DURATION_MS = 30000;     // and must be recent/bounded
const CHALLENGE_TTL_MS = 3 * 60 * 1000;
const EAR_OPEN = 0.24;             // eyes-open baseline must exceed this at some point
const EAR_CLOSED = 0.19;           // a blink drives EAR below this
const YAW_TURN = 0.18;             // |yaw| beyond this = a deliberate head turn (nose-offset / eye-span)
const IDENTITY_CONSISTENCY_MAX = 0.9;// cross-frame drift budget for ONE moving person: blinks + head
                                    // turns on mobile tiny-models drift the descriptor FAR more than a
                                    // static 1:1 match, so this is deliberately looser than the 0.55
                                    // person-match cutoff — still well below a genuine different-person
                                    // SWAP (≫1). Its only job is to catch a mid-capture identity swap.
const MIN_YAW_VARIATION = 0.05;    // a live capture's yaw/EAR must actually vary (a photo's is flat)

/** face-api 68-landmark indices. */
const L = { rightEye: [36, 37, 38, 39, 40, 41], leftEye: [42, 43, 44, 45, 46, 47], eyeOuterR: 36, eyeOuterL: 45, noseTip: 30 };

/** @param {{x:number,y:number}} a @param {{x:number,y:number}} b */
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

/** Eye-aspect-ratio for one eye's 6 landmarks: (‖p1-p5‖+‖p2-p4‖)/(2‖p0-p3‖). @param {any[]} pts @param {number[]} idx */
function earForEye(pts, idx) {
  const p = idx.map((i) => pts[i]);
  const horiz = dist(p[0], p[3]);
  if (horiz < 1e-6) return 1;                       // degenerate → treat as open (won't count as a blink)
  return (dist(p[1], p[5]) + dist(p[2], p[4])) / (2 * horiz);
}

/** Average EAR over both eyes. @param {any[]} pts */
function eyeAspectRatio(pts) { return (earForEye(pts, L.rightEye) + earForEye(pts, L.leftEye)) / 2; }

/** Head yaw proxy in [-~1, ~1]: nose-tip horizontal offset from the eye midpoint, normalised by eye
 * span. >0 = nose toward image-right, <0 = image-left. Robust to face scale. @param {any[]} pts */
function headYaw(pts) {
  const rr = pts[L.eyeOuterR], ll = pts[L.eyeOuterL], nose = pts[L.noseTip];
  const eyeSpan = Math.abs(ll.x - rr.x);
  if (eyeSpan < 1e-6) return 0;
  const center = (rr.x + ll.x) / 2;
  return (nose.x - center) / eyeSpan;
}

/** Validate one frame's shape: 68 {x,y} landmarks + a valid 128-d descriptor + a numeric timestamp. @param {any} f */
function isValidFrame(f) {
  return f && Array.isArray(f.landmarks) && f.landmarks.length === 68 &&
    f.landmarks.every((/** @type {any} */ p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)) &&
    faceEngine.isValidDescriptor(f.descriptor) && Number.isFinite(f.t);
}

/** variance of a numeric series. @param {number[]} xs */
function variance(xs) {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length;
}

/** Per-dimension MEDIAN of a set of equal-length descriptors — a robust "typical face" reference that
 * a bad first/edge detection, or a minority of swapped frames, can't drag. @param {number[][]} descs */
function medianDescriptor(descs) {
  const dim = descs[0].length, n = descs.length, out = new Array(dim);
  for (let i = 0; i < dim; i++) {
    const col = descs.map((d) => d[i]).sort((a, b) => a - b);
    const mid = n >> 1;
    out[i] = (n % 2) ? col[mid] : (col[mid - 1] + col[mid]) / 2;
  }
  return out;
}

/** index of the min / max element of a numeric series. @param {number[]} xs */
function argmin(xs) { return xs.reduce((b, x, i) => (x < xs[b] ? i : b), 0); }
function argmax(/** @type {number[]} */ xs) { return xs.reduce((b, x, i) => (x > xs[b] ? i : b), 0); }

/**
 * Derive the liveness signals from a frame sequence (pure — no I/O). Also returns the representative
 * TIME of each action (the extremum frame: deepest blink, most-left / most-right yaw) so the caller
 * can enforce that the actions happened in the challenge's requested ORDER — a single pre-recorded
 * clip of all actions then can't satisfy an arbitrary random challenge.
 * @param {Array<{landmarks:any[], descriptor:number[], t:number}>} frames
 * @returns {{ ok:boolean, reason?:string, blinked:boolean, turnedLeft:boolean, turnedRight:boolean, identityConsistent:boolean, moved:boolean, durationMs:number, actionTimes:Record<string,number> }}
 */
function analyzeFrames(frames) {
  const fail = (/** @type {string} */ reason) => ({ ok: false, reason, blinked: false, turnedLeft: false, turnedRight: false, identityConsistent: false, moved: false, durationMs: 0, actionTimes: {} });
  if (!Array.isArray(frames) || frames.length < MIN_FRAMES) return fail(`Need at least ${MIN_FRAMES} frames`);
  if (frames.length > MAX_FRAMES) return fail(`Too many frames (max ${MAX_FRAMES})`);
  if (!frames.every(isValidFrame)) return fail('Malformed frame (need 68 landmarks + a valid descriptor + timestamp)');

  const ts = frames.map((f) => f.t);
  for (let i = 1; i < ts.length; i++) if (ts[i] < ts[i - 1]) return fail('Frame timestamps not monotonic');
  const durationMs = ts[ts.length - 1] - ts[0];
  if (durationMs < MIN_DURATION_MS) return fail('Capture too short — hold the pose through the prompts');
  if (durationMs > MAX_DURATION_MS) return fail('Capture window expired — retry');

  const ears = frames.map((f) => eyeAspectRatio(f.landmarks));
  const yaws = frames.map((f) => headYaw(f.landmarks));

  // A blink = eyes provably open at some frame AND provably closed at another.
  const blinked = Math.max(...ears) > EAR_OPEN && Math.min(...ears) < EAR_CLOSED;
  const turnedLeft = Math.min(...yaws) < -YAW_TURN;
  const turnedRight = Math.max(...yaws) > YAW_TURN;

  // When each action peaked (∞ if it never happened) — used for order enforcement.
  const actionTimes = {
    blink: blinked ? ts[argmin(ears)] : Infinity,
    turn_left: turnedLeft ? ts[argmin(yaws)] : Infinity,
    turn_right: turnedRight ? ts[argmax(yaws)] : Infinity,
  };

  // Not a static image: EAR or yaw must actually move (a printed photo's landmarks barely vary).
  const moved = variance(ears) > 1e-4 || variance(yaws) > MIN_YAW_VARIATION * MIN_YAW_VARIATION;

  // Same person throughout — catches a mid-capture identity SWAP (a different face → distance ≫ 1).
  // Reference = the per-dimension MEDIAN descriptor, which is robust to a bad first/edge detection and
  // to a MINORITY of swapped frames (a swap can't drag the median), and the budget is lenient because
  // the subject is DELIBERATELY blinking + turning. Comparing every frame to a possibly-bad frames[0]
  // at the tight 0.55 cutoff was the real-device failure ("Liveness not proven (identity_consistent)").
  const ref = medianDescriptor(frames.map((f) => f.descriptor));
  const identityConsistent = frames.every((f) => faceEngine.faceDistance(ref, f.descriptor) <= IDENTITY_CONSISTENCY_MAX);

  return { ok: true, blinked, turnedLeft, turnedRight, identityConsistent, moved, durationMs, actionTimes };
}

/** A fresh random challenge: 2–3 distinct actions in random order. Deterministic RNG is injected so
 * it's testable and the workflow-safe `Math.random` ban never bites callers. @param {() => number} rng */
function randomActions(rng = Math.random) {
  const pool = [...ACTIONS];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const n = 2 + Math.floor(rng() * 2);            // 2 or 3
  return pool.slice(0, n);
}

/**
 * Decide liveness for a completed challenge. PURE: the caller loads/consumes the stored challenge.
 * @param {{ actions:string[], issuedAt:number }} challenge
 * @param {Array<{landmarks:any[], descriptor:number[], t:number}>} frames
 * @param {number} now
 * @returns {{ live:boolean, reason:string, checks:Array<{check:string,pass:boolean}> }}
 */
function verifyLiveness(challenge, frames, now = 0) {
  const a = analyzeFrames(frames);
  const detected = { blink: a.blinked, turn_left: a.turnedLeft, turn_right: a.turnedRight };
  // The prompted actions must occur in ORDER: each action's peak strictly after the previous one's.
  // A pre-recorded clip containing all actions can't satisfy an arbitrary random ordering.
  const times = challenge.actions.map((act) => /** @type {any} */ (a.actionTimes)[act]);
  const ordered = times.every((t, i) => Number.isFinite(t) && (i === 0 || t > times[i - 1]));
  const checks = [
    { check: 'frames', pass: a.ok, detail: a.reason || 'ok' },
    { check: 'identity_consistent', pass: a.identityConsistent },
    { check: 'motion', pass: a.moved },
    ...challenge.actions.map((act) => ({ check: 'action:' + act, pass: !!(/** @type {any} */ (detected)[act]) })),
    { check: 'action_order', pass: ordered },
  ];
  const expired = now > 0 && (now - challenge.issuedAt) > CHALLENGE_TTL_MS;
  const live = a.ok && a.identityConsistent && a.moved && !expired && ordered && challenge.actions.every((act) => (/** @type {any} */ (detected)[act]));
  const failed = checks.find((c) => !c.pass);
  return { live, reason: expired ? 'Challenge expired' : (live ? 'Liveness confirmed' : `Liveness not proven (${failed ? failed.check : 'unknown'})`), checks };
}

module.exports = {
  ACTIONS, CHALLENGE_TTL_MS, MIN_FRAMES, MAX_FRAMES,
  eyeAspectRatio, headYaw, analyzeFrames, verifyLiveness, randomActions, isValidFrame,
};
