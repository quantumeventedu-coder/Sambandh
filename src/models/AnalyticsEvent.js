const mongoose = require('mongoose');
// Product analytics events (spec §2.1.1 analytics events + §12).
// PostHog replaces/augments this in production; this keeps funnels measurable locally.
const AnalyticsEventSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  props: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now, index: true }
});
module.exports = mongoose.model('AnalyticsEvent', AnalyticsEventSchema);
