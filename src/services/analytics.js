// services/analytics.js — fire-and-forget event tracking.
// Never blocks or fails the request path.

const AnalyticsEvent = require('../models/AnalyticsEvent');

/**
 * @param {string} name
 * @param {string | null} [userId]
 * @param {Record<string, unknown>} [props]
 */
function track(name, userId = null, props = {}) {
  AnalyticsEvent.create({ name, userId: userId || undefined, props })
    // DELIBERATELY silent (not routed through bestEffort): this is the highest-frequency write path and
    // a dropped analytics event has no correctness / money / privacy consequence. Logging every failure
    // here would spam the very log stream that matters when something real breaks. Left silent on purpose.
    .catch(() => { /* analytics must never break the product */ });
}

module.exports = { track };
