const mongoose = require('../db/odm');
// Daily aggregate counters for the admin intelligence dashboard. Counts only:
// never message content, queries or URLs.
const IntelligenceMetricSchema = new mongoose.Schema({
  day: { type: String, required: true, unique: true },   // YYYY-MM-DD (UTC)
  counters: mongoose.Schema.Types.Mixed,
  updatedAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('IntelligenceMetric', IntelligenceMetricSchema);
