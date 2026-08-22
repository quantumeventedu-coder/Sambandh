// Persistent, single-use store for WebAuthn passkey challenges. Replaces the previous module-level
// `new Map()`, which was lost between the options request and the verify request whenever they landed on
// different serverless instances (Vercel) — breaking passkey enrolment and sign-in in production.
const WebauthnChallenge = require('../models/WebauthnChallenge');

const TTL_MS = 5 * 60 * 1000;   // 5 minutes — long enough for the OS biometric prompt, short enough to be safe

// Store (or replace) the challenge under `key`. Persisted so the verify handler can read it on any instance.
async function putChallenge(key, data) {
  const expiresAt = new Date(Date.now() + TTL_MS);
  await WebauthnChallenge.findOneAndUpdate(
    { key },
    { $set: { key, challenge: data.challenge, origin: data.origin, rpId: data.rpId, expiresAt } },
    { upsert: true });
  // Opportunistic prune of expired rows (fire-and-forget — never block or throw the request).
  WebauthnChallenge.deleteMany({ expiresAt: { $lt: new Date() } }).catch(() => {});
}

// Read AND consume the challenge (single-use). Returns null if missing or expired.
async function takeChallenge(key) {
  const c = await WebauthnChallenge.findOne({ key });
  if (!c) return null;
  await WebauthnChallenge.deleteOne({ key });                        // single-use — delete on read
  if (!c.expiresAt || new Date(c.expiresAt).getTime() < Date.now()) return null;
  return { challenge: c.challenge, origin: c.origin, rpId: c.rpId };
}

module.exports = { putChallenge, takeChallenge };
