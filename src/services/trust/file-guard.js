// @ts-check
// services/trust/file-guard.js — AAV Layer 11/12: file validation & upload safety.
//
// Validates an uploaded document's RAW BYTES against its claimed type before any
// other layer touches it. Pure function over a Buffer — no I/O, independently
// testable. Fails SECURE: anything it cannot positively validate is rejected. The
// client's declared MIME/filename is treated as untrusted input, never the source
// of truth (the magic-byte sniff is).

/** Leading byte signatures. WEBP/RIFF is confirmed by the 'WEBP' tag at offset 8. */
const MAGIC = {
  jpeg: [[0xFF, 0xD8, 0xFF]],
  png: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  gif: [[0x47, 0x49, 0x46, 0x38]],
  pdf: [[0x25, 0x50, 0x44, 0x46, 0x2D]],   // %PDF-
  webp: [[0x52, 0x49, 0x46, 0x46]]         // RIFF….WEBP
};
/** Only these are acceptable as an identity document upload. */
const ALLOWED = new Set(['jpeg', 'png', 'webp', 'pdf']);
const MAX_BYTES = 12 * 1024 * 1024;   // 12 MB
/** @type {Record<string, string>} */
const MIME_FOR = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf', gif: 'image/gif' };
const DANGEROUS_EXT = /\.(exe|dll|js|mjs|sh|bat|cmd|com|scr|jar|msi|vbs|ps1|php|phtml|htm|html|xhtml|svg|xml|hta)$/i;

/** @param {Buffer} buf @param {number[]} sig */
function startsWith(buf, sig) { return sig.every((b, i) => buf[i] === b); }

/** True content type from bytes, or null. @param {Buffer} buf @returns {string|null} */
function sniff(buf) {
  for (const [type, sigs] of Object.entries(MAGIC)) {
    if (sigs.some(s => buf.length >= s.length && startsWith(buf, s))) {
      if (type === 'webp') return (buf.length >= 12 && buf.slice(8, 12).toString('ascii') === 'WEBP') ? 'webp' : null;
      return type;
    }
  }
  return null;
}

/**
 * Inspect an uploaded file's bytes.
 * @param {Buffer} buf
 * @param {{ filename?: string, declaredMime?: string }} [meta]
 * @returns {{ ok: boolean, hardFail: boolean, type: string|null, reasons: string[], risk: number }}
 */
function inspectFile(buf, meta = {}) {
  /** @type {string[]} */ const reasons = [];
  let hardFail = false;
  if (!Buffer.isBuffer(buf) || buf.length === 0) return { ok: false, hardFail: true, type: null, reasons: ['empty-file'], risk: 100 };
  if (buf.length > MAX_BYTES) { reasons.push('oversized'); hardFail = true; }

  const type = sniff(buf);
  if (!type) { reasons.push('unrecognised-header'); hardFail = true; }
  else if (!ALLOWED.has(type)) { reasons.push('type-not-allowed:' + type); hardFail = true; }

  const name = String(meta.filename || '');
  if (/\.[a-z0-9]{1,5}\.[a-z0-9]{1,5}$/i.test(name)) { reasons.push('double-extension'); hardFail = true; }
  if (DANGEROUS_EXT.test(name)) { reasons.push('dangerous-extension'); hardFail = true; }

  // The client's declared MIME must match what the bytes actually are.
  if (meta.declaredMime && type && meta.declaredMime.toLowerCase() !== MIME_FOR[type]) reasons.push('mime-mismatch');

  // Polyglot / executable smuggling: a file that also parses as a script or a PE.
  const head = buf.slice(0, 1024).toString('latin1');
  if (buf.slice(0, 2).toString('ascii') === 'MZ') { reasons.push('windows-executable'); hardFail = true; }
  if (/(<\?php|<script\b|#!\s*\/)/i.test(head)) { reasons.push('polyglot-payload'); hardFail = true; }   // a raw archive/other type is already caught by the header sniff

  // PDF active content — JavaScript / auto-actions / embedded files / launch.
  if (type === 'pdf') {
    const pdfText = buf.slice(0, Math.min(buf.length, 262144)).toString('latin1');
    if (/\/(JavaScript|JS)\b/.test(pdfText)) { reasons.push('pdf-javascript'); hardFail = true; }
    if (/\/(OpenAction|AA)\b/.test(pdfText)) { reasons.push('pdf-auto-action'); hardFail = true; }
    if (/\/(Launch|EmbeddedFile)\b/.test(pdfText)) { reasons.push('pdf-embedded-payload'); hardFail = true; }
    if (/\/Encrypt\b/.test(pdfText)) reasons.push('pdf-encrypted');
  }

  const ok = reasons.length === 0;
  const risk = ok ? 0 : Math.min(100, (hardFail ? 60 : 0) + reasons.length * 15);
  return { ok, hardFail, type, reasons, risk };
}

module.exports = { inspectFile, sniff, ALLOWED, MAX_BYTES, MIME_FOR };
