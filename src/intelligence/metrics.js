// intelligence/metrics.js — operational telemetry for the admin dashboard.
//
// Counters + latency samples are kept in memory (per process) for live views and
// flushed to a daily aggregate document (IntelligenceMetric) for history. Only
// COUNTS and timings are recorded — never prompts, messages, queries or URLs.

const IntelligenceMetric = require('../models/IntelligenceMetric');
const dbReady = require('./db-ready');

const MAX_SAMPLES = 300;
const live = {
  startedAt: new Date(),
  models: {},        // modelKey → { calls, errors, inputTokens, outputTokens, lat:[], lastError, lastOkAt, lastErrorAt }
  counters: {}       // flat name → n
};
let pending = {};    // counters not yet flushed to the daily doc
let flushTimer = null;

function dayKey(d = new Date()) { return d.toISOString().slice(0, 10); }

function bump(name, n = 1) {
  live.counters[name] = (live.counters[name] || 0) + n;
  pending[name] = (pending[name] || 0) + n;
  scheduleFlush();
}

function modelEntry(key) {
  if (!live.models[key]) live.models[key] = { calls: 0, errors: 0, inputTokens: 0, outputTokens: 0, lat: [] };
  return live.models[key];
}

function recordModelCall(modelKey, task, { ok, latencyMs, inputTokens = 0, outputTokens = 0, error } = {}) {
  const m = modelEntry(modelKey);
  m.calls++;
  if (latencyMs != null) { m.lat.push(latencyMs); if (m.lat.length > MAX_SAMPLES) m.lat.shift(); }
  m.inputTokens += inputTokens || 0;
  m.outputTokens += outputTokens || 0;
  if (ok) m.lastOkAt = new Date();
  else { m.errors++; m.lastErrorAt = new Date(); m.lastError = String(error || 'error').slice(0, 160); }
  const safeKey = String(modelKey).replace(/[^a-zA-Z0-9_-]/g, '_');
  bump(`model.${safeKey}.calls`);
  if (!ok) bump(`model.${safeKey}.errors`);
  if (inputTokens) bump(`model.${safeKey}.tokensIn`, inputTokens);
  if (outputTokens) bump(`model.${safeKey}.tokensOut`, outputTokens);
  bump(`task.${task}.calls`);
}

function percentile(arr, p) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

function modelStats() {
  const out = {};
  for (const [k, m] of Object.entries(live.models)) {
    out[k] = {
      calls: m.calls, errors: m.errors,
      errorRate: m.calls ? +(m.errors / m.calls).toFixed(3) : 0,
      p50: percentile(m.lat, 50), p95: percentile(m.lat, 95),
      inputTokens: m.inputTokens, outputTokens: m.outputTokens,
      lastOkAt: m.lastOkAt || null, lastErrorAt: m.lastErrorAt || null, lastError: m.lastError || null
    };
  }
  return out;
}

function scheduleFlush() {
  if (flushTimer || process.env.NODE_ENV === 'test') return;
  flushTimer = setTimeout(() => { flushTimer = null; flush().catch(() => {}); }, 5000);
  if (flushTimer.unref) flushTimer.unref();
}

async function flush() {
  if (!dbReady()) return;
  const batch = pending; pending = {};
  if (!Object.keys(batch).length) return;
  const inc = {};
  for (const [k, v] of Object.entries(batch)) inc['counters.' + k] = v;
  try {
    await IntelligenceMetric.findOneAndUpdate(
      { day: dayKey() },
      { $inc: inc, $set: { updatedAt: new Date() }, $setOnInsert: { day: dayKey() } },
      { upsert: true, new: true }
    );
  } catch {
    // DB unavailable: put the counts back so they are not lost
    for (const [k, v] of Object.entries(batch)) pending[k] = (pending[k] || 0) + v;
  }
}

async function history(days = 14) {
  const since = dayKey(new Date(Date.now() - days * 86400000));
  try {
    const rows = await IntelligenceMetric.find({ day: { $gte: since } }).sort({ day: 1 }).lean();
    return rows.map(r => ({ day: r.day, counters: r.counters || {} }));
  } catch { return []; }
}

function snapshot() {
  return { since: live.startedAt, counters: { ...live.counters }, models: modelStats() };
}

function _reset() { live.models = {}; live.counters = {}; pending = {}; }

module.exports = { bump, recordModelCall, modelStats, snapshot, history, flush, _reset };
