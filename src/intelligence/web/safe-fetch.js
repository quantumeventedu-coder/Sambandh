// intelligence/web/safe-fetch.js — the ONLY way the engine retrieves a URL.
//
// Defences:
//  · http/https only, no credentials in URLs, standard ports only
//  · every resolved IP is checked against private/reserved ranges INSIDE the
//    socket's DNS lookup (so DNS-rebinding cannot swap in an internal address)
//  · redirects are followed manually (max 3) and re-validated at every hop
//  · size cap, timeout, content-type allowlist, decompression with a cap
//  · polite per-host spacing and an identifying User-Agent

const http = require('http');
const https = require('https');
const dns = require('dns');
const net = require('net');
const zlib = require('zlib');

const UA = 'SambandhSetuBot/1.0 (+https://www.sambandh.online/bot)';
const ALLOWED_TYPES = /^(text\/html|text\/plain|application\/xhtml\+xml|application\/pdf|application\/json|text\/markdown|application\/xml|text\/xml)/i;

function ipv4Private(ip) {
  const p = ip.split('.').map(Number);
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0 && p[2] === 0) ||
    (a === 192 && b === 0 && p[2] === 2) || (a === 198 && (b === 18 || b === 19)) || (a === 198 && b === 51 && p[2] === 100) ||
    (a === 203 && b === 0 && p[2] === 113) || a >= 224;
}

function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) return ipv4Private(ip);
  if (net.isIPv6(ip)) {
    const x = ip.toLowerCase().replace(/^\[|\]$/g, '');
    if (x === '::' || x === '::1') return true;
    if (x.startsWith('::ffff:')) { const v4 = x.slice(7); return net.isIPv4(v4) ? ipv4Private(v4) : true; }
    if (/^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith('ff') || x.startsWith('64:ff9b:') || x.startsWith('2001:db8')) return true;
    return false;
  }
  return true;
}

function validateUrl(raw, { allowPrivate = false } = {}) {
  let u;
  try { u = new URL(String(raw)); } catch { throw Object.assign(new Error('invalid URL'), { code: 'BAD_URL' }); }
  if (!['http:', 'https:'].includes(u.protocol)) throw Object.assign(new Error('only http(s) URLs are allowed'), { code: 'BAD_SCHEME' });
  if (u.username || u.password) throw Object.assign(new Error('credentials in URLs are not allowed'), { code: 'BAD_URL' });
  const port = u.port ? Number(u.port) : (u.protocol === 'https:' ? 443 : 80);
  if (!allowPrivate && ![80, 443, 8080, 8443].includes(port)) throw Object.assign(new Error('port not allowed'), { code: 'BAD_PORT' });
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!allowPrivate) {
    if (/^(localhost|.*\.localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i.test(host)) throw Object.assign(new Error('internal hostname blocked'), { code: 'BLOCKED_HOST' });
    if (net.isIP(host) && isPrivateAddress(host)) throw Object.assign(new Error('private address blocked'), { code: 'BLOCKED_IP' });
  }
  return u;
}

function guardedLookup(allowPrivate) {
  return (hostname, options, cb) => {
    if (typeof options === 'function') { cb = options; options = {}; }
    dns.lookup(hostname, { all: true, verbatim: true }, (err, addrs) => {
      if (err) return cb(err);
      const list = (addrs || []).filter(a => allowPrivate || !isPrivateAddress(a.address));
      if (!list.length || (!allowPrivate && list.length !== addrs.length)) {
        return cb(Object.assign(new Error('resolved to a private address'), { code: 'BLOCKED_IP' }));
      }
      if (options && options.all) return cb(null, list);
      return cb(null, list[0].address, list[0].family);
    });
  };
}

const lastHit = new Map();   // host → ts (politeness)
async function politeWait(host, minIntervalMs) {
  const last = lastHit.get(host) || 0;
  const wait = last + minIntervalMs - Date.now();
  lastHit.set(host, Math.max(Date.now(), last + minIntervalMs));
  if (wait > 0) await new Promise(r => setTimeout(r, Math.min(wait, 5000)));
}

function requestOnce(u, { timeoutMs, maxBytes, allowPrivate, headers }) {
  return new Promise((resolve, reject) => {
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request(u, {
      method: 'GET',
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/pdf,text/plain;q=0.9,*/*;q=0.5', 'accept-encoding': 'gzip, deflate, br', 'accept-language': 'en-IN,en;q=0.9', ...(headers || {}) },
      lookup: guardedLookup(allowPrivate),
      timeout: timeoutMs
    }, res => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        return resolve({ redirect: res.headers.location, status });
      }
      const ctype = String(res.headers['content-type'] || '');
      if (status === 200 && ctype && !ALLOWED_TYPES.test(ctype)) { res.destroy(); return reject(Object.assign(new Error('unsupported content type ' + ctype.split(';')[0]), { code: 'BAD_TYPE' })); }
      const enc = String(res.headers['content-encoding'] || '').toLowerCase();
      let stream = res;
      if (enc === 'gzip') stream = res.pipe(zlib.createGunzip());
      else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
      else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress());
      const chunks = []; let size = 0; let truncated = false;
      stream.on('data', c => {
        size += c.length;
        if (size > maxBytes) { truncated = true; chunks.push(c.subarray(0, Math.max(0, c.length - (size - maxBytes)))); res.destroy(); stream.destroy(); return; }
        chunks.push(c);
      });
      const finish = () => resolve({ status, headers: res.headers, contentType: ctype, body: Buffer.concat(chunks), truncated });
      stream.on('end', finish);
      stream.on('close', () => { if (truncated) finish(); });
      stream.on('error', e => (truncated ? finish() : reject(e)));
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })));
    req.on('error', reject);
    req.end();
  });
}

async function safeFetch(rawUrl, { timeoutMs = 10000, maxBytes = 2500000, maxRedirects = 3, allowPrivate = false, perHostIntervalMs = 0, headers } = {}) {
  let u = validateUrl(rawUrl, { allowPrivate });
  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (perHostIntervalMs) await politeWait(u.host, perHostIntervalMs);
    const r = await requestOnce(u, { timeoutMs, maxBytes, allowPrivate, headers });
    if (r.redirect) {
      if (hop === maxRedirects) throw Object.assign(new Error('too many redirects'), { code: 'REDIRECTS' });
      u = validateUrl(new URL(r.redirect, u).toString(), { allowPrivate });
      continue;
    }
    return { url: String(rawUrl), finalUrl: u.toString(), status: r.status, contentType: r.contentType, body: r.body, truncated: r.truncated, headers: r.headers };
  }
  throw Object.assign(new Error('too many redirects'), { code: 'REDIRECTS' });
}

module.exports = { safeFetch, validateUrl, isPrivateAddress, UA };
