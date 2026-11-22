// intelligence/learning.js — controlled learning (NOT model-weight training).
//
// The platform improves through controlled, auditable updates:
//   · feedback on answers (👍/👎 + reason) adjusts the confidence of the memories
//     that answer relied on
//   · corrections become versioned memory updates (old text kept in history)
//   · evaluation datasets are built ONLY from users who opted in
//     (preferences.aiTrainingConsent), with PII redacted and no user id
//   · inferred memories decay when stale; expired memories are removed
// Private conversations are never used to train model weights.

const AssistantMessage = require('../models/AssistantMessage');
const EvalExample = require('../models/EvalExample');
const Memory = require('../models/Memory');
const User = require('../models/User');
const memory = require('./memory');
const extractMod = require('./extract');
const config = require('./config');
const metrics = require('./metrics');
const { decryptText, redactPII } = require('./security');

const DAY = 86400000;

async function recordFeedback(userId, messageId, { rating, reason = '', correction = '', memoryId = null } = {}) {
  const r = Number(rating);
  if (![1, -1].includes(r)) throw Object.assign(new Error('rating must be 1 or -1'), { status: 400 });
  const msg = await AssistantMessage.findOne({ _id: messageId, userId, role: 'assistant' }).lean();
  if (!msg) return null;
  await AssistantMessage.findOneAndUpdate({ _id: messageId, userId }, { $set: { feedback: { rating: r, reason: String(reason).slice(0, 300), correction: String(correction).slice(0, 1000), at: new Date() } } });
  metrics.bump(r > 0 ? 'feedback.positive' : 'feedback.negative');

  // Confidence updates on the memories this answer used.
  const delta = r > 0 ? 0.03 : -0.1;
  for (const id of msg.memoryRefs || []) {
    const m = await Memory.findOne({ _id: id, userId }).lean();
    if (!m) continue;
    const c = Math.max(0.05, Math.min(0.98, (m.confidence || 0.6) + delta));
    await Memory.findOneAndUpdate({ _id: id, userId }, { $set: { confidence: c } });
  }

  // Corrections: versioned update of a specific memory, or a new corrected memory
  // that supersedes conflicting older ones (memory.remember handles conflicts).
  let learned = null;
  const corr = String(correction || '').trim();
  if (corr) {
    if (memoryId) learned = { action: 'corrected', memory: await memory.correct(userId, memoryId, { text: corr, reason: 'feedback_correction' }) };
    else {
      const ex = extractMod.rulesExtract(corr);
      const it = ex.items[0];
      const res = await memory.remember(userId, {
        category: it ? it.category : 'semantic', kind: it ? it.kind : 'fact', text: corr, origin: 'corrected', confidence: 0.9,
        source: { conversationId: String(msg.conversationId), messageId: String(messageId), kind: 'correction' }
      });
      learned = { action: res.action, memory: res.memory, previous: res.previous || null };
    }
    metrics.bump('learning.corrections');
  }

  // Consent-gated evaluation example (no user id, PII redacted).
  const cfg = await config.get();
  const user = await User.findById(userId).select('preferences.aiTrainingConsent').lean();
  if (cfg.learning.evalDatasetEnabled && user && user.preferences && user.preferences.aiTrainingConsent) {
    const prev = await AssistantMessage.findOne({ userId, conversationId: msg.conversationId, role: 'user', createdAt: { $lt: msg.createdAt } }).sort({ createdAt: -1 }).lean();
    await EvalExample.create({
      prompt: redactPII(prev ? decryptText(prev.content) : '').slice(0, 2000),
      answer: redactPII(decryptText(msg.content)).slice(0, 4000),
      rating: r, reason: String(reason).slice(0, 300), correction: redactPII(corr).slice(0, 1000),
      modelId: (msg.model && msg.model.id) || null
    });
    metrics.bump('learning.eval_examples');
  }
  return { ok: true, learned };
}

// Nightly maintenance: expire, decay stale inferences (never explicit ones).
async function maintenance({ now = new Date() } = {}) {
  const expired = await Memory.find({ expiresAt: { $lt: now } }).limit(5000).lean();
  for (const m of expired) await Memory.deleteOne({ _id: m._id });
  const stale = await Memory.find({ origin: 'inferred', status: 'active', updatedAt: { $lt: new Date(now.getTime() - 180 * DAY) } }).limit(5000).lean();
  let decayed = 0, retired = 0;
  for (const m of stale) {
    const lastUse = m.lastAccessedAt ? new Date(m.lastAccessedAt) : new Date(m.updatedAt);
    if (now.getTime() - lastUse.getTime() < 90 * DAY) continue;
    const c = +(Math.max(0, (m.confidence || 0.6) * 0.85)).toFixed(3);
    if (c < 0.2) { await Memory.findOneAndUpdate({ _id: m._id }, { $set: { status: 'superseded', supersededBy: 'decay', updatedAt: now } }); retired++; }
    else { await Memory.findOneAndUpdate({ _id: m._id }, { $set: { confidence: c } }); decayed++; }
  }
  metrics.bump('learning.maintenance.runs');
  return { expired: expired.length, decayed, retired };
}

async function qualityStats({ days = 30 } = {}) {
  const since = new Date(Date.now() - days * DAY);
  const rows = await AssistantMessage.find({ role: 'assistant', createdAt: { $gt: since } }).select('feedback model').lean();
  let pos = 0, neg = 0, rated = 0, basic = 0;
  const byModel = {};
  for (const r of rows) {
    const mid = (r.model && r.model.id) || 'unknown';
    byModel[mid] = byModel[mid] || { answers: 0, positive: 0, negative: 0 };
    byModel[mid].answers++;
    if (r.model && r.model.mode === 'basic') basic++;
    const f = r.feedback && r.feedback.rating;
    if (f === 1) { pos++; rated++; byModel[mid].positive++; }
    else if (f === -1) { neg++; rated++; byModel[mid].negative++; }
  }
  const evalExamples = await EvalExample.countDocuments({});
  return { days, answers: rows.length, rated, positive: pos, negative: neg, helpfulRate: rated ? +(pos / rated).toFixed(3) : null, basicModeShare: rows.length ? +(basic / rows.length).toFixed(3) : null, byModel, evalExamples };
}

module.exports = { recordFeedback, maintenance, qualityStats };
