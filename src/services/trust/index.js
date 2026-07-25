// @ts-check
// services/trust/index.js — the AAV Trust Engine orchestrator.
//
// Runs the code-only layers + any registered provider adapters over an uploaded
// identity document and returns a Trust Result: a 0–1000 score, a decision band,
// the contributing signals, and a SHA-256 evidence hash for the immutable audit
// record. Fails SECURE end-to-end:
//   · a hard-fail file (executable/polyglot/PDF-JS) → reject
//   · unconfigured ML detectors (ai-image/malware) → unknown → cannot auto-approve
//   · no usable image type → reject
// Nothing here trusts the client or fabricates a pass, and thresholds/factors are
// for server-side use only (never echo raw factors to the uploader).

const crypto = require('crypto');
const { inspectFile } = require('./file-guard');
const { analyzeImage } = require('./metadata-forensics');
const riskEngine = require('./risk-engine');
const providers = require('./providers');

/**
 * @param {Buffer} buf raw document bytes
 * @param {{ filename?: string, declaredMime?: string, ip?: string, userId?: string }} [ctx]
 * @returns {Promise<{ score:number, decision:'auto'|'secondary'|'manual'|'reject', hardFail:boolean, fileType:string|null, evidenceHash:string, signals:object, c2pa:boolean }>}
 */
async function evaluateDocument(buf, ctx = {}) {
  /** @type {import('./risk-engine').Signal[]} */
  const signals = [];

  // Layer 11/12 — file validation & upload safety (weight 2; hard-fails reject).
  const file = inspectFile(buf, { filename: ctx.filename, declaredMime: ctx.declaredMime });
  signals.push({ name: 'file', risk: file.risk, weight: 2, hardFail: file.hardFail });

  // Layer 3 — metadata forensics (images only; PDFs skip image EXIF analysis).
  let c2pa = false;
  if (file.type && file.type !== 'pdf') {
    const meta = analyzeImage(buf, file.type);
    c2pa = meta.c2pa;
    signals.push({ name: 'metadata', risk: meta.risk, weight: 2 });
  }

  // Layers 2/11/1 — external detectors (fail-secure unknown until a vendor is wired).
  for (const cap of ['ai-image', 'malware', 'ip-intel']) {
    signals.push(await providers.run(cap, { buf, ctx }));
  }

  const res = riskEngine.score(signals);
  const evidenceHash = crypto.createHash('sha256').update(buf).digest('hex');

  return {
    score: res.score,
    decision: res.decision,
    hardFail: res.hardFail,
    fileType: file.type,
    evidenceHash,
    c2pa,
    signals: res.factors
  };
}

module.exports = { evaluateDocument, providers, riskEngine };
