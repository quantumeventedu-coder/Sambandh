// services/webauthn.js — WebAuthn passkeys (ported from EdurankAI).
//
// Fully self-built. No @simplewebauthn, no external service. We do our own:
//   · CBOR decode of the attestation object + COSE public key
//   · authenticatorData parsing (rpIdHash / flags / counter / attested cred)
//   · COSE -> JWK and signature verification via node:crypto
// Browser uses the native navigator.credentials API. We accept 'none'
// attestation (the standard choice for passkeys — trust on first use).

const { createHash, createPublicKey, verify: cryptoVerify, randomBytes } = require('crypto');
const Passkey = require('../models/Passkey');

// Effective origin + RP ID for a request. The authenticator signs over the page
// origin; we trust the Origin header (falling back to host), RP ID = hostname.
function rpFromRequest(req) {
  let origin = req.headers.origin || '';
  if (!origin) {
    const host = req.headers.host || 'localhost:3010';
    origin = (req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https://' : 'http://') + host;
  }
  let rpId = 'localhost';
  try { rpId = new URL(origin).hostname; } catch { /* keep default */ }
  return { origin, rpId };
}

// ---- base64url ----
function b64url(buf) { return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64urlToBuf(s) {
  let t = (s || '').replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  return Buffer.from(t, 'base64');
}

// ---- minimal CBOR decoder (definite-length subset used by WebAuthn) ----
function cborDecodeFirst(buf) {
  let off = 0;
  function read() {
    const first = buf[off++];
    const major = first >> 5;
    const info = first & 0x1f;
    let len = info;
    if (info === 24) len = buf[off++];
    else if (info === 25) { len = buf.readUInt16BE(off); off += 2; }
    else if (info === 26) { len = buf.readUInt32BE(off); off += 4; }
    else if (info === 27) { const hi = buf.readUInt32BE(off); const lo = buf.readUInt32BE(off + 4); off += 8; len = hi * 2 ** 32 + lo; }
    switch (major) {
      case 0: return len;
      case 1: return -1 - len;
      case 2: { const b = buf.subarray(off, off + len); off += len; return b; }
      case 3: { const s = buf.toString('utf8', off, off + len); off += len; return s; }
      case 4: { const arr = []; for (let i = 0; i < len; i++) arr.push(read()); return arr; }
      case 5: { const m = new Map(); for (let i = 0; i < len; i++) { const k = read(); m.set(k, read()); } return m; }
      case 7: { if (info === 20) return false; if (info === 21) return true; return null; }
      default: throw new Error('Unsupported CBOR major type ' + major);
    }
  }
  const value = read();
  return { value, len: off };
}

// ---- authenticatorData ----
function parseAuthData(ad) {
  const rpIdHash = ad.subarray(0, 32);
  const flags = ad[32];
  const counter = ad.readUInt32BE(33);
  const up = !!(flags & 0x01), uv = !!(flags & 0x04), at = !!(flags & 0x40);
  let credId = null, cose = null;
  if (at) {
    let p = 37;
    p += 16; // aaguid
    const credIdLen = ad.readUInt16BE(p); p += 2;
    credId = ad.subarray(p, p + credIdLen); p += credIdLen;
    cose = cborDecodeFirst(ad.subarray(p)).value;
  }
  return { rpIdHash, flags, counter, up, uv, at, credId, cose };
}

// ---- COSE -> JWK ----
function coseToJwk(cose) {
  const kty = cose.get(1);
  const alg = Number(cose.get(3));
  if (kty === 2) { // EC2
    const crv = cose.get(-1);
    const crvName = crv === 2 ? 'P-384' : crv === 3 ? 'P-521' : 'P-256';
    return { jwk: { kty: 'EC', crv: crvName, x: b64url(cose.get(-2)), y: b64url(cose.get(-3)) }, alg };
  }
  if (kty === 3) { // RSA
    return { jwk: { kty: 'RSA', n: b64url(cose.get(-1)), e: b64url(cose.get(-2)) }, alg };
  }
  throw new Error('Unsupported key type');
}

function verifySig(jwk, alg, data, sig) {
  const key = createPublicKey({ key: jwk, format: 'jwk' });
  try {
    if (alg === -7 || alg === -35 || alg === -36) return cryptoVerify('sha256', data, { key, dsaEncoding: 'der' }, sig); // ECDSA
    if (alg === -257 || alg === -258 || alg === -259) return cryptoVerify('sha256', data, key, sig); // RSA PKCS#1 v1.5
  } catch { return false; }
  return false;
}

// ---- queries ----
async function getAllowCredentials(userId) {
  const rows = await Passkey.find({ userId }).select('credentialId transports');
  return rows.map(r => ({ id: r.credentialId, type: 'public-key', transports: (r.transports || '').split(',').filter(Boolean) }));
}
async function listPasskeys(userId) {
  const rows = await Passkey.find({ userId }).sort({ createdAt: -1 });
  return rows.map(r => ({ id: r._id, name: r.name, createdAt: r.createdAt, lastUsedAt: r.lastUsedAt }));
}
async function countPasskeys(userId) { return Passkey.countDocuments({ userId }); }
async function deletePasskey(userId, id) { await Passkey.deleteOne({ _id: id, userId }); }
async function findPasskeyUser(credentialId) {
  const pk = await Passkey.findOne({ credentialId });
  return pk ? { userId: pk.userId } : null;
}

function newChallenge() { return b64url(randomBytes(32)); }

// ---- registration ----
async function registrationOptions({ userId, email, name, rpId, challenge }) {
  return {
    challenge,
    rp: { id: rpId, name: 'Sambandh' },
    user: { id: b64url(Buffer.from(String(userId))), name: email || String(userId), displayName: name || email || 'account' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { userVerification: 'preferred', residentKey: 'preferred' },
    excludeCredentials: await getAllowCredentials(userId),
    attestation: 'none',
    timeout: 60000
  };
}

async function verifyRegistration(userId, body, exp) {
  const clientData = JSON.parse(b64urlToBuf(body.response.clientDataJSON).toString('utf8'));
  if (clientData.type !== 'webauthn.create') throw new Error('Unexpected type');
  if (clientData.challenge !== exp.challenge) throw new Error('Challenge mismatch');
  if (clientData.origin !== exp.origin) throw new Error('Origin mismatch');

  const attObj = cborDecodeFirst(b64urlToBuf(body.response.attestationObject)).value;
  const parsed = parseAuthData(attObj.get('authData'));
  if (!parsed.up) throw new Error('User presence required');
  if (!parsed.rpIdHash.equals(createHash('sha256').update(exp.rpId).digest())) throw new Error('RP ID mismatch');
  if (!parsed.credId || !parsed.cose) throw new Error('No credential in attestation');

  const { jwk, alg } = coseToJwk(parsed.cose);
  const credentialId = b64url(parsed.credId);
  await Passkey.create({
    userId, credentialId, publicKey: JSON.stringify(jwk), alg, counter: parsed.counter,
    name: (body.name || 'Passkey').toString().slice(0, 60), transports: (body.transports || []).join(','), createdAt: new Date()
  });
  return { credentialId };
}

// ---- authentication ----
async function authenticationOptions(userId, rpId, challenge) {
  return {
    challenge, rpId,
    allowCredentials: userId ? await getAllowCredentials(userId) : [],
    userVerification: 'preferred', timeout: 60000
  };
}

// Verifies an assertion; resolves the credential's owner (for passwordless login).
async function verifyAuthentication(body, exp) {
  const credentialId = body.id;
  const pk = await Passkey.findOne({ credentialId });
  if (!pk) throw new Error('Unknown credential');
  const jwk = typeof pk.publicKey === 'string' ? JSON.parse(pk.publicKey) : pk.publicKey;
  const alg = Number(pk.alg);
  const storedCounter = Number(pk.counter) || 0;

  const clientDataBuf = b64urlToBuf(body.response.clientDataJSON);
  const clientData = JSON.parse(clientDataBuf.toString('utf8'));
  if (clientData.type !== 'webauthn.get') throw new Error('Unexpected type');
  if (clientData.challenge !== exp.challenge) throw new Error('Challenge mismatch');
  if (clientData.origin !== exp.origin) throw new Error('Origin mismatch');

  const authData = b64urlToBuf(body.response.authenticatorData);
  const parsed = parseAuthData(authData);
  if (!parsed.up) throw new Error('User presence required');
  if (!parsed.rpIdHash.equals(createHash('sha256').update(exp.rpId).digest())) throw new Error('RP ID mismatch');

  const signedData = Buffer.concat([authData, createHash('sha256').update(clientDataBuf).digest()]);
  if (!verifySig(jwk, alg, signedData, b64urlToBuf(body.response.signature))) throw new Error('Bad signature');

  // Clone detection: a non-zero counter that fails to advance is a red flag.
  if (parsed.counter > 0 && parsed.counter <= storedCounter) throw new Error('Counter regressed');
  await Passkey.findByIdAndUpdate(pk._id, { counter: parsed.counter, lastUsedAt: new Date() });
  return { userId: pk.userId };
}

module.exports = {
  rpFromRequest, b64url, b64urlToBuf, cborDecodeFirst, parseAuthData, coseToJwk, newChallenge,
  getAllowCredentials, listPasskeys, countPasskeys, deletePasskey, findPasskeyUser,
  registrationOptions, verifyRegistration, authenticationOptions, verifyAuthentication
};
