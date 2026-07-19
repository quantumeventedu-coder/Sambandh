// @ts-check
// src/lib/request-log.js — per-request tracing.
//
// Assigns every request a stable id (honouring an inbound `x-request-id` from a
// proxy so a trace can be followed across hops), hangs a child logger off it, and
// logs one structured line when the response finishes with method, path, status
// and latency. Query/params are redacted; the request BODY is never logged.

const crypto = require('crypto');
const { logger, redact } = require('./logger');

/** @returns {import('express').RequestHandler} */
function requestLogger() {
  return (req, res, next) => {
    const inbound = req.headers['x-request-id'];
    const reqId = (typeof inbound === 'string' && /^[\w-]{1,64}$/.test(inbound))
      ? inbound
      : crypto.randomUUID();
    const log = logger.child({ reqId });
    req.reqId = reqId;
    req.log = log;
    res.setHeader('x-request-id', reqId);

    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      const rec = {
        method: req.method,
        // route pattern when known (/api/users/:id), else the raw path — but strip
        // the query string so ?token=… style values never land in logs.
        path: (req.route && req.baseUrl != null ? req.baseUrl + req.route.path : null)
          || String(req.originalUrl || req.url).split('?')[0],
        status: res.statusCode,
        ms: Math.round(ms * 10) / 10,
        ip: undefined                                 // deliberately omitted (PII)
      };
      const q = req.query && Object.keys(req.query).length ? redact(req.query) : undefined;
      if (q) /** @type {any} */(rec).query = q;
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      log[level](rec, 'request');
    });

    next();
  };
}

module.exports = { requestLogger };
