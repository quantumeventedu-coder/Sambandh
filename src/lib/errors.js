// @ts-check
// src/lib/errors.js — a small, explicit error taxonomy.
//
// Route code throws a typed error (or calls next(err)); the single error handler
// maps it to an HTTP status + a STABLE machine code the client can branch on,
// logs it at a severity matched to its class, and — critically — never leaks a
// stack trace or an unexpected message to the client in production.
//
//   throw new NotFoundError('profile');       → 404 { error, code: 'not_found' }
//   throw new ValidationError('email invalid');→ 400 { error, code: 'validation' }
//
// 4xx are "expected" (client's fault) and logged at warn; 5xx are "ours" and
// logged at error with the full stack (server-side only).

/** Base class: an error that carries an HTTP status + a stable code. */
class AppError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, code?: string, expose?: boolean, details?: unknown }} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = opts.status || 500;
    this.code = opts.code || 'internal';
    // expose=true → the message is safe to show the client. 5xx default to false
    // so an unexpected internal message never reaches a user.
    this.expose = opts.expose !== undefined ? opts.expose : this.status < 500;
    if (opts.details !== undefined) this.details = opts.details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

class ValidationError extends AppError {
  /** @param {string} [m] @param {unknown} [details] */
  constructor(m = 'Invalid request', details) { super(m, { status: 400, code: 'validation', details }); }
}
class AuthError extends AppError {
  /** @param {string} [m] */
  constructor(m = 'Authentication required') { super(m, { status: 401, code: 'unauthenticated' }); }
}
class ForbiddenError extends AppError {
  /** @param {string} [m] */
  constructor(m = 'Not allowed') { super(m, { status: 403, code: 'forbidden' }); }
}
class NotFoundError extends AppError {
  /** @param {string} [what] */
  constructor(what = 'resource') { super(`${what} not found`, { status: 404, code: 'not_found' }); }
}
class ConflictError extends AppError {
  /** @param {string} [m] */
  constructor(m = 'Conflict') { super(m, { status: 409, code: 'conflict' }); }
}
class RateLimitError extends AppError {
  /** @param {string} [m] */
  constructor(m = 'Too many requests') { super(m, { status: 429, code: 'rate_limited' }); }
}

/**
 * Normalise any thrown value into the shape the handler sends. Recognises our
 * AppErrors, a few well-known third-party shapes (Zod, JWT, Mongo/PG dup-key),
 * and falls back to a masked 500.
 * @param {any} err
 * @returns {{ status: number, code: string, message: string, expose: boolean, details?: unknown }}
 */
function normalize(err) {
  if (err instanceof AppError) {
    return { status: err.status, code: err.code, message: err.message, expose: err.expose, details: err.details };
  }
  // Zod
  if (err && err.name === 'ZodError' && Array.isArray(err.issues)) {
    return { status: 400, code: 'validation', message: 'Invalid request', expose: true,
      details: err.issues.map((/** @type {any} */ i) => ({ path: i.path, message: i.message })) };
  }
  // jsonwebtoken
  if (err && (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError')) {
    return { status: 401, code: 'unauthenticated', message: 'Invalid or expired session', expose: true };
  }
  // Postgres / Mongo duplicate key
  if (err && (err.code === '23505' || err.code === 11000)) {
    return { status: 409, code: 'conflict', message: 'Already exists', expose: true };
  }
  if (err && err.type === 'entity.too.large') {
    return { status: 413, code: 'payload_too_large', message: 'Upload too large', expose: true };
  }
  const status = (err && (err.status || err.statusCode)) || 500;
  return {
    status,
    code: status >= 500 ? 'internal' : 'error',
    message: err && err.message ? String(err.message) : 'Internal server error',
    expose: status < 500
  };
}

/**
 * The single Express error handler. Logs (server-side, with stack for 5xx) and
 * replies with a masked, stable-coded JSON body.
 * @returns {import('express').ErrorRequestHandler}
 */
function errorHandler() {
  return (err, req, res, _next) => {
    const n = normalize(err);
    const log = (req && req.log) || require('./logger').logger;
    const meta = { code: n.code, status: n.status, reqId: req && req.reqId };
    if (n.status >= 500) log.error({ ...meta, err: { message: err && err.message, stack: err && err.stack } }, 'request failed');
    else log.warn(meta, 'request rejected');

    if (res.headersSent) return;
    const body = {
      error: n.expose ? n.message : 'Internal server error',
      code: n.code
    };
    if (n.details !== undefined) /** @type {any} */(body).details = n.details;
    if (req && req.reqId) /** @type {any} */(body).reqId = req.reqId;
    res.status(n.status).json(body);
  };
}

module.exports = {
  AppError, ValidationError, AuthError, ForbiddenError, NotFoundError,
  ConflictError, RateLimitError, normalize, errorHandler
};
