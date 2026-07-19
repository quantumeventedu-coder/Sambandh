// models/Waitlist.js — pre-launch waiting list. One row per interested person,
// keyed by a normalised email (unique) so re-submitting is idempotent.
const mongoose = require('../db/odm');
const WaitlistSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true }, // lowercased
  name: String,
  source: { type: String, default: 'home' },       // where they signed up (home hero, dial, …)
  intent: String,                                    // optional: marriage / dating / …
  city: String,
  referrer: String,
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Waitlist', WaitlistSchema);
