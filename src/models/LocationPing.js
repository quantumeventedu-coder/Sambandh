const mongoose = require('../db/odm');

// A sparse time-series of a user's precise location fixes, captured WHILE THE APP IS OPEN
// (a browser/PWA cannot read GPS when the app is closed — background location needs a native
// app + explicit consent). Powers the admin location map's per-user trail and dwell/duration.
// Admin-only; retained 30 days by the nightly cron.
const LocationPingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  lat: Number,
  lng: Number,
  accuracy: Number,
  at: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model('LocationPing', LocationPingSchema);
