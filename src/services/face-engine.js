// services/face-engine.js — our own face verification (ported from EdurankAI).
//
// The browser computes a 128-d face descriptor with @vladmandic/face-api
// (client-side ML, models from CDN, no external API, no keys). The SERVER does
// the distance comparison here so a malicious client can't fake a match. Used
// for: (1) selfie liveness/quality gate, (2) selfie↔ID-photo face match, and
// (3) DUPLICATE-FACE detection — the same person enrolling on multiple accounts
// is a strong fraud/ban-evasion signal.

// Threshold tuned for @vladmandic/face-api 128-d descriptors. Lower = stricter.
// 0.55 is the standard match cutoff from the reference implementation.
const FACE_MATCH_THRESHOLD = 0.55;

// Euclidean distance between two 128-d descriptors. Smaller = more similar.
function faceDistance(a, b) {
  const n = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < n; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}

// JSONB descriptors can come back as an array OR an object with numeric keys.
function normalizeDescriptor(stored) {
  if (Array.isArray(stored)) return stored;
  if (stored && typeof stored === 'object') return Object.values(stored);
  if (typeof stored === 'string') { try { return normalizeDescriptor(JSON.parse(stored)); } catch { return []; } }
  return [];
}

// Validate a descriptor isn't garbage (right length, not a blank/black frame).
function isValidDescriptor(d, expectedLen = 128) {
  const arr = normalizeDescriptor(d);
  if (arr.length !== expectedLen) return false;
  let nonZero = 0;
  for (const v of arr) {
    if (typeof v !== 'number' || !Number.isFinite(v)) return false;
    if (Math.abs(v) > 1e-6) nonZero++;
  }
  return nonZero > 8;
}

// { matched, distance } for two descriptors.
function matchFaces(a, b) {
  const distance = faceDistance(normalizeDescriptor(a), normalizeDescriptor(b));
  return { matched: distance < FACE_MATCH_THRESHOLD, distance: +distance.toFixed(4) };
}

// Duplicate-face detection: given a new descriptor and a list of {userId, descriptor}
// from OTHER accounts, return the ones within the match threshold (same person).
function findDuplicateFaces(descriptor, others) {
  const d = normalizeDescriptor(descriptor);
  const hits = [];
  for (const o of others) {
    const stored = normalizeDescriptor(o.descriptor);
    if (stored.length !== 128) continue;
    const distance = faceDistance(d, stored);
    if (distance < FACE_MATCH_THRESHOLD) hits.push({ userId: o.userId, distance: +distance.toFixed(4) });
  }
  return hits.sort((a, b) => a.distance - b.distance);
}

// DB-backed duplicate scan across all enrolled users (uses the User model).
async function scanForDuplicateFace(userId, descriptor) {
  const User = require('../models/User');
  const enrolled = await User.find({ faceDescriptor: { $exists: true, $ne: null }, _id: { $ne: userId } })
    .select('faceDescriptor').limit(2000);
  const others = enrolled
    .filter(u => Array.isArray(u.faceDescriptor) && u.faceDescriptor.length === 128)
    .map(u => ({ userId: u._id, descriptor: u.faceDescriptor }));
  return findDuplicateFaces(descriptor, others);
}

module.exports = {
  FACE_MATCH_THRESHOLD, faceDistance, normalizeDescriptor, isValidDescriptor,
  matchFaces, findDuplicateFaces, scanForDuplicateFace
};
