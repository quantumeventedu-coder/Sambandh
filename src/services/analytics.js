// services/analytics.js — fire-and-forget event tracking.
// Never blocks or fails the request path.

const AnalyticsEvent = require('../models/AnalyticsEvent');

function track(name, userId = null, props = {}) {
  AnalyticsEvent.create({ name, userId: userId || undefined, props })
    .catch(() => { /* analytics must never break the product */ });
}

module.exports = { track };
