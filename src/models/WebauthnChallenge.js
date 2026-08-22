const mongoose = require('../db/odm');

// A short-lived WebAuthn challenge, PERSISTED (not in an in-process Map) so the two-request passkey
// handshake — options → verify — works across serverless instances. On Vercel the two requests routinely
// land on different lambdas, each with its own empty Map, which made every passkey enrol/sign-in fail with
// "Challenge expired". Single-use: the verify step deletes the row on read.
const WebauthnChallengeSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },   // 'reg:<userId>' (enrol) or 'login:<challenge>' (sign-in)
  challenge: { type: String, required: true },
  origin: { type: String },
  rpId: { type: String },
  expiresAt: { type: Date, index: true },
});

module.exports = mongoose.model('WebauthnChallenge', WebauthnChallengeSchema);
