const mongoose = require('../db/odm');

// One active-liveness challenge. Issued to a user, single-use (status pending→consumed via an atomic
// CAS so a captured challenge can't be replayed), and time-boxed. The `actions` are the random
// sequence the user must perform; the server verifies them from the submitted landmark frames.
const LivenessChallengeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  actions: [{ type: String, enum: ['blink', 'turn_left', 'turn_right'] }],
  status: { type: String, enum: ['pending', 'consumed'], default: 'pending', index: true },
  issuedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
  consumedAt: { type: Date },
});

module.exports = mongoose.model('LivenessChallenge', LivenessChallengeSchema);
