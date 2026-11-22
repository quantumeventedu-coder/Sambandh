// intelligence/jobs.js — durable background jobs.
//
// A DB-backed queue so heavy work (memory extraction, consolidation, research)
// never blocks a request and survives restarts. Claiming is atomic: a
// conditional UPDATE on Postgres (pg-odm atomicUpdate) or findOneAndUpdate on
// Mongo, so two workers never run the same job.
//   · persistent host: startWorker() polls every few seconds
//   · serverless (Vercel): a cron hits POST /api/intelligence/jobs/drain

const IntelligenceJob = require('../models/IntelligenceJob');
const metrics = require('./metrics');

const handlers = new Map();
const LOCK_MS = 5 * 60 * 1000;

function register(type, fn) { handlers.set(type, fn); }

async function enqueue(type, payload = {}, { userId = null, runAt = new Date(), maxAttempts = 3 } = {}) {
  const job = await IntelligenceJob.create({ type, payload, userId: userId || undefined, runAt, maxAttempts, status: 'queued', attempts: 0 });
  metrics.bump('jobs.enqueued.' + type);
  return job;
}

async function tryClaim(id, now) {
  const lockedUntil = new Date(now.getTime() + LOCK_MS);
  if (typeof IntelligenceJob.atomicUpdate === 'function') {
    const d = await IntelligenceJob.atomicUpdate({ _id: id, status: 'queued' }, { $set: { status: 'running', lockedUntil: lockedUntil.toISOString() }, $inc: { attempts: 1 } });
    return d || null;
  }
  return IntelligenceJob.findOneAndUpdate({ _id: id, status: 'queued' }, { $set: { status: 'running', lockedUntil }, $inc: { attempts: 1 } }, { new: true });
}

async function claim(now = new Date()) {
  // Recover jobs whose worker died mid-run.
  const stale = await IntelligenceJob.find({ status: 'running', lockedUntil: { $lt: now } }).limit(10).lean();
  for (const s of stale) await IntelligenceJob.findOneAndUpdate({ _id: s._id, status: 'running' }, { $set: { status: 'queued', runAt: now } });
  const cands = await IntelligenceJob.find({ status: 'queued', runAt: { $lte: now } }).sort({ runAt: 1 }).limit(10).lean();
  for (const c of cands) {
    const got = await tryClaim(c._id, now);
    if (got) return got.toObject ? got.toObject() : got;
  }
  return null;
}

async function progress(jobId, step, detail = '') {
  try { await IntelligenceJob.findOneAndUpdate({ _id: jobId }, { $push: { progress: { at: new Date(), step: String(step).slice(0, 80), detail: String(detail).slice(0, 300) } } }); } catch { /* best-effort */ }
}

async function isCancelled(jobId) {
  const j = await IntelligenceJob.findById(jobId).select('cancelRequested status').lean();
  return !!(j && (j.cancelRequested || j.status === 'cancelled'));
}

async function run(job) {
  const fn = handlers.get(job.type);
  const id = String(job._id);
  if (!fn) {
    await IntelligenceJob.findOneAndUpdate({ _id: id }, { $set: { status: 'failed', error: 'no handler for ' + job.type, finishedAt: new Date() } });
    return { ok: false };
  }
  const t0 = Date.now();
  try {
    const result = await fn(job, { progress: (s, d) => progress(id, s, d), isCancelled: () => isCancelled(id) });
    const cancelled = await isCancelled(id);
    await IntelligenceJob.findOneAndUpdate({ _id: id }, { $set: { status: cancelled ? 'cancelled' : 'done', result: result == null ? null : result, finishedAt: new Date(), lockedUntil: null } });
    metrics.bump('jobs.done.' + job.type);
    metrics.bump('jobs.ms.' + job.type, Date.now() - t0);
    return { ok: true, result };
  } catch (err) {
    const attempts = job.attempts || 1;
    const retry = attempts < (job.maxAttempts || 3);
    await IntelligenceJob.findOneAndUpdate({ _id: id }, {
      $set: retry
        ? { status: 'queued', runAt: new Date(Date.now() + Math.min(300000, 2000 * 2 ** attempts)), error: String(err.message || err).slice(0, 300), lockedUntil: null }
        : { status: 'failed', error: String(err.message || err).slice(0, 300), finishedAt: new Date(), lockedUntil: null }
    });
    metrics.bump(retry ? 'jobs.retried.' + job.type : 'jobs.failed.' + job.type);
    return { ok: false, error: err.message };
  }
}

async function drain({ maxJobs = 5, budgetMs = 20000 } = {}) {
  const t0 = Date.now();
  let ran = 0;
  while (ran < maxJobs && Date.now() - t0 < budgetMs) {
    const job = await claim();
    if (!job) break;
    await run(job);
    ran++;
  }
  return { ran };
}

let timer = null;
function startWorker(intervalMs = 4000) {
  if (timer) return;
  timer = setInterval(() => { drain({ maxJobs: 3, budgetMs: intervalMs * 3 }).catch(() => {}); }, intervalMs);
  if (timer.unref) timer.unref();
}
function stopWorker() { if (timer) clearInterval(timer); timer = null; }

async function get(jobId, userId) {
  const q = { _id: jobId };
  if (userId) q.userId = userId;
  return IntelligenceJob.findOne(q).lean();
}

async function cancel(jobId, userId) {
  const j = await get(jobId, userId);
  if (!j) return null;
  if (j.status === 'queued') await IntelligenceJob.findOneAndUpdate({ _id: jobId }, { $set: { status: 'cancelled', cancelRequested: true, finishedAt: new Date() } });
  else if (j.status === 'running') await IntelligenceJob.findOneAndUpdate({ _id: jobId }, { $set: { cancelRequested: true } });
  return get(jobId, userId);
}

async function stats() {
  const rows = await IntelligenceJob.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const byStatus = {};
  for (const r of rows) byStatus[r._id] = r.count;
  const types = await IntelligenceJob.aggregate([{ $match: { status: { $in: ['queued', 'running', 'failed'] } } }, { $group: { _id: '$type', count: { $sum: 1 } } }]);
  return { byStatus, openByType: Object.fromEntries(types.map(t => [t._id, t.count])) };
}

module.exports = { register, enqueue, claim, run, drain, startWorker, stopWorker, get, cancel, stats, progress };
