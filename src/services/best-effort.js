// @ts-check
// services/best-effort.js — make fire-and-forget side effects OBSERVABLE.
//
// The problem: the codebase had ~60 `.catch(() => {})` sites. A silent catch is the right shape for
// "this must not break the request" — but the empty body throws the error into a black hole. When one
// of those is a DPDP erasure delete (VaultDocument, LocationPing) or a money reconcile (coupon
// release, stock roll-back), a silent failure means the data ISN'T erased / the money ISN'T reconciled
// and NO ONE KNOWS. That's a compliance and correctness hole, not resilience.
//
// bestEffort() keeps the "don't break the caller" contract but routes the failure through the shared
// PII-redacting logger with context, so the failure is queryable in prod and alertable. It is the ONLY
// thing that replaces `.catch(() => {})` on a path that matters.

const { logger } = require('../lib/logger');

/**
 * Run a side effect that must not break the caller, but MUST be observable if it fails.
 * Never throws. Resolves to the operation's result, or `undefined` if it failed.
 *
 * @template T
 * @param {Promise<T> | (() => Promise<T>)} work  a promise, or a thunk returning one (so a synchronous
 *   throw while *starting* the work is caught too, not just a rejection)
 * @param {string | Record<string, unknown>} ctx  an op label ('erasure:vault-docs') or a context object
 *   ({ op, userId, orderRef, … }). Keep it PII-free; the logger redacts as a second net regardless.
 * @returns {Promise<T | undefined>}
 */
function bestEffort(work, ctx) {
  const context = typeof ctx === 'string' ? { op: ctx } : (ctx || {});
  let p;
  try {
    p = typeof work === 'function' ? work() : work;
  } catch (err) {
    logFailure(err, context);
    return Promise.resolve(undefined);
  }
  return Promise.resolve(p).catch((err) => {
    logFailure(err, context);
    return undefined;
  });
}

/** @param {unknown} err @param {Record<string, unknown>} context */
function logFailure(err, context) {
  // Logging must NEVER throw — a broken log line can't be allowed to break the caller we promised to protect.
  try {
    logger.warn({ ...context, err: err instanceof Error ? err.message : String(err) }, 'best-effort operation failed');
  } catch { /* swallow — see above */ }
}

module.exports = { bestEffort };
