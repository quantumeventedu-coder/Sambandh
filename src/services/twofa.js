// services/twofa.js — self-built two-factor auth (ported from EdurankAI).
//
// No third-party libraries, no external service. All maths on our own infra via
// node:crypto:
//   · TOTP (RFC 6238) — Google Authenticator / Authy / any authenticator app
//   · One-time backup recovery codes (hashed at rest)
// Pure functions here; persistence lives on the User model (security.totp,
// security.backupCodes) so it works on both the Postgres and Mongo backends.

const { createHmac, createHash, randomBytes, timingSafeEqual } = require('crypto');

// ---- base32 (RFC 4648, no padding) ----
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const b of buf) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function base32Decode(s) {
  const clean = (s || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0; const out = [];
  for (const c of clean) {
    const idx = B32.indexOf(c); if (idx < 0) continue;
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

// ---- TOTP (RFC 6238, SHA-1, 6 digits, 30s) ----
function generateTotpSecret() { return base32Encode(randomBytes(20)); }

function hotp(secret, counter, digits = 6) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac('sha1', secret).update(buf).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[offset] & 0x7f) << 24) | ((mac[offset + 1] & 0xff) << 16) |
              ((mac[offset + 2] & 0xff) << 8) | (mac[offset + 3] & 0xff);
  return (bin % 10 ** digits).toString().padStart(digits, '0');
}

function safeEqStr(a, b) {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// Verify a 6-digit TOTP against a base32 secret, ±window 30s steps for clock drift.
function verifyTotp(secretB32, token, window = 1) {
  const code = (token || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return false;
  const secret = base32Decode(secretB32);
  const step = Math.floor(Date.now() / 1000 / 30);
  for (let i = -window; i <= window; i++) {
    if (safeEqStr(hotp(secret, step + i), code)) return true;
  }
  return false;
}

// Current valid 6-digit code for a secret (what an authenticator app shows now).
// Used in tests and to simulate an authenticator in automated checks.
function currentTotp(secretB32) {
  return hotp(base32Decode(secretB32), Math.floor(Date.now() / 1000 / 30));
}

// otpauth:// URI — encode as a QR (or tap on a phone) to add the account.
function otpauthUri(secretB32, account, issuer = 'Sambandh') {
  const label = encodeURIComponent(issuer) + ':' + encodeURIComponent(account);
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// Format a secret in groups of 4 for readable manual entry.
function formatSecret(secretB32) { return (secretB32.match(/.{1,4}/g) || []).join(' '); }

// ---- Backup recovery codes (one-time, hashed at rest) ----
function hashCode(code) { return createHash('sha256').update(code.replace(/\s/g, '').toUpperCase()).digest('hex'); }

// Returns { plain: [...10 codes for the user to save...], stored: [{hash}] }.
function generateBackupCodes(n = 10) {
  const plain = [], stored = [];
  for (let i = 0; i < n; i++) {
    const raw = randomBytes(5).toString('hex').toUpperCase().slice(0, 10); // 10 hex chars
    const code = raw.slice(0, 5) + '-' + raw.slice(5);                     // XXXXX-XXXXX
    plain.push(code);
    stored.push({ hash: hashCode(code) });
  }
  return { plain, stored };
}

// Verify a backup code against the stored hashes; returns the matched index or -1.
function matchBackupCode(code, stored) {
  const h = hashCode(code);
  return (stored || []).findIndex(c => c && !c.usedAt && c.hash && safeEqStr(c.hash, h));
}

module.exports = {
  generateTotpSecret, verifyTotp, currentTotp, otpauthUri, formatSecret,
  generateBackupCodes, matchBackupCode, hashCode
};
