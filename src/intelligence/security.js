// intelligence/security.js — the guard rails every intelligence component uses.
//
//  · encryption at rest for memory / assistant content (AES-256-GCM)
//  · keyed hashing so keyword search works without storing plaintext terms
//  · prompt-injection detection + untrusted-content sanitising/fencing
//  · PII redaction (logs, evaluation datasets)
//  · crisis/distress detection (English + Hindi/Hinglish) with India helplines

const crypto = require('crypto');

// ---------------- keys ----------------
// MEMORY_KEY: dedicated 32-byte key (64 hex) — recommended in production.
// Fallback: derived from JWT_SECRET with scrypt (the same pattern as the vault).
// The salt is a public KDF parameter, not a secret.
const KDF_SALT = 'sambandh-memory-v1'; // gitleaks:allow (public scrypt salt)
let _keys = null;
function keys() {
  const hex = process.env.MEMORY_KEY;
  const basis = hex && /^[0-9a-fA-F]{64}$/.test(hex) ? 'env:' + hex : 'jwt:' + (process.env.JWT_SECRET || 'sambandh-dev-secret');
  if (_keys && _keys.basis === basis) return _keys;
  const master = hex && /^[0-9a-fA-F]{64}$/.test(hex)
    ? Buffer.from(hex, 'hex')
    : crypto.scryptSync(process.env.JWT_SECRET || 'sambandh-dev-secret', KDF_SALT, 32);
  const enc = crypto.createHmac('sha256', master).update('enc').digest();
  const mac = crypto.createHmac('sha256', master).update('kw').digest();
  _keys = { basis, enc, mac, version: hex ? 'm1' : 'j1' };
  return _keys;
}

function encryptText(plain) {
  if (plain == null) return plain;
  const k = keys();
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', k.enc, iv);
  const ct = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return `enc:${k.version}:` + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}

function decryptText(blob) {
  if (typeof blob !== 'string' || !blob.startsWith('enc:')) return blob; // plaintext legacy / tests
  try {
    const parts = blob.split(':');
    const raw = Buffer.from(parts.slice(2).join(':'), 'base64');
    const k = keys();
    const d = crypto.createDecipheriv('aes-256-gcm', k.enc, raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
  } catch {
    return '';   // wrong key / tampered: never throw into a request path
  }
}

function keyedHash(term) {
  return crypto.createHmac('sha256', keys().mac).update(String(term)).digest('hex').slice(0, 16);
}

// ---------------- prompt injection ----------------
const INJECTION_PATTERNS = [
  /ignore (all |any |the )?(previous|prior|above|earlier|your) (instructions|rules|prompts?|directions)/i,
  /disregard (all |any |the )?(previous|prior|above|your) (instructions|rules)/i,
  /\b(system|developer) prompt\b/i,
  /reveal (your|the) (prompt|instructions|rules|system)/i,
  /\byou are now\b|\bfrom now on you (are|will)\b/i,
  /\b(developer|god|jailbreak|dan) mode\b/i,
  /\bpretend (you are|to be)\b|\bact as (an? )?(unfiltered|unrestricted)/i,
  /\bnew instructions?:/i,
  /<\|(im_start|im_end|system|assistant|user)\|>|\[\/?INST\]|<<\/?SYS>>|###\s*(system|instruction)/i,
  /\b(send|forward|email|post) (me |us )?(the |all )?(user|their|his|her) (data|messages|chats|password|phone|address)/i,
  /\bcall (the )?(tool|function) .* (with|for) (user|userid|another)/i
];

function detectInjection(text) {
  const t = String(text || '');
  const hits = [];
  for (const re of INJECTION_PATTERNS) if (re.test(t)) hits.push(re.source.slice(0, 40));
  return hits;
}

// Clean untrusted text (web pages, documents, other users' messages) before it
// may enter a prompt: strip control/zero-width chars and chat-template tokens,
// neutralise instruction-like lines, cap length.
function sanitizeUntrusted(text, max = 6000) {
  let t = String(text || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[​-‏‪-‮⁠-⁤﻿]/g, '')
    .replace(/<\|[^|>]{0,40}\|>/g, ' ')
    .replace(/\[\/?INST\]|<<\/?SYS>>/gi, ' ');
  t = t.split('\n').map(line => (detectInjection(line).length ? '[removed: instruction-like text from an untrusted source]' : line)).join('\n');
  t = t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return t.length > max ? t.slice(0, max) + ' …' : t;
}

// Fence untrusted content with an unguessable boundary so the model can tell
// data from instructions (paired with the system rule in the assistant prompt).
function fenceUntrusted(label, text) {
  const id = crypto.randomBytes(4).toString('hex');
  return `<<UNTRUSTED ${label} ${id}>>\n${sanitizeUntrusted(text)}\n<<END ${id}>>`;
}

// ---------------- PII ----------------
function redactPII(text) {
  return String(text || '')
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[email]')
    .replace(/(\+?91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g, '[phone]')
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, '[id-number]')          // Aadhaar-shaped
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, '[pan]')
    .replace(/\b(?:\d[ -]?){13,19}\b/g, '[card]');
}

// ---------------- crisis / distress ----------------
const DISTRESS = [
  /\b(want|wanna|going) to die\b/i, /\bkill (myself|me)\b/i, /\bend (my|this) life\b/i,
  /\bsuicid/i, /\bself[- ]?harm\b/i, /\bhurt(ing)? myself\b/i, /\bno reason to live\b/i,
  /\b(don'?t|do not) want to (live|be alive|exist)\b/i,
  /\bmar(na|ne) (chahta|chahti|chahte)\b/i, /\bmar jaa?(na|unga|ungi|oon)\b/i,
  /\bjeena nahi\b/i, /\bkhud ?kushi\b/i, /\baatm?ahatya\b/i, /\bzindagi khatam\b/i,
  /आत्महत्या/, /मरना चाहत/, /जीना नहीं/
];
function detectDistress(text) { return DISTRESS.some(re => re.test(String(text || ''))); }

// India: Tele-MANAS (Govt. of India, 24x7, free) 14416 or 1-800-891-4416;
// national emergency number 112.
const CRISIS_REPLY = [
  'It sounds like you are carrying something very heavy right now, and I am really glad you said it.',
  'You do not have to go through this alone. Please talk to someone right now:',
  '• Tele-MANAS (Government of India, free, 24×7): call 14416 or 1-800-891-4416',
  '• If you are in immediate danger: call 112',
  'If you can, reach out to someone you trust and let them know how you are feeling. I am here whenever you want to talk.'
].join('\n');

module.exports = {
  encryptText, decryptText, keyedHash,
  detectInjection, sanitizeUntrusted, fenceUntrusted,
  redactPII, detectDistress, CRISIS_REPLY,
  _resetKeysForTests: () => { _keys = null; }
};
