const mongoose = require('../db/odm');
// The Setu Journey for one matched pair (keyed by their chat). A stage advances
// only when BOTH people have completed it: nobody can move the other forward.
const JourneySchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true, unique: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  stage: { type: String, default: 'connect' },
  status: { type: String, enum: ['active', 'paused', 'closed', 'complete'], default: 'active' },
  completions: mongoose.Schema.Types.Mixed,     // { [stage]: { [userId]: ISO date } }
  stageHistory: [{ stage: String, enteredAt: Date }],
  pausedBy: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Journey', JourneySchema);
