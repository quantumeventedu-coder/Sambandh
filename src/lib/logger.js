// @ts-check
// src/lib/logger.js — the one structured logger for the whole backend.
//
// Two rules this module exists to enforce:
//   1. Logs are STRUCTURED (JSON lines) so they can be shipped/queried in prod.
//   2. Logs NEVER carry personal data. Under India's DPDP Act, a user's email,
//      phone, Aadhaar/PAN, birth details, photos or auth tokens leaking into logs
//      is a reportable breach. `redact()` is a pure, deeply-tested scrubber that
//      every request/error log path runs its payload through, and pino's own
//      `redact` paths are a second net for anything logged as a raw object.
//
// Import the shared instance:  const { logger } = require('./lib/logger');
// Child per request:           req.log = logger.child({ reqId });

const pino = require('pino');

/**
 * Field names whose VALUES are personal/secret and must never be logged.
 * Matched case-insensitively against object keys at any depth.
 */
const PII_KEYS = new Set([
  'password', 'passwordhash', 'pass', 'pwd',
  'token', 'accesstoken', 'refreshtoken', 'jwt', 'authorization', 'auth', 'cookie',
  'otp', 'code', 'secret', 'apikey', 'api_key', 'x-ai-key', 'privatekey',
  'email', 'phone', 'mobile', 'msisdn',
  'aadhaar', 'aadhar', 'pan', 'passport', 'dl', 'voterid',
  'dob', 'birthdate', 'birthtime', 'birthplace', 'lat', 'lng', 'latitude', 'longitude',
  'photo', 'photos', 'image', 'images', 'selfie', 'avatar', 'faceembedding', 'embedding',
  'address', 'pincode', 'ip'
]);

const CENSOR = '[redacted]';
const MAX_DEPTH = 6;

// Value-shaped PII that can appear inside otherwise-innocent strings.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /(?:\+?\d[\d ()-]{8,}\d)/g;                       // 10+ digit runs
const JWT_RE = /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const DATAURI_RE = /data:[a-z/+.-]+;base64,[A-Za-z0-9+/=]{16,}/gi;

/**
 * Scrub PII from a string value (emails, phone numbers, JWTs, data: URIs).
 * @param {string} s
 * @returns {string}
 */
function scrubString(s) {
  if (s.length > 2000) s = s.slice(0, 2000) + '…';                // never log unbounded blobs
  return s
    .replace(DATAURI_RE, '[image]')
    .replace(JWT_RE, '[token]')
    .replace(EMAIL_RE, '[email]')
    .replace(PHONE_RE, m => (m.replace(/\D/g, '').length >= 10 ? '[phone]' : m));
}

/**
 * Deeply redact PII from any value before it is logged. Pure and defensive:
 * unknown key → kept; PII key → censored; nested objects/arrays walked to a
 * bounded depth; cycles handled; strings scrubbed for value-shaped PII.
 * @param {unknown} value
 * @param {number} [depth]
 * @param {WeakSet<object>} [seen]
 * @returns {unknown}
 */
function redact(value, depth = 0, seen = new WeakSet()) {
  if (value == null) return value;
  if (typeof value === 'string') return scrubString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object') return undefined;                // functions/symbols dropped

  if (depth >= MAX_DEPTH) return '[truncated]';
  if (seen.has(/** @type {object} */(value))) return '[circular]';
  seen.add(/** @type {object} */(value));

  if (Array.isArray(value)) {
    return value.slice(0, 50).map(v => redact(v, depth + 1, seen));
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [k, v] of Object.entries(/** @type {Record<string, unknown>} */(value))) {
    if (PII_KEYS.has(k.toLowerCase())) { out[k] = CENSOR; continue; }
    out[k] = redact(v, depth + 1, seen);
  }
  return out;
}

const level = process.env.LOG_LEVEL
  || (process.env.NODE_ENV === 'production' ? 'info'
    : process.env.NODE_ENV === 'test' ? 'silent' : 'debug');

const logger = pino({
  level,
  base: { service: 'sambandh', env: process.env.NODE_ENV || 'development' },
  // Second net: if a raw object with these paths is ever logged directly, pino
  // censors them itself. redact() above is the primary, deep scrubber.
  redact: {
    paths: [
      'req.headers.authorization', 'req.headers.cookie', 'headers.authorization',
      '*.password', '*.email', '*.phone', '*.token', '*.otp', '*.aadhaar', '*.pan',
      'password', 'email', 'phone', 'token', 'otp', 'jwt', 'secret'
    ],
    censor: CENSOR
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (label) => ({ level: label }) }   // human-readable level, not a number
});

module.exports = { logger, redact, scrubString, PII_KEYS, CENSOR };
