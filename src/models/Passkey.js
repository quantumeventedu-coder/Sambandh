const mongoose = require('../db/odm');
// A WebAuthn credential (passkey) — fingerprint / Face ID / Windows Hello /
// security key. The private key never leaves the user's device; we store only
// the public key + signature counter (services/webauthn.js).
const PasskeySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  credentialId: { type: String, required: true, unique: true, index: true },
  publicKey: { type: String, required: true }, // JWK JSON string
  alg: { type: Number, required: true },
  counter: { type: Number, default: 0 },
  name: String,
  transports: String,
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: Date
});
module.exports = mongoose.model('Passkey', PasskeySchema);
